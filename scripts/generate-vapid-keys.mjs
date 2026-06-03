#!/usr/bin/env node
// Generates a VAPID key pair for the notifications Cloudflare Worker.
//
// Usage:
//   node scripts/generate-vapid-keys.mjs
//
// Output:
//   VAPID_PUBLIC_KEY  — add to .env.local as VITE_VAPID_PUBLIC_KEY
//                       also set as Worker secret: wrangler secret put VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY_JWK — set as Worker secret: wrangler secret put VAPID_PRIVATE_KEY_JWK
//
// Run this once and store the output securely. Changing keys invalidates all
// existing push subscriptions (users will re-subscribe on next app load).

const { subtle } = globalThis.crypto

const keyPair = await subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify'],
)

const privateJwk = await subtle.exportKey('jwk', keyPair.privateKey)
const publicRaw = new Uint8Array(await subtle.exportKey('raw', keyPair.publicKey))

function b64uEncode(bytes) {
  return Buffer.from(bytes).toString('base64url')
}

const publicKeyB64u = b64uEncode(publicRaw)

console.log('\n=== VAPID Keys ===\n')
console.log('Add to .env.local:')
console.log(`VITE_VAPID_PUBLIC_KEY=${publicKeyB64u}`)
console.log('')
console.log('Set as Worker secrets (run in cloudflare-worker/notifications/):')
console.log(`  wrangler secret put VAPID_PUBLIC_KEY`)
console.log(`    → paste: ${publicKeyB64u}`)
console.log('')
console.log(`  wrangler secret put VAPID_PRIVATE_KEY_JWK`)
console.log(`    → paste: ${JSON.stringify(privateJwk)}`)
console.log('')
console.log(`  wrangler secret put VAPID_SUBJECT`)
console.log(`    → paste: mailto:your@email.com`)
console.log('')
console.log(`  wrangler secret put FIREBASE_API_KEY`)
console.log(`    → paste: (your VITE_FIREBASE_API_KEY value)`)
console.log('')
