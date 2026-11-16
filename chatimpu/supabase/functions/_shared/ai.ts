/**
 * Newsroom AI helpers used by the CMS (via the `ai-assist` Edge Function):
 *   summarize  – long article → 60–80 word card (headline + summary) in the article's language
 *   translate  – card → other Indian languages
 *   headlines  – 5 headline options in house style
 *   moderate   – screen a citizen report for clickbait / unverifiable claims / PII
 *
 * Uses Claude Opus 5.5 with structured JSON output. Server-side refusal fallbacks are enabled
 * (`fallbacks: "default"`), so a safety decline on a sensitive crime/politics story is retried
 * on a fallback model inside the same call instead of failing the editor's request.
 */
import Anthropic from '@anthropic-ai/sdk';

export const MODEL = 'claude-opus-5-5';

export const LANG_NAMES: Record<string, string> = {
  en: 'English', te: 'Telugu', hi: 'Hindi', ta: 'Tamil', kn: 'Kannada', ml: 'Malayalam', mr: 'Marathi', bn: 'Bengali', gu: 'Gujarati',
};

const HOUSE_STYLE = `You are a senior desk editor at Chatimpu, a hyperlocal Indian short-news app.
House style:
- Each story is ONE card: a headline (max 14 words) and a summary of 60–80 words.
- Lead with what happened, where (village/mandal/district) and when. Then the most useful fact for local readers (timings, helpline numbers, eligibility, prices).
- Neutral, factual, no opinion, no sensational words, no exclamation marks, no emojis.
- Keep every number, name, place and date exactly as in the source. Never invent facts. If the source lacks something, leave it out.
- Use the Indian numbering system (lakh, crore) and ₹.
- Write natural, everyday news language for the target language (as in a respected regional daily), not word-for-word translation. Keep proper nouns in the target script.`;

type Json = Record<string, unknown>;

export class AiRefusalError extends Error {}

async function structured<T>(client: Anthropic, prompt: string, schema: Json, effort: 'low' | 'medium' = 'low'): Promise<T> {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: HOUSE_STYLE,
    output_config: { effort, format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: prompt }],
  });
  if (response.stop_reason === 'refusal') {
    throw new AiRefusalError(response.stop_details?.explanation ?? 'The model declined this request.');
  }
  if (response.stop_reason === 'max_tokens') throw new Error('AI response was cut off; try a shorter article.');
  const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  return JSON.parse(text) as T;
}

const card = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'summary'],
  properties: { headline: { type: 'string' }, summary: { type: 'string' } },
};

export interface Card { headline: string; summary: string }

export function summarize(client: Anthropic, article: string, lang: string): Promise<Card & { wordCount: number }> {
  return structured<Card>(client,
    `Summarise this article into one Chatimpu card in ${LANG_NAMES[lang] ?? 'English'}. The summary MUST be 60–80 words.\n\n<article>\n${article}\n</article>`,
    card,
  ).then((c) => ({ ...c, wordCount: c.summary.trim().split(/\s+/).length }));
}

export async function translate(client: Anthropic, source: Card, from: string, to: string[]): Promise<Record<string, Card>> {
  const props = Object.fromEntries(to.map((l) => [l, card]));
  return structured<Record<string, Card>>(client,
    `Translate this ${LANG_NAMES[from]} news card into each of: ${to.map((l) => `${l} (${LANG_NAMES[l]})`).join(', ')}.
Keep each summary between 60 and 80 words (for agglutinative scripts like Telugu, Tamil, Kannada and Malayalam, 40–70 words is fine).
Return an object keyed by language code.\n\n<card>\nHeadline: ${source.headline}\nSummary: ${source.summary}\n</card>`,
    { type: 'object', additionalProperties: false, required: to, properties: props },
  );
}

export async function headlines(client: Anthropic, source: Card, lang: string): Promise<string[]> {
  const r = await structured<{ options: string[] }>(client,
    `Suggest 5 alternative headlines in ${LANG_NAMES[lang]} for this card. Vary the angle (local impact, numbers-first, service info). Max 14 words each.\n\n<card>\nHeadline: ${source.headline}\nSummary: ${source.summary}\n</card>`,
    { type: 'object', additionalProperties: false, required: ['options'], properties: { options: { type: 'array', items: { type: 'string' } } } },
  );
  return r.options.slice(0, 5);
}

export interface ModerationResult { flags: string[]; risk: 'low' | 'medium' | 'high'; note: string; suggested?: Card }

export function moderate(client: Anthropic, report: { headline: string; body: string; lang: string }): Promise<ModerationResult> {
  return structured<ModerationResult>(client,
    `A citizen reporter submitted this story. Assess it for a district moderator.
Flag any of: clickbait, unverified claim, defamation risk, communal/caste tension, personal data (phone numbers, addresses of private people), graphic content, not local news, spam.
Then, if publishable, rewrite it as a Chatimpu card in ${LANG_NAMES[report.lang]} (omit "suggested" if not publishable).

<report>\nHeadline: ${report.headline}\nBody: ${report.body}\n</report>`,
    {
      type: 'object', additionalProperties: false, required: ['flags', 'risk', 'note'],
      properties: {
        flags: { type: 'array', items: { type: 'string' } },
        risk: { type: 'string', enum: ['low', 'medium', 'high'] },
        note: { type: 'string' },
        suggested: card,
      },
    },
    'medium',
  );
}
