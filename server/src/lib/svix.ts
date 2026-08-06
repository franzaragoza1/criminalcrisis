import crypto from 'crypto';

/**
 * Verifies a Svix webhook signature (the scheme Resend uses).
 *
 * Implemented directly rather than pulling in the `svix` package: it is a single
 * HMAC, and one fewer dependency to keep patched. The signed payload is
 * `${id}.${timestamp}.${body}` and the secret is base64 after the `whsec_`
 * prefix.
 *
 * @param rawBody the unparsed request body — parsing and re-serialising JSON
 *                changes the bytes and breaks the signature
 */
export function verifySvixSignature(
  rawBody: Buffer,
  headers: Record<string, unknown>,
  secret: string,
  toleranceSeconds = 300
): boolean {
  const id = headers['svix-id'];
  const timestamp = headers['svix-timestamp'];
  const signatureHeader = headers['svix-signature'];
  if (typeof id !== 'string' || typeof timestamp !== 'string' || typeof signatureHeader !== 'string') {
    return false;
  }

  // Reject anything outside the tolerance window to blunt replay attempts.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto
    .createHmac('sha256', secretBytes)
    .update(`${id}.${timestamp}.${rawBody.toString('utf8')}`)
    .digest('base64');

  // The header holds a space-separated list of `v<version>,<signature>` entries;
  // any matching v1 entry is enough.
  return signatureHeader.split(' ').some(part => {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) return false;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}
