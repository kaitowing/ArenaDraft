const MAX_DIMENSION = 256
const MAX_BYTES = 50_000
const INITIAL_QUALITY = 0.85
const QUALITY_STEP = 0.05
const MIN_QUALITY = 0.4

export async function compressImageToBase64(file: File): Promise<string> {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('O arquivo selecionado não é uma imagem válida.')
  }

  // Check if file is empty
  if (file.size === 0) {
    throw new Error('O arquivo selecionado está vazio.')
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch (err) {
    console.error('ImageBitmap creation failed:', err)
    throw new Error('Não foi possível processar esta imagem. Tente outro formato (JPG, PNG).')
  }

  const { width: srcW, height: srcH } = bitmap
  const scale = Math.min(1, MAX_DIMENSION / Math.max(srcW, srcH))
  const dstW = Math.round(srcW * scale)
  const dstH = Math.round(srcH * scale)

  const canvas = document.createElement('canvas')
  canvas.width = dstW
  canvas.height = dstH
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, dstW, dstH)
  ctx.drawImage(bitmap, 0, 0, dstW, dstH)
  bitmap.close()

  let quality = INITIAL_QUALITY
  let base64 = canvas.toDataURL('image/jpeg', quality)

  while (base64.length > MAX_BYTES && quality > MIN_QUALITY) {
    quality = Math.round((quality - QUALITY_STEP) * 100) / 100
    base64 = canvas.toDataURL('image/jpeg', quality)
  }

  if (base64.length > MAX_BYTES) {
    throw new Error('Não foi possível comprimir a imagem abaixo de 50KB. Tente uma imagem menor.')
  }

  return base64
}
