import { useState } from 'react'

export default function ComponentBox({
  id,
  label,
  activeComponentIds,
  activeComponentId,
  onSelect,
  accentColor = '#00f0ff',
  className = '',
  children,
}) {
  const [isHovered, setIsHovered] = useState(false)
  const isHighlighted = activeComponentIds?.has(id)
  const isSelected    = activeComponentId === id
  const hasActiveEvent = activeComponentIds && activeComponentIds.size > 0
  const isDimmed       = hasActiveEvent && !isHighlighted

  const baseShadow =
    '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 1px 2px 0 rgba(0,0,0,0.5)'

  const borderColor = isSelected
    ? accentColor
    : isHighlighted
      ? accentColor
      : isHovered
        ? `${accentColor}cc`
        : `${accentColor}40`

  const boxShadow = isSelected
    ? `${baseShadow}, 0 0 0 1px ${accentColor}, 0 0 22px ${accentColor}80, 0 0 60px ${accentColor}30`
    : isHighlighted
      ? `${baseShadow}, 0 0 18px ${accentColor}70, 0 0 40px ${accentColor}25`
      : isHovered
        ? `${baseShadow}, 0 0 14px ${accentColor}55, 0 0 28px ${accentColor}20`
        : baseShadow

  const style = {
    background: isHovered || isSelected
      ? `linear-gradient(180deg, ${accentColor}1f 0%, ${accentColor}08 100%), rgba(16, 24, 44, 0.85)`
      : `linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.005) 100%), rgba(16, 24, 44, 0.7)`,
    borderColor,
    boxShadow,
    opacity: isDimmed ? 0.32 : 1,
  }

  return (
    <div
      id={id}
      onClick={(e) => { e.stopPropagation(); onSelect(id) }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={style}
      className={`
        group relative cursor-pointer rounded-md border pl-3 pr-2.5 py-1.5
        inline-flex w-fit max-w-full
        transition-all duration-150
        ${isSelected ? 'scale-[1.02]' : isHovered ? 'scale-[1.015] -translate-y-px' : ''}
        ${isHighlighted ? 'active-shimmer' : ''}
        ${className}
      `}
    >
      {/* Left accent bar */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r transition-opacity"
        style={{
          background: accentColor,
          boxShadow: (isSelected || isHighlighted || isHovered) ? `0 0 6px ${accentColor}` : 'none',
          opacity: isSelected ? 1 : isHighlighted ? 0.85 : isHovered ? 0.6 : 0.25,
        }}
      />

      <div className="flex items-center justify-between gap-2 w-full">
        <span
          className="text-[12px] font-medium tracking-tight leading-tight select-none transition-colors whitespace-nowrap"
          style={{
            color: isSelected ? accentColor : isHighlighted || isHovered ? '#f8fafc' : '#cbd5e1',
            textShadow: (isSelected || isHighlighted) ? `0 0 12px ${accentColor}80` : 'none',
          }}
        >
          {label}
        </span>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isHighlighted && (
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: accentColor,
                boxShadow: `0 0 10px ${accentColor}, 0 0 4px ${accentColor}`,
                animation: 'pulse-amber 1.8s ease-in-out infinite',
              }}
            />
          )}
          <svg
            className="w-3 h-3 transition-all"
            style={{
              color: isHovered ? accentColor : '#94a3b8',
              opacity: isHovered ? 0.9 : 0,
              transform: isHovered ? 'translateX(1px)' : 'translateX(-2px)',
            }}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {children}
    </div>
  )
}
