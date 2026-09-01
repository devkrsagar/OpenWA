import { Controller, Get, Put, Delete, Param, Body, UseGuards, Inject, forwardRef } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserAuthService } from './user-auth.service';
import { BillingService } from '../billing/billing.service';
import { AuthService } from './auth.service';
import { SessionService } from '../session/session.service';
import { UserStatus } from './entities/user.entity';
import { BillingCycle } from '../billing/entities/subscription.entity';
import { UpdateUserStatusDto, UpdateUserPlanDto } from './dto/user-auth.dto';
import { RequireRole } from './decorators/auth.decorators';
import { ApiKeyRole } from './entities/api-key.entity';

@ApiTags('admin-users')
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly userAuthService: UserAuthService,
    private readonly billingService: BillingService,
    private readonly authService: AuthService,
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all registered users (admin only)' })
  async getAllUsers() {
    return this.userAuthService.getAllUsers();
  }

  @Get(':id/overview')
  @ApiOperation({ summary: 'Get full profile overview for a specific user including sessions and API keys (admin only)' })
  async getUserOverview(@Param('id') id: string) {
    const userProfile = await this.userAuthService.getMe(id);
    const apiKeys = await this.authService.findAll(id, 'admin', id);
    const sessions = await this.sessionService.findAll(null, {}, id, 'admin', id);
    return {
      user: userProfile,
      apiKeys: apiKeys.map(k => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        role: k.role,
        isActive: k.isActive,
        usageCount: k.usageCount,
        lastUsedAt: k.lastUsedAt,
        createdAt: k.createdAt,
      })),
      sessions: sessions.map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        phone: s.phone,
        pushName: s.pushName,
        connectedAt: s.connectedAt,
        lastActive: s.lastActiveAt,
        createdAt: s.createdAt,
        engineLoaded: this.sessionService.isActive(s.id),
      })),
    };
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update user active/suspended status' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    const status = dto.status === 'suspended' ? UserStatus.SUSPENDED : UserStatus.ACTIVE;
    return this.userAuthService.updateUserStatus(id, status);
  }

  @Put(':id/plan')
  @ApiOperation({ summary: 'Update user subscription plan directly' })
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdateUserPlanDto,
  ) {
    const cycle = dto.billingCycle === 'yearly' ? BillingCycle.YEARLY : BillingCycle.MONTHLY;
    return this.billingService.changeUserPlan(id, dto.planId, cycle);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user account' })
  async deleteUser(@Param('id') id: string) {
    await this.userAuthService.deleteUser(id);
    return { success: true, message: 'User deleted successfully' };
  }
}
