import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ContactBookService } from './contact-book.service';
import {
  CreateContactDto,
  UpdateContactDto,
  ImportContactsDto,
  BulkTagDto,
  BulkDeleteDto,
} from './dto/contact-book.dto';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';

@ApiTags('contact-book')
@Controller('contact-book')
export class ContactBookController {
  constructor(private readonly contactBookService: ContactBookService) {}

  @Get()
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'List contacts with search, tag filter, and pagination' })
  @ApiQuery({ name: 'sessionId', required: false })
  @ApiQuery({ name: 'tag', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async findAll(
    @Query('sessionId') sessionId?: string,
    @Query('tag') tag?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.contactBookService.findAll({
      sessionId,
      tag,
      search,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
  }

  @Get('tags')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'List all unique tags and contact counts' })
  @ApiQuery({ name: 'sessionId', required: false })
  async getTags(@Query('sessionId') sessionId?: string) {
    return this.contactBookService.getTags(sessionId);
  }

  @Get(':id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Get contact by ID' })
  async findOne(@Param('id') id: string) {
    return this.contactBookService.findOne(id);
  }

  @Post()
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Create or upsert contact' })
  async create(@Body() dto: CreateContactDto) {
    return this.contactBookService.create(dto);
  }

  @Post('import')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Batch import contacts from CSV/JSON' })
  async importBatch(@Body() dto: ImportContactsDto) {
    return this.contactBookService.importBatch(dto);
  }

  @Post('bulk-tag')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Add or remove tags for multiple contacts' })
  async bulkTag(@Body() dto: BulkTagDto) {
    return this.contactBookService.bulkTag(dto);
  }

  @Post('bulk-delete')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Delete multiple contacts' })
  async bulkDelete(@Body() dto: BulkDeleteDto) {
    return this.contactBookService.bulkDelete(dto);
  }

  @Put(':id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Update contact' })
  async update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contactBookService.update(id, dto);
  }

  @Delete(':id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete contact' })
  async delete(@Param('id') id: string) {
    return this.contactBookService.delete(id);
  }
}
