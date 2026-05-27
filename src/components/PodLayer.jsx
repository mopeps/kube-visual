import ComponentBox from './ComponentBox'
import KernelPrimitives from './KernelPrimitives'

export default function PodLayer({ podId, label, activeComponentIds, activeComponentId, onSelectComponent, isExpanded, onToggleExpand }) {
  return (
    <div className="border p-2" style={{ borderColor: 'rgba(34,211,238,0.2)', background: 'rgba(34,211,238,0.02)' }}>
      {/* Pod boundary header */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-display text-xs tracking-wider" style={{ color: 'rgba(34,211,238,0.5)' }}>POD BOUNDARY</span>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpand(podId) }}
          className="text-[0.58rem] font-mono px-1.5 py-0.5 border transition-all duration-150"
          style={{
            borderColor: 'rgba(34,211,238,0.3)',
            color: isExpanded ? '#22d3ee' : 'rgba(34,211,238,0.45)',
            background: isExpanded ? 'rgba(34,211,238,0.08)' : 'transparent',
          }}
        >
          {isExpanded ? '▲ COLLAPSE' : '▼ EXPAND'}
        </button>
      </div>

      <ComponentBox
        id={podId}
        label={label}
        activeComponentIds={activeComponentIds}
        activeComponentId={activeComponentId}
        onSelect={onSelectComponent}
        colorClass="border-k-bd"
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
