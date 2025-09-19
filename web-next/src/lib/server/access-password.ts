import { createHash, randomBytes, timingSafeEqual } from 'crypto';

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DEFAULT_LENGTH = 8;

export function generateAccessPassword(length: number = DEFAULT_LENGTH): string {
  const bytes = randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i += 1) {
    const index = bytes[i] % PASSWORD_ALPHABET.length;
    password += PASSWORD_ALPHABET[index];
  }
  return password;
}

export function hashAccessPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export function passwordsMatch(expectedHash: string | undefined, candidate: string): boolean {
  if (!expectedHash) {
    return false;
  }
  const candidateHash = hashAccessPassword(candidate);
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const candidateBuffer = Buffer.from(candidateHash, 'hex');
  if (expectedBuffer.length !== candidateBuffer.length) {
    return false;
  }
  try {
    return timingSafeEqual(expectedBuffer, candidateBuffer);
  } catch {
    return false;
  }
}
