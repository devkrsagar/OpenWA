import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScheduledDrip1786700000000 implements MigrationInterface {
  name = 'AddScheduledDrip1786700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.dataSource.options.type === 'postgres';

    // 1. scheduled_broadcasts
    if (!(await queryRunner.hasTable('scheduled_broadcasts'))) {
      if (isPostgres) {
        await queryRunner.query(
          `CREATE TABLE "scheduled_broadcasts" (` +
            `"id" varchar PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::varchar, ` +
            `"sessionId" varchar NOT NULL, ` +
            `"name" varchar(150) NOT NULL, ` +
            `"scheduledAt" timestamp NOT NULL, ` +
            `"status" varchar(50) NOT NULL DEFAULT 'scheduled', ` +
            `"targetType" varchar(50) NOT NULL DEFAULT 'tags', ` +
            `"targetAudience" text NOT NULL, ` +
            `"templateMessage" text NOT NULL, ` +
            `"pacingDelaySeconds" integer NOT NULL DEFAULT 3, ` +
            `"totalRecipients" integer NOT NULL DEFAULT 0, ` +
            `"sentCount" integer NOT NULL DEFAULT 0, ` +
            `"failedCount" integer NOT NULL DEFAULT 0, ` +
            `"executedAt" timestamp, ` +
            `"errorMessage" text, ` +
            `"createdAt" timestamp NOT NULL DEFAULT NOW(), ` +
            `"updatedAt" timestamp NOT NULL DEFAULT NOW()` +
          `)`,
        );
      } else {
        await queryRunner.query(
          `CREATE TABLE "scheduled_broadcasts" (` +
            `"id" varchar PRIMARY KEY NOT NULL, ` +
            `"sessionId" varchar NOT NULL, ` +
            `"name" varchar(150) NOT NULL, ` +
            `"scheduledAt" datetime NOT NULL, ` +
            `"status" varchar(50) NOT NULL DEFAULT 'scheduled', ` +
            `"targetType" varchar(50) NOT NULL DEFAULT 'tags', ` +
            `"targetAudience" text NOT NULL, ` +
            `"templateMessage" text NOT NULL, ` +
            `"pacingDelaySeconds" integer NOT NULL DEFAULT (3), ` +
            `"totalRecipients" integer NOT NULL DEFAULT (0), ` +
            `"sentCount" integer NOT NULL DEFAULT (0), ` +
            `"failedCount" integer NOT NULL DEFAULT (0), ` +
            `"executedAt" datetime, ` +
            `"errorMessage" text, ` +
            `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
            `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
          `)`,
        );
      }

      await queryRunner.query(
        `CREATE INDEX "IDX_scheduled_broadcasts_sessionId" ON "scheduled_broadcasts" ("sessionId")`,
      );
    }

    // 2. drip_sequences
    if (!(await queryRunner.hasTable('drip_sequences'))) {
      if (isPostgres) {
        await queryRunner.query(
          `CREATE TABLE "drip_sequences" (` +
            `"id" varchar PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::varchar, ` +
            `"sessionId" varchar NOT NULL, ` +
            `"name" varchar(150) NOT NULL, ` +
            `"description" text, ` +
            `"triggerTag" varchar(100) NOT NULL, ` +
            `"enabled" boolean NOT NULL DEFAULT true, ` +
            `"totalEnrolled" integer NOT NULL DEFAULT 0, ` +
            `"totalCompleted" integer NOT NULL DEFAULT 0, ` +
            `"createdAt" timestamp NOT NULL DEFAULT NOW(), ` +
            `"updatedAt" timestamp NOT NULL DEFAULT NOW()` +
          `)`,
        );
      } else {
        await queryRunner.query(
          `CREATE TABLE "drip_sequences" (` +
            `"id" varchar PRIMARY KEY NOT NULL, ` +
            `"sessionId" varchar NOT NULL, ` +
            `"name" varchar(150) NOT NULL, ` +
            `"description" text, ` +
            `"triggerTag" varchar(100) NOT NULL, ` +
            `"enabled" boolean NOT NULL DEFAULT (1), ` +
            `"totalEnrolled" integer NOT NULL DEFAULT (0), ` +
            `"totalCompleted" integer NOT NULL DEFAULT (0), ` +
            `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
            `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
          `)`,
        );
      }

      await queryRunner.query(
        `CREATE INDEX "IDX_drip_sequences_sessionId" ON "drip_sequences" ("sessionId")`,
      );
    }

    // 3. drip_steps
    if (!(await queryRunner.hasTable('drip_steps'))) {
      if (isPostgres) {
        await queryRunner.query(
          `CREATE TABLE "drip_steps" (` +
            `"id" varchar PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::varchar, ` +
            `"sequenceId" varchar NOT NULL, ` +
            `"stepOrder" integer NOT NULL DEFAULT 1, ` +
            `"delayHours" integer NOT NULL DEFAULT 0, ` +
            `"templateMessage" text NOT NULL, ` +
            `"sentCount" integer NOT NULL DEFAULT 0, ` +
            `"createdAt" timestamp NOT NULL DEFAULT NOW(), ` +
            `"updatedAt" timestamp NOT NULL DEFAULT NOW(), ` +
            `CONSTRAINT "FK_drip_steps_sequenceId" FOREIGN KEY ("sequenceId") REFERENCES "drip_sequences" ("id") ON DELETE CASCADE` +
          `)`,
        );
      } else {
        await queryRunner.query(
          `CREATE TABLE "drip_steps" (` +
            `"id" varchar PRIMARY KEY NOT NULL, ` +
            `"sequenceId" varchar NOT NULL, ` +
            `"stepOrder" integer NOT NULL DEFAULT (1), ` +
            `"delayHours" integer NOT NULL DEFAULT (0), ` +
            `"templateMessage" text NOT NULL, ` +
            `"sentCount" integer NOT NULL DEFAULT (0), ` +
            `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
            `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
          `)`,
        );
      }

      await queryRunner.query(
        `CREATE INDEX "IDX_drip_steps_sequenceId" ON "drip_steps" ("sequenceId")`,
      );
    }

    // 4. drip_subscribers
    if (!(await queryRunner.hasTable('drip_subscribers'))) {
      if (isPostgres) {
        await queryRunner.query(
          `CREATE TABLE "drip_subscribers" (` +
            `"id" varchar PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::varchar, ` +
            `"sequenceId" varchar NOT NULL, ` +
            `"sessionId" varchar NOT NULL, ` +
            `"phone" varchar(50) NOT NULL, ` +
            `"contactName" varchar(150), ` +
            `"currentStep" integer NOT NULL DEFAULT 1, ` +
            `"nextRunAt" timestamp NOT NULL, ` +
            `"status" varchar(50) NOT NULL DEFAULT 'active', ` +
            `"lastMessageSentAt" timestamp, ` +
            `"lastError" text, ` +
            `"createdAt" timestamp NOT NULL DEFAULT NOW(), ` +
            `"updatedAt" timestamp NOT NULL DEFAULT NOW()` +
          `)`,
        );
      } else {
        await queryRunner.query(
          `CREATE TABLE "drip_subscribers" (` +
            `"id" varchar PRIMARY KEY NOT NULL, ` +
            `"sequenceId" varchar NOT NULL, ` +
            `"sessionId" varchar NOT NULL, ` +
            `"phone" varchar(50) NOT NULL, ` +
            `"contactName" varchar(150), ` +
            `"currentStep" integer NOT NULL DEFAULT (1), ` +
            `"nextRunAt" datetime NOT NULL, ` +
            `"status" varchar(50) NOT NULL DEFAULT 'active', ` +
            `"lastMessageSentAt" datetime, ` +
            `"lastError" text, ` +
            `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
            `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
          `)`,
        );
      }

      await queryRunner.query(
        `CREATE INDEX "IDX_drip_subscribers_sequenceId" ON "drip_subscribers" ("sequenceId")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_drip_subscribers_sessionId" ON "drip_subscribers" ("sessionId")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_drip_subscribers_seq_phone" ON "drip_subscribers" ("sequenceId", "phone")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "drip_subscribers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "drip_steps"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "drip_sequences"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "scheduled_broadcasts"`);
  }
}
