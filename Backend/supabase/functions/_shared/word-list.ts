/**
 * The word list SnapWorth screens public text against first, before any AI provider: hate speech
 * and slurs, English and Filipino profanity, and threats. It also reads text the way people
 * dodge filters ("f u c k", "g4g0"). Comments are refused outright on a match
 * (`moderate-comment`); posts, listings and Hanap requests are held for a moderator
 * (`moderate-content`).
 */

export function normalizeText(text: string): string {
  let cleaned = text.replace(/[\u200B-\u200D\uFEFF]/g, '')
  // Collapse single spaced letters e.g. "f u c k" -> "fuck", "g a g o" -> "gago"
  cleaned = cleaned.replace(/\b([a-zA-Z])\s+(?=[a-zA-Z]\b)/g, '$1')
  // Leetspeak substitutions
  cleaned = cleaned
    .replace(/[@]/g, 'a')
    .replace(/[\$]/g, 's')
    .replace(/[!|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[1]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4]/g, 'a')
    .replace(/[5]/g, 's')
  return cleaned
}

export const MODERATION_PATTERNS: readonly { readonly reason: string; readonly pattern: RegExp }[] = [
  // 1. Hate speech, discrimination & slurs
  { reason: 'hate speech / slur', pattern: /\bn+[i1!|*]+g+g+[e3a4*]+r*s*\b/i },
  { reason: 'hate speech / slur', pattern: /\bn+[i1!|*]+g+g+[a4*]+s*\b/i },
  { reason: 'hate speech / slur', pattern: /\bf+[a4*]+g+([o0*]+t+s*|s*)\b/i },
  { reason: 'hate speech / slur', pattern: /\br+[e3*]+t+[a4*]+r+d+(s*|ed*|ing*)\b/i },
  { reason: 'hate speech / slur', pattern: /\bk+[i1!*]+k+[e3*]+s*\b/i },
  { reason: 'hate speech / slur', pattern: /\bc+h+[i1!*]+n+k+s*\b/i },
  { reason: 'hate speech / slur', pattern: /\bs+p+[i1!*]+c+s*\b/i },
  { reason: 'hate speech / slur', pattern: /\bt+r+[a4*]+n+n+y*\b/i },
  { reason: 'hate speech / slur', pattern: /\bg+[o0\*]+o+k+s*\b/i },
  { reason: 'hate speech / slur', pattern: /\bw+e+t+b+[a4\*]+c+k+s*\b/i },

  // 2. Swear words & profanity (English)
  { reason: 'profanity', pattern: /\bf+[\*u_a]+c+k+(s*|ing*|er*|ed*)\b/i },
  { reason: 'profanity', pattern: /\bm+o+t+h+e+r+f+[\*u_a]+c+k+(e*r*s*|ing*)\b/i },
  { reason: 'profanity', pattern: /\bs+h+[\*i!1_]+t+(s*|ty*|ted*|ting*|head*)\b/i },
  { reason: 'profanity', pattern: /\bb+[\*i!1_]+t+c+h+(es*|ing*|y*)\b/i },
  { reason: 'profanity', pattern: /\ba+s+s+h+o+l+e+s*\b/i },
  { reason: 'profanity', pattern: /\b(dumb|fat|lazy|piece\s+of)\s+ass\b/i },
  { reason: 'profanity', pattern: /\bc+[\*u_]+n+t+s*\b/i },
  { reason: 'profanity', pattern: /\bb+a+s+t+a+r+d+s*\b/i },
  { reason: 'profanity', pattern: /\bw+h+[o0\*]+r+[e3\*]+s*\b/i },
  { reason: 'profanity', pattern: /\bs+l+[\*u]+t+s*\b/i },
  { reason: 'profanity', pattern: /\bd+[\*i!]+c+k+(s*|head*)\b/i },
  { reason: 'profanity', pattern: /\bp+[\*u]+s+s+y+(s*|ies*)\b/i },
  { reason: 'profanity', pattern: /\bt+w+[a4\*]+t+s*\b/i },
  { reason: 'profanity', pattern: /\bw+[a4\*]+n+k+[e3\*]+r*s*\b/i },
  { reason: 'profanity', pattern: /\bp+r+[i1\*]+c+k+s*\b/i },

  // 3. Profanity, slurs & insults (Filipino / Tagalog)
  { reason: 'profanity (Filipino)', pattern: /\bp+[\*u]+t+a+([nñ]+g*[\s\-_]*[i1]+n+a+)?\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bt+[\*a]+[nñ]+g*[\s\-_]*[i1]+n+a+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bt+a+e+n+a+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bg+[a4\*]+g+[o0a4\*]+s*\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bt+[a4\*]+r+[a4\*]+n+t+[a4\*]+d+[o0a4\*]+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bu+l+[o0\*]+l+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bb+[o0\*]+b+[o0\*]+s*\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bp+[a4\*]+k+y+[o0\*u]+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bk+[\*u]+p+[a4\*]+l+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bi+n+[u\*]+t+[i1\*]+l+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bl+e+t*c+h+e+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bp+e+s+t+e+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bp+[o0\*]+k+p+[o0\*]+k+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bb+[a4\*]+y+[o0\*]+t+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bh+[i1\*]+n+d+[o0\*]+t+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bt+[a4\*]+n+g+[a4\*]+\b/i },

  // 4. Threats & severe harassment
  { reason: 'threat / self-harm', pattern: /\bk+i+l+l+\s+(your\s*self|ur\s*self)\b/i },
  { reason: 'threat / self-harm', pattern: /\bk+y+s+\b/i },
  { reason: 'harassment', pattern: /\bd+i+e+\s+(in\s+a\s+fire|bitch|trash|whore|scum)\b/i },
  { reason: 'harassment', pattern: /\b(slit|hang|shoot)\s+(your\s*self|ur\s*self)\b/i },
]

export function checkForbiddenLanguage(text: string): { readonly flagged: boolean; readonly reason?: string } {
  const cleaned = normalizeText(text)
  for (const item of MODERATION_PATTERNS) {
    if (item.pattern.test(cleaned) || item.pattern.test(text)) {
      return { flagged: true, reason: item.reason }
    }
  }
  return { flagged: false }
}
