import { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  Plus,
  Trash2,
  Edit2,
  Clock,
  MessageSquare,
  Sparkles,
  HelpCircle,
  Moon,
  DollarSign,
  Users,
  Search,
  CheckCircle2,
} from 'lucide-react';
import {
  automationApi,
  type AutomationRuleItem,
  type CreateAutomationRulePayload,
} from '../services/api';
import { useSessionsQuery } from '../hooks/queries';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../hooks/useToast';
import { useRole } from '../hooks/useRole';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import './Automation.css';

interface RuleFormState {
  name: string;
  triggerType: 'ALL' | 'KEYWORDS';
  keywords: string[];
  excludeGroups: boolean;
  replyText: string;
  cooldownSeconds: number;
  enabled: boolean;
}

const PRESETS = [
  {
    id: 'welcome',
    title: '🌟 Welcome Greeting',
    desc: 'Greet every new user who sends an inbound message.',
    icon: Sparkles,
    color: '#3b82f6',
    data: {
      name: 'Welcome Greeting',
      triggerType: 'ALL' as const,
      keywords: [],
      excludeGroups: true,
      replyText: '👋 Hello! Thanks for reaching out to us. How can our team assist you today?',
      cooldownSeconds: 300, // 5 min
    },
  },
  {
    id: 'away',
    title: '🌙 Away / Off-Hours Notice',
    desc: 'Let customers know you are away and will reply during office hours.',
    icon: Moon,
    color: '#8b5cf6',
    data: {
      name: 'Away / After-Hours Notice',
      triggerType: 'ALL' as const,
      keywords: [],
      excludeGroups: true,
      replyText:
        '🌙 Thanks for your message! Our team is currently away. Our business hours are Mon–Fri 9:00 AM – 6:00 PM. We will get back to you as soon as we are back online!',
      cooldownSeconds: 3600, // 1 hour
    },
  },
  {
    id: 'pricing',
    title: '💰 Pricing & Catalog Bot',
    desc: 'Auto-reply when messages mention price, cost, or catalog.',
    icon: DollarSign,
    color: '#10b981',
    data: {
      name: 'Pricing & Catalog Inquiries',
      triggerType: 'KEYWORDS' as const,
      keywords: ['price', 'pricing', 'cost', 'catalog', 'quote', 'rates'],
      excludeGroups: false,
      replyText:
        '🏷️ Thanks for inquiring about our pricing! You can view our full product catalog and pricing packages on our official website: https://openwa.webimaticsolutions.online\n\nReply with *AGENT* if you wish to speak with our sales team.',
      cooldownSeconds: 60,
    },
  },
  {
    id: 'support',
    title: '🆘 Support & Help Assistant',
    desc: 'Guide customers when they ask for help or support.',
    icon: HelpCircle,
    color: '#f59e0b',
    data: {
      name: 'Support & Help Helper',
      triggerType: 'KEYWORDS' as const,
      keywords: ['help', 'support', 'issue', 'urgent', 'agent'],
      excludeGroups: false,
      replyText:
        '🤝 We are here to help! A customer support specialist has been notified of your message and will join this chat shortly. Please feel free to describe your query in detail.',
      cooldownSeconds: 120,
    },
  },
];

const emptyForm: RuleFormState = {
  name: '',
  triggerType: 'ALL',
  keywords: [],
  excludeGroups: true,
  replyText: '',
  cooldownSeconds: 60,
  enabled: true,
};

