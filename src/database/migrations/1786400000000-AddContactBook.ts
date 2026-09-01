import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContactBook1786400000000 implements MigrationInterface {
  name = 'AddContactBook1786400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('contact_book')) return;
    const isPostgres = queryRunner.dataSource.options.type === 'postgres';

    if (isPostgres) {
      await queryRunner.query(
        `CREATE TABLE "contact_book" (` +
          `"id" varchar PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::varchar, ` +
          `"sessionId" varchar, ` +
          `"phone" varchar(50) NOT NULL, ` +
          `"name" varchar(150) NOT NULL DEFAULT '', ` +
          `"email" varchar(150), ` +
          `"tags" text, ` +
          `"customFields" text, ` +
          `"notes" text, ` +
          `"createdAt" timestamp NOT NULL DEFAULT NOW(), ` +
          `"updatedAt" timestamp NOT NULL DEFAULT NOW()` +
        `)`,
      );
    } else {
      await queryRunner.query(
        `CREATE TABLE "contact_book" (` +
          `"id" varchar PRIMARY KEY NOT NULL, ` +
          `"sessionId" varchar, ` +
          `"phone" varchar(50) NOT NULL, ` +
          `"name" varchar(150) NOT NULL DEFAULT '', ` +
          `"email" varchar(150), ` +
          `"tags" text, ` +
          `"customFields" text, ` +
          `"notes" text, ` +
          `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
          `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
        `)`,
      );
    }

    await queryRunner.query(`CREATE INDEX "IDX_contact_book_phone" ON "contact_book" ("phone")`);
    await queryRunner.query(`CREATE INDEX "IDX_contact_book_session_phone" ON "contact_book" ("sessionId", "phone")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contact_book_session_phone"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contact_book_phone"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "contact_book"`);
  }
}
