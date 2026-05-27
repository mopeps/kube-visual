export default function ComponentBox({
  id,
  label,
  activeComponentIds,
  activeComponentId,
  onSelect,
  colorClass = 'border-white/20 bg-white/5',
  accentColor = '#fff',
  className = '',
  children,
}) {
  const isHighlighted = activeComponentIds?.has(id)
  const isSelected = activeComponentId === id
  const hasActiveEvent = activeComponentIds && activeComponentIds.size > 0

  const opacityClass = hasActiveEvent
    ? isHighlighted ? 'opacity-100' : 'opacity-25'
    : 'opacity-70'

  return (
    <div
      id={id}
      onClick={(e) => { e.stopPropagation(); onSelect(id) }}
      style={isSelected ? { boxShadow: `0 0 0 2px ${accentColor}, 0 0 16px ${accentColor}40` } : {}}
      className={`
        rounded border p-2 cursor-pointer transition-all duration-300 bg-black/30
        hover:opacity-100
        ${colorClass} ${opacityClass} ${className}
      `}
    >
      <span className="text-xs font-display font-semibold text-white/85 select-none">{label}</span>
      {children}
    </div>
  )
}
