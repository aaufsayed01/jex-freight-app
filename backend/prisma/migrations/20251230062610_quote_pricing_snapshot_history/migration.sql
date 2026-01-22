-- CreateTable
CREATE TABLE "QuotePricingSnapshot" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "QuotePricingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuotePricingSnapshot_quoteId_idx" ON "QuotePricingSnapshot"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "QuotePricingSnapshot_quoteId_version_key" ON "QuotePricingSnapshot"("quoteId", "version");

-- AddForeignKey
ALTER TABLE "QuotePricingSnapshot" ADD CONSTRAINT "QuotePricingSnapshot_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "QuoteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotePricingSnapshot" ADD CONSTRAINT "QuotePricingSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
