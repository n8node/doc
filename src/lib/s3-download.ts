import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Config } from "./s3-config";
import { createS3Client } from "./s3";

export async function getPresignedDownloadUrl(
  s3Key: string,
  expiresIn = 3600
): Promise<string> {
  const config = await getS3Config();
  const client = createS3Client({ ...config, forcePathStyle: true });
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: s3Key,
  });
  return getSignedUrl(client, command, { expiresIn });
}

export async function getStreamFromS3(s3Key: string, range?: { start: number; end: number }) {
  const config = await getS3Config();
  const client = createS3Client({ ...config, forcePathStyle: true });
  const input: { Bucket: string; Key: string; Range?: string } = {
    Bucket: config.bucket,
    Key: s3Key,
  };
  if (range) {
    input.Range = `bytes=${range.start}-${range.end}`;
  }
  const response = await client.send(new GetObjectCommand(input));
  return {
    body: response.Body,
    contentType: response.ContentType ?? "application/octet-stream",
    contentLength: response.ContentLength,
  };
}
