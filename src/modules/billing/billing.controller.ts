import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { BillingCycle } from './entities/subscription.entity';
import { Public } from '../auth/decorators/auth.decorators';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'Get all available subscription plans' })
  async getPlans() {
    return this.billingService.getAllPlans();
  }

  @Public()
  @Get('config')
  @ApiOperation({ summary: 'Get payment gateway status and public configuration' })
  async getGatewayConfig() {
    return this.billingService.getGatewayConfig();
  }

  private getUserId(req: Request): string | null {
    const user = (req as any).user;
    if (user?.id) return user.id;
    const apiKey = (req as any).apiKey;
    if (apiKey?.userId) return apiKey.userId;
    return null;
  }

  @Get('my-subscription')
  @ApiOperation({ summary: 'Get current user subscription' })
  async getMySubscription(@Req() req: Request) {
    const userId = this.getUserId(req);
    if (!userId) {
      const freePlan = await this.billingService.getPlanById('free');
      return {
        plan: freePlan,
        billingCycle: 'monthly',
        status: 'active',
      };
    }
    return this.billingService.getUserSubscription(userId);
  }

  @Get('my-requests')
  @ApiOperation({ summary: 'Get all subscription requests for current user' })
  async getMyRequests(@Req() req: Request) {
    const userId = this.getUserId(req);
    if (!userId) {
      return [];
    }
    return this.billingService.getMyRequests(userId);
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe to a plan directly (free tier or instant switch)' })
  async subscribe(
    @Body() body: { planId: string; billingCycle?: 'monthly' | 'yearly' },
    @Req() req: Request,
  ) {
    const userId = this.getUserId(req);
    if (!userId) {
      throw new BadRequestException('User session required to subscribe');
    }
    const cycle = body.billingCycle === 'yearly' ? BillingCycle.YEARLY : BillingCycle.MONTHLY;
    return this.billingService.changeUserPlan(userId, body.planId, cycle);
  }

  @Post('razorpay/create-order')
  @ApiOperation({ summary: 'Create Razorpay order for plan upgrade or renewal' })
  async createRazorpayOrder(
    @Body() body: { planId: string; billingCycle?: 'monthly' | 'yearly' },
    @Req() req: Request,
  ) {
    const userId = this.getUserId(req);
    if (!userId) {
      throw new BadRequestException('User session required');
    }
    const cycle = body.billingCycle === 'yearly' ? 'yearly' : 'monthly';
    return this.billingService.createRazorpayOrder(userId, body.planId, cycle);
  }

  @Post('razorpay/verify')
  @ApiOperation({ summary: 'Verify Razorpay payment signature and activate plan' })
  async verifyRazorpayPayment(
    @Body()
    body: {
      orderId: string;
      paymentId: string;
      signature: string;
      planId: string;
      billingCycle?: 'monthly' | 'yearly';
    },
    @Req() req: Request,
  ) {
    const userId = this.getUserId(req);
    if (!userId) {
      throw new BadRequestException('User session required');
    }
    const cycle = body.billingCycle === 'yearly' ? 'yearly' : 'monthly';
    return this.billingService.verifyRazorpayPayment(
      userId,
      body.orderId,
      body.paymentId,
      body.signature,
      body.planId,
      cycle,
    );
  }

  @Post('request')
  @ApiOperation({ summary: 'Submit manual / offline subscription request for Admin approval' })
  async submitManualRequest(
    @Body() body: { planId: string; billingCycle?: 'monthly' | 'yearly'; notes?: string },
    @Req() req: Request,
  ) {
    const userId = this.getUserId(req);
    if (!userId) {
      throw new BadRequestException('User session required');
    }
    const cycle = body.billingCycle === 'yearly' ? 'yearly' : 'monthly';
    return this.billingService.submitManualRequest(userId, body.planId, cycle, body.notes);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Admin Endpoints for Subscription Requests
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('admin/requests')
  @ApiOperation({ summary: 'List all subscription requests (admin only)' })
  async getAllRequests(@Req() req: Request) {
    const user = (req as any).user;
    const apiKey = (req as any).apiKey;
    if (user?.role !== 'admin' && (!apiKey || apiKey.role !== 'admin')) {
      throw new ForbiddenException('Admin access required');
    }
    return this.billingService.getAllRequests();
  }

  @Post('admin/requests/:id/approve')
  @ApiOperation({ summary: 'Approve subscription request and activate plan (admin only)' })
  async approveRequest(
    @Param('id') id: string,
    @Body() body: { notes?: string },
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const apiKey = (req as any).apiKey;
    if (user?.role !== 'admin' && (!apiKey || apiKey.role !== 'admin')) {
      throw new ForbiddenException('Admin access required');
    }
    return this.billingService.approveRequest(id, body?.notes);
  }

  @Get('admin/gateway-settings')
  @ApiOperation({ summary: 'Get Razorpay gateway settings and credentials (admin only)' })
  async getGatewaySettings(@Req() req: Request) {
    const user = (req as any).user;
    const apiKey = (req as any).apiKey;
    if (user?.role !== 'admin' && (!apiKey || apiKey.role !== 'admin')) {
      throw new ForbiddenException('Admin access required');
    }
    return this.billingService.getAdminGatewaySettings();
  }

  @Post('admin/gateway-settings')
  @ApiOperation({ summary: 'Update Razorpay gateway settings and credentials (admin only)' })
  async updateGatewaySettings(
    @Body() body: { isEnabled: boolean; keyId?: string; keySecret?: string },
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const apiKey = (req as any).apiKey;
    if (user?.role !== 'admin' && (!apiKey || apiKey.role !== 'admin')) {
      throw new ForbiddenException('Admin access required');
    }
    return this.billingService.updateAdminGatewaySettings(body);
  }
}
