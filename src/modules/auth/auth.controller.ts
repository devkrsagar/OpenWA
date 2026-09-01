import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { CreateApiKeyDto, UpdateApiKeyDto, ApiKeyResponseDto, ApiKeyCreatedResponseDto } from './dto';
import { CurrentApiKey, RequireUnscopedKey } from './decorators/auth.decorators';
import { type ApiKey, ApiKeyRole } from './entities/api-key.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from './../audit/entities/audit-log.entity';

@ApiTags('auth')
@Controller('auth/api-keys')
@RequireUnscopedKey()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  private auditContext(
    req: Request,
    actor?: ApiKey,
  ): { apiKey?: ApiKey; ipAddress?: string; method?: string; path?: string } {
    return {
      apiKey: actor,
      ipAddress: (req as Request & { clientIp?: string }).clientIp ?? undefined,
      method: req.method,
      path: req.path,
    };
  }

  private getUserContext(req: Request, actor?: ApiKey): { userId: string | null; role: string } {
    const user = (req as any).user;
    if (user?.id) {
      return { userId: user.id, role: user.role || 'user' };
    }
    if (actor?.role === ApiKeyRole.ADMIN) {
      return { userId: actor.userId || null, role: 'admin' };
    }
    return { userId: actor?.userId || null, role: 'operator' };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiResponse({
    status: 201,
    description: 'API key created',
    type: ApiKeyCreatedResponseDto,
  })
  async create(
    @Body() dto: CreateApiKeyDto,
    @Req() req: Request,
    @CurrentApiKey() actor?: ApiKey,
  ): Promise<ApiKeyCreatedResponseDto> {
    const { userId, role } = this.getUserContext(req, actor);

    // If not super admin, force role to OPERATOR
    if (role !== 'admin') {
      dto.role = ApiKeyRole.OPERATOR;
    }

    const { apiKey, rawKey } = await this.authService.createApiKey(dto, userId);
    await this.auditService.logInfo(AuditAction.API_KEY_CREATED, {
      ...this.auditContext(req, actor),
      metadata: { targetKeyId: apiKey.id, targetKeyName: apiKey.name, role: apiKey.role },
    });
    return {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      role: apiKey.role,
      allowedIps: apiKey.allowedIps || undefined,
      allowedSessions: apiKey.allowedSessions || undefined,
      isActive: apiKey.isActive,
      expiresAt: apiKey.expiresAt || undefined,
      lastUsedAt: apiKey.lastUsedAt || undefined,
      usageCount: apiKey.usageCount,
      createdAt: apiKey.createdAt,
      apiKey: rawKey,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List API keys' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter API keys by user ID (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'API keys for current user/admin.',
    type: [ApiKeyResponseDto],
  })
  async findAll(
    @Req() req: Request,
    @CurrentApiKey() actor?: ApiKey,
    @Query('userId') targetUserId?: string,
  ): Promise<ApiKeyResponseDto[]> {
    const { userId, role } = this.getUserContext(req, actor);
    const keys = await this.authService.findAll(userId, role, targetUserId);
    return keys.map(k => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      role: k.role,
      allowedIps: k.allowedIps || undefined,
      allowedSessions: k.allowedSessions || undefined,
      isActive: k.isActive,
      expiresAt: k.expiresAt || undefined,
      lastUsedAt: k.lastUsedAt || undefined,
      usageCount: k.usageCount,
      createdAt: k.createdAt,
    }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get API key details' })
  @ApiResponse({
    status: 200,
    description: 'The API key (plaintext never returned; only the keyPrefix).',
    type: ApiKeyResponseDto,
  })
  async findOne(
    @Param('id') id: string,
    @Req() req: Request,
    @CurrentApiKey() actor?: ApiKey,
  ): Promise<ApiKeyResponseDto> {
    const { userId, role } = this.getUserContext(req, actor);
    const k = await this.authService.findOne(id, userId, role);
    return {
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      role: k.role,
      allowedIps: k.allowedIps || undefined,
      allowedSessions: k.allowedSessions || undefined,
      isActive: k.isActive,
      expiresAt: k.expiresAt || undefined,
      lastUsedAt: k.lastUsedAt || undefined,
      usageCount: k.usageCount,
      createdAt: k.createdAt,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update API key' })
  @ApiResponse({ status: 200, description: 'The updated API key.', type: ApiKeyResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateApiKeyDto,
    @Req() req: Request,
    @CurrentApiKey() actor?: ApiKey,
  ): Promise<ApiKeyResponseDto> {
    const { userId, role } = this.getUserContext(req, actor);
    if (role !== 'admin' && dto.role === ApiKeyRole.ADMIN) {
      dto.role = ApiKeyRole.OPERATOR;
    }
    const before = await this.authService.findOne(id, userId, role);
    const k = await this.authService.update(id, dto, userId, role);
    const authzSnapshot = (key: ApiKey) => ({
      role: key.role,
      allowedIps: key.allowedIps,
      allowedSessions: key.allowedSessions,
      expiresAt: key.expiresAt,
    });
    await this.auditService.logInfo(AuditAction.API_KEY_UPDATED, {
      ...this.auditContext(req, actor),
      metadata: {
        targetKeyId: k.id,
        targetKeyName: k.name,
        before: authzSnapshot(before),
        after: authzSnapshot(k),
      },
    });
    return {
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      role: k.role,
      allowedIps: k.allowedIps || undefined,
      allowedSessions: k.allowedSessions || undefined,
      isActive: k.isActive,
      expiresAt: k.expiresAt || undefined,
      lastUsedAt: k.lastUsedAt || undefined,
      usageCount: k.usageCount,
      createdAt: k.createdAt,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete API key' })
  @ApiResponse({ status: 204, description: 'API key deleted' })
  async delete(@Param('id') id: string, @Req() req: Request, @CurrentApiKey() actor?: ApiKey): Promise<void> {
    const { userId, role } = this.getUserContext(req, actor);
    const target = await this.authService.findOne(id, userId, role);
    await this.authService.delete(id, userId, role);
    await this.auditService.logInfo(AuditAction.API_KEY_DELETED, {
      ...this.auditContext(req, actor),
      metadata: { targetKeyId: id, targetKeyName: target?.name },
    });
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke API key' })
  @ApiResponse({ status: 200, description: 'The revoked API key (isActive now false).', type: ApiKeyResponseDto })
  async revoke(
    @Param('id') id: string,
    @Req() req: Request,
    @CurrentApiKey() actor?: ApiKey,
  ): Promise<ApiKeyResponseDto> {
    const { userId, role } = this.getUserContext(req, actor);
    const k = await this.authService.revoke(id, userId, role);
    await this.auditService.logInfo(AuditAction.API_KEY_REVOKED, {
      ...this.auditContext(req, actor),
      metadata: { targetKeyId: k.id, targetKeyName: k.name },
    });
    return {
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      role: k.role,
      allowedIps: k.allowedIps || undefined,
      allowedSessions: k.allowedSessions || undefined,
      isActive: k.isActive,
      expiresAt: k.expiresAt || undefined,
      lastUsedAt: k.lastUsedAt || undefined,
      usageCount: k.usageCount,
      createdAt: k.createdAt,
    };
  }
}
