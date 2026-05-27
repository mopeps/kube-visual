export default function ComponentBox({
  id,
  label,
  activeComponentIds,
  activeComponentId,
  onSelect,
  colorClass = 'border-gray-600 bg-gray-800',
  className = '',
  children,
}) {
  const isHighlighted = activeComponentIds?.has(id)
  const isSelected = activeComponentId === id
  const hasActiveEvent = activeComponentIds && activeComponentIds.size > 0

  const opacityClass = hasActiveEvent
    ? isHighlighted ? 'opacity-100' : 'opacity-30'
    : 'opacity-60'

  const ringClass = isSelected
    ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-gray-900'
    : ''

  return (
    <div
      id={id}
      onClick={(e) => { e.stopPropagation(); onSelect(id) }}
      className={`
        rounded border p-2 cursor-pointer transition-all duration-300
        hover:opacity-100 hover:ring-1 hover:ring-gray-400
        ${colorClass} ${opacityClass} ${ringClass} ${className}
      `}
    >
      <span className="text-xs font-medium text-gray-200 select-none">{label}</span>
      {children}
    </div>
  )
}
