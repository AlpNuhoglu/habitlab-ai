import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import OpenAI, { APIError } from 'openai';

import type { LLMPrompt, LLMProvider, LLMResponse } from './llm-provider.interface';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// gpt-4o-mini pricing (cents per 1K tokens)
const INPUT_CENTS_PER_1K = 0.015;
const OUTPUT_CENTS_PER_1K = 0.06;

const MAX_TOKENS = 150;
const TEMPERATURE = 0.3;
const TIMEOUT_MS = 8_000;
const RETRY_DELAY_MS = 2_000;

function calcCostCents(tokensInput: number, tokensOutput: number): number {
  return (tokensInput / 1000) * INPUT_CENTS_PER_1K + (tokensOutput / 1000) * OUTPUT_CENTS_PER_1K;
}

export class OpenAILlmProvider implements LLMProvider {
  private readonly logger = new Logger(OpenAILlmProvider.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: ConfigService) {
    this.model = config.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';
    this.client = new OpenAI({
      apiKey: config.getOrThrow<string>('OPENAI_API_KEY'),
      timeout: TIMEOUT_MS,
      maxRetries: 0, // we handle retries manually for circuit-breaker awareness
    });
  }

  async complete(prompt: LLMPrompt): Promise<LLMResponse | null> {
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        const messages: ChatCompletionMessageParam[] = [
          { role: 'system', content: prompt.system },
          ...(prompt.history ?? []).map(
            (m): ChatCompletionMessageParam => ({ role: m.role, content: m.content }),
          ),
          { role: 'user', content: prompt.user },
        ];

        const completion = await this.client.chat.completions.create({
          model: this.model,
          temperature: TEMPERATURE,
          max_tokens: prompt.maxTokens ?? MAX_TOKENS,
          messages,
        });

        const text = completion.choices[0]?.message?.content?.trim() ?? '';
        const tokensInput = completion.usage?.prompt_tokens ?? 0;
        const tokensOutput = completion.usage?.completion_tokens ?? 0;

        return {
          text,
          model: completion.model,
          tokensInput,
          tokensOutput,
          costCents: calcCostCents(tokensInput, tokensOutput),
        };
      } catch (err: unknown) {
        // 429 with code=insufficient_quota is a billing error, not a transient rate limit —
        // retrying wastes 2s and counts against the circuit breaker unnecessarily.
        const isQuotaExceeded =
          err instanceof APIError &&
          err.status === 429 &&
          (err as APIError & { error?: { code?: string } }).error?.code === 'insufficient_quota';

        const isRetryable =
          !isQuotaExceeded &&
          err instanceof APIError &&
          (err.status === 429 || (err.status ?? 0) >= 500);

        if (isRetryable && attempt === 0) {
          this.logger.warn(`OpenAI transient error (${String(err)}), retrying in ${RETRY_DELAY_MS}ms`);
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }

        // Surface to caller so circuit breaker can record the error
        throw err;
      }
    }

    return null;
  }
}
