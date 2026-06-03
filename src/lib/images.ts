const WORKER_URL = (import.meta.env.VITE_IMAGE_CDN_URL as string | undefined)?.replace(/\/$/, '')

// Rewrites a Cloudinary URL to go through the Cloudflare Worker cache.
// Falls back to the original URL if VITE_IMAGE_CDN_URL is not configured.
export function toWorkerUrl(cloudinaryUrl: string): string {
  if (!WORKER_URL) return cloudinaryUrl
  return cloudinaryUrl.replace('https://res.cloudinary.com', WORKER_URL)
}
