/**
 * What a question to Worthy is about. `chat` is answered in Worthy's own words; the rest are
 * answered from the app's data (a fair range, a trend, the collection, a listing draft), because
 * a number has to come from real sales, never from a model's guess.
 */
export type WorthyIntent = 'chat' | 'price' | 'trend' | 'collection' | 'listing';

/** An answer worked out on the device, where it has a model (Apple Intelligence on iOS). */
export interface WorthyAnswer {
  readonly intent: WorthyIntent;
  readonly reply: string;
}

/** Answers a question on the device, or null when it can't (no model, refused, too slow). */
export type WorthyAnswerer = (question: string) => Promise<WorthyAnswer | null>;

const intents: readonly WorthyIntent[] = ['chat', 'price', 'trend', 'collection', 'listing'];

/** The intent from the question's words alone, for when there's no model to ask. */
export function intentFor(question: string): WorthyIntent {
  if (/collection|portfolio|sell next/i.test(question)) return 'collection';
  if (/fair|offer|price\b|worth it/i.test(question)) return 'price';
  if (/listing|write|describe/i.test(question)) return 'listing';
  if (/trend|heading|trending/i.test(question)) return 'trend';
  return 'chat';
}

/** Whether a reply names an amount of money, which only the app's data may do. */
export function talksMoney(text: string): boolean {
  return /\d/.test(text) && /₱|\bphp\b|\bpesos?\b/i.test(text);
}

/**
 * How to answer: the device's own words for a chat it could answer, or the card for its intent.
 * A chat reply that names an amount is treated as a price question and answered with the range,
 * so a number never reaches the screen from the small model.
 */
export function settleAnswer(
  question: string,
  answer: WorthyAnswer | null,
): { readonly intent: WorthyIntent; readonly words?: string } {
  if (!answer || !intents.includes(answer.intent)) return { intent: intentFor(question) };
  const words = answer.reply.trim();
  if (answer.intent !== 'chat') return { intent: answer.intent };
  if (!words) return { intent: intentFor(question) };
  if (talksMoney(words)) return { intent: 'price' };
  return { intent: 'chat', words };
}
