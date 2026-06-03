export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 })
    }

    const url = new URL(request.url)
    const cloudinaryUrl = `https://res.cloudinary.com${url.pathname}`

    // Check edge cache first — works on custom domains
    const cache = caches.default
    const cacheKey = new Request(request.url)
    const cached = await cache.match(cacheKey)
    if (cached) return cached

    // Cache miss — fetch from Cloudinary
    const response = await fetch(cloudinaryUrl, {
      headers: { Accept: request.headers.get('Accept') ?? '*/*' },
    })

    if (!response.ok) return response

    const headers = new Headers(response.headers)
    headers.set('Cache-Control', 'public, max-age=2592000') // 30 days
    headers.set('Access-Control-Allow-Origin', '*')
    headers.delete('Set-Cookie')
    headers.delete('Vary')
    headers.delete('cdn-cache-control')
    headers.delete('surrogate-control')

    const responseToCache = new Response(response.body, { status: response.status, headers })

    // Store in edge cache — non-blocking
    ctx.waitUntil(cache.put(cacheKey, responseToCache.clone()))

    return responseToCache
  },
}
