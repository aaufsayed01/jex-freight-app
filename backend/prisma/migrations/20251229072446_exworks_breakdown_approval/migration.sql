-- CreateEnum
CREATE TYPE "BreakdownRequestStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN     "exworksBreakdownRequestedAt" TIMESTAMP(3),
ADD COLUMN     "exworksBreakdownReviewNote" TEXT,
ADD COLUMN     "exworksBreakdownReviewedAt" TIMESTAMP(3),
ADD COLUMN     "exworksBreakdownReviewedById" TEXT,
ADD COLUMN     "exworksBreakdownStatus" "BreakdownRequestStatus" NOT NULL DEFAULT 'NONE';

-- CreateIndex
CREATE INDEX "QuoteRequest_exworksBreakdownStatus_idx" ON "QuoteRequest"("exworksBreakdownStatus");

-- AddForeignKey
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_exworksBreakdownReviewedById_fkey" FOREIGN KEY ("exworksBreakdownReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
