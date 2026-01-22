-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN     "pricedAt" TIMESTAMP(3),
ADD COLUMN     "pricedById" TEXT,
ADD COLUMN     "pricingSnapshot" JSONB,
ADD COLUMN     "pricingVersion" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_pricedById_fkey" FOREIGN KEY ("pricedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
