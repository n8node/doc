import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Config } from "./s3-config";
import { createS3Client } from "./s3";

export async function getPresignedUploadUrl(input: {
  s3Key: string;
  contentType: string;
  expiresIn?: number;
}) {
  const { s3Key, contentType, expiresIn = 15 * 60 } = input;
  const config = await getS3Config();
  const client = createS3Client({ ...config, forcePathStyle: true });

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: s3Key,
    ContentType: contentType || "application/octet-stream",
  });

  const url = await getSignedUrl(client, command, { expiresIn });

  return {
    url,
    headers: {
      "Content-Type": contentType || "application/octet-stream",
    },
  };
}

export async function headUploadedObject(s3Key: string): Promise<{
  size: number | null;
  contentType: string | null;
} | null> {
  const config = await getS3Config();
  const client = createS3Client({ ...config, forcePathStyle: true });

  try {
    const response = await client.send(
      new HeadObjectCommand({
        Bucket: config.bucket,
        Key: s3Key,
      })
    );

    return {
      size: response.ContentLength ?? null,
      contentType: response.ContentType ?? null,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "NotFound" || error.name === "NoSuchKey")
    ) {
      return null;
    }
    throw error;
  }
}
