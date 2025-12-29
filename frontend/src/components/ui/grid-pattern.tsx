import { useId } from 'react'
import { cn } from '@/lib/utils'

type GridPatternProps = {
  width?: number
  height?: number
  x?: number
  y?: number
  squares?: number[][]
  className?: string
}

export function GridPattern({
  width = 40,
  height = 40,
  x = 0,
  y = 0,
  squares = [],
  className,
}: GridPatternProps) {
  const id = `grid-pattern-${useId()}`

  return (
    <svg
      className={cn('absolute inset-0 w-full h-full pointer-events-none z-0', className)}
      width="100%"
      height="100%"
      viewBox={`0 0 ${width * 20} ${height * 20}`}
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id={id} width={width} height={height} patternUnits="userSpaceOnUse">
          <rect width={width} height={height} fill="transparent" />
          <path
            d={`M ${width} 0 L 0 0 0 ${height}`}
            stroke="rgba(15,23,42,0.12)"
            strokeWidth={1}
            fill="none"
          />
        </pattern>
      </defs>

      <rect width="100%" height="100%" fill={`url(#${id})`} />

      {squares.map((pair, idx) => {
        const [col, row] = pair
        const rx = col * width + x * width
        const ry = row * height + y * height
        return (
          <rect
            key={idx}
            x={rx}
            y={ry}
            width={width}
            height={height}
            fill="#0ea5e9"
            style={{ opacity: 0.06 }}
          />
        )
      })}
    </svg>
  )
}

export default GridPattern
