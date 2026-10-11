import { useId } from 'react'

/**
 * Simulator slider (DESIGN.md §6, §9): responds live, exposes its value as
 * text, and works with arrow keys.
 */
type Props = {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (v: number) => void
}

export function Slider({ label, value, min, max, step, display, onChange }: Props) {
  const id = useId()
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-small font-semibold text-text">
          {label}
        </label>
        <span className="font-mono text-body text-text" aria-hidden="true">
          {display}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={display}
        onChange={(e) => onChange(Number(e.target.value))}
        className="ep-range block h-11 w-full cursor-pointer"
        style={{ '--fill': `${pct}%` } as React.CSSProperties}
      />
    </div>
  )
}
