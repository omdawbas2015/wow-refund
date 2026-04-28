-- Add an index on inbound_email.powerAutomateRunId so the idempotency
-- lookup in the Power Automate inbound webhook is O(log n) instead of a
-- full table scan once the table has any real volume.
CREATE INDEX "inbound_email_powerAutomateRunId_idx" ON "inbound_email"("powerAutomateRunId");
