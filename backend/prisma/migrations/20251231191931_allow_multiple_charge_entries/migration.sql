-- DropIndex
DROP INDEX "QuotePricingCharge_pricingId_code_key";

-- CreateIndex
CREATE INDEX "QuotePricingCharge_pricingId_code_idx" ON "QuotePricingCharge"("pricingId", "code");
