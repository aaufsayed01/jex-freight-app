-- 1) Rename existing columns (NO data loss)
ALTER TABLE "Document" RENAME COLUMN "fileName" TO "filename";
ALTER TABLE "Document" RENAME COLUMN "filePath" TO "path";
ALTER TABLE "Document" RENAME COLUMN "uploadedAt" TO "createdAt";

-- 2) Ensure createdAt not null
ALTER TABLE "Document" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
UPDATE "Document" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
ALTER TABLE "Document" ALTER COLUMN "createdAt" SET NOT NULL;

-- 3) Add originalName safely (backfill from filename)
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "originalName" TEXT;
UPDATE "Document" SET "originalName" = "filename" WHERE "originalName" IS NULL;
ALTER TABLE "Document" ALTER COLUMN "originalName" SET NOT NULL;

-- 4) Add size safely (backfill to 0 if you don’t have it)
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "size" INTEGER;
UPDATE "Document" SET "size" = 0 WHERE "size" IS NULL;
ALTER TABLE "Document" ALTER COLUMN "size" SET NOT NULL;

-- 5) (Optional) If you want shipmentId/companyId required but DB might have NULLs,
-- do NOT force NOT NULL here unless you're sure there are no nulls.
-- If you're sure, uncomment:
-- ALTER TABLE "Document" ALTER COLUMN "shipmentId" SET NOT NULL;
-- ALTER TABLE "Document" ALTER COLUMN "companyId" SET NOT NULL;

