import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Copy,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import {
  templateApi,
  messageApi,
  contactBookApi,
  type MessageTemplate,
  type TemplatePayload,
  type BatchStatusResponse,
  type ContactBookItem,
} from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRole } from '../hooks/useRole';
import { useToast } from '../hooks/useToast';
import {
  useCreateTemplateMutation,
  useDeleteTemplateMutation,
  useSessionsQuery,
  useTemplatesQuery,
  useUpdateTemplateMutation,
} from '../hooks/queries';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { copyToClipboard } from '../utils/clipboard';
import './Templates.css';

type TemplateForm = {
  name: string;
  header: string;
  body: string;
  footer: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  submitToMeta: boolean;
};

const emptyForm: TemplateForm = {
  name: '',
  header: '',
  body: '',
  footer: '',
  category: 'MARKETING',
  language: 'en_US',
  submitToMeta: false,
};

function extractPlaceholders(template: TemplateForm | MessageTemplate) {
  const source = [template.header, template.body, template.footer].filter(Boolean).join('\n');
  return Array.from(new Set(Array.from(source.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g), match => match[1]))).sort();
}

function toPayload(form: TemplateForm): TemplatePayload {
  return {
    name: form.name.trim(),
    header: form.header.trim() || null,
    body: form.body.trim(),
    footer: form.footer.trim() || null,
    category: form.category,
    language: form.language,
    submitToMeta: form.submitToMeta,
  };
}

function renderPreview(template: TemplateForm, values: Record<string, string>) {
  return [template.header, template.body, template.footer]
    .filter(Boolean)
    .join('\n\n')
    .replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => values[key] || `{{${key}}}`);
}

