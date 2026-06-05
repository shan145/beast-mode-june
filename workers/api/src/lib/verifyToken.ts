const GOOGLE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

function base64UrlDecode(str: string): ArrayBuffer {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

// Returns the userId (sub claim) or null if the token is invalid.
export async function verifyFirebaseToken(token: string, projectId: string): Promise<string | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [headerB64, payloadB64, signatureB64] = parts
    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64)))
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)))

    const jwksRes = await fetch(GOOGLE_JWKS_URL)
    const { keys } = await jwksRes.json<{ keys: (JsonWebKey & { kid: string })[] }>()
    const jwk = keys.find(k => k.kid === header.kid)
    if (!jwk) return null

    const { kid: _kid, ...jwkWithoutKid } = jwk
    const publicKey = await crypto.subtle.importKey(
      'jwk', jwkWithoutKid,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['verify'],
    )

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, base64UrlDecode(signatureB64), data)
    if (!valid) return null

    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) return null
    if (payload.aud !== projectId) return null
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null
    if (!payload.sub) return null

    return payload.sub as string
  } catch {
    return null
  }
}
