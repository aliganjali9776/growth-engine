CREATE TABLE "data_migrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "initiated_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "source" text NOT NULL,
  "source_schema_version" integer NOT NULL,
  "target_schema_version" integer NOT NULL,
  "status" text NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "entity_counts" jsonb NOT NULL,
  "warnings" jsonb NOT NULL,
  "error_summary" text,
  "checksum" text NOT NULL,
  CONSTRAINT "data_migration_status" CHECK ("status" IN ('Previewed','Running','Succeeded','Failed','RolledBack'))
);
--> statement-breakpoint
CREATE INDEX "data_migrations_organization_id_started_at_index" ON "data_migrations" ("organization_id", "started_at");
