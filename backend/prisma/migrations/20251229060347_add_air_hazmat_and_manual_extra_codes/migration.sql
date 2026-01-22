-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "QuoteChargeCode" ADD VALUE 'EX_AIRLINE_DG_SURCHARGE';
ALTER TYPE "QuoteChargeCode" ADD VALUE 'EX_DG_DOCUMENTATION';
ALTER TYPE "QuoteChargeCode" ADD VALUE 'EX_DG_PACKING';
ALTER TYPE "QuoteChargeCode" ADD VALUE 'EX_SLI';
ALTER TYPE "QuoteChargeCode" ADD VALUE 'EX_ELI_STAMPING';
ALTER TYPE "QuoteChargeCode" ADD VALUE 'EX_EXTRA';
