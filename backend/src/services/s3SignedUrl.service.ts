import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "../lib/s3";
import { requireEnv } from "../lib/env";

export async function getDownloadUrl(key: string, expiresInSeconds = 60) {
  const bucket = requireEnv("AWS_S3_BUCKET");
  const s3 = getS3Client();
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(s3, cmd, { expiresIn: expiresInSeconds });
}
