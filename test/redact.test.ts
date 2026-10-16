import { describe, expect, it } from 'vitest';
import { isSensitivePath, redactExcerpt, MAX_EXCERPT } from '../src/redact.js';

describe('redactExcerpt', () => {
  it('trims and keeps an ordinary line', () => {
    expect(redactExcerpt('   const camera = useRef<CameraView>(null);  ')).toBe('const camera = useRef<CameraView>(null);');
  });
  it('cuts long lines to 160 characters with an ellipsis', () => {
    const r = redactExcerpt('x'.repeat(400))!;
    expect(r.length).toBe(MAX_EXCERPT + 1);
    expect(r.endsWith('…')).toBe(true);
  });
  it('keeps a long plain letter run, truncated', () => {
    const r = redactExcerpt('x'.repeat(200));
    expect(r).not.toBeNull();
    expect(r!.length).toBe(MAX_EXCERPT + 1);
  });
  it.each([
    '-----BEGIN PRIVATE KEY-----',
    'const key = "sk_live_51Hxxxxxxxx";',
    'AKIAIOSFODNN7EXAMPLE',
    'eyJhbGciOiJFUzI1NiIsImtpZCI6IkFCQ0RFRjEyMzQifQ.eyJpc3MiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAifQ.sig',
    'token = process.env.X',
    'password: "hunter2"',
    'secretKey: value',
    'd41d8cd98f00b204e9800998ecf8427e00000000',
    'JWT_SECRET = "abc"',
    'clientSecret: "abc"',
    'STRIPE_SECRET_KEY=whsec_abcdef',
    'accessToken = "abc"',
    'API_TOKEN=abc',
    'db_password = "abc"',
    '"token": "abc123"',
    'ghp_abcdefghijklmnopqrstuvwxyz0123',
    'xoxb-1234567890-abcdefghij',
    'AIzaSyA1234567890abcdefghijklmnopqrs',
    'Authorization: Bearer abcdefghijklmnop1234',
    'key = 0x' + 'a'.repeat(64),
    'key_' + 'b'.repeat(32),
    'aGVsbG8gd29ybGQgdGhpcyBpcyBhIHNlY3JldCBrZXkxMjM0',
  ])('hides a line that looks like a secret: %s', (line) => {
    expect(redactExcerpt(line)).toBeNull();
  });
  it('keeps a line with a short hex colour', () => {
    expect(redactExcerpt("color: '#ebe8df'")).toBe("color: '#ebe8df'");
  });
  it('keeps a line where token is only part of a longer identifier', () => {
    expect(redactExcerpt('const accessTokenExpired = isExpired(now);')).toBe('const accessTokenExpired = isExpired(now);');
  });
});

describe('isSensitivePath', () => {
  it.each([
    '.env',
    '.env.local',
    'keys/AuthKey_ABC123DEFG.p8',
    'certs/server.pem',
    'android/app/release.keystore',
    'google-credentials.json',
    'ios/dist.mobileprovision',
    'ssh/id_rsa',
    'ssh/id_ed25519',
    '.npmrc',
    '.netrc',
    'certs/cert.pfx',
    'config/secrets.json',
    'service-account-prod.json',
    'C:\\app\\.env',
  ])('flags %s', (p) => {
    expect(isSensitivePath(p)).toBe(true);
  });
  it.each(['app.json', 'src/env.ts', 'ios/App/Info.plist', 'docs/environment.md', 'src/tokenizer.ts', 'lib/password-strength.ts'])('allows %s', (p) => {
    expect(isSensitivePath(p)).toBe(false);
  });
});
