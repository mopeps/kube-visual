import { useState } from 'react'

export default function ComponentBox({
  id,
  label,
  activeComponentIds,
  activeComponentId,
  onSelect,
  accentColor = '#89dceb',
  className = '',
  children,
}) {
  const [isHovered, setIsHovered] = useState(false)
  const isHighlighted  = activeComponentIds?.has(id)
  const isSelected     = activeComponentId === id
  const hasActiveEvent = activeComponentIds && activeComponentIds.size > 0
  const isDimmed       = hasActiveEvent && !isHighlighted

  // Borders: dim when idle, solid accent when active.
  const borderColor = isSelected
    ? accentColor
    : isHighlighted
      ? accentColor
      : isHovered
        ? `${accentColor}cc`
        : `${accentColor}44`

  const glow = isSelected
    ? `0 0 0 1px ${accentColor}, 0 0 18px ${accentColor}55`
    : isHighlighted
      ? `0 0 14px ${accentColor}50`
      : isHovered
        ? `0 0 10px ${accentColor}35`
        : 'none'

  const style = {
    background: isSelected
      ? `linear-gradient(180deg, ${accentColor}22 0%, ${accentColor}08 100%), var(--c-s2)`
      : isHovered || isHighlighted
        ? `linear-gradient(180deg, ${accentColor}14 0%, transparent 100%), var(--c-s2)`
        : 'var(--c-s1)',
    borderColor,
    boxShadow: glow,
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
        group relative cursor-pointer border pl-2.5 pr-2 py-1
        inline-flex w-fit max-w-full
        transition-all duration-150 font-mono
        ${isSelected ? '-translate-y-px' : isHovered ? '-translate-y-px' : ''}
        ${isHighlighted && !isSelected ? 'active-shimmer' : ''}
        ${className}
      `}
    >
      {/* Left rail */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-1 bottom-1 w-[2px] transition-opacity"
        style={{
          background: accentColor,
          opacity: isSelected ? 1 : isHighlighted ? 0.85 : isHovered ? 0.55 : 0.22,
        }}
      />

      <div className="flex items-center gap-2 w-full">
        {/* Prompt glyph */}
        <span
          className="text-[10px] flex-shrink-0"
          style={{
            color: isSelected || isHighlighted ? accentColor : 'var(--c-tx-dim)',
            opacity: isSelected || isHighlighted || isHovered ? 1 : 0.7,
          }}
        >
          {isSelected ? '▾' : '▸'}
        </span>

        {/* Label */}
        <span
          className="text-[11.5px] font-medium leading-tight select-none transition-colors whitespace-nowrap tracking-tight"
          style={{
            color: isSelected
              ? accentColor
              : isHighlighted || isHovered
                ? 'var(--c-tx-wh)'
                : 'var(--c-tx-br)',
            textShadow: (isSelected || isHighlighted) ? `0 0 10px ${accentColor}66` : 'none',
          }}
        >
          {label}
        </span>

        {/* Right indicator */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-auto pl-1">
          {isHighlighted && (
            <span
              className="text-[10px] font-bold"
              style={{
                color: accentColor,
                textShadow: `0 0 8px ${accentColor}`,
                animation: 'pulse-amber 1.8s ease-in-out infinite',
              }}
            >
              ●
            </span>
          )}
          {isHovered && !isHighlighted && (
            <span
              className="text-[10px] animate-blink"
              style={{ color: accentColor }}
            >
              ▌
            </span>
          )}
        </div>
      </div>

      {children}
    </div>
  )
}
