-- CreateIndex
CREATE INDEX "QuotePricingCharge_blockId_idx" ON "QuotePricingCharge"("blockId");

-- CreateIndex
CREATE INDEX "QuotePricingCharge_blockId_code_idx" ON "QuotePricingCharge"("blockId", "code");
