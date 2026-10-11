CREATE TABLE "agent_domain_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_key" text DEFAULT 'shared' NOT NULL,
	"store_key" text NOT NULL,
	"collection" text NOT NULL,
	"entity_key" text NOT NULL,
	"position" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"parent_id" text,
	"owner_role_id" text,
	"status" text,
	"version" integer DEFAULT 1 NOT NULL,
	"actor_type" text NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_domain_records_organization_id_owner_key_store_key_collection_entity_key_unique" UNIQUE("organization_id","owner_key","store_key","collection","entity_key"),
	CONSTRAINT "domain_record_version" CHECK ("agent_domain_records"."version">0),
	CONSTRAINT "domain_record_actor" CHECK ("agent_domain_records"."actor_type" in ('User','LegacyLocal'))
);

--> statement-breakpoint
CREATE TABLE "assessment_domain_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_key" text DEFAULT 'shared' NOT NULL,
	"store_key" text NOT NULL,
	"collection" text NOT NULL,
	"entity_key" text NOT NULL,
	"position" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"parent_id" text,
	"owner_role_id" text,
	"status" text,
	"version" integer DEFAULT 1 NOT NULL,
	"actor_type" text NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_domain_records_organization_id_owner_key_store_key_collection_entity_key_unique" UNIQUE("organization_id","owner_key","store_key","collection","entity_key"),
	CONSTRAINT "domain_record_version" CHECK ("assessment_domain_records"."version">0),
	CONSTRAINT "domain_record_actor" CHECK ("assessment_domain_records"."actor_type" in ('User','LegacyLocal'))
);

--> statement-breakpoint
CREATE TABLE "domain_store_headers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_key" text NOT NULL,
	"store_key" text NOT NULL,
	"metadata" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "domain_store_headers_organization_id_owner_key_store_key_unique" UNIQUE("organization_id","owner_key","store_key")
);

--> statement-breakpoint
CREATE TABLE "scale_domain_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_key" text DEFAULT 'shared' NOT NULL,
	"store_key" text NOT NULL,
	"collection" text NOT NULL,
	"entity_key" text NOT NULL,
	"position" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"parent_id" text,
	"owner_role_id" text,
	"status" text,
	"version" integer DEFAULT 1 NOT NULL,
	"actor_type" text NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scale_domain_records_organization_id_owner_key_store_key_collection_entity_key_unique" UNIQUE("organization_id","owner_key","store_key","collection","entity_key"),
	CONSTRAINT "domain_record_version" CHECK ("scale_domain_records"."version">0),
	CONSTRAINT "domain_record_actor" CHECK ("scale_domain_records"."actor_type" in ('User','LegacyLocal'))
);

--> statement-breakpoint
CREATE TABLE "strategy_domain_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_key" text DEFAULT 'shared' NOT NULL,
	"store_key" text NOT NULL,
	"collection" text NOT NULL,
	"entity_key" text NOT NULL,
	"position" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"parent_id" text,
	"owner_role_id" text,
	"status" text,
	"version" integer DEFAULT 1 NOT NULL,
	"actor_type" text NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "strategy_domain_records_organization_id_owner_key_store_key_collection_entity_key_unique" UNIQUE("organization_id","owner_key","store_key","collection","entity_key"),
	CONSTRAINT "domain_record_version" CHECK ("strategy_domain_records"."version">0),
	CONSTRAINT "domain_record_actor" CHECK ("strategy_domain_records"."actor_type" in ('User','LegacyLocal'))
);

--> statement-breakpoint
CREATE TABLE "system_domain_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_key" text DEFAULT 'shared' NOT NULL,
	"store_key" text NOT NULL,
	"collection" text NOT NULL,
	"entity_key" text NOT NULL,
	"position" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"parent_id" text,
	"owner_role_id" text,
	"status" text,
	"version" integer DEFAULT 1 NOT NULL,
	"actor_type" text NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_domain_records_organization_id_owner_key_store_key_collection_entity_key_unique" UNIQUE("organization_id","owner_key","store_key","collection","entity_key"),
	CONSTRAINT "domain_record_version" CHECK ("system_domain_records"."version">0),
	CONSTRAINT "domain_record_actor" CHECK ("system_domain_records"."actor_type" in ('User','LegacyLocal'))
);

