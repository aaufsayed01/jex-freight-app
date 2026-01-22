-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN     "chargeableWeightKg" DOUBLE PRECISION,
ADD COLUMN     "packagesJson" JSONB;
