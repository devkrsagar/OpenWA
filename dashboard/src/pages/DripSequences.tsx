import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  Calendar,
  Send,
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
  Zap,
  Tag,
  Users,
  GitFork,
  ArrowRight,
  Play,
  Pause,
  Sliders,
  Sparkles,
  HelpCircle,
  UserPlus,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import {
  dripApi,
  contactBookApi,
  type ScheduledBroadcastItem,
  type DripSequenceItem,
  type DripSubscriberItem,
} from '../services/api';
import { useSessionsQuery } from '../hooks/queries';
import { useToast } from '../hooks/useToast';
import './DripSequences.css';

// Starter Sequence Presets
const STARTER_SEQUENCES: Array<{
  name: string;
  triggerTag: string;
  description: string;
  badge: string;
  steps: Array<{ stepOrder: number; delayHours: number; templateMessage: string }>;
}> = [
  {
    name: '🌟 7-Day New Customer Onboarding',
    triggerTag: 'onboarding',
    description: 'Nurture new customers with helpful guides, tips, and satisfaction check-ins.',
    badge: 'High Conversion',
    steps: [
      {
        stepOrder: 1,
        delayHours: 0,
        templateMessage:
          '👋 Hi {{name}}, welcome to our family! 🚀 We are thrilled to have you with us. Here is your quick start guide: https://openwa.webimaticsolutions.online. Let us know if you have any questions!',
      },
      {
        stepOrder: 2,
        delayHours: 48,
        templateMessage:
          '💡 Hi {{name}}, here is a quick tip for you: Did you know you can automate WhatsApp replies and campaigns in 1 click? Check out your dashboard!',
      },
      {
        stepOrder: 3,
        delayHours: 120,
        templateMessage:
          '⭐ Hi {{name}}, how has your experience been so far? Reply 1 for Excellent, 2 for Good, or tell us how we can help you even better!',
      },
    ],
  },
  {
    name: '💼 B2B Sales Lead Follow-Up',
    triggerTag: 'lead',
    description: 'Automated 3-touch nurture sequence to convert inbound WhatsApp leads into bookings.',
    badge: 'Sales Acceleration',
    steps: [
      {
        stepOrder: 1,
        delayHours: 0,
        templateMessage:
          '👋 Hi {{name}}! Thank you for reaching out to us. I am your account advisor. Would you like a 5-minute demo of our WhatsApp API solutions today?',
      },
      {
        stepOrder: 2,
        delayHours: 24,
        templateMessage:
          '📊 Hi {{name}}, wanted to share how one of our clients scaled to 50k monthly WhatsApp messages with 99.9% uptime. Would you be free for a quick 10-minute call tomorrow?',
      },
      {
        stepOrder: 3,
        delayHours: 72,
        templateMessage:
          '🚀 Hi {{name}}, here is our special onboarding package with priority support if you get started this week! Let me know if you would like me to set up your account.',
      },
    ],
  },
  {
    name: '🛍️ Post-Purchase VIP Reward & Loyalty',
    triggerTag: 'vip_customer',
    description: 'Delight buyers with care instructions and an exclusive repeat purchase promo code.',
    badge: 'Retention Booster',
    steps: [
      {
        stepOrder: 1,
        delayHours: 2,
        templateMessage:
          '🎉 Thank you for your order, {{name}}! Your package is being prepared with utmost care. You can track your shipment anytime with us right here on WhatsApp.',
      },
      {
        stepOrder: 2,
        delayHours: 96,
        templateMessage:
          '🎁 Hi {{name}}, as a token of our appreciation, here is an exclusive 15% VIP discount voucher for your next order: Use code VIP15 at checkout!',
      },
    ],
  },
];

