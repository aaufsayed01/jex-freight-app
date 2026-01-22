import crypto from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client } from "../lib/s3";
import { requireEnv } from "../lib/env";

function safeExt(originalName: string) {
  const parts = originalName.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
}

export async function uploadBufferToS3(params: {
  buffer: Buffer;
  contentType: string;
  originalName: string;
  folder: string; // e.g. "documents"
  companyId: string;
}) {
  const bucket = requireEnv("AWS_S3_BUCKET");
  const region = requireEnv("AWS_REGION");
  const s3 = getS3Client();
  const ext = safeExt(params.originalName);
  const rand = crypto.randomBytes(16).toString("hex");
  const key = `${params.folder}/${params.companyId}/${Date.now()}-${rand}${ext ? "." + ext : ""}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: params.buffer,
      ContentType: params.contentType,
      // Private bucket (recommended). If you want public, set ACL and bucket policy.
      // ACL: "private",
    })
  );

  return {
    bucket,
    region,
    key,
  };
}
