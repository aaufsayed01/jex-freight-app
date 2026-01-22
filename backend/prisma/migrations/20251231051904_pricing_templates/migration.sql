/*
  Warnings:

  - You are about to drop the `QuoteCharge` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PricingDirection" AS ENUM ('EXPORT', 'IMPORT');

-- CreateEnum
CREATE TYPE "PricingTemplateCode" AS ENUM ('AIR_EXPORT_LOCAL');

-- CreateEnum
CREATE TYPE "ChargeGroup" AS ENUM ('MAIN', 'EXWORKS');

-- CreateEnum
CREATE TYPE "QtyBasis" AS ENUM ('SHIPMENT', 'KG_ACTUAL', 'KG_CHARGEABLE_MAX', 'PIECE', 'CUSTOM');

-- DropForeignKey
ALTER TABLE "QuoteCharge" DROP CONSTRAINT "QuoteCharge_quoteId_fkey";

-- DropTable
DROP TABLE "QuoteCharge";

-- DropEnum
DROP TYPE "QuoteChargeBasis";

-- DropEnum
DROP TYPE "QuoteChargeCategory";

-- DropEnum
DROP TYPE "QuoteChargeCode";

-- CreateTable
CREATE TABLE "PricingTemplate" (
    "id" TEXT NOT NULL,
    "mode" "ShipmentMode" NOT NULL,
    "direction" "PricingDirection" NOT NULL,
    "code" "PricingTemplateCode" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingTemplateLine" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "group" "ChargeGroup" NOT NULL,
    "qtyBasis" "QtyBasis" NOT NULL,
    "order" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "isOptional" BOOLEAN NOT NULL DEFAULT true,
    "isLabelling" BOOLEAN NOT NULL DEFAULT false,
    "isDiscount" BOOLEAN NOT NULL DEFAULT false,
    "canBeNegative" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PricingTemplateLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotePricing" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "mode" "ShipmentMode" NOT NULL,
    "direction" "PricingDirection" NOT NULL,
    "templateCode" "PricingTemplateCode" NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotePricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotePricingCharge" (
    "id" TEXT NOT NULL,
    "pricingId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "group" "ChargeGroup" NOT NULL,
    "qtyBasis" "QtyBasis" NOT NULL,
    "order" INTEGER NOT NULL,
    "buyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "totalSell" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "margin" DOUBLE PRECISION,
    "isLabelling" BOOLEAN NOT NULL DEFAULT false,
    "isDiscount" BOOLEAN NOT NULL DEFAULT false,
    "canBeNegative" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QuotePricingCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PricingTemplate_code_key" ON "PricingTemplate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PricingTemplateLine_templateId_code_key" ON "PricingTemplateLine"("templateId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "QuotePricing_quoteId_key" ON "QuotePricing"("quoteId");

-- CreateIndex
CREATE INDEX "QuotePricingCharge_pricingId_idx" ON "QuotePricingCharge"("pricingId");

-- CreateIndex
CREATE UNIQUE INDEX "QuotePricingCharge_pricingId_code_key" ON "QuotePricingCharge"("pricingId", "code");

-- AddForeignKey
ALTER TABLE "PricingTemplateLine" ADD CONSTRAINT "PricingTemplateLine_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PricingTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotePricing" ADD CONSTRAINT "QuotePricing_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "QuoteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotePricingCharge" ADD CONSTRAINT "QuotePricingCharge_pricingId_fkey" FOREIGN KEY ("pricingId") REFERENCES "QuotePricing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