export function Automation() {
  useDocumentTitle('Automation Rules & Auto-Replies');
  const { canWrite } = useRole();
  const toast = useToast();

  const { data: sessions = [] } = useSessionsQuery();
  const [selectedSessionId, setSelectedSessionId] = useState('');

  const [rules, setRules] = useState<AutomationRuleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRuleItem | null>(null);
  const [form, setForm] = useState<RuleFormState>(emptyForm);
  const [keywordInput, setKeywordInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Auto select first session
  useEffect(() => {
    if (!selectedSessionId && sessions.length > 0) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [selectedSessionId, sessions]);

  const loadRules = useCallback(async () => {
    if (!selectedSessionId) return;
    setLoading(true);
    try {
      const data = await automationApi.list(selectedSessionId);
      setRules(data);
    } catch (err) {
      toast.error('Failed to load automation rules');
    } finally {
      setLoading(false);
    }
  }, [selectedSessionId, toast]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  // Open Create with Preset
  const applyPreset = (presetData: typeof PRESETS[0]['data']) => {
    setEditingRule(null);
    setForm({
      name: presetData.name,
      triggerType: presetData.triggerType,
      keywords: [...presetData.keywords],
      excludeGroups: presetData.excludeGroups,
      replyText: presetData.replyText,
      cooldownSeconds: presetData.cooldownSeconds,
      enabled: true,
    });
    setKeywordInput('');
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingRule(null);
    setForm(emptyForm);
    setKeywordInput('');
    setShowModal(true);
  };

  const openEditModal = (rule: AutomationRuleItem) => {
    setEditingRule(rule);

    // Parse conditions
    let triggerType: 'ALL' | 'KEYWORDS' = 'ALL';
    const keywords: string[] = [];
    let excludeGroups = false;

    if (rule.conditions && rule.conditions.conditions) {
      for (const cond of rule.conditions.conditions) {
        if (cond.field === 'body' && (cond.operator === 'contains' || cond.operator === 'equals')) {
          triggerType = 'KEYWORDS';
          if (Array.isArray(cond.value)) {
            keywords.push(...cond.value.map(String));
          } else if (typeof cond.value === 'string') {
            keywords.push(cond.value);
          }
        }
        if (cond.field === 'isGroup' && cond.operator === 'is' && cond.value === false) {
          excludeGroups = true;
        }
      }
    }

    setForm({
      name: rule.name,
      triggerType,
      keywords,
      excludeGroups,
      replyText: rule.replyText,
      cooldownSeconds: rule.cooldownSeconds ?? 60,
      enabled: rule.enabled ?? true,
    });
    setKeywordInput('');
    setShowModal(true);
  };

  // Toggle Rule Status
  const handleToggleRule = async (rule: AutomationRuleItem) => {
    if (!canWrite || !selectedSessionId) return;
    const nextState = !rule.enabled;
    try {
      await automationApi.update(selectedSessionId, rule.id, { enabled: nextState });
      setRules(prev => prev.map(r => (r.id === rule.id ? { ...r, enabled: nextState } : r)));
      toast.success(`Rule "${rule.name}" ${nextState ? 'enabled' : 'paused'}.`);
    } catch (err) {
      toast.error('Failed to update rule status');
    }
  };

  // Save Rule
  const handleSaveRule = async () => {
    if (!selectedSessionId || !form.name.trim() || !form.replyText.trim()) {
      toast.error('Please provide a rule name and reply message');
      return;
    }

    // Build WebhookFilter conditions structure
    const conditionsList: Array<{
      field: string;
      operator: 'is' | 'isNot' | 'contains' | 'equals';
      value: string | string[] | boolean;
      caseSensitive?: boolean;
    }> = [];

    if (form.triggerType === 'KEYWORDS' && form.keywords.length > 0) {
      conditionsList.push({
        field: 'body',
        operator: 'contains',
        value: form.keywords.length === 1 ? form.keywords[0] : form.keywords,
        caseSensitive: false,
      });
    }

    if (form.excludeGroups) {
      conditionsList.push({
        field: 'isGroup',
        operator: 'is',
        value: false,
      });
    }

    const payload: CreateAutomationRulePayload = {
      name: form.name.trim(),
      replyText: form.replyText.trim(),
      conditions: conditionsList.length > 0 ? { conditions: conditionsList } : null,
      cooldownSeconds: form.cooldownSeconds,
      enabled: form.enabled,
    };

    setSaving(true);
    try {
      if (editingRule) {
        const updated = await automationApi.update(selectedSessionId, editingRule.id, payload);
        setRules(prev => prev.map(r => (r.id === editingRule.id ? updated : r)));
        toast.success('Automation rule updated.');
      } else {
        const created = await automationApi.create(selectedSessionId, payload);
        setRules(prev => [created, ...prev]);
        toast.success('Automation rule created.');
      }
      setShowModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save automation rule');
    } finally {
      setSaving(false);
    }
  };

  // Delete Rule
  const handleDeleteRule = async (ruleId: string, ruleName: string) => {
    if (!canWrite || !selectedSessionId) return;
    if (!window.confirm(`Are you sure you want to delete rule "${ruleName}"?`)) return;
    try {
      await automationApi.delete(selectedSessionId, ruleId);
      setRules(prev => prev.map(r => r).filter(r => r.id !== ruleId));
      toast.success('Rule deleted.');
    } catch (err) {
      toast.error('Failed to delete rule');
    }
  };

  const addKeyword = () => {
    const trimmed = keywordInput.trim();
    if (trimmed && !form.keywords.includes(trimmed)) {
      setForm(prev => ({ ...prev, keywords: [...prev.keywords, trimmed] }));
      setKeywordInput('');
    }
  };

  const removeKeyword = (kw: string) => {
    setForm(prev => ({ ...prev, keywords: prev.keywords.filter(k => k !== kw) }));
  };

  // Filter rules
  const filteredRules = rules.filter(
    r =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.replyText.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="automation-page">
      <PageHeader
        title="Automation Rules & Auto-Replies"
        subtitle="Set up instant welcome greetings, away messages, and keyword auto-responders."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="automation-session-wrapper">
              <span className="session-select-label">Active WhatsApp Session:</span>
              <select
                className="automation-session-select"
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
              className="btn-primary"
              onClick={openCreateModal}
              disabled={!canWrite || !selectedSessionId}
            >
              <Plus size={16} />
              <span>Create Rule</span>
            </button>
          </div>
        }
      />

      {/* Quick Starter Presets Banner */}
      <div className="presets-banner">
        <div className="presets-header">
          <div className="presets-title-wrap">
            <Sparkles size={18} className="text-primary" />
            <h3>1-Click Starter Automations</h3>
          </div>
          <span className="presets-sub">Select any preset to customize and launch instantly:</span>
        </div>

        <div className="presets-grid">
          {PRESETS.map(preset => {
            const Icon = preset.icon;
            return (
              <div
                key={preset.id}
                className="preset-card"
                onClick={() => applyPreset(preset.data)}
                role="button"
                tabIndex={0}
              >
                <div className="preset-icon-badge" style={{ background: `${preset.color}18`, color: preset.color }}>
                  <Icon size={18} />
                </div>
                <div className="preset-content">
                  <div className="preset-title">{preset.title}</div>
                  <div className="preset-desc">{preset.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Rules Container */}
      <div className="rules-section-card">
        {/* Toolbar */}
        <div className="rules-toolbar">
          <div className="rules-count">
            <strong>{filteredRules.length}</strong> {filteredRules.length === 1 ? 'Rule' : 'Rules'} Active
          </div>

          <div className="rules-search-box">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search rules or messages..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Loading / Empty / Rules List */}
        {loading ? (
          <div className="rules-loading">
            <div className="animate-spin text-primary">
              <Zap size={32} />
            </div>
            <p>Loading automation rules...</p>
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="rules-empty-state">
            <div className="empty-icon-circle">
              <Zap size={36} />
            </div>
            <h3>No Automation Rules Configured</h3>
            <p>
              Automate your WhatsApp customer responses. Choose a 1-click starter preset above or click "Create Rule" to build your custom bot.
            </p>
            <button className="btn-primary" onClick={openCreateModal} disabled={!canWrite || !selectedSessionId}>
              <Plus size={16} />
              <span>Create Your First Auto-Reply</span>
            </button>
          </div>
        ) : (
          <div className="rules-grid">
            {filteredRules.map(rule => {
              // Analyze trigger
              let hasKeywords = false;
              let kws: string[] = [];
              let isDirectOnly = false;

              if (rule.conditions?.conditions) {
                for (const cond of rule.conditions.conditions) {
                  if (cond.field === 'body') {
                    hasKeywords = true;
                    if (Array.isArray(cond.value)) kws = cond.value.map(String);
                    else if (typeof cond.value === 'string') kws = [cond.value];
                  }
                  if (cond.field === 'isGroup' && cond.value === false) {
                    isDirectOnly = true;
                  }
                }
              }

              return (
                <div key={rule.id} className={`rule-card ${rule.enabled ? 'active' : 'disabled'}`}>
                  <div className="rule-card-header">
                    <div className="rule-title-group">
                      <h4 className="rule-name">{rule.name}</h4>
                      <div className="rule-badges-row">
                        {hasKeywords ? (
                          <span className="trigger-badge keyword">
                            <MessageSquare size={12} />
                            Keywords Trigger
                          </span>
                        ) : (
                          <span className="trigger-badge catchall">
                            <Sparkles size={12} />
                            All Inbound Messages
                          </span>
                        )}
                        {isDirectOnly && (
                          <span className="trigger-badge direct">
                            <Users size={12} />
                            1-on-1 Chats Only
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rule-toggle-wrap">
                      <label className="switch" title={rule.enabled ? 'Click to pause' : 'Click to enable'}>
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => void handleToggleRule(rule)}
                          disabled={!canWrite}
                        />
                        <span className="slider round" />
                      </label>
                    </div>
                  </div>

                  {/* Conditions Details */}
                  {hasKeywords && kws.length > 0 && (
                    <div className="rule-conditions-box">
                      <span className="cond-label">Matches if message contains:</span>
                      <div className="keywords-chip-list">
                        {kws.map(k => (
                          <span key={k} className="keyword-chip">
                            "{k}"
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reply Message Preview */}
                  <div className="rule-reply-preview">
                    <div className="reply-preview-label">
                      <Zap size={13} />
                      <span>Automated Response:</span>
                    </div>
                    <div className="reply-preview-text">{rule.replyText}</div>
                  </div>

                  {/* Footer Meta & Actions */}
                  <div className="rule-card-footer">
                    <div className="rule-cooldown-tag">
                      <Clock size={13} />
                      <span>
                        Cooldown: {rule.cooldownSeconds === 0 ? 'Disabled' : `${rule.cooldownSeconds}s`}
                      </span>
                    </div>

                    <div className="rule-actions-group">
                      <button
                        className="icon-action-btn"
                        onClick={() => openEditModal(rule)}
                        title="Edit Rule"
                        disabled={!canWrite}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        className="icon-action-btn danger"
                        onClick={() => void handleDeleteRule(rule.id, rule.name)}
                        title="Delete Rule"
                        disabled={!canWrite}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Rule Modal */}
      {showModal && (
        <Modal
          open
          onClose={() => setShowModal(false)}
          title={editingRule ? 'Edit Automation Rule' : 'Create Automation Rule'}
          closeLabel="Cancel"
          className="automation-modal"
          footer={
            <>
              <button className="btn-secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSaveRule} disabled={saving || !form.name.trim() || !form.replyText.trim()}>
                <CheckCircle2 size={16} />
                <span>{saving ? 'Saving...' : editingRule ? 'Update Rule' : 'Save & Activate'}</span>
              </button>
            </>
          }
        >
          <div className="rule-modal-form">
            {/* Rule Name */}
            <div className="form-group">
              <label htmlFor="r-name">
                Rule Name <span className="required-star">*</span>
              </label>
              <input
                id="r-name"
                type="text"
                className="input-field"
                placeholder="e.g. Welcome Greeting or Pricing Responder"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>

            {/* Trigger Mode */}
            <div className="form-group">
              <label>When should this auto-reply trigger?</label>
              <div className="trigger-type-selector">
                <div
                  className={`trigger-option-card ${form.triggerType === 'ALL' ? 'selected' : ''}`}
                  onClick={() => setForm({ ...form, triggerType: 'ALL' })}
                >
                  <div className="opt-title">🌟 All Inbound Messages</div>
                  <div className="opt-desc">Triggers on any incoming message (ideal for Welcome & Away notices)</div>
                </div>

                <div
                  className={`trigger-option-card ${form.triggerType === 'KEYWORDS' ? 'selected' : ''}`}
                  onClick={() => setForm({ ...form, triggerType: 'KEYWORDS' })}
                >
                  <div className="opt-title">💬 Message Contains Keywords</div>
                  <div className="opt-desc">Triggers only when message contains specific words (e.g. price, help)</div>
                </div>
              </div>
            </div>

            {/* Keywords Input (Conditional) */}
            {form.triggerType === 'KEYWORDS' && (
              <div className="form-group">
                <label>Trigger Keywords (Press Enter or click Add)</label>
                <div className="tag-input-row">
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. price, pricing, order, support"
                    value={keywordInput}
                    onChange={e => setKeywordInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addKeyword();
                      }
                    }}
                  />
                  <button type="button" className="btn-secondary tag-add-btn" onClick={addKeyword}>
                    Add Word
                  </button>
                </div>

                {form.keywords.length > 0 && (
                  <div className="modal-tags-list">
                    {form.keywords.map(kw => (
                      <span key={kw} className="contact-tag-badge removable" onClick={() => removeKeyword(kw)}>
                        "{kw}" ✕
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Group Exclusion Toggle */}
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.excludeGroups}
                  onChange={e => setForm({ ...form, excludeGroups: e.target.checked })}
                />
                <span>🚫 Exclude WhatsApp Groups (Reply only to 1-on-1 private direct chats)</span>
              </label>
            </div>

            {/* Reply Text */}
            <div className="form-group">
              <label htmlFor="r-text">
                Auto-Reply Message Text <span className="required-star">*</span>
              </label>
              <textarea
                id="r-text"
                className="textarea-field"
                rows={5}
                placeholder="Type the message your WhatsApp bot will send automatically..."
                value={form.replyText}
                onChange={e => setForm({ ...form, replyText: e.target.value })}
              />
              <span className="form-helper-text">
                Supports WhatsApp markdown formatting: <code>*bold*</code>, <code>_italic_</code>, emojis, and links.
              </span>
            </div>

            {/* Cooldown Period */}
            <div className="form-group">
              <label htmlFor="r-cooldown">Quiet Cooldown Period Per Chat</label>
              <select
                id="r-cooldown"
                value={form.cooldownSeconds}
                onChange={e => setForm({ ...form, cooldownSeconds: Number(e.target.value) })}
              >
                <option value="0">No Cooldown (Reply to every message - Use with caution)</option>
                <option value="60">1 Minute (Default)</option>
                <option value="300">5 Minutes</option>
                <option value="900">15 Minutes</option>
                <option value="3600">1 Hour (Recommended for Away notices)</option>
                <option value="86400">24 Hours (Once per day per contact)</option>
              </select>
              <span className="form-helper-text">
                Prevents the rule from repeating multiple times in the same conversation within the cooldown window.
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
