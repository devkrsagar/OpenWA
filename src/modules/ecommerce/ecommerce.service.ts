import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModuleRef } from '@nestjs/core';
import { createLogger } from '../../common/services/logger.service';
import { PLUGIN_MESSAGE_PORT, type PluginMessagePort } from '../../core/plugins/plugin-host-ports';
import { EcommerceAutomation } from './entities/ecommerce-automation.entity';
import { EcommerceLog } from './entities/ecommerce-log.entity';
import {
  CreateEcommerceAutomationDto,
  UpdateEcommerceAutomationDto,
  TestEcommerceWebhookDto,
} from './dto/ecommerce.dto';

export interface ExtractedVariables {
  phone: string;
  customer_name: string;
  order_id: string;
  total_amount: string;
  currency: string;
  items: string;
  tracking_url: string;
  tracking_number: string;
  checkout_url: string;
  store_name: string;
  [key: string]: string;
}

@Injectable()
export class EcommerceService {
  private readonly logger = createLogger('EcommerceService');
  private messagePort?: PluginMessagePort;

  constructor(
    @InjectRepository(EcommerceAutomation, 'data')
    private readonly automationRepository: Repository<EcommerceAutomation>,
    @InjectRepository(EcommerceLog, 'data')
    private readonly logRepository: Repository<EcommerceLog>,
    @Optional()
    private readonly moduleRef?: ModuleRef,
  ) {}

