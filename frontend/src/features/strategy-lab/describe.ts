import { TF_WORDS } from './fit'
import type { Condition, CostRow, Distance, Rules, RiskPlan, Timeframe } from './types'

/**
 * Plain-language sentences for every part of a rulebook: the live preview,
 * the checklist and the journal's rule checklist all read from here
 * (rulebook-builder.md §2.2 "Preview sentence"). Long side unless mirrored.
 */
type P = Record<string, unknown>
const n = (v: unknown, fallback = '…') => (typeof v === 'number' && Number.isFinite(v) ? String(Number(v.toPrecision(6))) : fallback)
const ma = (p: P, periodKey = 'period') => `${n(p[periodKey])} ${String(p.ma ?? 'ema').toUpperCase()}`
export const chart = (tf: Timeframe | null | undefined) => (tf ? `on the ${TF_WORDS[tf]} chart` : 'on a chart not chosen yet')
export const dist = (d: unknown) => {
  const x = d as Distance | undefined
  if (!x || typeof x.value !== 'number') return '…'
  return x.unit === 'atr' ? `${n(x.value)} × ATR(14)` : `${n(x.value)} ${x.value === 1 ? 'pip' : 'pips'}`
}
const LEVEL: Record<string, string> = {
  prior_day_high: "yesterday's high", prior_day_low: "yesterday's low", prior_week_high: "last week's high",
  prior_week_low: "last week's low", swing_high: 'the latest swing high', swing_low: 'the latest swing low',
  round_number: 'the nearest round number (…00)',
}
const PATTERN: Record<string, string> = {
  bullish_engulfing: 'a bullish engulfing', bearish_engulfing: 'a bearish engulfing',
  bullish_pin_bar: 'a bullish pin bar', bearish_pin_bar: 'a bearish pin bar', inside_bar: 'an inside bar',
}
const ZONE: Record<string, string> = { 'Europe/London': 'London', 'America/New_York': 'New York', 'Asia/Tokyo': 'Tokyo', UTC: 'UTC' }
const DAYS: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday' }

function days(list: unknown) {
  const d = Array.isArray(list) ? (list as string[]) : []
  if (d.length === 5) return 'Monday to Friday'
  if (!d.length) return 'no days chosen'
  return d.map((x) => DAYS[x] ?? x).join(', ')
}

