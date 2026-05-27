export default function ComponentBox({
  id,
  label,
  activeComponentIds,
  activeComponentId,
  onSelect,
  colorClass = 'border-k-bd bg-k-s1/50',
  accentColor = '#22d3ee',
  className = '',
  children,
}) {
  const isHighlighted = activeComponentIds?.has(id)
  const isSelected    = activeComponentId === id
  const hasActiveEvent = activeComponentIds && activeComponentIds.size > 0

  const opacityClass = hasActiveEvent
    ? (isHighlighted ? 'opacity-100' : 'opacity-20')
    : 'opacity-80 hover:opacity-100'

  const borderStyle = isSelected
    ? { boxShadow: `0 0 0 1px ${accentColor}, 0 0 20px ${accentColor}28, inset 0 0 20px ${accentColor}08` }
    : isHighlighted
      ? { boxShadow: `0 0 0 1px ${accentColor}80, 0 0 12px ${accentColor}20` }
      : {}

  return (
    <div
      id={id}
      onClick={(e) => { e.stopPropagation(); onSelect(id) }}
      style={borderStyle}
      className={`
        relative cursor-pointer transition-all duration-200
        border bg-k-s1/60 p-2
        ${colorClass} ${opacityClass} ${className}
        ${isHighlighted ? 'active-shimmer' : ''}
      `}
    >
      {/* Corner brackets */}
      <span
        className="absolute top-0 left-0 w-[6px] h-[6px] border-t border-l transition-opacity duration-200"
        style={{ borderColor: accentColor, opacity: isSelected ? 1 : isHighlighted ? 0.7 : 0.2 }}
      />
      <span
        className="absolute top-0 right-0 w-[6px] h-[6px] border-t border-r transition-opacity duration-200"
        style={{ borderColor: accentColor, opacity: isSelected ? 1 : isHighlighted ? 0.7 : 0.2 }}
      />
      <span
        className="absolute bottom-0 left-0 w-[6px] h-[6px] border-b border-l transition-opacity duration-200"
        style={{ borderColor: accentColor, opacity: isSelected ? 1 : isHighlighted ? 0.7 : 0.2 }}
      />
      <span
        className="absolute bottom-0 right-0 w-[6px] h-[6px] border-b border-r transition-opacity duration-200"
        style={{ borderColor: accentColor, opacity: isSelected ? 1 : isHighlighted ? 0.7 : 0.2 }}
      />

      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[0.68rem] font-mono font-medium text-k-tx-wh select-none leading-tight"
          style={{ color: isSelected ? accentColor : isHighlighted ? '#e8f4ff' : undefined }}
        >
          {label}
        </span>
        {isHighlighted && (
          <span
            className="flex-shrink-0 w-1.5 h-1.5 animate-pulse-amber"
            style={{ background: accentColor }}
          />
        )}
      </div>

      {children}
    </div>
  )
}
