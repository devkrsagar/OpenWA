import { useState, useEffect } from 'react';
import {
  Check,
  Zap,
  Sparkles,
  Loader2,
  Calendar,
  Layers,
  ArrowRight,
  RefreshCw,
  Clock,
  CreditCard,
  Send,
  AlertCircle,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import {
  billingApi,
  userAuthApi,
  type Plan,
  type GatewayConfig,
  type SubscriptionRequest,
  type UserProfile,
} from '../services/api';
import './Subscription.css';

function loadRazorpayScript(): Promise<boolean> {
  return new Promise(resolve => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function Subscription() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSub, setCurrentSub] = useState<any>(null);
  const [gatewayConfig, setGatewayConfig] = useState<GatewayConfig | null>(null);
  const [myRequests, setMyRequests] = useState<SubscriptionRequest[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Manual request modal
  const [manualModalPlan, setManualModalPlan] = useState<Plan | null>(null);
  const [manualNotes, setManualNotes] = useState('');

  const fetchSubscriptionData = async () => {
    setIsLoading(true);
    try {
      const [plansData, subData, configData, reqsData, userData] = await Promise.all([
        billingApi.getPlans(),
        billingApi.getMySubscription(),
        billingApi.getGatewayConfig().catch(() => ({ razorpayActive: false, keyId: null })),
        billingApi.getMyRequests().catch(() => []),
        userAuthApi.getMe().catch(() => null),
      ]);
      const sortedPlans = (plansData || []).slice().sort((a, b) => a.monthlyPrice - b.monthlyPrice);
      setPlans(sortedPlans);
      setCurrentSub(subData);
      setGatewayConfig(configData);
      setMyRequests(reqsData || []);
      setUser(userData);
      if (subData?.billingCycle) {
        setBillingCycle(subData.billingCycle);
      }
    } catch (err) {
      console.error('Failed to load subscription info:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchSubscriptionData();
  }, []);

  const handleAction = async (plan: Plan, isRenew: boolean = false) => {
    setErrorMsg('');
    setSuccessMsg('');

    // If free plan, subscribe directly
    if (plan.id === 'free') {
      setIsProcessing(true);
      try {
        const updated = await billingApi.subscribe('free', 'monthly');
        setCurrentSub(updated);
        setSuccessMsg('Successfully switched to Free Plan!');
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to switch plan');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Check if Razorpay gateway is active
    if (gatewayConfig?.razorpayActive) {
      setIsProcessing(true);
      try {
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) {
          throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
        }

        const order = await billingApi.createRazorpayOrder(plan.id, billingCycle);

        const options = {
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: 'OpenWA Gateway',
          description: `${isRenew ? 'Renewal' : 'Upgrade'}: ${order.planName} (${billingCycle})`,
          order_id: order.orderId,
          prefill: {
            name: user?.name || '',
            email: user?.email || '',
          },
          theme: {
            color: '#22c55e',
          },
          handler: async function (response: any) {
            try {
              setIsProcessing(true);
              const verifyRes = await billingApi.verifyRazorpayPayment({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                planId: plan.id,
                billingCycle,
              });
              setCurrentSub(verifyRes.subscription);
              setSuccessMsg(`Payment Successful! Your plan is now ${plan.name}.`);
              await fetchSubscriptionData();
            } catch (vErr: any) {
              setErrorMsg(`Payment verification failed: ${vErr.message}`);
            } finally {
              setIsProcessing(false);
            }
          },
          modal: {
            ondismiss: function () {
              setIsProcessing(false);
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } catch (err: any) {
        setErrorMsg(err.message || 'Payment initiation failed');
        setIsProcessing(false);
      }
    } else {
      // Razorpay is not active -> open Manual Request Modal
      setManualModalPlan(plan);
    }
  };

  const handleSendManualRequest = async () => {
    if (!manualModalPlan) return;
    setIsProcessing(true);
    setErrorMsg('');
    try {
      await billingApi.submitManualRequest({
        planId: manualModalPlan.id,
        billingCycle,
        notes: manualNotes,
      });
      setManualModalPlan(null);
      setManualNotes('');
      setSuccessMsg('Subscription request submitted! Admin will approve it shortly.');
      await fetchSubscriptionData();
    } catch (err: any) {
      alert(`Error submitting request: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const activePlanId = currentSub?.planId || currentSub?.plan?.id || 'free';
  const pendingRequest = myRequests.find(r => r.status === 'pending');

  return (
    <div className="subscription-page">
      <PageHeader
        title="Subscription & Billing"
        subtitle="Manage your gateway plan, session limits, and billing cycle"
        actions={
          <button className="refresh-btn" onClick={fetchSubscriptionData} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      {successMsg && <div className="sub-success-banner">{successMsg}</div>}
      {errorMsg && (
        <div className="sub-error-banner">
          <AlertCircle size={18} /> {errorMsg}
        </div>
      )}

      {/* Pending Request Banner if any */}
      {pendingRequest && (
        <div className="sub-pending-banner">
          <Clock size={18} className="animate-pulse text-amber-400" />
          <div className="pending-text">
            <strong>Subscription Request Pending Admin Approval:</strong> Requested plan{' '}
            <code>{pendingRequest.plan?.name || pendingRequest.planId}</code> (
            {pendingRequest.billingCycle}) for ₹{pendingRequest.amount.toLocaleString('en-IN')}.
          </div>
        </div>
      )}

      {/* Current Active Plan Overview Card */}
      {currentSub && (
        <div className="current-plan-card">
          <div className="current-plan-info">
            <div className="current-badge">
              <Sparkles size={16} /> Current Subscription
            </div>
            <h2 className="current-plan-name">{currentSub.plan?.name || 'Free Plan'}</h2>
            <div className="current-meta">
              <span>
                <Layers size={15} /> Up to <strong>{currentSub.plan?.maxSessions || 1} WhatsApp Sessions</strong>
              </span>
              <span>
                <Zap size={15} /> <strong>{(currentSub.plan?.maxMessagesPerMonth || 1000).toLocaleString()}</strong> Messages / Mo
              </span>
              {currentSub.endDate && (
                <span>
                  <Calendar size={15} /> Renews / Expires on{' '}
                  <strong>{new Date(currentSub.endDate).toLocaleDateString()}</strong>
                </span>
              )}
            </div>
          </div>
          <div className="current-plan-actions-box">
            <div className="current-plan-status">
              <span className={`status-pill ${currentSub.status || 'active'}`}>
                {currentSub.status?.toUpperCase() || 'ACTIVE'}
              </span>
            </div>
            {currentSub.plan?.id !== 'free' && (
              <button
                className="btn-renew"
                disabled={isProcessing}
                onClick={() => handleAction(currentSub.plan, true)}
              >
                <RefreshCw size={14} /> Renew Plan
              </button>
            )}
          </div>
        </div>
      )}

      {/* Billing Cycle Toggle Switch */}
      <div className="cycle-toggle-wrapper">
        <div className="cycle-toggle">
          <button
            type="button"
            className={`cycle-btn ${billingCycle === 'monthly' ? 'active' : ''}`}
            onClick={() => setBillingCycle('monthly')}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            className={`cycle-btn ${billingCycle === 'yearly' ? 'active' : ''}`}
            onClick={() => setBillingCycle('yearly')}
          >
            Yearly Billing
            <span className="save-badge">Save 20%</span>
          </button>
        </div>
      </div>

      {/* Plans Pricing Grid */}
      {isLoading ? (
        <div className="sub-loading">
          <Loader2 className="animate-spin" size={32} />
          <p>Loading available plans...</p>
        </div>
      ) : (
        <div className="pricing-grid">
          {plans.map(plan => {
            const isCurrent = activePlanId === plan.id;
            const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
            const isPopular = plan.id === 'pro';

            return (
              <div
                key={plan.id}
                className={`pricing-card ${isPopular ? 'popular' : ''} ${isCurrent ? 'current' : ''}`}
              >
                {isPopular && <div className="popular-badge">Most Popular</div>}

                <h3 className="plan-title">{plan.name}</h3>
                <p className="plan-desc">{plan.description}</p>

                <div className="plan-price-block">
                  <span className="currency">₹</span>
                  <span className="price-number">{price.toLocaleString('en-IN')}</span>
                  <span className="period">
                    {plan.id === 'free' ? '/ 7 days' : `/${billingCycle === 'yearly' ? 'yr' : 'mo'}`}
                  </span>
                </div>

                <div className="plan-limits">
                  <div className="limit-item">
                    <strong>{plan.maxSessions}</strong> WhatsApp {plan.maxSessions === 1 ? 'Number' : 'Numbers'}
                  </div>
                  <div className="limit-item">
                    <strong>{plan.maxMessagesPerMonth.toLocaleString()}</strong> Messages / Month
                  </div>
                  <div className="limit-item">
                    <strong>
                      {plan.maxDripSequences === undefined || plan.maxDripSequences === 0
                        ? 'No'
                        : plan.maxDripSequences === -1
                        ? 'Unlimited'
                        : plan.maxDripSequences}
                    </strong>{' '}
                    Drip {plan.maxDripSequences === 1 ? 'Sequence' : 'Sequences'}
                  </div>
                </div>

                <ul className="plan-features">
                  {(plan.features || []).map((feat, idx) => (
                    <li key={idx}>
                      <Check size={16} className="feature-check" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className={`plan-action-btn ${isCurrent ? 'current-btn' : isPopular ? 'primary-btn' : 'secondary-btn'}`}
                  disabled={isCurrent || isProcessing}
                  onClick={() => handleAction(plan, false)}
                >
                  {isProcessing ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : isCurrent ? (
                    'Current Plan'
                  ) : gatewayConfig?.razorpayActive ? (
                    <>
                      <CreditCard size={16} /> Pay & Upgrade <ArrowRight size={16} />
                    </>
                  ) : (
                    <>
                      <Send size={16} /> Request Upgrade <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Request Modal when Gateway is not active */}
      {manualModalPlan && (
        <Modal
          title={`Upgrade Request: ${manualModalPlan.name}`}
          open={true}
          onClose={() => setManualModalPlan(null)}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setManualModalPlan(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSendManualRequest}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="animate-spin" size={16} /> : 'Submit Request'}
              </button>
            </>
          }
        >
          <div className="manual-request-modal">
            <div className="manual-request-info">
              <p>
                Online instant payment gateway is currently in manual verification mode. Please submit your
                upgrade request. Once submitted, Admin will verify and activate your subscription.
              </p>
              <div className="request-summary-card">
                <div>
                  <strong>Plan:</strong> {manualModalPlan.name}
                </div>
                <div>
                  <strong>Billing Cycle:</strong>{' '}
                  <span className="capitalize">{billingCycle}</span>
                </div>
                <div>
                  <strong>Amount Payable:</strong> ₹
                  {(billingCycle === 'yearly'
                    ? manualModalPlan.yearlyPrice
                    : manualModalPlan.monthlyPrice
                  ).toLocaleString('en-IN')}
                </div>
                <div>
                  <strong>Sessions Allowed:</strong> {manualModalPlan.maxSessions} WhatsApp Sessions
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Payment Reference / UTR / Remarks (Optional)</label>
              <textarea
                className="text-input"
                rows={3}
                placeholder="Enter Transaction ID, UPI UTR, or any notes for the Admin..."
                value={manualNotes}
                onChange={e => setManualNotes(e.target.value)}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
