import crypto from "crypto";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "../lib/s3";

function safeExt(name: string) {
  const parts = name.split(".");
  const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : "";
  return ext.replace(/[^a-z0-9]/g, "");
}

export async function uploadDocToS3(params: {
  buffer: Buffer;
  contentType: string;
  originalName: string;
  companyId: string;
  shipmentId?: string;
  quoteRequestId?: string;
}) {
  const s3 = getS3Client();  
  const bucket = process.env.AWS_S3_BUCKET!;
  const region = process.env.AWS_REGION!;

  const ext = safeExt(params.originalName);
  const rand = crypto.randomBytes(16).toString("hex");
  const filename = `${Date.now()}-${rand}${ext ? "." + ext : ""}`;

  const scope =
    params.shipmentId
      ? `shipments/${params.shipmentId}`
      : params.quoteRequestId
      ? `quotes/${params.quoteRequestId}`
      : "misc";

  const key = `companies/${params.companyId}/${scope}/${filename}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: params.buffer,
      ContentType: params.contentType,
    })
  );

  return { bucket, region, key, filename };
}

export async function signDocDownloadUrl(key: string, expiresInSeconds = 60) {
  const s3 = getS3Client();  
  const bucket = process.env.AWS_S3_BUCKET!;
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSeconds });
}

export async function deleteDocFromS3(key: string) {
  const bucket = process.env.AWS_S3_BUCKET!;
  const s3 = getS3Client();
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
