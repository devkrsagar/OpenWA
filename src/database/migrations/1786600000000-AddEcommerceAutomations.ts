import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEcommerceAutomations1786600000000 implements MigrationInterface {
  name = 'AddEcommerceAutomations1786600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.dataSource.options.type === 'postgres';

    if (!await queryRunner.hasTable('ecommerce_automations')) {
      if (isPostgres) {
        await queryRunner.query(
          `CREATE TABLE "ecommerce_automations" (` +
            `"id" varchar PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::varchar, ` +
            `"sessionId" varchar NOT NULL, ` +
            `"name" varchar(150) NOT NULL, ` +
            `"platform" varchar(50) NOT NULL DEFAULT 'shopify', ` +
            `"eventType" varchar(50) NOT NULL DEFAULT 'order_created', ` +
            `"webhookSecret" varchar(255), ` +
            `"enabled" boolean NOT NULL DEFAULT true, ` +
            `"phoneFieldPath" varchar(255), ` +
            `"templateMessage" text NOT NULL, ` +
            `"delayMinutes" integer NOT NULL DEFAULT 0, ` +
            `"triggerCount" integer NOT NULL DEFAULT 0, ` +
            `"lastTriggeredAt" timestamp, ` +
            `"createdAt" timestamp NOT NULL DEFAULT NOW(), ` +
            `"updatedAt" timestamp NOT NULL DEFAULT NOW()` +
          `)`,
        );
      } else {
        await queryRunner.query(
          `CREATE TABLE "ecommerce_automations" (` +
            `"id" varchar PRIMARY KEY NOT NULL, ` +
            `"sessionId" varchar NOT NULL, ` +
            `"name" varchar(150) NOT NULL, ` +
            `"platform" varchar(50) NOT NULL DEFAULT 'shopify', ` +
            `"eventType" varchar(50) NOT NULL DEFAULT 'order_created', ` +
            `"webhookSecret" varchar(255), ` +
            `"enabled" boolean NOT NULL DEFAULT (1), ` +
            `"phoneFieldPath" varchar(255), ` +
            `"templateMessage" text NOT NULL, ` +
            `"delayMinutes" integer NOT NULL DEFAULT (0), ` +
            `"triggerCount" integer NOT NULL DEFAULT (0), ` +
            `"lastTriggeredAt" datetime, ` +
            `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
            `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
          `)`,
        );
      }

      await queryRunner.query(
        `CREATE INDEX "IDX_ecommerce_automations_sessionId" ON "ecommerce_automations" ("sessionId")`,
      );
    }

    if (!await queryRunner.hasTable('ecommerce_logs')) {
      if (isPostgres) {
        await queryRunner.query(
          `CREATE TABLE "ecommerce_logs" (` +
            `"id" varchar PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::varchar, ` +
            `"automationId" varchar NOT NULL, ` +
            `"sessionId" varchar NOT NULL, ` +
            `"eventType" varchar(50) NOT NULL, ` +
            `"platform" varchar(50) NOT NULL, ` +
            `"recipientPhone" varchar(100) NOT NULL, ` +
            `"orderId" varchar(100), ` +
            `"customerName" varchar(150), ` +
            `"status" varchar(50) NOT NULL DEFAULT 'delivered', ` +
            `"variablesJson" text, ` +
            `"messageText" text, ` +
            `"errorMessage" text, ` +
            `"createdAt" timestamp NOT NULL DEFAULT NOW()` +
          `)`,
        );
      } else {
        await queryRunner.query(
          `CREATE TABLE "ecommerce_logs" (` +
            `"id" varchar PRIMARY KEY NOT NULL, ` +
            `"automationId" varchar NOT NULL, ` +
            `"sessionId" varchar NOT NULL, ` +
            `"eventType" varchar(50) NOT NULL, ` +
            `"platform" varchar(50) NOT NULL, ` +
            `"recipientPhone" varchar(100) NOT NULL, ` +
            `"orderId" varchar(100), ` +
            `"customerName" varchar(150), ` +
            `"status" varchar(50) NOT NULL DEFAULT 'delivered', ` +
            `"variablesJson" text, ` +
            `"messageText" text, ` +
            `"errorMessage" text, ` +
            `"createdAt" datetime NOT NULL DEFAULT (datetime('now'))` +
          `)`,
        );
      }

      await queryRunner.query(
        `CREATE INDEX "IDX_ecommerce_logs_automationId" ON "ecommerce_logs" ("automationId")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_ecommerce_logs_sessionId" ON "ecommerce_logs" ("sessionId")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ecommerce_logs_sessionId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ecommerce_logs_automationId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ecommerce_logs"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ecommerce_automations_sessionId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ecommerce_automations"`);
  }
}
