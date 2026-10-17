import { findVague } from './banned'
import type { CheckItem, ClarityReport, Condition, ExampleRef, StepKey, VersionDoc, Zone } from './types'
import {
  BREAKEVEN,
  CONDITIONS,
  COSTS,
  DISTANCE_LIMITS,
  ENTRY_TRIGGERS,
  NO_TRADE_OTHER_TYPES,
  OPTIONAL_PARAMS,
  PARTIAL,
  RISK,
  SESSION_HOURS,
  STOP_RULES,
  STREAK_ACTIONS,
  TARGETS,
  TF_RANK,
  TIME_EXITS,
  TRAILING,
  WEEKDAYS,
  ZONE_OFFSETS,
  type Spec,
} from './vocabulary'

/**
 * Clarity engine (SL-3), the browser copy for instant feedback. The server's
 * apps/strategy/clarity.py decides Gate 3; both are tested against the same
 * fixtures (docs/strategy-lab/fixtures), so codes always agree. Pure: no
 * clock, network or randomness.
 */
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const PAIR = /^[A-Z]{3}\/[A-Z]{3}$/
const LABEL: Record<string, string> = {
  period: 'period', fast: 'fast average', slow: 'slow average', within_bars: 'number of candles', strength: 'swing strength',
  tolerance: 'tolerance', value: 'value', ratio: 'body ratio', wick_ratio: 'wick ratio', min_range_atr: 'minimum range',
  signal: 'signal period', from: 'start time', to: 'end time', days: 'days', buffer: 'buffer', expiry_bars: 'expiry',
  percent: 'percentage', multiple: 'ATR multiple', pips: 'stop distance', r: 'target', at_r: 'trigger level',
  bars: 'number of candles', at: 'time',
}
const label = (k: string) => LABEL[k] ?? k.replace(/_/g, ' ')
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const fmt = (v: unknown) => (isNum(v) ? String(Number(v.toPrecision(6))) : String(v))
type Rec = Record<string, unknown>
const rec = (v: unknown): Rec => (v && typeof v === 'object' ? (v as Rec) : {})

class Report {
  items: CheckItem[] = []
  fail(code: string, path: string, message: string, fix: StepKey) {
    this.items.push({ code, severity: 'fail', path, message, fix })
  }
  warn(code: string, path: string, message: string, fix: StepKey) {
    this.items.push({ code, severity: 'warn', path, message, fix })
  }
}

type Problem = ['missing' | 'range', [number, number] | null] | null

function checkParam(spec: Spec, value: unknown, required = true): Problem {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) {
    return required ? ['missing', null] : null
  }
  switch (spec.kind) {
    case 'enum':
      return spec.values.includes(value as string) ? null : ['range', null]
    case 'int':
    case 'num':
      if (!isNum(value) || (spec.kind === 'int' && !Number.isInteger(value))) return ['range', null]
      return spec.min <= value && value <= spec.max ? null : ['range', [spec.min, spec.max]]
    case 'distance': {
      const d = rec(value)
      const unit = d.unit as keyof typeof DISTANCE_LIMITS
      if (!(unit in DISTANCE_LIMITS) || !isNum(d.value)) return ['missing', null]
      const [lo, hi] = DISTANCE_LIMITS[unit]
      return lo <= d.value && d.value <= hi ? null : ['range', [lo, hi]]
    }
    case 'time':
      return typeof value === 'string' && TIME.test(value) ? null : ['range', null]
    case 'days':
      return Array.isArray(value) && value.length && value.every((d) => (WEEKDAYS as string[]).includes(d)) ? null : ['missing', null]
    case 'text':
      return typeof value === 'string' ? null : ['missing', null]
  }
}

