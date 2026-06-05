export interface LLMHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMPrompt {
  system: string;
  user: string;
  /** Optional prior turns for multi-turn chat. When present, `user` is appended as the final user turn. */
  history?: LLMHistoryMessage[];
  /** Override the provider's default max_tokens. Defaults to 150 for recommendations, 600 for chat. */
  maxTokens?: number;
}

export interface LLMResponse {
  text: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  /** Pre-calculated cost in cents */
  costCents: number;
}

export interface LLMProvider {
  complete(prompt: LLMPrompt): Promise<LLMResponse | null>;
}

export const LLM_PROVIDER = Symbol('LLMProvider');
