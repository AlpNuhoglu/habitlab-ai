export interface LLMPrompt {
  system: string;
  user: string;
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
