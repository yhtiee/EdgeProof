/**
 * Pip, the Academy mascot (DESIGN.md §7 "Illustration"): a simple line
 * drawing in --neutral-data with one amber detail, the antenna's dot, which
 * echoes the range bar's estimate. Decorative only, so it's hidden from
 * screen readers. Shown on lesson screens without a simulator or diagram.
 */
export type MascotPose = 'wave' | 'explain' | 'think' | 'idea' | 'cheer'

const LINE = 'var(--neutral-data)'
const INK = 'var(--text)'

export function Mascot({ pose, className = '' }: { pose: MascotPose; className?: string }) {
  const lookUp = pose === 'think'
  const eyeY = lookUp ? 55 : 58
  const eyeDx = lookUp ? 2 : 0
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true" focusable="false" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* Idea pose: a soft halo around the antenna light */}
      {pose === 'idea' && (
        <g stroke={LINE} strokeWidth="2">
          <path d="M47 9l-4-4M73 9l4-4M44 18h-6M76 18h6" />
        </g>
      )}

      {/* Antenna, with the one amber detail */}
      <path d="M60 28V20" stroke={LINE} strokeWidth="3" />
      <circle cx="60" cy="16" r="5.5" fill="var(--accent)" />

      {/* Arms (behind the body) */}
      <g stroke={LINE} strokeWidth="3">
        {pose === 'wave' && (
          <>
            <path d="M25 66c-6-6-8-14-6-22" />
            <path d="M95 70c5 4 9 6 13 6" />
          </>
        )}
        {pose === 'explain' && (
          <>
            <path d="M25 70c-5 4-9 6-13 6" />
            <path d="M95 66c7-3 12-8 16-14" />
          </>
        )}
        {pose === 'think' && (
          <>
            <path d="M25 70c-5 4-9 6-13 6" />
            <path d="M93 74c-4 4-10 5-16 3" />
          </>
        )}
        {pose === 'idea' && (
          <>
            <path d="M25 70c-5 4-9 6-13 6" />
            <path d="M95 64c5-6 7-13 6-20" />
          </>
        )}
        {pose === 'cheer' && (
          <>
            <path d="M26 62c-7-6-10-15-9-24" />
            <path d="M94 62c7-6 10-15 9-24" />
          </>
        )}
      </g>

      {/* Body */}
      <rect x="24" y="28" width="72" height="70" rx="30" fill="var(--surface)" stroke={LINE} strokeWidth="3" />

      {/* Face */}
      <circle cx={48 + eyeDx} cy={eyeY} r="4" fill={INK} />
      <circle cx={72 + eyeDx} cy={eyeY} r="4" fill={INK} />
      {pose === 'cheer' ? (
        <path d="M47 72c4 7 22 7 26 0" stroke={INK} strokeWidth="3" />
      ) : pose === 'think' ? (
        <path d="M54 74h12" stroke={INK} strokeWidth="3" />
      ) : (
        <path d="M50 72c3 4 17 4 20 0" stroke={INK} strokeWidth="3" />
      )}

      {/* Feet */}
      <g stroke={LINE} strokeWidth="3">
        <path d="M46 98v8M74 98v8" />
        <path d="M40 106h12M68 106h12" />
      </g>

      {/* Think pose: a question mark beside the head */}
      {pose === 'think' && (
        <path d="M103 30c0-5 4-8 8-8s7 3 7 7c0 5-7 6-7 11M111 46v1" stroke={LINE} strokeWidth="2.5" />
      )}
    </svg>
  )
}

/** Which pose suits a screen. */
export function poseFor(blocks: { type: string }[], index: number): MascotPose {
  if (blocks.some((b) => b.type === 'question')) return 'think'
  if (blocks.some((b) => b.type === 'takeaway')) return 'idea'
  if (index === 0) return 'wave'
  return 'explain'
}

export function hasInteractive(blocks: { type: string }[]) {
  return blocks.some((b) => b.type === 'simulator' || b.type === 'diagram')
}
