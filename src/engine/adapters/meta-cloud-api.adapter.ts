import {
  IWhatsAppEngine,
  EngineStatus,
  EngineEventCallbacks,
  MessageResult,
  MediaInput,
  LocationInput,
  ContactCard,
  PollInput,
  CustomLinkPreview,
  Quotable,
  DeliveryStatus,
  IncomingMessage,
  Contact,
  Group,
  GroupInfo,
  ParticipantOperationResult,
  GroupMemberAddMode,
  GroupMembershipRequest,
  GroupJoinInfo,
  Label,
  LabelInput,
  ChatSummary,
  Status,
  StatusPostOptions,
  StatusResult,
  Channel,
  ChannelMessage,
  Catalog,
  Product,
  PaginatedProducts,
  ProductQueryOptions,
  ChatState,
  CallLinkType,
  MessageReaction,
} from '../interfaces/whatsapp-engine.interface';
import type { ChatKind } from '../identity/wa-id';
import { createLogger } from '../../common/services/logger.service';

export interface MetaCloudApiConfig {
  sessionId: string;
  phoneNumberId: string;
  accessToken: string;
  wabaId?: string;
  apiVersion?: string;
  displayPhoneNumber?: string;
  businessName?: string;
  verifyToken?: string;
}

export class MetaCloudApiAdapter implements IWhatsAppEngine {
  private readonly logger = createLogger('MetaCloudApiAdapter');
  private status: EngineStatus = EngineStatus.DISCONNECTED;
  private callbacks?: EngineEventCallbacks;
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly phoneNumberId: string;
  private readonly displayPhoneNumber: string;
  private readonly businessName: string;

  constructor(private readonly config: MetaCloudApiConfig) {
    this.phoneNumberId = config.phoneNumberId;
    this.accessToken = config.accessToken;
    this.displayPhoneNumber = config.displayPhoneNumber || config.phoneNumberId;
    this.businessName = config.businessName || 'Meta WhatsApp Business';

    const apiVersion = config.apiVersion || 'v20.0';
    this.baseUrl = `https://graph.facebook.com/${apiVersion}/${this.phoneNumberId}`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ──────────────────────────────────────────────────────────────────────────

  async initialize(callbacks: EngineEventCallbacks): Promise<void> {
    this.callbacks = callbacks;
    this.status = EngineStatus.AUTHENTICATING;
    callbacks.onStateChanged?.(this.status);

    try {
      // Validate credentials by pinging the phone number endpoint
      const res = await fetch(`${this.baseUrl}?fields=display_phone_number,verified_name,quality_rating`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (res.ok) {
        const data = (await res.json()) as { display_phone_number?: string; verified_name?: string };
        const phone = data?.display_phone_number || this.displayPhoneNumber;
        const pushName = data?.verified_name || this.businessName;

        this.status = EngineStatus.READY;
        callbacks.onStateChanged?.(this.status);
        callbacks.onReady?.(phone, pushName);

        this.logger.log(`Meta Cloud API initialized successfully for session ${this.config.sessionId}`, {
          action: 'meta_init_success',
          phone,
          pushName,
        });
        return;
      }

      const errData = await res.json().catch(() => ({}));
      const errMsg = (errData as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}`;
      this.logger.warn(`Meta Cloud API init verification: ${errMsg}. Setting READY with fallback values.`, {
        action: 'meta_init_warning',
        error: errMsg,
      });

      this.status = EngineStatus.READY;
      callbacks.onStateChanged?.(this.status);
      callbacks.onReady?.(this.displayPhoneNumber, this.businessName);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Meta Cloud API initialization warning: ${errMsg}. Setting READY with configured phone.`, {
        action: 'meta_init_warning',
        error: errMsg,
      });

      this.status = EngineStatus.READY;
      callbacks.onStateChanged?.(this.status);
      callbacks.onReady?.(this.displayPhoneNumber, this.businessName);
    }
  }

  async disconnect(): Promise<void> {
    this.status = EngineStatus.DISCONNECTED;
    this.callbacks?.onStateChanged?.(this.status);
    this.callbacks?.onDisconnected?.('Meta session disconnected');
  }

  async logout(): Promise<void> {
    await this.disconnect();
  }

  async destroy(): Promise<void> {
    await this.disconnect();
  }

  async forceDestroy(): Promise<void> {
    await this.disconnect();
  }

  getStatus(): EngineStatus {
    return this.status;
  }

  async probeLiveness(): Promise<boolean> {
    return this.status === EngineStatus.READY;
  }

  getQRCode(): string | null {
    return null;
  }

  async requestPairingCode(): Promise<string> {
    throw new Error('Pairing code is not applicable for Meta Official Cloud API. Use Access Token instead.');
  }

  getPhoneNumber(): string | null {
    return this.displayPhoneNumber;
  }

  getPushName(): string | null {
    return this.businessName;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Messaging Operations
  // ──────────────────────────────────────────────────────────────────────────

  private normalizeRecipient(chatId: string): string {
    return chatId.replace(/@c\.us|@s\.whatsapp\.net|\D/g, '');
  }

  private async postMetaMessage(payload: Record<string, unknown>, actionName: string): Promise<MessageResult> {
    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ id: string }>;
      error?: { message: string; code: number };
    };

    if (!res.ok || data.error) {
      const msg = data.error?.message || `Meta API Error (${res.status})`;
      const code = data.error?.code || res.status;
      this.logger.error(`Meta Cloud API error in ${actionName}: ${msg} (code ${code})`);
      throw new Error(`Meta API Error: ${msg} (code ${code})`);
    }

    const messageId = data.messages?.[0]?.id || `meta_${Date.now()}`;
    return { id: messageId, timestamp: Math.floor(Date.now() / 1000) };
  }

