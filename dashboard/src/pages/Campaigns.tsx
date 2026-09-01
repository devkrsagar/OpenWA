import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Megaphone,
  Send,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  Search,
  Eye,
  Calendar,
  Layers,
  Plus,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import {
  campaignApi,
  type CampaignItem,
  type CampaignOverview,
  type CampaignDetail,
  type CampaignRecipient,
} from '../services/api';
import { useSessionsQuery } from '../hooks/queries';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../hooks/useToast';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { useNavigate } from 'react-router-dom';
import './Campaigns.css';

export function Campaigns() {
  useDocumentTitle('Campaign Analytics & Reports');
  const toast = useToast();
  const navigate = useNavigate();

  const { data: sessions = [] } = useSessionsQuery();
  const [selectedSessionId, setSelectedSessionId] = useState('');

  // Overview KPIs
  const [overview, setOverview] = useState<CampaignOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  // Campaigns list
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Report Modal
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaignDetail, setCampaignDetail] = useState<CampaignDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientStatusFilter, setRecipientStatusFilter] = useState<'ALL' | 'SENT' | 'FAILED'>('ALL');

  const loadData = useCallback(async () => {
    setLoadingOverview(true);
    setLoadingList(true);
    try {
      const [overviewData, listData] = await Promise.all([
        campaignApi.getOverview(selectedSessionId || undefined),
        campaignApi.list({
          sessionId: selectedSessionId || undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          limit: 50,
        }),
      ]);
      setOverview(overviewData);
      setCampaigns(listData.items || []);
    } catch (err) {
      toast.error('Failed to load campaign analytics');
    } finally {
      setLoadingOverview(false);
      setLoadingList(false);
    }
  }, [selectedSessionId, statusFilter, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Open Campaign Detail Report
  const openReport = async (campaign: CampaignItem) => {
    setSelectedCampaignId(campaign.id);
    setCampaignDetail(null);
    setLoadingDetail(true);
    setRecipientSearch('');
    setRecipientStatusFilter('ALL');

    try {
      const detail = await campaignApi.getDetail(campaign.id);
      setCampaignDetail(detail);
    } catch (err) {
      toast.error('Failed to load campaign details');
      setSelectedCampaignId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    if (!searchTerm.trim()) return campaigns;
    const query = searchTerm.toLowerCase();
    return campaigns.filter(
      c =>
        c.batchId.toLowerCase().includes(query) ||
        c.sessionId.toLowerCase().includes(query) ||
        c.status.toLowerCase().includes(query),
    );
  }, [campaigns, searchTerm]);

  // Filtered recipients in modal
  const filteredRecipients = useMemo(() => {
    if (!campaignDetail?.recipients) return [];
    return campaignDetail.recipients.filter((r: CampaignRecipient) => {
      const matchesSearch =
        !recipientSearch.trim() ||
        r.phone.toLowerCase().includes(recipientSearch.toLowerCase()) ||
        (r.error && r.error.toLowerCase().includes(recipientSearch.toLowerCase()));

      const matchesStatus =
        recipientStatusFilter === 'ALL' ||
        (recipientStatusFilter === 'SENT' && r.status === 'sent') ||
        (recipientStatusFilter === 'FAILED' && r.status === 'failed');

      return matchesSearch && matchesStatus;
    });
  }, [campaignDetail, recipientSearch, recipientStatusFilter]);

  // Export CSV Handler
  const handleExportCsv = (id: string, batchId: string) => {
    const apiKey = sessionStorage.getItem('openwa_api_key') || '';
    const url = campaignApi.exportCsvUrl(id);
    fetch(url, {
      headers: {
        ...(apiKey ? { 'X-API-Key': apiKey, Authorization: `Bearer ${apiKey}` } : {}),
      },
    })
      .then(res => res.blob())
      .then(blob => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `campaign-${batchId}-report.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
        toast.success('Campaign report downloaded as CSV');
      })
      .catch(() => {
        toast.error('Failed to export CSV');
      });
  };

  return (
    <div className="campaigns-page">
      <PageHeader
        title="Campaign Reports & Analytics"
        subtitle="Monitor delivery rates, recipient audit logs, and performance metrics across all broadcasts."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              className="campaign-session-select"
              value={selectedSessionId}
              onChange={e => setSelectedSessionId(e.target.value)}
            >
              <option value="">All WhatsApp Sessions</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name || s.id}
                </option>
              ))}
            </select>

            <button className="btn-secondary" onClick={() => void loadData()} title="Refresh metrics">
              <RefreshCw size={16} className={loadingList || loadingOverview ? 'animate-spin' : ''} />
            </button>

            <button className="btn-primary" onClick={() => navigate('/templates')}>
              <Plus size={16} />
              <span>Launch Broadcast</span>
            </button>
          </div>
        }
      />

      {/* KPI Cards Row */}
      <div className="campaign-kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Broadcasts</span>
            <div className="kpi-icon-wrap primary">
              <Megaphone size={18} />
            </div>
          </div>
          <div className="kpi-value">{overview?.totalCampaigns ?? 0}</div>
          <div className="kpi-subtext">
            <span>{overview?.activeCampaigns ?? 0} currently active / queued</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Recipients</span>
            <div className="kpi-icon-wrap info">
              <Send size={18} />
            </div>
          </div>
          <div className="kpi-value">{overview?.totalRecipients ?? 0}</div>
          <div className="kpi-subtext">
            <span>{overview?.totalSent ?? 0} dispatched successfully</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Delivery Success Rate</span>
            <div className="kpi-icon-wrap success">
              <CheckCircle size={18} />
            </div>
          </div>
          <div className="kpi-value-row">
            <div className="kpi-value">{overview?.overallDeliveryRate ?? 100}%</div>
            <div className="kpi-rate-badge success">
              <TrendingUp size={12} />
              <span>Optimal</span>
            </div>
          </div>
          <div className="kpi-progress-track">
            <div
              className="kpi-progress-bar success"
              style={{ width: `${overview?.overallDeliveryRate ?? 100}%` }}
            />
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Failed Dispatches</span>
            <div className="kpi-icon-wrap danger">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="kpi-value">{overview?.totalFailed ?? 0}</div>
          <div className="kpi-subtext">
            <span>Invalid numbers or blocked</span>
          </div>
        </div>
      </div>

      {/* Main Content Section */}
      <div className="campaigns-table-container">
        {/* Table Toolbar */}
        <div className="campaigns-toolbar">
          <div className="toolbar-status-tabs">
            {['ALL', 'COMPLETED', 'PROCESSING', 'FAILED', 'CANCELLED'].map(st => (
              <button
                key={st}
                className={`status-tab-btn ${statusFilter === st ? 'active' : ''}`}
                onClick={() => setStatusFilter(st)}
              >
                {st === 'ALL' ? 'All Broadcasts' : st}
              </button>
            ))}
          </div>

          <div className="campaigns-search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search by Batch ID or Session..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Data Table */}
        {filteredCampaigns.length === 0 ? (
          <div className="campaigns-empty">
            <div className="empty-icon-wrap">
              <Layers size={36} />
            </div>
            <h3>No Broadcast Campaigns Found</h3>
            <p>
              {statusFilter !== 'ALL'
                ? `No campaigns with status "${statusFilter}".`
                : 'Launch your first bulk broadcast from the Templates page to see live reporting.'}
            </p>
            <button className="btn-primary" onClick={() => navigate('/templates')}>
              <Plus size={16} />
              <span>Go to Templates & Broadcast</span>
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="campaigns-table">
              <thead>
                <tr>
                  <th>Campaign ID</th>
                  <th>Session</th>
                  <th>Delivery Progress</th>
                  <th>Status</th>
                  <th>Date Launched</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map(c => {
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="campaign-id-cell">
                          <code>{c.batchId}</code>
                        </div>
                      </td>
                      <td>
                        <div className="session-tag">
                          <span>{c.sessionId}</span>
                        </div>
                      </td>
                      <td>
                        <div className="delivery-progress-cell">
                          <div className="progress-numbers">
                            <span className="sent-count">{c.sentCount} sent</span>
                            <span className="total-count">/ {c.totalRecipients}</span>
                            {c.failedCount > 0 && <span className="failed-count">({c.failedCount} failed)</span>}
                          </div>
                          <div className="progress-bar-bg">
                            <div
                              className={`progress-bar-fill ${c.failedCount > 0 && c.sentCount === 0 ? 'failed' : 'success'}`}
                              style={{ width: `${c.deliveryRate}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`campaign-status-badge ${c.status}`}>
                          {c.status === 'processing' && <span className="pulse-dot" />}
                          {c.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div className="date-cell">
                          <Calendar size={13} />
                          <span>{c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="table-actions">
                          <button
                            className="btn-secondary btn-sm"
                            onClick={() => void openReport(c)}
                            title="View Recipient Delivery Report"
                          >
                            <Eye size={14} />
                            <span>Report</span>
                          </button>
                          <button
                            className="btn-secondary btn-sm icon-only"
                            onClick={() => handleExportCsv(c.id, c.batchId)}
                            title="Download CSV Report"
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detailed Campaign Report Modal */}
      {selectedCampaignId && (
        <Modal
          open
          onClose={() => setSelectedCampaignId(null)}
          title={`📊 Campaign Report: ${campaignDetail?.batchId || selectedCampaignId}`}
          closeLabel="Close"
          className="campaign-report-modal"
          footer={
            <>
              <button className="btn-secondary" onClick={() => setSelectedCampaignId(null)}>
                Close
              </button>
              {campaignDetail && (
                <button
                  className="btn-primary"
                  onClick={() => handleExportCsv(campaignDetail.id, campaignDetail.batchId)}
                >
                  <Download size={16} />
                  <span>Export CSV Report</span>
                </button>
              )}
            </>
          }
        >
          {loadingDetail ? (
            <div className="report-loading">
              <RefreshCw size={28} className="animate-spin text-muted" />
              <p>Loading recipient logs and delivery status...</p>
            </div>
          ) : !campaignDetail ? (
            <div className="report-error">Failed to load campaign data.</div>
          ) : (
            <div className="report-modal-content">
              {/* Summary Stats Strip */}
              <div className="report-summary-strip">
                <div className="report-stat-box">
                  <span className="stat-label">Total Recipients</span>
                  <span className="stat-num">{campaignDetail.totalRecipients}</span>
                </div>
                <div className="report-stat-box">
                  <span className="stat-label">Delivered / Sent</span>
                  <span className="stat-num text-success">{campaignDetail.sentCount}</span>
                </div>
                <div className="report-stat-box">
                  <span className="stat-label">Failed</span>
                  <span className="stat-num text-danger">{campaignDetail.failedCount}</span>
                </div>
                <div className="report-stat-box">
                  <span className="stat-label">Success Rate</span>
                  <span className="stat-num text-primary">{campaignDetail.deliveryRate}%</span>
                </div>
              </div>

              {/* Recipient Filter Toolbar */}
              <div className="report-recipients-toolbar">
                <div className="report-filter-tabs">
                  <button
                    className={`filter-btn ${recipientStatusFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setRecipientStatusFilter('ALL')}
                  >
                    All ({campaignDetail.recipients?.length || 0})
                  </button>
                  <button
                    className={`filter-btn ${recipientStatusFilter === 'SENT' ? 'active' : ''}`}
                    onClick={() => setRecipientStatusFilter('SENT')}
                  >
                    Sent ({campaignDetail.sentCount})
                  </button>
                  <button
                    className={`filter-btn ${recipientStatusFilter === 'FAILED' ? 'active' : ''}`}
                    onClick={() => setRecipientStatusFilter('FAILED')}
                  >
                    Failed ({campaignDetail.failedCount})
                  </button>
                </div>

                <div className="report-search-input">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Search phone or error..."
                    value={recipientSearch}
                    onChange={e => setRecipientSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Recipient Audit Log Table */}
              <div className="report-table-scroll">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th>Recipient Phone</th>
                      <th>Status</th>
                      <th>Message ID</th>
                      <th>Sent At</th>
                      <th>Error / Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecipients.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                          No recipients match your filter.
                        </td>
                      </tr>
                    ) : (
                      filteredRecipients.map(r => (
                        <tr key={r.index}>
                          <td>{r.index}</td>
                          <td>
                            <code>{r.phone}</code>
                          </td>
                          <td>
                            <span className={`recipient-status-pill ${r.status}`}>
                              {r.status === 'sent' && <CheckCircle size={12} />}
                              {r.status === 'failed' && <XCircle size={12} />}
                              {r.status.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            {r.messageId ? (
                              <code className="msg-id-text">{r.messageId}</code>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                              {r.sentAt ? new Date(r.sentAt).toLocaleTimeString() : '—'}
                            </span>
                          </td>
                          <td>
                            {r.error ? (
                              <span className="error-detail-text">{r.error}</span>
                            ) : (
                              <span className="text-muted">None (OK)</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
