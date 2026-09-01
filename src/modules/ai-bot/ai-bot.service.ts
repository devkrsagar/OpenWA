import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModuleRef } from '@nestjs/core';
import { createLogger } from '../../common/services/logger.service';
import { PLUGIN_MESSAGE_PORT, type PluginMessagePort } from '../../core/plugins/plugin-host-ports';
import { Message, MessageDirection } from '../message/entities/message.entity';
import { AiBotConfig } from './entities/ai-bot-config.entity';
import { SaveAiBotConfigDto, TestAiPromptDto } from './dto/ai-bot-config.dto';

interface ChatHistoryItem {
  role: 'user' | 'assistant';
  text: string;
}

@Injectable()
export class AiBotService {
  private readonly logger = createLogger('AiBotService');
  private messagePort?: PluginMessagePort;

  constructor(
    @InjectRepository(AiBotConfig, 'data')
    private readonly botConfigRepository: Repository<AiBotConfig>,
    @InjectRepository(Message, 'data')
    private readonly messageRepository: Repository<Message>,
    @Optional()
    private readonly moduleRef?: ModuleRef,
  ) {}

  async getConfig(sessionId: string): Promise<AiBotConfig | null> {
    return this.botConfigRepository.findOne({ where: { sessionId } });
  }

  async saveConfig(sessionId: string, dto: SaveAiBotConfigDto): Promise<AiBotConfig> {
    let config = await this.botConfigRepository.findOne({ where: { sessionId } });
    if (!config) {
      config = this.botConfigRepository.create({
        sessionId,
        enabled: dto.enabled ?? true,
        provider: dto.provider as any ?? 'openai',
        apiKey: dto.apiKey ?? null,
        model: dto.model ?? 'gpt-4o-mini',
        baseUrl: dto.baseUrl ?? null,
        systemPrompt: dto.systemPrompt ?? null,
        temperature: dto.temperature ?? 0.7,
        maxTokens: dto.maxTokens ?? 800,
        memoryDepth: dto.memoryDepth ?? 10,
        humanHandoffKeywords: dto.humanHandoffKeywords ?? null,
        excludeGroups: dto.excludeGroups ?? true,
        typingDelaySeconds: dto.typingDelaySeconds ?? 2,
      });
    } else {
      if (dto.enabled !== undefined) config.enabled = dto.enabled;
      if (dto.provider !== undefined) config.provider = dto.provider as any;
      if (dto.apiKey !== undefined) config.apiKey = dto.apiKey;
      if (dto.model !== undefined) config.model = dto.model;
      if (dto.baseUrl !== undefined) config.baseUrl = dto.baseUrl;
      if (dto.systemPrompt !== undefined) config.systemPrompt = dto.systemPrompt;
      if (dto.temperature !== undefined) config.temperature = dto.temperature;
      if (dto.maxTokens !== undefined) config.maxTokens = dto.maxTokens;
      if (dto.memoryDepth !== undefined) config.memoryDepth = dto.memoryDepth;
      if (dto.humanHandoffKeywords !== undefined) config.humanHandoffKeywords = dto.humanHandoffKeywords;
      if (dto.excludeGroups !== undefined) config.excludeGroups = dto.excludeGroups;
      if (dto.typingDelaySeconds !== undefined) config.typingDelaySeconds = dto.typingDelaySeconds;
    }

    return this.botConfigRepository.save(config);
  }

  /** Test Prompt via Playground Simulator */
  async testSimulator(dto: TestAiPromptDto): Promise<{ response: string; model: string; durationMs: number }> {
    const startTime = Date.now();
    const response = await this.callAiProvider({
      provider: dto.provider,
      apiKey: dto.apiKey || '',
      model: dto.model,
      baseUrl: dto.baseUrl,
      systemPrompt: dto.systemPrompt,
      temperature: dto.temperature ?? 0.7,
      maxTokens: dto.maxTokens ?? 500,
      history: dto.history || [],
      userMessage: dto.message,
    });

    return {
      response,
      model: dto.model,
      durationMs: Date.now() - startTime,
    };
  }

