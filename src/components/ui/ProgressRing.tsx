import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  value: number
  max: number
  color: string
  label: string
  size?: number
  strokeWidth?: number
}

export default function ProgressRing({ value, max, color, label, size = 82, strokeWidth = 8 }: Props) {
  const { theme } = useTheme()
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = max > 0 ? Math.min(value / max, 1) : 0
  const dashOffset = circumference * (1 - progress)
  const trackColor = theme === 'dark' ? '#374151' : '#e5e7eb'
  const complete = max > 0 && value >= max

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={complete ? '#10b981' : color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.45s ease, stroke 0.3s ease' }}
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {complete ? (
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <span className="text-sm font-bold text-gray-900 dark:text-white leading-none">
              {value}/{max}
            </span>
          )}
        </div>
      </div>

      <span className={`text-xs font-medium ${complete ? 'text-emerald-500' : 'text-gray-500 dark:text-gray-400'}`}>
        {label}
      </span>
    </div>
  )
}