/** The rule itself, without the chart ("The candle closes above the 50 EMA"). */
function body(c: Condition): string {
  const p = c.params as P
  switch (c.type) {
    case 'price_vs_ma':
      return `The candle closes ${p.relation === 'below' ? 'below' : 'above'} the ${ma(p)}`
    case 'ma_cross':
      return `The ${n(p.fast)} ${String(p.ma ?? 'ema').toUpperCase()} crossed ${p.direction === 'bearish' ? 'below' : 'above'} the ${ma(p, 'slow')} within the last ${n(p.within_bars)} ${p.within_bars === 1 ? 'candle' : 'candles'}`
    case 'ma_order':
      return `The ${n(p.fast)} ${String(p.ma ?? 'ema').toUpperCase()} is ${p.relation === 'below' ? 'below' : 'above'} the ${ma(p, 'slow')}`
    case 'structure': {
      const s = `(swings use ${n(p.strength)} candles each side)`
      if (p.pattern === 'lower_highs_lows') return `The last two swing highs and swing lows are both lower ${s}`
      if (p.pattern === 'break_up') return `A candle closes above the latest swing high ${s}`
      if (p.pattern === 'break_down') return `A candle closes below the latest swing low ${s}`
      return `The last two swing highs and swing lows are both higher ${s}`
    }
    case 'level': {
      const level = LEVEL[String(p.level)] ?? 'a level'
      const swing = String(p.level).startsWith('swing') ? ` (${n(p.strength)} candles each side)` : ''
      if (p.event === 'closes_above') return `The candle closes above ${level}${swing}`
      if (p.event === 'closes_below') return `The candle closes below ${level}${swing}`
      const lowSide = ['prior_day_low', 'prior_week_low', 'swing_low', 'round_number'].includes(String(p.level))
      return lowSide
        ? `The candle's low comes within ${dist(p.tolerance)} of ${level}${swing}, and the candle closes above it`
        : `The candle's high comes within ${dist(p.tolerance)} of ${level}${swing}, and the candle closes below it`
    }
    case 'candle_pattern': {
      const name = PATTERN[String(p.pattern)] ?? 'a pattern'
      const extra = String(p.pattern).includes('engulfing')
        ? ` (body at least ${n(p.ratio)}× the previous body)`
        : String(p.pattern).includes('pin_bar')
          ? ` (wick at least ${n(p.wick_ratio)}× the body, range at least ${n(p.min_range_atr)} × ATR)`
          : ''
      return `The last closed candle is ${name}${extra}`
    }
    case 'rsi': {
      const rel = { above: 'is above', below: 'is below', crosses_above: 'crosses above', crosses_below: 'crosses below' }[String(p.relation)] ?? 'is at'
      return `RSI(${n(p.period)}) ${rel} ${n(p.value)}`
    }
    case 'macd': {
      const ev: Record<string, string> = {
        line_above_signal: 'line is above its signal line', line_below_signal: 'line is below its signal line',
        crosses_above_signal: 'line crosses above its signal line', crosses_below_signal: 'line crosses below its signal line',
        histogram_above_zero: 'histogram is above zero', histogram_below_zero: 'histogram is below zero',
      }
      return `The MACD (${n(p.fast)}, ${n(p.slow)}, ${n(p.signal)}) ${ev[String(p.event)] ?? '…'}`
    }
    case 'atr':
      return `ATR(${n(p.period)}) is ${p.relation === 'below' ? 'below' : 'above'} ${n(p.value)} pips`
    case 'distance': {
      const to = p.to === 'ma' ? `the ${ma(p)}` : LEVEL[String(p.to)] ?? '…'
      const amount = p.unit === 'atr' ? `${n(p.value)} × ATR(14)` : `${n(p.value)} pips`
      return `The close is ${p.relation === 'beyond' ? 'more than' : 'within'} ${amount} ${p.relation === 'beyond' ? 'from' : 'of'} ${to}`
    }
    case 'time_window':
      return `The setup candle closes between ${p.from ?? '…'} and ${p.to ?? '…'} ${ZONE[String(p.zone)] ?? ''} time, ${days(p.days)}`
    case 'candle_size':
      return `The setup candle's ${p.measure === 'body' ? 'body' : 'range'} is ${p.relation === 'below' ? 'below' : 'above'} ${p.unit === 'atr' ? `${n(p.value)} × ATR(14)` : `${n(p.value)} pips`}`
    case 'free_text':
      return String(p.text ?? '').trim() || '(a rule in your own words, not written yet)'
  }
}

export function describeCondition(c: Condition): string {
  if (c.type === 'free_text' || c.type === 'time_window') return `${body(c)}.`.replace(/\.\.$/, '.')
  return `${body(c)} ${chart(c.timeframe)}.`
}

export function describeEntry(rules: Rules): string {
  const e = rules.entry
  if (!e) return 'No entry rule yet.'
  const t = e.trigger as P & { type: string }
  const buy = rules.direction !== 'short'
  const tf = chart(e.timeframe)
  switch (t.type) {
    case 'next_open':
      return `Enter at the open of the next candle ${tf} after all setup conditions are true.`
    case 'stop_beyond_setup':
      return `Place a ${buy ? 'buy stop' : 'sell stop'} ${dist(t.buffer)} ${buy ? "above the setup candle's high" : "below the setup candle's low"}. Cancel it if it hasn't filled within ${n(t.expiry_bars)} candles.`
    case 'limit_at_ma':
      return `Place a ${buy ? 'buy limit' : 'sell limit'} at the ${ma(t)} ${tf}. Cancel it after ${n(t.expiry_bars)} candles.`
    case 'limit_retrace':
      return `Place a ${buy ? 'buy limit' : 'sell limit'} at ${n(t.percent)}% of the setup candle's range. Cancel it after ${n(t.expiry_bars)} candles.`
    default:
      return 'No entry rule yet.'
  }
}

export function describeStop(rules: Rules): string {
  const s = rules.stop
  if (!s) return 'No initial stop yet.'
  const r = s.rule as P & { type: string }
  const side = rules.direction === 'short' ? 'above' : 'below'
  let text: string
  switch (r.type) {
    case 'swing':
      text = `Stop ${side} the latest swing ${side === 'below' ? 'low' : 'high'} (${n(r.strength)} candles each side), plus ${dist(r.buffer)}.`
      break
    case 'setup_candle':
      text = `Stop ${dist(r.buffer)} ${side} the setup candle's ${side === 'below' ? 'low' : 'high'}.`
      break
    case 'atr':
      text = `Stop ${n(r.multiple)} × ATR(${n(r.period)}) ${side} the entry.`
      break
    case 'fixed':
      text = `Stop ${n(r.pips)} pips ${side} the entry.`
      break
    default:
      text = 'No initial stop yet.'
  }
  return s.skip_if_wider_than ? `${text} Skip the trade if the stop would be wider than ${dist(s.skip_if_wider_than)}.` : text
}

