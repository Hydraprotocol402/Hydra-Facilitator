-- CreateTable
CREATE TABLE "discovery_resources" (
    "id" TEXT NOT NULL,
    "resource" VARCHAR(2048) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "x402Version" INTEGER NOT NULL,
    "accepts" JSONB NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discovery_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "discovery_resources_resource_key" ON "discovery_resources"("resource");

-- CreateIndex
CREATE INDEX "discovery_resources_lastUpdated_idx" ON "discovery_resources"("lastUpdated" DESC);

-- CreateIndex
CREATE INDEX "discovery_resources_type_idx" ON "discovery_resources"("type");

-- CreateIndex
CREATE INDEX "discovery_resources_deletedAt_idx" ON "discovery_resources"("deletedAt");