export function Templates() {
  const { t } = useTranslation();
  useDocumentTitle(t('templates.title'));
  const { canWrite } = useRole();
  const queryClient = useQueryClient();
  const { data: sessions = [], isLoading: loadingSessions } = useSessionsQuery();
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MessageTemplate | null>(null);
  const toast = useToast();
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [syncingMeta, setSyncingMeta] = useState(false);

  // Bulk Campaign Modal state
  const [bulkCampaignTemplate, setBulkCampaignTemplate] = useState<MessageTemplate | null>(null);
  const [bulkRecipientsText, setBulkRecipientsText] = useState('');
  const [bulkDelay, setBulkDelay] = useState('2000');
  const [bulkDefaultVars, setBulkDefaultVars] = useState<Record<string, string>>({});
  const [bulkBatchResult, setBulkBatchResult] = useState<BatchStatusResponse | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [availableTags, setAvailableTags] = useState<Array<{ tag: string; count: number }>>([]);
  const [selectedAudienceTag, setSelectedAudienceTag] = useState<string>('');

  const { data: templates = [], isLoading: loadingTemplates } = useTemplatesQuery(
    selectedSessionId,
    !!selectedSessionId,
  );
  const createMutation = useCreateTemplateMutation();
  const updateMutation = useUpdateTemplateMutation();
  const deleteMutation = useDeleteTemplateMutation();

  const selectedSession = sessions.find(session => session.id === selectedSessionId);
  const isMetaSession = !!selectedSession?.pushName?.includes('Meta');

  const placeholders = useMemo(() => extractPlaceholders(form), [form]);
  const preview = useMemo(() => renderPreview(form, previewValues), [form, previewValues]);

  const filteredTemplates = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter(template =>
      [template.name, template.header, template.body, template.footer, template.category, template.status]
        .filter(Boolean)
        .some(value => value!.toLowerCase().includes(query)),
    );
  }, [searchTerm, templates]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (!selectedSessionId && sessions.length > 0) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [selectedSessionId, sessions]);

  useEffect(() => {
    setPreviewValues(current => {
      const next: Record<string, string> = {};
      for (const key of placeholders) {
        next[key] = current[key] || '';
      }
      return next;
    });
  }, [placeholders]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingTemplate(null);
    setPreviewValues({});
  };

  const openEdit = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setForm({
      name: template.name,
      header: template.header || '',
      body: template.body,
      footer: template.footer || '',
      category: template.category || 'MARKETING',
      language: template.language || 'en_US',
      submitToMeta: false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSyncMeta = async () => {
    if (!selectedSessionId) return;
    setSyncingMeta(true);
    try {
      const res = await templateApi.syncMeta(selectedSessionId);
      toast.success(`Synced ${res.synced} templates from Meta WhatsApp Business.`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.templates(selectedSessionId) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sync from Meta');
    } finally {
      setSyncingMeta(false);
    }
  };

  const handleSave = async () => {
    if (!selectedSessionId || !form.name.trim() || !form.body.trim()) return;

    try {
      if (editingTemplate) {
        await updateMutation.mutateAsync({
          sessionId: selectedSessionId,
          id: editingTemplate.id,
          data: toPayload(form),
        });
        toast.success(t('templates.toasts.updated'));
      } else {
        await createMutation.mutateAsync({
          sessionId: selectedSessionId,
          data: toPayload(form),
        });
        toast.success(t('templates.toasts.created'));
      }
      resetForm();
    } catch (err) {
      toast.error(
        t(editingTemplate ? 'templates.toasts.updateFailed' : 'templates.toasts.createFailed', {
          message: err instanceof Error ? err.message : t('common.unknownError'),
        }),
      );
    }
  };

  const handleDelete = async () => {
    if (!selectedSessionId || !deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({ sessionId: selectedSessionId, id: deleteTarget.id });
      toast.success(t('templates.toasts.deleted'));
      if (editingTemplate?.id === deleteTarget.id) resetForm();
      setDeleteTarget(null);
    } catch (err) {
      toast.error(
        t('templates.toasts.deleteFailed', {
          message: err instanceof Error ? err.message : t('common.unknownError'),
        }),
      );
    }
  };

  const copyName = async (name: string) => {
    if (await copyToClipboard(name)) {
      toast.success(t('templates.toasts.copied'));
    }
  };

  // Launch Bulk Campaign
  const openBulkCampaign = (template: MessageTemplate) => {
    setBulkCampaignTemplate(template);
    setBulkRecipientsText('');
    setBulkBatchResult(null);
    setSelectedAudienceTag('');
    const tplPlaceholders = extractPlaceholders(template);
    const defaults: Record<string, string> = {};
    for (const key of tplPlaceholders) {
      defaults[key] = '';
    }
    setBulkDefaultVars(defaults);

    // Fetch contact book tags
    void contactBookApi.getTags(selectedSessionId).then(setAvailableTags).catch(() => {});
  };

  const handleSelectAudienceTag = async (tag: string) => {
    setSelectedAudienceTag(tag);
    if (!tag) return;
    try {
      const res = await contactBookApi.list({
        sessionId: selectedSessionId || undefined,
        tag: tag !== 'ALL' ? tag : undefined,
        limit: 1000,
      });
      const lines = (res.items || []).map((c: ContactBookItem) => `${c.phone}${c.name ? `, ${c.name}` : ''}`);
      setBulkRecipientsText(lines.join('\n'));
      toast.success(`Loaded ${lines.length} contacts from tag "${tag}"`);
    } catch (err) {
      toast.error('Failed to load contacts for tag');
    }
  };

  const handleStartBulkCampaign = async () => {
    if (!selectedSessionId || !bulkCampaignTemplate || !bulkRecipientsText.trim()) return;

    // Parse recipients lines (can be `phone` or `phone, var1, var2`)
    const lines = bulkRecipientsText
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      toast.error('Please enter at least one recipient phone number.');
      return;
    }

    const tplPlaceholders = extractPlaceholders(bulkCampaignTemplate);

    const messages = lines.map(line => {
      const parts = line.split(',').map(p => p.trim());
      const recipient = parts[0];
      const vars: Record<string, string> = { ...bulkDefaultVars };

      // Map positionally if multiple columns provided
      tplPlaceholders.forEach((key, index) => {
        if (parts[index + 1]) {
          vars[key] = parts[index + 1];
        }
      });

      const fullText = [bulkCampaignTemplate.header, bulkCampaignTemplate.body, bulkCampaignTemplate.footer]
        .filter(Boolean)
        .join('\n\n')
        .replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => vars[key] || `{{${key}}}`);

      return {
        chatId: recipient,
        type: 'text' as const,
        content: {
          text: fullText,
        },
        variables: vars,
      };
    });

    setBulkSending(true);
    try {
      const response = await messageApi.sendBulk(selectedSessionId, {
        messages,
        options: {
          delayBetweenMessages: parseInt(bulkDelay, 10) || 2000,
          stopOnError: false,
        },
      });

      toast.success(`Bulk campaign started (${lines.length} recipients).`);

      // Poll batch status
      const interval = setInterval(async () => {
        try {
          const status = await messageApi.getBatchStatus(selectedSessionId, response.batchId);
          setBulkBatchResult(status);
          if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
            clearInterval(interval);
            setBulkSending(false);
          }
        } catch {
          clearInterval(interval);
          setBulkSending(false);
        }
      }, 1500);
    } catch (err) {
      setBulkSending(false);
      toast.error(err instanceof Error ? err.message : 'Bulk send failed');
    }
  };

  if (loadingSessions) {
    return (
      <div className="templates-page templates-loading">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="templates-page">
      <PageHeader
        title={t('templates.title')}
        subtitle={t('templates.subtitle')}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {selectedSession && (
              <button
                className="btn-secondary"
                onClick={handleSyncMeta}
                disabled={syncingMeta}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Sync approved templates directly from Meta WhatsApp Business"
              >
                {syncingMeta ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                <span>Sync Meta Templates</span>
              </button>
            )}
            <select
              className="templates-session-select"
              aria-label={t('templates.sessionSelect')}
              value={selectedSessionId}
              onChange={event => {
                setSelectedSessionId(event.target.value);
                resetForm();
              }}
            >
              {sessions.length === 0 && <option value="">{t('templates.noSessions')}</option>}
              {sessions.map(session => (
                <option key={session.id} value={session.id}>
                  {session.name} {session.pushName?.includes('Meta') ? '(⚡ Meta API)' : ''}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {sessions.length === 0 ? (
        <div className="templates-empty-page">
          <FileText size={48} strokeWidth={1} />
          <h3>{t('templates.empty.noSessionsTitle')}</h3>
          <p>{t('templates.empty.noSessionsDesc')}</p>
        </div>
      ) : (
        <div className="templates-workspace">
          <aside className="templates-library">
            <div className="templates-library-header">
              <div>
                <h2>{t('templates.savedTitle')}</h2>
                <span>{t('templates.count', { count: templates.length })}</span>
              </div>
              <button className="btn-primary templates-new-btn" onClick={resetForm} disabled={!canWrite}>
                <Plus size={16} />
                {t('templates.newTemplate')}
              </button>
            </div>

            <div className="templates-search">
              <Search size={16} />
              <input
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Search templates or categories..."
              />
            </div>

            {loadingTemplates ? (
              <div className="templates-loading-inline">
                <Loader2 className="animate-spin" size={24} />
              </div>
            ) : templates.length === 0 ? (
              <div className="templates-empty-list">
                <FileText size={40} strokeWidth={1} />
                <h3>{t('templates.empty.title')}</h3>
                <p>{t('templates.empty.description')}</p>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="templates-empty-list compact">
                <Search size={32} strokeWidth={1.5} />
                <h3>{t('templates.empty.title')}</h3>
              </div>
            ) : (
              <div className="template-list" role="list">
                {filteredTemplates.map(template => {
                  const templatePlaceholders = extractPlaceholders(template);
                  const isSelected = editingTemplate?.id === template.id;
                  const status = template.status || 'LOCAL';
                  return (
                    <div
                      key={template.id}
                      className={`template-list-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => openEdit(template)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span className="template-list-title">{template.name}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {template.category && (
                            <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', color: '#94a3b8' }}>
                              {template.category}
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: '0.65rem',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontWeight: 600,
                              background:
                                status === 'APPROVED'
                                  ? 'rgba(34, 197, 94, 0.2)'
                                  : status === 'PENDING'
                                  ? 'rgba(234, 179, 8, 0.2)'
                                  : status === 'REJECTED'
                                  ? 'rgba(239, 68, 68, 0.2)'
                                  : 'rgba(148, 163, 184, 0.2)',
                              color:
                                status === 'APPROVED'
                                  ? '#4ade80'
                                  : status === 'PENDING'
                                  ? '#facc15'
                                  : status === 'REJECTED'
                                  ? '#f87171'
                                  : '#94a3b8',
                            }}
                          >
                            {status}
                          </span>
                        </div>
                      </div>
                      <span className="template-list-body">{template.body}</span>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                        <span className="template-list-meta">
                          {templatePlaceholders.length > 0
                            ? templatePlaceholders.map(key => `{{${key}}}`).join(' ')
                            : t('templates.noPlaceholders')}
                        </span>
                        <button
                          className="btn-xs"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            fontSize: '0.75rem',
                            borderRadius: '4px',
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#60a5fa',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            cursor: 'pointer',
                          }}
                          onClick={e => {
                            e.stopPropagation();
                            openBulkCampaign(template);
                          }}
                          title="Launch bulk messaging campaign using this template"
                        >
                          <Send size={12} />
                          <span>Bulk Send</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="template-editor">
            <div className="template-editor-header">
              <div>
                <h2>{editingTemplate ? t('templates.editTitle') : t('templates.createTitle')}</h2>
                <p>{selectedSession ? t('templates.sessionHint', { name: selectedSession.name }) : ''}</p>
              </div>
              <div className="template-header-actions">
                {editingTemplate && (
                  <button
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '6px' }}
                    onClick={() => openBulkCampaign(editingTemplate)}
                    type="button"
                  >
                    <Send size={15} />
                    <span>Launch Bulk Send</span>
                  </button>
                )}
                {editingTemplate && (
                  <button
                    className="icon-btn"
                    title={t('templates.actions.copyName')}
                    onClick={() => void copyName(editingTemplate.name)}
                    type="button"
                  >
                    <Copy size={16} />
                  </button>
                )}
                {editingTemplate && canWrite && (
                  <button
                    className="icon-btn danger"
                    title={t('common.delete')}
                    onClick={() => setDeleteTarget(editingTemplate)}
                    type="button"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="template-form">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label htmlFor="tpl-1">{t('common.name')}</label>
                  <input
                    id="tpl-1"
                    value={form.name}
                    onChange={event => setForm({ ...form, name: event.target.value })}
                    placeholder="e.g. order_confirmation"
                    disabled={!canWrite}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="tpl-cat">Category</label>
                  <select
                    id="tpl-cat"
                    value={form.category}
                    onChange={event => setForm({ ...form, category: event.target.value as any })}
                    disabled={!canWrite}
                  >
                    <option value="MARKETING">Marketing (Promotional, Offers)</option>
                    <option value="UTILITY">Utility (Order alerts, Receipts)</option>
                    <option value="AUTHENTICATION">Authentication (OTPs, Security)</option>
                  </select>
                </div>
              </div>

              <div className="template-message-fields">
                <div className="form-group">
                  <label htmlFor="tpl-2">{t('templates.header')}</label>
                  <input
                    id="tpl-2"
                    value={form.header}
                    onChange={event => setForm({ ...form, header: event.target.value })}
                    placeholder={t('templates.headerPlaceholder')}
                    disabled={!canWrite}
                  />
                </div>

                <div className="form-group body-field">
                  <label htmlFor="tpl-3">{t('templates.body')}</label>
                  <textarea
                    id="tpl-3"
                    value={form.body}
                    onChange={event => setForm({ ...form, body: event.target.value })}
                    placeholder="Hello {{1}}, your order {{2}} has been confirmed!"
                    rows={8}
                    disabled={!canWrite}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="tpl-4">{t('templates.footer')}</label>
                  <input
                    id="tpl-4"
                    value={form.footer}
                    onChange={event => setForm({ ...form, footer: event.target.value })}
                    placeholder="Reply STOP to unsubscribe"
                    disabled={!canWrite}
                  />
                </div>

                {!editingTemplate && isMetaSession && (
                  <div style={{ marginTop: '8px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontWeight: 500 }}>
                      <input
                        type="checkbox"
                        checked={form.submitToMeta}
                        onChange={e => setForm({ ...form, submitToMeta: e.target.checked })}
                      />
                      <span>⚡ Submit directly to Meta WhatsApp Business for Official Approval</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="template-editor-actions">
                <button className="btn-secondary" onClick={resetForm} disabled={isSaving} type="button">
                  {t('common.cancel')}
                </button>
                <button
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={!canWrite || isSaving || !selectedSessionId || !form.name.trim() || !form.body.trim()}
                  type="button"
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                  {canWrite
                    ? t(editingTemplate ? 'templates.saveChanges' : 'templates.createTemplate')
                    : t('templates.viewOnly')}
                </button>
              </div>
            </div>
          </section>

          <aside className="template-preview">
            <div className="template-preview-header">
              <h2>{t('templates.previewTitle')}</h2>
              <span>{placeholders.length} variables</span>
            </div>
            <div className="template-preview-message">
              <pre>{preview || t('templates.previewEmpty')}</pre>
            </div>
            <div className="template-variable-panel">
              {placeholders.length > 0 ? (
                <div className="placeholder-list">
                  {placeholders.map(key => (
                    <label key={key}>
                      <span>{`{{${key}}}`}</span>
                      <input
                        value={previewValues[key] || ''}
                        onChange={event => setPreviewValues({ ...previewValues, [key]: event.target.value })}
                        placeholder="Sample preview value"
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <p className="template-muted">{t('templates.noPlaceholders')}</p>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          open
          onClose={() => setDeleteTarget(null)}
          title={t('templates.deleteTitle')}
          className="modal-sm"
          closeLabel={t('common.close')}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>
                {t('common.cancel')}
              </button>
              <button className="btn-danger" onClick={handleDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                {t('common.delete')}
              </button>
            </>
          }
        >
          <p>{t('templates.deleteConfirm', { name: deleteTarget.name })}</p>
        </Modal>
      )}

      {/* Bulk Campaign Dispatch Modal */}
      {bulkCampaignTemplate && (
        <Modal
          open
          onClose={() => setBulkCampaignTemplate(null)}
          title={`🚀 Launch Bulk Campaign: ${bulkCampaignTemplate.name}`}
          closeLabel={t('common.close')}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setBulkCampaignTemplate(null)}>
                {t('common.close')}
              </button>
              <button
                className="btn-primary"
                onClick={handleStartBulkCampaign}
                disabled={bulkSending || !bulkRecipientsText.trim()}
              >
                {bulkSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                <span>{bulkSending ? 'Broadcasting...' : 'Start Broadcast'}</span>
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>Template Body:</div>
              <div style={{ fontSize: '0.9rem', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>{bulkCampaignTemplate.body}</div>
            </div>

            {availableTags.length > 0 && (
              <div style={{ padding: '10px 14px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#60a5fa', marginBottom: '4px' }}>
                  👥 Select Audience from Contact Book:
                </label>
                <select
                  value={selectedAudienceTag}
                  onChange={e => void handleSelectAudienceTag(e.target.value)}
                  style={{ width: '100%', fontSize: '0.85rem' }}
                >
                  <option value="">-- Choose an Audience Tag to Auto-Populate --</option>
                  <option value="ALL">All Contacts</option>
                  {availableTags.map(t => (
                    <option key={t.tag} value={t.tag}>
                      Tag: {t.tag} ({t.count} contacts)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.85rem' }}>
                Recipients (One phone per line, or CSV with variables):
              </label>
              <textarea
                rows={6}
                value={bulkRecipientsText}
                onChange={e => setBulkRecipientsText(e.target.value)}
                placeholder={"+15551234567\n+15557654321, John, 10992\n+15559876543, Sarah, 10993"}
                style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Format: <code>phone</code> or <code>phone, var1, var2...</code>
              </span>
            </div>

            {extractPlaceholders(bulkCampaignTemplate).length > 0 && (
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.85rem' }}>
                  Default Fallback Variables:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {extractPlaceholders(bulkCampaignTemplate).map(key => (
                    <div key={key}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{`{{${key}}}`}</span>
                      <input
                        type="text"
                        value={bulkDefaultVars[key] || ''}
                        onChange={e => setBulkDefaultVars({ ...bulkDefaultVars, [key]: e.target.value })}
                        placeholder={`Default value for ${key}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem' }}>
                Pacing Delay between messages (ms):
              </label>
              <input
                type="number"
                value={bulkDelay}
                onChange={e => setBulkDelay(e.target.value)}
                style={{ width: '120px' }}
              />
            </div>

            {bulkBatchResult && (
              <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                <div style={{ fontWeight: 600, color: '#4ade80', marginBottom: '6px' }}>
                  Campaign Status: {bulkBatchResult.status.toUpperCase()}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center' }}>
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '4px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Total</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{bulkBatchResult.progress?.total || 0}</div>
                  </div>
                  <div style={{ background: 'rgba(34, 197, 94, 0.15)', padding: '6px', borderRadius: '4px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#4ade80' }}>Sent</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#4ade80' }}>{bulkBatchResult.progress?.sent || 0}</div>
                  </div>
                  <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '6px', borderRadius: '4px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#f87171' }}>Failed</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f87171' }}>{bulkBatchResult.progress?.failed || 0}</div>
                  </div>
                  <div style={{ background: 'rgba(234, 179, 8, 0.15)', padding: '6px', borderRadius: '4px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#facc15' }}>Pending</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#facc15' }}>{bulkBatchResult.progress?.pending || 0}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