function checkParams(
  report: Report, specs: Record<string, Spec>, params: unknown, path: string, fix: StepKey,
  missingCode: string, rangeCode: string, optional: Set<string> = new Set(),
) {
  const p = rec(params)
  for (const [key, spec] of Object.entries(specs)) {
    const problem = checkParam(spec, p[key], !optional.has(key))
    if (!problem) continue
    const [what, limits] = problem
    const at = `${path}.${key}`
    const shown = p[key] && typeof p[key] === 'object' ? rec(p[key]).value : p[key]
    if (what === 'missing') report.fail(missingCode, at, `This rule is missing its ${label(key)}.`, fix)
    else if (limits) report.fail(rangeCode, at, `The ${label(key)} is ${fmt(shown)}; the allowed range is ${fmt(limits[0])}–${fmt(limits[1])}.`, fix)
    else report.fail(rangeCode, at, `The ${label(key)} isn't one of the allowed options.`, fix)
  }
}

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

function condition(report: Report, cond: Condition, path: string, marketTfs: string[], fix: StepKey) {
  const type = cond.type
  if (!(type in CONDITIONS)) {
    report.fail('COND_PARAM_MISSING', `${path}.type`, 'This condition has no type.', fix)
    return
  }
  if (type !== 'free_text' && !marketTfs.includes(cond.timeframe as string)) {
    report.fail('COND_TIMEFRAME_UNKNOWN', `${path}.timeframe`, `This condition uses ${cond.timeframe || 'no timeframe'}, which isn't one of your timeframes.`, fix)
  }
  const params = rec(cond.params)
  if (type === 'free_text') {
    freeText(report, params, path, fix)
    return
  }
  checkParams(report, CONDITIONS[type], params, `${path}.params`, fix, 'COND_PARAM_MISSING', 'COND_PARAM_RANGE', OPTIONAL_PARAMS[type])
  const p = `${path}.params`
  if ((type === 'ma_cross' || type === 'ma_order') && isNum(params.fast) && isNum(params.slow) && params.slow <= params.fast) {
    report.fail('COND_PARAM_RANGE', `${p}.slow`, 'The slow average needs a longer period than the fast one.', fix)
  }
  if (type === 'macd' && isNum(params.fast) && isNum(params.slow) && params.slow <= params.fast) {
    report.fail('COND_PARAM_RANGE', `${p}.slow`, "MACD's slow period needs to be longer than its fast period.", fix)
  }
  if (type === 'level') {
    if (params.event === 'within' && checkParam({ kind: 'distance' }, params.tolerance)) {
      report.fail('COND_PARAM_MISSING', `${p}.tolerance`, "A 'within' level needs a tolerance in pips or ATR.", fix)
    }
    if ((params.level === 'swing_high' || params.level === 'swing_low') && checkParam({ kind: 'int', min: 2, max: 10 }, params.strength)) {
      report.fail('COND_PARAM_MISSING', `${p}.strength`, 'A swing level needs its swing strength (2–10 candles each side).', fix)
    }
  }
  if (type === 'candle_pattern') {
    const pattern = String(params.pattern ?? '')
    if (pattern.includes('engulfing') && checkParam(CONDITIONS.candle_pattern.ratio, params.ratio)) {
      report.fail('COND_PARAM_MISSING', `${p}.ratio`, 'An engulfing pattern needs its body ratio (1.0–2.0).', fix)
    }
    if (pattern.includes('pin_bar')) {
      for (const key of ['wick_ratio', 'min_range_atr']) {
        if (checkParam(CONDITIONS.candle_pattern[key], params[key])) report.fail('COND_PARAM_MISSING', `${p}.${key}`, `A pin bar needs its ${label(key)}.`, fix)
      }
    }
  }
  if (type === 'distance' && params.to === 'ma') {
    for (const key of ['ma', 'period']) {
      if (checkParam(CONDITIONS.distance[key], params[key])) report.fail('COND_PARAM_MISSING', `${p}.${key}`, `Distance to an average needs its ${label(key)}.`, fix)
    }
  }
  if (type === 'time_window' && params.from && params.from === params.to) {
    report.fail('COND_PARAM_RANGE', `${p}.to`, 'The window starts and ends at the same time.', fix)
  }
}

