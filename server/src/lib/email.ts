/**
 * Email address hygiene.
 *
 * Exists because one contact was imported as "tunesforotik@gmail.com" plus an
 * invisible U+2063 SEPARATOR picked up from a copy-paste. Nothing showed it:
 * not the admin table, not the unique index (it is a genuinely different
 * string from the clean address, which was already in the list), and not the
 * old validator, whose `[^\s@]+` happily matched it because U+2063 is a
 * format character, not whitespace.
 *
 * Resend then rejected the whole 98-message batch with a 422, and 97 valid
 * recipients were marked failed over one invisible character in somebody
 * else's address. So: clean on the way in, and never trust that it worked.
 *
 * The class below is written as \u escapes on purpose. The literal
 * characters are invisible in an editor, which is the entire problem.
 */

/**
 * No visible width, no business in an email address: soft hyphen, zero-width
 * spaces and joiners, bidi marks / isolates / overrides, the invisible maths
 * operators, and the BOM.
 */
const INVISIBLE =
  /[\u00AD\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

/** Trims, strips invisible characters and lowercases. Safe to apply twice. */
export function cleanAddress(raw: unknown): string {
  return String(raw ?? '').replace(INVISIBLE, '').trim().toLowerCase();
}

/**
 * Why this address cannot be sent to, or null if it can.
 *
 * Deliberately ASCII-only. Internationalised addresses are a real thing, but
 * Resend rejects them outright, and a rejection that takes the rest of the
 * batch down with it is worse than not supporting them.
 */
export function addressProblem(email: string): string | null {
  if (!email) return 'is empty';
  if (/[^\x20-\x7E]/.test(email)) {
    const bad = [...email]
      .filter(ch => ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) > 0x7e)
      .map(ch => `U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`);
    return `contains non-ASCII characters (${[...new Set(bad)].join(', ')})`;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'is not a valid email address';
  return null;
}

export const isEmail = (s: string): boolean => addressProblem(cleanAddress(s)) === null;
