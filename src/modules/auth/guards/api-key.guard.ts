import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { UserAuthService } from '../user-auth.service';
import { ApiKey, ApiKeyRole } from '../entities/api-key.entity';
import { REQUIRED_ROLE_KEY, PUBLIC_KEY, SESSION_SCOPED_KEY, UNSCOPED_KEY } from '../decorators/auth.decorators';
import { resolveClientIp } from '../../../common/utils/ip';
import { setRequestActor } from '../../../common/services/request-context';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly userAuthService: UserAuthService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [context.getHandler(), context.getClass()]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    try {
      return await this.authorize(request, context);
    } catch (err) {
      if (err instanceof UnauthorizedException || err instanceof ForbiddenException) {
        setRequestActor({ ipAddress: this.getClientIp(request) });
        void this.auditService.logWarn(AuditAction.API_KEY_AUTH_FAILED, {
          ipAddress: this.getClientIp(request),
          method: request.method,
          path: request.path,
          errorMessage: err.message,
        });
      }
      throw err;
    }
  }

  private async authorize(request: Request, context: ExecutionContext): Promise<boolean> {
    const rawToken = this.extractApiKey(request);

    if (!rawToken) {
      throw new UnauthorizedException('Authentication required (API key or Bearer token)');
    }

    const requiredRole = this.reflector.getAllAndOverride<ApiKeyRole>(REQUIRED_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const sessionScoped = this.reflector.getAllAndOverride<boolean>(SESSION_SCOPED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const sessionId = (request.params['sessionId'] || (sessionScoped ? request.params['id'] : undefined)) as
      string | undefined;
    const clientIp = this.getClientIp(request);

    // Check if it's a User JWT token
    const decodedUser = this.userAuthService.verifyToken(rawToken);
    if (decodedUser && decodedUser.sub) {
      // It is a valid user JWT
      const role = decodedUser.role === 'admin' ? ApiKeyRole.ADMIN : ApiKeyRole.OPERATOR;
      const virtualApiKey: ApiKey = {
        id: decodedUser.sub,
        name: decodedUser.name || decodedUser.email,
        keyHash: '',
        keyPrefix: 'jwt_',
        role,
        allowedIps: null,
        allowedSessions: null,
        isActive: true,
        expiresAt: null,
        lastUsedAt: new Date(),
        usageCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (request as any).user = {
        id: decodedUser.sub,
        email: decodedUser.email,
        name: decodedUser.name,
        role: decodedUser.role,
      };

      setRequestActor({ apiKeyId: virtualApiKey.id, apiKeyName: virtualApiKey.name, ipAddress: clientIp });

      if (requiredRole && !this.authService.hasPermission(virtualApiKey, requiredRole)) {
        throw new ForbiddenException(`Insufficient permissions. Required: ${requiredRole}`);
      }

      (request as Request & { apiKey: typeof virtualApiKey }).apiKey = virtualApiKey;
      (request as Request & { clientIp?: string }).clientIp = clientIp;
      return true;
    }

    // Otherwise, validate as standard API key
    const apiKey = await this.authService.validateApiKey(rawToken, clientIp, sessionId);

    setRequestActor({ apiKeyId: apiKey.id, apiKeyName: apiKey.name, ipAddress: clientIp });

    if (requiredRole && !this.authService.hasPermission(apiKey, requiredRole)) {
      throw new ForbiddenException(`Insufficient permissions. Required: ${requiredRole}`);
    }

    const requireUnscoped = this.reflector.getAllAndOverride<boolean>(UNSCOPED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requireUnscoped && (apiKey.allowedSessions?.length ?? 0) > 0) {
      throw new ForbiddenException('Session-scoped API keys are not permitted on this route');
    }

    (request as Request & { apiKey: typeof apiKey }).apiKey = apiKey;
    (request as Request & { clientIp?: string }).clientIp = clientIp;

    return true;
  }

  private extractApiKey(request: Request): string | undefined {
    const xApiKey = request.headers['x-api-key'] as string;
    if (xApiKey) return xApiKey;

    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return undefined;
  }

  private getClientIp(request: Request): string {
    const trustedProxies = this.configService.get<string[]>('security.trustedProxies') ?? [];
    return resolveClientIp(request, trustedProxies);
  }
}
