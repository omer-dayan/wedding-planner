const MAX_EDGE = 720
const MAX_CHARS = 170_000

/** Shrink a photo so it can be stored on the venue document and shown beside the card. */
export async function compressImageFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas')
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  let quality = 0.72
  let data = canvas.toDataURL('image/jpeg', quality)
  while (data.length > MAX_CHARS && quality > 0.4) {
    quality -= 0.1
    data = canvas.toDataURL('image/jpeg', quality)
  }
  if (data.length > MAX_CHARS) throw new Error('too-large')
  return data
}
