import ComponentBox from './ComponentBox'

export default function KernelPrimitives({ activeComponentIds, activeComponentId, onSelectComponent, isVisible }) {
  return (
    <div
      className={`overflow-hidden transition-all duration-300 ${
        isVisible ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      <div className="mt-2 p-2 rounded border border-dashed border-emerald-700 bg-gray-950">
        <p className="text-xs font-semibold text-emerald-400 mb-2 tracking-wide">Linux Kernel Primitives</p>
        <div className="grid grid-cols-1 gap-2">
          <ComponentBox
            id="pod-netns"
            label="Network Namespace (netns)"
            activeComponentIds={activeComponentIds}
            activeComponentId={activeComponentId}
            onSelect={onSelectComponent}
            colorClass="border-emerald-600 bg-emerald-950"
          />
          <ComponentBox
            id="pod-cgroups"
            label="Control Groups (cgroups)"
            activeComponentIds={activeComponentIds}
            activeComponentId={activeComponentId}
            onSelect={onSelectComponent}
            colorClass="border-emerald-600 bg-emerald-950"
          />
          <ComponentBox
            id="container-process"
            label="Container Process (PID 1)"
            activeComponentIds={activeComponentIds}
            activeComponentId={activeComponentId}
            onSelect={onSelectComponent}
            colorClass="border-emerald-500 bg-emerald-900"
          />
        </div>
      </div>
    </div>
  )
}
