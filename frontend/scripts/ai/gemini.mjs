/**
 * Minimal Gemini REST client for authoring tools (no SDK, no browser use).
 * The key is read from GEMINI_API_KEY or backend/.env and never leaves this
 * machine except in the request header to Google.
 */
import fs from 'node:fs'
import path from 'node:path'

const API = 'https://generativelanguage.googleapis.com/v1beta'

export function loadKey(root) {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY
  const envPath = path.resolve(root, '..', 'backend', '.env')
  if (fs.existsSync(envPath)) {
    const line = fs
      .readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith('GEMINI_API_KEY='))
    if (line) return line.slice('GEMINI_API_KEY='.length).trim()
  }
  throw new Error('GEMINI_API_KEY is not set (environment or backend/.env).')
}

export class QuotaError extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * One generateContent call. Retries 429 (with the server's retry delay) and
 * 5xx up to 4 times. Returns { text, grounding: [{title, uri}], usage, model }.
 */
export async function generate({ key, model, system, prompt, json = false, grounded = false, temperature = 0.4 }) {
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature, ...(json && !grounded ? { responseMimeType: 'application/json' } : {}) },
    ...(grounded ? { tools: [{ google_search: {} }] } : {}),
  }
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    })
    if (res.ok) {
      const data = await res.json()
      const cand = data.candidates?.[0]
      if (!cand?.content?.parts) throw new Error(`No content returned (finish reason: ${cand?.finishReason ?? 'unknown'}).`)
      return {
        text: cand.content.parts.map((p) => p.text ?? '').join(''),
        grounding: (cand.groundingMetadata?.groundingChunks ?? []).map((c) => c.web).filter(Boolean),
        usage: data.usageMetadata?.totalTokenCount ?? 0,
        model: data.modelVersion ?? model,
      }
    }
    const err = await res.json().catch(() => ({}))
    const message = err.error?.message ?? res.statusText
    if (res.status === 429) {
      const delay = err.error?.details?.find((d) => d.retryDelay)?.retryDelay
      const seconds = Number.parseFloat(delay ?? '') || 0
      // No retry hint (a feature not in this plan) or a long wait (a daily
      // quota) won't recover in this run: report it instead of sleeping.
      if (!seconds || seconds > 300 || attempt >= 4) throw new QuotaError(message)
      console.log(`  rate limited; waiting ${Math.ceil(seconds)} s`)
      await sleep(seconds * 1000 + 500)
      continue
    }
    if (res.status >= 500 && attempt < 4) {
      await sleep(2000 * attempt)
      continue
    }
    throw new Error(`Gemini ${res.status}: ${message}`)
  }
}

/** Grounding links are Google redirect URLs; resolve them to the real page. */
export async function resolveLinks(chunks) {
  const out = []
  for (const c of chunks) {
    let url = c.uri
    try {
      const r = await fetch(c.uri, { redirect: 'manual', signal: AbortSignal.timeout(15_000) })
      url = r.headers.get('location') ?? c.uri
    } catch {
      /* keep the redirect URL */
    }
    if (!out.some((o) => o.url === url)) out.push({ title: c.title, url })
  }
  return out
}
