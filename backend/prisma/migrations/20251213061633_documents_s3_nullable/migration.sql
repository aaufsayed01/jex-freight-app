/*
  Warnings:

  - A unique constraint covering the columns `[s3Key]` on the table `Document` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `s3Key` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DocumentStorage" AS ENUM ('S3', 'LOCAL');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "s3Bucket" TEXT,
ADD COLUMN     "s3Key" TEXT NOT NULL,
ADD COLUMN     "s3Region" TEXT,
ADD COLUMN     "storage" "DocumentStorage" NOT NULL DEFAULT 'LOCAL',
ALTER COLUMN "path" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Document_s3Key_key" ON "Document"("s3Key");
