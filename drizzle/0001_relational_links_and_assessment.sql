CREATE TABLE "assessment_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"run_id" uuid NOT NULL,
	"question_key" text NOT NULL,
	"answer" integer NOT NULL,
	CONSTRAINT "assessment_answers_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "assessment_answers_run_id_question_key_unique" UNIQUE("run_id","question_key"),
	CONSTRAINT "positive_version" CHECK ("assessment_answers"."version">0),
	CONSTRAINT "answer_range" CHECK ("assessment_answers"."answer" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "assessment_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"formula_version" text NOT NULL,
	CONSTRAINT "assessment_runs_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("assessment_runs"."version">0)
);
--> statement-breakpoint
CREATE TABLE "business_organization_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"department_id" uuid,
	"business_role_id" uuid,
	"parent_node_id" uuid,
	"x" numeric,
	"y" numeric,
	CONSTRAINT "business_organization_nodes_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("business_organization_nodes"."version">0),
	CONSTRAINT "node_entity" CHECK (("business_organization_nodes"."kind"='department' and "business_organization_nodes"."department_id" is not null and "business_organization_nodes"."business_role_id" is null) or ("business_organization_nodes"."kind"='role' and "business_organization_nodes"."business_role_id" is not null and "business_organization_nodes"."department_id" is null))
);
--> statement-breakpoint
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_organization_id_run_id_assessment_runs_organization_id_id_fk" FOREIGN KEY ("organization_id","run_id") REFERENCES "public"."assessment_runs"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_runs" ADD CONSTRAINT "assessment_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_organization_nodes" ADD CONSTRAINT "business_organization_nodes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_organization_nodes" ADD CONSTRAINT "business_organization_nodes_organization_id_department_id_business_departments_organization_id_id_fk" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."business_departments"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_organization_nodes" ADD CONSTRAINT "business_organization_nodes_organization_id_business_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","business_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_organization_nodes" ADD CONSTRAINT "business_organization_nodes_organization_id_parent_node_id_business_organization_nodes_organization_id_id_fk" FOREIGN KEY ("organization_id","parent_node_id") REFERENCES "public"."business_organization_nodes"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assessment_answers_organization_id_index" ON "assessment_answers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "assessment_runs_organization_id_index" ON "assessment_runs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "business_organization_nodes_organization_id_index" ON "business_organization_nodes" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "process_connections" ADD CONSTRAINT "process_connections_organization_id_source_step_id_process_steps_organization_id_id_fk" FOREIGN KEY ("organization_id","source_step_id") REFERENCES "public"."process_steps"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_connections" ADD CONSTRAINT "process_connections_organization_id_target_step_id_process_steps_organization_id_id_fk" FOREIGN KEY ("organization_id","target_step_id") REFERENCES "public"."process_steps"("organization_id","id") ON DELETE restrict ON UPDATE no action;