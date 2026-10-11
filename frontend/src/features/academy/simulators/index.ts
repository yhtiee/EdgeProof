import type { ComponentType } from 'react'
import { GapSimulator, LeverageSimulator, PipValueSimulator, SwapSimulator, TradingCostSimulator } from './BasicsSimulators'
import { CandlestickSimulator, CurrencyExposureSimulator, MovingAverageSimulator, SessionClockSimulator } from './ChartSimulators'
import { DrawdownSimulator } from './DrawdownSimulator'
import { ExpectancySimulator } from './ExpectancySimulator'
import { PositionSizeSimulator } from './PositionSizeSimulator'
import { CoinFlipSimulator, CompoundingSimulator, OverfittingSimulator, RiskOfRuinSimulator, SampleSizeSimulator } from './StatsSimulators'

/** Simulator registry used by the lesson renderer (AC-2). Keys match scripts/lesson-parser.mjs. */
export const SIMULATORS: Record<string, ComponentType> = {
  'position-size': PositionSizeSimulator,
  expectancy: ExpectancySimulator,
  drawdown: DrawdownSimulator,
  leverage: LeverageSimulator,
  'pip-value': PipValueSimulator,
  'trading-cost': TradingCostSimulator,
  swap: SwapSimulator,
  gap: GapSimulator,
  'coin-flip': CoinFlipSimulator,
  'sample-size': SampleSizeSimulator,
  'risk-of-ruin': RiskOfRuinSimulator,
  compounding: CompoundingSimulator,
  overfitting: OverfittingSimulator,
  candlestick: CandlestickSimulator,
  'moving-average': MovingAverageSimulator,
  'session-clock': SessionClockSimulator,
  'currency-exposure': CurrencyExposureSimulator,
}
