-- CreateEnum
CREATE TYPE "QuoteChargeCategory" AS ENUM ('AIR_FREIGHT', 'THC', 'EXWORKS');

-- CreateEnum
CREATE TYPE "QuoteChargeBasis" AS ENUM ('WEIGHT', 'PIECE', 'FLAT');

-- CreateEnum
CREATE TYPE "QuoteChargeCode" AS ENUM ('AIR_FREIGHT', 'THC', 'EX_AWB', 'EX_DUE_CARRIER', 'EX_LABELING', 'EX_CUSTOM_BOE', 'EX_HANDLING_SERVICE', 'EX_TRANSPORTATION');

-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN     "showExworksBreakdown" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "QuoteCharge" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "category" "QuoteChargeCategory" NOT NULL,
    "code" "QuoteChargeCode" NOT NULL,
    "label" TEXT NOT NULL,
    "basis" "QuoteChargeBasis" NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "buyRate" DOUBLE PRECISION,
    "sellRate" DOUBLE PRECISION,
    "sellOnly" DOUBLE PRECISION,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSell" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "margin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'AED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteCharge_quoteId_category_idx" ON "QuoteCharge"("quoteId", "category");

-- CreateIndex
CREATE INDEX "QuoteCharge_quoteId_code_idx" ON "QuoteCharge"("quoteId", "code");

-- AddForeignKey
ALTER TABLE "QuoteCharge" ADD CONSTRAINT "QuoteCharge_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "QuoteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