export function describeExit(rules: Rules): string[] {
  const x = rules.exit
  if (!x) return ['No exit rule yet.']
  const t = x.target as P & { type: string }
  const out: string[] = []
  switch (t.type) {
    case 'r_multiple':
      out.push(`Take profit at +${n(t.r)}R.`)
      break
    case 'prior_swing':
      out.push(`Take profit at the previous swing (${n(t.strength)} candles each side).`)
      break
    case 'prior_day_level':
      out.push(rules.direction === 'short' ? "Take profit at yesterday's low." : "Take profit at yesterday's high.")
      break
    case 'atr':
      out.push(`Take profit ${n(t.multiple)} × ATR(${n(t.period)}) from the entry.`)
      break
    default:
      out.push('No fixed target.')
  }
  if (x.breakeven) out.push(`Move the stop to the entry price once the trade is +${n(x.breakeven.at_r)}R.`)
  if (x.partial) out.push(`Close ${n(x.partial.percent)}% at +${n(x.partial.at_r)}R.`)
  const tr = x.trailing as (P & { type: string }) | null | undefined
  if (tr) {
    if (tr.type === 'atr') out.push(`Trail the stop ${n(tr.multiple)} × ATR(${n(tr.period)}) behind the best close.`)
    if (tr.type === 'swing') out.push(`Trail the stop behind each new swing (${n(tr.strength)} candles each side).`)
    if (tr.type === 'ma') out.push(`Trail the stop at the ${ma(tr)}.`)
  }
  const te = x.time_exit as (P & { type: string }) | null | undefined
  if (te) {
    if (te.type === 'bars') out.push(`Close the trade after ${n(te.bars)} candles.`)
    if (te.type === 'time') out.push(`Close the trade at ${te.at} ${ZONE[String(te.zone)] ?? ''} time.`)
    if (te.type === 'before_weekend') out.push('Close the trade before the weekend (Friday 20:00 New York).')
  }
  return out
}

export function describeRisk(r: RiskPlan): string[] {
  const action = { stop_day: 'stop for the day', halve_risk: 'halve the risk per trade', stop_review: 'stop and review' }[r.losing_streak?.action] ?? '…'
  return [
    `Risk ${n(r.risk_pct)}% of the account per trade.`,
    `Stop for the day at −${n(r.daily_loss_r)}R and for the week at −${n(r.weekly_loss_r)}R.`,
    `Stop and review at a ${n(r.max_drawdown_r)}R drawdown.`,
    `At most ${n(r.max_open_trades)} open trades and ${n(r.max_trades_per_day)} trades a day; at most ${n(r.max_currency_risk_pct)}% on one currency.`,
    `After ${n(r.losing_streak?.losses)} losses in a row, ${action}.`,
  ]
}

export function describeCosts(pair: string, c: CostRow | undefined): string {
  if (!c) return `${pair}: no costs set.`
  const pips = (v: number) => `${n(v)} ${v === 1 ? 'pip' : 'pips'}`
  return `${pair}: spread ${pips(c.spread_pips)}, commission $${n(c.commission_per_lot)} a lot, slippage ${pips(c.slippage_pips)} (${n(c.news_slippage_pips)} in news)${c.placeholder ? ' · placeholder' : ''}.`
}

export function describeNoTrade(rules: Rules): string[] {
  const nt = rules.no_trade
  const out: string[] = []
  if (nt.news?.enabled) out.push(`No new trades from ${n(nt.news.before_min)} minutes before to ${n(nt.news.after_min)} minutes after high-impact news for either currency.`)
  if (nt.max_spread_pips) out.push(`No new trades while the spread is above ${n(nt.max_spread_pips)} pips.`)
  if (nt.avoid_rollover) out.push('No new trades from 16:45 to 17:15 New York time (the daily rollover).')
  if (nt.no_new_after_friday) out.push(`No new trades after ${nt.no_new_after_friday} New York time on Fridays.`)
  for (const c of nt.other ?? []) {
    if (c.type === 'time_window') {
      const p = c.params as P
      out.push(`No new trades between ${p.from} and ${p.to} ${ZONE[String(p.zone)] ?? ''} time.`)
    } else out.push(`${String((c.params as P).text ?? '').trim()}`)
  }
  return out.length ? out : ['No no-trade rules.']
}
