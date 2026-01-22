-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_shipmentId_fkey";

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "quoteRequestId" TEXT,
ALTER COLUMN "shipmentId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Document_companyId_quoteRequestId_idx" ON "Document"("companyId", "quoteRequestId");

-- CreateIndex
CREATE INDEX "Document_quoteRequestId_idx" ON "Document"("quoteRequestId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
