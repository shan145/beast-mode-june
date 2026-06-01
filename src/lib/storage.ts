const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string

export async function uploadPostImages(files: File[]): Promise<string[]> {
  return Promise.all(files.map(uploadPostImage))
}

export async function uploadPostImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) throw new Error('Image upload failed')

  const data = await res.json() as { secure_url: string }

  // Insert transformations: max 1200px wide, auto quality, auto format (WebP on modern browsers)
  return data.secure_url.replace('/upload/', '/upload/w_1200,q_auto,f_auto/')
}
