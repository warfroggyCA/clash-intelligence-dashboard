import { resolveAppOrigin } from '@/lib/app-origin';

describe('resolveAppOrigin', () => {
  it('uses NEXT_PUBLIC_APP_URL when provided', () => {
    expect(
      resolveAppOrigin({
        appUrl: 'https://example.com',
        vercelUrl: 'preview.vercel.app',
        host: 'localhost:5051',
        proto: 'http',
      }),
    ).toBe('https://example.com');
  });

  it('normalizes APP_URL without protocol', () => {
    expect(resolveAppOrigin({ appUrl: 'example.com' })).toBe('https://example.com');
  });

  it('uses VERCEL url when app url is missing', () => {
    expect(resolveAppOrigin({ vercelUrl: 'my-app.vercel.app' })).toBe('https://my-app.vercel.app');
  });

  it('falls back to host and proto', () => {
    expect(resolveAppOrigin({ host: 'localhost:5051', proto: 'http' })).toBe('http://localhost:5051');
  });

  it('falls back to default origin', () => {
    expect(resolveAppOrigin({})).toBe('http://localhost:5050');
    expect(resolveAppOrigin({ defaultOrigin: 'http://localhost:3000' })).toBe('http://localhost:3000');
  });
});
