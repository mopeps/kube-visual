import ComponentBox from './ComponentBox'
import KernelPrimitives from './KernelPrimitives'

export default function PodLayer({ podId, label, activeComponentIds, activeComponentId, onSelectComponent, isExpanded, onToggleExpand }) {
  return (
    <div className="rounded border border-blue-700 bg-gray-900 p-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-blue-300 tracking-wide">Pod Boundary</span>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpand(podId) }}
          className="text-xs text-blue-400 hover:text-blue-200 transition-colors px-1.5 py-0.5 rounded bg-blue-950 hover:bg-blue-900"
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
        colorClass="border-blue-600 bg-blue-950"
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
