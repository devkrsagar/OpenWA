import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart,
  Plus,
  Copy,
  Check,
  Trash2,
  Edit2,
  Play,
  FileText,
  Clock,
  Sparkles,
  Package,
  Truck,
  CreditCard,
  Zap,
  CheckCircle2,
  AlertCircle,
  Search,
  HelpCircle,
  ArrowRight,
  Globe,
  MessageSquare,
} from 'lucide-react';
import {
  ecommerceApi,
  type EcommerceAutomationItem,
  type EcommerceLogItem,
  type CreateEcommercePayload,
} from '../services/api';
import { useSessionsQuery } from '../hooks/queries';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../hooks/useToast';
import { useRole } from '../hooks/useRole';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import './Ecommerce.css';

const STARTER_TEMPLATES = [
  {
    id: 'abandoned_cart',
    name: 'Shopify Abandoned Cart Recovery',
    platform: 'shopify',
    eventType: 'abandoned_cart',
    icon: ShoppingCart,
    color: '#10b981',
    delayMinutes: 15,
    desc: 'Recover lost revenue by sending a direct checkout recovery link to customers who left items in cart.',
    templateMessage: `👋 Hi {{customer_name}}, you left items in your shopping cart at our store!

🛍️ *Items:* {{items}}
💰 *Total:* {{total_amount}} {{currency}}

We saved your cart for you. Complete your order now to lock in your items:
👉 {{checkout_url}}

Reply *HELP* if you have any questions!`,
    samplePayload: {
      customer: { first_name: 'Alex', last_name: 'Morgan', phone: '+15550192834' },
      total_price: '79.99',
      currency: 'USD',
      abandoned_checkout_url: 'https://store.example.com/checkouts/ac7b92?recover=true',
      line_items: [{ title: 'Wireless Noise-Cancelling Headphones', quantity: 1 }],
    },
  },
  {
    id: 'order_created',
    name: 'Order Confirmation & Digital Receipt',
    platform: 'shopify',
    eventType: 'order_created',
    icon: Package,
    color: '#3b82f6',
    delayMinutes: 0,
    desc: 'Send instant WhatsApp order confirmation with item summary, total paid, and order reference.',
    templateMessage: `🎉 *Order Confirmed!*

Hi {{customer_name}}, thank you for your order! We're preparing your items for dispatch.

📦 *Order ID:* {{order_id}}
🛍️ *Items:* {{items}}
💵 *Total Paid:* {{total_amount}} {{currency}}

We will notify you on WhatsApp as soon as your package ships! 🚚`,
    samplePayload: {
      name: '#10492',
      customer: { first_name: 'Sarah', last_name: 'Connor', phone: '+15550148291' },
      total_price: '145.00',
      currency: 'USD',
      line_items: [
        { title: 'Organic Cotton Hoodie', quantity: 1 },
        { title: 'Leather Card Holder', quantity: 2 },
      ],
    },
  },
  {
    id: 'order_fulfilled',
    name: 'Shipping & Live Package Tracking',
    platform: 'shopify',
    eventType: 'order_fulfilled',
    icon: Truck,
    color: '#8b5cf6',
    delayMinutes: 0,
    desc: 'Notify customers the moment their parcel is dispatched with courier tracking link.',
    templateMessage: `🚚 *Your Order is on its Way!*

Hi {{customer_name}}, great news! Your order *{{order_id}}* has just been dispatched.

📦 *Tracking Number:* {{tracking_number}}
📍 *Live Tracking Link:* {{tracking_url}}

Thank you for shopping with us!`,
    samplePayload: {
      name: '#10492',
      customer: { first_name: 'Sarah', phone: '+15550148291' },
      fulfillments: [
        {
          tracking_number: 'DHL-8492049182',
          tracking_url: 'https://www.dhl.com/track?id=DHL-8492049182',
        },
      ],
    },
  },
  {
    id: 'payment_received',
    name: 'Stripe / Payment Success Receipt',
    platform: 'stripe',
    eventType: 'payment_received',
    icon: CreditCard,
    color: '#f59e0b',
    delayMinutes: 0,
    desc: 'Auto-dispatch payment confirmation and downloadable invoice receipts.',
    templateMessage: `💳 *Payment Successfully Received!*

Hi {{customer_name}}, we have received your payment of *{{total_amount}} {{currency}}*.

🧾 *Reference:* {{order_id}}
📄 *Receipt / Invoice:* {{tracking_url}}

Thank you for your business!`,
    samplePayload: {
      data: {
        object: {
          id: 'ch_3Nx94821a',
          amount: 8900,
          currency: 'usd',
          customer_details: { name: 'Michael Scott', phone: '+15550173920' },
          receipt_url: 'https://pay.stripe.com/receipts/acct_123/ch_3Nx/rcpt_xyz',
        },
      },
    },
  },
  {
    id: 'custom_crm',
    name: 'Custom CRM / Zapier / Make Webhook',
    platform: 'custom',
    eventType: 'custom_webhook',
    icon: Zap,
    color: '#ec4899',
    delayMinutes: 0,
    desc: 'Connect custom CRM leads, HubSpot, Pabbly, or n8n webhooks with custom variables.',
    templateMessage: `🤝 *New Request Acknowledged*

Hello {{customer_name}}, thanks for reaching out to us! We have received your inquiry for *{{order_id}}*.

A specialist will contact you shortly on this WhatsApp number.`,
    samplePayload: {
      customer_name: 'David Miller',
      phone: '+15550182934',
      order_id: 'LEAD-8842',
      total_amount: 'Custom Quote',
    },
  },
];

