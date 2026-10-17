import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button, SelectField } from '../../components/ui'
import { findVague } from './banned'
import { describeCondition } from './describe'
import { OPTION, TF_LABEL } from './labels'
import { isDirectional, mirror } from './mirror'
import { ParamField } from './ParamField'
import type { Condition, ConditionType, Timeframe } from './types'
import { BLOCK, CONDITIONS, PATTERN_DEFAULTS } from './vocabulary'

/**
 * One setup condition (DESIGN: Condition card). The preview sentence is the
 * card's legend and updates as parameters change; parameters that don't
 * apply to the current choice are hidden.
 */
type Props = {
  cond: Condition
  index: number
  path: string
  timeframes: Timeframe[]
  direction: 'long' | 'short' | 'both'
  errors: Record<string, string>
  readOnly?: boolean
  onChange: (c: Condition) => void
  onRemove: () => void
}

function visibleParams(c: Condition): string[] {
  const p = c.params
  return Object.keys(CONDITIONS[c.type]).filter((k) => {
    if (c.type === 'level') {
      if (k === 'tolerance') return p.event === 'within'
      if (k === 'strength') return String(p.level).startsWith('swing')
    }
    if (c.type === 'candle_pattern') {
      if (k === 'ratio') return String(p.pattern).includes('engulfing')
      if (k === 'wick_ratio' || k === 'min_range_atr') return String(p.pattern).includes('pin_bar')
    }
    if (c.type === 'distance' && (k === 'ma' || k === 'period')) return p.to === 'ma'
    return true
  })
}

export function ConditionCard(props: Props) {
  if (props.cond.type === 'free_text') return <FreeTextCard {...props} />
  const { cond, index, path, timeframes, direction, errors, readOnly, onChange, onRemove } = props
  const set = (key: string, value: unknown) => {
    let params = { ...cond.params, [key]: value }
    if (cond.type === 'candle_pattern' && key === 'pattern') {
      params = { pattern: value, ...(PATTERN_DEFAULTS[String(value)] ?? {}) }
    }
    if (cond.type === 'level' && key === 'event' && value === 'within' && !params.tolerance) params.tolerance = { unit: 'pips', value: 5 }
    if (cond.type === 'level' && key === 'level' && String(value).startsWith('swing') && !params.strength) params.strength = 3
    onChange({ ...cond, params })
  }
  const sentence = describeCondition(cond)
  return (
    <fieldset className={`rounded-lg border bg-surface p-4 ${Object.keys(errors).some((k) => k.startsWith(path)) ? 'border-danger' : 'border-border'}`}>
      <legend className="sr-only">
        Condition {index + 1}: {sentence}
      </legend>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 font-mono text-caption text-subtle">{index + 1}</span>
        <p className="min-w-0 flex-1 text-body font-semibold" aria-live="polite">
          {sentence}
        </p>
        {!readOnly && (
          <Button variant="ghost" onClick={onRemove} aria-label={`Remove condition ${index + 1}`}>
            <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden sm:inline">Remove</span>
          </Button>
        )}
      </div>
      {direction === 'both' && isDirectional(cond) && (
        <p className="ml-6 mt-1 text-small text-muted">Sells mirror this: {describeCondition(mirror(cond))}</p>
      )}
      <div className="ml-6 mt-4 grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Chart"
          value={cond.timeframe ?? ''}
          disabled={readOnly}
          data-path={`${path}.timeframe`}
          error={errors[`${path}.timeframe`]}
          options={[...(cond.timeframe && timeframes.includes(cond.timeframe) ? [] : [{ value: '', label: 'Choose…' }]), ...timeframes.map((t) => ({ value: t, label: TF_LABEL[t] }))]}
          onChange={(e) => onChange({ ...cond, timeframe: (e.target.value || null) as Timeframe | null })}
        />
        {visibleParams(cond).map((key) => (
          <ParamField
            key={key}
            name={key}
            spec={CONDITIONS[cond.type][key]}
            value={cond.params[key]}
            path={`${path}.params.${key}`}
            error={errors[`${path}.params.${key}`]}
            readOnly={readOnly}
            onChange={(v) => set(key, v)}
          />
        ))}
      </div>
    </fieldset>
  )
}

