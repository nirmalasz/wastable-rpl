import { env } from '../config/env.js';
import { callGemini, type GeminiPart } from './gemini.js';
import { callGroq } from './groq.js';

/** Which model the orchestrator talks to, picked with AI_PROVIDER. */
export const llmProvider = {
  name: env.AI_PROVIDER,
  enabled: Boolean(env.AI_PROVIDER === 'groq' ? env.GROQ_API_KEY : env.GEMINI_API_KEY),
  model: env.AI_PROVIDER === 'groq' ? env.GROQ_MODEL : env.GEMINI_MODEL,
};

/** Send prompt parts to the configured provider; resolves to its raw (JSON) text. */
export const callModel = (parts: GeminiPart[]): Promise<string> =>
  env.AI_PROVIDER === 'groq' ? callGroq(parts) : callGemini(parts);
