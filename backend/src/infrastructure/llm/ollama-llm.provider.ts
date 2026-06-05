import { Logger } from '@nestjs/common';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

import type { LLMPrompt, LLMProvider, LLMResponse } from './llm-provider.interface';

// Ollama runs locally — no real cost, but we track tokens so the rest of the
// pipeline (quota checks, cost logging) behaves identically to OpenAI.
const COST_CENTS_PER_TOKEN = 0;

export class OllamaLlmProvider implements LLMProvider {
  private readonly logger = new Logger(OllamaLlmProvider.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(baseUrl: string, model: string) {
    this.model = model;
    // The openai package supports any OpenAI-compatible base URL.
    // Ollama exposes /v1/chat/completions at its default port.
    this.client = new OpenAI({
      baseURL: `${baseUrl}/v1`,
      apiKey: 'ollama', // required by the SDK but ignored by Ollama
      timeout: 30_000,  // local inference can be slower than cloud
      maxRetries: 0,
    });
  }

  async complete(prompt: LLMPrompt): Promise<LLMResponse | null> {
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: prompt.system },
      ...(prompt.history ?? []).map(
        (m): ChatCompletionMessageParam => ({ role: m.role, content: m.content }),
      ),
      { role: 'user', content: prompt.user },
    ];

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: 0.3,
        max_tokens: prompt.maxTokens ?? 150,
      });

      const text = completion.choices[0]?.message?.content?.trim() ?? '';
      const tokensInput = completion.usage?.prompt_tokens ?? 0;
      const tokensOutput = completion.usage?.completion_tokens ?? 0;

      return {
        text,
        model: completion.model,
        tokensInput,
        tokensOutput,
        costCents: (tokensInput + tokensOutput) * COST_CENTS_PER_TOKEN,
      };
    } catch (err: unknown) {
      this.logger.error(`Ollama call failed: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }
}
