// Downscale and re-encode an image File into a compact data URL.
// Large images stored raw as base64 quickly exhaust chrome.storage.local's
// quota; shrinking them on upload keeps avatars/backgrounds small and saveable.
export function fileToDownscaledDataURL(file, { maxDim = 1600, quality = 0.85, mime = 'image/jpeg' } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      reject(new Error('Not an image file'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error || new Error('Could not read file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not decode image'))
      img.onload = () => {
        let { width, height } = img
        if (!width || !height) { reject(new Error('Invalid image dimensions')); return }
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        // JPEG has no alpha channel; paint a white matte so transparent areas
        // don't render as black.
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL(mime, quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
