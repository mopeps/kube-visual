import ComponentBox from './ComponentBox'
import KernelPrimitives from './KernelPrimitives'

export default function PodLayer({ podId, label, activeComponentIds, activeComponentId, onSelectComponent, isExpanded, onToggleExpand }) {
  return (
    <div className="rounded border border-[#00e5ff]/30 bg-black/20 p-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[0.6rem] font-display font-semibold text-[#00e5ff]/70 uppercase tracking-[0.12em]">
          Pod Boundary
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpand(podId) }}
          className="text-[0.6rem] text-[#00e5ff]/60 hover:text-[#00e5ff] transition-colors px-1.5 py-0.5 rounded bg-[#00e5ff]/10 hover:bg-[#00e5ff]/15 border border-[#00e5ff]/20"
        >
          {isExpanded ? '▲ Collapse' : '▼ Expand'}
        </button>
      </div>

      <ComponentBox
        id={podId}
        label={label}
        activeComponentIds={activeComponentIds}
        activeComponentId={activeComponentId}
        onSelect={onSelectComponent}
        colorClass="border-[#00e5ff]/40 bg-[#00e5ff]/5"
        accentColor="#00e5ff"
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
