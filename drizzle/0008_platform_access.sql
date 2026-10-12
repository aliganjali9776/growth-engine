-- Preserve existing customers explicitly; future organizations start assessment-only.
ALTER TABLE organizations ADD COLUMN access_tier text NOT NULL DEFAULT 'full_access';
--> statement-breakpoint
ALTER TABLE organizations ALTER COLUMN access_tier SET DEFAULT 'assessment_only';
--> statement-breakpoint
ALTER TABLE organizations ADD CONSTRAINT organization_access_tier CHECK (access_tier IN ('assessment_only','full_access'));
--> statement-breakpoint

CREATE TABLE platform_access_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), user_id uuid NOT NULL REFERENCES users(id),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX one_pending_access_request ON platform_access_requests(organization_id) WHERE status='pending';
--> statement-breakpoint
CREATE INDEX platform_access_requests_org ON platform_access_requests(organization_id);
--> statement-breakpoint

CREATE TABLE platform_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_user_id uuid REFERENCES users(id), organization_id uuid NOT NULL REFERENCES organizations(id),
 action text NOT NULL, previous_tier text, new_tier text, reason text, created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX platform_audit_org ON platform_audit(organization_id,created_at);
--> statement-breakpoint
INSERT INTO platform_audit(organization_id,action,new_tier,reason) SELECT id,'ExistingOrganizationPreserved','full_access','BUILD 8A migration preserves pre-existing customer access' FROM organizations;
--> statement-breakpoint

CREATE TABLE platform_assessment_leads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), user_id uuid NOT NULL REFERENCES users(id),
 draft jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,user_id)
);