--> statement-breakpoint
ALTER TABLE "agent_domain_records" ADD CONSTRAINT "agent_domain_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_domain_records" ADD CONSTRAINT "agent_domain_records_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_domain_records" ADD CONSTRAINT "agent_domain_records_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assessment_domain_records" ADD CONSTRAINT "assessment_domain_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assessment_domain_records" ADD CONSTRAINT "assessment_domain_records_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assessment_domain_records" ADD CONSTRAINT "assessment_domain_records_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "domain_store_headers" ADD CONSTRAINT "domain_store_headers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scale_domain_records" ADD CONSTRAINT "scale_domain_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scale_domain_records" ADD CONSTRAINT "scale_domain_records_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scale_domain_records" ADD CONSTRAINT "scale_domain_records_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "strategy_domain_records" ADD CONSTRAINT "strategy_domain_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "strategy_domain_records" ADD CONSTRAINT "strategy_domain_records_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "strategy_domain_records" ADD CONSTRAINT "strategy_domain_records_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "system_domain_records" ADD CONSTRAINT "system_domain_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "system_domain_records" ADD CONSTRAINT "system_domain_records_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "system_domain_records" ADD CONSTRAINT "system_domain_records_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "agent_domain_records_organization_id_store_key_collection_position_index" ON "agent_domain_records" USING btree ("organization_id","store_key","collection","position");
--> statement-breakpoint
CREATE INDEX "agent_domain_records_organization_id_parent_id_index" ON "agent_domain_records" USING btree ("organization_id","parent_id");
--> statement-breakpoint
CREATE INDEX "agent_domain_records_organization_id_status_index" ON "agent_domain_records" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "assessment_domain_records_organization_id_store_key_collection_position_index" ON "assessment_domain_records" USING btree ("organization_id","store_key","collection","position");
--> statement-breakpoint
CREATE INDEX "assessment_domain_records_organization_id_parent_id_index" ON "assessment_domain_records" USING btree ("organization_id","parent_id");
--> statement-breakpoint
CREATE INDEX "assessment_domain_records_organization_id_status_index" ON "assessment_domain_records" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "domain_store_headers_organization_id_index" ON "domain_store_headers" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "scale_domain_records_organization_id_store_key_collection_position_index" ON "scale_domain_records" USING btree ("organization_id","store_key","collection","position");
--> statement-breakpoint
CREATE INDEX "scale_domain_records_organization_id_parent_id_index" ON "scale_domain_records" USING btree ("organization_id","parent_id");
--> statement-breakpoint
CREATE INDEX "scale_domain_records_organization_id_status_index" ON "scale_domain_records" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "strategy_domain_records_organization_id_store_key_collection_position_index" ON "strategy_domain_records" USING btree ("organization_id","store_key","collection","position");
--> statement-breakpoint
CREATE INDEX "strategy_domain_records_organization_id_parent_id_index" ON "strategy_domain_records" USING btree ("organization_id","parent_id");
--> statement-breakpoint
CREATE INDEX "strategy_domain_records_organization_id_status_index" ON "strategy_domain_records" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "system_domain_records_organization_id_store_key_collection_position_index" ON "system_domain_records" USING btree ("organization_id","store_key","collection","position");
--> statement-breakpoint
CREATE INDEX "system_domain_records_organization_id_parent_id_index" ON "system_domain_records" USING btree ("organization_id","parent_id");
--> statement-breakpoint
CREATE INDEX "system_domain_records_organization_id_status_index" ON "system_domain_records" USING btree ("organization_id","status");