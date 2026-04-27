import type { LLMPrompt, LLMProvider, LLMResponse } from './llm-provider.interface';

export class NullLlmProvider implements LLMProvider {
  complete(_prompt: LLMPrompt): Promise<LLMResponse | null> {
    return Promise.resolve(null);
  }
}
