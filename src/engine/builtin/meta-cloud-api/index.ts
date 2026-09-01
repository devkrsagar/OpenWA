/**
 * Meta Cloud API Engine Plugin
 * Built-in engine plugin that integrates with Meta's Official WhatsApp Cloud API / Business Platform
 */

import { PluginContext, PluginType, IEnginePlugin } from '../../../core/plugins';
import { IWhatsAppEngine } from '../../interfaces/whatsapp-engine.interface';
import { MetaCloudApiAdapter, MetaCloudApiConfig } from '../../adapters/meta-cloud-api.adapter';

export class MetaCloudApiPlugin implements IEnginePlugin {
  type = PluginType.ENGINE as const;
  private context?: PluginContext;

  constructor(private readonly registeredConfig?: Record<string, unknown>) {}

  onLoad(context: PluginContext): Promise<void> {
    this.context = context;
    context.logger.log('Meta Cloud API engine plugin loaded');
    return Promise.resolve();
  }

  onEnable(context: PluginContext): Promise<void> {
    context.logger.log('Meta Cloud API engine plugin enabled');
    return Promise.resolve();
  }

  onDisable(context: PluginContext): Promise<void> {
    context.logger.log('Meta Cloud API engine plugin disabled');
    return Promise.resolve();
  }

  createEngine(config: Record<string, unknown>): IWhatsAppEngine {
    const sessionId = config.sessionId as string;
    const metaConfig = (config.metaConfig || {}) as Partial<MetaCloudApiConfig>;

    return new MetaCloudApiAdapter({
      sessionId,
      phoneNumberId: metaConfig.phoneNumberId || (config.phoneNumberId as string) || '',
      accessToken: metaConfig.accessToken || (config.accessToken as string) || '',
      wabaId: metaConfig.wabaId || (config.wabaId as string),
      apiVersion: metaConfig.apiVersion || (config.apiVersion as string) || 'v20.0',
      displayPhoneNumber: metaConfig.displayPhoneNumber || (config.displayPhoneNumber as string),
      businessName: metaConfig.businessName || (config.businessName as string),
      verifyToken: metaConfig.verifyToken || (config.verifyToken as string),
    });
  }

  getFeatures(): string[] {
    return [
      'text-messages',
      'media-messages',
      'location-messages',
      'contact-messages',
      'message-reactions',
      'message-replies',
      'read-receipts',
      'templates',
    ];
  }

  getEngineLibrary(): { name: string; version: string } {
    return { name: 'meta-cloud-api', version: 'v20.0' };
  }

  healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return Promise.resolve({ healthy: true, message: 'Meta Cloud API engine is available' });
  }
}

export default MetaCloudApiPlugin;
