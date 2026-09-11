const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export type ImageAttachment = { url: string; type: 'image' }

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Fotoja nuk mund të lexohet.'))
    image.src = source
  })
}

/** Compresses a selected image so it remains safe for the JSON API payload. */
export async function prepareImageAttachment(file: File): Promise<ImageAttachment> {
  if (!allowedTypes.has(file.type)) throw new Error('Zgjidh një foto JPG, PNG ose WebP.')
  if (file.size > 8 * 1024 * 1024) throw new Error('Fotoja duhet të jetë më e vogël se 8 MB.')
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(objectUrl)
    const scale = Math.min(1, 960 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Shfletuesi nuk e mbështet përpunimin e fotos.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    let url = canvas.toDataURL('image/jpeg', 0.76)
    if (url.length > 600_000) {
      const reducedScale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight))
      canvas.width = Math.max(1, Math.round(image.naturalWidth * reducedScale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * reducedScale))
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      url = canvas.toDataURL('image/jpeg', 0.68)
    }
    if (url.length > 600_000) throw new Error('Fotoja është ende shumë e madhe; zgjidh një foto më të vogël.')
    return { url, type: 'image' }
  } finally { URL.revokeObjectURL(objectUrl) }
}
