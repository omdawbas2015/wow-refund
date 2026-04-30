-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_refund_case" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseNumber" TEXT NOT NULL,
    "externalCaseNumber" TEXT,
    "countryId" TEXT NOT NULL,
    "branchId" TEXT,
    "brandId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerNotes" TEXT,
    "orderNumber" TEXT NOT NULL,
    "orderDate" DATETIME NOT NULL,
    "orderAmount" REAL NOT NULL,
    "orderCurrency" TEXT NOT NULL,
    "totalRefundAmount" REAL NOT NULL,
    "isPartial" BOOLEAN NOT NULL DEFAULT false,
    "auraPoints" INTEGER,
    "auraStatus" TEXT NOT NULL DEFAULT 'NONE',
    "auraBatchId" TEXT,
    "auraProcessedAt" DATETIME,
    "auraProcessedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "rootCauseId" TEXT,
    "rootCauseNotes" TEXT,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "rejectedReason" TEXT,
    "cancelledReason" TEXT,
    "slaDueAt" DATETIME,
    "slaBreachedAt" DATETIME,
    "customerNotifiedAt" DATETIME,
    "customerCallStatus" TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
    "customerCallUpdatedAt" DATETIME,
    "customerCallById" TEXT,
    "customerCallFollowUpAt" DATETIME,
    "approvalBatchId" TEXT,
    "customFields" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "refund_case_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "country" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "refund_case_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "refund_case_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "refund_case_orderCurrency_fkey" FOREIGN KEY ("orderCurrency") REFERENCES "currency_registry" ("code") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "refund_case_auraBatchId_fkey" FOREIGN KEY ("auraBatchId") REFERENCES "aura_batch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "refund_case_rootCauseId_fkey" FOREIGN KEY ("rootCauseId") REFERENCES "root_cause" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "refund_case_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "refund_case_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "refund_case_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "refund_case_customerCallById_fkey" FOREIGN KEY ("customerCallById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "refund_case_approvalBatchId_fkey" FOREIGN KEY ("approvalBatchId") REFERENCES "approval_batch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_refund_case" ("approvalBatchId", "approvedAt", "approvedById", "assignedToId", "auraBatchId", "auraPoints", "auraProcessedAt", "auraProcessedById", "auraStatus", "branchId", "brandId", "cancelledReason", "caseNumber", "countryId", "createdAt", "createdById", "customFields", "customerEmail", "customerName", "customerNotes", "customerNotifiedAt", "customerPhone", "deletedAt", "externalCaseNumber", "id", "isPartial", "orderAmount", "orderCurrency", "orderDate", "orderNumber", "rejectedReason", "rootCauseId", "rootCauseNotes", "slaBreachedAt", "slaDueAt", "status", "totalRefundAmount", "updatedAt") SELECT "approvalBatchId", "approvedAt", "approvedById", "assignedToId", "auraBatchId", "auraPoints", "auraProcessedAt", "auraProcessedById", "auraStatus", "branchId", "brandId", "cancelledReason", "caseNumber", "countryId", "createdAt", "createdById", "customFields", "customerEmail", "customerName", "customerNotes", "customerNotifiedAt", "customerPhone", "deletedAt", "externalCaseNumber", "id", "isPartial", "orderAmount", "orderCurrency", "orderDate", "orderNumber", "rejectedReason", "rootCauseId", "rootCauseNotes", "slaBreachedAt", "slaDueAt", "status", "totalRefundAmount", "updatedAt" FROM "refund_case";
DROP TABLE "refund_case";
ALTER TABLE "new_refund_case" RENAME TO "refund_case";
CREATE UNIQUE INDEX "refund_case_caseNumber_key" ON "refund_case"("caseNumber");
CREATE INDEX "refund_case_countryId_idx" ON "refund_case"("countryId");
CREATE INDEX "refund_case_brandId_idx" ON "refund_case"("brandId");
CREATE INDEX "refund_case_status_idx" ON "refund_case"("status");
CREATE INDEX "refund_case_createdById_idx" ON "refund_case"("createdById");
CREATE INDEX "refund_case_assignedToId_idx" ON "refund_case"("assignedToId");
CREATE INDEX "refund_case_customerEmail_idx" ON "refund_case"("customerEmail");
CREATE INDEX "refund_case_orderNumber_idx" ON "refund_case"("orderNumber");
CREATE INDEX "refund_case_externalCaseNumber_idx" ON "refund_case"("externalCaseNumber");
CREATE INDEX "refund_case_createdAt_idx" ON "refund_case"("createdAt");
CREATE INDEX "refund_case_deletedAt_idx" ON "refund_case"("deletedAt");
CREATE INDEX "refund_case_status_countryId_createdAt_idx" ON "refund_case"("status", "countryId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