  async findAll(sessionId: string): Promise<EcommerceAutomation[]> {
    return this.automationRepository.find({
      where: { sessionId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<EcommerceAutomation> {
    const item = await this.automationRepository.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Automation ${id} not found`);
    return item;
  }

  async create(sessionId: string, dto: CreateEcommerceAutomationDto): Promise<EcommerceAutomation> {
    const item = this.automationRepository.create({
      sessionId,
      name: dto.name,
      platform: dto.platform as any,
      eventType: dto.eventType as any,
      webhookSecret: dto.webhookSecret ?? null,
      enabled: dto.enabled ?? true,
      phoneFieldPath: dto.phoneFieldPath ?? null,
      templateMessage: dto.templateMessage,
      delayMinutes: dto.delayMinutes ?? 0,
    });
    return this.automationRepository.save(item);
  }

  async update(id: string, dto: UpdateEcommerceAutomationDto): Promise<EcommerceAutomation> {
    const item = await this.findOne(id);
    if (dto.name !== undefined) item.name = dto.name;
    if (dto.platform !== undefined) item.platform = dto.platform as any;
    if (dto.eventType !== undefined) item.eventType = dto.eventType as any;
    if (dto.webhookSecret !== undefined) item.webhookSecret = dto.webhookSecret;
    if (dto.enabled !== undefined) item.enabled = dto.enabled;
    if (dto.phoneFieldPath !== undefined) item.phoneFieldPath = dto.phoneFieldPath;
    if (dto.templateMessage !== undefined) item.templateMessage = dto.templateMessage;
    if (dto.delayMinutes !== undefined) item.delayMinutes = dto.delayMinutes;
    return this.automationRepository.save(item);
  }

  async remove(id: string): Promise<void> {
    const item = await this.findOne(id);
    await this.automationRepository.remove(item);
  }

  async getLogs(sessionId: string, automationId?: string): Promise<EcommerceLog[]> {
    const where: any = { sessionId };
    if (automationId) where.automationId = automationId;
    return this.logRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  /** Public Webhook Ingress Handler */
  async handleWebhook(automationId: string, payload: Record<string, any>): Promise<{ status: string; recipient?: string }> {
    const automation = await this.automationRepository.findOne({ where: { id: automationId } });
    if (!automation) {
      this.logger.warn(`Webhook received for unknown automation ID: ${automationId}`);
      return { status: 'automation_not_found' };
    }

    if (!automation.enabled) {
      this.logger.log(`Automation ${automation.name} (${automationId}) is disabled, skipping.`);
      return { status: 'automation_disabled' };
    }

    const vars = this.extractVariables(automation.platform, automation.eventType, payload, automation.phoneFieldPath);
    if (!vars.phone) {
      this.logger.warn(`Could not extract valid phone number from payload for automation ${automationId}`);
      await this.saveLog({
        automationId,
        sessionId: automation.sessionId,
        eventType: automation.eventType,
        platform: automation.platform,
        recipientPhone: 'unknown',
        orderId: vars.order_id || null,
        customerName: vars.customer_name || null,
        status: 'skipped',
        variablesJson: JSON.stringify(vars),
        messageText: null,
        errorMessage: 'Phone number could not be found in payload.',
      });
      return { status: 'no_phone_found' };
    }

    const formattedMessage = this.renderTemplate(automation.templateMessage, vars);
    const chatId = this.normalizeChatId(vars.phone);

    try {
      const port = this.resolveMessagePort();
      if (!port) {
        throw new Error('PluginMessagePort not bound');
      }

      await port.sendText(automation.sessionId, { chatId, text: formattedMessage });

      // Update automation trigger metrics
      await this.automationRepository.update(automation.id, {
        triggerCount: () => 'triggerCount + 1',
        lastTriggeredAt: new Date(),
      });

      await this.saveLog({
        automationId,
        sessionId: automation.sessionId,
        eventType: automation.eventType,
        platform: automation.platform,
        recipientPhone: chatId,
        orderId: vars.order_id || null,
        customerName: vars.customer_name || null,
        status: 'delivered',
        variablesJson: JSON.stringify(vars),
        messageText: formattedMessage,
        errorMessage: null,
      });

      this.logger.log(`E-Commerce webhook sent WhatsApp message to ${chatId} (${automation.name})`);
      return { status: 'sent', recipient: chatId };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to send WhatsApp message for automation ${automationId}: ${errMsg}`);

      await this.saveLog({
        automationId,
        sessionId: automation.sessionId,
        eventType: automation.eventType,
        platform: automation.platform,
        recipientPhone: chatId,
        orderId: vars.order_id || null,
        customerName: vars.customer_name || null,
        status: 'failed',
        variablesJson: JSON.stringify(vars),
        messageText: formattedMessage,
        errorMessage: errMsg,
      });

      return { status: 'send_failed' };
    }
  }

  /** Test Webhook Sandbox Simulator */
  testSimulator(dto: TestEcommerceWebhookDto): {
    extractedVariables: ExtractedVariables;
    renderedMessage: string;
    targetChatId: string;
  } {
    const vars = this.extractVariables(dto.platform, dto.eventType, dto.payload);
    const rendered = this.renderTemplate(dto.templateMessage, vars);
    const targetChatId = vars.phone ? this.normalizeChatId(vars.phone) : 'None';

    return {
      extractedVariables: vars,
      renderedMessage: rendered,
      targetChatId,
    };
  }

  /** Variable Extraction from Store Payloads */
  extractVariables(
    platform: string,
    eventType: string,
    payload: Record<string, any>,
    customPhonePath?: string | null,
  ): ExtractedVariables {
    const vars: ExtractedVariables = {
      phone: '',
      customer_name: 'Customer',
      order_id: '',
      total_amount: '',
      currency: 'USD',
      items: '',
      tracking_url: '',
      tracking_number: '',
      checkout_url: '',
      store_name: 'Store',
    };

    if (!payload || typeof payload !== 'object') return vars;

    // Check custom path if supplied
    if (customPhonePath) {
      const customVal = this.getByPath(payload, customPhonePath);
      if (typeof customVal === 'string' && customVal.trim()) {
        vars.phone = customVal.trim();
      }
    }

    if (platform === 'shopify') {
      // Shopify phone resolution
      if (!vars.phone) {
        vars.phone =
          payload.customer?.phone ||
          payload.billing_address?.phone ||
          payload.shipping_address?.phone ||
          payload.phone ||
          '';
      }

      // Name
      const firstName = payload.customer?.first_name || payload.billing_address?.first_name || '';
      const lastName = payload.customer?.last_name || payload.billing_address?.last_name || '';
      if (firstName || lastName) vars.customer_name = `${firstName} ${lastName}`.trim();
      else if (payload.customer?.name) vars.customer_name = payload.customer.name;

      // Order Details
      vars.order_id = payload.name || (payload.order_number ? `#${payload.order_number}` : String(payload.id || ''));
      vars.total_amount = payload.total_price || payload.current_total_price || payload.total || '';
      vars.currency = payload.currency || 'USD';

      // Items
      const lineItems = payload.line_items || payload.items || [];
      if (Array.isArray(lineItems)) {
        vars.items = lineItems
          .map((i: any) => `${i.quantity ? `${i.quantity}x ` : ''}${i.title || i.name || 'Item'}`)
          .join(', ');
      }

      // Tracking & Checkout URLs
      const fulfillments = payload.fulfillments || [];
      if (Array.isArray(fulfillments) && fulfillments.length > 0) {
        vars.tracking_number = fulfillments[0].tracking_number || '';
        vars.tracking_url = fulfillments[0].tracking_url || '';
      }
      vars.checkout_url = payload.abandoned_checkout_url || payload.checkout_url || '';
    } else if (platform === 'woocommerce') {
      // WooCommerce
      if (!vars.phone) {
        vars.phone = payload.billing?.phone || payload.shipping?.phone || payload.phone || '';
      }

      const fName = payload.billing?.first_name || '';
      const lName = payload.billing?.last_name || '';
      if (fName || lName) vars.customer_name = `${fName} ${lName}`.trim();

      vars.order_id = payload.id ? `#${payload.id}` : payload.number ? `#${payload.number}` : '';
      vars.total_amount = payload.total || '';
      vars.currency = payload.currency || 'USD';

      const lineItems = payload.line_items || [];
      if (Array.isArray(lineItems)) {
        vars.items = lineItems
          .map((i: any) => `${i.quantity ? `${i.quantity}x ` : ''}${i.name || 'Item'}`)
          .join(', ');
      }

      vars.checkout_url = payload.payment_url || '';
    } else if (platform === 'stripe') {
      // Stripe
      const dataObj = payload.data?.object || payload;
      if (!vars.phone) {
        vars.phone =
          dataObj.customer_details?.phone ||
          dataObj.billing_details?.phone ||
          dataObj.customer_phone ||
          '';
      }

      vars.customer_name = dataObj.customer_details?.name || dataObj.billing_details?.name || 'Customer';
      vars.order_id = dataObj.id || '';
      if (dataObj.amount) {
        vars.total_amount = (Number(dataObj.amount) / 100).toFixed(2);
      }
      vars.currency = (dataObj.currency || 'USD').toUpperCase();
      vars.tracking_url = dataObj.receipt_url || '';
    } else {
      // Custom / Generic CRM
      if (!vars.phone) {
        vars.phone =
          payload.phone ||
          payload.mobile ||
          payload.telephone ||
          payload.customer?.phone ||
          payload.data?.phone ||
          '';
      }

      vars.customer_name =
        payload.customer_name ||
        payload.name ||
        payload.customer?.name ||
        payload.first_name ||
        'Customer';
      vars.order_id = payload.order_id || payload.order_number || payload.id || '';
      vars.total_amount = String(payload.total_amount || payload.total || payload.amount || '');
      vars.currency = payload.currency || 'USD';
      vars.tracking_url = payload.tracking_url || payload.tracking_link || '';
      vars.tracking_number = payload.tracking_number || '';
      vars.checkout_url = payload.checkout_url || payload.cart_url || '';
    }

    // Flatten simple top-level properties so custom placeholders {{custom_prop}} work
    for (const [k, v] of Object.entries(payload)) {
      if (typeof v === 'string' || typeof v === 'number') {
        vars[k] = String(v);
      }
    }

    return vars;
  }

  /** Render template with {{variable}} substitution */
  renderTemplate(template: string, vars: ExtractedVariables): string {
    if (!template) return '';
    return template.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_match, key) => {
      const val = vars[key] || vars[key.toLowerCase()];
      return val !== undefined && val !== null ? val : '';
    });
  }

  /** Normalize phone number to WhatsApp JID */
  private normalizeChatId(phone: string): string {
    const cleaned = phone.replace(/[^0-9]/g, '');
    return cleaned.endsWith('@c.us') ? cleaned : `${cleaned}@c.us`;
  }

  private getByPath(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }

  private async saveLog(data: {
    automationId: string;
    sessionId: string;
    eventType: string;
    platform: string;
    recipientPhone: string;
    orderId: string | null;
    customerName: string | null;
    status: 'delivered' | 'failed' | 'skipped';
    variablesJson: string | null;
    messageText: string | null;
    errorMessage: string | null;
  }) {
    try {
      const log = this.logRepository.create(data);
      await this.logRepository.save(log);
    } catch (err) {
      this.logger.warn(`Failed to write ecommerce log: ${String(err)}`);
    }
  }

  private resolveMessagePort(): PluginMessagePort | undefined {
    if (this.messagePort) return this.messagePort;
    if (!this.moduleRef) return undefined;
    try {
      this.messagePort = this.moduleRef.get<PluginMessagePort>(PLUGIN_MESSAGE_PORT, { strict: false });
      return this.messagePort;
    } catch {
      return undefined;
    }
  }
}
