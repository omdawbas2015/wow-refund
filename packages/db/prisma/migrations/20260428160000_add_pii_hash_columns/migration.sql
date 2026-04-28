-- Add deterministic HMAC hash columns alongside customerEmail/customerPhone so
-- exact-match lookups still work after AES-GCM encryption is enabled.
-- The columns are nullable; rows written before the encryption rollout have
-- NULL hashes until the backfill script runs.
ALTER TABLE "refund_case" ADD COLUMN "customerEmailHash" TEXT;
ALTER TABLE "refund_case" ADD COLUMN "customerPhoneHash" TEXT;
ALTER TABLE "promo_allocation" ADD COLUMN "customerEmailHash" TEXT;

CREATE INDEX "refund_case_customerEmailHash_idx" ON "refund_case"("customerEmailHash");
CREATE INDEX "refund_case_customerPhoneHash_idx" ON "refund_case"("customerPhoneHash");
CREATE INDEX "promo_allocation_customerEmailHash_idx" ON "promo_allocation"("customerEmailHash");
