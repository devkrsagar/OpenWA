import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiBotConfig1786500000000 implements MigrationInterface {
  name = 'AddAiBotConfig1786500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('ai_bot_config')) return;
    const isPostgres = queryRunner.dataSource.options.type === 'postgres';

    if (isPostgres) {
      await queryRunner.query(
        `CREATE TABLE "ai_bot_config" (` +
          `"id" varchar PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::varchar, ` +
          `"sessionId" varchar UNIQUE NOT NULL, ` +
          `"enabled" boolean NOT NULL DEFAULT false, ` +
          `"provider" varchar(50) NOT NULL DEFAULT 'openai', ` +
          `"apiKey" text, ` +
          `"model" varchar(100) NOT NULL DEFAULT 'gpt-4o-mini', ` +
          `"baseUrl" varchar(255), ` +
          `"systemPrompt" text, ` +
          `"temperature" float NOT NULL DEFAULT 0.7, ` +
          `"maxTokens" integer NOT NULL DEFAULT 800, ` +
          `"memoryDepth" integer NOT NULL DEFAULT 10, ` +
          `"humanHandoffKeywords" text, ` +
          `"excludeGroups" boolean NOT NULL DEFAULT true, ` +
          `"typingDelaySeconds" integer NOT NULL DEFAULT 2, ` +
          `"createdAt" timestamp NOT NULL DEFAULT NOW(), ` +
          `"updatedAt" timestamp NOT NULL DEFAULT NOW()` +
        `)`,
      );
    } else {
      await queryRunner.query(
        `CREATE TABLE "ai_bot_config" (` +
          `"id" varchar PRIMARY KEY NOT NULL, ` +
          `"sessionId" varchar UNIQUE NOT NULL, ` +
          `"enabled" boolean NOT NULL DEFAULT (0), ` +
          `"provider" varchar(50) NOT NULL DEFAULT 'openai', ` +
          `"apiKey" text, ` +
          `"model" varchar(100) NOT NULL DEFAULT 'gpt-4o-mini', ` +
          `"baseUrl" varchar(255), ` +
          `"systemPrompt" text, ` +
          `"temperature" float NOT NULL DEFAULT (0.7), ` +
          `"maxTokens" integer NOT NULL DEFAULT (800), ` +
          `"memoryDepth" integer NOT NULL DEFAULT (10), ` +
          `"humanHandoffKeywords" text, ` +
          `"excludeGroups" boolean NOT NULL DEFAULT (1), ` +
          `"typingDelaySeconds" integer NOT NULL DEFAULT (2), ` +
          `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
          `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
        `)`,
      );
    }

    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ai_bot_config_sessionId" ON "ai_bot_config" ("sessionId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ai_bot_config_sessionId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_bot_config"`);
  }
}
