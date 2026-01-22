-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN     "pricingLockReason" TEXT,
ADD COLUMN     "pricingLockedAt" TIMESTAMP(3),
ADD COLUMN     "pricingLockedById" TEXT;

-- AddForeignKey
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_pricingLockedById_fkey" FOREIGN KEY ("pricingLockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
