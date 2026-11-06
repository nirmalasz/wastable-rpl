import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import type { GeminiPart } from './gemini.js';
import { AiUnavailableError } from './types.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Groq client (OpenAI-compatible chat API) that asks for JSON output and returns the raw text.
 * Takes the same parts as the Gemini client. Image parts are only sent when GROQ_VISION is on,
 * since most Groq models are text-only; otherwise they are dropped and the text is used alone.
 */
export async function callGroq(parts: GeminiPart[]): Promise<string> {
  if (!env.GROQ_API_KEY) throw new AiUnavailableError('GROQ_API_KEY is not set');

  const text = parts.flatMap((p) => ('text' in p ? [p.text] : [])).join('\n');
  const images = parts.flatMap((p) => ('inlineData' in p ? [p.inlineData] : []));
  if (images.length > 0 && !env.GROQ_VISION) {
    logger.debug({ dropped: images.length }, 'groq: model is text-only, ignoring image parts');
  }
  const content =
    images.length > 0 && env.GROQ_VISION
      ? [
          { type: 'text', text },
          ...images.map((i) => ({
            type: 'image_url',
            image_url: { url: `data:${i.mimeType};base64,${i.data}` },
          })),
        ]
      : text;

  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages: [{ role: 'user', content }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        // gpt-oss models "think" before answering; low effort keeps calls fast and cheap.
        ...(env.GROQ_MODEL.startsWith('openai/gpt-oss') && { reasoning_effort: 'low' }),
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    throw new AiUnavailableError(`Groq request failed: ${(err as Error).message}`);
  }
  if (!res.ok) throw new AiUnavailableError(`Groq responded with ${res.status}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
  const out = json.choices?.[0]?.message?.content;
  if (!out) throw new AiUnavailableError('Groq returned an empty response');
  return out;
}
