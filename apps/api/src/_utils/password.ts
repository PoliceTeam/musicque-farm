import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64')}$${(await derive(password, salt)).toString('base64')}`;
}

/** A missing hash still derives a key, so unknown and known emails take the same time. */
export async function verifyPassword(password: string, stored: string | null | undefined) {
  const [scheme, salt, hash] = (stored ?? '').split('$');
  const valid = scheme === 'scrypt' && !!salt && !!hash;
  const expected = valid ? Buffer.from(hash, 'base64') : Buffer.alloc(KEY_LENGTH);
  const actual = await derive(password, valid ? Buffer.from(salt, 'base64') : Buffer.alloc(16));
  return valid && expected.length === actual.length && timingSafeEqual(expected, actual);
}
