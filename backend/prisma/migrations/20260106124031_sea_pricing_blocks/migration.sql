-- CreateEnum
CREATE TYPE "SeaContainerType" AS ENUM ('C20', 'C40');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PricingTemplateCode" ADD VALUE 'SEA_EXPORT_LOCAL_20FT';
ALTER TYPE "PricingTemplateCode" ADD VALUE 'SEA_EXPORT_LOCAL_40FT';

-- AlterEnum
ALTER TYPE "QtyBasis" ADD VALUE 'CONTAINER';

-- AlterTable
ALTER TABLE "QuotePricingCharge" ADD COLUMN     "blockId" TEXT;

-- CreateTable
CREATE TABLE "QuotePricingBlock" (
    "id" TEXT NOT NULL,
    "pricingId" TEXT NOT NULL,
    "containerType" "SeaContainerType" NOT NULL,
    "containerQty" INTEGER NOT NULL,
    "isAddon" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotePricingBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuotePricingBlock_pricingId_idx" ON "QuotePricingBlock"("pricingId");

-- AddForeignKey
ALTER TABLE "QuotePricingBlock" ADD CONSTRAINT "QuotePricingBlock_pricingId_fkey" FOREIGN KEY ("pricingId") REFERENCES "QuotePricing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotePricingCharge" ADD CONSTRAINT "QuotePricingCharge_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "QuotePricingBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
