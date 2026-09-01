import { useState, useEffect } from 'react';
import {
  Search,
  Shield,
  User as UserIcon,
  CheckCircle,
  XCircle,
  Trash2,
  Edit,
  Loader2,
  RefreshCw,
  Sparkles,
  Eye,
  Smartphone,
  Key,
  Radio,
  Clock,
  Check,
  X,
  CreditCard,
  Settings,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import {
  adminUsersApi,
  billingApi,
  adminBillingApi,
  type UserProfile,
  type Plan,
  type UserOverview,
  type SubscriptionRequest,
  type AdminGatewaySettings,
} from '../services/api';
import './Users.css';

export function Users() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [requests, setRequests] = useState<SubscriptionRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'requests'>('users');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit Plan modal state
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editPlanId, setEditPlanId] = useState('starter');
  const [editBillingCycle, setEditBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);

  // User Profile & Resources Overview modal state
  const [overviewUser, setOverviewUser] = useState<UserOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  // Gateway Settings modal state
  const [gatewaySettings, setGatewaySettings] = useState<AdminGatewaySettings | null>(null);
  const [isGatewayModalOpen, setIsGatewayModalOpen] = useState(false);
  const [gwEnabled, setGwEnabled] = useState(false);
  const [gwKeyId, setGwKeyId] = useState('');
  const [gwKeySecret, setGwKeySecret] = useState('');
  const [isSavingGateway, setIsSavingGateway] = useState(false);

  const fetchUsersAndPlans = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [usersData, plansData, reqsData] = await Promise.all([
        adminUsersApi.list(),
        billingApi.getPlans(),
        adminBillingApi.listRequests().catch(() => []),
      ]);
      setUsers(usersData || []);
      setPlans(plansData || []);
      setRequests(reqsData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsersAndPlans();
  }, []);

  const handleOpenGatewaySettings = async () => {
    try {
      const settings = await adminBillingApi.getGatewaySettings();
      setGatewaySettings(settings);
      setGwEnabled(settings.isEnabled);
      setGwKeyId(settings.keyId || '');
      setGwKeySecret('');
      setIsGatewayModalOpen(true);
    } catch (err: any) {
      alert(`Error loading gateway settings: ${err.message}`);
    }
  };

  const handleSaveGatewaySettings = async () => {
    setIsSavingGateway(true);
    try {
      await adminBillingApi.updateGatewaySettings({
        isEnabled: gwEnabled,
        keyId: gwKeyId,
        keySecret: gwKeySecret || undefined,
      });
      setIsGatewayModalOpen(false);
      alert('Razorpay gateway settings saved successfully!');
    } catch (err: any) {
      alert(`Error saving gateway settings: ${err.message}`);
    } finally {
      setIsSavingGateway(false);
    }
  };

  const handleApproveRequest = async (reqId: string) => {
    try {
      await adminBillingApi.approveRequest(reqId);
      await fetchUsersAndPlans();
    } catch (err: any) {
      alert(`Error approving request: ${err.message}`);
    }
  };

  const handleRejectRequest = async (reqId: string) => {
    const reason = prompt('Enter rejection reason (optional):');
    try {
      await adminBillingApi.rejectRequest(reqId, reason || undefined);
      await fetchUsersAndPlans();
    } catch (err: any) {
      alert(`Error rejecting request: ${err.message}`);
    }
  };

  const handleOpenOverview = async (user: UserProfile) => {
    setLoadingOverview(true);
    try {
      const overview = await adminUsersApi.getOverview(user.id);
      setOverviewUser(overview);
    } catch (err: any) {
      alert(`Error loading user overview: ${err.message || String(err)}`);
    } finally {
      setLoadingOverview(false);
    }
  };

  const handleToggleStatus = async (user: UserProfile) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      await adminUsersApi.updateStatus(user.id, newStatus);
      setUsers(users.map(u => (u.id === user.id ? { ...u, status: newStatus } : u)));
    } catch (err: any) {
      alert(`Error updating user status: ${err.message}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
    try {
      await adminUsersApi.delete(userId);
      setUsers(users.filter(u => u.id !== userId));
    } catch (err: any) {
      alert(`Error deleting user: ${err.message}`);
    }
  };

  const handleSavePlan = async () => {
    if (!selectedUser) return;
    setIsUpdatingPlan(true);
    try {
      await adminUsersApi.updatePlan(selectedUser.id, editPlanId, editBillingCycle);
      setSelectedUser(null);
      await fetchUsersAndPlans();
    } catch (err: any) {
      alert(`Error updating plan: ${err.message}`);
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const filteredUsers = users.filter(
    u =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="users-page">
      <PageHeader
        title="User & Subscription Management"
        subtitle="Manage registered users, verification status, devices, and subscription tiers"
        actions={
          <div className="header-action-group">
            <button className="gateway-config-btn" onClick={handleOpenGatewaySettings}>
              <Settings size={16} /> Razorpay Gateway
            </button>
            <button className="refresh-btn" onClick={fetchUsersAndPlans} disabled={isLoading}>
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        }
      />

      <div className="users-tab-nav">
        <button
          className={`tab-nav-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <UserIcon size={16} /> Registered Users ({users.length})
        </button>
        <button
          className={`tab-nav-btn ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          <CreditCard size={16} /> Subscription Requests ({requests.length})
          {pendingCount > 0 && <span className="pending-badge-counter">{pendingCount} Pending</span>}
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="users-toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search by name, email, or role..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      {error && <div className="users-error-banner">{error}</div>}

      {activeTab === 'requests' ? (
        <div className="users-table-card">
          {isLoading ? (
            <div className="users-loading">
              <Loader2 className="animate-spin" size={32} />
              <p>Loading subscription requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="users-empty">
              <CreditCard size={48} className="empty-icon" />
              <p>No subscription requests found.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Requested Plan</th>
                    <th>Billing Cycle</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(req => (
                    <tr key={req.id}>
                      <td>
                        <div className="user-cell">
                          <div className="user-avatar">
                            {(req.user?.name || req.userId).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="user-name">{req.user?.name || 'Unknown User'}</div>
                            <div className="user-email">{req.user?.email || req.userId}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="plan-tag">
                          <Sparkles size={14} />
                          {req.plan?.name || req.planId}
                        </div>
                      </td>
                      <td>
                        <span className="cycle-text capitalize">{req.billingCycle}</span>
                      </td>
                      <td>
                        <strong>₹{req.amount.toLocaleString('en-IN')}</strong>
                      </td>
                      <td>
                        <span className="method-tag uppercase">{req.paymentMethod}</span>
                      </td>
                      <td>
                        <span className={`status-badge ${req.status}`}>
                          {req.status === 'pending' && <Clock size={12} />}
                          {req.status === 'approved' && <Check size={12} />}
                          {req.status === 'rejected' && <X size={12} />}
                          {req.status}
                        </span>
                      </td>
                      <td>
                        <span className="date-text">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {req.status === 'pending' ? (
                          <div className="action-buttons">
                            <button
                              className="btn-action approve"
                              title="Approve Subscription Request"
                              onClick={() => handleApproveRequest(req.id)}
                            >
                              <Check size={16} /> Approve
                            </button>
                            <button
                              className="btn-action reject"
                              title="Reject Subscription Request"
                              onClick={() => handleRejectRequest(req.id)}
                            >
                              <X size={16} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span className="status-resolved-text">Processed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="users-table-card">
        {isLoading ? (
          <div className="users-loading">
            <Loader2 className="animate-spin" size={32} />
            <p>Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="users-empty">
            <UserIcon size={48} className="empty-icon" />
            <p>No registered users found.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Verified</th>
                  <th>Status</th>
                  <th>Subscription Plan</th>
                  <th>Cycle</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => {
                  const currentPlan = user.subscription?.plan || plans.find(p => p.id === user.subscription?.planId);
                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="user-cell">
                          <div className="user-avatar">{user.name.charAt(0).toUpperCase()}</div>
                          <div>
                            <div className="user-name">{user.name}</div>
                            <div className="user-email">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`role-badge ${user.role}`}>
                          {user.role === 'admin' ? <Shield size={12} /> : <UserIcon size={12} />}
                          {user.role}
                        </span>
                      </td>
                      <td>
                        {user.isEmailVerified ? (
                          <span className="badge-verified">
                            <CheckCircle size={14} /> Verified
                          </span>
                        ) : (
                          <span className="badge-unverified">
                            <XCircle size={14} /> Pending
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${user.status}`}>
                          {user.status === 'active' ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td>
                        <div className="plan-tag">
                          <Sparkles size={14} />
                          {currentPlan?.name || 'Free Trial'}
                        </div>
                      </td>
                      <td>
                        <span className="cycle-text">
                          {user.subscription?.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-buttons">
                          <button
                            className="btn-action view"
                            title="View User Profile & Resources (Sessions, API Keys)"
                            onClick={() => handleOpenOverview(user)}
                            disabled={loadingOverview}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            className="btn-action edit"
                            title="Edit Plan"
                            onClick={() => {
                              setSelectedUser(user);
                              setEditPlanId(user.subscription?.planId || 'starter');
                              setEditBillingCycle(user.subscription?.billingCycle || 'monthly');
                            }}
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            className={`btn-action status ${user.status === 'active' ? 'suspend' : 'activate'}`}
                            title={user.status === 'active' ? 'Suspend Account' : 'Activate Account'}
                            onClick={() => handleToggleStatus(user)}
                          >
                            {user.status === 'active' ? 'Suspend' : 'Activate'}
                          </button>
                          <button
                            className="btn-action delete"
                            title="Delete User"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            <Trash2 size={16} />
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
      )}      {/* User Profile & Resources Overview Modal */}
      {overviewUser && (
        <Modal
          title={`User Profile & Resources: ${overviewUser.user.name}`}
          open={true}
          onClose={() => setOverviewUser(null)}
          className="user-overview-modal"
          footer={
            <button className="btn-secondary" onClick={() => setOverviewUser(null)}>
              Close
            </button>
          }
        >
          <div className="user-overview-container">
            {/* Profile & Subscription Summary Card */}
            <div className="overview-section profile-card">
              <div className="profile-header-summary">
                <div className="user-avatar large">{overviewUser.user.name.charAt(0).toUpperCase()}</div>
                <div className="profile-info-block">
                  <h3 className="overview-user-title">{overviewUser.user.name}</h3>
                  <p className="overview-user-subtitle">{overviewUser.user.email}</p>
                </div>
                <div className="overview-badges">
                  <span className={`role-badge ${overviewUser.user.role}`}>
                    {overviewUser.user.role === 'admin' ? <Shield size={12} /> : <UserIcon size={12} />}
                    {overviewUser.user.role}
                  </span>
                  <span className={`status-badge ${overviewUser.user.status}`}>
                    {overviewUser.user.status === 'active' ? 'Active' : 'Suspended'}
                  </span>
                </div>
              </div>

              <div className="subscription-summary-box">
                <div className="sub-detail-item">
                  <span className="label">Current Plan</span>
                  <span className="value plan-name">
                    <Sparkles size={14} />
                    {overviewUser.user.subscription?.plan?.name || 'Free Trial'}
                  </span>
                </div>
                <div className="sub-detail-item">
                  <span className="label">Billing Cycle</span>
                  <span className="value">
                    {overviewUser.user.subscription?.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}
                  </span>
                </div>
                <div className="sub-detail-item">
                  <span className="label">Max Sessions Allowed</span>
                  <span className="value">
                    {overviewUser.user.subscription?.plan?.maxSessions ?? 1} Sessions
                  </span>
                </div>
                <div className="sub-detail-item">
                  <span className="label">Messages Limit</span>
                  <span className="value">
                    {overviewUser.user.subscription?.plan?.maxMessagesPerMonth
                      ? `${overviewUser.user.subscription.plan.maxMessagesPerMonth.toLocaleString()} / mo`
                      : '200 / mo'}
                  </span>
                </div>
              </div>
            </div>

            {/* WhatsApp Sessions & Connected Devices */}
            <div className="overview-section">
              <div className="section-title-row">
                <div className="section-icon-badge whatsapp">
                  <Smartphone size={16} />
                </div>
                <h4>WhatsApp Sessions & Connected Devices ({overviewUser.sessions.length})</h4>
              </div>

              {overviewUser.sessions.length === 0 ? (
                <div className="overview-empty-box">No WhatsApp sessions created by this user yet.</div>
              ) : (
                <div className="overview-items-grid">
                  {overviewUser.sessions.map(s => (
                    <div key={s.id} className="session-item-card">
                      <div className="session-item-header">
                        <span className="session-item-name">{s.name}</span>
                        <span className={`status-badge ${s.status === 'ready' || s.status === 'authenticated' ? 'active' : s.status === 'created' ? 'role' : 'suspended'}`}>
                          <Radio size={11} className={s.status === 'ready' || s.status === 'authenticated' ? 'animate-pulse' : ''} />
                          {s.status}
                        </span>
                      </div>
                      <div className="session-item-details">
                        <div className="detail-row">
                          <span className="detail-label">Phone:</span>
                          <span className="detail-val">{s.phone ? `+${s.phone}` : 'Not connected'}</span>
                        </div>
                        {s.pushName && (
                          <div className="detail-row">
                            <span className="detail-label">WhatsApp Name:</span>
                            <span className="detail-val">{s.pushName}</span>
                          </div>
                        )}
                        <div className="detail-row">
                          <span className="detail-label">Session ID:</span>
                          <code className="code-snippet">{s.id}</code>
                        </div>
                        {s.connectedAt && (
                          <div className="detail-row">
                            <span className="detail-label">Connected:</span>
                            <span className="detail-val">{new Date(s.connectedAt).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* User API Keys */}
            <div className="overview-section">
              <div className="section-title-row">
                <div className="section-icon-badge apikey">
                  <Key size={16} />
                </div>
                <h4>API Keys ({overviewUser.apiKeys.length})</h4>
              </div>

              {overviewUser.apiKeys.length === 0 ? (
                <div className="overview-empty-box">No API keys created by this user yet.</div>
              ) : (
                <div className="api-keys-list">
                  {overviewUser.apiKeys.map(k => (
                    <div key={k.id} className="api-key-item-row">
                      <div className="key-main-info">
                        <div className="key-item-name">{k.name}</div>
                        <div className="key-item-prefix">
                          Prefix: <code>{k.keyPrefix}...</code>
                        </div>
                      </div>
                      <div className="key-item-meta">
                        <span className="key-usage">
                          <Clock size={12} /> {k.usageCount} calls
                        </span>
                        <span className={`status-badge ${k.isActive ? 'active' : 'suspended'}`}>
                          {k.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Plan Modal */}
      {selectedUser && (
        <Modal
          title={`Assign Plan - ${selectedUser.name}`}
          open={true}
          onClose={() => setSelectedUser(null)}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setSelectedUser(null)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSavePlan} disabled={isUpdatingPlan}>
                {isUpdatingPlan ? <Loader2 className="animate-spin" size={16} /> : 'Save Subscription'}
              </button>
            </>
          }
        >
          <div className="plan-edit-modal-form">
            <div className="form-group">
              <label>Select Plan Tier</label>
              <select
                value={editPlanId}
                onChange={e => setEditPlanId(e.target.value)}
                className="select-input"
              >
                {plans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.maxSessions} Sessions, ₹{p.monthlyPrice.toLocaleString('en-IN')}/mo)
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Billing Cycle</label>
              <select
                value={editBillingCycle}
                onChange={e => setEditBillingCycle(e.target.value as any)}
                className="select-input"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly (Annual)</option>
              </select>
            </div>
          </div>
        </Modal>
      )}

      {/* Razorpay Payment Gateway Configuration Modal */}
      {isGatewayModalOpen && (
        <Modal
          title="Razorpay Payment Gateway Settings"
          open={true}
          onClose={() => setIsGatewayModalOpen(false)}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setIsGatewayModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveGatewaySettings}
                disabled={isSavingGateway}
              >
                {isSavingGateway ? <Loader2 className="animate-spin" size={16} /> : 'Save Settings'}
              </button>
            </>
          }
        >
          <div className="gateway-modal-container">
            <div className="gateway-status-switch-card">
              <div className="switch-info">
                <div className="switch-title-row">
                  <span className="switch-title">Razorpay Online Payment</span>
                  <span className={`status-indicator-badge ${gwEnabled ? 'online' : 'offline'}`}>
                    {gwEnabled ? 'ACTIVE / ONLINE' : 'DISABLED (MANUAL MODE)'}
                  </span>
                </div>
                <p className="switch-description">
                  {gwEnabled
                    ? 'Users will see the Razorpay popup to pay online instantly with UPI, Cards, and Netbanking.'
                    : 'When disabled, upgrade requests go to Admin for offline / manual review and 1-click approval.'}
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={gwEnabled}
                  onChange={e => setGwEnabled(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="gateway-form-fields">
              <div className="form-group">
                <label>Razorpay Key ID</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="rzp_live_xxxxxxxx or rzp_test_xxxxxxxx"
                  value={gwKeyId}
                  onChange={e => setGwKeyId(e.target.value)}
                />
                <span className="field-hint">From Razorpay Dashboard → Settings → API Keys</span>
              </div>

              <div className="form-group">
                <label>Razorpay Key Secret</label>
                <input
                  type="password"
                  className="text-input"
                  placeholder={
                    gatewaySettings?.hasSecret
                      ? gatewaySettings.keySecretMasked || '••••••••••••••••'
                      : 'Enter Razorpay Key Secret'
                  }
                  value={gwKeySecret}
                  onChange={e => setGwKeySecret(e.target.value)}
                />
                <span className="field-hint">
                  {gatewaySettings?.hasSecret
                    ? '✓ Secret is securely stored. Enter a new value only if you want to replace it.'
                    : 'Key Secret is required to verify webhook & signature authenticity.'}
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
