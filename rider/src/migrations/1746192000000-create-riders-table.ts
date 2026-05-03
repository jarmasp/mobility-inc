import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRidersTable1746192000000 implements MigrationInterface {
  name = 'CreateRidersTable1746192000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "riders" (
        "id" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "email" character varying(320) NOT NULL,
        "balance" numeric(12,2) NOT NULL DEFAULT 1000,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_riders_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_riders_email_unique" ON "riders" ("email")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_riders_email_unique"`);
    await queryRunner.query(`DROP TABLE "riders"`);
  }
}