/** Blocks a free-text rule seems to describe, with numbers it mentions (rulebook-builder.md §2.8). */
export function suggestBlocks(text: string): { type: ConditionType; params: Record<string, unknown>; label: string }[] {
  const t = text.toLowerCase()
  const firstNumber = (re: RegExp) => {
    const m = t.match(re)
    return m ? Number(m[1]) : undefined
  }
  const out: { type: ConditionType; params: Record<string, unknown>; label: string }[] = []
  const ma = /\bema\b/.test(t) ? 'ema' : /\bsma\b|moving average/.test(t) ? 'sma' : null
  if (ma) {
    const period = firstNumber(/(\d{1,3})\s*(?:-?period\s*)?(?:ema|sma)/) ?? firstNumber(/(?:ema|sma)\s*\(?(\d{1,3})/)
    out.push({ type: 'price_vs_ma', params: { ...BLOCK.price_vs_ma.defaults, ma, ...(period ? { period } : {}) }, label: 'Price above or below an average' })
  }
  if (/\brsi\b/.test(t)) {
    const value = firstNumber(/rsi[^\d]{0,12}(\d{1,2})/)
    out.push({ type: 'rsi', params: { ...BLOCK.rsi.defaults, ...(value ? { value } : {}) }, label: `RSI${value ? ` ${value}` : ''}` })
  }
  if (/\bmacd\b/.test(t)) out.push({ type: 'macd', params: { ...BLOCK.macd.defaults }, label: 'MACD' })
  if (/\batr\b|volatil/.test(t)) out.push({ type: 'atr', params: { ...BLOCK.atr.defaults }, label: 'ATR' })
  if (/engulf/.test(t)) out.push({ type: 'candle_pattern', params: { pattern: 'bullish_engulfing', ratio: 1.2 }, label: 'Engulfing candle' })
  if (/pin ?bar|hammer|rejection/.test(t)) out.push({ type: 'candle_pattern', params: { pattern: 'bullish_pin_bar', wick_ratio: 2, min_range_atr: 0.5 }, label: 'Pin bar' })
  if (/inside bar/.test(t)) out.push({ type: 'candle_pattern', params: { pattern: 'inside_bar' }, label: 'Inside bar' })
  if (/higher high|lower low|break of structure|swing/.test(t)) out.push({ type: 'structure', params: { ...BLOCK.structure.defaults }, label: 'Swing structure' })
  if (/yesterday|prior day|previous day|support|resistance|round number|level/.test(t)) out.push({ type: 'level', params: { ...BLOCK.level.defaults }, label: 'Price level' })
  if (/\d{1,2}:\d{2}|session|open\b|london|new york|tokyo/.test(t)) out.push({ type: 'time_window', params: { ...BLOCK.time_window.defaults }, label: 'Time window' })
  return out.filter((s, i) => out.findIndex((o) => o.label === s.label) === i).slice(0, 4)
}

function FreeTextCard({ cond, index, path, errors, readOnly, onChange, onRemove }: Props) {
  const text = String(cond.params.text ?? '')
  const override = cond.params.override ?? null
  const [keeping, setKeeping] = useState(!!override)
  const vague = findVague(text)
  const suggestions = suggestBlocks(text)
  const blocksFromWords = [...new Set(vague.flatMap((v) => v.blocks))]
  const convert = (type: ConditionType, params: Record<string, unknown>) =>
    onChange({ id: cond.id, type, timeframe: cond.timeframe, params })
  const textPath = `${path}.params.text`
  return (
    <fieldset className={`rounded-lg border bg-surface p-4 ${Object.keys(errors).some((k) => k.startsWith(path)) ? 'border-danger' : 'border-border'}`}>
      <legend className="sr-only">Condition {index + 1}, in your own words</legend>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 font-mono text-caption text-subtle">{index + 1}</span>
        <p className="min-w-0 flex-1 text-small font-semibold text-muted">In your own words</p>
        {!readOnly && (
          <Button variant="ghost" onClick={onRemove} aria-label={`Remove condition ${index + 1}`}>
            <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden sm:inline">Remove</span>
          </Button>
        )}
      </div>
      <div className="ml-6 mt-3 grid gap-3">
        <label htmlFor={`${cond.id}-text`} className="sr-only">
          Rule
        </label>
        <textarea
          id={`${cond.id}-text`}
          data-path={textPath}
          rows={3}
          maxLength={280}
          readOnly={readOnly}
          value={text}
          onChange={(e) => onChange({ ...cond, params: { ...cond.params, text: e.target.value } })}
          placeholder="Describe exactly what you'd see on the chart, with numbers."
          aria-describedby={`${cond.id}-count`}
          className="block w-full rounded-sm border border-control bg-raised px-3 py-2 text-body"
        />
        <p id={`${cond.id}-count`} className="-mt-2 text-right font-mono text-caption text-subtle">
          {text.trim().length}/280
        </p>
        {vague.map((v) => (
          <p key={v.word} className="rounded-md border border-dashed border-warning px-3 py-2 text-small">
            Your rule uses <span className="font-semibold underline decoration-warning decoration-dotted underline-offset-4">&lsquo;{v.word}&rsquo;</span>. {v.question}
          </p>
        ))}
        {!readOnly && (suggestions.length > 0 || blocksFromWords.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Button key={s.label} variant="secondary" onClick={() => convert(s.type, s.params)}>
                Use the {s.label} block
              </Button>
            ))}
            {blocksFromWords
              .filter((t) => !suggestions.some((s) => s.type === t))
              .slice(0, 2)
              .map((t) => (
                <Button key={t} variant="secondary" onClick={() => convert(t, { ...BLOCK[t].defaults })}>
                  Use the {BLOCK[t].name.toLowerCase()} block
                </Button>
              ))}
          </div>
        )}
        {!readOnly && !vague.length && text.trim().length >= 15 && !keeping && (
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <p className="text-small text-muted">Can this become a building block? If not, it can stay as written.</p>
            <Button variant="secondary" onClick={() => setKeeping(true)}>
              Keep as written
            </Button>
          </div>
        )}
        {(keeping || override) && (
          <div className="grid gap-2 border-t border-border pt-3">
            <label htmlFor={`${cond.id}-reason`} className="text-small font-semibold">
              Why keep this in your own words?
            </label>
            <textarea
              id={`${cond.id}-reason`}
              data-path={`${path}.params`}
              rows={2}
              maxLength={280}
              readOnly={readOnly}
              value={override?.reason ?? ''}
              onChange={(e) =>
                onChange({ ...cond, params: { ...cond.params, override: { reason: e.target.value, recorded_at: new Date().toISOString() } } })
              }
              className="block w-full rounded-sm border border-control bg-raised px-3 py-2 text-body"
            />
            <p className="text-caption text-subtle">
              Kept rules make this version discretionary. Discretionary results need more trades before a verdict.
            </p>
          </div>
        )}
        {errors[textPath] && <p className="text-caption text-danger">{errors[textPath]}</p>}
        <p className="sr-only">{OPTION[cond.type]}</p>
      </div>
    </fieldset>
  )
}
