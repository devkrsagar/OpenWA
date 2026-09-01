import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { ContactBook } from './entities/contact-book.entity';
import {
  CreateContactDto,
  UpdateContactDto,
  ImportContactsDto,
  BulkTagDto,
  BulkDeleteDto,
} from './dto/contact-book.dto';
import { createLogger } from '../../common/services/logger.service';

@Injectable()
export class ContactBookService {
  private readonly logger = createLogger('ContactBookService');

  constructor(
    @InjectRepository(ContactBook, 'data')
    private readonly contactBookRepo: Repository<ContactBook>,
  ) {}

  async findAll(params: {
    sessionId?: string;
    tag?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ContactBook[]; total: number }> {
    const { sessionId, tag, search, limit = 50, offset = 0 } = params;

    const queryBuilder = this.contactBookRepo.createQueryBuilder('contact');

    if (sessionId) {
      queryBuilder.andWhere('(contact.sessionId = :sessionId OR contact.sessionId IS NULL)', { sessionId });
    }

    if (search) {
      queryBuilder.andWhere(
        '(contact.name ILIKE :search OR contact.phone ILIKE :search OR contact.email ILIKE :search OR contact.notes ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Order by latest updated
    queryBuilder.orderBy('contact.updatedAt', 'DESC');

    const allMatches = await queryBuilder.getMany();

    // In-memory filter for tags (due to simple-json storage across SQLite/Postgres)
    let filtered = allMatches;
    if (tag && tag !== 'ALL') {
      filtered = allMatches.filter(c => Array.isArray(c.tags) && c.tags.includes(tag));
    }

    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit);

    return { items, total };
  }

  async getTags(sessionId?: string): Promise<Array<{ tag: string; count: number }>> {
    const query = this.contactBookRepo.createQueryBuilder('contact');
    if (sessionId) {
      query.where('(contact.sessionId = :sessionId OR contact.sessionId IS NULL)', { sessionId });
    }

    const contacts = await query.getMany();
    const tagCountMap = new Map<string, number>();

    for (const c of contacts) {
      if (Array.isArray(c.tags)) {
        for (const t of c.tags) {
          if (t && typeof t === 'string') {
            const cleanTag = t.trim();
            if (cleanTag) {
              tagCountMap.set(cleanTag, (tagCountMap.get(cleanTag) || 0) + 1);
            }
          }
        }
      }
    }

    return Array.from(tagCountMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }

  async findOne(id: string): Promise<ContactBook> {
    const contact = await this.contactBookRepo.findOne({ where: { id } });
    if (!contact) {
      throw new NotFoundException(`Contact with id ${id} not found`);
    }
    return contact;
  }

  async create(dto: CreateContactDto): Promise<ContactBook> {
    const cleanPhone = dto.phone.trim().replace(/\s+/g, '');
    const cleanTags = (dto.tags || []).map(t => t.trim()).filter(Boolean);

    let existing = await this.contactBookRepo.findOne({
      where: dto.sessionId ? { phone: cleanPhone, sessionId: dto.sessionId } : { phone: cleanPhone },
    });

    if (existing) {
      existing.name = dto.name !== undefined ? dto.name : existing.name;
      existing.email = dto.email !== undefined ? dto.email : existing.email;
      existing.notes = dto.notes !== undefined ? dto.notes : existing.notes;
      if (dto.tags) {
        const mergedTags = Array.from(new Set([...(existing.tags || []), ...cleanTags]));
        existing.tags = mergedTags;
      }
      if (dto.customFields) {
        existing.customFields = { ...(existing.customFields || {}), ...dto.customFields };
      }
      return this.contactBookRepo.save(existing);
    }

    const contact = this.contactBookRepo.create({
      sessionId: dto.sessionId || null,
      phone: cleanPhone,
      name: dto.name || '',
      email: dto.email || null,
      tags: cleanTags.length > 0 ? cleanTags : null,
      customFields: dto.customFields || null,
      notes: dto.notes || null,
    });

    return this.contactBookRepo.save(contact);
  }

  async update(id: string, dto: UpdateContactDto): Promise<ContactBook> {
    const contact = await this.findOne(id);

    if (dto.phone !== undefined) contact.phone = dto.phone.trim().replace(/\s+/g, '');
    if (dto.name !== undefined) contact.name = dto.name;
    if (dto.email !== undefined) contact.email = dto.email;
    if (dto.notes !== undefined) contact.notes = dto.notes;
    if (dto.tags !== undefined) {
      contact.tags = dto.tags.map(t => t.trim()).filter(Boolean);
    }
    if (dto.customFields !== undefined) {
      contact.customFields = dto.customFields;
    }

    return this.contactBookRepo.save(contact);
  }

  async delete(id: string): Promise<void> {
    const contact = await this.findOne(id);
    await this.contactBookRepo.remove(contact);
  }

  async importBatch(dto: ImportContactsDto): Promise<{ totalImported: number; totalUpdated: number }> {
    const defaultTags = (dto.defaultTags || []).map(t => t.trim()).filter(Boolean);
    let imported = 0;
    let updated = 0;

    for (const row of dto.contacts || []) {
      if (!row.phone) continue;
      const cleanPhone = row.phone.trim().replace(/\s+/g, '');
      const rowTags = (row.tags || []).map(t => t.trim()).filter(Boolean);
      const combinedTags = Array.from(new Set([...defaultTags, ...rowTags]));

      let contact = await this.contactBookRepo.findOne({
        where: dto.sessionId ? { phone: cleanPhone, sessionId: dto.sessionId } : { phone: cleanPhone },
      });

      if (contact) {
        if (row.name) contact.name = row.name;
        if (row.email) contact.email = row.email;
        if (row.notes) contact.notes = row.notes;
        contact.tags = Array.from(new Set([...(contact.tags || []), ...combinedTags]));
        if (row.customFields) {
          contact.customFields = { ...(contact.customFields || {}), ...row.customFields };
        }
        await this.contactBookRepo.save(contact);
        updated++;
      } else {
        contact = this.contactBookRepo.create({
          sessionId: dto.sessionId || null,
          phone: cleanPhone,
          name: row.name || '',
          email: row.email || null,
          tags: combinedTags.length > 0 ? combinedTags : null,
          customFields: row.customFields || null,
          notes: row.notes || null,
        });
        await this.contactBookRepo.save(contact);
        imported++;
      }
    }

    this.logger.log(`Imported batch: ${imported} created, ${updated} updated`);
    return { totalImported: imported, totalUpdated: updated };
  }

  async bulkTag(dto: BulkTagDto): Promise<{ updatedCount: number }> {
    if (!dto.contactIds || dto.contactIds.length === 0) return { updatedCount: 0 };

    const contacts = await this.contactBookRepo.find({
      where: { id: In(dto.contactIds) },
    });

    const addSet = new Set((dto.addTags || []).map(t => t.trim()).filter(Boolean));
    const removeSet = new Set((dto.removeTags || []).map(t => t.trim()).filter(Boolean));

    for (const c of contacts) {
      let currentTags = new Set(c.tags || []);
      for (const a of addSet) currentTags.add(a);
      for (const r of removeSet) currentTags.delete(r);
      c.tags = Array.from(currentTags);
    }

    await this.contactBookRepo.save(contacts);
    return { updatedCount: contacts.length };
  }

  async bulkDelete(dto: BulkDeleteDto): Promise<{ deletedCount: number }> {
    if (!dto.contactIds || dto.contactIds.length === 0) return { deletedCount: 0 };
    const res = await this.contactBookRepo.delete({ id: In(dto.contactIds) });
    return { deletedCount: res.affected || 0 };
  }
}
