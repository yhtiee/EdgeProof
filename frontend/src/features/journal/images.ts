import { useEffect, useState } from 'react'
import { api, apiRaw } from '../../lib/api/client'
import { readDisplay } from '../../lib/theme'

/**
 * Screenshots (JR-11): compressed in the browser to WebP, about 1600 px
 * wide and 200 KB, then uploaded through a presigned URL and confirmed
 * (the server re-encodes and strips EXIF). Images are private, so they're
 * fetched with the session and shown from blob URLs.
 */
const MAX_WIDTH = 1600
const TARGET_BYTES = 200_000

async function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that image."))), 'image/webp', quality),
  )
}

export async function compressToWebp(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That file isn't an image we can read.")
  })
  const scale = Math.min(1, MAX_WIDTH / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  let quality = 0.82
  let blob = await toBlob(canvas, quality)
  while (blob.size > TARGET_BYTES && quality > 0.45) {
    quality -= 0.12
    blob = await toBlob(canvas, quality)
  }
  // Browsers without WebP encoding fall back to PNG; the server converts it.
  return blob
}

type Presign = { key: string; url: string; method: 'PUT'; headers: Record<string, string>; auth: boolean }

export async function uploadScreenshot(file: Blob): Promise<string> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error("Screenshots need a connection. Save the trade now and add them when you're back online.")
  }
  const blob = await compressToWebp(file)
  const type = blob.type || 'image/webp'
  const p = await api<Presign>('/uploads/presign', { method: 'POST', body: { content_type: type, size: blob.size }, resilient: false })
  await apiRaw(p.auth ? p.url.replace(/^\/api\/v1/, '') : p.url, { method: p.method, body: blob, headers: p.headers, auth: p.auth })
  await api(`/uploads/${p.key}/confirm`, { method: 'POST', resilient: false })
  return p.key
}

const urls = new Map<string, Promise<string>>()

/** Data-saver mode (or the browser's Save-Data hint) stops images loading by themselves. */
export function dataSaver(): boolean {
  if (readDisplay().dataSaver) return true
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return !!conn?.saveData
}

export function useScreenshot(key: string | undefined, autoLoad = !dataSaver()) {
  const [state, setState] = useState<{ url?: string; error?: string; loading: boolean }>({ loading: false })
  const [requested, setRequested] = useState(autoLoad)
  useEffect(() => {
    if (!key || !requested) return
    let alive = true
    if (!urls.has(key)) {
      urls.set(
        key,
        apiRaw(`/uploads/${key}`).then(async (r) => URL.createObjectURL(await r.blob())),
      )
    }
    setState({ loading: true })
    urls
      .get(key)!
      .then((url) => alive && setState({ url, loading: false }))
      .catch((e: Error) => {
        urls.delete(key)
        if (alive) setState({ error: e.message, loading: false })
      })
    return () => {
      alive = false
    }
  }, [key, requested])
  return { ...state, requested, load: () => setRequested(true) }
}
