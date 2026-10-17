import { useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { Button, CheckboxRow, Field, Segmented } from '../../components/ui'
import { INSTRUMENTS } from '../journal/api'
import { ConditionCard } from './ConditionCard'
import { ConditionPicker } from './ConditionPicker'
import { describeCosts } from './describe'
import { OPTION, SESSION_LABEL, TF_LABEL } from './labels'
import { ParamField } from './ParamField'
import type { Condition, ConditionType, CostRow, Rules, RiskPlan, Session, Timeframe, VersionDoc } from './types'
import {
  BLOCK,
  BREAKEVEN,
  COSTS,
  ENTRY_TRIGGERS,
  PARTIAL,
  RISK,
  SESSIONS,
  STOP_RULES,
  STREAK_ACTIONS,
  TARGETS,
  TF_RANK,
  TIME_EXITS,
  TIMEFRAMES,
  TRAILING,
  defaultCosts,
} from './vocabulary'

/**
 * The builder's editing steps (rulebook-builder.md §4.3). Each reads and
 * writes its own slice of the version document; every field carries a
 * data-path so the checklist's "Fix" link can focus it.
 */
export type StepProps = {
  doc: VersionDoc
  update: (fn: (doc: VersionDoc) => VersionDoc) => void
  errors: Record<string, string>
  readOnly: boolean
}

const setRules = (update: StepProps['update'], fn: (r: Rules) => Rules) => update((d) => ({ ...d, rules: fn(d.rules) }))

const ENTRY_DEFAULTS: Record<string, Record<string, unknown>> = {
  next_open: {},
  stop_beyond_setup: { buffer: { unit: 'pips', value: 1 }, expiry_bars: 2 },
  limit_at_ma: { ma: 'ema', period: 20, expiry_bars: 3 },
  limit_retrace: { percent: 50, expiry_bars: 3 },
}
const STOP_DEFAULTS: Record<string, Record<string, unknown>> = {
  swing: { strength: 3, buffer: { unit: 'pips', value: 2 } },
  setup_candle: { buffer: { unit: 'pips', value: 2 } },
  atr: { period: 14, multiple: 1.5 },
  fixed: { pips: 25 },
}
const TARGET_DEFAULTS: Record<string, Record<string, unknown>> = {
  r_multiple: { r: 2 }, prior_swing: { strength: 3 }, prior_day_level: {}, atr: { period: 14, multiple: 2 }, none: {},
}
const TRAILING_DEFAULTS: Record<string, Record<string, unknown>> = {
  atr: { period: 14, multiple: 2 }, swing: { strength: 3 }, ma: { ma: 'ema', period: 20 },
}
const TIME_EXIT_DEFAULTS: Record<string, Record<string, unknown>> = {
  bars: { bars: 24 }, time: { at: '16:00', zone: 'Europe/London' }, before_weekend: {},
}

export function Section({ title, description, children }: { title?: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-4">
      {title && <h2 className="text-h3">{title}</h2>}
      {description && <p className="-mt-2 text-small text-muted">{description}</p>}
      {children}
    </section>
  )
}

/** Large radio rows for 3–5 options with long labels. */
export function OptionList({ legend, value, options, onChange, path, readOnly, error }: {
  legend: string
  value: string | undefined
  options: string[]
  onChange: (v: string) => void
  path: string
  readOnly?: boolean
  error?: string
}) {
  return (
    <fieldset data-path={path} tabIndex={-1} className="outline-none">
      <legend className="mb-2 text-small font-semibold">{legend}</legend>
      <div className="grid gap-2">
        {options.map((o) => (
          <label
            key={o}
            className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-4 py-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${value === o ? 'border-text bg-raised' : 'border-border bg-surface hover:border-control'}`}
          >
            <input type="radio" className="sr-only" checked={value === o} disabled={readOnly} onChange={() => onChange(o)} />
            <span className={`size-4 shrink-0 rounded-full border ${value === o ? 'border-[5px] border-text' : 'border-control'}`} aria-hidden="true" />
            <span className="text-body">{OPTION[o] ?? o}</span>
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-caption text-danger">{error}</p>}
    </fieldset>
  )
}

function Chips<T extends string>({ legend, values, selected, label, onToggle, path, readOnly, error, helper }: {
  legend: string
  values: T[]
  selected: T[]
  label: (v: T) => string
  onToggle: (v: T) => void
  path: string
  readOnly?: boolean
  error?: string
  helper?: string
}) {
  return (
    <fieldset data-path={path} tabIndex={-1} className="outline-none">
      <legend className="mb-1 text-small font-semibold">{legend}</legend>
      {helper && <p className="mb-2 text-caption text-subtle">{helper}</p>}
      <div className="flex flex-wrap gap-2">
        {values.map((v) => {
          const on = selected.includes(v)
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              disabled={readOnly}
              onClick={() => onToggle(v)}
              className={`min-h-11 rounded-full border px-4 text-small font-semibold ${on ? 'border-text bg-text text-bg' : 'border-control text-muted hover:text-text'}`}
            >
              {label(v)}
            </button>
          )
        })}
      </div>
      {error && <p className="mt-1 text-caption text-danger">{error}</p>}
    </fieldset>
  )
}

/* ---------------- Name and idea ---------------- */

export function NameStep({ doc, update, readOnly, name, onRename, errors }: StepProps & { name: string; onRename: (v: string) => void }) {
  return (
    <div className="grid gap-6">
      <Field label="Strategy name" value={name} maxLength={60} readOnly={readOnly} data-path="name" error={errors.name} onChange={(e) => onRename(e.target.value)} />
      <div>
        <label htmlFor="idea" className="mb-1 block text-small font-semibold">
          Your idea in one sentence
        </label>
        <textarea
          id="idea"
          rows={2}
          maxLength={280}
          readOnly={readOnly}
          value={doc.rules.idea}
          onChange={(e) => setRules(update, (r) => ({ ...r, idea: e.target.value }))}
          className="block w-full rounded-sm border border-control bg-raised px-3 py-2 text-body"
        />
        <p className="mt-1 text-caption text-subtle">For example: buy pullbacks in an uptrend on the 4-hour chart. This isn’t checked; it’s a note to yourself.</p>
      </div>
      <Segmented
        label="Direction"
        value={doc.rules.direction}
        options={(['long', 'short', 'both'] as const).map((v) => ({ value: v, label: OPTION[v] }))}
        onChange={(v) => !readOnly && setRules(update, (r) => ({ ...r, direction: v }))}
      />
      <p className="-mt-4 text-caption text-subtle">With “Both”, rules are written for buys and sells use the mirror image: above becomes below, highs become lows.</p>
    </div>
  )
}

/* ---------------- Market ---------------- */

export function MarketStep({ doc, update, errors, readOnly }: StepProps) {
  const m = doc.rules.market
  const [custom, setCustom] = useState('')
  const togglePair = (pair: string) =>
    update((d) => {
      const has = d.rules.market.instruments.includes(pair)
      const instruments = has ? d.rules.market.instruments.filter((p) => p !== pair) : [...d.rules.market.instruments, pair]
      const cost_model = { ...d.cost_model }
      if (has) delete cost_model[pair]
      else cost_model[pair] ??= defaultCosts(pair)
      return { ...d, cost_model, rules: { ...d.rules, market: { ...d.rules.market, instruments } } }
    })
  const pairs = [...new Set([...INSTRUMENTS, ...m.instruments])]
  return (
    <div className="grid gap-8">
      <Chips
        legend="Pairs"
        helper="Up to six. Each pair gets its own costs in the Costs step."
        values={pairs}
        selected={m.instruments}
        label={(p) => p}
        onToggle={togglePair}
        path="market.instruments"
        readOnly={readOnly}
        error={errors['market.instruments']}
      />
      {!readOnly && (
        <form
          className="-mt-4 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const v = custom.trim().toUpperCase().replace(/^([A-Z]{3})([A-Z]{3})$/, '$1/$2')
            if (/^[A-Z]{3}\/[A-Z]{3}$/.test(v) && !m.instruments.includes(v)) togglePair(v)
            setCustom('')
          }}
        >
          <Field label="Another pair" placeholder="e.g. USD/ZAR" value={custom} onChange={(e) => setCustom(e.target.value)} />
          <Button type="submit" variant="secondary">
            Add pair
          </Button>
        </form>
      )}
      <Chips
        legend="Charts you use"
        helper="Up to three. Conditions and the entry each use one of these."
        values={TIMEFRAMES}
        selected={m.timeframes}
        label={(t) => TF_LABEL[t]}
        onToggle={(t: Timeframe) =>
          setRules(update, (r) => {
            const has = r.market.timeframes.includes(t)
            const timeframes = has ? r.market.timeframes.filter((x) => x !== t) : [...r.market.timeframes, t].sort((a, b) => TF_RANK[b] - TF_RANK[a])
            return { ...r, market: { ...r.market, timeframes } }
          })
        }
        path="market.timeframes"
        readOnly={readOnly}
        error={errors['market.timeframes']}
      />
      <Chips
        legend="Sessions you trade"
        helper="Asia 00:00–09:00, London 07:00–16:00, New York 12:00–21:00 UTC."
        values={SESSIONS}
        selected={m.sessions}
        label={(s: Session) => SESSION_LABEL[s]}
        onToggle={(s: Session) =>
          setRules(update, (r) => ({
            ...r,
            market: { ...r.market, sessions: r.market.sessions.includes(s) ? r.market.sessions.filter((x) => x !== s) : SESSIONS.filter((x) => x === s || r.market.sessions.includes(x)) },
          }))
        }
        path="market.sessions"
        readOnly={readOnly}
        error={errors['market.sessions']}
      />
    </div>
  )
}

/* ---------------- Setup ---------------- */

export function nextConditionId(conds: Condition[]) {
  const n = Math.max(0, ...conds.map((c) => Number(c.id.replace(/\D/g, '')) || 0))
  return `c${n + 1}`
}

function ConditionList({ list, base, doc, errors, readOnly, setList, allowed }: StepProps & {
  list: Condition[]
  base: string
  setList: (fn: (list: Condition[]) => Condition[]) => void
  allowed?: ConditionType[]
}) {
  const [picker, setPicker] = useState(false)
  const tfs = doc.rules.market.timeframes
  const add = (type: ConditionType) =>
    setList((l) => [...l, { id: nextConditionId([...doc.rules.setup.conditions, ...doc.rules.no_trade.other]), type, timeframe: tfs.at(-1) ?? null, params: structuredClone(BLOCK[type].defaults) }])
  return (
    <div className="grid gap-3">
      {list.map((c, i) => (
        <ConditionCard
          key={c.id}
          cond={c}
          index={i}
          path={`${base}[${i}]`}
          timeframes={tfs}
          direction={doc.rules.direction}
          errors={errors}
          readOnly={readOnly}
          onChange={(next) => setList((l) => l.map((x) => (x.id === c.id ? next : x)))}
          onRemove={() => setList((l) => l.filter((x) => x.id !== c.id))}
        />
      ))}
      {!readOnly &&
        (allowed ? (
          <div className="flex flex-wrap gap-2">
            {allowed.map((t) => (
              <Button key={t} variant="secondary" onClick={() => add(t)}>
                <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
                {t === 'time_window' ? 'Add a time window' : 'Add a rule in my own words'}
              </Button>
            ))}
          </div>
        ) : (
          <>
            <Button variant="secondary" className="w-fit" onClick={() => setPicker(true)} data-path={base}>
              <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Add condition
            </Button>
            <ConditionPicker open={picker} onOpenChange={setPicker} onPick={add} timeframe={tfs.at(-1) ?? null} />
          </>
        ))}
    </div>
  )
}

export function SetupStep(props: StepProps) {
  const conds = props.doc.rules.setup.conditions
  return (
    <div className="grid gap-4">
      {!conds.length && (
        <p className="rounded-md border border-dashed border-control px-4 py-8 text-body text-muted">
          No conditions yet. Add the first thing that must be true before a trade.
        </p>
      )}
      {!props.doc.rules.market.timeframes.length && (
        <p className="text-small text-muted">Choose your charts in the Market step first; each condition uses one of them.</p>
      )}
      <ConditionList
        {...props}
        list={conds}
        base="setup.conditions"
        setList={(fn) => setRules(props.update, (r) => ({ ...r, setup: { conditions: fn(r.setup.conditions) } }))}
      />
      {props.errors['setup.conditions'] && <p className="text-small text-danger">{props.errors['setup.conditions']}</p>}
    </div>
  )
}

/* ---------------- Entry, stop, exit ---------------- */

function Params({ specs, values, base, onChange, errors, readOnly }: {
  specs: Record<string, import('./vocabulary').Spec>
  values: Record<string, unknown>
  base: string
  onChange: (key: string, v: unknown) => void
  errors: Record<string, string>
  readOnly: boolean
}) {
  const keys = Object.keys(specs)
  if (!keys.length) return null
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {keys.map((k) => (
        <ParamField key={k} name={k} spec={specs[k]} value={values[k]} path={`${base}.${k}`} error={errors[`${base}.${k}`]} readOnly={readOnly} onChange={(v) => onChange(k, v)} />
      ))}
    </div>
  )
}

export function EntryStep({ doc, update, errors, readOnly }: StepProps) {
  const entry = doc.rules.entry
  const tfs = doc.rules.market.timeframes
  const trigger = (entry?.trigger ?? {}) as Record<string, unknown> & { type?: string }
  return (
    <div className="grid gap-6">
      <OptionList
        legend="Order"
        value={trigger.type}
        options={Object.keys(ENTRY_TRIGGERS)}
        path="entry"
        readOnly={readOnly}
        error={errors.entry}
        onChange={(type) =>
          setRules(update, (r) => ({ ...r, entry: { timeframe: r.entry?.timeframe ?? r.market.timeframes.at(-1) ?? null, trigger: { type, ...ENTRY_DEFAULTS[type] } as never } }))
        }
      />
      {entry && (
        <>
          <OptionList
            legend="Entry chart"
            value={entry.timeframe ?? undefined}
            options={tfs}
            path="entry.timeframe"
            readOnly={readOnly}
            error={errors['entry.timeframe']}
            onChange={(tf) => setRules(update, (r) => ({ ...r, entry: { ...r.entry!, timeframe: tf as Timeframe } }))}
          />
          <Params
            specs={ENTRY_TRIGGERS[String(trigger.type)] ?? {}}
            values={trigger}
            base="entry.trigger"
            errors={errors}
            readOnly={readOnly}
            onChange={(k, v) => setRules(update, (r) => ({ ...r, entry: { ...r.entry!, trigger: { ...r.entry!.trigger, [k]: v } } }))}
          />
        </>
      )}
    </div>
  )
}

export function StopStep({ doc, update, errors, readOnly }: StepProps) {
  const stop = doc.rules.stop
  const rule = (stop?.rule ?? {}) as Record<string, unknown> & { type?: string }
  return (
    <div className="grid gap-6">
      <OptionList
        legend="Initial stop"
        value={rule.type}
        options={Object.keys(STOP_RULES)}
        path="stop"
        readOnly={readOnly}
        error={errors.stop}
        onChange={(type) => setRules(update, (r) => ({ ...r, stop: { ...(r.stop ?? {}), rule: { type, ...STOP_DEFAULTS[type] } as never } }))}
      />
      {stop && (
        <>
          <Params
            specs={STOP_RULES[String(rule.type)] ?? {}}
            values={rule}
            base="stop.rule"
            errors={errors}
            readOnly={readOnly}
            onChange={(k, v) => setRules(update, (r) => ({ ...r, stop: { ...r.stop!, rule: { ...r.stop!.rule, [k]: v } } }))}
          />
          <CheckboxRow
            label="Skip the trade if the stop would be too wide"
            checked={!!stop.skip_if_wider_than}
            onChange={(on) => !readOnly && setRules(update, (r) => ({ ...r, stop: { ...r.stop!, skip_if_wider_than: on ? { unit: 'pips', value: 40 } : null } }))}
          />
          {stop.skip_if_wider_than && (
            <ParamField
              name="skip"
              label="Skip if wider than"
              spec={{ kind: 'distance' }}
              value={stop.skip_if_wider_than}
              path="stop.skip_if_wider_than"
              error={errors['stop.skip_if_wider_than']}
              readOnly={readOnly}
              onChange={(v) => setRules(update, (r) => ({ ...r, stop: { ...r.stop!, skip_if_wider_than: v as never } }))}
            />
          )}
        </>
      )}
    </div>
  )
}

export function ExitStep({ doc, update, errors, readOnly }: StepProps) {
  const exit = doc.rules.exit
  const target = (exit?.target ?? {}) as Record<string, unknown> & { type?: string }
  const setExit = (fn: (x: NonNullable<Rules['exit']>) => NonNullable<Rules['exit']>) => setRules(update, (r) => ({ ...r, exit: fn(r.exit!) }))
  return (
    <div className="grid gap-6">
      <OptionList
        legend="Target"
        value={target.type}
        options={Object.keys(TARGETS)}
        path="exit"
        readOnly={readOnly}
        error={errors.exit}
        onChange={(type) => setRules(update, (r) => ({ ...r, exit: { ...(r.exit ?? {}), target: { type, ...TARGET_DEFAULTS[type] } as never } }))}
      />
      {exit && (
        <>
          <Params specs={TARGETS[String(target.type)] ?? {}} values={target} base="exit.target" errors={errors} readOnly={readOnly} onChange={(k, v) => setExit((x) => ({ ...x, target: { ...x.target, [k]: v } }))} />
          <Section title="Trade management" description="Optional. Each one changes results, so it's part of what gets tested.">
            <CheckboxRow label="Move the stop to breakeven" checked={!!exit.breakeven} onChange={(on) => !readOnly && setExit((x) => ({ ...x, breakeven: on ? { at_r: 1 } : null }))} />
            {exit.breakeven && <Params specs={BREAKEVEN} values={exit.breakeven} base="exit.breakeven" errors={errors} readOnly={readOnly} onChange={(k, v) => setExit((x) => ({ ...x, breakeven: { ...x.breakeven!, [k]: v } }))} />}
            <CheckboxRow label="Close part of the trade early" checked={!!exit.partial} onChange={(on) => !readOnly && setExit((x) => ({ ...x, partial: on ? { at_r: 1, percent: 50 } : null }))} />
            {exit.partial && <Params specs={PARTIAL} values={exit.partial} base="exit.partial" errors={errors} readOnly={readOnly} onChange={(k, v) => setExit((x) => ({ ...x, partial: { ...x.partial!, [k]: v } }))} />}
            <CheckboxRow label="Trail the stop" checked={!!exit.trailing} onChange={(on) => !readOnly && setExit((x) => ({ ...x, trailing: on ? ({ type: 'atr', ...TRAILING_DEFAULTS.atr } as never) : null }))} />
            {exit.trailing && (
              <>
                <OptionList legend="Trail behind" value={exit.trailing.type} options={Object.keys(TRAILING)} path="exit.trailing" readOnly={readOnly} onChange={(type) => setExit((x) => ({ ...x, trailing: { type, ...TRAILING_DEFAULTS[type] } as never }))} />
                <Params specs={TRAILING[exit.trailing.type] ?? {}} values={exit.trailing} base="exit.trailing" errors={errors} readOnly={readOnly} onChange={(k, v) => setExit((x) => ({ ...x, trailing: { ...x.trailing!, [k]: v } }))} />
              </>
            )}
            <CheckboxRow label="Close by time" checked={!!exit.time_exit} onChange={(on) => !readOnly && setExit((x) => ({ ...x, time_exit: on ? ({ type: 'bars', ...TIME_EXIT_DEFAULTS.bars } as never) : null }))} />
            {exit.time_exit && (
              <>
                <OptionList legend="Close the trade" value={exit.time_exit.type} options={Object.keys(TIME_EXITS)} path="exit.time_exit" readOnly={readOnly} onChange={(type) => setExit((x) => ({ ...x, time_exit: { type, ...TIME_EXIT_DEFAULTS[type] } as never }))} />
                <Params specs={TIME_EXITS[exit.time_exit.type] ?? {}} values={exit.time_exit} base="exit.time_exit" errors={errors} readOnly={readOnly} onChange={(k, v) => setExit((x) => ({ ...x, time_exit: { ...x.time_exit!, [k]: v } }))} />
              </>
            )}
          </Section>
        </>
      )}
    </div>
  )
}

/* ---------------- Risk ---------------- */

const RISK_LABEL: Record<keyof Omit<RiskPlan, 'losing_streak'>, [string, string]> = {
  risk_pct: ['Risk per trade (%)', '0.25–1% while learning. Level 2 shows why.'],
  daily_loss_r: ['Daily loss limit (R)', 'Stop for the day at this loss.'],
  weekly_loss_r: ['Weekly loss limit (R)', 'At least the daily limit.'],
  max_drawdown_r: ['Stop and review at a drawdown of (R)', 'Compared with the drawdown tests expect.'],
  max_open_trades: ['Most open trades at once', 'Several open trades are often one currency bet.'],
  max_trades_per_day: ['Most trades a day', 'Over-trading lets costs swamp a small edge.'],
  max_currency_risk_pct: ['Most risk on one currency (%)', 'EUR/USD and GBP/USD buys are both dollar sells.'],
}

export function RiskStep({ doc, update, errors, readOnly }: StepProps) {
  const r = doc.risk_plan
  const set = (k: string, v: unknown) => update((d) => ({ ...d, risk_plan: { ...d.risk_plan, [k]: v } }))
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {(Object.keys(RISK) as (keyof typeof RISK)[]).map((k) => (
          <ParamField key={k} name={k} spec={RISK[k]} label={RISK_LABEL[k][0]} helper={RISK_LABEL[k][1]} value={r[k]} path={`risk_plan.${k}`} error={errors[`risk_plan.${k}`]} readOnly={readOnly} onChange={(v) => set(k, v)} />
        ))}
      </div>
      <Section title="Losing streak" description="What happens after several losses in a row.">
        <div className="grid gap-4 sm:grid-cols-2">
          <ParamField name="losses" label="After … losses in a row" spec={{ kind: 'int', min: 2, max: 10 }} value={r.losing_streak?.losses} path="risk_plan.losing_streak" error={errors['risk_plan.losing_streak']} readOnly={readOnly} onChange={(v) => set('losing_streak', { ...r.losing_streak, losses: v })} />
          <ParamField name="action" label="Then" spec={{ kind: 'enum', values: STREAK_ACTIONS }} value={r.losing_streak?.action} path="risk_plan.losing_streak.action" readOnly={readOnly} onChange={(v) => set('losing_streak', { ...r.losing_streak, action: v })} />
        </div>
      </Section>
    </div>
  )
}

/* ---------------- Costs ---------------- */

const COST_LABEL: Record<keyof Omit<CostRow, 'placeholder'>, string> = {
  spread_pips: 'Spread (pips)', commission_per_lot: 'Commission ($ per lot, round trip)', slippage_pips: 'Slippage (pips)',
  news_slippage_pips: 'Slippage in news windows (pips)', swap_long: 'Swap per night, buys ($ per lot)', swap_short: 'Swap per night, sells ($ per lot)',
}

export function CostsStep({ doc, update, errors, readOnly }: StepProps) {
  const pairs = doc.rules.market.instruments
  if (!pairs.length) return <p className="text-body text-muted">Choose pairs in the Market step; each gets a row of costs here.</p>
  const setRow = (pair: string, patch: Partial<CostRow>) =>
    update((d) => ({ ...d, cost_model: { ...d.cost_model, [pair]: { ...(d.cost_model[pair] ?? defaultCosts(pair)), ...patch } } }))
  return (
    <div className="grid gap-6">
      {pairs.map((pair) => {
        const row = doc.cost_model[pair]
        return (
          <fieldset key={pair} data-path={`cost_model.${pair}`} tabIndex={-1} className="grid gap-4 rounded-lg border border-border bg-surface p-4 outline-none">
            <legend className="sr-only">{pair}</legend>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-mono text-body font-semibold">{pair}</p>
              {row?.placeholder && <p className="text-caption text-warning">Placeholder. Replace with your broker’s figures.</p>}
            </div>
            {!row ? (
              <Button variant="secondary" className="w-fit" onClick={() => setRow(pair, {})}>
                Add costs for {pair}
              </Button>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(Object.keys(COSTS) as (keyof typeof COSTS)[]).map((k) => (
                    <ParamField key={k} name={k} spec={COSTS[k]} label={COST_LABEL[k]} helper="" value={row[k]} path={`cost_model.${pair}.${k}`} readOnly={readOnly} onChange={(v) => setRow(pair, { [k]: v as number, placeholder: false })} />
                  ))}
                </div>
                {row.placeholder && !readOnly && (
                  <CheckboxRow label="These are my broker's figures" checked={false} onChange={() => setRow(pair, { placeholder: false })} />
                )}
              </>
            )}
            {errors[`cost_model.${pair}`] && <p className="text-caption text-danger">{errors[`cost_model.${pair}`]}</p>}
            <p className="text-caption text-subtle">{describeCosts(pair, row)}</p>
          </fieldset>
        )
      })}
    </div>
  )
}

/* ---------------- No-trade rules ---------------- */

export function NoTradeStep(props: StepProps) {
  const { doc, update, errors, readOnly } = props
  const nt = doc.rules.no_trade
  const setNt = (patch: Partial<Rules['no_trade']>) => setRules(update, (r) => ({ ...r, no_trade: { ...r.no_trade, ...patch } }))
  return (
    <div className="grid gap-6">
      <CheckboxRow label="No new trades around high-impact news" description="For either currency in the pair." checked={nt.news.enabled} onChange={(on) => !readOnly && setNt({ news: { ...nt.news, enabled: on, before_min: nt.news.before_min ?? 30, after_min: nt.news.after_min ?? 30 } })} />
      {nt.news.enabled && (
        <div className="grid gap-4 sm:grid-cols-2">
          <ParamField name="before" label="Minutes before" spec={{ kind: 'int', min: 0, max: 240 }} value={nt.news.before_min} path="no_trade.news.before_min" error={errors['no_trade.news.before_min']} readOnly={readOnly} onChange={(v) => setNt({ news: { ...nt.news, before_min: v as number } })} />
          <ParamField name="after" label="Minutes after" spec={{ kind: 'int', min: 0, max: 240 }} value={nt.news.after_min} path="no_trade.news.after_min" error={errors['no_trade.news.after_min']} readOnly={readOnly} onChange={(v) => setNt({ news: { ...nt.news, after_min: v as number } })} />
        </div>
      )}
      <CheckboxRow label="No new trades around the daily rollover" description="16:45–17:15 New York time, when spreads widen." checked={nt.avoid_rollover} onChange={(on) => !readOnly && setNt({ avoid_rollover: on })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <ParamField name="spread" label="Skip while the spread is above (pips)" spec={{ kind: 'num', min: 0.1, max: 50 }} helper="Optional" value={nt.max_spread_pips} path="no_trade.max_spread_pips" error={errors['no_trade.max_spread_pips']} readOnly={readOnly} onChange={(v) => setNt({ max_spread_pips: v as number | null })} />
        <ParamField name="friday" label="No new trades on Friday after (New York)" spec={{ kind: 'time' }} helper="Optional" value={nt.no_new_after_friday} path="no_trade.no_new_after_friday" error={errors['no_trade.no_new_after_friday']} readOnly={readOnly} onChange={(v) => setNt({ no_new_after_friday: v as string | null })} />
      </div>
      <Section title="Other no-trade rules">
        <ConditionList
          {...props}
          list={nt.other}
          base="no_trade.other"
          allowed={['time_window', 'free_text']}
          setList={(fn) => setRules(update, (r) => ({ ...r, no_trade: { ...r.no_trade, other: fn(r.no_trade.other) } }))}
        />
      </Section>
    </div>
  )
}
