// End-to-end tests — run them with ../e2e.sh (it prepares a separate database and starts the app on :5174).
import { defineConfig } from 'cypress';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MAIL_DIR = path.resolve('cypress/tmp/mail');   // e2e.sh sets MAIL_BACKEND=file → MAIL_FILE_DIR

// TOTP (RFC 6238) — what an authenticator app shows, so a test can log in with 2FA
function totp(secret, at = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of secret.replace(/[\s=]/g, '').toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map(b => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const h = crypto.createHmac('sha1', key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5174',
    viewportWidth: 1280,
    viewportHeight: 800,
    defaultCommandTimeout: 8000,
    video: false,
    setupNodeEvents(on) {
      on('task', {
        // The newest email sent to `to` (null if none yet)
        lastMail(to) {
          if (!fs.existsSync(MAIL_DIR)) return null;
          const mails = fs.readdirSync(MAIL_DIR).filter(f => f.endsWith('.json')).sort()
            .map(f => JSON.parse(fs.readFileSync(path.join(MAIL_DIR, f), 'utf-8')))
            .filter(m => m.to === to);
          return mails.length ? mails[mails.length - 1] : null;
        },
        // The current code, and the next one (a code works only once, so the second login needs the next step)
        totp({ secret, offsetSteps = 0 }) {
          return totp(secret, Date.now() + offsetSteps * 30_000);
        },
      });
    },
  },
});
