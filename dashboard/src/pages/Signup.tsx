import { useState } from 'react';
import { Eye, EyeOff, Loader2, ArrowLeft, Mail, Lock, User as UserIcon } from 'lucide-react';
import { OtpModal } from '../components/OtpModal';
import { userAuthApi } from '../services/api';
import './Signup.css';

interface SignupProps {
  onLogin: (apiKey: string, role?: string) => void;
  onGoToLogin: () => void;
  onGoToHome?: () => void;
}

export function Signup({ onLogin, onGoToLogin, onGoToHome }: SignupProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await userAuthApi.signup({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      setShowOtpModal(true);
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpVerified = (token: string, user: any) => {
    setShowOtpModal(false);
    onLogin(token, user?.role || 'user');
  };

  return (
    <div className="signup-container">
      <div className="signup-card">
        {onGoToHome && (
          <button
            type="button"
            className="back-home-btn"
            onClick={onGoToHome}
          >
            <ArrowLeft size={15} />
            <span>Back to Home</span>
          </button>
        )}
        <div className="signup-header">
          <div className="signup-logo">
            <svg width="48" height="48" viewBox="0 0 100 100" fill="none">
              <path
                d="M50 10C27.909 10 10 27.909 10 50c0 7.086 1.848 13.742 5.086 19.518L10 90l21.018-5.06C36.634 87.973 43.14 90 50 90c22.091 0 40-17.909 40-40S72.091 10 50 10z"
                stroke="#22c55e"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M36 42c1.5-3 4.5-4 7-2 2.5 2 4 6 5 9 1 3 4 5 7 4 3-1 6-4 8-7"
                stroke="#22c55e"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1 className="signup-title">Create an Account</h1>
          <p className="signup-subtitle">Start with your free WhatsApp API Gateway trial</p>
        </div>

        <form onSubmit={handleSignup} className="signup-form">
          <div className="input-group">
            <label htmlFor="name">Full Name</label>
            <div className="input-wrapper">
              <UserIcon size={18} className="field-icon" />
              <input
                id="name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="John Doe"
                className={error && !name ? 'error' : ''}
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-wrapper">
              <Mail size={18} className="field-icon" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={error && !email ? 'error' : ''}
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <Lock size={18} className="field-icon" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className={error && !password ? 'error' : ''}
              />
              <button
                type="button"
                className="toggle-visibility"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="input-wrapper">
              <Lock size={18} className="field-icon" />
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className={error && password !== confirmPassword ? 'error' : ''}
              />
            </div>
          </div>

          {error && <div className="signup-error-message">{error}</div>}

          <button type="submit" className="signup-submit-btn" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Create Account'}
          </button>
        </form>

        <div className="signup-footer-links">
          <span className="footer-link-text">Already have an account?</span>
          <button type="button" className="auth-switch-link-btn" onClick={onGoToLogin}>
            Log In →
          </button>
        </div>
      </div>

      <footer className="signup-footer">
        <span>Made with ❤️ by WebiMatic Solutions</span>
      </footer>

      {showOtpModal && (
        <OtpModal
          email={email.trim()}
          type="signup"
          onSuccess={handleOtpVerified}
          onClose={() => setShowOtpModal(false)}
        />
      )}
    </div>
  );
}
