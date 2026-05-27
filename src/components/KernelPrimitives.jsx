import ComponentBox from './ComponentBox'

export default function KernelPrimitives({ activeComponentIds, activeComponentId, onSelectComponent, isVisible }) {
  return (
    <div
      className={`overflow-hidden transition-all duration-350 ease-in-out ${
        isVisible ? 'max-h-96 opacity-100 mt-1.5' : 'max-h-0 opacity-0'
      }`}
    >
      <div className="p-2 border border-dashed" style={{ borderColor: 'rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.03)' }}>
        {/* Section label */}
        <div className="flex items-center gap-2 mb-2">
          <span className="font-display text-sm tracking-wider" style={{ color: '#34d399' }}>KERNEL PRIMITIVES</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(52,211,153,0.15)' }} />
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          <ComponentBox
            id="pod-netns"
            label="Network Namespace (netns)"
            activeComponentIds={activeComponentIds}
            activeComponentId={activeComponentId}
            onSelect={onSelectComponent}
            colorClass="border-k-bd"
            accentColor="#34d399"
          />
          <ComponentBox
            id="pod-cgroups"
            label="Control Groups (cgroups)"
            activeComponentIds={activeComponentIds}
            activeComponentId={activeComponentId}
            onSelect={onSelectComponent}
            colorClass="border-k-bd"
            accentColor="#34d399"
          />
          <ComponentBox
            id="container-process"
            label="Container Process (PID 1)"
            activeComponentIds={activeComponentIds}
            activeComponentId={activeComponentId}
            onSelect={onSelectComponent}
            colorClass="border-k-bd"
            accentColor="#34d399"
          />
        </div>
      </div>
    </div>
  )
}
