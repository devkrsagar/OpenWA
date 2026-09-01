import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { ContactBook } from './entities/contact-book.entity';
import { ContactBookService } from './contact-book.service';
import { ContactBookController } from './contact-book.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ContactBook], 'data')],
  controllers: [ContactController, ContactBookController],
  providers: [ContactService, ContactBookService],
  exports: [ContactService, ContactBookService],
})
export class ContactModule {}