function freeText(report: Report, params: Rec, path: string, fix: StepKey) {
  const text = String(params.text ?? '').trim()
  const p = `${path}.params.text`
  if (text.length < 15 || text.length > 280) {
    report.fail('FREE_TEXT_TOO_SHORT', p, `This rule is ${text.length < 15 ? 'too short' : 'too long'} to follow: ${text.length} characters (15–280).`, fix)
  }
  for (const hit of findVague(text)) report.fail('FREE_TEXT_VAGUE', p, `Your rule uses '${hit.word}'. ${hit.question}`, fix)
  if (String(rec(params.override).reason ?? '').trim().length < 10) {
    report.fail(
      'FREE_TEXT_UNRESOLVED', `${path}.params`,
      'This rule is written in your own words and has no override recorded. It can become a building block, or be kept as written with a reason.',
      fix,
    )
  }
}

const condKey = (c: Condition) =>
  JSON.stringify([c.type, c.timeframe, Object.entries(rec(c.params)).sort(([a], [b]) => a.localeCompare(b))])

const MACD_UP = new Set(['line_above_signal', 'crosses_above_signal', 'histogram_above_zero'])
const MACD_DOWN = new Set(['line_below_signal', 'crosses_below_signal', 'histogram_below_zero'])
const BULLISH = new Set(['bullish_engulfing', 'bullish_pin_bar'])
const BEARISH = new Set(['bearish_engulfing', 'bearish_pin_bar'])

function bounds(c: Condition): [number | null, number | null] {
  const p = rec(c.params)
  if (!isNum(p.value)) return [null, null]
  if (p.relation === 'above' || p.relation === 'crosses_above') return [p.value, null]
  if (p.relation === 'below' || p.relation === 'crosses_below') return [null, p.value]
  return [null, null]
}

export function conflicts(a: Condition, b: Condition): boolean {
  if (a.type !== b.type) return false
  const pa = rec(a.params)
  const pb = rec(b.params)
  const same = (...keys: string[]) => keys.every((k) => pa[k] === pb[k])
  const t = a.type
  if (t === 'price_vs_ma') return same('ma', 'period') && pa.relation !== pb.relation
  if (t === 'ma_order') {
    if (pa.ma !== pb.ma) return false
    const norm = (p: Rec) => {
      const f = Number(p.fast ?? 0)
      const s = Number(p.slow ?? 0)
      return f <= s ? [p.fast, p.slow, p.relation] : [p.slow, p.fast, p.relation === 'above' ? 'below' : 'above']
    }
    const [na, nb] = [norm(pa), norm(pb)]
    return na[0] === nb[0] && na[1] === nb[1] && na[2] !== nb[2]
  }
  if ((t === 'rsi' || t === 'atr') && !same('period')) return false
  if (t === 'candle_size' && !same('measure', 'unit')) return false
  if (t === 'rsi' || t === 'atr' || t === 'candle_size') {
    const lo = [bounds(a)[0], bounds(b)[0]].filter((x): x is number => x !== null)
    const hi = [bounds(a)[1], bounds(b)[1]].filter((x): x is number => x !== null)
    return lo.length > 0 && hi.length > 0 && Math.max(...lo) >= Math.min(...hi)
  }
  if (t === 'structure') {
    const pair = [pa.pattern, pb.pattern].sort().join()
    return pair === 'higher_highs_lows,lower_highs_lows' || pair === 'break_down,break_up'
  }
  if (t === 'candle_pattern') {
    const [x, y] = [String(pa.pattern), String(pb.pattern)]
    return (BULLISH.has(x) && BEARISH.has(y)) || (BEARISH.has(x) && BULLISH.has(y))
  }
  if (t === 'macd') {
    if (!same('fast', 'slow', 'signal')) return false
    const [x, y] = [String(pa.event), String(pb.event)]
    return (MACD_UP.has(x) && MACD_DOWN.has(y)) || (MACD_DOWN.has(x) && MACD_UP.has(y))
  }
  if (t === 'level') return same('level') && [pa.event, pb.event].sort().join() === 'closes_above,closes_below'
  if (t === 'distance') {
    if (!same('to', 'ma', 'period', 'unit')) return false
    const within = [pa, pb].filter((p) => p.relation === 'within' && isNum(p.value)).map((p) => p.value as number)
    const beyond = [pa, pb].filter((p) => p.relation === 'beyond' && isNum(p.value)).map((p) => p.value as number)
    return within.length > 0 && beyond.length > 0 && Math.max(...beyond) >= Math.min(...within)
  }
  return false
}

