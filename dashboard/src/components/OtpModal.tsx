import { useState, useRef, useEffect } from 'react';
import { Loader2, MailCheck, RotateCcw, X } from 'lucide-react';
import { userAuthApi } from '../services/api';
import './OtpModal.css';

interface OtpModalProps {
  email: string;
  type?: 'signup' | 'password_reset' | 'login';
  onSuccess: (token: string, user: any) => void;
  onClose: () => void;
}

export function OtpModal({ email, type = 'signup', onSuccess, onClose }: OtpModalProps) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(60);
  const [isResending, setIsResending] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer(t => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    setError('');

    // Auto advance to next input
    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }

    // Auto submit if all 6 digits entered
    if (newDigits.every(d => d !== '')) {
      handleVerify(newDigits.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pasted)) {
      const arr = pasted.split('');
      setDigits(arr);
      inputsRef.current[5]?.focus();
      handleVerify(pasted);
    }
  };

  const handleVerify = async (code?: string) => {
    const otpCode = code || digits.join('');
    if (otpCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await userAuthApi.verifyOtp({ email, otpCode, type });
      onSuccess(res.token, res.user);
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0 || isResending) return;
    setIsResending(true);
    setError('');
    try {
      await userAuthApi.resendOtp({ email, type });
      setTimer(60);
      setDigits(['', '', '', '', '', '']);
      inputsRef.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="otp-modal-backdrop">
      <div className="otp-modal-content">
        <button className="otp-close-btn" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        <div className="otp-icon-header">
          <MailCheck size={36} className="otp-mail-icon" />
        </div>

        <h2 className="otp-title">Enter Verification Code</h2>
        <p className="otp-subtitle">
          We sent a 6-digit code to <strong className="otp-email">{email}</strong>
        </p>

        <div className="otp-inputs" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={el => {
                inputsRef.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className={`otp-digit-input ${error ? 'error' : ''}`}
            />
          ))}
        </div>

        {error && <div className="otp-error-msg">{error}</div>}

        <button
          className="otp-submit-btn"
          onClick={() => handleVerify()}
          disabled={isLoading || digits.some(d => !d)}
        >
          {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Verify Account'}
        </button>

        <div className="otp-resend-row">
          {timer > 0 ? (
            <span className="otp-timer-text">Resend code in {timer}s</span>
          ) : (
            <button className="otp-resend-btn" onClick={handleResend} disabled={isResending}>
              <RotateCcw size={14} className={isResending ? 'animate-spin' : ''} />
              Resend Code
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
