import type { AiProviderConfig } from "./types";
import type { AiProvider } from "./provider.interface";
import { BaseAiProvider } from "./providers/base.provider";
import { OpenAiProvider } from "./providers/openai.provider";
import { OpenRouterProvider } from "./providers/openrouter.provider";
import { YandexProvider } from "./providers/yandex.provider";
import { GigaChatProvider } from "./providers/gigachat.provider";

export class AiProviderFactory {
  static create(providerKey: string, config: AiProviderConfig): AiProvider {
    switch (providerKey) {
      case "openai":
        return new OpenAiProvider(config);
      case "openrouter":
        return new OpenRouterProvider(config);
      case "yandex":
        return new YandexProvider(config);
      case "gigachat":
        return new GigaChatProvider(config);
      default:
        return new BaseAiProvider();
    }
  }
}