export function windowOverlapsSessions(params: Rec, sessions: string[]): boolean {
  if (typeof params.from !== 'string' || typeof params.to !== 'string' || !TIME.test(params.from) || !TIME.test(params.to)) return true
  const [start, end] = [minutes(params.from), minutes(params.to)]
  const offsets = new Set(ZONE_OFFSETS[params.zone as Zone] ?? [0, 0])
  for (const off of offsets) {
    const s = (((start - off * 60) % 1440) + 1440) % 1440
    const e = (((end - off * 60) % 1440) + 1440) % 1440
    const windows: [number, number][] = s < e ? [[s, e]] : [[s, 1440], [0, e]]
    for (const name of sessions) {
      const [hs, he] = SESSION_HOURS[name as keyof typeof SESSION_HOURS] ?? [0, 0]
      if (windows.some(([ws, we]) => ws < he * 60 && hs * 60 < we)) return true
    }
  }
  return false
}

export function checkRulebook(name: string, version: VersionDoc, examples: ExampleRef[]): ClarityReport {
  const report = new Report()
  const rules = version.rules
  const risk = rec(version.risk_plan)
  const costs = rec(version.cost_model)

  const trimmed = (name ?? '').trim()
  if (trimmed.length < 3 || trimmed.length > 60) report.fail('NAME_MISSING', 'name', 'This strategy has no name yet.', 'name')

  // Market
  const market = rules.market ?? { instruments: [], timeframes: [], sessions: [] }
  const instruments = (market.instruments ?? []).filter((p) => typeof p === 'string')
  const tfs: string[] = market.timeframes ?? []
  if (instruments.length < 1 || instruments.length > 6 || instruments.some((p) => !PAIR.test(p))) {
    report.fail('MARKET_NO_INSTRUMENT', 'market.instruments', instruments.length ? 'Choose up to six pairs, like EUR/USD.' : 'No pairs chosen.', 'market')
  }
  if (tfs.length < 1 || tfs.length > 3 || new Set(tfs).size !== tfs.length || tfs.some((tf) => !(tf in TF_RANK))) {
    report.fail('MARKET_NO_TIMEFRAME', 'market.timeframes', tfs.length ? 'Choose one to three different timeframes.' : 'No timeframe chosen.', 'market')
  }
  const sessions: string[] = market.sessions ?? []
  if (!sessions.length) report.fail('MARKET_NO_SESSION', 'market.sessions', 'No trading session chosen.', 'market')

  // Setup
  const conds = rules.setup?.conditions ?? []
  if (!conds.length) report.fail('SETUP_EMPTY', 'setup.conditions', 'The setup has no conditions, so any candle would qualify.', 'setup')
  conds.forEach((c, i) => condition(report, c, `setup.conditions[${i}]`, tfs, 'setup'))
  const seen = new Map<string, number>()
  conds.forEach((c, i) => {
    const k = condKey(c)
    if (seen.has(k)) report.fail('COND_DUPLICATE', `setup.conditions[${i}]`, `Condition ${i + 1} repeats condition ${seen.get(k)! + 1}.`, 'setup')
    else seen.set(k, i)
  })
  for (let i = 0; i < conds.length; i++) {
    for (let j = i + 1; j < conds.length; j++) {
      if (conds[i].timeframe === conds[j].timeframe && conflicts(conds[i], conds[j])) {
        report.fail('COND_CONFLICT', `setup.conditions[${j}]`, `Conditions ${i + 1} and ${j + 1} can't both be true on the same candle.`, 'setup')
      }
    }
  }
  if (conds.length > 5) {
    report.warn('W_MANY_CONDITIONS', 'setup.conditions', `The setup has ${conds.length} conditions. Each extra filter is another chance to fit past noise.`, 'setup')
  }
  conds.forEach((c, i) => {
    const p = rec(c.params)
    if (c.type === 'time_window' && sessions.length && !windowOverlapsSessions(p, sessions)) {
      report.warn('W_WINDOW_OUTSIDE_SESSION', `setup.conditions[${i}]`, `The ${p.from}–${p.to} window falls outside the sessions you chose.`, 'setup')
    }
  })

  // Entry
  const entry = rules.entry
  const trigger = rec(entry?.trigger)
  if (!entry || !(String(trigger.type) in ENTRY_TRIGGERS)) {
    report.fail('ENTRY_MISSING', 'entry', "There's no entry rule yet.", 'entry')
  } else {
    const etf = entry.timeframe as string
    const lower = conds
      .filter((c) => c.type !== 'free_text' && c.timeframe && c.timeframe in TF_RANK && etf in TF_RANK && TF_RANK[c.timeframe] < TF_RANK[etf as keyof typeof TF_RANK])
      .map((c) => c.timeframe!)
    if (!tfs.includes(etf)) {
      report.fail('ENTRY_TIMEFRAME', 'entry.timeframe', `The entry uses ${etf || 'no timeframe'}, which isn't one of your timeframes.`, 'entry')
    } else if (lower.length) {
      const low = lower.sort((x, y) => TF_RANK[x] - TF_RANK[y])[0]
      report.fail('ENTRY_TIMEFRAME', 'entry.timeframe', `The entry uses ${etf}, but a condition uses a lower timeframe, ${low}.`, 'entry')
    }
    checkParams(report, ENTRY_TRIGGERS[String(trigger.type)], trigger, 'entry.trigger', 'entry', 'ENTRY_PARAM', 'ENTRY_PARAM')
  }

  // Stop
  const stop = rules.stop
  const rule = rec(stop?.rule)
  if (!stop || !(String(rule.type) in STOP_RULES)) {
    report.fail('STOP_MISSING', 'stop', "There's no initial stop. Every trade needs one before it opens.", 'stop')
  } else {
    checkParams(report, STOP_RULES[String(rule.type)], rule, 'stop.rule', 'stop', 'STOP_PARAM', 'STOP_PARAM')
    if (stop.skip_if_wider_than != null && checkParam({ kind: 'distance' }, stop.skip_if_wider_than)) {
      report.fail('STOP_PARAM', 'stop.skip_if_wider_than', "The 'skip if wider than' distance needs pips or ATR.", 'stop')
    }
    const buffer = rule.buffer ? rec(rule.buffer) : null
    if ((rule.type === 'swing' || rule.type === 'setup_candle') && buffer && buffer.value === 0) {
      report.warn('W_STOP_NO_BUFFER', 'stop.rule.buffer', 'Your stop rule has no buffer, so the spread alone can reach it.', 'stop')
    }
    if (rule.type === 'fixed' && isNum(rule.pips)) {
      report.warn('W_STOP_FIXED', 'stop.rule', `A fixed ${fmt(rule.pips)}-pip stop is the same in quiet and busy markets.`, 'stop')
    }
  }

  // Exit
  const exit = rules.exit
  const target = rec(exit?.target)
  if (!exit || !(String(target.type) in TARGETS) || (target.type === 'none' && !exit.trailing && !exit.time_exit)) {
    report.fail('EXIT_MISSING', 'exit', 'Nothing closes a winning trade: no target, trailing stop or time exit.', 'exit')
  } else {
    checkParams(report, TARGETS[String(target.type)], target, 'exit.target', 'exit', 'EXIT_PARAM', 'EXIT_PARAM')
    if (exit.breakeven) checkParams(report, BREAKEVEN, exit.breakeven, 'exit.breakeven', 'exit', 'EXIT_PARAM', 'EXIT_PARAM')
    if (exit.partial) checkParams(report, PARTIAL, exit.partial, 'exit.partial', 'exit', 'EXIT_PARAM', 'EXIT_PARAM')
    for (const [key, table] of [['trailing', TRAILING], ['time_exit', TIME_EXITS]] as const) {
      const part = exit[key]
      if (!part) continue
      if (!(part.type in table)) report.fail('EXIT_PARAM', `exit.${key}`, `The ${key.replace('_', ' ')} has no type.`, 'exit')
      else checkParams(report, table[part.type], part, `exit.${key}`, 'exit', 'EXIT_PARAM', 'EXIT_PARAM')
    }
    if (target.type === 'r_multiple' && isNum(target.r)) {
      const r = target.r
      for (const key of ['breakeven', 'partial'] as const) {
        const at = exit[key]?.at_r
        if (isNum(at) && at >= r) {
          report.fail('EXIT_ORDER', `exit.${key}.at_r`, `The ${key === 'breakeven' ? 'breakeven move' : 'partial close'} at +${fmt(at)}R comes at or after the +${fmt(r)}R target.`, 'exit')
        }
      }
      if (r < 1) report.warn('W_TARGET_BELOW_1R', 'exit.target.r', `The target is +${fmt(r)}R; the break-even win rate before costs is ${Math.round(100 / (1 + r))}%.`, 'exit')
    }
  }

  // Risk
  for (const [key, spec] of Object.entries(RISK)) {
    if (checkParam(spec, risk[key])) {
      const s = spec as { min: number; max: number }
      const name = label(key)
      report.fail('RISK_INCOMPLETE', `risk_plan.${key}`, `${name[0].toUpperCase()}${name.slice(1)} is missing or outside ${fmt(s.min)}–${fmt(s.max)}.`, 'risk')
    }
  }
  const streak = rec(risk.losing_streak)
  if (checkParam({ kind: 'int', min: 2, max: 10 }, streak.losses) || !(STREAK_ACTIONS as readonly string[]).includes(String(streak.action))) {
    report.fail('RISK_INCOMPLETE', 'risk_plan.losing_streak', 'The losing-streak rule needs a number of losses (2–10) and an action.', 'risk')
  }
  if (isNum(risk.daily_loss_r) && isNum(risk.weekly_loss_r) && risk.weekly_loss_r < risk.daily_loss_r) {
    report.fail('RISK_LIMITS_ORDER', 'risk_plan.weekly_loss_r', `The weekly loss limit (${fmt(risk.weekly_loss_r)}R) is lower than the daily one (${fmt(risk.daily_loss_r)}R).`, 'risk')
  }
  if (isNum(risk.risk_pct) && risk.risk_pct > 1) {
    const left = Math.round(100 * (1 - risk.risk_pct / 100) ** 20)
    report.warn('W_RISK_ABOVE_1', 'risk_plan.risk_pct', `Each trade risks ${fmt(risk.risk_pct)}%. Twenty losses in a row would leave about ${left}% of the account.`, 'risk')
  }
  if (isNum(risk.daily_loss_r) && risk.daily_loss_r > 5) {
    report.warn('W_DAILY_LIMIT_HIGH', 'risk_plan.daily_loss_r', `A ${fmt(risk.daily_loss_r)}R daily limit allows a long losing run in one day.`, 'risk')
  }
  if (isNum(risk.max_currency_risk_pct) && risk.max_currency_risk_pct > 3) {
    report.warn('W_CURRENCY_RISK_HIGH', 'risk_plan.max_currency_risk_pct', `Up to ${fmt(risk.max_currency_risk_pct)}% can ride on one currency at once.`, 'risk')
  }

  // Costs
  for (const pair of instruments) {
    const row = costs[pair]
    if (!row || typeof row !== 'object' || Object.entries(COSTS).some(([k, spec]) => checkParam(spec, rec(row)[k]))) {
      report.fail('COSTS_MISSING', `cost_model.${pair}`, `${pair} has no costs set.`, 'costs')
      continue
    }
    const r = rec(row)
    if ((r.spread_pips as number) + (r.slippage_pips as number) <= 0) {
      report.fail('COSTS_ZERO', `cost_model.${pair}`, `${pair} has no spread or slippage, so tests would show results no account could get.`, 'costs')
    }
    if (r.placeholder) report.warn('W_COSTS_PLACEHOLDER', `cost_model.${pair}`, `${pair} still uses placeholder costs.`, 'costs')
  }

  // No-trade rules
  const noTrade = rules.no_trade ?? { news: { enabled: false }, avoid_rollover: false, other: [] }
  const news = noTrade.news ?? { enabled: false }
  if (!news.enabled) {
    report.warn('W_NO_NEWS_RULE', 'no_trade.news', "There's no news window, so trades can open into high-impact releases.", 'no_trade')
  } else {
    for (const key of ['before_min', 'after_min'] as const) {
      if (checkParam({ kind: 'int', min: 0, max: 240 }, news[key])) {
        report.fail('NOTRADE_PARAM', `no_trade.news.${key}`, 'News windows are 0–240 minutes either side.', 'no_trade')
      }
    }
  }
  if (noTrade.max_spread_pips != null && checkParam({ kind: 'num', min: 0.1, max: 50 }, noTrade.max_spread_pips)) {
    report.fail('NOTRADE_PARAM', 'no_trade.max_spread_pips', 'The spread limit is 0.1–50 pips.', 'no_trade')
  }
  if (noTrade.no_new_after_friday && !TIME.test(String(noTrade.no_new_after_friday))) {
    report.fail('NOTRADE_PARAM', 'no_trade.no_new_after_friday', 'Use a time like 15:00.', 'no_trade')
  }
  ;(noTrade.other ?? []).forEach((c, i) => {
    const path = `no_trade.other[${i}]`
    if (!NO_TRADE_OTHER_TYPES.has(c.type)) {
      report.fail('NOTRADE_PARAM', path, 'Other no-trade rules are a time window or a rule in your own words.', 'no_trade')
      return
    }
    condition(report, c, path, tfs, 'no_trade')
  })

  // Examples (setup conditions only)
  conds.forEach((c, i) => {
    const mine = examples.filter((e) => e.rule_key === c.id)
    if (!mine.some((e) => e.valid)) report.fail('EXAMPLES_VALID_MISSING', `examples.${c.id}`, `Condition ${i + 1} has no example of a chart where it's true.`, 'examples')
    if (!mine.some((e) => e.valid === false)) report.fail('EXAMPLES_INVALID_MISSING', `examples.${c.id}`, `Condition ${i + 1} has no example of a chart where it's false.`, 'examples')
  })

  // Low timeframes
  if (tfs.length && tfs.every((tf) => tf in TF_RANK)) {
    const low = [...tfs].sort((x, y) => TF_RANK[x as keyof typeof TF_RANK] - TF_RANK[y as keyof typeof TF_RANK])[0]
    if (low === 'M5' || low === 'M15') report.warn('W_LOW_TF', 'market.timeframes', `On ${low} charts, the spread is a bigger share of each stop.`, 'market')
  }

  const texts = [...conds, ...(noTrade.other ?? [])].filter((c) => c.type === 'free_text')
  const kept = texts.some((c) => String(rec(c.params.override).reason ?? '').trim().length >= 10)
  return { passed: !report.items.some((i) => i.severity === 'fail'), kind: kept ? 'discretionary' : 'mechanical', items: report.items }
}
