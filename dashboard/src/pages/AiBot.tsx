import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  Sparkles,
  Save,
  Send,
  Trash2,
  Eye,
  EyeOff,
  Sliders,
  Building2,
  ShoppingCart,
  Calendar,
  Headphones,
  Utensils,
} from 'lucide-react';
import {
  aiBotApi,
  type SaveAiBotConfigPayload,
} from '../services/api';
import { useSessionsQuery } from '../hooks/queries';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../hooks/useToast';
import { useRole } from '../hooks/useRole';
import { PageHeader } from '../components/PageHeader';
import './AiBot.css';

interface SimMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  durationMs?: number;
}

const STARTER_PROMPTS = [
  {
    id: 'support',
    name: 'Customer Support',
    icon: Headphones,
    color: '#3b82f6',
    model: 'gpt-4o-mini',
    prompt: `You are the friendly, professional, and knowledgeable AI Customer Support Specialist for our company.
Your goal is to answer customer questions accurately, courteously, and clearly.

Key Guidelines:
1. Always maintain a warm, helpful, and concise tone. Keep messages readable for WhatsApp (under 3-4 short paragraphs).
2. Answer questions regarding our services, operating hours (Mon-Fri 9AM-6PM), and general inquiries.
3. If a customer requires account changes, refunds, or complex assistance, politely inform them that you will connect them with a human specialist.
4. Use standard WhatsApp formatting: *bold* for emphasis, clean bullet points, and appropriate emojis.`,
  },
  {
    id: 'ecommerce',
    name: 'E-Commerce & Orders',
    icon: ShoppingCart,
    color: '#10b981',
    model: 'gpt-4o-mini',
    prompt: `You are the official WhatsApp Sales & Order Assistant for our online store.
Your goal is to assist customers with product recommendations, order status lookups, and purchasing guidance.

Key Guidelines:
1. Greet customers warmly and offer product recommendations based on their needs.
2. Share catalog links and encourage them to complete their purchase on our store.
3. If a customer asks about return policy: returns are accepted within 14 days of delivery in original packaging.
4. Keep replies crisp, enthusiastic, and easy to read on mobile devices.`,
  },
  {
    id: 'realestate',
    name: 'Real Estate & Leads',
    icon: Building2,
    color: '#8b5cf6',
    model: 'gpt-4o-mini',
    prompt: `You are an expert Real Estate Assistant helping prospective buyers, sellers, and tenants.
Your goal is to qualify inquiries and gather their property requirements.

Key Questions to naturally ask:
1. Preferred location / neighborhood.
2. Budget range.
3. Property type (Apartment, Villa, Commercial) and number of bedrooms.
4. Timeline for moving in.

Once they provide details, thank them and let them know a senior property consultant will follow up with verified listings.`,
  },
  {
    id: 'clinic',
    name: 'Clinic & Appointments',
    icon: Calendar,
    color: '#f59e0b',
    model: 'gpt-4o-mini',
    prompt: `You are the Medical Receptionist & Appointment Coordinator for our wellness clinic.
Your goal is to provide basic information about our doctors, clinic location, and schedule consultations.

Key Guidelines:
1. Operating hours: Monday to Saturday, 8:00 AM – 8:00 PM.
2. When a patient requests an appointment, ask for their full name, preferred date/time slot, and the reason for visit.
3. Never provide medical diagnosis; encourage booking an in-person or telehealth consultation with our licensed physicians.`,
  },
  {
    id: 'restaurant',
    name: 'Restaurant & Bookings',
    icon: Utensils,
    color: '#ec4899',
    model: 'gpt-4o-mini',
    prompt: `You are the Concierge & Table Reservation Assistant for our restaurant.
Your goal is to assist guests with table reservations, menu recommendations, dietary accommodations, and opening hours.

Key Guidelines:
1. Lunch: 12:00 PM – 3:30 PM | Dinner: 6:30 PM – 11:00 PM.
2. For reservations, gather: Guest Name, Party Size, Date & Preferred Time, and any Dietary Restrictions/Allergies.
3. Be vibrant, welcoming, and highlight our chef's daily specialties!`,
  },
];

const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
  gemini: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
  claude: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
  custom: ['deepseek-chat', 'llama-3.3-70b', 'custom-model'],
};

