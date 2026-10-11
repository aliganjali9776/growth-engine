-- Server audit is append-only through normal SQL. Database administrators still
-- require separate operational controls; this is not tamper-proof against them.
CREATE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit events are append-only' USING ERRCODE = '23514';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
--> statement-breakpoint
CREATE FUNCTION protect_completed_agent_execution() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('Succeeded', 'RolledBack') THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'completed execution is immutable' USING ERRCODE = '23514';
    END IF;
    IF (to_jsonb(NEW) - 'status' - 'updated_at' - 'version') IS DISTINCT FROM
       (to_jsonb(OLD) - 'status' - 'updated_at' - 'version') OR
       NOT (NEW.status = OLD.status OR (OLD.status = 'Succeeded' AND NEW.status = 'RolledBack')) THEN
      RAISE EXCEPTION 'completed execution binding is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER completed_agent_execution_immutable BEFORE UPDATE OR DELETE ON agent_execution_records
FOR EACH ROW EXECUTE FUNCTION protect_completed_agent_execution();