export function DripSequences() {
  const toast = useToast();
  const { data: sessions = [], isLoading: loadingSessions } = useSessionsQuery();
  const [selectedSessionId, setSelectedSessionId] = useState('');

  const [activeTab, setActiveTab] = useState<'broadcasts' | 'sequences' | 'guide'>('broadcasts');

  // Broadcasts state
  const [broadcasts, setBroadcasts] = useState<ScheduledBroadcastItem[]>([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({
    name: '',
    scheduledAt: '',
    targetType: 'tags' as 'tags' | 'numbers' | 'all',
    targetAudience: '',
    templateMessage: 'Hi {{name}}, we have an exciting update for you! 🚀',
    pacingDelaySeconds: 3,
  });

  // Sequences state
  const [sequences, setSequences] = useState<DripSequenceItem[]>([]);
  const [loadingSequences, setLoadingSequences] = useState(false);
  const [showSequenceModal, setShowSequenceModal] = useState(false);
  const [editingSequenceId, setEditingSequenceId] = useState<string | null>(null);
  const [sequenceForm, setSequenceForm] = useState({
    name: '',
    description: '',
    triggerTag: 'lead',
    enabled: true,
    steps: [
      { stepOrder: 1, delayHours: 0, templateMessage: 'Hi {{name}}, welcome! 🚀' },
      { stepOrder: 2, delayHours: 24, templateMessage: 'Hi {{name}}, here is a quick update for you!' },
    ],
  });

  // Available contact tags
  const [availableTags, setAvailableTags] = useState<Array<{ tag: string; count: number }>>([]);

  // Subscribers modal
  const [subscriberModalSeq, setSubscriberModalSeq] = useState<DripSequenceItem | null>(null);
  const [subscribers, setSubscribers] = useState<DripSubscriberItem[]>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);

  // Set default active session
  useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId) {
      const readySession = sessions.find((s: any) => s.status === 'READY') || sessions[0];
      const sid = (readySession as any).id || (readySession as any).sessionId;
      if (sid) setSelectedSessionId(sid);
    }
  }, [sessions, selectedSessionId]);

  // Load tags
  useEffect(() => {
    if (selectedSessionId) {
      contactBookApi.getTags(selectedSessionId).then(setAvailableTags).catch(() => {});
    }
  }, [selectedSessionId]);

  // Fetch Data
  const fetchData = useCallback(async () => {
    if (!selectedSessionId) return;
    setLoadingBroadcasts(true);
    setLoadingSequences(true);

    try {
      const [bData, sData] = await Promise.all([
        dripApi.getBroadcasts(selectedSessionId).catch(() => []),
        dripApi.getSequences(selectedSessionId).catch(() => []),
      ]);
      setBroadcasts(bData || []);
      setSequences(sData || []);
    } catch (err: any) {
      toast.error('Failed to load broadcasts or drip sequences: ' + err.message);
    } finally {
      setLoadingBroadcasts(false);
      setLoadingSequences(false);
    }
  }, [selectedSessionId, toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Load Subscribers
  const loadSubscribers = async (seq: DripSequenceItem) => {
    setSubscriberModalSeq(seq);
    setLoadingSubscribers(true);
    try {
      const data = await dripApi.getSubscribers(selectedSessionId, seq.id);
      setSubscribers(data || []);
    } catch (err: any) {
      toast.error('Failed to load subscribers: ' + err.message);
    } finally {
      setLoadingSubscribers(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Broadcast Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleSaveBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastForm.name || !broadcastForm.scheduledAt || !broadcastForm.templateMessage) {
      toast.error('Please fill in campaign name, scheduled time, and template message.');
      return;
    }

    try {
      await dripApi.createBroadcast(selectedSessionId, {
        name: broadcastForm.name,
        scheduledAt: new Date(broadcastForm.scheduledAt).toISOString(),
        targetType: broadcastForm.targetType,
        targetAudience: broadcastForm.targetAudience,
        templateMessage: broadcastForm.templateMessage,
        pacingDelaySeconds: Number(broadcastForm.pacingDelaySeconds) || 3,
      });
      toast.success('Broadcast scheduled successfully!');
      setShowBroadcastModal(false);
      void fetchData();
    } catch (err: any) {
      toast.error('Failed to schedule broadcast: ' + err.message);
    }
  };

  const handleCancelBroadcast = async (id: string) => {
    try {
      await dripApi.cancelBroadcast(selectedSessionId, id);
      toast.success('Broadcast cancelled.');
      void fetchData();
    } catch (err: any) {
      toast.error('Failed to cancel broadcast: ' + err.message);
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scheduled broadcast?')) return;
    try {
      await dripApi.deleteBroadcast(selectedSessionId, id);
      toast.success('Broadcast deleted.');
      void fetchData();
    } catch (err: any) {
      toast.error('Failed to delete broadcast: ' + err.message);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Drip Sequence Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleOpenNewSequence = () => {
    setEditingSequenceId(null);
    setSequenceForm({
      name: '',
      description: '',
      triggerTag: 'lead',
      enabled: true,
      steps: [
        { stepOrder: 1, delayHours: 0, templateMessage: 'Hi {{name}}, thank you for joining! 🚀' },
        { stepOrder: 2, delayHours: 24, templateMessage: 'Hi {{name}}, here is a quick tip for you!' },
      ],
    });
    setShowSequenceModal(true);
  };

  const handleEditSequence = (seq: DripSequenceItem) => {
    setEditingSequenceId(seq.id);
    setSequenceForm({
      name: seq.name,
      description: seq.description || '',
      triggerTag: seq.triggerTag,
      enabled: seq.enabled,
      steps: seq.steps?.length
        ? seq.steps.map(s => ({
            stepOrder: s.stepOrder,
            delayHours: s.delayHours,
            templateMessage: s.templateMessage,
          }))
        : [{ stepOrder: 1, delayHours: 0, templateMessage: 'Hi {{name}}!' }],
    });
    setShowSequenceModal(true);
  };

  const handleApplyPreset = (preset: typeof STARTER_SEQUENCES[0]) => {
    setEditingSequenceId(null);
    setSequenceForm({
      name: preset.name,
      description: preset.description,
      triggerTag: preset.triggerTag,
      enabled: true,
      steps: preset.steps.map(s => ({ ...s })),
    });
    setShowSequenceModal(true);
  };

  const handleAddStep = () => {
    const nextOrder = sequenceForm.steps.length + 1;
    const lastDelay = sequenceForm.steps[sequenceForm.steps.length - 1]?.delayHours || 0;
    setSequenceForm(prev => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          stepOrder: nextOrder,
          delayHours: lastDelay + 48,
          templateMessage: `Hi {{name}}, Step ${nextOrder} follow-up message...`,
        },
      ],
    }));
  };

  const handleRemoveStep = (index: number) => {
    if (sequenceForm.steps.length <= 1) {
      toast.error('A drip sequence must have at least 1 step.');
      return;
    }
    const updated = sequenceForm.steps.filter((_, idx) => idx !== index);
    // Re-index stepOrders
    const reindexed = updated.map((st, i) => ({ ...st, stepOrder: i + 1 }));
    setSequenceForm(prev => ({ ...prev, steps: reindexed }));
  };

  const handleSaveSequence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sequenceForm.name || !sequenceForm.triggerTag || sequenceForm.steps.length === 0) {
      toast.error('Please provide a sequence name, trigger tag, and at least one step.');
      return;
    }

    try {
      if (editingSequenceId) {
        await dripApi.updateSequence(selectedSessionId, editingSequenceId, sequenceForm);
        toast.success('Drip sequence updated!');
      } else {
        await dripApi.createSequence(selectedSessionId, sequenceForm);
        toast.success('Drip sequence created!');
      }
      setShowSequenceModal(false);
      void fetchData();
    } catch (err: any) {
      toast.error('Failed to save sequence: ' + err.message);
    }
  };

  const handleDeleteSequence = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sequence and all its steps?')) return;
    try {
      await dripApi.deleteSequence(selectedSessionId, id);
      toast.success('Drip sequence deleted.');
      void fetchData();
    } catch (err: any) {
      toast.error('Failed to delete sequence: ' + err.message);
    }
  };

  const handleToggleSequence = async (seq: DripSequenceItem) => {
    try {
      await dripApi.updateSequence(selectedSessionId, seq.id, { enabled: !seq.enabled });
      toast.success(`Sequence ${!seq.enabled ? 'activated' : 'paused'}.`);
      void fetchData();
    } catch (err: any) {
      toast.error('Failed to update sequence: ' + err.message);
    }
  };

  // Manual Enroll
  const handleEnrollSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscriberModalSeq || !manualPhone) return;
    setIsEnrolling(true);
    try {
      await dripApi.enrollSubscriber(selectedSessionId, subscriberModalSeq.id, {
        phone: manualPhone,
        contactName: manualName,
      });
      toast.success(`Enrolled ${manualPhone} to ${subscriberModalSeq.name}!`);
      setManualPhone('');
      setManualName('');
      void loadSubscribers(subscriberModalSeq);
    } catch (err: any) {
      toast.error('Failed to enroll subscriber: ' + err.message);
    } finally {
      setIsEnrolling(false);
    }
  };

  // Stats calculation
  const totalScheduled = useMemo(
    () => broadcasts.filter(b => b.status === 'scheduled').length,
    [broadcasts],
  );
  const totalSequences = useMemo(
    () => sequences.filter(s => s.enabled).length,
    [sequences],
  );
  const totalEnrolledAll = useMemo(
    () => sequences.reduce((acc, s) => acc + (s.totalEnrolled || 0), 0),
    [sequences],
  );
  const totalCompletedAll = useMemo(
    () => sequences.reduce((acc, s) => acc + (s.totalCompleted || 0), 0),
    [sequences],
  );

  return (
    <div className="drip-page">
      <PageHeader
        title="⏰ Scheduled Broadcasts & Drip Sequences"
        subtitle="Automate timed promotional broadcasts and multi-day lead nurture sequences on WhatsApp."
        actions={
          <div className="drip-header-actions">
            <div className="drip-session-wrapper">
              <span className="session-select-label">Active WhatsApp Session:</span>
              <select
                value={selectedSessionId}
                onChange={e => setSelectedSessionId(e.target.value)}
                className="drip-session-select"
                disabled={loadingSessions}
              >
                {sessions.map((s: any) => {
                  const sId = s.id || s.sessionId;
                  const sName = s.name || s.sessionName || sId;
                  return (
                    <option key={sId} value={sId}>
                      {sName} ({s.status})
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              className="btn-header-action"
              onClick={activeTab === 'broadcasts' ? () => setShowBroadcastModal(true) : handleOpenNewSequence}
            >
              <Plus size={16} />
              <span>{activeTab === 'broadcasts' ? 'Schedule Broadcast' : 'Create Drip Sequence'}</span>
            </button>
          </div>
        }
      />

      {/* KPI Stats Overview */}
      <div className="drip-stats-grid">
        <div className="drip-stat-card">
          <div className="stat-icon-wrapper blue">
            <Clock size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Scheduled Broadcasts</span>
            <h3 className="stat-number">{totalScheduled}</h3>
            <span className="stat-subtext">Queued for automated dispatch</span>
          </div>
        </div>

        <div className="drip-stat-card">
          <div className="stat-icon-wrapper emerald">
            <GitFork size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Active Drip Sequences</span>
            <h3 className="stat-number">{totalSequences}</h3>
            <span className="stat-subtext">Running multi-step auto-nurture</span>
          </div>
        </div>

        <div className="drip-stat-card">
          <div className="stat-icon-wrapper purple">
            <Users size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Enrolled Leads</span>
            <h3 className="stat-number">{totalEnrolledAll.toLocaleString()}</h3>
            <span className="stat-subtext">Across all audience tags</span>
          </div>
        </div>

        <div className="drip-stat-card">
          <div className="stat-icon-wrapper amber">
            <CheckCircle2 size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Funnels Completed</span>
            <h3 className="stat-number">{totalCompletedAll.toLocaleString()}</h3>
            <span className="stat-subtext">100% finished all sequence steps</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="drip-tabs-bar">
        <button
          className={`drip-tab-btn ${activeTab === 'broadcasts' ? 'active' : ''}`}
          onClick={() => setActiveTab('broadcasts')}
        >
          <Clock size={16} />
          <span>⏰ Scheduled Broadcasts</span>
          <span className="tab-counter">{broadcasts.length}</span>
        </button>

        <button
          className={`drip-tab-btn ${activeTab === 'sequences' ? 'active' : ''}`}
          onClick={() => setActiveTab('sequences')}
        >
          <GitFork size={16} />
          <span>💧 Automated Drip Sequences</span>
          <span className="tab-counter">{sequences.length}</span>
        </button>

        <button
          className={`drip-tab-btn ${activeTab === 'guide' ? 'active' : ''}`}
          onClick={() => setActiveTab('guide')}
        >
          <HelpCircle size={16} />
          <span>How It Works & Presets</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 1: ⏰ Scheduled Broadcasts
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'broadcasts' && (
        <div className="tab-content-area">
          {loadingBroadcasts ? (
            <div className="drip-loading-state">
              <Loader2 className="animate-spin" size={32} />
              <p>Loading scheduled campaigns...</p>
            </div>
          ) : broadcasts.length === 0 ? (
            <div className="drip-empty-state">
              <div className="empty-icon-circle">
                <Clock size={40} />
              </div>
              <h3>No Broadcasts Scheduled</h3>
              <p>
                Schedule your holiday announcements, flash sale alerts, or webinar reminders to launch
                automatically at a specific date and time.
              </p>
              <button className="btn-primary-cta" onClick={() => setShowBroadcastModal(true)}>
                <Plus size={16} /> Schedule Your First Broadcast
              </button>
            </div>
          ) : (
            <div className="broadcasts-grid">
              {broadcasts.map(item => {
                const isScheduled = item.status === 'scheduled';
                const isRunning = item.status === 'running';
                const isCompleted = item.status === 'completed';

                return (
                  <div key={item.id} className={`broadcast-card ${item.status}`}>
                    <div className="b-card-header">
                      <div className="b-title-group">
                        <h4 className="b-name">{item.name}</h4>
                        <span className={`b-status-pill ${item.status}`}>
                          {isRunning && <Loader2 className="animate-spin" size={12} />}
                          {item.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="b-actions">
                        {isScheduled && (
                          <button
                            className="btn-icon-action cancel"
                            title="Cancel Broadcast"
                            onClick={() => handleCancelBroadcast(item.id)}
                          >
                            <Pause size={14} />
                          </button>
                        )}
                        <button
                          className="btn-icon-action delete"
                          title="Delete"
                          onClick={() => handleDeleteBroadcast(item.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="b-schedule-time">
                      <Calendar size={14} />
                      <span>
                        Scheduled for:{' '}
                        <strong>{new Date(item.scheduledAt).toLocaleString()}</strong>
                      </span>
                    </div>

                    <div className="b-target-info">
                      <span className="target-pill">
                        <Tag size={12} /> Target: {item.targetType.toUpperCase()} ({item.targetAudience || 'All Contacts'})
                      </span>
                      <span className="pacing-pill">
                        <Zap size={12} /> Pacing: {item.pacingDelaySeconds}s delay
                      </span>
                    </div>

                    <div className="b-message-preview">
                      <span className="preview-label">Message Preview:</span>
                      <p className="preview-text">{item.templateMessage}</p>
                    </div>

                    <div className="b-progress-bar-container">
                      <div className="b-progress-meta">
                        <span>Recipients: {item.totalRecipients || 0}</span>
                        <span>
                          Sent: <strong className="text-emerald">{item.sentCount}</strong>
                          {item.failedCount > 0 && (
                            <span className="text-danger"> | Failed: {item.failedCount}</span>
                          )}
                        </span>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${
                              item.totalRecipients
                                ? Math.min(100, Math.round((item.sentCount / item.totalRecipients) * 100))
                                : isCompleted
                                ? 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 2: 💧 Automated Drip Sequences
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'sequences' && (
        <div className="tab-content-area">
          {/* 1-Click Starter Presets Banner */}
          <div className="presets-banner">
            <div className="presets-header">
              <div className="presets-title">
                <Sparkles size={18} className="text-amber" />
                <h3>1-Click Drip Sequence Presets</h3>
              </div>
              <span className="presets-subtitle">
                Deploy pre-built nurture workflows in seconds:
              </span>
            </div>

            <div className="presets-grid">
              {STARTER_SEQUENCES.map(preset => (
                <div key={preset.name} className="preset-card">
                  <div className="preset-card-top">
                    <span className="preset-badge">{preset.badge}</span>
                    <span className="preset-trigger">Tag: #{preset.triggerTag}</span>
                  </div>
                  <h4 className="preset-name">{preset.name}</h4>
                  <p className="preset-desc">{preset.description}</p>
                  <div className="preset-steps-count">
                    <span>{preset.steps.length} Steps Sequence</span>
                  </div>
                  <button
                    className="btn-use-preset"
                    onClick={() => handleApplyPreset(preset)}
                  >
                    <Plus size={14} /> Use This Preset
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Sequences List */}
          {loadingSequences ? (
            <div className="drip-loading-state">
              <Loader2 className="animate-spin" size={32} />
              <p>Loading drip sequences...</p>
            </div>
          ) : sequences.length === 0 ? (
            <div className="drip-empty-state">
              <div className="empty-icon-circle">
                <GitFork size={40} />
              </div>
              <h3>No Drip Sequences Configured</h3>
              <p>
                Set up automated multi-day message sequences that guide new leads and contacts step-by-step
                based on tags.
              </p>
              <button className="btn-primary-cta" onClick={handleOpenNewSequence}>
                <Plus size={16} /> Create Drip Sequence
              </button>
            </div>
          ) : (
            <div className="sequences-list">
              {sequences.map(seq => (
                <div key={seq.id} className={`sequence-card ${seq.enabled ? 'active' : 'paused'}`}>
                  <div className="seq-card-header">
                    <div className="seq-title-group">
                      <div className="seq-title-row">
                        <h4 className="seq-name">{seq.name}</h4>
                        <span className={`seq-status-badge ${seq.enabled ? 'active' : 'paused'}`}>
                          {seq.enabled ? 'ACTIVE' : 'PAUSED'}
                        </span>
                      </div>
                      <div className="seq-meta-row">
                        <span className="seq-trigger-pill">
                          <Tag size={12} /> Auto-Enrolls Tag: <strong>#{seq.triggerTag}</strong>
                        </span>
                        {seq.description && <span className="seq-desc-text">{seq.description}</span>}
                      </div>
                    </div>

                    <div className="seq-actions">
                      <button
                        className="btn-seq-action subscribers"
                        title="View Subscribers & Enroll"
                        onClick={() => loadSubscribers(seq)}
                      >
                        <Users size={14} />
                        <span>Subscribers ({seq.totalEnrolled || 0})</span>
                      </button>

                      <button
                        className={`btn-seq-action toggle ${seq.enabled ? 'pause' : 'activate'}`}
                        title={seq.enabled ? 'Pause Sequence' : 'Activate Sequence'}
                        onClick={() => handleToggleSequence(seq)}
                      >
                        {seq.enabled ? <Pause size={14} /> : <Play size={14} />}
                        <span>{seq.enabled ? 'Pause' : 'Activate'}</span>
                      </button>

                      <button
                        className="btn-seq-action edit"
                        title="Edit Sequence"
                        onClick={() => handleEditSequence(seq)}
                      >
                        <Sliders size={14} />
                        <span>Edit</span>
                      </button>

                      <button
                        className="btn-seq-action delete"
                        title="Delete Sequence"
                        onClick={() => handleDeleteSequence(seq.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Visual Step Pipeline Flow */}
                  <div className="seq-pipeline-wrapper">
                    <span className="pipeline-title">Sequence Steps Flow:</span>
                    <div className="seq-steps-flow">
                      {(seq.steps || []).map((step, idx) => (
                        <div key={step.id || idx} className="step-pipeline-item">
                          <div className="step-card">
                            <div className="step-card-header">
                              <span className="step-number-badge">Step {step.stepOrder}</span>
                              <span className="step-delay-badge">
                                <Clock size={12} />
                                {step.delayHours === 0
                                  ? 'Immediate (0h)'
                                  : step.delayHours >= 24
                                  ? `+${Math.round(step.delayHours / 24)} days`
                                  : `+${step.delayHours} hrs`}
                              </span>
                            </div>
                            <p className="step-message-snippet">{step.templateMessage}</p>
                            <div className="step-footer-stats">
                              <span>Dispatched: <strong>{step.sentCount || 0}</strong></span>
                            </div>
                          </div>

                          {idx < (seq.steps || []).length - 1 && (
                            <div className="step-connector">
                              <ArrowRight size={18} className="connector-arrow" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 3: 📚 How It Works Guide
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'guide' && (
        <div className="tab-content-area">
          <div className="guide-card-container">
            <div className="guide-hero-banner">
              <h2>How Scheduled Broadcasts & Drip Sequences Work</h2>
              <p>
                Run professional marketing automation on WhatsApp with zero manual effort and rock-solid
                delivery pacing.
              </p>
            </div>

            <div className="guide-steps-grid">
              <div className="guide-step-card">
                <div className="guide-step-icon">1</div>
                <h3>⏰ Scheduled Broadcasts</h3>
                <p>
                  Compose your broadcast, select target audience tags, pick a future date & time, and set
                  your inter-message delay (e.g. 3-5s). The engine will wake up and execute cleanly.
                </p>
              </div>

              <div className="guide-step-card">
                <div className="guide-step-icon">2</div>
                <h3>💧 Tag-Triggered Drip Nurture</h3>
                <p>
                  When you assign a tag (like <code>lead</code> or <code>onboarding</code>) to a contact in your
                  Contact Book, OpenWA automatically enrolls them into the matching multi-step sequence.
                </p>
              </div>

              <div className="guide-step-card">
                <div className="guide-step-icon">3</div>
                <h3>⚡ Automated Step Progression</h3>
                <p>
                  The scheduler automatically calculates exact step delivery times (Day 1 $\rightarrow$ Day 3
                  $\rightarrow$ Day 7), sending personalized WhatsApp messages with <code>{'{{name}}'}</code> variable
                  replacement.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL: Schedule New Broadcast
      ───────────────────────────────────────────────────────────────────────────── */}
      {showBroadcastModal && (
        <Modal
          title="⏰ Schedule WhatsApp Broadcast"
          open={true}
          onClose={() => setShowBroadcastModal(false)}
          footer={
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowBroadcastModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveBroadcast}
              >
                <Clock size={16} /> Schedule Broadcast
              </button>
            </>
          }
        >
          <form className="drip-modal-form" onSubmit={handleSaveBroadcast}>
            <div className="form-group">
              <label>Campaign Name *</label>
              <input
                type="text"
                className="text-input"
                placeholder="e.g. Black Friday VIP Sale, Webinar Reminder"
                value={broadcastForm.name}
                onChange={e => setBroadcastForm({ ...broadcastForm, name: e.target.value })}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group half">
                <label>Scheduled Execution Date & Time *</label>
                <input
                  type="datetime-local"
                  className="text-input"
                  value={broadcastForm.scheduledAt}
                  onChange={e => setBroadcastForm({ ...broadcastForm, scheduledAt: e.target.value })}
                  required
                />
              </div>

              <div className="form-group half">
                <label>Pacing Delay Between Messages</label>
                <select
                  className="select-input"
                  value={broadcastForm.pacingDelaySeconds}
                  onChange={e =>
                    setBroadcastForm({
                      ...broadcastForm,
                      pacingDelaySeconds: Number(e.target.value),
                    })
                  }
                >
                  <option value={2}>2 Seconds / msg</option>
                  <option value={3}>3 Seconds / msg (Recommended)</option>
                  <option value={5}>5 Seconds / msg (Safe anti-spam)</option>
                  <option value={10}>10 Seconds / msg (High volume)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Target Audience *</label>
              <div className="radio-pills-group">
                <button
                  type="button"
                  className={`radio-pill ${broadcastForm.targetType === 'tags' ? 'active' : ''}`}
                  onClick={() => setBroadcastForm({ ...broadcastForm, targetType: 'tags' })}
                >
                  <Tag size={14} /> Contact Tags
                </button>
                <button
                  type="button"
                  className={`radio-pill ${broadcastForm.targetType === 'all' ? 'active' : ''}`}
                  onClick={() => setBroadcastForm({ ...broadcastForm, targetType: 'all', targetAudience: 'All Contacts' })}
                >
                  <Users size={14} /> All Contacts
                </button>
                <button
                  type="button"
                  className={`radio-pill ${broadcastForm.targetType === 'numbers' ? 'active' : ''}`}
                  onClick={() => setBroadcastForm({ ...broadcastForm, targetType: 'numbers' })}
                >
                  <Send size={14} /> Specific Numbers
                </button>
              </div>
            </div>

            {broadcastForm.targetType === 'tags' && (
              <div className="form-group">
                <label>Select Audience Tags (comma separated)</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="e.g. lead, vip, customer"
                  value={broadcastForm.targetAudience}
                  onChange={e => setBroadcastForm({ ...broadcastForm, targetAudience: e.target.value })}
                />
                {availableTags.length > 0 && (
                  <div className="tag-suggestions">
                    <span className="suggestion-label">Available tags:</span>
                    {availableTags.map(t => (
                      <button
                        key={t.tag}
                        type="button"
                        className="tag-chip-btn"
                        onClick={() => {
                          const current = broadcastForm.targetAudience
                            ? broadcastForm.targetAudience.split(',').map(x => x.trim())
                            : [];
                          if (!current.includes(t.tag)) {
                            current.push(t.tag);
                            setBroadcastForm({ ...broadcastForm, targetAudience: current.join(', ') });
                          }
                        }}
                      >
                        +{t.tag} ({t.count})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {broadcastForm.targetType === 'numbers' && (
              <div className="form-group">
                <label>Phone Numbers (comma separated with country code)</label>
                <textarea
                  className="textarea-input"
                  rows={3}
                  placeholder="e.g. +919876543210, +14155552671"
                  value={broadcastForm.targetAudience}
                  onChange={e => setBroadcastForm({ ...broadcastForm, targetAudience: e.target.value })}
                />
              </div>
            )}

            <div className="form-group">
              <div className="field-header">
                <label>Message Content *</label>
                <div className="var-insert-pills">
                  <span className="insert-label">Insert:</span>
                  <button
                    type="button"
                    className="var-pill-btn"
                    onClick={() =>
                      setBroadcastForm(prev => ({
                        ...prev,
                        templateMessage: prev.templateMessage + ' {{name}}',
                      }))
                    }
                  >
                    + {'{{name}}'}
                  </button>
                  <button
                    type="button"
                    className="var-pill-btn"
                    onClick={() =>
                      setBroadcastForm(prev => ({
                        ...prev,
                        templateMessage: prev.templateMessage + ' {{phone}}',
                      }))
                    }
                  >
                    + {'{{phone}}'}
                  </button>
                </div>
              </div>
              <textarea
                className="textarea-input"
                rows={5}
                value={broadcastForm.templateMessage}
                onChange={e => setBroadcastForm({ ...broadcastForm, templateMessage: e.target.value })}
                required
              />
            </div>
          </form>
        </Modal>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL: Drip Sequence Builder / Editor
      ───────────────────────────────────────────────────────────────────────────── */}
      {showSequenceModal && (
        <Modal
          title={editingSequenceId ? '💧 Edit Drip Sequence' : '💧 Create Multi-Step Drip Sequence'}
          open={true}
          onClose={() => setShowSequenceModal(false)}
          footer={
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowSequenceModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveSequence}
              >
                <GitFork size={16} /> Save Sequence
              </button>
            </>
          }
        >
          <form className="drip-modal-form" onSubmit={handleSaveSequence}>
            <div className="form-group">
              <label>Sequence Name *</label>
              <input
                type="text"
                className="text-input"
                placeholder="e.g. 7-Day New Client Onboarding"
                value={sequenceForm.name}
                onChange={e => setSequenceForm({ ...sequenceForm, name: e.target.value })}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group half">
                <label>Trigger Contact Tag *</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="e.g. onboarding, lead, vip"
                  value={sequenceForm.triggerTag}
                  onChange={e => setSequenceForm({ ...sequenceForm, triggerTag: e.target.value })}
                  required
                />
                <span className="field-hint">
                  Contacts tagged with this tag will auto-enroll into this sequence.
                </span>
              </div>

              <div className="form-group half">
                <label>Overview / Purpose (Optional)</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="e.g. Welcome & convert new signups"
                  value={sequenceForm.description}
                  onChange={e => setSequenceForm({ ...sequenceForm, description: e.target.value })}
                />
              </div>
            </div>

            <div className="steps-builder-section">
              <div className="steps-builder-header">
                <span className="steps-title">Sequence Steps ({sequenceForm.steps.length})</span>
                <button type="button" className="btn-add-step" onClick={handleAddStep}>
                  <Plus size={14} /> Add Step
                </button>
              </div>

              <div className="builder-steps-list">
                {sequenceForm.steps.map((st, idx) => (
                  <div key={idx} className="builder-step-row">
                    <div className="builder-step-head">
                      <span className="builder-step-num">Step {st.stepOrder}</span>
                      <div className="builder-step-delay">
                        <label>Delay (Hours after enrollment / previous step):</label>
                        <input
                          type="number"
                          min={0}
                          className="number-input"
                          value={st.delayHours}
                          onChange={e => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            const updated = [...sequenceForm.steps];
                            updated[idx].delayHours = val;
                            setSequenceForm({ ...sequenceForm, steps: updated });
                          }}
                        />
                        <span className="delay-converted-label">
                          ({st.delayHours === 0 ? 'Immediate' : `${Math.round(st.delayHours / 24)} days`})
                        </span>
                      </div>

                      <button
                        type="button"
                        className="btn-remove-step"
                        title="Remove Step"
                        onClick={() => handleRemoveStep(idx)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="builder-step-body">
                      <div className="step-var-tools">
                        <button
                          type="button"
                          className="var-pill-btn"
                          onClick={() => {
                            const updated = [...sequenceForm.steps];
                            updated[idx].templateMessage += ' {{name}}';
                            setSequenceForm({ ...sequenceForm, steps: updated });
                          }}
                        >
                          + {'{{name}}'}
                        </button>
                        <button
                          type="button"
                          className="var-pill-btn"
                          onClick={() => {
                            const updated = [...sequenceForm.steps];
                            updated[idx].templateMessage += ' {{phone}}';
                            setSequenceForm({ ...sequenceForm, steps: updated });
                          }}
                        >
                          + {'{{phone}}'}
                        </button>
                      </div>
                      <textarea
                        className="textarea-input"
                        rows={3}
                        value={st.templateMessage}
                        onChange={e => {
                          const updated = [...sequenceForm.steps];
                          updated[idx].templateMessage = e.target.value;
                          setSequenceForm({ ...sequenceForm, steps: updated });
                        }}
                        placeholder={`Message for Step ${st.stepOrder}...`}
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL: Subscribers List & Manual Enrollment
      ───────────────────────────────────────────────────────────────────────────── */}
      {subscriberModalSeq && (
        <Modal
          title={`👥 Subscribers — ${subscriberModalSeq.name}`}
          open={true}
          onClose={() => setSubscriberModalSeq(null)}
          footer={
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setSubscriberModalSeq(null)}
            >
              Close
            </button>
          }
        >
          <div className="subscribers-modal-content">
            {/* Quick Manual Enroll Form */}
            <form className="manual-enroll-box" onSubmit={handleEnrollSubscriber}>
              <h4>
                <UserPlus size={16} /> Manually Enroll Contact to this Sequence
              </h4>
              <div className="enroll-fields-row">
                <input
                  type="text"
                  className="text-input"
                  placeholder="Phone (e.g. +919876543210)"
                  value={manualPhone}
                  onChange={e => setManualPhone(e.target.value)}
                  required
                />
                <input
                  type="text"
                  className="text-input"
                  placeholder="Name (Optional)"
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                />
                <button type="submit" className="btn-enroll" disabled={isEnrolling}>
                  {isEnrolling ? <Loader2 className="animate-spin" size={14} /> : 'Enroll'}
                </button>
              </div>
            </form>

            {/* Subscribers Table */}
            <div className="subscribers-table-wrapper">
              {loadingSubscribers ? (
                <div className="drip-loading-state">
                  <Loader2 className="animate-spin" size={24} />
                  <p>Loading subscribers...</p>
                </div>
              ) : subscribers.length === 0 ? (
                <p className="no-subscribers-text">
                  No active subscribers enrolled yet. Tag a contact with #{subscriberModalSeq.triggerTag} in
                  your Contact Book or enroll manually above.
                </p>
              ) : (
                <table className="drip-table">
                  <thead>
                    <tr>
                      <th>Contact</th>
                      <th>Current Step</th>
                      <th>Status</th>
                      <th>Next Run Time</th>
                      <th>Enrolled At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.map(sub => (
                      <tr key={sub.id}>
                        <td>
                          <strong>{sub.contactName || 'Lead'}</strong>
                          <div className="phone-sub">{sub.phone}</div>
                        </td>
                        <td>
                          <span className="step-badge">Step {sub.currentStep}</span>
                        </td>
                        <td>
                          <span className={`status-tag ${sub.status}`}>
                            {sub.status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          {sub.status === 'active'
                            ? new Date(sub.nextRunAt).toLocaleString()
                            : 'Completed'}
                        </td>
                        <td>{new Date(sub.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
