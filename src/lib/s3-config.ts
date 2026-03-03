import { configStore } from "./config-store";

export const S3_DEFAULTS = {
  endpoint: "https://s3.ru1.storage.beget.cloud",
  bucket: "5a4cc9f7950f-doc",
  region: "ru-central1",
  accessKeyId: "JV7OZXU5VTWF0REKA2N5",
  secretAccessKey: "e4IbSh1a8ZBS4FjYrX2ipXCHFBoBmi8EE6PDLaVm",
};

export interface S3ConfigValues {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export async function getS3Config(): Promise<S3ConfigValues> {
  const [endpoint, bucket, region, accessKeyId, secretAccessKey] =
    await Promise.all([
      configStore.get("s3.endpoint"),
      configStore.get("s3.bucket"),
      configStore.get("s3.region"),
      configStore.get("s3.access_key_id"),
      configStore.get("s3.secret_access_key"),
    ]);

  return {
    endpoint: endpoint ?? S3_DEFAULTS.endpoint,
    bucket: bucket ?? S3_DEFAULTS.bucket,
    region: region ?? S3_DEFAULTS.region,
    accessKeyId: accessKeyId ?? S3_DEFAULTS.accessKeyId,
    secretAccessKey: secretAccessKey ?? S3_DEFAULTS.secretAccessKey,
  };
}
