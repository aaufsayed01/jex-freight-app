-- AlterEnum
ALTER TYPE "ChargeGroup" ADD VALUE 'TRANSFER_OWNERSHIP';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PricingTemplateCode" ADD VALUE 'AIR_EXPORT_TRANSFER_OWNERSHIP';
ALTER TYPE "PricingTemplateCode" ADD VALUE 'AIR_IMPORT_TRANSFER_OWNERSHIP';
ALTER TYPE "PricingTemplateCode" ADD VALUE 'SEA_EXPORT_TRANSFER_OWNERSHIP';
ALTER TYPE "PricingTemplateCode" ADD VALUE 'SEA_IMPORT_TRANSFER_OWNERSHIP';
