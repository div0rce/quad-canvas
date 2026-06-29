-- Enforce the append-only contract in PostgreSQL itself. Application code has no legitimate UPDATE,
-- DELETE, or TRUNCATE path for the event log or moderation audit; projections are rebuilt separately.
CREATE OR REPLACE FUNCTION "quad_reject_append_only_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; % is forbidden', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "pixel_events_reject_update_delete"
BEFORE UPDATE OR DELETE ON "pixel_events"
FOR EACH ROW EXECUTE FUNCTION "quad_reject_append_only_mutation"();

CREATE TRIGGER "pixel_events_reject_truncate"
BEFORE TRUNCATE ON "pixel_events"
FOR EACH STATEMENT EXECUTE FUNCTION "quad_reject_append_only_mutation"();

CREATE TRIGGER "moderation_actions_reject_update_delete"
BEFORE UPDATE OR DELETE ON "moderation_actions"
FOR EACH ROW EXECUTE FUNCTION "quad_reject_append_only_mutation"();

CREATE TRIGGER "moderation_actions_reject_truncate"
BEFORE TRUNCATE ON "moderation_actions"
FOR EACH STATEMENT EXECUTE FUNCTION "quad_reject_append_only_mutation"();
