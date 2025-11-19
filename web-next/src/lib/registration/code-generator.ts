const COLOR_WORDS = [
  'RED',
  'BLUE',
  'GOLD',
  'ONYX',
  'IVORY',
  'EMBER',
  'SAGE',
  'NOVA',
  'CITRINE',
  'CRIMSON',
  'LUMEN',
  'AURORA',
  'STORM',
  'GLACIER',
  'SHADOW',
];

const CREST_WORDS = [
  'BLADE',
  'SHIELD',
  'KING',
  'DRAGON',
  'AXE',
  'SPARK',
  'NOVA',
  'SENTRY',
  'TEMPEST',
  'RAVEN',
  'MANTLE',
  'ORBIT',
  'DUSK',
  'BANNER',
  'FALCON',
];

const BASE32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DIGITS = '23456789';

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDigits(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += DIGITS[Math.floor(Math.random() * DIGITS.length)];
  }
  return out;
}

function randomAlphaNumeric(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += BASE32[Math.floor(Math.random() * BASE32.length)];
  }
  return out;
}

export interface VerificationCodeOptions {
  ensureUnique?: (candidate: string) => Promise<boolean> | boolean;
  maxAttempts?: number;
}

/**
 * Generates an easy-to-say verification code for in-game chat.
 * Supports optional uniqueness check via callback.
 */
export async function generateVerificationCode(options: VerificationCodeOptions = {}): Promise<string> {
  const attempts = options.maxAttempts ?? 8;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const pattern = attempt % 2 === 0 ? 'word-number' : 'clash-prefix';
    let candidate: string;

    if (pattern === 'word-number') {
      const color = randomFrom(COLOR_WORDS);
      const crest = randomFrom(CREST_WORDS);
      candidate = `${color}-${crest}${randomDigits(2)}`;
    } else {
      candidate = `CLASH-${randomAlphaNumeric(4)}`;
    }

    if (!options.ensureUnique) {
      return candidate;
    }

    const isUnique = await options.ensureUnique(candidate);
    if (isUnique) {
      return candidate;
    }
  }

  throw new Error('Unable to generate unique verification code after multiple attempts');
}
