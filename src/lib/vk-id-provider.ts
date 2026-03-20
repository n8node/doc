import { headers } from "next/headers";
import type { OAuthConfig, OAuthUserConfig } from "next-auth/providers/oauth";

/** Ответ user_info VK ID (часть полей). */
interface VkIdUserRow {
  user_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  avatar?: string;
}

/**
 * VK ID (id.vk.ru): OAuth 2.1 + PKCE. Нужен для приложений из современного кабинета VK ID.
 * Классический oauth.vk.com с такими client_id даёт {"error":"invalid_request","error_description":"Security Error"}.
 */
export function VkProviderVkId(
  options: OAuthUserConfig<Record<string, unknown>>
): OAuthConfig<Record<string, unknown>> {
  return {
    id: "vk",
    name: "VK",
    type: "oauth",
    issuer: "https://id.vk.ru",
    checks: ["pkce", "state"],
    authorization: {
      url: "https://id.vk.ru/authorize",
      params: {
        response_type: "code",
        scope: "email vkid.personal_info",
      },
    },
    token: {
      url: "https://id.vk.ru/oauth2/auth",
      async request({ provider, params, checks }) {
        const codeVerifier = (checks as { code_verifier?: string }).code_verifier;
        if (!codeVerifier) throw new Error("VK ID: отсутствует PKCE code_verifier");

        const h = await headers();
        const deviceId = h.get("x-vk-device-id") ?? (params as { device_id?: string }).device_id;
        if (!deviceId || !String(deviceId).trim()) {
          throw new Error(
            "VK ID: нет device_id в callback. openid-client отбрасывает device_id из query; middleware должен передать заголовок x-vk-device-id."
          );
        }

        const body = new URLSearchParams({
          grant_type: "authorization_code",
          client_id: provider.clientId!,
          code: params.code as string,
          code_verifier: codeVerifier,
          redirect_uri: provider.callbackUrl,
          state: (params.state as string) ?? "",
          device_id: String(deviceId).trim(),
        });
        if (provider.clientSecret?.trim()) body.set("client_secret", provider.clientSecret.trim());

        const res = await fetch("https://id.vk.ru/oauth2/auth", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
        const json = (await res.json()) as Record<string, unknown>;
        if (!res.ok) {
          const msg =
            typeof json.error_description === "string"
              ? json.error_description
              : typeof json.error === "string"
                ? json.error
                : `HTTP ${res.status}`;
          throw new Error(`VK ID token: ${msg}`);
        }

        const tokens = {
          access_token: String(json.access_token ?? ""),
          refresh_token: typeof json.refresh_token === "string" ? json.refresh_token : undefined,
          expires_in: typeof json.expires_in === "number" ? json.expires_in : undefined,
          id_token: typeof json.id_token === "string" ? json.id_token : undefined,
          scope: typeof json.scope === "string" ? json.scope : undefined,
          /** VK ID часто отдаёт email в ответе токена, а не в user_info — нужно для привязки по почте. */
          email: typeof json.email === "string" ? json.email : undefined,
        };
        return { tokens };
      },
    },
    userinfo: {
      url: "https://id.vk.ru/oauth2/user_info",
      async request({ tokens, provider }) {
        const body = new URLSearchParams({
          access_token: tokens.access_token!,
          client_id: provider.clientId!,
        });
        const res = await fetch("https://id.vk.ru/oauth2/user_info", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
        const json = (await res.json()) as { user?: VkIdUserRow };
        if (!res.ok || !json.user) {
          throw new Error("VK ID: не удалось получить user_info");
        }
        const tok = tokens as { email?: string };
        const u = json.user;
        if (!u.email && typeof tok.email === "string" && tok.email.trim()) {
          return { ...u, email: tok.email.trim() };
        }
        return u;
      },
    },
    profile(profile, tokens) {
      const row = profile as VkIdUserRow;
      const tok = tokens as { email?: string };
      const emailFromToken = typeof tok.email === "string" && tok.email.trim() ? tok.email.trim() : null;
      const id = row.user_id != null ? String(row.user_id) : "";
      const first = typeof row.first_name === "string" ? row.first_name : "";
      const last = typeof row.last_name === "string" ? row.last_name : "";
      const name = [first, last].filter(Boolean).join(" ").trim();
      const email =
        typeof row.email === "string" && row.email.trim() ? row.email.trim() : emailFromToken;
      return {
        id,
        name: name || "",
        email,
        image: typeof row.avatar === "string" ? row.avatar : null,
        screen_name: null,
      };
    },
    client: {
      token_endpoint_auth_method: "none",
    },
    style: {
      logo: "/vk.svg",
      bg: "#07F",
      text: "#fff",
    },
    options,
  };
}
