import type { ReactNode } from 'react'

/**
 * Topic drawings, one per Academy module (DESIGN.md §7 "Illustration"):
 * simple line drawings in --neutral-data, drawn in a 120 × 120 box. Pip, the
 * mascot, stands beside them and carries the one amber detail.
 */
const L = { stroke: 'var(--neutral-data)', strokeWidth: 3, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const T = { fill: 'var(--neutral-data)', fontFamily: 'var(--font-mono)', fontSize: 12 } as const
const Dot = ({ x, y, r = 4 }: { x: number; y: number; r?: number }) => <circle cx={x} cy={y} r={r} fill="var(--neutral-data)" />

const ART: Record<string, ReactNode> = {
  // Level 1
  'how-forex-works': (
    <g {...L}>
      <rect x="10" y="22" width="56" height="32" rx="4" />
      <circle cx="38" cy="38" r="8" />
      <rect x="54" y="70" width="56" height="32" rx="4" />
      <circle cx="82" cy="86" r="8" />
      <path d="M78 34h22l-6-6M42 90H20l6 6" />
    </g>
  ),
  'pairs-and-quotes': (
    <g>
      <rect x="8" y="30" width="104" height="60" rx="6" {...L} />
      <path d="M8 56h104" {...L} />
      <text x="20" y="49" {...T}>EUR/USD</text>
      <text x="20" y="78" {...T} fontSize="16">1.0850</text>
    </g>
  ),
  'pips-lots-leverage-margin': (
    <g {...L}>
      <rect x="8" y="46" width="104" height="28" rx="3" />
      <path d="M20 46v12M32 46v8M44 46v12M56 46v8M68 46v12M80 46v8M92 46v12M104 46v8" />
      <path d="M44 92h24M44 92l6-6M68 92l-6-6" />
    </g>
  ),
  'brokers-and-execution': (
    <g {...L}>
      <path d="M14 46l46-24 46 24z" />
      <path d="M22 50v40M42 50v40M62 50v40M82 50v40M102 50v40M12 96h96" />
    </g>
  ),
  'trading-costs': (
    <g {...L}>
      <path d="M28 14h64v92l-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6z" />
      <path d="M40 34h28M40 50h40M40 66h20M74 66h6M40 82h40" />
    </g>
  ),
  gaps: (
    <g {...L}>
      <path d="M8 90l18-10 14 6 16-12" />
      <path d="M72 40l14 8 12-10 14 6" strokeDasharray="0" />
      <path d="M56 74l16-34" strokeDasharray="4 6" />
    </g>
  ),
  sessions: (
    <g {...L}>
      <circle cx="60" cy="60" r="42" />
      <path d="M60 60V32M60 60l18 10" />
      <path d="M60 18a42 42 0 0 1 36 21" strokeWidth="6" />
      <path d="M102 60a42 42 0 0 1-18 34" strokeWidth="6" />
    </g>
  ),
  'why-traders-lose': (
    <g {...L}>
      <path d="M14 104h92" />
      <path d="M22 104V40M42 104V56M62 104V66M82 104V82" strokeWidth="10" />
      <path d="M86 30l18 22M104 52v-14M104 52H90" />
    </g>
  ),
  'scams-and-funding-risks': (
    <g {...L}>
      <path d="M60 12l40 14v30c0 26-18 42-40 50-22-8-40-24-40-50V26z" />
      <path d="M60 38v28M60 80v2" />
    </g>
  ),
  // Level 2
  'probability-thinking': (
    <g>
      <rect x="10" y="40" width="44" height="44" rx="8" {...L} />
      <Dot x={22} y={52} /><Dot x={42} y={72} /><Dot x={32} y={62} />
      <rect x="66" y="30" width="44" height="44" rx="8" {...L} transform="rotate(12 88 52)" />
      <Dot x={80} y={44} /><Dot x={96} y={44} /><Dot x={80} y={60} /><Dot x={96} y={60} />
    </g>
  ),
  'randomness-and-statistics': (
    <g {...L}>
      <circle cx="32" cy="34" r="20" />
      <path d="M26 34h12M32 28v12" />
      <path d="M8 100l12-14 10 8 12-20 10 12 12-26 10 18 12-10 12 6" />
    </g>
  ),
  'expectancy-and-r': (
    <g {...L}>
      <path d="M60 18v84M36 102h48M18 34h84" />
      <path d="M18 34l-10 30h20zM102 34l-10 22h20z" />
    </g>
  ),
  'position-sizing': (
    <g {...L}>
      <rect x="10" y="74" width="30" height="30" rx="3" />
      <rect x="46" y="56" width="30" height="48" rx="3" />
      <rect x="82" y="30" width="30" height="74" rx="3" />
      <path d="M10 16h102M10 12v8M112 12v8" />
    </g>
  ),
  'drawdown-and-risk-of-ruin': (
    <g {...L}>
      <path d="M8 60l20-20 18 8 16 34 18-10 18 10 14-30" />
      <path d="M30 34v52" strokeDasharray="3 5" />
      <path d="M24 40h12M24 82h44" strokeDasharray="3 5" />
    </g>
  ),
  'risk-comfort': (
    <g {...L}>
      <path d="M14 86a46 46 0 0 1 92 0" />
      <path d="M22 62l8 4M60 40v8M98 62l-8 4" />
      <path d="M60 86l-18-26" />
      <circle cx="60" cy="86" r="5" />
    </g>
  ),
  'realistic-returns': (
    <g {...L}>
      <path d="M10 104h100M10 104V14" />
      <path d="M14 98c40 0 70-10 90-82" strokeDasharray="4 6" />
      <path d="M14 98l20-6 14 4 16-14 14 4 16-12 10 2" />
    </g>
  ),
  // Level 3
  'probabilistic-mindset': (
    <g>
      <path d="M22 70c-12 0-16-22 0-26 0-18 26-22 32-10 8-14 34-8 34 8 16 2 16 28 0 28H22z" {...L} />
      <circle cx="36" cy="92" r="5" {...L} />
      <circle cx="26" cy="106" r="3" {...L} />
      <text x="44" y="64" {...T} fontSize="18">55%</text>
    </g>
  ),
  'fear-and-greed': (
    <g {...L}>
      <path d="M60 100S16 74 16 44c0-14 10-24 22-24 10 0 18 6 22 14 4-8 12-14 22-14 12 0 22 10 22 24 0 30-44 56-44 56z" />
      <path d="M26 56h16l6-12 8 26 8-20 6 6h22" />
    </g>
  ),
  'revenge-trading': (
    <g {...L}>
      <circle cx="60" cy="60" r="44" />
      <path d="M48 40v40M72 40v40" strokeWidth="8" />
    </g>
  ),
  routines: (
    <g {...L}>
      <rect x="22" y="18" width="76" height="92" rx="6" />
      <path d="M44 12h32v12H44z" />
      <path d="M34 46l6 6 10-12M58 46h28M34 70l6 6 10-12M58 70h28M34 94h16M58 94h28" />
    </g>
  ),
  journaling: (
    <g {...L}>
      <path d="M60 30c-12-8-30-10-46-6v76c16-4 34-2 46 6 12-8 30-10 46-6V24c-16-4-34-2-46 6zM60 30v76" />
      <path d="M26 46h22M26 60h22M72 46h22M72 60h16" />
    </g>
  ),
  // Level 4
  'market-structure': (
    <g>
      <path d="M8 96l22-30 14 16 22-36 14 18 26-42" {...L} />
      <circle cx="30" cy="66" r="6" {...L} /><circle cx="44" cy="82" r="6" {...L} />
      <circle cx="66" cy="46" r="6" {...L} /><circle cx="80" cy="64" r="6" {...L} />
    </g>
  ),
  'support-and-resistance': (
    <g {...L}>
      <rect x="8" y="22" width="104" height="12" rx="2" strokeDasharray="4 4" />
      <rect x="8" y="86" width="104" height="12" rx="2" strokeDasharray="4 4" />
      <path d="M10 80l18-48 18 52 20-50 18 48 16-40" />
    </g>
  ),
  trends: (
    <g {...L}>
      <path d="M10 100l20-24 12 10 22-30 12 10 30-38" />
      <path d="M96 28h12v12" />
      <path d="M10 108l98-90" strokeDasharray="3 6" />
    </g>
  ),
  'price-action-and-candles': (
    <g {...L}>
      <path d="M26 20v84M62 30v70M98 14v80" />
      <rect x="16" y="40" width="20" height="40" rx="2" fill="var(--surface)" />
      <rect x="52" y="54" width="20" height="24" rx="2" fill="var(--surface)" />
      <rect x="88" y="26" width="20" height="44" rx="2" fill="var(--surface)" />
    </g>
  ),
  indicators: (
    <g {...L}>
      <path d="M8 84l10-18 10 14 10-24 10 10 10-30 10 18 10-20 10 12 10-16 12 6" strokeWidth="2" />
      <path d="M8 86c30-6 50-22 104-46" strokeWidth="4" />
    </g>
  ),
  timeframes: (
    <g {...L}>
      <rect x="8" y="14" width="104" height="92" rx="6" />
      <rect x="28" y="34" width="64" height="56" rx="4" />
      <rect x="46" y="50" width="28" height="26" rx="3" />
    </g>
  ),
  // Level 5
  'interest-rates': (
    <g {...L}>
      <circle cx="60" cy="60" r="46" />
      <path d="M40 82l40-44" />
      <circle cx="42" cy="42" r="8" />
      <circle cx="78" cy="78" r="8" />
    </g>
  ),
  'central-banks': (
    <g {...L}>
      <path d="M12 44l48-28 48 28z" />
      <path d="M20 50h80M26 56v38M46 56v38M74 56v38M94 56v38M14 100h92" />
      <circle cx="60" cy="34" r="4" />
    </g>
  ),
  'economic-calendar': (
    <g>
      <rect x="14" y="22" width="92" height="84" rx="6" {...L} />
      <path d="M14 44h92M36 14v16M84 14v16" {...L} />
      <circle cx="74" cy="76" r="12" {...L} />
      {[32, 52].map((x) => [60, 78, 94].map((y) => <Dot key={`${x}-${y}`} x={x} y={y} r={2.5} />))}
    </g>
  ),
  'news-risk': (
    <g {...L}>
      <path d="M68 10L30 66h28l-10 44 42-60H62z" />
    </g>
  ),
  'intermarket-links': (
    <g {...L}>
      <rect x="10" y="40" width="54" height="34" rx="17" transform="rotate(-20 37 57)" />
      <rect x="56" y="46" width="54" height="34" rx="17" transform="rotate(-20 83 63)" />
    </g>
  ),
  // Level 6
  'ideas-to-rules': (
    <g {...L}>
      <path d="M30 70c-10-8-14-18-12-28 2-14 14-24 28-24s26 10 28 24c2 10-2 20-12 28v12H30z" />
      <path d="M32 92h28" />
      <path d="M80 50h30M80 66h30M80 82h30M80 98h20" />
    </g>
  ),
  'mechanical-vs-discretionary': (
    <g {...L}>
      <circle cx="60" cy="60" r="18" />
      <path d="M60 18v14M60 88v14M18 60h14M88 60h14M30 30l10 10M80 80l10 10M90 30L80 40M30 90l10-10" strokeWidth="8" />
    </g>
  ),
  'backtesting-and-hindsight': (
    <g {...L}>
      <path d="M28 34a42 42 0 1 1-8 40" />
      <path d="M20 18v20h20" />
      <path d="M60 36v26l16 10" />
    </g>
  ),
  'strategy-costs': (
    <g {...L}>
      <ellipse cx="46" cy="94" rx="30" ry="10" />
      <path d="M16 94V76M76 94V76" />
      <ellipse cx="46" cy="76" rx="30" ry="10" />
      <path d="M16 76V58M76 76V58" />
      <ellipse cx="46" cy="58" rx="30" ry="10" />
      <path d="M90 34h22" strokeWidth="5" />
    </g>
  ),
  overfitting: (
    <g>
      {[[12, 80], [24, 50], [36, 70], [48, 34], [60, 62], [72, 40], [84, 76], [96, 46], [108, 60]].map(([x, y]) => (
        <Dot key={x} x={x} y={y} />
      ))}
      <path d="M12 80C18 40 22 50 24 50s8 40 12 20 8-40 12-36 6 32 12 28 6-26 12-22 8 40 12 36 6-34 12-30 8 18 12 14" {...L} strokeWidth="2" />
    </g>
  ),
  'sample-size': (
    <g>
      {[[16, 30], [34, 18], [22, 56], [46, 40], [64, 26], [86, 36], [100, 20], [94, 60]].map(([x, y]) => (
        <Dot key={`${x}${y}`} x={x} y={y} r={3} />
      ))}
      <circle cx="54" cy="64" r="26" {...L} />
      <path d="M74 84l26 26" {...L} strokeWidth="6" />
    </g>
  ),
  'out-of-sample-testing': (
    <g {...L}>
      <path d="M8 60h104" />
      <path d="M8 52v16M72 44v32" />
      <rect x="82" y="22" width="26" height="22" rx="3" />
      <path d="M86 22v-6a9 9 0 0 1 18 0v6" />
      <path d="M8 88h60" strokeDasharray="4 4" />
    </g>
  ),
  // Level 7
  'multi-timeframe-analysis': (
    <g {...L}>
      <rect x="6" y="16" width="56" height="40" rx="4" />
      <rect x="34" y="40" width="56" height="40" rx="4" fill="var(--surface)" />
      <rect x="62" y="64" width="52" height="40" rx="4" fill="var(--surface)" />
      <path d="M68 92l10-8 8 4 10-12 10 4" strokeWidth="2" />
    </g>
  ),
  'currency-exposure': (
    <g>
      <path d="M60 22L22 92h76z" {...L} />
      {[[60, 22], [22, 92], [98, 92]].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="14" {...L} fill="var(--surface)" />
      ))}
      <text x="49" y="26" {...T} fontSize="10">USD</text>
      <text x="11" y="96" {...T} fontSize="10">EUR</text>
      <text x="87" y="96" {...T} fontSize="10">GBP</text>
    </g>
  ),
  'trade-management': (
    <g {...L}>
      <path d="M14 30h92M14 60h92M14 90h92" />
      <circle cx="38" cy="30" r="8" fill="var(--surface)" />
      <circle cx="80" cy="60" r="8" fill="var(--surface)" />
      <circle cx="56" cy="90" r="8" fill="var(--surface)" />
    </g>
  ),
  'prop-firm-rules': (
    <g {...L}>
      <path d="M8 40l18 12 16-8 18 20 16-6 18 16 18-8" />
      <path d="M8 96h104" strokeDasharray="6 5" />
      <path d="M8 22h104" strokeDasharray="6 5" />
    </g>
  ),
  'performance-review': (
    <g {...L}>
      <rect x="20" y="16" width="80" height="94" rx="6" />
      <path d="M36 92V70M54 92V54M72 92V62M90 92V44" strokeWidth="7" />
      <path d="M34 34h40" />
    </g>
  ),
}

export function ModuleArt({ module, className = '' }: { module: string; className?: string }) {
  const art = ART[module]
  if (!art) return null
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true" focusable="false">
      {art}
    </svg>
  )
}

export const MODULES_WITH_ART = Object.keys(ART)
