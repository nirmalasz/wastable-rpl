import { env } from '../config/env.js';
import { AiUnavailableError } from './types.js';

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

/** Thin Gemini REST client that asks for JSON output and returns the raw text. */
export async function callGemini(parts: GeminiPart[]): Promise<string> {
  if (!env.GEMINI_API_KEY) throw new AiUnavailableError('GEMINI_API_KEY is not set');
  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
  } catch (err) {
    throw new AiUnavailableError(`Gemini request failed: ${(err as Error).message}`);
  }
  if (!res.ok) throw new AiUnavailableError(`Gemini responded with ${res.status}`);
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
  if (!text) throw new AiUnavailableError('Gemini returned an empty response');
  return text;
}