  /** Inbound Message Hook */
  async handleInboundMessage(sessionId: string, message: Record<string, unknown>): Promise<void> {
    if (message.fromMe === true) return;
    const chatId = typeof message.chatId === 'string' ? message.chatId : null;
    if (!chatId) return;

    // Skip groups if excludeGroups is active
    const isGroup = message.isGroup === true || chatId.endsWith('@g.us');
    const body = typeof message.body === 'string' ? message.body.trim() : '';
    if (!body) return;

    const config = await this.getConfig(sessionId);
    if (!config || !config.enabled || !config.apiKey) return;
    if (isGroup && config.excludeGroups) return;

    // Check Human Handoff Keywords
    if (config.humanHandoffKeywords && config.humanHandoffKeywords.length > 0) {
      const lowerBody = body.toLowerCase();
      const hasHandoffKeyword = config.humanHandoffKeywords.some(kw =>
        kw && lowerBody.includes(kw.toLowerCase().trim()),
      );
      if (hasHandoffKeyword) {
        this.logger.log(`Human handoff triggered in chat ${chatId} by keyword.`);
        return; // Let human agents handle
      }
    }

    // Load recent conversation history for context memory
    const history: ChatHistoryItem[] = [];
    if (config.memoryDepth > 0) {
      try {
        const pastMessages = await this.messageRepository.find({
          where: { sessionId, chatId },
          order: { timestamp: 'DESC' },
          take: config.memoryDepth,
        });

        // Reverse to chronological order (oldest first)
        for (const msg of pastMessages.reverse()) {
          if (msg.body && msg.body.trim()) {
            history.push({
              role: msg.direction === MessageDirection.OUTGOING ? 'assistant' : 'user',
              text: msg.body.trim(),
            });
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch chat history for ${chatId}: ${String(err)}`);
      }
    }

    try {
      const reply = await this.callAiProvider({
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
        systemPrompt: config.systemPrompt,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        history,
        userMessage: body,
      });

      if (!reply || !reply.trim()) return;

      // Simulated human typing delay
      if (config.typingDelaySeconds > 0) {
        await new Promise(r => setTimeout(r, config.typingDelaySeconds * 1000));
      }

      const port = this.resolveMessagePort();
      if (!port) {
        this.logger.warn(`Cannot send AI response for session ${sessionId}: PluginMessagePort not bound`);
        return;
      }

      await port.sendText(sessionId, { chatId, text: reply.trim() });
      this.logger.log(`AI Bot auto-replied to ${chatId} using ${config.provider} (${config.model})`);
    } catch (err) {
      this.logger.error(`AI Bot generation failed for session ${sessionId}: ${String(err)}`);
    }
  }

  /** Multi-Provider Dispatcher */
  private async callAiProvider(params: {
    provider: string;
    apiKey: string;
    model: string;
    baseUrl?: string | null;
    systemPrompt?: string | null;
    temperature: number;
    maxTokens: number;
    history: ChatHistoryItem[];
    userMessage: string;
  }): Promise<string> {
    const { provider } = params;

    switch (provider) {
      case 'gemini':
        return this.callGemini(params);
      case 'claude':
        return this.callClaude(params);
      case 'openai':
      case 'custom':
      default:
        return this.callOpenAiOrCustom(params);
    }
  }

  /** OpenAI & Custom OpenAI-Compatible Endpoint */
  private async callOpenAiOrCustom(params: {
    apiKey: string;
    model: string;
    baseUrl?: string | null;
    systemPrompt?: string | null;
    temperature: number;
    maxTokens: number;
    history: ChatHistoryItem[];
    userMessage: string;
  }): Promise<string> {
    const baseUrl = params.baseUrl?.replace(/\/+$/, '') || 'https://api.openai.com/v1';
    const url = `${baseUrl}/chat/completions`;

    const messages: Array<{ role: string; content: string }> = [];

    if (params.systemPrompt && params.systemPrompt.trim()) {
      messages.push({ role: 'system', content: params.systemPrompt.trim() });
    }

    for (const h of params.history) {
      messages.push({ role: h.role, content: h.text });
    }

    messages.push({ role: 'user', content: params.userMessage });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model || 'gpt-4o-mini',
        messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;
    return data?.choices?.[0]?.message?.content || '';
  }

  /** Google Gemini REST API */
  private async callGemini(params: {
    apiKey: string;
    model: string;
    systemPrompt?: string | null;
    temperature: number;
    maxTokens: number;
    history: ChatHistoryItem[];
    userMessage: string;
  }): Promise<string> {
    const model = params.model || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(params.apiKey)}`;

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    for (const h of params.history) {
      contents.push({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.text }],
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: params.userMessage }],
    });

    const payload: Record<string, any> = {
      contents,
      generationConfig: {
        temperature: params.temperature,
        maxOutputTokens: params.maxTokens,
      },
    };

    if (params.systemPrompt && params.systemPrompt.trim()) {
      payload.systemInstruction = {
        parts: [{ text: params.systemPrompt.trim() }],
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  /** Anthropic Claude API */
  private async callClaude(params: {
    apiKey: string;
    model: string;
    systemPrompt?: string | null;
    temperature: number;
    maxTokens: number;
    history: ChatHistoryItem[];
    userMessage: string;
  }): Promise<string> {
    const url = 'https://api.anthropic.com/v1/messages';

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const h of params.history) {
      messages.push({ role: h.role, content: h.text });
    }

    messages.push({ role: 'user', content: params.userMessage });

    const payload: Record<string, any> = {
      model: params.model || 'claude-3-5-sonnet-20241022',
      messages,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
    };

    if (params.systemPrompt && params.systemPrompt.trim()) {
      payload.system = params.systemPrompt.trim();
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': params.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Claude API error (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;
    return data?.content?.[0]?.text || '';
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
