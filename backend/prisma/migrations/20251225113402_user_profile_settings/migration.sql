/*
  Warnings:

  - You are about to drop the column `addressLine` on the `Company` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CompanyRole" AS ENUM ('MEMBER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'AED', 'EUR', 'GBP', 'INR', 'SAR', 'QAR', 'OMR', 'KWD');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('EN', 'AR');

-- CreateEnum
CREATE TYPE "NotificationPreferenceType" AS ENUM ('QUOTE_UPDATES', 'BOOKING_UPDATES', 'SHIPMENT_MILESTONES', 'DOCUMENT_REQUESTS', 'URGENT_ALERTS');

-- ✅ Company address migration (shadow-safe, no duplicates, preserves data)

-- 1) Add the new columns FIRST (idempotent in shadow DB)
ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "addressLine1" TEXT,
  ADD COLUMN IF NOT EXISTS "addressLine2" TEXT,
  ADD COLUMN IF NOT EXISTS "billingAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "postalCode" TEXT,
  ADD COLUMN IF NOT EXISTS "state" TEXT;

-- 2) Copy old addressLine into addressLine1 if addressLine exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='Company' AND column_name='addressLine'
  ) THEN
    EXECUTE 'UPDATE "Company"
             SET "addressLine1" = COALESCE("addressLine1", "addressLine")
             WHERE "addressLine" IS NOT NULL';
    EXECUTE 'ALTER TABLE "Company" DROP COLUMN "addressLine"';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "companyRole" "CompanyRole" NOT NULL DEFAULT 'MEMBER',
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "preferredCurrency" "Currency" NOT NULL DEFAULT 'AED',
ADD COLUMN     "preferredLanguage" "Language" NOT NULL DEFAULT 'EN';

-- CreateTable
CREATE TABLE "NotificationSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationPreferenceType" NOT NULL,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "sms" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSetting_userId_type_key" ON "NotificationSetting"("userId", "type");

-- AddForeignKey
ALTER TABLE "NotificationSetting" ADD CONSTRAINT "NotificationSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
