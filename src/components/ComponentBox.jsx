export default function ComponentBox({
  id,
  label,
  activeComponentIds,
  activeComponentId,
  onSelect,
  accentColor = '#22d3ee',
  className = '',
  children,
}) {
  const isHighlighted = activeComponentIds?.has(id)
  const isSelected    = activeComponentId === id
  const hasActiveEvent = activeComponentIds && activeComponentIds.size > 0
  const isDimmed       = hasActiveEvent && !isHighlighted

  const baseShadow =
    '0 1px 0 0 rgba(255,255,255,0.025) inset, 0 1px 2px 0 rgba(0,0,0,0.4)'

  const style = {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%), rgba(17, 27, 48, 0.55)',
    borderColor: isSelected
      ? accentColor
      : isHighlighted
        ? `${accentColor}80`
        : 'var(--c-bd)',
    boxShadow: isSelected
      ? `${baseShadow}, 0 0 0 1px ${accentColor}, 0 0 24px ${accentColor}30, 0 0 60px ${accentColor}15`
      : isHighlighted
        ? `${baseShadow}, 0 0 18px ${accentColor}25`
        : baseShadow,
    opacity: isDimmed ? 0.35 : 1,
  }

  return (
    <div
      id={id}
      onClick={(e) => { e.stopPropagation(); onSelect(id) }}
      style={style}
      className={`
        group relative cursor-pointer rounded-md border px-3 py-2
        transition-all duration-200
        hover:border-k-bd-hi hover:bg-white/[0.02]
        ${isHighlighted ? 'active-shimmer' : ''}
        ${className}
      `}
    >
      {/* Left accent bar */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r transition-opacity"
        style={{
          background: accentColor,
          opacity: isSelected ? 1 : isHighlighted ? 0.7 : 0,
        }}
      />

      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[12px] font-medium tracking-tight leading-tight select-none transition-colors"
          style={{
            color: isSelected ? accentColor : isHighlighted ? '#f1f5f9' : '#cbd5e1',
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
                boxShadow: `0 0 8px ${accentColor}`,
                animation: 'pulse-amber 1.8s ease-in-out infinite',
              }}
            />
          )}
          <svg
            className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity"
            style={{ color: '#94a3b8' }}
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
