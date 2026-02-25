-- Add Keitaro campaign attribution fields to Conversion table
ALTER TABLE "Conversion" ADD COLUMN "keitaroCampaignId" TEXT;
ALTER TABLE "Conversion" ADD COLUMN "keitaroCampaignName" TEXT;

-- Create index on keitaroCampaignId for fast lookups
CREATE INDEX "Conversion_keitaroCampaignId_idx" ON "Conversion"("keitaroCampaignId");

-- Create KeitaroCampaignMapping table
CREATE TABLE "KeitaroCampaignMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keitaroCampaignId" TEXT NOT NULL,
    "keitaroCampaignName" TEXT,
    "campaignId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KeitaroCampaignMapping_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Unique constraint on keitaroCampaignId
CREATE UNIQUE INDEX "KeitaroCampaignMapping_keitaroCampaignId_key" ON "KeitaroCampaignMapping"("keitaroCampaignId");

-- Indexes for KeitaroCampaignMapping
CREATE INDEX "KeitaroCampaignMapping_campaignId_idx" ON "KeitaroCampaignMapping"("campaignId");
CREATE INDEX "KeitaroCampaignMapping_isActive_idx" ON "KeitaroCampaignMapping"("isActive");
