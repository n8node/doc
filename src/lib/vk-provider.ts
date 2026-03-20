import type { OAuthConfig, OAuthUserConfig } from "next-auth/providers/oauth";
import VkProvider from "next-auth/providers/vk";

const apiVersion = "5.131";

/**
 * VK OAuth: email приходит в ответе token endpoint, не в users.get.
 * @see https://dev.vk.com/oauth
 */
export function VkProviderWithEmail(
  options: OAuthUserConfig<Record<string, unknown>>
): OAuthConfig<Record<string, unknown>> {
  const base = VkProvider(options) as OAuthConfig<Record<string, unknown>>;
  return {
    ...base,
    authorization: `https://oauth.vk.com/authorize?scope=email&v=${apiVersion}`,
    userinfo: `https://api.vk.com/method/users.get?fields=photo_100,screen_name&v=${apiVersion}`,
    profile(result, tokens) {
      const row = (result as { response?: Array<Record<string, unknown>> })?.response?.[0] ?? {};
      const tok = tokens as Record<string, unknown>;
      const emailFromToken = typeof tok.email === "string" ? tok.email : null;
      const id = row.id;
      const first = typeof row.first_name === "string" ? row.first_name : "";
      const last = typeof row.last_name === "string" ? row.last_name : "";
      const name = [first, last].filter(Boolean).join(" ").trim();
      return {
        id: id != null ? String(id) : "",
        name: name || "",
        email: emailFromToken,
        image: typeof row.photo_100 === "string" ? row.photo_100 : null,
        screen_name: typeof row.screen_name === "string" ? row.screen_name : null,
      };
    },
  };
}
