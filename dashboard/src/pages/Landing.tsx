import { useState } from 'react';
import {
  MessageSquare,
  Zap,
  Shield,
  Code2,
  Cpu,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Smartphone,
  Layers,
  ChevronDown,
  ChevronUp,
  Terminal,
  Copy,
  Check,
  CreditCard,
} from 'lucide-react';
import './Landing.css';

interface LandingProps {
  onGoToLogin: () => void;
  onGoToSignup: (planId?: string) => void;
}

export function Landing({ onGoToLogin, onGoToSignup }: LandingProps) {
  const [activeCodeTab, setActiveCodeTab] = useState<'curl' | 'node' | 'python' | 'php'>('node');
  const [copied, setCopied] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const codeSnippets = {
    curl: `curl -X POST https://openwa.webimaticsolutions.online/api/messages/send-text \\
  -H "X-API-Key: owa_k1_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "sessionId": "sales_bot",
    "to": "919876543210",
    "text": "Hello! Your OTP verification code is 849201. Valid for 5 minutes."
  }'`,
    node: `import axios from 'axios';

const response = await axios.post(
  'https://openwa.webimaticsolutions.online/api/messages/send-text',
  {
    sessionId: 'sales_bot',
    to: '919876543210',
    text: 'Hello! Your OTP verification code is 849201. Valid for 5 minutes.',
  },
  {
    headers: { 'X-API-Key': 'owa_k1_your_api_key_here' }
  }
);

console.log('Message Sent ID:', response.data.messageId);`,
    python: `import requests

url = "https://openwa.webimaticsolutions.online/api/messages/send-text"
headers = {
    "X-API-Key": "owa_k1_your_api_key_here",
    "Content-Type": "application/json"
}
payload = {
    "sessionId": "sales_bot",
    "to": "919876543210",
    "text": "Hello! Your OTP verification code is 849201. Valid for 5 minutes."
}

res = requests.post(url, json=payload, headers=headers)
print("Status:", res.json())`,
    php: `<?php
$ch = curl_init('https://openwa.webimaticsolutions.online/api/messages/send-text');
$payload = json_encode([
  'sessionId' => 'sales_bot',
  'to' => '919876543210',
  'text' => 'Hello! Your OTP verification code is 849201. Valid for 5 minutes.'
]);

curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => $payload,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    'X-API-Key: owa_k1_your_api_key_here',
    'Content-Type: application/json'
  ]
]);

$response = curl_exec($ch);
curl_close($ch);
?>`
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(codeSnippets[activeCodeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const faqs = [
    {
      q: 'How does OpenWA connect to WhatsApp?',
      a: 'OpenWA uses official Multi-Device (MD) protocol. You can link any standard WhatsApp or WhatsApp Business account in seconds by simply scanning a QR code or entering an 8-digit Pairing Code.'
    },
    {
      q: 'Can I manage multiple WhatsApp numbers on one account?',
      a: 'Yes! Depending on your subscription plan, you can create and run multiple independent WhatsApp sessions concurrently with separate webhooks, auto-replies, and API keys.'
    },
    {
      q: 'What payment methods are supported for plan upgrades?',
      a: 'We support seamless online payments via Razorpay (UPI, Google Pay, PhonePe, Credit/Debit Cards, Netbanking) with instant auto-activation. If online gateway is disabled or for offline orders, manual bank/UPI requests with 1-click Admin approval are supported.'
    },
    {
      q: 'Is it suitable for sending OTPs and transactional notifications?',
      a: 'Absolutely. OpenWA provides high-throughput REST APIs designed for low-latency (<100ms) OTPs, order updates, booking confirmations, and customer support automations.'
    },
    {
      q: 'How do Webhooks work?',
      a: 'Whenever an incoming message, delivery receipt, media file, or status update occurs, OpenWA forwards the real-time event to your webhook URL via HTTP POST with HMAC signature verification.'
    }
  ];

  return (
    <div className="landing-container">
      {/* Background Decorative Glow Elements */}
      <div className="landing-glow glow-top-left" />
      <div className="landing-glow glow-top-right" />
      <div className="landing-glow glow-center" />

      {/* Navigation Header */}
      <header className="landing-navbar">
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <div className="brand-icon-wrapper">
              <MessageSquare size={22} className="brand-logo-icon" />
            </div>
            <div className="brand-text">
              <span className="brand-title">OpenWA</span>
              <span className="brand-badge">Gateway</span>
            </div>
          </div>

          <nav className="landing-nav-links">
            <a href="#features">Features</a>
            <a href="#developers">API & Code</a>
            <a href="#solutions">Solutions</a>
            <a href="#faq">FAQ</a>
          </nav>

          <div className="landing-nav-actions">
            <button className="btn-nav-ghost" onClick={onGoToLogin}>
              Sign In
            </button>
            <button className="btn-nav-primary" onClick={() => onGoToSignup()}>
              Get Started <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles size={14} className="hero-badge-icon" />
            <span>Multi-Device WhatsApp API & Automation Platform</span>
          </div>

          <h1 className="hero-title">
            The Ultimate WhatsApp API Gateway for <span className="gradient-text">Developers & Businesses</span>
          </h1>

          <p className="hero-subtitle">
            Connect multiple WhatsApp numbers, send lightning-fast transactional OTPs, automate customer workflows,
            and build intelligent chatbots with rock-solid REST & WebSocket APIs.
          </p>

          <div className="hero-cta-group">
            <button className="btn-hero-primary" onClick={() => onGoToSignup()}>
              <Zap size={18} />
              <span>Start Free Trial</span>
            </button>
            <button className="btn-hero-secondary" onClick={onGoToLogin}>
              <span>Live Dashboard Demo</span>
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Metrics bar */}
          <div className="hero-metrics-bar">
            <div className="metric-item">
              <span className="metric-value">99.9%</span>
              <span className="metric-label">Uptime SLA</span>
            </div>
            <div className="metric-divider" />
            <div className="metric-item">
              <span className="metric-value">&lt; 100ms</span>
              <span className="metric-label">Message Latency</span>
            </div>
            <div className="metric-divider" />
            <div className="metric-item">
              <span className="metric-value">Multi-Session</span>
              <span className="metric-label">Concurrent Numbers</span>
            </div>
            <div className="metric-divider" />
            <div className="metric-item">
              <span className="metric-value">100%</span>
              <span className="metric-label">Isolated Data</span>
            </div>
          </div>
        </div>

        {/* Hero Interactive Terminal / Dashboard Mock */}
        <div className="hero-preview-wrapper">
          <div className="terminal-card">
            <div className="terminal-header">
              <div className="terminal-dots">
                <span className="dot dot-red" />
                <span className="dot dot-yellow" />
                <span className="dot dot-green" />
              </div>
              <div className="terminal-title">
                <Terminal size={14} /> OpenWA Live Gateway Engine
              </div>
              <div className="terminal-status">
                <span className="pulse-dot" /> Online
              </div>
            </div>

            <div className="terminal-body">
              <div className="log-line">
                <span className="log-time">[09:12:04]</span> <span className="log-tag">[INIT]</span> WhatsApp Multi-Device engine initialized
              </div>
              <div className="log-line">
                <span className="log-time">[09:12:05]</span> <span className="log-tag success">[SESSION]</span> Connected session <code className="code-highlight">sales_bot</code> (919876543210)
              </div>
              <div className="log-line">
                <span className="log-time">[09:12:08]</span> <span className="log-tag info">[API]</span> POST /api/messages/send-text - 200 OK (38ms)
              </div>
              <div className="log-line">
                <span className="log-time">[09:12:09]</span> <span className="log-tag purple">[WEBHOOK]</span> Inbound message dispatched to endpoint
              </div>
              <div className="terminal-chat-mock">
                <div className="chat-bubble incoming">
                  <span className="sender">Customer (+91 98765 43210):</span>
                  <p>Can I get my invoice for order #8921?</p>
                </div>
                <div className="chat-bubble outgoing">
                  <span className="sender">OpenWA AutoBot:</span>
                  <p>Hi Raj! Here is your invoice #8921 (PDF attached). Thank you for shopping with us! 🚀</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="section-features">
        <div className="section-header">
          <span className="section-pill">Powerful Features</span>
          <h2 className="section-title">Everything You Need to Scale on WhatsApp</h2>
          <p className="section-subtitle">
            Built from the ground up for maximum reliability, speed, and developer simplicity.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-box bg-cyan">
              <Smartphone size={24} />
            </div>
            <h3 className="feature-title">Multi-Session & Multi-Device</h3>
            <p className="feature-desc">
              Connect multiple phone numbers under one single dashboard using fast QR scanning or 8-digit Pairing Codes.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box bg-emerald">
              <Zap size={24} />
            </div>
            <h3 className="feature-title">High-Speed REST & WebSockets</h3>
            <p className="feature-desc">
              Sub-second message dispatch and real-time WebSocket webhooks for incoming chats, delivery statuses, and reads.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box bg-purple">
              <Layers size={24} />
            </div>
            <h3 className="feature-title">Rich Media & Templates</h3>
            <p className="feature-desc">
              Send images, audio voice notes, video, PDFs, contact cards, and reusable dynamic message templates.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box bg-amber">
              <CreditCard size={24} />
            </div>
            <h3 className="feature-title">Razorpay & Instant Activation</h3>
            <p className="feature-desc">
              Native Razorpay gateway integration for seamless UPI and Card renewals, with manual Admin approval fallback.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box bg-blue">
              <Shield size={24} />
            </div>
            <h3 className="feature-title">User Isolation & Bank-Grade Security</h3>
            <p className="feature-desc">
              Strict per-user data isolation, IP whitelisting, HMAC webhook signatures, and role-based access control.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box bg-rose">
              <Cpu size={24} />
            </div>
            <h3 className="feature-title">AI Bots & Plugin Architecture</h3>
            <p className="feature-desc">
              Easily connect with OpenAI, LangChain, CRM webhooks, and custom plugins for intelligent automated support.
            </p>
          </div>
        </div>
      </section>

      {/* Developer API & Code Sandbox Section */}
      <section id="developers" className="section-developers">
        <div className="dev-container">
          <div className="dev-info">
            <span className="section-pill">Developer First</span>
            <h2 className="section-title">Integrate in Minutes with Any Language</h2>
            <p className="section-subtitle">
              Clean, predictable RESTful endpoints with comprehensive Swagger documentation and full TypeScript support.
            </p>

            <ul className="dev-points">
              <li>
                <CheckCircle2 size={18} className="point-icon" />
                <span>Simple JSON payloads for text, media, location, and documents</span>
              </li>
              <li>
                <CheckCircle2 size={18} className="point-icon" />
                <span>Reliable webhook delivery with automatic retry handling</span>
              </li>
              <li>
                <CheckCircle2 size={18} className="point-icon" />
                <span>Interactive Message Tester inside the dashboard for instant prototyping</span>
              </li>
            </ul>

            <button className="btn-hero-primary" onClick={() => onGoToSignup()}>
              <Code2 size={18} />
              <span>Get API Key</span>
            </button>
          </div>

          <div className="dev-code-box">
            <div className="code-box-header">
              <div className="code-tabs">
                {(['node', 'curl', 'python', 'php'] as const).map(tab => (
                  <button
                    key={tab}
                    className={`code-tab-btn ${activeCodeTab === tab ? 'active' : ''}`}
                    onClick={() => setActiveCodeTab(tab)}
                  >
                    {tab === 'node' ? 'Node.js / TS' : tab.toUpperCase()}
                  </button>
                ))}
              </div>

              <button className="copy-code-btn" onClick={handleCopyCode}>
                {copied ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            <div className="code-box-body">
              <pre>
                <code>{codeSnippets[activeCodeTab]}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Solutions / Use Cases Section */}
      <section id="solutions" className="section-solutions">
        <div className="section-header">
          <span className="section-pill">Use Cases</span>
          <h2 className="section-title">Built for High-Impact Business Automation</h2>
        </div>

        <div className="solutions-grid">
          <div className="solution-card">
            <div className="solution-icon">🛒</div>
            <h3>E-Commerce & Delivery</h3>
            <p>Automate order confirmations, dispatch tracking, COD verification, and cart abandonment reminders.</p>
          </div>
          <div className="solution-card">
            <div className="solution-icon">🔐</div>
            <h3>Authentication & OTPs</h3>
            <p>Deliver 2FA verification codes and password reset tokens in under 1 second with 99.9% deliverability.</p>
          </div>
          <div className="solution-card">
            <div className="solution-icon">💬</div>
            <h3>Customer Support</h3>
            <p>Deploy multi-agent shared inboxes, smart routing, and 24/7 AI chatbot assistants on WhatsApp.</p>
          </div>
          <div className="solution-card">
            <div className="solution-icon">📢</div>
            <h3>Alerts & Reminders</h3>
            <p>Send appointment schedules, fee dues, renewal notices, and urgent flight/booking alerts.</p>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section id="faq" className="section-faq">
        <div className="section-header">
          <span className="section-pill">Common Questions</span>
          <h2 className="section-title">Frequently Asked Questions</h2>
        </div>

        <div className="faq-list">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div key={index} className={`faq-item ${isOpen ? 'open' : ''}`}>
                <button
                  className="faq-question"
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                >
                  <span>{faq.q}</span>
                  {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {isOpen && (
                  <div className="faq-answer">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="section-cta-banner">
        <div className="cta-banner-card">
          <div className="cta-glow" />
          <h2 className="cta-title">Ready to Automate Your WhatsApp Communication?</h2>
          <p className="cta-subtitle">
            Sign up in under 60 seconds. No credit card required to get started.
          </p>
          <div className="cta-actions">
            <button className="btn-hero-primary" onClick={() => onGoToSignup()}>
              Create Free Account <ArrowRight size={18} />
            </button>
            <button className="btn-hero-secondary" onClick={onGoToLogin}>
              Existing User? Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-col brand-col">
            <div className="landing-brand">
              <div className="brand-icon-wrapper">
                <MessageSquare size={20} className="brand-logo-icon" />
              </div>
              <span className="brand-title">OpenWA</span>
            </div>
            <p className="footer-tagline">
              Next-generation WhatsApp Multi-Device Gateway & Automation Engine for high-growth businesses.
            </p>
            <div className="system-status-indicator">
              <span className="status-dot-green" />
              <span>All Systems Operational</span>
            </div>
          </div>

          <div className="footer-col">
            <h4>Product</h4>
            <a href="#features">Features</a>
            <a href="#developers">API Sandbox</a>
            <a href="#solutions">Use Cases</a>
            <a href="#faq">FAQ</a>
          </div>

          <div className="footer-col">
            <h4>Developers</h4>
            <a href="/api/docs" target="_blank" rel="noreferrer">API Documentation</a>
            <a href="#developers">Code Examples</a>
            <button onClick={onGoToLogin} className="footer-link-btn">Message Tester</button>
            <a href="#features">Webhooks & Events</a>
          </div>

          <div className="footer-col">
            <h4>Account</h4>
            <button onClick={onGoToLogin} className="footer-link-btn">Sign In</button>
            <button onClick={() => onGoToSignup()} className="footer-link-btn">Register Free</button>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} OpenWA Automation Engine. All rights reserved.</p>
          <div className="footer-bottom-links">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>Security</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
