import type { AiProviderConfig } from "./types";
import type { AiProvider } from "./provider.interface";
import { BaseAiProvider } from "./providers/base.provider";

export class AiProviderFactory {
  static create(providerKey: string, _config: AiProviderConfig): AiProvider {
    switch (providerKey) {
      case "yandex":
        // TODO: return new YandexAiProvider(config);
        return new BaseAiProvider();
      case "gigachat":
        // TODO: return new GigaChatProvider(config);
        return new BaseAiProvider();
      case "ollama":
        // TODO: return new OllamaProvider(config);
        return new BaseAiProvider();
      case "openai":
        // TODO: return new OpenAiProvider(config);
        return new BaseAiProvider();
      default:
        return new BaseAiProvider();
    }
  }
}
