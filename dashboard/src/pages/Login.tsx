import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, KeyRound, Mail, Lock, Loader2, ArrowLeft } from 'lucide-react';
import { OtpModal } from '../components/OtpModal';
import { API_BASE_URL, userAuthApi } from '../services/api';
import './Login.css';

interface LoginProps {
  onLogin: (apiKey: string, role?: string) => void;
  onGoToSignup?: () => void;
  onGoToHome?: () => void;
}

export function Login({ onLogin, onGoToSignup, onGoToHome }: LoginProps) {
  const { t } = useTranslation();
  const [authMode, setAuthMode] = useState<'email' | 'apikey'>('email');

  // Email login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // API Key login state
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // OTP modal state
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter your email and password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await userAuthApi.login({
        email: email.trim(),
        password,
      });

      if (res.requiresVerification) {
        setOtpEmail(res.email || email.trim());
        setShowOtpModal(true);
        return;
      }

      if (res.token) {
        onLogin(res.token, res.user?.role || 'user');
      } else {
        setError('Login failed: Invalid server response');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApiKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/auth/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey.trim(),
          Authorization: `Bearer ${apiKey.trim()}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || t('login.invalidKey'));
      }

      const data = await res.json();
      if (data.valid) {
        onLogin(apiKey.trim(), data.role);
      } else {
        throw new Error(t('login.invalidKey'));
      }
    } catch (err: any) {
      setError(err.message || t('login.invalidKey'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSuccess = (token: string, user: any) => {
    setShowOtpModal(false);
    onLogin(token, user?.role || 'user');
  };

  return (
    <div className="login-container">
      <div className="login-card">
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
        <div className="login-header">
          <div className="login-logo">
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
          <h1 className="login-title">OpenWA Gateway</h1>
          <p className="login-version">v0.23.3 · WebiMatic Solutions</p>
        </div>

        {/* Auth Mode Tabs */}
        <div className="auth-mode-tabs">
          <button
            type="button"
            className={`auth-tab ${authMode === 'email' ? 'active' : ''}`}
            onClick={() => {
              setAuthMode('email');
              setError('');
            }}
          >
            <Mail size={16} />
            Email Login
          </button>
          <button
            type="button"
            className={`auth-tab ${authMode === 'apikey' ? 'active' : ''}`}
            onClick={() => {
              setAuthMode('apikey');
              setError('');
            }}
          >
            <KeyRound size={16} />
            API Key
          </button>
        </div>

        {authMode === 'email' ? (
          <form onSubmit={handleEmailLogin} className="login-form">
            <div className="input-group">
              <label htmlFor="loginEmail">Email Address</label>
              <div className="input-wrapper">
                <Mail size={18} className="field-icon" />
                <input
                  id="loginEmail"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={error && !email ? 'error' : ''}
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="loginPassword">Password</label>
              <div className="input-wrapper">
                <Lock size={18} className="field-icon" />
                <input
                  id="loginPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
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

            {error && <span className="error-message">{error}</span>}

            <button type="submit" className="connect-btn" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleApiKeySubmit} className="login-form">
            <div className="input-group">
              <label htmlFor="apiKey">{t('login.apiKey')}</label>
              <div className="input-wrapper">
                <KeyRound size={18} className="field-icon" />
                <input
                  id="apiKey"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={t('login.apiKeyPlaceholder')}
                  className={error ? 'error' : ''}
                />
                <button
                  type="button"
                  className="toggle-visibility"
                  onClick={() => setShowKey(!showKey)}
                  aria-label={showKey ? t('common.hideApiKey') : t('common.showApiKey')}
                >
                  {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {error && <span className="error-message">{error}</span>}
            </div>

            <button type="submit" className="connect-btn" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : t('login.connect')}
            </button>
          </form>
        )}

        {onGoToSignup && (
          <div className="login-footer-links">
            <span className="footer-link-text">Don't have an account?</span>
            <button type="button" className="auth-switch-link-btn" onClick={onGoToSignup}>
              Sign Up Free →
            </button>
          </div>
        )}

        <p className="login-help">
          {t('login.help')}{' '}
          <a href="/api/docs" target="_blank" rel="noopener noreferrer">
            {t('login.viewDocs')}
          </a>
        </p>
      </div>

      <footer className="login-footer">
        <span>{t('login.footer')}</span>
      </footer>

      {showOtpModal && (
        <OtpModal
          email={otpEmail}
          type="signup"
          onSuccess={handleOtpSuccess}
          onClose={() => setShowOtpModal(false)}
        />
      )}
    </div>
  );
}
