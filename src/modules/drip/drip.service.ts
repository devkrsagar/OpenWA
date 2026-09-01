import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Optional,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import { ModuleRef } from '@nestjs/core';
import { createLogger } from '../../common/services/logger.service';
import { PLUGIN_MESSAGE_PORT, type PluginMessagePort } from '../../core/plugins/plugin-host-ports';
import { ScheduledBroadcast } from './entities/scheduled-broadcast.entity';
import { DripSequence } from './entities/drip-sequence.entity';
import { DripStep } from './entities/drip-step.entity';
import { DripSubscriber } from './entities/drip-subscriber.entity';
import { ContactBook } from '../contact/entities/contact-book.entity';
import { Session } from '../session/entities/session.entity';
import { BillingService } from '../billing/billing.service';
import {
  CreateScheduledBroadcastDto,
  CreateDripSequenceDto,
  UpdateDripSequenceDto,
} from './dto/drip.dto';

function toJid(phone: string): string {
  const clean = phone.replace(/[^\d]/g, '');
  return `${clean}@c.us`;
}

function replaceVariables(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'gi'), val || '');
  }
  return result;
}

@Injectable()
export class DripService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = createLogger('DripService');
  private messagePort?: PluginMessagePort;
  private timer?: NodeJS.Timeout;
  private isProcessing = false;

  constructor(
    @InjectRepository(ScheduledBroadcast, 'data')
    private readonly broadcastRepo: Repository<ScheduledBroadcast>,
    @InjectRepository(DripSequence, 'data')
    private readonly sequenceRepo: Repository<DripSequence>,
    @InjectRepository(DripStep, 'data')
    private readonly stepRepo: Repository<DripStep>,
    @InjectRepository(DripSubscriber, 'data')
    private readonly subscriberRepo: Repository<DripSubscriber>,
    @InjectRepository(ContactBook, 'data')
    private readonly contactRepo: Repository<ContactBook>,
    @Optional()
    @InjectRepository(Session, 'data')
    private readonly sessionRepo?: Repository<Session>,
    @Optional()
    private readonly billingService?: BillingService,
    @Optional()
    private readonly moduleRef?: ModuleRef,
  ) {}

  onModuleInit() {
    if (this.moduleRef) {
      try {
        this.messagePort = this.moduleRef.get<PluginMessagePort>(PLUGIN_MESSAGE_PORT, {
          strict: false,
        });
      } catch {
        this.logger.warn('PluginMessagePort not available on init, will resolve on send');
      }
    }

    // Run scheduler tick every 20 seconds
    this.timer = setInterval(() => {
      void this.processSchedulerTick();
    }, 20000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private getPort(): PluginMessagePort | undefined {
    if (!this.messagePort && this.moduleRef) {
      try {
        this.messagePort = this.moduleRef.get<PluginMessagePort>(PLUGIN_MESSAGE_PORT, {
          strict: false,
        });
      } catch {
        // ignore
      }
    }
    return this.messagePort;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ⏰ Scheduled Broadcasts
  // ─────────────────────────────────────────────────────────────────────────────

  async getScheduledBroadcasts(sessionId: string): Promise<ScheduledBroadcast[]> {
    return this.broadcastRepo.find({
      where: { sessionId },
      order: { scheduledAt: 'ASC' },
    });
  }

  async createScheduledBroadcast(
    sessionId: string,
    dto: CreateScheduledBroadcastDto,
  ): Promise<ScheduledBroadcast> {
    // Resolve recipient count
    let totalCount = 0;
    if (dto.targetType === 'numbers') {
      const numbers = dto.targetAudience
        .split(/[\n,]+/)
        .map(n => n.trim())
        .filter(Boolean);
      totalCount = numbers.length;
    } else if (dto.targetType === 'tags') {
      const tags = dto.targetAudience
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(Boolean);
      const contacts = await this.contactRepo.find({
        where: [{ sessionId }, { sessionId: null as any }],
      });
      const matching = contacts.filter(c => c.tags && c.tags.some(t => tags.includes(t.toLowerCase())));
      totalCount = matching.length;
    } else {
      // All contacts
      totalCount = await this.contactRepo.count({
        where: [{ sessionId }, { sessionId: null as any }],
      });
    }

    const broadcast = this.broadcastRepo.create({
      sessionId,
      name: dto.name,
      scheduledAt: new Date(dto.scheduledAt),
      status: 'scheduled',
      targetType: dto.targetType,
      targetAudience: dto.targetAudience,
      templateMessage: dto.templateMessage,
      pacingDelaySeconds: dto.pacingDelaySeconds ?? 3,
      totalRecipients: totalCount,
      sentCount: 0,
      failedCount: 0,
    });

    return this.broadcastRepo.save(broadcast);
  }

  async cancelScheduledBroadcast(id: string): Promise<ScheduledBroadcast> {
    const item = await this.broadcastRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Broadcast ${id} not found`);
    item.status = 'cancelled';
    return this.broadcastRepo.save(item);
  }

  async deleteScheduledBroadcast(id: string): Promise<void> {
    await this.broadcastRepo.delete({ id });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 💧 Drip Sequences
  // ─────────────────────────────────────────────────────────────────────────────

  async getDripSequences(sessionId: string): Promise<DripSequence[]> {
    const list = await this.sequenceRepo.find({
      where: { sessionId },
      relations: { steps: true },
      order: { createdAt: 'DESC' },
    });
    for (const seq of list) {
      if (seq.steps) {
        seq.steps.sort((a, b) => a.stepOrder - b.stepOrder);
      }
    }
    return list;
  }

  async getDripSequence(id: string): Promise<DripSequence> {
    const seq = await this.sequenceRepo.findOne({
      where: { id },
      relations: { steps: true },
    });
    if (!seq) throw new NotFoundException(`DripSequence ${id} not found`);
    if (seq.steps) {
      seq.steps.sort((a, b) => a.stepOrder - b.stepOrder);
    }
    return seq;
  }

  async createDripSequence(
    sessionId: string,
    dto: CreateDripSequenceDto,
    userId?: string | null,
  ): Promise<DripSequence> {
    // Enforce Plan limits if billing service is active
    if (this.billingService) {
      let targetUserId = userId;
      if (!targetUserId && this.sessionRepo) {
        const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
        if (session?.userId) {
          targetUserId = session.userId;
        }
      }

      if (targetUserId) {
        const sub = await this.billingService.getUserSubscription(targetUserId);
        const plan =
          sub?.plan ||
          (await this.billingService.getPlanById(sub?.planId || 'free').catch(() => null));

        if (plan) {
          const maxDrip =
            plan.maxDripSequences !== undefined
              ? plan.maxDripSequences
              : plan.id === 'enterprise'
              ? -1
              : plan.id === 'pro'
              ? 25
              : plan.id === 'starter'
              ? 3
              : plan.id === 'free'
              ? 1
              : 0;

          if (maxDrip === 0) {
            throw new ForbiddenException(
              `Your current plan (${plan.name}) does not include Drip Sequences. Please upgrade your subscription to unlock Drip Campaigns.`,
            );
          } else if (maxDrip > 0) {
            let sessionIds = [sessionId];
            if (this.sessionRepo) {
              const userSessions = await this.sessionRepo.find({
                where: { userId: targetUserId },
                select: { id: true },
              });
              if (userSessions.length > 0) {
                sessionIds = userSessions.map(s => s.id);
              }
            }
            const currentCount = await this.sequenceRepo.count({
              where: { sessionId: In(sessionIds) },
            });
            if (currentCount >= maxDrip) {
              throw new ForbiddenException(
                `You have reached the maximum limit of ${maxDrip} drip sequence${
                  maxDrip === 1 ? '' : 's'
                } for your ${plan.name}. Please upgrade your subscription plan to create more sequences.`,
              );
            }
          }
        }
      }
    }

    const seq = this.sequenceRepo.create({
      sessionId,
      name: dto.name,
      description: dto.description || null,
      triggerTag: dto.triggerTag.toLowerCase().trim(),
      enabled: dto.enabled ?? true,
      totalEnrolled: 0,
      totalCompleted: 0,
    });
    const savedSeq = await this.sequenceRepo.save(seq);

    // Save steps
    if (dto.steps && dto.steps.length > 0) {
      const stepEntities = dto.steps.map((st, idx) =>
        this.stepRepo.create({
          sequenceId: savedSeq.id,
          stepOrder: st.stepOrder ?? idx + 1,
          delayHours: st.delayHours ?? 0,
          templateMessage: st.templateMessage,
          sentCount: 0,
        }),
      );
      savedSeq.steps = await this.stepRepo.save(stepEntities);
    }

    return savedSeq;
  }

  async updateDripSequence(
    id: string,
    dto: UpdateDripSequenceDto,
  ): Promise<DripSequence> {
    const seq = await this.getDripSequence(id);

    if (dto.name !== undefined) seq.name = dto.name;
    if (dto.description !== undefined) seq.description = dto.description;
    if (dto.triggerTag !== undefined) seq.triggerTag = dto.triggerTag.toLowerCase().trim();
    if (dto.enabled !== undefined) seq.enabled = dto.enabled;

    await this.sequenceRepo.save(seq);

    if (dto.steps) {
      await this.stepRepo.delete({ sequenceId: id });
      const stepEntities = dto.steps.map((st, idx) =>
        this.stepRepo.create({
          sequenceId: id,
          stepOrder: st.stepOrder ?? idx + 1,
          delayHours: st.delayHours ?? 0,
          templateMessage: st.templateMessage,
          sentCount: 0,
        }),
      );
      seq.steps = await this.stepRepo.save(stepEntities);
    }

    return seq;
  }

  async deleteDripSequence(id: string): Promise<void> {
    await this.stepRepo.delete({ sequenceId: id });
    await this.subscriberRepo.delete({ sequenceId: id });
    await this.sequenceRepo.delete({ id });
  }

  async getSubscribers(sequenceId: string): Promise<DripSubscriber[]> {
    return this.subscriberRepo.find({
      where: { sequenceId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async enrollSubscriber(
    sequenceId: string,
    phone: string,
    contactName?: string,
  ): Promise<DripSubscriber> {
    const seq = await this.getDripSequence(sequenceId);
    if (!seq.enabled) {
      throw new Error(`Sequence '${seq.name}' is currently disabled.`);
    }

    const cleanPhone = phone.replace(/[^\d]/g, '');
    const firstStep = seq.steps?.find(s => s.stepOrder === 1) || seq.steps?.[0];
    const delayHours = firstStep ? firstStep.delayHours : 0;

    const nextRun = new Date();
    nextRun.setHours(nextRun.getHours() + delayHours);

    let sub = await this.subscriberRepo.findOne({
      where: { sequenceId, phone: cleanPhone },
    });

    if (sub) {
      sub.currentStep = 1;
      sub.nextRunAt = nextRun;
      sub.status = 'active';
      sub.contactName = contactName || sub.contactName;
      sub.lastError = null;
      sub = await this.subscriberRepo.save(sub);
    } else {
      sub = this.subscriberRepo.create({
        sequenceId,
        sessionId: seq.sessionId,
        phone: cleanPhone,
        contactName: contactName || null,
        currentStep: 1,
        nextRunAt: nextRun,
        status: 'active',
      });
      sub = await this.subscriberRepo.save(sub);
      await this.sequenceRepo.increment({ id: sequenceId }, 'totalEnrolled', 1);
    }

    return sub;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ⚡ Scheduler Background Processor
  // ─────────────────────────────────────────────────────────────────────────────

  async processSchedulerTick(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      await this.processScheduledBroadcasts();
      await this.processDripSubscribers();
    } catch (err: any) {
      this.logger.error(`Error in scheduler tick: ${err.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processScheduledBroadcasts(): Promise<void> {
    const now = new Date();
    const dueBroadcasts = await this.broadcastRepo.find({
      where: {
        status: 'scheduled',
        scheduledAt: LessThanOrEqual(now),
      },
    });

    for (const item of dueBroadcasts) {
      this.logger.log(`Starting scheduled broadcast '${item.name}' (${item.id}) for session ${item.sessionId}`);
      item.status = 'running';
      item.executedAt = new Date();
      await this.broadcastRepo.save(item);

      // Collect target recipients
      const recipients: Array<{ phone: string; name: string }> = [];

      if (item.targetType === 'numbers') {
        const numbers = item.targetAudience
          .split(/[\n,]+/)
          .map(n => n.trim())
          .filter(Boolean);
        for (const num of numbers) {
          recipients.push({ phone: num, name: '' });
        }
      } else if (item.targetType === 'tags') {
        const tags = item.targetAudience
          .split(',')
          .map(t => t.trim().toLowerCase())
          .filter(Boolean);
        const contacts = await this.contactRepo.find({
          where: [{ sessionId: item.sessionId }, { sessionId: null as any }],
        });
        const matching = contacts.filter(c => c.tags && c.tags.some(t => tags.includes(t.toLowerCase())));
        for (const c of matching) {
          recipients.push({ phone: c.phone, name: c.name || '' });
        }
      } else {
        const contacts = await this.contactRepo.find({
          where: [{ sessionId: item.sessionId }, { sessionId: null as any }],
        });
        for (const c of contacts) {
          recipients.push({ phone: c.phone, name: c.name || '' });
        }
      }

      item.totalRecipients = recipients.length;
      await this.broadcastRepo.save(item);

      const port = this.getPort();
      const delayMs = (item.pacingDelaySeconds || 3) * 1000;

      let sent = 0;
      let failed = 0;

      for (const rec of recipients) {
        const jid = toJid(rec.phone);
        const text = replaceVariables(item.templateMessage, {
          name: rec.name || 'Friend',
          phone: rec.phone,
        });

        try {
          if (port) {
            await port.sendText(item.sessionId, { chatId: jid, text });
          }
          sent++;
        } catch (err: any) {
          failed++;
          this.logger.warn(`Failed broadcast send to ${rec.phone}: ${err.message}`);
        }

        // Delay pacing
        if (delayMs > 0 && recipients.length > 1) {
          await new Promise(r => setTimeout(r, delayMs));
        }
      }

      item.sentCount = sent;
      item.failedCount = failed;
      item.status = 'completed';
      await this.broadcastRepo.save(item);
      this.logger.log(`Completed scheduled broadcast '${item.name}' (${item.id}): ${sent} sent, ${failed} failed`);
    }
  }

  private async processDripSubscribers(): Promise<void> {
    const now = new Date();
    const dueSubs = await this.subscriberRepo.find({
      where: {
        status: 'active',
        nextRunAt: LessThanOrEqual(now),
      },
      take: 50,
    });

    if (dueSubs.length === 0) return;

    for (const sub of dueSubs) {
      try {
        const seq = await this.getDripSequence(sub.sequenceId);
        if (!seq.enabled) continue;

        const currentStep = seq.steps?.find(s => s.stepOrder === sub.currentStep);
        if (!currentStep) {
          // No current step found -> complete
          sub.status = 'completed';
          await this.subscriberRepo.save(sub);
          await this.sequenceRepo.increment({ id: seq.id }, 'totalCompleted', 1);
          continue;
        }

        const port = this.getPort();
        const jid = toJid(sub.phone);
        const text = replaceVariables(currentStep.templateMessage, {
          name: sub.contactName || 'Friend',
          phone: sub.phone,
        });

        if (port) {
          await port.sendText(sub.sessionId, { chatId: jid, text });
        }

        currentStep.sentCount = (currentStep.sentCount || 0) + 1;
        await this.stepRepo.save(currentStep);

        sub.lastMessageSentAt = new Date();
        sub.lastError = null;

        // Check if there is a next step
        const nextStep = seq.steps?.find(s => s.stepOrder === sub.currentStep + 1);
        if (nextStep) {
          sub.currentStep = nextStep.stepOrder;
          const nextRun = new Date();
          nextRun.setHours(nextRun.getHours() + nextStep.delayHours);
          sub.nextRunAt = nextRun;
        } else {
          sub.status = 'completed';
          await this.sequenceRepo.increment({ id: seq.id }, 'totalCompleted', 1);
        }

        await this.subscriberRepo.save(sub);
      } catch (err: any) {
        this.logger.error(`Error processing drip subscriber ${sub.phone} in seq ${sub.sequenceId}: ${err.message}`);
        sub.lastError = err.message;
        await this.subscriberRepo.save(sub);
      }
    }
  }
}
