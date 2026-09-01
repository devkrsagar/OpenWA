import { Injectable, OnModuleInit, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Plan } from './entities/plan.entity';
import { Subscription, SubscriptionStatus, BillingCycle } from './entities/subscription.entity';
import { SubscriptionRequest, RequestStatus, PaymentMethod } from './entities/subscription-request.entity';
import { GatewaySetting } from './entities/gateway-setting.entity';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class BillingService implements OnModuleInit {
  constructor(
    @InjectRepository(Plan, 'main')
    private readonly planRepo: Repository<Plan>,
    @InjectRepository(Subscription, 'main')
    private readonly subRepo: Repository<Subscription>,
    @InjectRepository(SubscriptionRequest, 'main')
    private readonly requestRepo: Repository<SubscriptionRequest>,
    @InjectRepository(GatewaySetting, 'main')
    private readonly gatewayRepo: Repository<GatewaySetting>,
    @InjectRepository(User, 'main')
    private readonly userRepo: Repository<User>,
  ) {}

  async onModuleInit() {
    await this.seedDefaultPlans();
  }

  async seedDefaultPlans() {
    const defaultPlans: Partial<Plan>[] = [
      {
        id: 'free',
        name: 'Free Trial',
        description: '7-Day Free Trial to explore OpenWA WhatsApp gateway capabilities',
        monthlyPrice: 0,
        yearlyPrice: 0,
        maxSessions: 1,
        maxMessagesPerMonth: 200,
        maxDripSequences: 1,
        features: [
          '7 Days Full Access',
          '1 WhatsApp Session',
          '200 Messages / Month',
          '💧 1 Drip Campaign Sequence',
          'Live Chat Hub & Multi-Media',
          'Basic Webhooks Support',
          'REST API Access',
        ],
        isActive: true,
      },
      {
        id: 'basic',
        name: 'Basic Plan',
        description: 'Essential WhatsApp gateway for messaging & broadcasts without AI/Automations',
        monthlyPrice: 349,
        yearlyPrice: 3350, // ~20% discount (approx 279/mo)
        maxSessions: 1,
        maxMessagesPerMonth: 5000,
        maxDripSequences: 0,
        features: [
          '1 WhatsApp Session',
          '5,000 Messages / Month',
          'Live Web Chat Hub (1-on-1 & Group Chats)',
          'Contact Book & Audience Segmentation Tags',
          'Message Templates & Bulk Broadcasts',
          'Campaign Analytics & Delivery Reports',
          'REST API & Event Webhooks Support',
          '❌ Automation Rules, Drip Sequences, AI Bot & E-Commerce excluded',
        ],
        isActive: true,
      },
      {
        id: 'starter',
        name: 'Starter Plan',
        description: 'Ideal for small businesses with rule-based auto-replies & scheduled broadcasts',
        monthlyPrice: 749,
        yearlyPrice: 7190, // 20% discount
        maxSessions: 2,
        maxMessagesPerMonth: 15000,
        maxDripSequences: 3,
        features: [
          '2 WhatsApp Sessions',
          '15,000 Messages / Month',
          'All Basic Features Included',
          '⚡ Automation Rules (Welcome & Away Messages)',
          '⏰ Scheduled Broadcasts (Future Date/Time Campaigns)',
          '💧 3 Multi-Step Drip Sequences',
          'Keyword Auto-Replies & Cooldown Anti-Spam',
          'Contact Book with CSV Bulk Import / Export',
          'Campaign Performance Reports & CSV Export',
          'Standard Support',
        ],
        isActive: true,
      },
      {
        id: 'pro',
        name: 'Pro Business',
        description: 'High-throughput automation with Drip Sequences, AI Bot & E-Commerce Webhooks',
        monthlyPrice: 1999,
        yearlyPrice: 19190,
        maxSessions: 5,
        maxMessagesPerMonth: 60000,
        maxDripSequences: 25,
        features: [
          '5 WhatsApp Sessions',
          '60,000 Messages / Month',
          'All Starter Features Included',
          '💧 25 Automated Drip Sequences (Tag-Triggered)',
          '🤖 AI Chatbot Engine (OpenAI GPT-4o, Gemini, Claude)',
          '🛒 E-Commerce & CRM Webhooks (Shopify, WooCommerce, Stripe)',
          'High Priority Message Queue & Webhooks',
          'Live Chatbot Sandbox Simulator',
          'Priority Support',
        ],
        isActive: true,
      },
      {
        id: 'enterprise',
        name: 'Enterprise Scale',
        description: 'Dedicated infrastructure with high session limits & custom integrations',
        monthlyPrice: 4999,
        yearlyPrice: 47990,
        maxSessions: 20,
        maxMessagesPerMonth: 300000,
        maxDripSequences: -1, // Unlimited
        features: [
          '20 WhatsApp Sessions',
          '300,000 Messages / Month',
          'All Pro Features Included',
          '💧 Unlimited Drip Sequences & Scheduled Campaigns',
          'Unlimited AI Chatbot Turns & Custom Endpoint / Ollama',
          'Full E-Commerce Webhook Hub with Custom Ingress Rules',
          'Dedicated Queues & Zero Rate Limit',
          '24/7 Dedicated Priority SLA',
        ],
        isActive: true,
      },
    ];

    for (const plan of defaultPlans) {
      const exists = await this.planRepo.findOne({ where: { id: plan.id } });
      if (!exists) {
        await this.planRepo.save(this.planRepo.create(plan));
      } else {
        exists.name = plan.name!;
        exists.description = plan.description!;
        exists.monthlyPrice = plan.monthlyPrice!;
        exists.yearlyPrice = plan.yearlyPrice!;
        exists.maxSessions = plan.maxSessions!;
        exists.maxMessagesPerMonth = plan.maxMessagesPerMonth!;
        exists.maxDripSequences = plan.maxDripSequences !== undefined ? plan.maxDripSequences : 0;
        exists.features = plan.features!;
        exists.isActive = plan.isActive!;
        await this.planRepo.save(exists);
      }
    }
  }

  async getAllPlans(): Promise<Plan[]> {
    return this.planRepo.find({
      where: { isActive: true },
      order: { monthlyPrice: 'ASC' },
    });
  }

  async getPlanById(id: string): Promise<Plan> {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException(`Plan with id '${id}' not found`);
    }
    return plan;
  }

  async createDefaultSubscriptionForUser(user: User): Promise<Subscription> {
    const freePlan = await this.getPlanById('free');
    const now = new Date();
    const endDate = new Date();
    endDate.setDate(now.getDate() + 7); // 7-day Free Trial period

    const sub = this.subRepo.create({
      userId: user.id,
      planId: freePlan.id,
      plan: freePlan,
      billingCycle: BillingCycle.MONTHLY,
      status: SubscriptionStatus.ACTIVE,
      startDate: now,
      endDate,
    });

    return this.subRepo.save(sub);
  }

  async getUserSubscription(userId: string): Promise<Subscription | null> {
    return this.subRepo.findOne({
      where: { userId },
      relations: { plan: true },
    });
  }

  async changeUserPlan(userId: string, planId: string, billingCycle: BillingCycle = BillingCycle.MONTHLY): Promise<Subscription> {
    const plan = await this.getPlanById(planId);
    let sub = await this.subRepo.findOne({ where: { userId } });

    const now = new Date();
    const endDate = new Date();
    if (plan.id === 'free') {
      endDate.setDate(now.getDate() + 7); // 7-day Free Trial
    } else if (billingCycle === BillingCycle.YEARLY) {
      endDate.setFullYear(now.getFullYear() + 1);
    } else {
      endDate.setMonth(now.getMonth() + 1);
    }

    if (!sub) {
      sub = this.subRepo.create({
        userId,
        planId: plan.id,
        plan,
        billingCycle,
        status: SubscriptionStatus.ACTIVE,
        startDate: now,
        endDate,
      });
    } else {
      sub.planId = plan.id;
      sub.plan = plan;
      sub.billingCycle = billingCycle;
      sub.status = SubscriptionStatus.ACTIVE;
      sub.startDate = now;
      sub.endDate = endDate;
    }

    return this.subRepo.save(sub);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Gateway Configuration & Razorpay Integration
  // ─────────────────────────────────────────────────────────────────────────────

  async getActiveCredentials(): Promise<{ keyId: string | null; keySecret: string | null; isEnabled: boolean }> {
    try {
      const setting = await this.gatewayRepo.findOne({ where: { id: 'razorpay' } });
      if (setting) {
        return {
          keyId: setting.keyId || null,
          keySecret: setting.keySecret || null,
          isEnabled: setting.isEnabled ?? false,
        };
      }
    } catch {
      // Fallback
    }

    const envKeyId = process.env.RAZORPAY_KEY_ID || null;
    const envSecret = process.env.RAZORPAY_KEY_SECRET || null;
    return {
      keyId: envKeyId,
      keySecret: envSecret,
      isEnabled: Boolean(envKeyId && envSecret),
    };
  }

  async getGatewayConfig(): Promise<{ razorpayActive: boolean; keyId: string | null }> {
    const { keyId, keySecret, isEnabled } = await this.getActiveCredentials();
    const razorpayActive = Boolean(isEnabled && keyId && keySecret);
    return {
      razorpayActive,
      keyId: razorpayActive ? keyId : null,
    };
  }

  async getAdminGatewaySettings(): Promise<{
    isEnabled: boolean;
    keyId: string;
    hasSecret: boolean;
    keySecretMasked?: string;
  }> {
    const { keyId, keySecret, isEnabled } = await this.getActiveCredentials();
    let keySecretMasked = '';
    if (keySecret) {
      keySecretMasked = keySecret.length > 8 ? `${keySecret.substring(0, 4)}••••••••${keySecret.slice(-4)}` : '••••••••';
    }
    return {
      isEnabled,
      keyId: keyId || '',
      hasSecret: Boolean(keySecret),
      keySecretMasked,
    };
  }

  async updateAdminGatewaySettings(dto: {
    isEnabled: boolean;
    keyId?: string;
    keySecret?: string;
  }): Promise<{ isEnabled: boolean; keyId: string; hasSecret: boolean }> {
    let setting = await this.gatewayRepo.findOne({ where: { id: 'razorpay' } });
    if (!setting) {
      setting = this.gatewayRepo.create({ id: 'razorpay' });
    }

    setting.isEnabled = dto.isEnabled;
    if (dto.keyId !== undefined) {
      setting.keyId = dto.keyId.trim();
    }
    if (dto.keySecret !== undefined && dto.keySecret.trim().length > 0 && !dto.keySecret.includes('••••')) {
      setting.keySecret = dto.keySecret.trim();
    }

    await this.gatewayRepo.save(setting);
    return this.getAdminGatewaySettings();
  }

  async createRazorpayOrder(
    userId: string,
    planId: string,
    billingCycle: 'monthly' | 'yearly',
  ): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
    planName: string;
  }> {
    const { keyId, keySecret, isEnabled } = await this.getActiveCredentials();

    if (!isEnabled || !keyId || !keySecret) {
      throw new BadRequestException('Razorpay gateway is not active or configured');
    }

    const plan = await this.getPlanById(planId);
    const amountInInr = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
    const amountInPaise = Math.round(amountInInr * 100);

    // Call Razorpay API to create order
    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `rcpt_${userId.substring(0, 8)}_${Date.now()}`,
        notes: {
          userId,
          planId: plan.id,
          billingCycle,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new BadRequestException(`Failed to create Razorpay order: ${err}`);
    }

    const orderData: any = await response.json();

    // Create SubscriptionRequest record
    const request = this.requestRepo.create({
      userId,
      planId: plan.id,
      billingCycle: billingCycle === 'yearly' ? BillingCycle.YEARLY : BillingCycle.MONTHLY,
      amount: amountInInr,
      paymentMethod: PaymentMethod.RAZORPAY,
      razorpayOrderId: orderData.id,
      status: RequestStatus.PENDING,
    });
    await this.requestRepo.save(request);

    return {
      orderId: orderData.id,
      amount: amountInPaise,
      currency: 'INR',
      keyId,
      planName: plan.name,
    };
  }

  async verifyRazorpayPayment(
    userId: string,
    orderId: string,
    paymentId: string,
    signature: string,
    planId: string,
    billingCycle: 'monthly' | 'yearly',
  ): Promise<{ success: boolean; subscription: Subscription }> {
    const { keySecret } = await this.getActiveCredentials();
    if (!keySecret) {
      throw new BadRequestException('Razorpay secret not configured');
    }

    // Verify HMAC-SHA256 signature
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (generatedSignature !== signature) {
      throw new BadRequestException('Invalid Razorpay signature: payment verification failed');
    }

    // Update SubscriptionRequest status
    let req = await this.requestRepo.findOne({ where: { razorpayOrderId: orderId } });
    if (req) {
      req.status = RequestStatus.COMPLETED;
      req.razorpayPaymentId = paymentId;
      await this.requestRepo.save(req);
    }

    // Activate subscription for user
    const cycle = billingCycle === 'yearly' ? BillingCycle.YEARLY : BillingCycle.MONTHLY;
    const subscription = await this.changeUserPlan(userId, planId, cycle);

    return {
      success: true,
      subscription,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Manual Subscription Request & Admin Approval
  // ─────────────────────────────────────────────────────────────────────────────

  async submitManualRequest(
    userId: string,
    planId: string,
    billingCycle: 'monthly' | 'yearly',
    notes?: string,
  ): Promise<SubscriptionRequest> {
    const plan = await this.getPlanById(planId);
    const amountInInr = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;

    // Check if there is already a pending request
    const existing = await this.requestRepo.findOne({
      where: { userId, status: RequestStatus.PENDING },
    });
    if (existing) {
      existing.planId = plan.id;
      existing.plan = plan;
      existing.billingCycle = billingCycle === 'yearly' ? BillingCycle.YEARLY : BillingCycle.MONTHLY;
      existing.amount = amountInInr;
      existing.adminNotes = notes || null;
      return this.requestRepo.save(existing);
    }

    const request = this.requestRepo.create({
      userId,
      planId: plan.id,
      plan,
      billingCycle: billingCycle === 'yearly' ? BillingCycle.YEARLY : BillingCycle.MONTHLY,
      amount: amountInInr,
      paymentMethod: PaymentMethod.MANUAL,
      status: RequestStatus.PENDING,
      adminNotes: notes || null,
    });

    return this.requestRepo.save(request);
  }

  async getMyRequests(userId: string): Promise<SubscriptionRequest[]> {
    return this.requestRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getAllRequests(): Promise<SubscriptionRequest[]> {
    return this.requestRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async approveRequest(requestId: string, adminNotes?: string): Promise<SubscriptionRequest> {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException(`Subscription request '${requestId}' not found`);
    }

    if (request.status === RequestStatus.APPROVED || request.status === RequestStatus.COMPLETED) {
      throw new BadRequestException('Request is already approved/completed');
    }

    // Activate the requested plan for user
    await this.changeUserPlan(request.userId, request.planId, request.billingCycle);

    request.status = RequestStatus.APPROVED;
    if (adminNotes) request.adminNotes = adminNotes;
    return this.requestRepo.save(request);
  }

  async rejectRequest(requestId: string, adminNotes?: string): Promise<SubscriptionRequest> {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException(`Subscription request '${requestId}' not found`);
    }

    request.status = RequestStatus.REJECTED;
    if (adminNotes) request.adminNotes = adminNotes;
    return this.requestRepo.save(request);
  }
}
