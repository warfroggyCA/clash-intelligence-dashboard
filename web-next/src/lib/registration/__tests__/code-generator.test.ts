import { generateVerificationCode } from '../code-generator';

describe('generateVerificationCode', () => {
  const CODE_PATTERN = /^(?:[A-Z]+-[A-Z]+\d{2}|CLASH-[A-Z0-9]{4})$/;

  it('generates readable verification codes', async () => {
    const samples: string[] = [];
    for (let i = 0; i < 25; i += 1) {
      samples.push(await generateVerificationCode());
    }

    expect(samples.every((sample) => CODE_PATTERN.test(sample))).toBe(true);
  });

  it('respects ensureUnique callback retries', async () => {
    let attempts = 0;
    const result = await generateVerificationCode({
      async ensureUnique() {
        attempts += 1;
        return attempts > 2;
      },
      maxAttempts: 5,
    });

    expect(CODE_PATTERN.test(result)).toBe(true);
    expect(attempts).toBe(3);
  });

  it('throws after exceeding max attempts', async () => {
    await expect(
      generateVerificationCode({
        ensureUnique: async () => false,
        maxAttempts: 2,
      }),
    ).rejects.toThrow('Unable to generate unique verification code');
  });
});
