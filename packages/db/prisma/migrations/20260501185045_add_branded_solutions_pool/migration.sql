-- CreateTable
CREATE TABLE "maintenance_request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketRef" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "cityName" TEXT,
    "customerName" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "location" TEXT,
    "submitterName" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "machineModel" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "rawPayload" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "mrNumber" TEXT,
    "closedAt" DATETIME,
    "closedById" TEXT,
    "assignedToId" TEXT,
    "assignedAt" DATETIME,
    "assignmentReason" TEXT,
    "powerAutomateRunId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MS_FORM',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "maintenance_request_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "maintenance_request_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "maintenance_status_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "actorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "maintenance_status_history_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "maintenance_request" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "maintenance_status_history_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "maintenance_country_supervisor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "agent_presence_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "reason" TEXT,
    CONSTRAINT "agent_presence_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "passwordHash" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "passwordChangedAt" DATETIME,
    "lastLoginAt" DATETIME,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "primaryCountryId" TEXT,
    "roleId" TEXT,
    "deputyUserId" TEXT,
    "outOfOfficeFrom" DATETIME,
    "outOfOfficeUntil" DATETIME,
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "rejectedReason" TEXT,
    "preferredLocale" TEXT NOT NULL DEFAULT 'en',
    "preferredCurrency" TEXT,
    "preferredTheme" TEXT NOT NULL DEFAULT 'light',
    "mutedNotificationKinds" TEXT NOT NULL DEFAULT '',
    "isAvailable" BOOLEAN NOT NULL DEFAULT false,
    "availableSince" DATETIME,
    "lastAutoAssignedAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "user_deputyUserId_fkey" FOREIGN KEY ("deputyUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "user_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_user" ("approvedAt", "approvedById", "avatarUrl", "createdAt", "deletedAt", "deputyUserId", "email", "emailVerified", "failedLoginAttempts", "id", "lastLoginAt", "lockedUntil", "mustChangePassword", "mutedNotificationKinds", "name", "nameAr", "outOfOfficeFrom", "outOfOfficeUntil", "passwordChangedAt", "passwordHash", "phone", "preferredCurrency", "preferredLocale", "preferredTheme", "primaryCountryId", "rejectedReason", "roleId", "status", "updatedAt") SELECT "approvedAt", "approvedById", "avatarUrl", "createdAt", "deletedAt", "deputyUserId", "email", "emailVerified", "failedLoginAttempts", "id", "lastLoginAt", "lockedUntil", "mustChangePassword", "mutedNotificationKinds", "name", "nameAr", "outOfOfficeFrom", "outOfOfficeUntil", "passwordChangedAt", "passwordHash", "phone", "preferredCurrency", "preferredLocale", "preferredTheme", "primaryCountryId", "rejectedReason", "roleId", "status", "updatedAt" FROM "user";
DROP TABLE "user";
ALTER TABLE "new_user" RENAME TO "user";
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
CREATE INDEX "user_status_idx" ON "user"("status");
CREATE INDEX "user_roleId_idx" ON "user"("roleId");
CREATE INDEX "user_primaryCountryId_idx" ON "user"("primaryCountryId");
CREATE INDEX "user_isAvailable_lastAutoAssignedAt_idx" ON "user"("isAvailable", "lastAutoAssignedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_request_ticketRef_key" ON "maintenance_request"("ticketRef");

-- CreateIndex
CREATE INDEX "maintenance_request_status_idx" ON "maintenance_request"("status");

-- CreateIndex
CREATE INDEX "maintenance_request_assignedToId_status_idx" ON "maintenance_request"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "maintenance_request_countryName_idx" ON "maintenance_request"("countryName");

-- CreateIndex
CREATE INDEX "maintenance_request_createdAt_idx" ON "maintenance_request"("createdAt");

-- CreateIndex
CREATE INDEX "maintenance_status_history_requestId_createdAt_idx" ON "maintenance_status_history"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "maintenance_country_supervisor_countryName_isActive_idx" ON "maintenance_country_supervisor"("countryName", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_country_supervisor_countryName_email_key" ON "maintenance_country_supervisor"("countryName", "email");

-- CreateIndex
CREATE INDEX "agent_presence_log_userId_startedAt_idx" ON "agent_presence_log"("userId", "startedAt");