  async sendTextMessage(
    chatId: string,
    text: string,
    _mentions?: string[],
    options?: { linkPreview?: boolean; customPreview?: CustomLinkPreview } & Quotable,
  ): Promise<MessageResult> {
    const to = this.normalizeRecipient(chatId);
    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: options?.linkPreview ?? false,
        body: text,
      },
    };

    if (options?.quotedMessageId) {
      payload.context = { message_id: options.quotedMessageId };
    }

    return this.postMetaMessage(payload, 'sendTextMessage');
  }

  async sendImageMessage(chatId: string, media: MediaInput): Promise<MessageResult> {
    return this.sendMediaObject(chatId, 'image', media);
  }

  async sendVideoMessage(chatId: string, media: MediaInput): Promise<MessageResult> {
    return this.sendMediaObject(chatId, 'video', media);
  }

  async sendAudioMessage(chatId: string, media: MediaInput): Promise<MessageResult> {
    return this.sendMediaObject(chatId, 'audio', media);
  }

  async sendDocumentMessage(chatId: string, media: MediaInput): Promise<MessageResult> {
    return this.sendMediaObject(chatId, 'document', media);
  }

  async sendStickerMessage(chatId: string, media: MediaInput): Promise<MessageResult> {
    return this.sendMediaObject(chatId, 'sticker', media);
  }

  private async sendMediaObject(
    chatId: string,
    type: 'image' | 'video' | 'audio' | 'document' | 'sticker',
    media: MediaInput,
  ): Promise<MessageResult> {
    const to = this.normalizeRecipient(chatId);
    const mediaUrl = typeof media.data === 'string' ? media.data : '';

    const mediaObj: Record<string, unknown> = {
      link: mediaUrl,
    };
    if (media.caption && (type === 'image' || type === 'video' || type === 'document')) {
      mediaObj.caption = media.caption;
    }
    if (media.filename && type === 'document') {
      mediaObj.filename = media.filename;
    }

    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type,
      [type]: mediaObj,
    };

    if (media.quotedMessageId) {
      payload.context = { message_id: media.quotedMessageId };
    }

    return this.postMetaMessage(payload, `send${type.charAt(0).toUpperCase() + type.slice(1)}Message`);
  }

  async sendLocationMessage(chatId: string, location: LocationInput): Promise<MessageResult> {
    const to = this.normalizeRecipient(chatId);
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'location',
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        name: location.description || location.address,
        address: location.address,
      },
    };

    return this.postMetaMessage(payload, 'sendLocationMessage');
  }

  async sendContactMessage(chatId: string, contact: ContactCard): Promise<MessageResult> {
    const to = this.normalizeRecipient(chatId);
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'contacts',
      contacts: [
        {
          name: {
            formatted_name: contact.name,
            first_name: contact.name,
          },
          phones: [
            {
              phone: contact.number,
              type: 'CELL',
            },
          ],
        },
      ],
    };

    return this.postMetaMessage(payload, 'sendContactMessage');
  }

  async sendPollMessage(_chatId: string, _poll: PollInput): Promise<MessageResult> {
    throw new Error('Interactive polls are sent via template or interactive message components on Meta Cloud API.');
  }

  async replyToMessage(chatId: string, quotedMsgId: string, text: string, mentions?: string[]): Promise<MessageResult> {
    return this.sendTextMessage(chatId, text, mentions, { quotedMessageId: quotedMsgId });
  }

  async forwardMessage(_fromChatId: string, _toChatId: string, _messageId: string): Promise<MessageResult> {
    throw new Error('Forwarding by messageId directly is not supported by Meta Cloud API. Resend content instead.');
  }

  async reactToMessage(chatId: string, messageId: string, emoji: string): Promise<void> {
    const to = this.normalizeRecipient(chatId);
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'reaction',
      reaction: {
        message_id: messageId,
        emoji,
      },
    };

    await this.postMetaMessage(payload, 'reactToMessage');
  }

  async sendTemplateMessage(
    chatId: string,
    templateName: string,
    languageCode = 'en_US',
    components: unknown[] = [],
  ): Promise<MessageResult> {
    const to = this.normalizeRecipient(chatId);
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    };

    return this.postMetaMessage(payload, 'sendTemplateMessage');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Inbound Webhook Event Dispatcher
  // ──────────────────────────────────────────────────────────────────────────

  handleInboundWebhook(entry: any): void {
    if (!entry?.changes) return;

    for (const change of entry.changes) {
      const value = change.value;
      if (!value) continue;

      // Handle message statuses (delivered, read, sent, failed)
      if (value.statuses && Array.isArray(value.statuses)) {
        for (const status of value.statuses) {
          const msgId = status.id;
          const statusStr = status.status;
          let mappedStatus: DeliveryStatus = 'sent';

          if (statusStr === 'sent') mappedStatus = 'sent';
          else if (statusStr === 'delivered') mappedStatus = 'delivered';
          else if (statusStr === 'read') mappedStatus = 'read';
          else if (statusStr === 'failed') mappedStatus = 'failed';

          this.callbacks?.onMessageAck?.(msgId, mappedStatus);
        }
      }

      // Handle inbound messages
      if (value.messages && Array.isArray(value.messages)) {
        for (const msg of value.messages) {
          const from = `${msg.from}@c.us`;
          const to = `${this.displayPhoneNumber}@c.us`;
          const msgType = msg.type;
          let body = '';

          if (msgType === 'text') {
            body = msg.text?.body || '';
          } else if (msgType === 'image') {
            body = msg.image?.caption || '[Image]';
          } else if (msgType === 'video') {
            body = msg.video?.caption || '[Video]';
          } else if (msgType === 'document') {
            body = msg.document?.filename || '[Document]';
          } else if (msgType === 'button') {
            body = msg.button?.text || '';
          } else if (msgType === 'interactive') {
            body = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '';
          }

          const incomingMsg: IncomingMessage = {
            id: msg.id,
            from,
            to,
            chatId: from,
            body,
            type: msgType as any,
            timestamp: parseInt(msg.timestamp, 10) || Math.floor(Date.now() / 1000),
            fromMe: false,
            isGroup: false,
            kind: 'individual' as ChatKind,
          };

          this.callbacks?.onMessage?.(incomingMsg);
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Capability Stubs & Fallbacks
  // ──────────────────────────────────────────────────────────────────────────

  async getChatHistory(): Promise<IncomingMessage[]> { return []; }
  async getMessageReactions(): Promise<MessageReaction[]> { return []; }
  async deleteMessage(): Promise<void> {}
  async editMessage(): Promise<MessageResult> { throw new Error('Edit message is not supported by Meta Cloud API.'); }
  async starMessage(): Promise<void> {}
  async votePoll(): Promise<void> {}
  async pinMessage(): Promise<void> {}
  async unpinMessage(): Promise<void> {}
  async getChats(): Promise<ChatSummary[]> { return []; }
  async sendSeen(_chatId: string, messageIds?: string[]): Promise<boolean> {
    if (!messageIds || messageIds.length === 0) return true;
    for (const msgId of messageIds) {
      try {
        await fetch(`${this.baseUrl}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: msgId,
          }),
        });
      } catch {
        // Best-effort read receipt
      }
    }
    return true;
  }
  async markUnread(): Promise<boolean> { return true; }
  async deleteChat(): Promise<boolean> { return true; }
  async archiveChat(): Promise<boolean> { return true; }
  async pinChat(): Promise<boolean> { return true; }
  async muteChat(): Promise<void> {}
  async clearChatMessages(): Promise<boolean> { return true; }

  async getContacts(): Promise<Contact[]> { return []; }
  async getContactById(contactId: string): Promise<Contact | null> {
    return {
      id: contactId,
      number: this.normalizeRecipient(contactId),
      isMyContact: false,
      isBlocked: false,
    };
  }
  async checkNumberExists(): Promise<boolean> { return true; }
  async getNumberId(number: string): Promise<string | null> {
    const clean = this.normalizeRecipient(number);
    return clean ? `${clean}@c.us` : null;
  }
  async resolveContactPhone(contactId: string): Promise<string | null> {
    return this.normalizeRecipient(contactId) || null;
  }
  async getProfilePicture(): Promise<string | null> { return null; }
  async blockContact(): Promise<void> {}
  async unblockContact(): Promise<void> {}
  async getBlockedContacts(): Promise<string[]> { return []; }
  async upsertContact(): Promise<void> {}
  async deleteContact(): Promise<void> {}

  async getGroups(): Promise<Group[]> { return []; }
  async getGroupInfo(): Promise<GroupInfo | null> { return null; }
  async createGroup(): Promise<Group> { throw new Error('Groups are not managed via Meta Cloud API.'); }
  async addParticipants(): Promise<ParticipantOperationResult[]> { return []; }
  async removeParticipants(): Promise<ParticipantOperationResult[]> { return []; }
  async promoteParticipants(): Promise<ParticipantOperationResult[]> { return []; }
  async demoteParticipants(): Promise<ParticipantOperationResult[]> { return []; }
  async leaveGroup(): Promise<void> {}
  async setGroupSubject(): Promise<void> {}
  async setGroupDescription(): Promise<void> {}
  async getGroupInviteCode(): Promise<string> { return ''; }
  async revokeGroupInviteCode(): Promise<string> { return ''; }
  async joinGroupViaInviteCode(): Promise<string> { throw new Error('Not supported on Meta API'); }
  async getGroupJoinInfo(): Promise<GroupJoinInfo> { throw new Error('Not supported on Meta API'); }
  async setGroupMessagesAdminsOnly(): Promise<void> {}
  async setGroupInfoAdminsOnly(): Promise<void> {}
  async setGroupPicture(): Promise<void> {}
  async deleteGroupPicture(): Promise<void> {}
  async setGroupMemberAddMode(): Promise<void> {}
  async setGroupEphemeral(): Promise<void> {}
  async getGroupMembershipRequests(): Promise<GroupMembershipRequest[]> { return []; }
  async approveGroupMembershipRequests(): Promise<ParticipantOperationResult[]> { return []; }
  async rejectGroupMembershipRequests(): Promise<ParticipantOperationResult[]> { return []; }

  async rejectCall(): Promise<void> {}
  async createCallLink(): Promise<string> { throw new Error('Call links not supported on Meta API'); }

  async setProfileName(): Promise<void> {}
  async setProfileStatus(): Promise<void> {}
  async setProfilePicture(): Promise<void> {}
  async deleteProfilePicture(): Promise<void> {}

  async getLabels(): Promise<Label[]> { return []; }
  async getLabelById(): Promise<Label | null> { return null; }
  async getChatLabels(): Promise<Label[]> { return []; }
  async addLabelToChat(): Promise<void> {}
  async upsertLabel(): Promise<void> {}
  async deleteLabel(): Promise<void> {}
  async getChatsByLabel(): Promise<ChatSummary[]> { return []; }
  async removeLabelFromChat(): Promise<void> {}

  async getSubscribedChannels(): Promise<Channel[]> { return []; }
  async getChannelById(): Promise<Channel | null> { return null; }
  async subscribeToChannel(): Promise<Channel> { throw new Error('Not supported on Meta API'); }
  async unsubscribeFromChannel(): Promise<void> {}
  async getChannelMessages(): Promise<ChannelMessage[]> { return []; }
  async createChannel(): Promise<Channel> { throw new Error('Channels are not supported on Meta Cloud API.'); }
  async deleteChannel(): Promise<void> {}
  async muteChannel(): Promise<void> {}
  async demoteChannelAdmin(): Promise<void> {}
  async transferChannelOwnership(): Promise<void> {}

  async getContactStatuses(): Promise<Status[]> { return []; }
  async getContactStatus(): Promise<Status[]> { return []; }
  async postTextStatus(): Promise<StatusResult> { throw new Error('Status posting is not supported on Meta Cloud API.'); }
  async postImageStatus(): Promise<StatusResult> { throw new Error('Status posting is not supported on Meta Cloud API.'); }
  async postVideoStatus(): Promise<StatusResult> { throw new Error('Status posting is not supported on Meta Cloud API.'); }
  async postVoiceStatus(): Promise<StatusResult> { throw new Error('Status posting is not supported on Meta Cloud API.'); }
  async deleteStatus(): Promise<void> {}

  async getCatalog(): Promise<Catalog | null> { return null; }
  async getProducts(): Promise<PaginatedProducts> { return { products: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }; }
  async getProduct(): Promise<Product | null> { return null; }
  async sendProduct(): Promise<MessageResult> { throw new Error('Not supported on Meta API'); }
  async sendCatalog(): Promise<MessageResult> { throw new Error('Not supported on Meta API'); }

  async sendChatState(): Promise<void> {}
  async setOnlinePresence(): Promise<void> {}
  async subscribeToPresence(): Promise<void> {}
}
