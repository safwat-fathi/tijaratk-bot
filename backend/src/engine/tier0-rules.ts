import { cpLen, stripChars } from '../core/pystr.js';

const GREETING = /^\s*(hi|hello|hey|السلام عليكم|أهلا|اهلا|صباح الخير|مساء الخير)\s*[!.،؟]*\s*$/i;
const SPAM = /(http[s]?:\/\/|www\.)\S+/i;
const SPAM_SUB = new RegExp(SPAM.source, 'gi');
const SINGLE_EMOJI = /^[\u{1F300}-\u{1FAFF}☀-➿]{1,3}$/u;
// A URL alone (or with a couple of filler words) is spam; a URL inside a real question is a shared product link.
const SPAM_REMAINDER_MAX_CHARS = 20;

export function matchTier0(normalizedText: string): string | null {
  const text = normalizedText.trim();
  if (!text) return null;
  if (SINGLE_EMOJI.test(text)) return 'reaction';
  if (GREETING.test(text)) return 'greeting';
  if (SPAM.test(text)) {
    const urlStripped = text.replace(SPAM_SUB, '').trim();
    const hasQuestion = urlStripped.includes('?') || urlStripped.includes('؟');
    const remainder = stripChars(urlStripped, ' \t\n.,!،-');
    if (!hasQuestion && cpLen(remainder) <= SPAM_REMAINDER_MAX_CHARS) return 'spam';
  }
  return null;
}
