import ComponentBox from './ComponentBox'
import KernelPrimitives from './KernelPrimitives'

export default function PodLayer({
  podId,
  label,
  activeComponentIds,
  activeComponentId,
  onSelectComponent,
  isExpanded,
  onToggleExpand,
}) {
  return (
    <div
      className="rounded-md p-2.5"
      style={{
        border: '1px solid rgba(34, 211, 238, 0.25)',
        background: 'linear-gradient(180deg, rgba(34, 211, 238, 0.04) 0%, transparent 100%)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] font-medium tracking-wide uppercase text-k-cyan/70">
          Pod
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpand(podId) }}
          className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors"
          style={{
            color: isExpanded ? '#22d3ee' : 'rgba(34, 211, 238, 0.6)',
            background: isExpanded ? 'rgba(34, 211, 238, 0.1)' : 'transparent',
          }}
        >
          <svg
            className="w-2.5 h-2.5 transition-transform"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          {isExpanded ? 'collapse' : 'expand'}
        </button>
      </div>

      <ComponentBox
        id={podId}
        label={label}
        activeComponentIds={activeComponentIds}
        activeComponentId={activeComponentId}
        onSelect={onSelectComponent}
        accentColor="#22d3ee"
      />

      <KernelPrimitives
        activeComponentIds={activeComponentIds}
        activeComponentId={activeComponentId}
        onSelectComponent={onSelectComponent}
        isVisible={isExpanded}
      />
    </div>
  )
}
