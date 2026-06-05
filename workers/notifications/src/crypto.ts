// VAPID JWT signing and RFC 8291 / RFC 8188 push payload encryption
// Uses the Web Crypto API — no npm dependencies.

export function b64uEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function b64uDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - b64.length % 4) % 4)
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0))
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const a of arrays) { out.set(a, off); off += a.length }
  return out
}

// HKDF-Extract(salt, ikm) = HMAC-SHA-256(key=salt, data=ikm)
async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, ikm))
}

// HKDF-Expand(prk, info, length)
async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const chunks: Uint8Array[] = []
  let t = new Uint8Array(0)
  let i = 1
  while (chunks.reduce((s, c) => s + c.length, 0) < length) {
    t = new Uint8Array(await crypto.subtle.sign('HMAC', key, concat(t, info, new Uint8Array([i++]))))
    chunks.push(t)
  }
  return concat(...chunks).slice(0, length)
}

// Build the VAPID Authorization header value for a push request
export async function vapidAuthorization(
  endpoint: string,
  subject: string,
  privateKeyJwk: JsonWebKey,
  publicKeyB64u: string,
): Promise<string> {
  const origin = new URL(endpoint).origin
  const now = Math.floor(Date.now() / 1000)

  const headerB64 = b64uEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payloadB64 = b64uEncode(new TextEncoder().encode(JSON.stringify({ aud: origin, exp: now + 43200, sub: subject })))
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`)

  const privKey = await crypto.subtle.importKey(
    'jwk', privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign'],
  )
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privKey, signingInput)
  const jwt = `${headerB64}.${payloadB64}.${b64uEncode(new Uint8Array(sig))}`

  return `vapid t=${jwt},k=${publicKeyB64u}`
}

export interface PushSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

// Encrypt a push notification payload per RFC 8291 + RFC 8188 (aes128gcm)
export async function encryptPushPayload(plaintext: string, sub: PushSubscription): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // Receiver's P-256 public key (uncompressed, 65 bytes)
  const receiverPubRaw = b64uDecode(sub.keys.p256dh)
  const receiverPubKey = await crypto.subtle.importKey(
    'raw', receiverPubRaw,
    { name: 'ECDH', namedCurve: 'P-256' },
    true, [],
  )

  // Ephemeral sender ECDH key pair
  const senderPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const senderPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', senderPair.publicKey))

  // ECDH shared secret (32 bytes)
  const ecdhBits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverPubKey }, senderPair.privateKey, 256)
  )

  const authSecret = b64uDecode(sub.keys.auth)

  // Stage 1 (RFC 8291 §3.3):
  //   PRK_key = HKDF-Extract(auth_secret, ecdh_secret)
  //   IKM     = HKDF-Expand(PRK_key, "WebPush: info\0" || ua_pub || as_pub, 32)
  const prkKey = await hkdfExtract(authSecret, ecdhBits)
  const keyInfo = concat(new TextEncoder().encode('WebPush: info\x00'), receiverPubRaw, senderPubRaw)
  const ikm = await hkdfExpand(prkKey, keyInfo, 32)

  // Stage 2:
  //   PRK   = HKDF-Extract(random_salt, IKM)
  //   CEK   = HKDF-Expand(PRK, "Content-Encoding: aes128gcm\0", 16)
  //   NONCE = HKDF-Expand(PRK, "Content-Encoding: nonce\0", 12)
  const prk = await hkdfExtract(salt, ikm)
  const cek = await hkdfExpand(prk, new TextEncoder().encode('Content-Encoding: aes128gcm\x00'), 16)
  const nonce = await hkdfExpand(prk, new TextEncoder().encode('Content-Encoding: nonce\x00'), 12)

  // Encrypt: plaintext + 0x02 last-record delimiter, AES-128-GCM
  const plainBytes = new TextEncoder().encode(plaintext)
  const padded = new Uint8Array(plainBytes.length + 1)
  padded.set(plainBytes)
  padded[plainBytes.length] = 0x02

  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt'])
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, padded)
  )

  // RFC 8188 aes128gcm content-coding header:
  //   salt (16) + rs (4, big-endian, 4096) + keyid_len (1, = 65) + sender_pub (65) = 86 bytes total
  const header = new Uint8Array(21 + senderPubRaw.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, 4096, false)
  header[20] = senderPubRaw.length
  header.set(senderPubRaw, 21)

  return concat(header, ciphertext)
}
