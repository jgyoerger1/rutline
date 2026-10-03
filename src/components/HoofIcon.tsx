import type { IconWeight } from '@phosphor-icons/react'

/**
 * Whitetail track: two cloven toes with the dewclaws behind. Drawn on the
 * same 256 grid and stroke weight as Phosphor so it sits beside their icons.
 */
export default function HoofIcon({ size = 24, weight = 'regular', className = '' }: { size?: number | string; weight?: IconWeight; className?: string }) {
  const filled = weight === 'fill' || weight === 'duotone'
  const toe = 'M110 40 C 82 60, 56 118, 68 178 C 74 210, 120 210, 124 176 C 130 126, 128 78, 110 40 Z'
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" className={className} fill="currentColor" aria-hidden>
      {filled ? (
        <>
          <path d={toe} />
          <path d={toe} transform="translate(256 0) scale(-1 1)" />
          <ellipse cx="78" cy="226" rx="13" ry="16" transform="rotate(-18 78 226)" />
          <ellipse cx="178" cy="226" rx="13" ry="16" transform="rotate(18 178 226)" />
        </>
      ) : (
        <g fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round">
          <path d={toe} />
          <path d={toe} transform="translate(256 0) scale(-1 1)" />
          <ellipse cx="78" cy="226" rx="13" ry="16" transform="rotate(-18 78 226)" />
          <ellipse cx="178" cy="226" rx="13" ry="16" transform="rotate(18 178 226)" />
        </g>
      )}
    </svg>
  )
}
