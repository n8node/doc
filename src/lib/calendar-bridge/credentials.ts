import { encryptApiKey, decryptApiKey } from "@/lib/ai/encrypt";

export type YandexCalendarCredentials = {
  login: string;
  password: string;
};

export function encryptYandexCredentials(creds: YandexCalendarCredentials): string {
  const json = JSON.stringify({
    login: creds.login.trim(),
    password: creds.password,
  });
  return encryptApiKey(json);
}

export function decryptYandexCredentials(encrypted: string): YandexCalendarCredentials {
  const raw = decryptApiKey(encrypted);
  const parsed = JSON.parse(raw) as YandexCalendarCredentials;
  if (!parsed.login || !parsed.password) {
    throw new Error("Invalid stored calendar credentials");
  }
  return parsed;
}
