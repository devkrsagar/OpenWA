import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template } from './entities/template.entity';
import { Session } from '../session/entities/session.entity';
import { CreateTemplateDto, UpdateTemplateDto } from './dto';
import { createLogger } from '../../common/services/logger.service';
import { isUniqueViolation } from '../../common/utils/db-errors';

@Injectable()
export class TemplateService {
  private readonly logger = createLogger('TemplateService');

  constructor(
    @InjectRepository(Template, 'data')
    private readonly templateRepository: Repository<Template>,
    @InjectRepository(Session, 'data')
    private readonly sessionRepository: Repository<Session>,
  ) {}

  async create(sessionId: string, dto: CreateTemplateDto): Promise<Template> {
    const template = this.templateRepository.create({
      sessionId,
      name: dto.name,
      body: dto.body,
      header: dto.header ?? null,
      footer: dto.footer ?? null,
      category: dto.category ?? 'MARKETING',
      language: dto.language ?? 'en_US',
      status: 'LOCAL',
      components: dto.components ?? null,
    });

    // If submitToMeta is requested, attempt to register with Meta Graph API
    if (dto.submitToMeta) {
      try {
        const metaRes = await this.submitToMeta(sessionId, dto);
        if (metaRes?.id) {
          template.metaTemplateId = metaRes.id;
          template.status = (metaRes.status as any) || 'PENDING';
        }
      } catch (err) {
        this.logger.warn(`Meta template submission warning: ${(err as Error).message}`);
      }
    }

    try {
      const saved = await this.templateRepository.save(template);
      this.logger.log('Template created', { sessionId, templateId: saved.id, name: saved.name });
      return saved;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(`A template named '${dto.name}' already exists for this session`);
      }
      throw err;
    }
  }

  async findBySession(sessionId: string): Promise<Template[]> {
    return this.templateRepository.find({
      where: { sessionId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(sessionId: string, id: string): Promise<Template> {
    const template = await this.templateRepository.findOne({ where: { id, sessionId } });
    if (!template) {
      throw new NotFoundException(`Template with id '${id}' not found`);
    }
    return template;
  }

  async resolve(sessionId: string, identifier: { templateId?: string; templateName?: string }): Promise<Template> {
    const { templateId, templateName } = identifier;

    if (templateId) {
      return this.findOne(sessionId, templateId);
    }

    if (templateName) {
      const template = await this.templateRepository.findOne({
        where: { name: templateName, sessionId },
        order: { createdAt: 'ASC' },
      });
      if (!template) {
        throw new NotFoundException(`Template with name '${templateName}' not found`);
      }
      return template;
    }

    throw new NotFoundException('Either templateId or templateName must be provided');
  }

  async update(sessionId: string, id: string, dto: UpdateTemplateDto): Promise<Template> {
    const template = await this.findOne(sessionId, id);

    if (dto.name !== undefined) template.name = dto.name;
    if (dto.body !== undefined) template.body = dto.body;
    if (dto.header !== undefined) template.header = dto.header;
    if (dto.footer !== undefined) template.footer = dto.footer;
    if (dto.category !== undefined) template.category = dto.category;
    if (dto.language !== undefined) template.language = dto.language;

    try {
      return await this.templateRepository.save(template);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(`A template named '${template.name}' already exists for this session`);
      }
      throw err;
    }
  }

  async delete(sessionId: string, id: string): Promise<void> {
    const template = await this.findOne(sessionId, id);

    // If template is linked to Meta WABA, delete from Meta as well
    if (template.metaTemplateId) {
      try {
        const session = await this.sessionRepository.findOne({ where: { id: sessionId } });
        const metaConfig = (session?.config as any)?.metaConfig;
        if (metaConfig?.wabaId && metaConfig?.accessToken) {
          await fetch(
            `https://graph.facebook.com/v20.0/${metaConfig.wabaId}/message_templates?name=${encodeURIComponent(template.name)}`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${metaConfig.accessToken}` },
            },
          );
        }
      } catch (err) {
        this.logger.warn(`Meta template deletion warning: ${(err as Error).message}`);
      }
    }

    await this.templateRepository.remove(template);
    this.logger.log('Template deleted', { sessionId, templateId: id });
  }

  /**
   * Sync all official templates from Meta WhatsApp Business Account (WABA) into OpenWA.
   */
  async syncMetaTemplates(sessionId: string): Promise<{ synced: number; templates: Template[] }> {
    const session = await this.sessionRepository.findOne({
      where: [{ id: sessionId }, { name: sessionId }],
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    const metaConfig = (session.config as any)?.metaConfig;
    if (!metaConfig?.wabaId || !metaConfig?.accessToken) {
      throw new BadRequestException(
        'Meta WhatsApp Business Account (WABA) ID and Access Token are required in session config to sync Meta templates.',
      );
    }

    const res = await fetch(
      `https://graph.facebook.com/v20.0/${metaConfig.wabaId}/message_templates?limit=100`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${metaConfig.accessToken}`,
        },
      },
    );

    const data = (await res.json().catch(() => ({}))) as {
      data?: Array<{
        id: string;
        name: string;
        status: string;
        category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
        language: string;
        components: Array<{ type: string; text?: string; format?: string; [key: string]: unknown }>;
      }>;
      error?: { message: string };
    };

    if (!res.ok || data.error) {
      const msg = data.error?.message || `Meta API Error (${res.status})`;
      throw new BadRequestException(`Failed to sync from Meta: ${msg}`);
    }

    const items = data.data || [];
    const results: Template[] = [];

    for (const item of items) {
      let bodyText = '';
      let headerText: string | null = null;
      let footerText: string | null = null;

      for (const comp of item.components || []) {
        if (comp.type === 'BODY') bodyText = comp.text || '';
        else if (comp.type === 'HEADER' && comp.format === 'TEXT') headerText = comp.text || null;
        else if (comp.type === 'FOOTER') footerText = comp.text || null;
      }

      let template = await this.templateRepository.findOne({
        where: { sessionId: session.id, name: item.name },
      });

      if (!template) {
        template = this.templateRepository.create({
          sessionId: session.id,
          name: item.name,
          body: bodyText,
          header: headerText,
          footer: footerText,
          category: item.category || 'MARKETING',
          language: item.language || 'en_US',
          status: (item.status as any) || 'APPROVED',
          metaTemplateId: item.id,
          components: item.components,
        });
      } else {
        template.body = bodyText || template.body;
        template.header = headerText;
        template.footer = footerText;
        template.category = item.category || template.category;
        template.language = item.language || template.language;
        template.status = (item.status as any) || template.status;
        template.metaTemplateId = item.id;
        template.components = item.components;
      }

      const saved = await this.templateRepository.save(template);
      results.push(saved);
    }

    this.logger.log(`Synced ${results.length} Meta templates for session ${sessionId}`);
    return { synced: results.length, templates: results };
  }

  /**
   * Submit a template to Meta WhatsApp Business API for approval.
   */
  async submitToMeta(sessionId: string, dto: CreateTemplateDto): Promise<{ id: string; status: string }> {
    const session = await this.sessionRepository.findOne({
      where: [{ id: sessionId }, { name: sessionId }],
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    const metaConfig = (session.config as any)?.metaConfig;
    if (!metaConfig?.wabaId || !metaConfig?.accessToken) {
      throw new BadRequestException('Meta WABA ID and Access Token are required in session config.');
    }

    const components: Array<Record<string, unknown>> = [];

    if (dto.header) {
      components.push({
        type: 'HEADER',
        format: 'TEXT',
        text: dto.header,
      });
    }

    components.push({
      type: 'BODY',
      text: dto.body,
    });

    if (dto.footer) {
      components.push({
        type: 'FOOTER',
        text: dto.footer,
      });
    }

    if (dto.components && Array.isArray(dto.components)) {
      for (const c of dto.components) {
        if (c.type === 'BUTTONS') {
          components.push(c);
        }
      }
    }

    const metaName = dto.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const payload = {
      name: metaName,
      category: dto.category || 'MARKETING',
      language: dto.language || 'en_US',
      components,
    };

    const res = await fetch(`https://graph.facebook.com/v20.0/${metaConfig.wabaId}/message_templates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${metaConfig.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      status?: string;
      error?: { message: string };
    };

    if (!res.ok || data.error) {
      const msg = data.error?.message || `Meta API Error (${res.status})`;
      throw new BadRequestException(`Meta Template Submission Error: ${msg}`);
    }

    return {
      id: data.id || `meta_tpl_${Date.now()}`,
      status: data.status || 'PENDING',
    };
  }
}
