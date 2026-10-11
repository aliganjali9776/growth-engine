CREATE TABLE "access_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"system_role" boolean DEFAULT false NOT NULL,
	CONSTRAINT "access_roles_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "access_roles_organization_id_name_unique" UNIQUE("organization_id","name"),
	CONSTRAINT "positive_version" CHECK ("access_roles"."version">0)
);
--> statement-breakpoint
CREATE TABLE "strategy_adapt_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "strategy_adapt_reviews_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("strategy_adapt_reviews"."version">0)
);
--> statement-breakpoint
CREATE TABLE "agent_action_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"action_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "agent_action_revisions_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("agent_action_revisions"."version">0)
);
--> statement-breakpoint
CREATE TABLE "agent_proposed_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recommendation_id" uuid,
	"requested_by_user_id" uuid NOT NULL,
	"capability_id" text NOT NULL,
	"template_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"risk" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"binding" text NOT NULL,
	"payload" jsonb NOT NULL,
	"frozen_evidence" jsonb NOT NULL,
	"expected_state" jsonb NOT NULL,
	CONSTRAINT "agent_proposed_actions_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("agent_proposed_actions"."version">0),
	CONSTRAINT "action_revision" CHECK ("agent_proposed_actions"."revision">0)
);
--> statement-breakpoint
CREATE TABLE "agent_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"action_id" uuid NOT NULL,
	"approved_by_user_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"binding" text NOT NULL,
	"decision" text NOT NULL,
	"reason" text,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "agent_approvals_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "agent_approvals_organization_id_id_action_id_revision_binding_unique" UNIQUE("organization_id","id","action_id","revision","binding"),
	CONSTRAINT "positive_version" CHECK ("agent_approvals"."version">0),
	CONSTRAINT "approval_decision" CHECK ("agent_approvals"."decision" in ('Approved','Rejected'))
);
--> statement-breakpoint
CREATE TABLE "agent_diagnoses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"logical_key" text NOT NULL,
	"status" text NOT NULL,
	"severity" text NOT NULL,
	"confidence" text NOT NULL,
	"source_version" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "agent_diagnoses_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "agent_diagnoses_organization_id_logical_key_unique" UNIQUE("organization_id","logical_key"),
	CONSTRAINT "positive_version" CHECK ("agent_diagnoses"."version">0)
);
--> statement-breakpoint
CREATE TABLE "agent_diagnosis_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"diagnosis_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "agent_diagnosis_history_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("agent_diagnosis_history"."version">0)
);
--> statement-breakpoint
CREATE TABLE "agent_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"evidence_type" text NOT NULL,
	"domain" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"source_selector" text NOT NULL,
	"source_entity_type" text,
	"source_entity_id" uuid,
	"value" jsonb,
	"captured_at" timestamp with time zone NOT NULL,
	CONSTRAINT "agent_evidence_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("agent_evidence"."version">0)
);
--> statement-breakpoint
CREATE TABLE "agent_execution_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"action_id" uuid NOT NULL,
	"approval_id" uuid NOT NULL,
	"executed_by_user_id" uuid NOT NULL,
	"approved_revision" integer NOT NULL,
	"binding" text NOT NULL,
	"command_id" uuid NOT NULL,
	"capability_id" text NOT NULL,
	"status" text NOT NULL,
	"command" jsonb NOT NULL,
	"before_snapshot" jsonb NOT NULL,
	"after_snapshot" jsonb,
	"completed_at" timestamp with time zone,
	"error_code" text,
	CONSTRAINT "agent_execution_records_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "agent_execution_records_organization_id_command_id_unique" UNIQUE("organization_id","command_id"),
	CONSTRAINT "positive_version" CHECK ("agent_execution_records"."version">0)
);
--> statement-breakpoint
CREATE TABLE "agent_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"context_type" text,
	"context_entity_id" uuid,
	CONSTRAINT "agent_messages_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("agent_messages"."version">0)
);
--> statement-breakpoint
CREATE TABLE "agent_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"diagnosis_id" uuid,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"source_version" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "agent_recommendations_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("agent_recommendations"."version">0)
);
--> statement-breakpoint
CREATE TABLE "agent_rollback_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"execution_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "agent_rollback_records_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("agent_rollback_records"."version">0)
);
--> statement-breakpoint
CREATE TABLE "agent_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"context_type" text NOT NULL,
	"context_entity_id" uuid,
	"visibility" text DEFAULT 'private' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "agent_sessions_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("agent_sessions"."version">0)
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_type" text NOT NULL,
	"module" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_actor_type" CHECK ("audit_events"."actor_type" in ('User','Agent','System'))
);
--> statement-breakpoint
CREATE TABLE "business_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"department_id" uuid NOT NULL,
	"person_id" uuid,
	"reports_to_role_id" uuid,
	"purpose" text DEFAULT '' NOT NULL,
	"is_key_role" boolean DEFAULT false NOT NULL,
	"is_founder_role" boolean DEFAULT false NOT NULL,
	CONSTRAINT "business_roles_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("business_roles"."version">0)
);
--> statement-breakpoint
CREATE TABLE "capacity_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" text,
	"current_capacity" numeric,
	"current_demand" numeric,
	"owner_role_id" uuid,
	"notes" text,
	CONSTRAINT "capacity_areas_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("capacity_areas"."version">0)
);
--> statement-breakpoint
CREATE TABLE "capacity_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"name" text NOT NULL,
	"growth_multiplier" numeric,
	"assumptions" text,
	"notes" text,
	CONSTRAINT "capacity_scenarios_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("capacity_scenarios"."version">0)
);
--> statement-breakpoint
CREATE TABLE "channel_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"channel_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "channel_decisions_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("channel_decisions"."version">0)
);
--> statement-breakpoint
CREATE TABLE "channel_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"channel_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"spend" numeric,
	"leads" numeric,
	"qualified_leads" numeric,
	"customers" numeric,
	"revenue" numeric,
	"evidence" text,
	"notes" text,
	CONSTRAINT "channel_periods_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("channel_periods"."version">0)
);
--> statement-breakpoint
CREATE TABLE "growth_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"owner_role_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	CONSTRAINT "growth_channels_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("growth_channels"."version">0)
);
--> statement-breakpoint
CREATE TABLE "checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checklist_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	CONSTRAINT "checklist_items_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("checklist_items"."version">0)
);
--> statement-breakpoint
CREATE TABLE "process_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"process_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	CONSTRAINT "process_checklists_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("process_checklists"."version">0)
);
--> statement-breakpoint
CREATE TABLE "constraint_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"constraint_id" uuid NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "constraint_evidence_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("constraint_evidence"."version">0)
);
--> statement-breakpoint
CREATE TABLE "constraint_levers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"constraint_id" uuid NOT NULL,
	"lever_id" uuid NOT NULL,
	CONSTRAINT "constraint_levers_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("constraint_levers"."version">0)
);
--> statement-breakpoint
CREATE TABLE "growth_constraints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"dimension" text NOT NULL,
	"severity" text NOT NULL,
	"confidence" text,
	"status" text DEFAULT 'active' NOT NULL,
	"owner_role_id" uuid,
	"objective_id" uuid,
	"key_result_id" uuid,
	"process_id" uuid,
	"symptom" text,
	"impact" text,
	"notes" text,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "growth_constraints_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("growth_constraints"."version">0)
);
--> statement-breakpoint
CREATE TABLE "strategy_cycle_resets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "strategy_cycle_resets_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("strategy_cycle_resets"."version">0)
);
--> statement-breakpoint
CREATE TABLE "strategy_cycle_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "strategy_cycle_reviews_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("strategy_cycle_reviews"."version">0)
);
--> statement-breakpoint
CREATE TABLE "process_decision_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"process_id" uuid NOT NULL,
	"title" text NOT NULL,
	"condition" text NOT NULL,
	"action" text NOT NULL,
	"owner_role_id" uuid,
	CONSTRAINT "process_decision_rules_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("process_decision_rules"."version">0)
);
--> statement-breakpoint
CREATE TABLE "default_growth_levers" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "department_managers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"department_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "department_managers_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "department_managers_department_id_unique" UNIQUE("department_id"),
	CONSTRAINT "positive_version" CHECK ("department_managers"."version">0)
);
--> statement-breakpoint
CREATE TABLE "business_departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"parent_department_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "business_departments_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("business_departments"."version">0)
);
--> statement-breakpoint
CREATE TABLE "experiment_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "experiment_decisions_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("experiment_decisions"."version">0)
);
--> statement-breakpoint
CREATE TABLE "experiment_learnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "experiment_learnings_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("experiment_learnings"."version">0)
);
--> statement-breakpoint
CREATE TABLE "experiment_measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"metric_id" uuid NOT NULL,
	"value" numeric NOT NULL,
	"measured_at" date NOT NULL,
	"evidence" text,
	"notes" text,
	CONSTRAINT "experiment_measurements_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("experiment_measurements"."version">0)
);
--> statement-breakpoint
CREATE TABLE "experiment_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" text,
	"baseline" numeric,
	"target" numeric,
	"direction" text,
	CONSTRAINT "experiment_metrics_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("experiment_metrics"."version">0)
);
--> statement-breakpoint
CREATE TABLE "growth_experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"idea_id" uuid,
	"constraint_id" uuid NOT NULL,
	"owner_role_id" uuid,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"hypothesis" text NOT NULL,
	"intervention" text,
	"success_criterion" text,
	"primary_metric" text,
	"baseline" numeric,
	"target" numeric,
	"start_date" date,
	"end_date" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	CONSTRAINT "growth_experiments_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "growth_experiments_organization_id_code_unique" UNIQUE("organization_id","code"),
	CONSTRAINT "positive_version" CHECK ("growth_experiments"."version">0)
);
--> statement-breakpoint
CREATE TABLE "financial_capacity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"available_budget" numeric,
	"required_budget" numeric,
	"currency" text,
	"notes" text,
	CONSTRAINT "financial_capacity_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("financial_capacity"."version">0)
);
--> statement-breakpoint
CREATE TABLE "funnel_measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"period_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"volume" numeric,
	"revenue" numeric,
	"evidence" text,
	CONSTRAINT "funnel_measurements_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("funnel_measurements"."version">0)
);
--> statement-breakpoint
CREATE TABLE "funnel_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"funnel_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text NOT NULL,
	"notes" text,
	CONSTRAINT "funnel_periods_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("funnel_periods"."version">0)
);
--> statement-breakpoint
CREATE TABLE "funnel_revenue_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"funnel_id" uuid NOT NULL,
	"average_deal_value" numeric,
	"revenue_target" numeric,
	"currency" text,
	"period" text,
	CONSTRAINT "funnel_revenue_models_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("funnel_revenue_models"."version">0)
);
--> statement-breakpoint
CREATE TABLE "funnel_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"funnel_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"target_conversion" numeric,
	"owner_role_id" uuid,
	CONSTRAINT "funnel_stages_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("funnel_stages"."version">0)
);
--> statement-breakpoint
CREATE TABLE "growth_funnels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"description" text,
	"constraint_id" uuid,
	CONSTRAINT "growth_funnels_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("growth_funnels"."version">0)
);
--> statement-breakpoint
CREATE TABLE "growth_diagnostics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"profile_id" uuid NOT NULL,
	"dimension" text NOT NULL,
	"status" text NOT NULL,
	"evidence" text,
	"metric_value" numeric,
	"benchmark_type" text,
	"management_observation" text,
	CONSTRAINT "growth_diagnostics_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("growth_diagnostics"."version">0)
);
--> statement-breakpoint
CREATE TABLE "growth_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"value" numeric,
	"period" text,
	"unit" text,
	CONSTRAINT "growth_metrics_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("growth_metrics"."version">0)
);
--> statement-breakpoint
CREATE TABLE "growth_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"business_model" text,
	"growth_goal" text,
	"growth_horizon" text,
	"current_revenue" numeric,
	"target_revenue" numeric,
	"primary_metric" text,
	"linked_kr_id" uuid,
	"stage" text,
	"notes" text,
	CONSTRAINT "growth_profiles_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "growth_profiles_organization_id_unique" UNIQUE("organization_id"),
	CONSTRAINT "positive_version" CHECK ("growth_profiles"."version">0)
);
--> statement-breakpoint
CREATE TABLE "idea_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"idea_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "idea_history_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("idea_history"."version">0)
);
--> statement-breakpoint
CREATE TABLE "idea_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"idea_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "idea_reviews_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("idea_reviews"."version">0)
);
--> statement-breakpoint
CREATE TABLE "growth_ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"constraint_id" uuid NOT NULL,
	"lever_id" uuid,
	"owner_role_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"source" text NOT NULL,
	"rationale" text,
	"intervention" text,
	"success_metric" text,
	"confidence" text,
	"effort" text,
	"estimated_cost" text,
	"status" text DEFAULT 'inbox' NOT NULL,
	CONSTRAINT "growth_ideas_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("growth_ideas"."version">0)
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"key" text NOT NULL,
	"operation" text NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"result" jsonb,
	"status" text NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "idempotency_keys_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "idempotency_keys_organization_id_operation_key_unique" UNIQUE("organization_id","operation","key"),
	CONSTRAINT "positive_version" CHECK ("idempotency_keys"."version">0)
);
--> statement-breakpoint
CREATE TABLE "implementation_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"process_id" uuid NOT NULL,
	"owner_role_id" uuid,
	"target_go_live_date" date,
	"pilotStatus" text,
	"trainingStatus" text,
	"adoptionStatus" text,
	"notes" text,
	"source_signature" text,
	CONSTRAINT "implementation_plans_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("implementation_plans"."version">0)
);
--> statement-breakpoint
CREATE TABLE "improvements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"process_id" uuid NOT NULL,
	"owner_role_id" uuid,
	"title" text NOT NULL,
	"expected_impact" text,
	"due_date" date,
	"status" text DEFAULT 'backlog' NOT NULL,
	CONSTRAINT "improvements_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("improvements"."version">0)
);
--> statement-breakpoint
CREATE TABLE "strategy_initiatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"objective_id" uuid NOT NULL,
	"key_result_id" uuid,
	"process_id" uuid,
	"owner_role_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"start_date" date,
	"deadline" date,
	"expected_impact" text,
	CONSTRAINT "strategy_initiatives_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("strategy_initiatives"."version">0)
);
--> statement-breakpoint
CREATE TABLE "invitation_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "invitation_roles_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "invitation_roles_invitation_id_role_id_unique" UNIQUE("invitation_id","role_id"),
	CONSTRAINT "positive_version" CHECK ("invitation_roles"."version">0)
);
--> statement-breakpoint
CREATE TABLE "organization_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	CONSTRAINT "organization_invitations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "organization_invitations_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("organization_invitations"."version">0),
	CONSTRAINT "invitation_status" CHECK ("organization_invitations"."status" in ('Pending','Accepted','Revoked','Expired'))
);
--> statement-breakpoint
CREATE TABLE "key_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"objective_id" uuid NOT NULL,
	"owner_role_id" uuid,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"metric_type" text NOT NULL,
	"direction" text NOT NULL,
	"unit" text,
	"baseline" numeric,
	"target" numeric,
	"current" numeric,
	"weight" numeric,
	"confidence" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"deadline" date,
	CONSTRAINT "key_results_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "key_results_organization_id_objective_id_code_unique" UNIQUE("organization_id","objective_id","code"),
	CONSTRAINT "positive_version" CHECK ("key_results"."version">0)
);
--> statement-breakpoint
CREATE TABLE "kpi_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kpi_id" uuid NOT NULL,
	"value" numeric NOT NULL,
	"measured_at" date NOT NULL,
	"evidence" text,
	"notes" text,
	CONSTRAINT "kpi_entries_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("kpi_entries"."version">0)
);
--> statement-breakpoint
CREATE TABLE "kr_check_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"key_result_id" uuid NOT NULL,
	"current" numeric,
	"confidence" text,
	"notes" text,
	"checked_at" date NOT NULL,
	CONSTRAINT "kr_check_ins_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("kr_check_ins"."version">0)
);
--> statement-breakpoint
CREATE TABLE "kr_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"key_result_id" uuid NOT NULL,
	"title" text NOT NULL,
	"weight" numeric,
	"completed" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "kr_milestones_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("kr_milestones"."version">0)
);
--> statement-breakpoint
CREATE TABLE "tenant_growth_levers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"default_key" text,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "tenant_growth_levers_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "tenant_growth_levers_organization_id_default_key_unique" UNIQUE("organization_id","default_key"),
	CONSTRAINT "positive_version" CHECK ("tenant_growth_levers"."version">0)
);
--> statement-breakpoint
CREATE TABLE "loop_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"loop_id" uuid NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"recorded_at" date,
	CONSTRAINT "loop_evidence_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("loop_evidence"."version">0)
);
--> statement-breakpoint
CREATE TABLE "loop_leakage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"loop_id" uuid NOT NULL,
	"node_id" uuid,
	"description" text NOT NULL,
	"severity" text,
	"status" text,
	CONSTRAINT "loop_leakage_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("loop_leakage"."version">0)
);
--> statement-breakpoint
CREATE TABLE "loop_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"loop_id" uuid NOT NULL,
	"title" text NOT NULL,
	"position" integer NOT NULL,
	"type" text NOT NULL,
	"owner_role_id" uuid,
	"description" text,
	CONSTRAINT "loop_nodes_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("loop_nodes"."version">0)
);
--> statement-breakpoint
CREATE TABLE "loop_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"loop_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"input_volume" numeric,
	"output_volume" numeric,
	"evidence" text,
	"notes" text,
	CONSTRAINT "loop_periods_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("loop_periods"."version">0)
);
--> statement-breakpoint
CREATE TABLE "growth_loops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"owner_role_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"description" text,
	CONSTRAINT "growth_loops_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("growth_loops"."version">0)
);
--> statement-breakpoint
CREATE TABLE "membership_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"membership_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "membership_roles_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "membership_roles_membership_id_role_id_unique" UNIQUE("membership_id","role_id"),
	CONSTRAINT "positive_version" CHECK ("membership_roles"."version">0)
);
--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'Invited' NOT NULL,
	"invited_by_user_id" uuid,
	"joined_at" timestamp with time zone,
	CONSTRAINT "organization_memberships_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "organization_memberships_organization_id_user_id_unique" UNIQUE("organization_id","user_id"),
	CONSTRAINT "positive_version" CHECK ("organization_memberships"."version">0),
	CONSTRAINT "membership_status" CHECK ("organization_memberships"."status" in ('Invited','Active','Suspended','Removed'))
);
--> statement-breakpoint
CREATE TABLE "migration_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"imported_by_user_id" uuid NOT NULL,
	"export_schema_version" integer NOT NULL,
	"source" text NOT NULL,
	"content_hash" text NOT NULL,
	"status" text DEFAULT 'Staged' NOT NULL,
	"archive" jsonb NOT NULL,
	CONSTRAINT "migration_imports_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "migration_imports_organization_id_content_hash_unique" UNIQUE("organization_id","content_hash"),
	CONSTRAINT "positive_version" CHECK ("migration_imports"."version">0)
);
--> statement-breakpoint
CREATE TABLE "strategy_objectives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"priority_id" uuid,
	"owner_role_id" uuid,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"start_date" date NOT NULL,
	"deadline" date NOT NULL,
	"kr_weight_mode" text DEFAULT 'equal' NOT NULL,
	CONSTRAINT "strategy_objectives_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "strategy_objectives_organization_id_cycle_id_code_unique" UNIQUE("organization_id","cycle_id","code"),
	CONSTRAINT "positive_version" CHECK ("strategy_objectives"."version">0)
);
--> statement-breakpoint
CREATE TABLE "organization_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"monthly_revenue_range" text,
	"team_size" text,
	"growth_stage" text,
	"primary_market" text,
	"notes" text,
	"assessment_profile" jsonb,
	CONSTRAINT "organization_profiles_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "organization_profiles_organization_id_unique" UNIQUE("organization_id"),
	CONSTRAINT "positive_version" CHECK ("organization_profiles"."version">0)
);
--> statement-breakpoint
CREATE TABLE "organization_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locale" text DEFAULT 'fa-IR' NOT NULL,
	"timezone" text DEFAULT 'Asia/Tehran' NOT NULL,
	"currency" text DEFAULT 'IRR' NOT NULL,
	"week_start" integer DEFAULT 6 NOT NULL,
	"fiscal_year_start" text,
	"date_format" text DEFAULT 'jalali' NOT NULL,
	"brand_name" text,
	CONSTRAINT "organization_settings_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "organization_settings_organization_id_unique" UNIQUE("organization_id"),
	CONSTRAINT "positive_version" CHECK ("organization_settings"."version">0),
	CONSTRAINT "week_start" CHECK ("organization_settings"."week_start" between 0 and 6)
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"legal_name" text,
	"industry" text,
	"business_model" text,
	"country" text,
	"currency" text DEFAULT 'IRR' NOT NULL,
	"timezone" text DEFAULT 'Asia/Tehran' NOT NULL,
	"size" integer,
	"status" text DEFAULT 'Trial' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organization_status" CHECK ("organizations"."status" in ('Active','Trial','Suspended','Archived')),
	CONSTRAINT "organization_slug" CHECK ("organizations"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "business_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"job_title" text DEFAULT '' NOT NULL,
	"email" text,
	"avatar" text,
	"user_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "business_people_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("business_people"."version">0)
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"key" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_priorities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"owner_role_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"direction" text,
	"rank" integer NOT NULL,
	"rationale" text,
	"success_definition" text,
	"status" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "strategy_priorities_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "strategy_priorities_organization_id_cycle_id_id_unique" UNIQUE("organization_id","cycle_id","id"),
	CONSTRAINT "positive_version" CHECK ("strategy_priorities"."version">0)
);
--> statement-breakpoint
CREATE TABLE "process_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"process_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "process_analyses_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("process_analyses"."version">0)
);
--> statement-breakpoint
CREATE TABLE "process_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"process_id" uuid NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"url" text,
	"notes" text,
	CONSTRAINT "process_assets_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("process_assets"."version">0)
);
--> statement-breakpoint
CREATE TABLE "process_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"map_id" uuid NOT NULL,
	"source_step_id" uuid NOT NULL,
	"target_step_id" uuid NOT NULL,
	"label" text,
	"condition" text,
	CONSTRAINT "process_connections_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("process_connections"."version">0)
);
--> statement-breakpoint
CREATE TABLE "process_kpis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"process_id" uuid NOT NULL,
	"owner_role_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"unit" text NOT NULL,
	"direction" text NOT NULL,
	"target" numeric,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "process_kpis_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("process_kpis"."version">0)
);
--> statement-breakpoint
CREATE TABLE "process_maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"process_id" uuid NOT NULL,
	"variant" text NOT NULL,
	"direction" text DEFAULT 'RL' NOT NULL,
	"signature" text,
	"status" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "process_maps_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("process_maps"."version">0)
);
--> statement-breakpoint
CREATE TABLE "process_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"process_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "process_reviews_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("process_reviews"."version">0)
);
--> statement-breakpoint
CREATE TABLE "process_sops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"process_id" uuid NOT NULL,
	"title" text NOT NULL,
	"purpose" text,
	"scope" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"approved_at" timestamp with time zone,
	"source_signature" text,
	CONSTRAINT "process_sops_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("process_sops"."version">0)
);
--> statement-breakpoint
CREATE TABLE "process_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"map_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"input" text,
	"output" text,
	"owner_role_id" uuid,
	"work_time_minutes" numeric,
	"wait_time_minutes" numeric,
	"founder_dependency" text,
	"rework_probability" integer,
	"handoff" boolean,
	"notes" text,
	"x" numeric,
	"y" numeric,
	CONSTRAINT "process_steps_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("process_steps"."version">0)
);
--> statement-breakpoint
CREATE TABLE "processes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"value_chain" text NOT NULL,
	"department_id" uuid NOT NULL,
	"owner_role_id" uuid NOT NULL,
	"frequency" integer NOT NULL,
	"impact" integer NOT NULL,
	"variation" integer NOT NULL,
	"dependency" integer NOT NULL,
	"founder_dependency" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"systemization_stage" text DEFAULT 'identified' NOT NULL,
	"documentation_status" text DEFAULT 'none' NOT NULL,
	"adoption_status" text DEFAULT 'not-started' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	CONSTRAINT "processes_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "processes_organization_id_code_unique" UNIQUE("organization_id","code"),
	CONSTRAINT "positive_version" CHECK ("processes"."version">0),
	CONSTRAINT "process_ratings" CHECK ("processes"."frequency" between 1 and 3 and "processes"."impact" between 1 and 3 and "processes"."variation" between 1 and 3 and "processes"."dependency" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "scale_readiness_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "scale_readiness_snapshots_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("scale_readiness_snapshots"."version">0)
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_key" text NOT NULL,
	CONSTRAINT "role_permissions_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "role_permissions_role_id_permission_key_unique" UNIQUE("role_id","permission_key"),
	CONSTRAINT "positive_version" CHECK ("role_permissions"."version">0)
);
--> statement-breakpoint
CREATE TABLE "business_role_responsibilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "business_role_responsibilities_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "business_role_responsibilities_role_id_position_unique" UNIQUE("role_id","position"),
	CONSTRAINT "positive_version" CHECK ("business_role_responsibilities"."version">0)
);
--> statement-breakpoint
CREATE TABLE "scale_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"constraint_id" uuid,
	"experiment_id" uuid,
	"channel_id" uuid,
	"loop_id" uuid,
	"owner_role_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	CONSTRAINT "scale_candidates_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("scale_candidates"."version">0)
);
--> statement-breakpoint
CREATE TABLE "scale_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"reason" text NOT NULL,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone NOT NULL,
	CONSTRAINT "scale_decisions_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("scale_decisions"."version">0)
);
--> statement-breakpoint
CREATE TABLE "scale_investments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"title" text NOT NULL,
	"amount" numeric,
	"currency" text,
	"status" text,
	"notes" text,
	CONSTRAINT "scale_investments_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("scale_investments"."version">0)
);
--> statement-breakpoint
CREATE TABLE "scale_preparation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"title" text NOT NULL,
	"owner_role_id" uuid,
	"due_date" date,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	CONSTRAINT "scale_preparation_items_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("scale_preparation_items"."version">0)
);
--> statement-breakpoint
CREATE TABLE "scale_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "scale_snapshots_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("scale_snapshots"."version">0)
);
--> statement-breakpoint
CREATE TABLE "sop_procedures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sop_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"owner_role_id" uuid,
	CONSTRAINT "sop_procedures_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("sop_procedures"."version">0)
);
--> statement-breakpoint
CREATE TABLE "strategic_assumptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "strategic_assumptions_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("strategic_assumptions"."version">0)
);
--> statement-breakpoint
CREATE TABLE "strategy_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "strategy_changes_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("strategy_changes"."version">0)
);
--> statement-breakpoint
CREATE TABLE "strategy_choices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"type" text NOT NULL,
	"statement" text NOT NULL,
	"rationale" text,
	CONSTRAINT "strategy_choices_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("strategy_choices"."version">0)
);
--> statement-breakpoint
CREATE TABLE "strategy_contexts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"field" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "strategy_contexts_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("strategy_contexts"."version">0)
);
--> statement-breakpoint
CREATE TABLE "strategy_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"owner_role_id" uuid,
	"cycle_type" text DEFAULT 'quarterly' NOT NULL,
	"strategic_theme" text DEFAULT '' NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "strategy_cycles_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("strategy_cycles"."version">0),
	CONSTRAINT "cycle_dates" CHECK ("strategy_cycles"."start_date"<="strategy_cycles"."end_date")
);
--> statement-breakpoint
CREATE TABLE "strategy_learnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "strategy_learnings_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("strategy_learnings"."version">0)
);
--> statement-breakpoint
CREATE TABLE "strategy_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "strategy_snapshots_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("strategy_snapshots"."version">0)
);
--> statement-breakpoint
CREATE TABLE "system_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "system_snapshots_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("system_snapshots"."version">0)
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"last_organization_id" uuid,
	"locale" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"auth_provider_id" text,
	"name" text NOT NULL,
	"avatar_url" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"locale" text DEFAULT 'fa-IR' NOT NULL,
	"timezone" text DEFAULT 'Asia/Tehran' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_auth_provider_id_unique" UNIQUE("auth_provider_id"),
	CONSTRAINT "user_status" CHECK ("users"."status" in ('Active','Invited','Suspended','Disabled')),
	CONSTRAINT "email_normalized" CHECK ("users"."email"=lower(trim("users"."email")))
);
--> statement-breakpoint
CREATE TABLE "strategy_weekly_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "strategy_weekly_reviews_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "positive_version" CHECK ("strategy_weekly_reviews"."version">0)
);
--> statement-breakpoint
ALTER TABLE "access_roles" ADD CONSTRAINT "access_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_adapt_reviews" ADD CONSTRAINT "strategy_adapt_reviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_adapt_reviews" ADD CONSTRAINT "strategy_adapt_reviews_organization_id_cycle_id_strategy_cycles_organization_id_id_fk" FOREIGN KEY ("organization_id","cycle_id") REFERENCES "public"."strategy_cycles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_action_revisions" ADD CONSTRAINT "agent_action_revisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_action_revisions" ADD CONSTRAINT "agent_action_revisions_organization_id_action_id_agent_proposed_actions_organization_id_id_fk" FOREIGN KEY ("organization_id","action_id") REFERENCES "public"."agent_proposed_actions"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_proposed_actions" ADD CONSTRAINT "agent_proposed_actions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_proposed_actions" ADD CONSTRAINT "agent_proposed_actions_organization_id_recommendation_id_agent_recommendations_organization_id_id_fk" FOREIGN KEY ("organization_id","recommendation_id") REFERENCES "public"."agent_recommendations"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_proposed_actions" ADD CONSTRAINT "agent_proposed_actions_organization_id_requested_by_user_id_organization_memberships_organization_id_user_id_fk" FOREIGN KEY ("organization_id","requested_by_user_id") REFERENCES "public"."organization_memberships"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_approvals" ADD CONSTRAINT "agent_approvals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_approvals" ADD CONSTRAINT "agent_approvals_organization_id_action_id_agent_proposed_actions_organization_id_id_fk" FOREIGN KEY ("organization_id","action_id") REFERENCES "public"."agent_proposed_actions"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_approvals" ADD CONSTRAINT "agent_approvals_organization_id_approved_by_user_id_organization_memberships_organization_id_user_id_fk" FOREIGN KEY ("organization_id","approved_by_user_id") REFERENCES "public"."organization_memberships"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_diagnoses" ADD CONSTRAINT "agent_diagnoses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_diagnosis_history" ADD CONSTRAINT "agent_diagnosis_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_diagnosis_history" ADD CONSTRAINT "agent_diagnosis_history_organization_id_diagnosis_id_agent_diagnoses_organization_id_id_fk" FOREIGN KEY ("organization_id","diagnosis_id") REFERENCES "public"."agent_diagnoses"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_evidence" ADD CONSTRAINT "agent_evidence_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_execution_records" ADD CONSTRAINT "agent_execution_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_execution_records" ADD CONSTRAINT "agent_execution_records_organization_id_action_id_agent_proposed_actions_organization_id_id_fk" FOREIGN KEY ("organization_id","action_id") REFERENCES "public"."agent_proposed_actions"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_execution_records" ADD CONSTRAINT "agent_execution_records_organization_id_approval_id_action_id_approved_revision_binding_agent_approvals_organization_id_id_action_id_revision_binding_fk" FOREIGN KEY ("organization_id","approval_id","action_id","approved_revision","binding") REFERENCES "public"."agent_approvals"("organization_id","id","action_id","revision","binding") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_execution_records" ADD CONSTRAINT "agent_execution_records_organization_id_executed_by_user_id_organization_memberships_organization_id_user_id_fk" FOREIGN KEY ("organization_id","executed_by_user_id") REFERENCES "public"."organization_memberships"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_organization_id_session_id_agent_sessions_organization_id_id_fk" FOREIGN KEY ("organization_id","session_id") REFERENCES "public"."agent_sessions"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_recommendations" ADD CONSTRAINT "agent_recommendations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_recommendations" ADD CONSTRAINT "agent_recommendations_organization_id_diagnosis_id_agent_diagnoses_organization_id_id_fk" FOREIGN KEY ("organization_id","diagnosis_id") REFERENCES "public"."agent_diagnoses"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_rollback_records" ADD CONSTRAINT "agent_rollback_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_rollback_records" ADD CONSTRAINT "agent_rollback_records_organization_id_execution_id_agent_execution_records_organization_id_id_fk" FOREIGN KEY ("organization_id","execution_id") REFERENCES "public"."agent_execution_records"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_organization_id_created_by_user_id_organization_memberships_organization_id_user_id_fk" FOREIGN KEY ("organization_id","created_by_user_id") REFERENCES "public"."organization_memberships"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_roles" ADD CONSTRAINT "business_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_roles" ADD CONSTRAINT "business_roles_organization_id_department_id_business_departments_organization_id_id_fk" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."business_departments"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_roles" ADD CONSTRAINT "business_roles_organization_id_person_id_business_people_organization_id_id_fk" FOREIGN KEY ("organization_id","person_id") REFERENCES "public"."business_people"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_roles" ADD CONSTRAINT "business_roles_organization_id_reports_to_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","reports_to_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_areas" ADD CONSTRAINT "capacity_areas_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_areas" ADD CONSTRAINT "capacity_areas_organization_id_candidate_id_scale_candidates_organization_id_id_fk" FOREIGN KEY ("organization_id","candidate_id") REFERENCES "public"."scale_candidates"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_areas" ADD CONSTRAINT "capacity_areas_organization_id_owner_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","owner_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_scenarios" ADD CONSTRAINT "capacity_scenarios_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_scenarios" ADD CONSTRAINT "capacity_scenarios_organization_id_candidate_id_scale_candidates_organization_id_id_fk" FOREIGN KEY ("organization_id","candidate_id") REFERENCES "public"."scale_candidates"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_decisions" ADD CONSTRAINT "channel_decisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_decisions" ADD CONSTRAINT "channel_decisions_organization_id_channel_id_growth_channels_organization_id_id_fk" FOREIGN KEY ("organization_id","channel_id") REFERENCES "public"."growth_channels"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_periods" ADD CONSTRAINT "channel_periods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_periods" ADD CONSTRAINT "channel_periods_organization_id_channel_id_growth_channels_organization_id_id_fk" FOREIGN KEY ("organization_id","channel_id") REFERENCES "public"."growth_channels"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_channels" ADD CONSTRAINT "growth_channels_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_channels" ADD CONSTRAINT "growth_channels_organization_id_owner_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","owner_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_organization_id_checklist_id_process_checklists_organization_id_id_fk" FOREIGN KEY ("organization_id","checklist_id") REFERENCES "public"."process_checklists"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_checklists" ADD CONSTRAINT "process_checklists_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_checklists" ADD CONSTRAINT "process_checklists_organization_id_process_id_processes_organization_id_id_fk" FOREIGN KEY ("organization_id","process_id") REFERENCES "public"."processes"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "constraint_evidence" ADD CONSTRAINT "constraint_evidence_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "constraint_evidence" ADD CONSTRAINT "constraint_evidence_organization_id_constraint_id_growth_constraints_organization_id_id_fk" FOREIGN KEY ("organization_id","constraint_id") REFERENCES "public"."growth_constraints"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "constraint_levers" ADD CONSTRAINT "constraint_levers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "constraint_levers" ADD CONSTRAINT "constraint_levers_organization_id_constraint_id_growth_constraints_organization_id_id_fk" FOREIGN KEY ("organization_id","constraint_id") REFERENCES "public"."growth_constraints"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "constraint_levers" ADD CONSTRAINT "constraint_levers_organization_id_lever_id_tenant_growth_levers_organization_id_id_fk" FOREIGN KEY ("organization_id","lever_id") REFERENCES "public"."tenant_growth_levers"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_constraints" ADD CONSTRAINT "growth_constraints_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_constraints" ADD CONSTRAINT "growth_constraints_organization_id_owner_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","owner_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_constraints" ADD CONSTRAINT "growth_constraints_organization_id_objective_id_strategy_objectives_organization_id_id_fk" FOREIGN KEY ("organization_id","objective_id") REFERENCES "public"."strategy_objectives"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_constraints" ADD CONSTRAINT "growth_constraints_organization_id_key_result_id_key_results_organization_id_id_fk" FOREIGN KEY ("organization_id","key_result_id") REFERENCES "public"."key_results"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_constraints" ADD CONSTRAINT "growth_constraints_organization_id_process_id_processes_organization_id_id_fk" FOREIGN KEY ("organization_id","process_id") REFERENCES "public"."processes"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_cycle_resets" ADD CONSTRAINT "strategy_cycle_resets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_cycle_resets" ADD CONSTRAINT "strategy_cycle_resets_organization_id_cycle_id_strategy_cycles_organization_id_id_fk" FOREIGN KEY ("organization_id","cycle_id") REFERENCES "public"."strategy_cycles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_cycle_reviews" ADD CONSTRAINT "strategy_cycle_reviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_cycle_reviews" ADD CONSTRAINT "strategy_cycle_reviews_organization_id_cycle_id_strategy_cycles_organization_id_id_fk" FOREIGN KEY ("organization_id","cycle_id") REFERENCES "public"."strategy_cycles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_decision_rules" ADD CONSTRAINT "process_decision_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_decision_rules" ADD CONSTRAINT "process_decision_rules_organization_id_process_id_processes_organization_id_id_fk" FOREIGN KEY ("organization_id","process_id") REFERENCES "public"."processes"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_decision_rules" ADD CONSTRAINT "process_decision_rules_organization_id_owner_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","owner_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_managers" ADD CONSTRAINT "department_managers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_managers" ADD CONSTRAINT "department_managers_organization_id_department_id_business_departments_organization_id_id_fk" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."business_departments"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_managers" ADD CONSTRAINT "department_managers_organization_id_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_departments" ADD CONSTRAINT "business_departments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_departments" ADD CONSTRAINT "business_departments_organization_id_parent_department_id_business_departments_organization_id_id_fk" FOREIGN KEY ("organization_id","parent_department_id") REFERENCES "public"."business_departments"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_decisions" ADD CONSTRAINT "experiment_decisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_decisions" ADD CONSTRAINT "experiment_decisions_organization_id_experiment_id_growth_experiments_organization_id_id_fk" FOREIGN KEY ("organization_id","experiment_id") REFERENCES "public"."growth_experiments"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_learnings" ADD CONSTRAINT "experiment_learnings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_learnings" ADD CONSTRAINT "experiment_learnings_organization_id_experiment_id_growth_experiments_organization_id_id_fk" FOREIGN KEY ("organization_id","experiment_id") REFERENCES "public"."growth_experiments"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_measurements" ADD CONSTRAINT "experiment_measurements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_measurements" ADD CONSTRAINT "experiment_measurements_organization_id_experiment_id_growth_experiments_organization_id_id_fk" FOREIGN KEY ("organization_id","experiment_id") REFERENCES "public"."growth_experiments"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_measurements" ADD CONSTRAINT "experiment_measurements_organization_id_metric_id_experiment_metrics_organization_id_id_fk" FOREIGN KEY ("organization_id","metric_id") REFERENCES "public"."experiment_metrics"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_metrics" ADD CONSTRAINT "experiment_metrics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_metrics" ADD CONSTRAINT "experiment_metrics_organization_id_experiment_id_growth_experiments_organization_id_id_fk" FOREIGN KEY ("organization_id","experiment_id") REFERENCES "public"."growth_experiments"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_experiments" ADD CONSTRAINT "growth_experiments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_experiments" ADD CONSTRAINT "growth_experiments_organization_id_idea_id_growth_ideas_organization_id_id_fk" FOREIGN KEY ("organization_id","idea_id") REFERENCES "public"."growth_ideas"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_experiments" ADD CONSTRAINT "growth_experiments_organization_id_constraint_id_growth_constraints_organization_id_id_fk" FOREIGN KEY ("organization_id","constraint_id") REFERENCES "public"."growth_constraints"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_experiments" ADD CONSTRAINT "growth_experiments_organization_id_owner_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","owner_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_capacity" ADD CONSTRAINT "financial_capacity_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_capacity" ADD CONSTRAINT "financial_capacity_organization_id_candidate_id_scale_candidates_organization_id_id_fk" FOREIGN KEY ("organization_id","candidate_id") REFERENCES "public"."scale_candidates"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_measurements" ADD CONSTRAINT "funnel_measurements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_measurements" ADD CONSTRAINT "funnel_measurements_organization_id_period_id_funnel_periods_organization_id_id_fk" FOREIGN KEY ("organization_id","period_id") REFERENCES "public"."funnel_periods"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_measurements" ADD CONSTRAINT "funnel_measurements_organization_id_stage_id_funnel_stages_organization_id_id_fk" FOREIGN KEY ("organization_id","stage_id") REFERENCES "public"."funnel_stages"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_periods" ADD CONSTRAINT "funnel_periods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_periods" ADD CONSTRAINT "funnel_periods_organization_id_funnel_id_growth_funnels_organization_id_id_fk" FOREIGN KEY ("organization_id","funnel_id") REFERENCES "public"."growth_funnels"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_revenue_models" ADD CONSTRAINT "funnel_revenue_models_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_revenue_models" ADD CONSTRAINT "funnel_revenue_models_organization_id_funnel_id_growth_funnels_organization_id_id_fk" FOREIGN KEY ("organization_id","funnel_id") REFERENCES "public"."growth_funnels"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_stages" ADD CONSTRAINT "funnel_stages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_stages" ADD CONSTRAINT "funnel_stages_organization_id_funnel_id_growth_funnels_organization_id_id_fk" FOREIGN KEY ("organization_id","funnel_id") REFERENCES "public"."growth_funnels"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_stages" ADD CONSTRAINT "funnel_stages_organization_id_owner_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","owner_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_funnels" ADD CONSTRAINT "growth_funnels_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_funnels" ADD CONSTRAINT "growth_funnels_organization_id_constraint_id_growth_constraints_organization_id_id_fk" FOREIGN KEY ("organization_id","constraint_id") REFERENCES "public"."growth_constraints"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_diagnostics" ADD CONSTRAINT "growth_diagnostics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_diagnostics" ADD CONSTRAINT "growth_diagnostics_organization_id_profile_id_growth_profiles_organization_id_id_fk" FOREIGN KEY ("organization_id","profile_id") REFERENCES "public"."growth_profiles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_metrics" ADD CONSTRAINT "growth_metrics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_metrics" ADD CONSTRAINT "growth_metrics_organization_id_profile_id_growth_profiles_organization_id_id_fk" FOREIGN KEY ("organization_id","profile_id") REFERENCES "public"."growth_profiles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_profiles" ADD CONSTRAINT "growth_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_profiles" ADD CONSTRAINT "growth_profiles_organization_id_linked_kr_id_key_results_organization_id_id_fk" FOREIGN KEY ("organization_id","linked_kr_id") REFERENCES "public"."key_results"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_history" ADD CONSTRAINT "idea_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_history" ADD CONSTRAINT "idea_history_organization_id_idea_id_growth_ideas_organization_id_id_fk" FOREIGN KEY ("organization_id","idea_id") REFERENCES "public"."growth_ideas"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_reviews" ADD CONSTRAINT "idea_reviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_reviews" ADD CONSTRAINT "idea_reviews_organization_id_idea_id_growth_ideas_organization_id_id_fk" FOREIGN KEY ("organization_id","idea_id") REFERENCES "public"."growth_ideas"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_ideas" ADD CONSTRAINT "growth_ideas_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_ideas" ADD CONSTRAINT "growth_ideas_organization_id_constraint_id_growth_constraints_organization_id_id_fk" FOREIGN KEY ("organization_id","constraint_id") REFERENCES "public"."growth_constraints"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_ideas" ADD CONSTRAINT "growth_ideas_organization_id_lever_id_tenant_growth_levers_organization_id_id_fk" FOREIGN KEY ("organization_id","lever_id") REFERENCES "public"."tenant_growth_levers"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_ideas" ADD CONSTRAINT "growth_ideas_organization_id_owner_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","owner_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "implementation_plans" ADD CONSTRAINT "implementation_plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "implementation_plans" ADD CONSTRAINT "implementation_plans_organization_id_process_id_processes_organization_id_id_fk" FOREIGN KEY ("organization_id","process_id") REFERENCES "public"."processes"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "implementation_plans" ADD CONSTRAINT "implementation_plans_organization_id_owner_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","owner_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "improvements" ADD CONSTRAINT "improvements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "improvements" ADD CONSTRAINT "improvements_organization_id_process_id_processes_organization_id_id_fk" FOREIGN KEY ("organization_id","process_id") REFERENCES "public"."processes"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "improvements" ADD CONSTRAINT "improvements_organization_id_owner_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","owner_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_initiatives" ADD CONSTRAINT "strategy_initiatives_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_initiatives" ADD CONSTRAINT "strategy_initiatives_organization_id_objective_id_strategy_objectives_organization_id_id_fk" FOREIGN KEY ("organization_id","objective_id") REFERENCES "public"."strategy_objectives"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_initiatives" ADD CONSTRAINT "strategy_initiatives_organization_id_key_result_id_key_results_organization_id_id_fk" FOREIGN KEY ("organization_id","key_result_id") REFERENCES "public"."key_results"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_initiatives" ADD CONSTRAINT "strategy_initiatives_organization_id_process_id_processes_organization_id_id_fk" FOREIGN KEY ("organization_id","process_id") REFERENCES "public"."processes"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_initiatives" ADD CONSTRAINT "strategy_initiatives_organization_id_owner_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","owner_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_roles" ADD CONSTRAINT "invitation_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_roles" ADD CONSTRAINT "invitation_roles_organization_id_invitation_id_organization_invitations_organization_id_id_fk" FOREIGN KEY ("organization_id","invitation_id") REFERENCES "public"."organization_invitations"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_roles" ADD CONSTRAINT "invitation_roles_organization_id_role_id_access_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","role_id") REFERENCES "public"."access_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_organization_id_objective_id_strategy_objectives_organization_id_id_fk" FOREIGN KEY ("organization_id","objective_id") REFERENCES "public"."strategy_objectives"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_organization_id_owner_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","owner_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_entries" ADD CONSTRAINT "kpi_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_entries" ADD CONSTRAINT "kpi_entries_organization_id_kpi_id_process_kpis_organization_id_id_fk" FOREIGN KEY ("organization_id","kpi_id") REFERENCES "public"."process_kpis"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kr_check_ins" ADD CONSTRAINT "kr_check_ins_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kr_check_ins" ADD CONSTRAINT "kr_check_ins_organization_id_key_result_id_key_results_organization_id_id_fk" FOREIGN KEY ("organization_id","key_result_id") REFERENCES "public"."key_results"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kr_milestones" ADD CONSTRAINT "kr_milestones_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kr_milestones" ADD CONSTRAINT "kr_milestones_organization_id_key_result_id_key_results_organization_id_id_fk" FOREIGN KEY ("organization_id","key_result_id") REFERENCES "public"."key_results"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_growth_levers" ADD CONSTRAINT "tenant_growth_levers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_growth_levers" ADD CONSTRAINT "tenant_growth_levers_default_key_default_growth_levers_key_fk" FOREIGN KEY ("default_key") REFERENCES "public"."default_growth_levers"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loop_evidence" ADD CONSTRAINT "loop_evidence_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loop_evidence" ADD CONSTRAINT "loop_evidence_organization_id_loop_id_growth_loops_organization_id_id_fk" FOREIGN KEY ("organization_id","loop_id") REFERENCES "public"."growth_loops"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loop_leakage" ADD CONSTRAINT "loop_leakage_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loop_leakage" ADD CONSTRAINT "loop_leakage_organization_id_loop_id_growth_loops_organization_id_id_fk" FOREIGN KEY ("organization_id","loop_id") REFERENCES "public"."growth_loops"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loop_leakage" ADD CONSTRAINT "loop_leakage_organization_id_node_id_loop_nodes_organization_id_id_fk" FOREIGN KEY ("organization_id","node_id") REFERENCES "public"."loop_nodes"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loop_nodes" ADD CONSTRAINT "loop_nodes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loop_nodes" ADD CONSTRAINT "loop_nodes_organization_id_loop_id_growth_loops_organization_id_id_fk" FOREIGN KEY ("organization_id","loop_id") REFERENCES "public"."growth_loops"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loop_nodes" ADD CONSTRAINT "loop_nodes_organization_id_owner_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","owner_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loop_periods" ADD CONSTRAINT "loop_periods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loop_periods" ADD CONSTRAINT "loop_periods_organization_id_loop_id_growth_loops_organization_id_id_fk" FOREIGN KEY ("organization_id","loop_id") REFERENCES "public"."growth_loops"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_loops" ADD CONSTRAINT "growth_loops_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_loops" ADD CONSTRAINT "growth_loops_organization_id_owner_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","owner_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_organization_id_membership_id_organization_memberships_organization_id_id_fk" FOREIGN KEY ("organization_id","membership_id") REFERENCES "public"."organization_memberships"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_organization_id_role_id_access_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","role_id") REFERENCES "public"."access_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_imports" ADD CONSTRAINT "migration_imports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_imports" ADD CONSTRAINT "migration_imports_imported_by_user_id_users_id_fk" FOREIGN KEY ("imported_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_objectives" ADD CONSTRAINT "strategy_objectives_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_objectives" ADD CONSTRAINT "strategy_objectives_organization_id_cycle_id_strategy_cycles_organization_id_id_fk" FOREIGN KEY ("organization_id","cycle_id") REFERENCES "public"."strategy_cycles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_objectives" ADD CONSTRAINT "strategy_objectives_organization_id_owner_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","owner_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_objectives" ADD CONSTRAINT "strategy_objectives_organization_id_cycle_id_priority_id_strategy_priorities_organization_id_cycle_id_id_fk" FOREIGN KEY ("organization_id","cycle_id","priority_id") REFERENCES "public"."strategy_priorities"("organization_id","cycle_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_people" ADD CONSTRAINT "business_people_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_people" ADD CONSTRAINT "business_people_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_priorities" ADD CONSTRAINT "strategy_priorities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_priorities" ADD CONSTRAINT "strategy_priorities_organization_id_cycle_id_strategy_cycles_organization_id_id_fk" FOREIGN KEY ("organization_id","cycle_id") REFERENCES "public"."strategy_cycles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_priorities" ADD CONSTRAINT "strategy_priorities_organization_id_owner_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","owner_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_analyses" ADD CONSTRAINT "process_analyses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_analyses" ADD CONSTRAINT "process_analyses_organization_id_process_id_processes_organization_id_id_fk" FOREIGN KEY ("organization_id","process_id") REFERENCES "public"."processes"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_assets" ADD CONSTRAINT "process_assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_assets" ADD CONSTRAINT "process_assets_organization_id_process_id_processes_organization_id_id_fk" FOREIGN KEY ("organization_id","process_id") REFERENCES "public"."processes"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_connections" ADD CONSTRAINT "process_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_connections" ADD CONSTRAINT "process_connections_organization_id_map_id_process_maps_organization_id_id_fk" FOREIGN KEY ("organization_id","map_id") REFERENCES "public"."process_maps"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_kpis" ADD CONSTRAINT "process_kpis_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_kpis" ADD CONSTRAINT "process_kpis_organization_id_process_id_processes_organization_id_id_fk" FOREIGN KEY ("organization_id","process_id") REFERENCES "public"."processes"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_kpis" ADD CONSTRAINT "process_kpis_organization_id_owner_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","owner_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_maps" ADD CONSTRAINT "process_maps_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_maps" ADD CONSTRAINT "process_maps_organization_id_process_id_processes_organization_id_id_fk" FOREIGN KEY ("organization_id","process_id") REFERENCES "public"."processes"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_reviews" ADD CONSTRAINT "process_reviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_reviews" ADD CONSTRAINT "process_reviews_organization_id_process_id_processes_organization_id_id_fk" FOREIGN KEY ("organization_id","process_id") REFERENCES "public"."processes"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_sops" ADD CONSTRAINT "process_sops_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_sops" ADD CONSTRAINT "process_sops_organization_id_process_id_processes_organization_id_id_fk" FOREIGN KEY ("organization_id","process_id") REFERENCES "public"."processes"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_steps" ADD CONSTRAINT "process_steps_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_steps" ADD CONSTRAINT "process_steps_organization_id_map_id_process_maps_organization_id_id_fk" FOREIGN KEY ("organization_id","map_id") REFERENCES "public"."process_maps"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_steps" ADD CONSTRAINT "process_steps_organization_id_owner_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","owner_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processes" ADD CONSTRAINT "processes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processes" ADD CONSTRAINT "processes_organization_id_department_id_business_departments_organization_id_id_fk" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."business_departments"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processes" ADD CONSTRAINT "processes_organization_id_owner_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","owner_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_readiness_snapshots" ADD CONSTRAINT "scale_readiness_snapshots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_readiness_snapshots" ADD CONSTRAINT "scale_readiness_snapshots_organization_id_candidate_id_scale_candidates_organization_id_id_fk" FOREIGN KEY ("organization_id","candidate_id") REFERENCES "public"."scale_candidates"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_permissions_key_fk" FOREIGN KEY ("permission_key") REFERENCES "public"."permissions"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_organization_id_role_id_access_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","role_id") REFERENCES "public"."access_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_role_responsibilities" ADD CONSTRAINT "business_role_responsibilities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_role_responsibilities" ADD CONSTRAINT "business_role_responsibilities_organization_id_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_candidates" ADD CONSTRAINT "scale_candidates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_candidates" ADD CONSTRAINT "scale_candidates_organization_id_constraint_id_growth_constraints_organization_id_id_fk" FOREIGN KEY ("organization_id","constraint_id") REFERENCES "public"."growth_constraints"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_candidates" ADD CONSTRAINT "scale_candidates_organization_id_experiment_id_growth_experiments_organization_id_id_fk" FOREIGN KEY ("organization_id","experiment_id") REFERENCES "public"."growth_experiments"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_candidates" ADD CONSTRAINT "scale_candidates_organization_id_channel_id_growth_channels_organization_id_id_fk" FOREIGN KEY ("organization_id","channel_id") REFERENCES "public"."growth_channels"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_candidates" ADD CONSTRAINT "scale_candidates_organization_id_loop_id_growth_loops_organization_id_id_fk" FOREIGN KEY ("organization_id","loop_id") REFERENCES "public"."growth_loops"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_candidates" ADD CONSTRAINT "scale_candidates_organization_id_owner_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","owner_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_decisions" ADD CONSTRAINT "scale_decisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_decisions" ADD CONSTRAINT "scale_decisions_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_decisions" ADD CONSTRAINT "scale_decisions_organization_id_candidate_id_scale_candidates_organization_id_id_fk" FOREIGN KEY ("organization_id","candidate_id") REFERENCES "public"."scale_candidates"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_investments" ADD CONSTRAINT "scale_investments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_investments" ADD CONSTRAINT "scale_investments_organization_id_candidate_id_scale_candidates_organization_id_id_fk" FOREIGN KEY ("organization_id","candidate_id") REFERENCES "public"."scale_candidates"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_preparation_items" ADD CONSTRAINT "scale_preparation_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_preparation_items" ADD CONSTRAINT "scale_preparation_items_organization_id_candidate_id_scale_candidates_organization_id_id_fk" FOREIGN KEY ("organization_id","candidate_id") REFERENCES "public"."scale_candidates"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_preparation_items" ADD CONSTRAINT "scale_preparation_items_organization_id_owner_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","owner_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_snapshots" ADD CONSTRAINT "scale_snapshots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_procedures" ADD CONSTRAINT "sop_procedures_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_procedures" ADD CONSTRAINT "sop_procedures_organization_id_sop_id_process_sops_organization_id_id_fk" FOREIGN KEY ("organization_id","sop_id") REFERENCES "public"."process_sops"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_procedures" ADD CONSTRAINT "sop_procedures_organization_id_owner_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","owner_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_assumptions" ADD CONSTRAINT "strategic_assumptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_assumptions" ADD CONSTRAINT "strategic_assumptions_organization_id_cycle_id_strategy_cycles_organization_id_id_fk" FOREIGN KEY ("organization_id","cycle_id") REFERENCES "public"."strategy_cycles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_changes" ADD CONSTRAINT "strategy_changes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_changes" ADD CONSTRAINT "strategy_changes_organization_id_cycle_id_strategy_cycles_organization_id_id_fk" FOREIGN KEY ("organization_id","cycle_id") REFERENCES "public"."strategy_cycles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_choices" ADD CONSTRAINT "strategy_choices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_choices" ADD CONSTRAINT "strategy_choices_organization_id_cycle_id_strategy_cycles_organization_id_id_fk" FOREIGN KEY ("organization_id","cycle_id") REFERENCES "public"."strategy_cycles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_contexts" ADD CONSTRAINT "strategy_contexts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_contexts" ADD CONSTRAINT "strategy_contexts_organization_id_cycle_id_strategy_cycles_organization_id_id_fk" FOREIGN KEY ("organization_id","cycle_id") REFERENCES "public"."strategy_cycles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_cycles" ADD CONSTRAINT "strategy_cycles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_cycles" ADD CONSTRAINT "strategy_cycles_organization_id_owner_role_id_business_roles_organization_id_id_fk" FOREIGN KEY ("organization_id","owner_role_id") REFERENCES "public"."business_roles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_learnings" ADD CONSTRAINT "strategy_learnings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_learnings" ADD CONSTRAINT "strategy_learnings_organization_id_cycle_id_strategy_cycles_organization_id_id_fk" FOREIGN KEY ("organization_id","cycle_id") REFERENCES "public"."strategy_cycles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_snapshots" ADD CONSTRAINT "strategy_snapshots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_snapshots" ADD CONSTRAINT "strategy_snapshots_organization_id_cycle_id_strategy_cycles_organization_id_id_fk" FOREIGN KEY ("organization_id","cycle_id") REFERENCES "public"."strategy_cycles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_snapshots" ADD CONSTRAINT "system_snapshots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_last_organization_id_organizations_id_fk" FOREIGN KEY ("last_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_weekly_reviews" ADD CONSTRAINT "strategy_weekly_reviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_weekly_reviews" ADD CONSTRAINT "strategy_weekly_reviews_organization_id_cycle_id_strategy_cycles_organization_id_id_fk" FOREIGN KEY ("organization_id","cycle_id") REFERENCES "public"."strategy_cycles"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_roles_organization_id_index" ON "access_roles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "strategy_adapt_reviews_organization_id_index" ON "strategy_adapt_reviews" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "agent_action_revisions_organization_id_index" ON "agent_action_revisions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "agent_proposed_actions_organization_id_index" ON "agent_proposed_actions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "agent_approvals_organization_id_index" ON "agent_approvals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "agent_diagnoses_organization_id_index" ON "agent_diagnoses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "agent_diagnosis_history_organization_id_index" ON "agent_diagnosis_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "agent_evidence_organization_id_index" ON "agent_evidence" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "agent_execution_records_organization_id_index" ON "agent_execution_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "agent_messages_organization_id_index" ON "agent_messages" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "agent_messages_organization_id_session_id_created_at_index" ON "agent_messages" USING btree ("organization_id","session_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_recommendations_organization_id_index" ON "agent_recommendations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "agent_rollback_records_organization_id_index" ON "agent_rollback_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "agent_sessions_organization_id_index" ON "agent_sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "agent_sessions_organization_id_created_by_user_id_index" ON "agent_sessions" USING btree ("organization_id","created_by_user_id");--> statement-breakpoint
CREATE INDEX "audit_events_organization_id_created_at_index" ON "audit_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "business_roles_organization_id_index" ON "business_roles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "capacity_areas_organization_id_index" ON "capacity_areas" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "capacity_scenarios_organization_id_index" ON "capacity_scenarios" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "channel_decisions_organization_id_index" ON "channel_decisions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "channel_periods_organization_id_index" ON "channel_periods" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "growth_channels_organization_id_index" ON "growth_channels" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "checklist_items_organization_id_index" ON "checklist_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "process_checklists_organization_id_index" ON "process_checklists" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "constraint_evidence_organization_id_index" ON "constraint_evidence" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "constraint_levers_organization_id_index" ON "constraint_levers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "growth_constraints_organization_id_index" ON "growth_constraints" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "strategy_cycle_resets_organization_id_index" ON "strategy_cycle_resets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "strategy_cycle_reviews_organization_id_index" ON "strategy_cycle_reviews" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "process_decision_rules_organization_id_index" ON "process_decision_rules" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "department_managers_organization_id_index" ON "department_managers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "business_departments_organization_id_index" ON "business_departments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "experiment_decisions_organization_id_index" ON "experiment_decisions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "experiment_learnings_organization_id_index" ON "experiment_learnings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "experiment_measurements_organization_id_index" ON "experiment_measurements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "experiment_metrics_organization_id_index" ON "experiment_metrics" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "growth_experiments_organization_id_index" ON "growth_experiments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "growth_experiments_organization_id_constraint_id_index" ON "growth_experiments" USING btree ("organization_id","constraint_id");--> statement-breakpoint
CREATE INDEX "financial_capacity_organization_id_index" ON "financial_capacity" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "funnel_measurements_organization_id_index" ON "funnel_measurements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "funnel_periods_organization_id_index" ON "funnel_periods" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "funnel_revenue_models_organization_id_index" ON "funnel_revenue_models" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "funnel_stages_organization_id_index" ON "funnel_stages" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "growth_funnels_organization_id_index" ON "growth_funnels" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "growth_diagnostics_organization_id_index" ON "growth_diagnostics" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "growth_metrics_organization_id_index" ON "growth_metrics" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "growth_profiles_organization_id_index" ON "growth_profiles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idea_history_organization_id_index" ON "idea_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idea_reviews_organization_id_index" ON "idea_reviews" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "growth_ideas_organization_id_index" ON "growth_ideas" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idempotency_keys_organization_id_index" ON "idempotency_keys" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "implementation_plans_organization_id_index" ON "implementation_plans" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "improvements_organization_id_index" ON "improvements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "strategy_initiatives_organization_id_index" ON "strategy_initiatives" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_roles_organization_id_index" ON "invitation_roles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_invitations_organization_id_index" ON "organization_invitations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_invitations_organization_id_email_index" ON "organization_invitations" USING btree ("organization_id","email");--> statement-breakpoint
CREATE INDEX "key_results_organization_id_index" ON "key_results" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "key_results_organization_id_objective_id_index" ON "key_results" USING btree ("organization_id","objective_id");--> statement-breakpoint
CREATE INDEX "kpi_entries_organization_id_index" ON "kpi_entries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "kr_check_ins_organization_id_index" ON "kr_check_ins" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "kr_milestones_organization_id_index" ON "kr_milestones" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tenant_growth_levers_organization_id_index" ON "tenant_growth_levers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "loop_evidence_organization_id_index" ON "loop_evidence" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "loop_leakage_organization_id_index" ON "loop_leakage" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "loop_nodes_organization_id_index" ON "loop_nodes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "loop_periods_organization_id_index" ON "loop_periods" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "growth_loops_organization_id_index" ON "growth_loops" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "membership_roles_organization_id_index" ON "membership_roles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_memberships_organization_id_index" ON "organization_memberships" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_memberships_user_id_status_index" ON "organization_memberships" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "migration_imports_organization_id_index" ON "migration_imports" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "strategy_objectives_organization_id_index" ON "strategy_objectives" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "strategy_objectives_organization_id_cycle_id_index" ON "strategy_objectives" USING btree ("organization_id","cycle_id");--> statement-breakpoint
CREATE INDEX "organization_profiles_organization_id_index" ON "organization_profiles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_settings_organization_id_index" ON "organization_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "business_people_organization_id_index" ON "business_people" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "strategy_priorities_organization_id_index" ON "strategy_priorities" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "process_analyses_organization_id_index" ON "process_analyses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "process_assets_organization_id_index" ON "process_assets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "process_connections_organization_id_index" ON "process_connections" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "process_kpis_organization_id_index" ON "process_kpis" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "process_maps_organization_id_index" ON "process_maps" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "process_reviews_organization_id_index" ON "process_reviews" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "process_sops_organization_id_index" ON "process_sops" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "process_steps_organization_id_index" ON "process_steps" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "processes_organization_id_index" ON "processes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "processes_organization_id_owner_role_id_index" ON "processes" USING btree ("organization_id","owner_role_id");--> statement-breakpoint
CREATE INDEX "scale_readiness_snapshots_organization_id_index" ON "scale_readiness_snapshots" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "role_permissions_organization_id_index" ON "role_permissions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "business_role_responsibilities_organization_id_index" ON "business_role_responsibilities" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "scale_candidates_organization_id_index" ON "scale_candidates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "scale_decisions_organization_id_index" ON "scale_decisions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "scale_investments_organization_id_index" ON "scale_investments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "scale_preparation_items_organization_id_index" ON "scale_preparation_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "scale_snapshots_organization_id_index" ON "scale_snapshots" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "sop_procedures_organization_id_index" ON "sop_procedures" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "strategic_assumptions_organization_id_index" ON "strategic_assumptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "strategy_changes_organization_id_index" ON "strategy_changes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "strategy_choices_organization_id_index" ON "strategy_choices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "strategy_contexts_organization_id_index" ON "strategy_contexts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "strategy_cycles_organization_id_index" ON "strategy_cycles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "strategy_learnings_organization_id_index" ON "strategy_learnings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "strategy_snapshots_organization_id_index" ON "strategy_snapshots" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "system_snapshots_organization_id_index" ON "system_snapshots" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "strategy_weekly_reviews_organization_id_index" ON "strategy_weekly_reviews" USING btree ("organization_id");