// Resize client-side to max 768px JPEG; returns data URL (base64 sent to AI without prefix).
export async function resizeImage(file: File, max = 768): Promise<string> {
  const img = await loadImage(file)
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
  const c = document.createElement('canvas')
  c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.85)
}
export function loadImage(src: File | string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = typeof src === 'string' ? src : URL.createObjectURL(src)
    const img = new Image()
    img.onload = () => res(img); img.onerror = rej; img.src = url
  })
}
export const b64 = (dataUrl: string) => dataUrl.split(',')[1]
