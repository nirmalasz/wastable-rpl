import { env } from '../config/env.js';

/**
 * Agent Orchestrator: the single place that talks to Gemini.
 * Responsibilities (see Chapter 3, Figure 3.14):
 *  - enforce the per-user daily AI quota (env.AI_DAILY_REQUEST_LIMIT) in Redis
 *  - cache identical prompts in Redis
 *  - request structured JSON output (response schema)
 *  - log usage to ai_request_logs
 */
export const aiConfig = {
  enabled: Boolean(env.GEMINI_API_KEY),
  model: env.GEMINI_MODEL,
  dailyLimit: env.AI_DAILY_REQUEST_LIMIT,
};
