import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersAndLinkRiders1746195600000 implements MigrationInterface {
  name = 'CreateUsersAndLinkRiders1746195600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL,
        "provider" character varying(255) NOT NULL,
        "provider_subject" character varying(255) NOT NULL,
        "email" character varying(320),
        "name" character varying(255),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_users_provider_subject_unique"
      ON "users" ("provider", "provider_subject")
    `);

    await queryRunner.query(`
      ALTER TABLE "riders"
      ADD COLUMN "user_id" uuid
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_riders_user_id_unique"
      ON "riders" ("user_id")
      WHERE "user_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_riders_user_id_unique"`);
    await queryRunner.query(`ALTER TABLE "riders" DROP COLUMN "user_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_users_provider_subject_unique"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