const VARIABLE_TAGS = [
  '{{customer_name}}',
  '{{order_id}}',
  '{{total_amount}}',
  '{{currency}}',
  '{{items}}',
  '{{tracking_url}}',
  '{{tracking_number}}',
  '{{checkout_url}}',
  '{{store_name}}',
];

export function Ecommerce() {
  useDocumentTitle('E-Commerce & CRM Webhooks');
  const { canWrite } = useRole();
  const toast = useToast();

  const { data: sessions = [] } = useSessionsQuery();
  const [selectedSessionId, setSelectedSessionId] = useState('');

  const [automations, setAutomations] = useState<EcommerceAutomationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // Create / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<EcommerceAutomationItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formPlatform, setFormPlatform] = useState('shopify');
  const [formEventType, setFormEventType] = useState('order_created');
  const [formTemplate, setFormTemplate] = useState('');
  const [formDelay, setFormDelay] = useState(0);
  const [formSecret, setFormSecret] = useState('');
  const [saving, setSaving] = useState(false);

  // Test Simulator Modal
  const [showTestModal, setShowTestModal] = useState(false);
  const [testPayloadStr, setTestPayloadStr] = useState('');
  const [testResult, setTestResult] = useState<{
    extractedVariables: Record<string, string>;
    renderedMessage: string;
    targetChatId: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  // Audit Logs Modal
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logs, setLogs] = useState<EcommerceLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedAutomationForLogs, setSelectedAutomationForLogs] = useState<EcommerceAutomationItem | null>(null);

  // Auto select first session
  useEffect(() => {
    if (!selectedSessionId && sessions.length > 0) {
      const readySession = sessions.find((s: any) => s.status === 'READY') || sessions[0];
      const sid = (readySession as any).sessionId || (readySession as any).id;
      if (sid) setSelectedSessionId(sid);
    }
  }, [selectedSessionId, sessions]);

  // Load Automations
  const loadAutomations = useCallback(async () => {
    if (!selectedSessionId) return;
    setLoading(true);
    try {
      const data = await ecommerceApi.list(selectedSessionId);
      setAutomations(data);
    } catch {
      toast.error('Failed to load e-commerce automations');
    } finally {
      setLoading(false);
    }
  }, [selectedSessionId, toast]);

  useEffect(() => {
    void loadAutomations();
  }, [loadAutomations]);

  // Apply Starter Preset
  const applyPreset = (preset: typeof STARTER_TEMPLATES[0]) => {
    setEditingItem(null);
    setFormName(preset.name);
    setFormPlatform(preset.platform);
    setFormEventType(preset.eventType);
    setFormTemplate(preset.templateMessage);
    setFormDelay(preset.delayMinutes);
    setFormSecret('');
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setFormName('Shopify Order Confirmation');
    setFormPlatform('shopify');
    setFormEventType('order_created');
    setFormTemplate(STARTER_TEMPLATES[1].templateMessage);
    setFormDelay(0);
    setFormSecret('');
    setShowModal(true);
  };

  const openEditModal = (item: EcommerceAutomationItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormPlatform(item.platform);
    setFormEventType(item.eventType);
    setFormTemplate(item.templateMessage);
    setFormDelay(item.delayMinutes ?? 0);
    setFormSecret(item.webhookSecret || '');
    setShowModal(true);
  };

  // Insert Variable into Template Textarea
  const insertVariable = (variable: string) => {
    setFormTemplate(prev => `${prev} ${variable} `);
  };

  // Save Automation
  const handleSave = async () => {
    const activeSid =
      selectedSessionId ||
      (sessions.length > 0
        ? (sessions[0] as any).sessionId || (sessions[0] as any).id
        : '');

    if (!activeSid) {
      toast.error('Please select or connect an active WhatsApp session first.');
      return;
    }

    if (!formTemplate.trim()) {
      toast.error('Please enter a WhatsApp message template.');
      return;
    }

    const title =
      formName.trim() ||
      `${formPlatform.charAt(0).toUpperCase() + formPlatform.slice(1)} ${formEventType.replace(/_/g, ' ')}`;

    setSaving(true);
    const payload: CreateEcommercePayload = {
      name: title,
      platform: formPlatform,
      eventType: formEventType,
      webhookSecret: formSecret.trim() || null,
      templateMessage: formTemplate.trim(),
      delayMinutes: formDelay,
    };

    try {
      if (editingItem) {
        const updated = await ecommerceApi.update(activeSid, editingItem.id, payload);
        setAutomations(prev => prev.map(a => (a.id === editingItem.id ? updated : a)));
        toast.success('Automation updated successfully.');
      } else {
        const created = await ecommerceApi.create(activeSid, payload);
        setAutomations(prev => [created, ...prev]);
        toast.success('E-Commerce automation created.');
      }
      setShowModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save automation');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Status
  const handleToggle = async (item: EcommerceAutomationItem) => {
    if (!canWrite || !selectedSessionId) return;
    const nextState = !item.enabled;
    try {
      await ecommerceApi.update(selectedSessionId, item.id, { enabled: nextState });
      setAutomations(prev => prev.map(a => (a.id === item.id ? { ...a, enabled: nextState } : a)));
      toast.success(`Automation "${item.name}" ${nextState ? 'enabled' : 'paused'}.`);
    } catch {
      toast.error('Failed to update automation status');
    }
  };

  // Delete Automation
  const handleDelete = async (id: string, name: string) => {
    if (!canWrite || !selectedSessionId) return;
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await ecommerceApi.delete(selectedSessionId, id);
      setAutomations(prev => prev.filter(a => a.id !== id));
      toast.success('Automation deleted.');
    } catch {
      toast.error('Failed to delete automation');
    }
  };

  // Copy Webhook URL
  const copyWebhookUrl = (id: string) => {
    const url = ecommerceApi.getWebhookUrl(id);
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success('Webhook URL copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Open Test Simulator
  const openTestModal = (item: EcommerceAutomationItem) => {
    setEditingItem(item);
    const matchingPreset = STARTER_TEMPLATES.find(p => p.eventType === item.eventType);
    const sample = matchingPreset?.samplePayload || {
      customer_name: 'Jane Doe',
      phone: '+15550194820',
      order_id: '#10842',
      total_amount: '95.00',
      currency: 'USD',
    };
    setTestPayloadStr(JSON.stringify(sample, null, 2));
    setTestResult(null);
    setShowTestModal(true);
  };

  // Execute Test Simulator
  const runTest = async () => {
    if (!editingItem) return;
    let parsed: any;
    try {
      parsed = JSON.parse(testPayloadStr);
    } catch {
      toast.error('Invalid JSON payload');
      return;
    }

    setTesting(true);
    try {
      const result = await ecommerceApi.test({
        platform: editingItem.platform,
        eventType: editingItem.eventType,
        templateMessage: editingItem.templateMessage,
        payload: parsed,
      });
      setTestResult(result);
      toast.success('Simulation executed successfully.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setTesting(false);
    }
  };

  // Open Logs Modal
  const openLogsModal = async (item?: EcommerceAutomationItem) => {
    if (!selectedSessionId) return;
    setSelectedAutomationForLogs(item || null);
    setShowLogsModal(true);
    setLogsLoading(true);
    try {
      const logData = await ecommerceApi.getLogs(selectedSessionId, item?.id);
      setLogs(logData);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLogsLoading(false);
    }
  };

  const filteredAutomations = automations.filter(
    a =>
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.templateMessage.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.platform.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="ecommerce-page">
      <PageHeader
        title="E-Commerce & CRM Webhook Automations"
        subtitle="Auto-send WhatsApp messages on Shopify, WooCommerce, Stripe, and CRM webhook events."
        actions={
          <div className="ecom-header-actions">
            <div className="ecom-session-wrapper">
              <span className="session-select-label">Active WhatsApp Session:</span>
              <select
                className="ecom-session-select"
                value={selectedSessionId}
                onChange={e => setSelectedSessionId(e.target.value)}
              >
                {sessions.map((s: any) => {
                  const sid = s.sessionId || s.id;
                  const sname = s.sessionName || s.name || sid;
                  return (
                    <option key={sid} value={sid}>
                      {sname} ({s.status})
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              type="button"
              className="btn-secondary ecom-header-btn"
              onClick={() => setShowHowItWorks(!showHowItWorks)}
            >
              <HelpCircle size={15} />
              <span>How it Works</span>
            </button>

            <button
              type="button"
              className="btn-secondary ecom-header-btn"
              onClick={() => void openLogsModal()}
              disabled={!selectedSessionId}
            >
              <FileText size={15} />
              <span>Event Logs</span>
            </button>

            <button
              type="button"
              className="btn-primary ecom-create-btn"
              onClick={openCreateModal}
              disabled={!canWrite || !selectedSessionId}
            >
              <Plus size={16} />
              <span>Create Webhook Automation</span>
            </button>
          </div>
        }
      />

      {/* Interactive "How it Works" Visual Guide */}
      {showHowItWorks && (
        <div className="ecom-guide-card">
          <div className="guide-head">
            <div className="guide-title">
              <Globe size={18} className="text-primary" />
              <h4>How E-Commerce & CRM Webhooks Work</h4>
            </div>
            <button className="guide-close-btn" onClick={() => setShowHowItWorks(false)}>✕</button>
          </div>
          <div className="guide-steps-grid">
            <div className="guide-step-item">
              <div className="step-number">1</div>
              <div className="step-content">
                <h5>Create & Copy Webhook URL</h5>
                <p>Pick a store event below (e.g. Abandoned Cart or Order Created) and copy your unique webhook endpoint URL.</p>
              </div>
            </div>
            <div className="guide-arrow"><ArrowRight size={20} /></div>
            <div className="guide-step-item">
              <div className="step-number">2</div>
              <div className="step-content">
                <h5>Paste into Store / CRM</h5>
                <p>Paste the webhook URL into <strong>Shopify</strong> (Settings &gt; Notifications &gt; Webhooks), <strong>WooCommerce</strong> (Settings &gt; Advanced), or <strong>Stripe</strong>.</p>
              </div>
            </div>
            <div className="guide-arrow"><ArrowRight size={20} /></div>
            <div className="guide-step-item">
              <div className="step-number">3</div>
              <div className="step-content">
                <h5>Instant WhatsApp Delivery</h5>
                <p>When an event occurs, OpenWA automatically parses customer details and delivers the formatted WhatsApp message!</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1-Click Starter Presets Banner */}
      <div className="presets-banner">
        <div className="presets-header">
          <div className="presets-title-wrap">
            <Sparkles size={18} className="preset-sparkle-icon" />
            <h3>1-Click Store Automations</h3>
          </div>
          <span className="presets-sub">Select any pre-configured e-commerce workflow to launch in seconds:</span>
        </div>

        <div className="presets-grid">
          {STARTER_TEMPLATES.map(preset => {
            const Icon = preset.icon;
            return (
              <div
                key={preset.id}
                className="preset-card"
                onClick={() => applyPreset(preset)}
                role="button"
                tabIndex={0}
              >
                <div
                  className="preset-icon-badge"
                  style={{ background: `${preset.color}18`, color: preset.color }}
                >
                  <Icon size={20} />
                </div>
                <div className="preset-content">
                  <div className="preset-title">{preset.name}</div>
                  <div className="preset-desc">{preset.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Automations Main Container */}
      <div className="ecom-main-card">
        {/* Toolbar */}
        <div className="ecom-toolbar">
          <div className="ecom-count">
            <strong>{filteredAutomations.length}</strong> Active Webhook Automations
          </div>

          <div className="ecom-search-box">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search automations or templates..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Loading / Empty / Automations Grid */}
        {loading ? (
          <div className="ecom-loading">
            <div className="animate-spin text-primary">
              <ShoppingCart size={32} />
            </div>
            <p>Loading e-commerce automations...</p>
          </div>
        ) : filteredAutomations.length === 0 ? (
          <div className="ecom-empty-state">
            <div className="empty-icon-circle">
              <ShoppingCart size={40} />
            </div>
            <h3>No Webhook Automations Configured</h3>
            <p>
              Connect your Shopify store, WooCommerce, Stripe, or CRM to automatically message customers when they abandon carts, make purchases, or track packages.
            </p>
            <button className="btn-primary" onClick={openCreateModal} disabled={!canWrite || !selectedSessionId}>
              <Plus size={16} />
              <span>Create Your First Store Webhook</span>
            </button>
          </div>
        ) : (
          <div className="automations-grid">
            {filteredAutomations.map(item => {
              const webhookUrl = ecommerceApi.getWebhookUrl(item.id);
              const isCopied = copiedId === item.id;

              return (
                <div key={item.id} className={`automation-card ${item.enabled ? 'active' : 'disabled'}`}>
                  <div className="automation-card-head">
                    <div className="automation-title-col">
                      <h4 className="automation-name">{item.name}</h4>
                      <div className="automation-badges-row">
                        <span className={`ecom-platform-badge ${item.platform}`}>
                          {item.platform.toUpperCase()}
                        </span>
                        <span className="ecom-event-badge">
                          <Package size={12} />
                          {item.eventType.replace('_', ' ')}
                        </span>
                        {item.delayMinutes > 0 && (
                          <span className="ecom-delay-badge">
                            <Clock size={12} />
                            {item.delayMinutes}m delay
                          </span>
                        )}
                      </div>
                    </div>

                    <label className="switch" title={item.enabled ? 'Click to pause' : 'Click to enable'}>
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        onChange={() => void handleToggle(item)}
                        disabled={!canWrite}
                      >
                      </input>
                      <span className="slider round" />
                    </label>
                  </div>

                  {/* Webhook Ingress URL Box */}
                  <div className="webhook-url-box">
                    <span className="webhook-box-label">Webhook Receiver URL (Paste into Store Webhook settings):</span>
                    <div className="webhook-url-input-row">
                      <input type="text" readOnly value={webhookUrl} />
                      <button
                        type="button"
                        className={`copy-url-btn ${isCopied ? 'copied' : ''}`}
                        onClick={() => copyWebhookUrl(item.id)}
                        title="Copy Webhook URL"
                      >
                        {isCopied ? <Check size={14} /> : <Copy size={14} />}
                        <span>{isCopied ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Message Template Preview */}
                  <div className="automation-template-preview">
                    <div className="template-preview-label">
                      <MessageSquare size={13} />
                      <span>WhatsApp Message Template:</span>
                    </div>
                    <div className="template-preview-text">{item.templateMessage}</div>
                  </div>

                  {/* Card Footer */}
                  <div className="automation-card-footer">
                    <div className="trigger-stats-tag">
                      <Zap size={13} className="text-primary" />
                      <span>
                        <strong>{item.triggerCount || 0}</strong> Dispatches
                        {item.lastTriggeredAt && (
                          <> • Last: {new Date(item.lastTriggeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
                        )}
                      </span>
                    </div>

                    <div className="automation-actions">
                      <button
                        type="button"
                        className="icon-action-btn"
                        onClick={() => openTestModal(item)}
                        title="Test Webhook Payload Sandbox"
                      >
                        <Play size={15} />
                      </button>
                      <button
                        type="button"
                        className="icon-action-btn"
                        onClick={() => void openLogsModal(item)}
                        title="View Event Logs"
                      >
                        <FileText size={15} />
                      </button>
                      <button
                        type="button"
                        className="icon-action-btn"
                        onClick={() => openEditModal(item)}
                        title="Edit Automation"
                        disabled={!canWrite}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        className="icon-action-btn danger"
                        onClick={() => void handleDelete(item.id, item.name)}
                        title="Delete Automation"
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

      {/* Create / Edit Automation Modal */}
      {showModal && (
        <Modal
          open
          onClose={() => setShowModal(false)}
          title={editingItem ? 'Edit E-Commerce Automation' : 'Create E-Commerce Webhook Automation'}
          closeLabel="Cancel"
          className="ecom-modal"
          footer={
            <>
              <button className="btn-secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saving || !formName.trim() || !formTemplate.trim()}
              >
                <CheckCircle2 size={16} />
                <span>{saving ? 'Saving...' : editingItem ? 'Update Automation' : 'Save & Activate'}</span>
              </button>
            </>
          }
        >
          <div className="ecom-modal-form">
            {/* Automation Name */}
            <div className="form-group">
              <label htmlFor="e-name">
                Automation Title <span className="required-star">*</span>
              </label>
              <input
                id="e-name"
                type="text"
                className="input-field"
                placeholder="e.g. Shopify Abandoned Cart Recovery"
                value={formName}
                onChange={e => setFormName(e.target.value)}
              />
            </div>

            {/* Platform & Event Type */}
            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="e-platform">Store Platform</label>
                <select
                  id="e-platform"
                  value={formPlatform}
                  onChange={e => setFormPlatform(e.target.value)}
                >
                  <option value="shopify">Shopify Store</option>
                  <option value="woocommerce">WooCommerce</option>
                  <option value="stripe">Stripe Payments</option>
                  <option value="custom">Custom CRM / Zapier / Make / n8n</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="e-event">Event Trigger</label>
                <select
                  id="e-event"
                  value={formEventType}
                  onChange={e => setFormEventType(e.target.value)}
                >
                  <option value="abandoned_cart">🛒 Abandoned Cart (Checkouts)</option>
                  <option value="order_created">📦 Order Created / Paid</option>
                  <option value="order_fulfilled">🚚 Order Fulfilled / Shipped</option>
                  <option value="payment_received">💳 Payment Succeeded</option>
                  <option value="custom_webhook">⚡ Custom CRM Event</option>
                </select>
              </div>
            </div>

            {/* Delay Minutes */}
            <div className="form-group">
              <label htmlFor="e-delay">Dispatch Delay</label>
              <select
                id="e-delay"
                value={formDelay}
                onChange={e => setFormDelay(Number(e.target.value))}
              >
                <option value="0">Instant (Send immediately on webhook receive)</option>
                <option value="15">15 Minutes Delay (Recommended for Abandoned Cart)</option>
                <option value="30">30 Minutes Delay</option>
                <option value="60">1 Hour Delay</option>
                <option value="120">2 Hours Delay</option>
                <option value="1440">24 Hours Delay</option>
              </select>
              <span className="form-helper-text">
                For abandoned carts, a 15-30 minute delay allows customers time to complete checkout before receiving a reminder.
              </span>
            </div>

            {/* Template Message & Inserter Chips */}
            <div className="form-group">
              <div className="variables-bar">
                <label htmlFor="e-template">
                  WhatsApp Message Template <span className="required-star">*</span>
                </label>
                <div className="variable-chips-wrap">
                  <span className="var-hint">Click variable to insert into message template:</span>
                  <div className="var-chips-list">
                    {VARIABLE_TAGS.map(v => (
                      <button
                        key={v}
                        type="button"
                        className="var-chip-btn"
                        onClick={() => insertVariable(v)}
                      >
                        + {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <textarea
                id="e-template"
                className="textarea-field"
                rows={6}
                placeholder="Type your WhatsApp notification message using dynamic variables..."
                value={formTemplate}
                onChange={e => setFormTemplate(e.target.value)}
              />
              <span className="form-helper-text">
                Supports WhatsApp markdown: <code>*bold*</code>, <code>_italic_</code>, and dynamic <code>{'{{placeholders}}'}</code>.
              </span>
            </div>
          </div>
        </Modal>
      )}

      {/* Webhook Payload Test Simulator Modal */}
      {showTestModal && editingItem && (
        <Modal
          open
          onClose={() => setShowTestModal(false)}
          title={`Test Webhook Simulator: ${editingItem.name}`}
          closeLabel="Close"
          className="ecom-test-modal"
          footer={
            <>
              <button className="btn-secondary" onClick={() => setShowTestModal(false)}>
                Close
              </button>
              <button className="btn-primary" onClick={runTest} disabled={testing}>
                <Play size={16} />
                <span>{testing ? 'Testing...' : 'Execute Test Payload'}</span>
              </button>
            </>
          }
        >
          <div className="test-simulator-layout">
            <div className="form-group">
              <label>Sample JSON Payload (Editable):</label>
              <textarea
                className="textarea-field code-textarea"
                rows={10}
                value={testPayloadStr}
                onChange={e => setTestPayloadStr(e.target.value)}
              />
            </div>

            {testResult && (
              <div className="test-result-box">
                <h4>🧪 Simulation Results</h4>
                <div className="test-meta-row">
                  <div>
                    <strong>Target WhatsApp Recipient:</strong> <code>{testResult.targetChatId}</code>
                  </div>
                </div>

                <div className="rendered-preview-card">
                  <div className="rendered-head">Rendered WhatsApp Message:</div>
                  <div className="rendered-body">{testResult.renderedMessage}</div>
                </div>

                <div className="parsed-vars-table">
                  <div className="rendered-head">Extracted Variables:</div>
                  <div className="vars-chips-summary">
                    {Object.entries(testResult.extractedVariables).map(([k, v]) => (
                      <div key={k} className="var-key-val">
                        <span className="k">{k}:</span> <span className="v">{v || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Audit Logs Modal */}
      {showLogsModal && (
        <Modal
          open
          onClose={() => setShowLogsModal(false)}
          title={
            selectedAutomationForLogs
              ? `Webhook Logs: ${selectedAutomationForLogs.name}`
              : 'E-Commerce & CRM Webhook Event Logs'
          }
          closeLabel="Close"
          className="ecom-logs-modal"
        >
          <div className="logs-modal-body">
            {logsLoading ? (
              <div className="logs-loading">
                <FileText size={24} className="animate-spin text-primary" />
                <p>Loading event audit logs...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="logs-empty">
                <AlertCircle size={32} className="text-muted" />
                <p>No webhook events received yet.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Event</th>
                      <th>Recipient</th>
                      <th>Order ID</th>
                      <th>Status</th>
                      <th>Message Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id}>
                        <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td>
                          <span className="log-event-badge">{log.eventType}</span>
                        </td>
                        <td>
                          <code>{log.recipientPhone}</code>
                        </td>
                        <td>{log.orderId || '—'}</td>
                        <td>
                          <span className={`status-pill ${log.status}`}>
                            {log.status === 'delivered' ? '✓ Sent' : log.status}
                          </span>
                        </td>
                        <td style={{ maxWidth: '280px', fontSize: '0.8rem' }}>
                          {log.messageText ? (
                            <span className="log-msg-preview">{log.messageText}</span>
                          ) : (
                            <span className="text-muted">{log.errorMessage || '—'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