export function AiBot() {
  useDocumentTitle('AI Chatbot & Auto-Responder');
  const { canWrite } = useRole();
  const toast = useToast();

  const { data: sessions = [] } = useSessionsQuery();
  const [selectedSessionId, setSelectedSessionId] = useState('');

  // Configuration Form State
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<'openai' | 'gemini' | 'claude' | 'custom'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [model, setModel] = useState('gpt-4o-mini');
  const [baseUrl, setBaseUrl] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(STARTER_PROMPTS[0].prompt);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(800);
  const [memoryDepth, setMemoryDepth] = useState(10);
  const [handoffKeywords, setHandoffKeywords] = useState<string[]>(['human', 'agent', 'support rep']);
  const [keywordInput, setKeywordInput] = useState('');
  const [excludeGroups, setExcludeGroups] = useState(true);
  const [typingDelaySeconds, setTypingDelaySeconds] = useState(2);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Live Simulator State
  const [simHistory, setSimHistory] = useState<SimMessage[]>([
    {
      id: '1',
      role: 'assistant',
      text: '👋 Hello! I am your AI Auto-Responder assistant. Send me a message below to test my persona and response accuracy in real time.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [simInput, setSimInput] = useState('');
  const [simLoading, setSimLoading] = useState(false);

  // Auto select first session
  useEffect(() => {
    if (!selectedSessionId && sessions.length > 0) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [selectedSessionId, sessions]);

  // Load Bot Config for session
  const loadConfig = useCallback(async () => {
    if (!selectedSessionId) return;
    setLoading(true);
    try {
      const config = await aiBotApi.get(selectedSessionId);
      if (config) {
        setEnabled(config.enabled ?? false);
        setProvider(config.provider || 'openai');
        setApiKey(config.apiKey || '');
        setModel(config.model || 'gpt-4o-mini');
        setBaseUrl(config.baseUrl || '');
        setSystemPrompt(config.systemPrompt || STARTER_PROMPTS[0].prompt);
        setTemperature(config.temperature ?? 0.7);
        setMaxTokens(config.maxTokens ?? 800);
        setMemoryDepth(config.memoryDepth ?? 10);
        setHandoffKeywords(config.humanHandoffKeywords || ['human', 'agent']);
        setExcludeGroups(config.excludeGroups ?? true);
        setTypingDelaySeconds(config.typingDelaySeconds ?? 2);
      } else {
        setEnabled(false);
        setProvider('openai');
        setModel('gpt-4o-mini');
        setSystemPrompt(STARTER_PROMPTS[0].prompt);
      }
    } catch {
      toast.error('Failed to load AI bot configuration');
    } finally {
      setLoading(false);
    }
  }, [selectedSessionId, toast]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  // Provider Tab Change
  const handleProviderChange = (newProvider: typeof provider) => {
    setProvider(newProvider);
    const defaultModels = PROVIDER_MODELS[newProvider];
    if (defaultModels && defaultModels.length > 0) {
      setModel(defaultModels[0]);
    }
  };

  // Apply Starter Prompt Preset
  const applyStarterPrompt = (preset: typeof STARTER_PROMPTS[0]) => {
    setSystemPrompt(preset.prompt);
    toast.success(`Loaded "${preset.name}" preset persona!`);
  };

  // Add Handoff Keyword
  const addHandoffKeyword = () => {
    const trimmed = keywordInput.trim();
    if (trimmed && !handoffKeywords.includes(trimmed)) {
      setHandoffKeywords(prev => [...prev, trimmed]);
      setKeywordInput('');
    }
  };

  const removeHandoffKeyword = (kw: string) => {
    setHandoffKeywords(prev => prev.filter(k => k !== kw));
  };

  // Save Config
  const handleSave = async () => {
    if (!selectedSessionId) return;
    if (enabled && !apiKey.trim() && provider !== 'custom') {
      toast.error(`Please provide an API key for ${provider.toUpperCase()} before activating.`);
      return;
    }

    setSaving(true);
    const payload: SaveAiBotConfigPayload = {
      enabled,
      provider,
      apiKey: apiKey.trim() || null,
      model: model.trim(),
      baseUrl: baseUrl.trim() || null,
      systemPrompt: systemPrompt.trim() || null,
      temperature,
      maxTokens,
      memoryDepth,
      humanHandoffKeywords: handoffKeywords,
      excludeGroups,
      typingDelaySeconds,
    };

    try {
      await aiBotApi.save(selectedSessionId, payload);
      toast.success('AI Chatbot configuration saved & updated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save AI configuration');
    } finally {
      setSaving(false);
    }
  };

  // Live Simulator Send Message
  const handleSendSimMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const userText = simInput.trim();
    if (!userText || simLoading) return;

    if (!apiKey.trim() && provider !== 'custom') {
      toast.error(`Please enter your ${provider.toUpperCase()} API key above to run the live test.`);
      return;
    }

    const newMsg: SimMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory = [...simHistory, newMsg];
    setSimHistory(nextHistory);
    setSimInput('');
    setSimLoading(true);

    try {
      // Build history for API
      const historyPayload = nextHistory
        .filter(m => m.id !== '1') // skip welcome banner
        .map(m => ({ role: m.role, text: m.text }));

      const result = await aiBotApi.test({
        provider,
        apiKey: apiKey.trim(),
        model,
        baseUrl: baseUrl.trim() || undefined,
        systemPrompt,
        temperature,
        maxTokens,
        message: userText,
        history: historyPayload.slice(-memoryDepth),
      });

      setSimHistory(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: result.response,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          durationMs: result.durationMs,
        },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Simulator error');
      setSimHistory(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: `⚠️ Error communicating with ${provider.toUpperCase()}: ${err instanceof Error ? err.message : 'Unknown error'}. Please check your API key and model name.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setSimLoading(false);
    }
  };

  const clearSimChat = () => {
    setSimHistory([
      {
        id: '1',
        role: 'assistant',
        text: '👋 Chat history cleared. Send a message to test your AI bot!',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="ai-bot-page">
      <PageHeader
        title="AI Chatbot & Intelligent Auto-Responder"
        subtitle="Multi-model AI auto-responder with conversation memory, business persona prompt, and live simulator."
        actions={
          <div className="ai-header-actions">
            <div className="ai-session-wrapper">
              <span className="session-select-label">Active WhatsApp Session:</span>
              <select
                className="ai-session-select"
                value={selectedSessionId}
                onChange={e => setSelectedSessionId(e.target.value)}
              >
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.id}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="btn-primary ai-save-btn"
              onClick={handleSave}
              disabled={saving || loading || !canWrite || !selectedSessionId}
            >
              <Save size={16} />
              <span>{saving ? 'Saving...' : loading ? 'Loading...' : 'Save Configuration'}</span>
            </button>
          </div>
        }
      />

      {/* Master Enable Banner */}
      <div className={`ai-status-banner ${enabled ? 'active' : 'paused'}`}>
        <div className="ai-status-left">
          <div className="ai-status-icon-badge">
            <Bot size={22} />
          </div>
          <div>
            <div className="ai-status-title">
              AI Auto-Responder is <strong>{enabled ? 'Active & Live' : 'Paused / Offline'}</strong>
            </div>
            <div className="ai-status-desc">
              {enabled
                ? `Inbound WhatsApp messages on this session are evaluated and answered automatically using ${provider.toUpperCase()} (${model}).`
                : 'Enable the toggle to allow AI to respond to incoming customer messages automatically.'}
            </div>
          </div>
        </div>

        <label className="switch" title={enabled ? 'Click to pause AI' : 'Click to activate AI'}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => setEnabled(e.target.checked)}
            disabled={!canWrite}
          />
          <span className="slider round" />
        </label>
      </div>

      {/* Main 2-Column Layout */}
      <div className="ai-main-grid">
        {/* Left Column: AI Settings & Prompt Editor */}
        <div className="ai-config-col">
          {/* Section 1: Provider & Model */}
          <div className="ai-card">
            <div className="ai-card-header">
              <div className="ai-card-title">
                <Sparkles size={18} className="text-primary" />
                <h3>1. AI Provider & Model</h3>
              </div>
              <span className="ai-card-badge">{provider.toUpperCase()}</span>
            </div>

            {/* Provider Tabs */}
            <div className="provider-tabs">
              <button
                type="button"
                className={`provider-tab ${provider === 'openai' ? 'active' : ''}`}
                onClick={() => handleProviderChange('openai')}
              >
                <span className="p-badge openai">OpenAI</span>
                <span className="p-sub">GPT-4o & Mini</span>
              </button>

              <button
                type="button"
                className={`provider-tab ${provider === 'gemini' ? 'active' : ''}`}
                onClick={() => handleProviderChange('gemini')}
              >
                <span className="p-badge gemini">Google Gemini</span>
                <span className="p-sub">1.5 Flash & Pro</span>
              </button>

              <button
                type="button"
                className={`provider-tab ${provider === 'claude' ? 'active' : ''}`}
                onClick={() => handleProviderChange('claude')}
              >
                <span className="p-badge claude">Anthropic Claude</span>
                <span className="p-sub">3.5 Sonnet & Haiku</span>
              </button>

              <button
                type="button"
                className={`provider-tab ${provider === 'custom' ? 'active' : ''}`}
                onClick={() => handleProviderChange('custom')}
              >
                <span className="p-badge custom">Custom / Ollama</span>
                <span className="p-sub">DeepSeek / Local</span>
              </button>
            </div>

            {/* Form Fields for Provider */}
            <div className="ai-form-fields">
              {/* API Key */}
              <div className="form-group">
                <label htmlFor="ai-key">
                  {provider.toUpperCase()} API Key <span className="required-star">*</span>
                </label>
                <div className="key-input-wrapper">
                  <input
                    id="ai-key"
                    type={showApiKey ? 'text' : 'password'}
                    className="input-field"
                    placeholder={
                      provider === 'openai'
                        ? 'sk-proj-...'
                        : provider === 'gemini'
                        ? 'AIzaSy...'
                        : provider === 'claude'
                        ? 'sk-ant-api03-...'
                        : 'Your API key (optional for local Ollama)'
                    }
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                  />
                  <button
                    type="button"
                    className="key-toggle-btn"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span className="form-helper-text">
                  Your API key is stored securely and used exclusively to generate auto-replies for this session.
                </span>
              </div>

              {/* Model Picker */}
              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="ai-model">Model Selection</label>
                  {PROVIDER_MODELS[provider] ? (
                    <select
                      id="ai-model"
                      value={model}
                      onChange={e => setModel(e.target.value)}
                    >
                      {PROVIDER_MODELS[provider].map(m => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="ai-model"
                      type="text"
                      className="input-field"
                      placeholder="e.g. deepseek-chat"
                      value={model}
                      onChange={e => setModel(e.target.value)}
                    />
                  )}
                </div>

                {/* Base URL (if custom) */}
                {provider === 'custom' && (
                  <div className="form-group">
                    <label htmlFor="ai-baseurl">API Base URL</label>
                    <input
                      id="ai-baseurl"
                      type="text"
                      className="input-field"
                      placeholder="https://api.deepseek.com/v1 or http://localhost:11434/v1"
                      value={baseUrl}
                      onChange={e => setBaseUrl(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Business Persona & System Prompt */}
          <div className="ai-card">
            <div className="ai-card-header">
              <div className="ai-card-title">
                <Bot size={18} className="text-primary" />
                <h3>2. Business Persona & Knowledge Base Prompt</h3>
              </div>
            </div>

            {/* 1-Click Starter Prompts Bar */}
            <div className="starter-prompts-bar">
              <span className="starter-label">1-Click Starter Templates:</span>
              <div className="starter-chips">
                {STARTER_PROMPTS.map(p => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="starter-chip"
                      onClick={() => applyStarterPrompt(p)}
                    >
                      <Icon size={14} style={{ color: p.color }} />
                      <span>{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prompt Textarea */}
            <div className="form-group" style={{ marginTop: '12px' }}>
              <label htmlFor="ai-prompt">System Prompt & Knowledge Base Instructions</label>
              <textarea
                id="ai-prompt"
                className="textarea-field prompt-textarea"
                rows={10}
                placeholder="Define your company info, tone of voice, product details, FAQs, and response instructions..."
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
              />
              <span className="form-helper-text">
                Tip: Instruct the AI on your business identity, working hours, pricing links, and to format with WhatsApp markdown (*bold*, _italic_, bullet points).
              </span>
            </div>
          </div>

          {/* Section 3: Human-Like Accuracy & Guardrails */}
          <div className="ai-card">
            <div className="ai-card-header">
              <div className="ai-card-title">
                <Sliders size={18} className="text-primary" />
                <h3>3. Human-Like Tuning & Guardrails</h3>
              </div>
            </div>

            <div className="tuning-grid">
              {/* Creativity Temperature */}
              <div className="tuning-item">
                <div className="tuning-item-head">
                  <label htmlFor="ai-temp">Creativity Temperature: {temperature}</label>
                  <span className="tuning-hint">
                    {temperature <= 0.3 ? '🎯 Strictly Factual' : temperature <= 0.7 ? '⚖️ Balanced & Natural' : '🎨 Highly Creative'}
                  </span>
                </div>
                <input
                  id="ai-temp"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={temperature}
                  onChange={e => setTemperature(parseFloat(e.target.value))}
                />
              </div>

              {/* Memory Depth */}
              <div className="tuning-item">
                <div className="tuning-item-head">
                  <label htmlFor="ai-memory">Conversation Memory: {memoryDepth} Messages</label>
                  <span className="tuning-hint">Remembers previous context</span>
                </div>
                <input
                  id="ai-memory"
                  type="range"
                  min="2"
                  max="30"
                  step="2"
                  value={memoryDepth}
                  onChange={e => setMemoryDepth(parseInt(e.target.value, 10))}
                />
              </div>

              {/* Simulated Typing Delay */}
              <div className="tuning-item">
                <div className="tuning-item-head">
                  <label htmlFor="ai-delay">Natural Typing Delay: {typingDelaySeconds}s</label>
                  <span className="tuning-hint">Feels human rather than instant robot</span>
                </div>
                <input
                  id="ai-delay"
                  type="range"
                  min="0"
                  max="6"
                  step="1"
                  value={typingDelaySeconds}
                  onChange={e => setTypingDelaySeconds(parseInt(e.target.value, 10))}
                />
              </div>
            </div>

            {/* Human Agent Handoff Keywords */}
            <div className="form-group" style={{ marginTop: '16px' }}>
              <label>Human Agent Handoff Keywords</label>
              <div className="tag-input-row">
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. human, agent, representative, operator"
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addHandoffKeyword();
                    }
                  }}
                />
                <button type="button" className="btn-secondary tag-add-btn" onClick={addHandoffKeyword}>
                  Add Keyword
                </button>
              </div>

              {handoffKeywords.length > 0 && (
                <div className="modal-tags-list">
                  {handoffKeywords.map(kw => (
                    <span key={kw} className="contact-tag-badge removable" onClick={() => removeHandoffKeyword(kw)}>
                      "{kw}" ✕
                    </span>
                  ))}
                </div>
              )}
              <span className="form-helper-text">
                When a customer's message contains these keywords, the AI bot pauses and leaves the conversation for your human team.
              </span>
            </div>

            {/* Exclude Groups */}
            <div className="form-group" style={{ marginTop: '14px' }}>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={excludeGroups}
                  onChange={e => setExcludeGroups(e.target.checked)}
                />
                <span>🚫 Exclude WhatsApp Groups (Reply only to 1-on-1 private direct chats)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: 🧪 Interactive WhatsApp Live Simulator */}
        <div className="ai-simulator-col">
          <div className="sim-container">
            {/* Simulator Header */}
            <div className="sim-header">
              <div className="sim-avatar">
                <Bot size={20} />
                <span className="sim-online-dot" />
              </div>
              <div className="sim-info">
                <div className="sim-name">AI Bot Simulator</div>
                <div className="sim-sub">
                  {provider.toUpperCase()} • {model}
                </div>
              </div>
              <button
                type="button"
                className="sim-clear-btn"
                onClick={clearSimChat}
                title="Clear simulator chat"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {/* Simulator Messages Body */}
            <div className="sim-messages-body">
              {simHistory.map(msg => (
                <div key={msg.id} className={`sim-bubble-row ${msg.role}`}>
                  <div className={`sim-bubble ${msg.role}`}>
                    <div className="sim-bubble-text">{msg.text}</div>
                    <div className="sim-bubble-meta">
                      {msg.durationMs && <span className="sim-latency">⚡ {msg.durationMs}ms</span>}
                      <span className="sim-time">{msg.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))}

              {simLoading && (
                <div className="sim-bubble-row assistant">
                  <div className="sim-bubble assistant sim-typing-bubble">
                    <div className="typing-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Simulator Input Bar */}
            <form className="sim-input-bar" onSubmit={handleSendSimMessage}>
              <input
                type="text"
                placeholder="Type a test question (e.g. 'What are your prices?')..."
                value={simInput}
                onChange={e => setSimInput(e.target.value)}
                disabled={simLoading}
              />
              <button type="submit" className="sim-send-btn" disabled={!simInput.trim() || simLoading}>
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
