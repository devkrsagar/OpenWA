import { useState, useEffect, useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  useTable,
  tableFeatures,
  createColumnHelper,
  createCoreRowModel,
  columnVisibilityFeature,
  flexRender,
  type ColumnVisibilityState,
} from '@tanstack/react-table';
import {
  Plus,
  Copy,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Check,
  KeyRound,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import type { ApiKey } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import {
  useApiKeysQuery,
  useCreateApiKeyMutation,
  useDeleteApiKeyMutation,
  useRevokeApiKeyMutation,
} from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { useToast } from '../hooks/useToast';
import { useRole } from '../hooks/useRole';
import { copyToClipboard } from '../utils/clipboard';
import './ApiKeys.css';

const roleNames = ['admin', 'operator', 'viewer'] as const;

function useWindowSize() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return width;
}

const features = tableFeatures({
  columnVisibilityFeature,
  coreRowModel: createCoreRowModel(),
});

const columnHelper = createColumnHelper<typeof features, ApiKey>();

export function ApiKeys() {
  const { t } = useTranslation();
  const toast = useToast();
  const { role } = useRole();
  const isAdmin = role === 'admin';
  useDocumentTitle(t('apiKeys.title'));
  const { data: apiKeys = [], isLoading: loading, isError: apiKeysError } = useApiKeysQuery();
  const createMutation = useCreateApiKeyMutation();
  const deleteMutation = useDeleteApiKeyMutation();
  const revokeMutation = useRevokeApiKeyMutation();
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [newKey, setNewKey] = useState({ name: '', role: 'operator' });
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'revoke'; id: string; name: string } | null>(
    null,
  );

  const windowWidth = useWindowSize();
  const isMobile = windowWidth < 768;
  const isSmall = windowWidth < 640;
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});

  useEffect(() => {
    setColumnVisibility({ key: !isSmall, lastUsed: !isMobile });
  }, [isMobile, isSmall]);

  const handleCreate = async () => {
    if (!newKey.name) return;
    try {
      const created = await createMutation.mutateAsync({ name: newKey.name, role: newKey.role });
      setCreatedKey(created.apiKey || null);
      setNewKey({ name: '', role: 'operator' });
    } catch (err) {
      console.error('Failed to create:', err);
      toast.error(t('apiKeys.createBtn'), err instanceof Error ? err.message : t('common.unknownError'));
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeMutation.mutateAsync(id);
    } catch (err) {
      console.error('Failed to revoke:', err);
      toast.error(t('apiKeys.actions.revoke'), err instanceof Error ? err.message : t('common.unknownError'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch (err) {
      console.error('Failed to delete:', err);
      toast.error(t('apiKeys.actions.delete'), err instanceof Error ? err.message : t('common.unknownError'));
    }
  };

  const confirmAndExecute = () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'delete') handleDelete(confirmAction.id);
    else handleRevoke(confirmAction.id);
    setConfirmAction(null);
  };

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopy = async (text: string, id: string) => {
    if (await copyToClipboard(text)) {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('name', {
          header: () => t('apiKeys.columns.name'),
          cell: info => <span className="name-cell">{info.getValue()}</span>,
        }),
        columnHelper.accessor('keyPrefix', {
          id: 'key',
          header: () => t('apiKeys.columns.key'),
          cell: info => {
            const apiKey = info.row.original;
            const isVisible = visibleKeys.has(apiKey.id);
            const isCopied = copied === apiKey.id;
            return (
              <span className="key-cell">
                <code>{isVisible ? apiKey.keyPrefix + '••••••••••••••••••••••••' : apiKey.keyPrefix + '••••'}</code>
                <button
                  className="icon-btn-sm"
                  onClick={() => toggleKeyVisibility(apiKey.id)}
                  title={isVisible ? 'Mask key' : 'Show prefix'}
                  aria-label={isVisible ? t('common.hideApiKey') : t('common.showApiKey')}
                >
                  {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button
                  className="icon-btn-sm"
                  onClick={() => void handleCopy(apiKey.keyPrefix, apiKey.id)}
                  title="Copy prefix"
                  aria-label="Copy key prefix"
                >
                  {isCopied ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                </button>
              </span>
            );
          },
        }),
        columnHelper.accessor('role', {
          header: () => t('apiKeys.columns.role'),
          cell: info => <span className="permission-badge">{info.getValue()}</span>,
        }),
        columnHelper.accessor('isActive', {
          header: () => t('apiKeys.columns.status'),
          cell: info => (
            <span className={`status-badge ${info.getValue() ? 'active' : 'inactive'}`}>
              {info.getValue() ? t('apiKeys.statuses.active') : t('apiKeys.statuses.revoked')}
            </span>
          ),
        }),
        columnHelper.accessor('lastUsedAt', {
          id: 'lastUsed',
          header: () => t('apiKeys.columns.lastUsed'),
          cell: info => (
            <span className="last-used">
              {info.getValue() ? new Date(info.getValue()!).toLocaleDateString() : t('common.never')}
            </span>
          ),
        }),
        columnHelper.display({
          id: 'actions',
          header: () => t('apiKeys.columns.actions'),
          cell: info => {
            const apiKey = info.row.original;
            return (
              <span className="actions-cell">
                {/* No per-row copy: the full key only exists once (post-creation modal); the row
                    only has the prefix, so a copy button here could only copy a useless fragment. */}
                {apiKey.isActive && (
                  <button
                    className="icon-btn"
                    onClick={() => setConfirmAction({ type: 'revoke', id: apiKey.id, name: apiKey.name })}
                    title={t('apiKeys.actions.revoke')}
                  >
                    <RefreshCw size={16} />
                  </button>
                )}
                <button
                  className="icon-btn danger"
                  onClick={() => setConfirmAction({ type: 'delete', id: apiKey.id, name: apiKey.name })}
                  title={t('apiKeys.actions.delete')}
                >
                  <Trash2 size={16} />
                </button>
              </span>
            );
          },
        }),
      ]),
    [visibleKeys, t],
  );

  const table = useTable({
    features,
    data: apiKeys,
    columns,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
  });

  if (loading) {
    return (
      <div
        className="api-keys-page"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="api-keys-page">
      <PageHeader
        title={t('apiKeys.title')}
        subtitle={t('apiKeys.subtitle')}
        actions={
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} />
            {t('apiKeys.createBtn')}
          </button>
        }
      />

      {apiKeysError && (
        <div className="error-banner" role="alert">
          <AlertCircle size={20} />
          <span className="error-banner-text">{t('dashboard.loadError')}</span>
        </div>
      )}

      {showModal && (
        <Modal
          open
          onClose={() => {
            setShowModal(false);
            setCreatedKey(null);
          }}
          title={createdKey ? t('apiKeys.createdTitle') : t('apiKeys.modalTitle')}
          closeLabel={t('common.close')}
          footer={
            !createdKey ? (
              <>
                <button className="btn-secondary" onClick={() => setShowModal(false)}>
                  {t('common.cancel')}
                </button>
                <button
                  className="btn-primary"
                  onClick={handleCreate}
                  disabled={createMutation.isPending || !newKey.name}
                >
                  {createMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : t('common.create')}
                </button>
              </>
            ) : undefined
          }
        >
          {createdKey ? (
            <div className="created-key-modal-body">
              <div className="security-notice-box" style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '8px', padding: '12px', marginBottom: '16px', color: '#eab308', fontSize: '0.85rem' }}>
                ⚠️ <strong>Copy your API key now.</strong> For security reasons, the full secret key cannot be shown again after closing this dialog.
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
                <code
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    background: 'var(--bg-secondary, #0f172a)',
                    color: '#22c55e',
                    border: '1px solid var(--border, #334155)',
                    borderRadius: '8px',
                    wordBreak: 'break-all',
                    fontSize: '0.9rem',
                    fontFamily: 'monospace',
                  }}
                >
                  {createdKey}
                </code>
                <button
                  className="btn-primary"
                  style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  onClick={() => void handleCopy(createdKey, 'modal')}
                >
                  {copied === 'modal' ? <Check size={16} /> : <Copy size={16} />}
                  {copied === 'modal' ? 'Copied!' : 'Copy Key'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <label htmlFor="ak-1">{t('common.name')}</label>
              <input
                id="ak-1"
                type="text"
                placeholder={t('apiKeys.namePlaceholder')}
                value={newKey.name}
                onChange={e => setNewKey({ ...newKey, name: e.target.value })}
              />
              {isAdmin && (
                <>
                  <label htmlFor="ak-2">{t('common.role')}</label>
                  <select id="ak-2" value={newKey.role} onChange={e => setNewKey({ ...newKey, role: e.target.value })}>
                    {roleNames.map(r => (
                      <option key={r} value={r}>
                        {t(`apiKeys.roles.${r}`)}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </>
          )}
        </Modal>
      )}

      <div className="api-keys-content">
        <div className="keys-table-container">
          {apiKeys.length === 0 ? (
            <div className="empty-table-state">
              <KeyRound size={48} strokeWidth={1} />
              <h3>{t('apiKeys.empty.title')}</h3>
              <p>{t('apiKeys.empty.description')}</p>
            </div>
          ) : (
            <table className="keys-table">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id} className="table-row header">
                    {headerGroup.headers.map(header => (
                      <th key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="table-row">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {isAdmin && (
          <div className="permissions-reference">
            <h3>{t('apiKeys.rolesTitle')}</h3>
            <div className="permissions-list">
              {roleNames.map(r => (
                <div key={r} className="perm-item">
                  <code>{r}</code>
                  <span>{t(`apiKeys.roleDescriptions.${r}`)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {confirmAction && (
        <Modal
          open
          onClose={() => setConfirmAction(null)}
          title={confirmAction.type === 'delete' ? t('apiKeys.confirm.deleteTitle') : t('apiKeys.confirm.revokeTitle')}
          className="confirm-modal"
          closeLabel={t('common.close')}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setConfirmAction(null)}>
                {t('common.cancel')}
              </button>
              <button className="btn-danger" onClick={confirmAndExecute}>
                {confirmAction.type === 'delete' ? t('apiKeys.confirm.delete') : t('apiKeys.confirm.revoke')}
              </button>
            </>
          }
        >
          <div className="confirm-icon-wrapper">
            <AlertTriangle size={48} className="confirm-warning-icon" />
          </div>
          <p className="confirm-message">
            <Trans
              i18nKey={
                confirmAction.type === 'delete' ? 'apiKeys.confirm.deleteMessage' : 'apiKeys.confirm.revokeMessage'
              }
              values={{ name: confirmAction.name }}
              components={{ strong: <strong /> }}
            />
          </p>
        </Modal>
      )}
    </div>
  );
}
