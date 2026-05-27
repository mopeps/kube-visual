import ComponentBox from './ComponentBox'

export default function KernelPrimitives({ activeComponentIds, activeComponentId, onSelectComponent, isVisible }) {
  return (
    <div
      className={`overflow-hidden transition-all duration-300 ${
        isVisible ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      <div className="mt-2 p-2 rounded border border-dashed border-[#10b981]/40 bg-black/20">
        <p className="text-[0.6rem] font-display font-semibold text-[#10b981] mb-2 uppercase tracking-[0.15em]">
          Linux Kernel Primitives
        </p>
        <div className="grid grid-cols-1 gap-2">
          <ComponentBox
            id="pod-netns"
            label="Network Namespace (netns)"
            activeComponentIds={activeComponentIds}
            activeComponentId={activeComponentId}
            onSelect={onSelectComponent}
            colorClass="border-[#10b981]/50 bg-[#10b981]/5"
            accentColor="#10b981"
          />
          <ComponentBox
            id="pod-cgroups"
            label="Control Groups (cgroups)"
            activeComponentIds={activeComponentIds}
            activeComponentId={activeComponentId}
            onSelect={onSelectComponent}
            colorClass="border-[#10b981]/50 bg-[#10b981]/5"
            accentColor="#10b981"
          />
          <ComponentBox
            id="container-process"
            label="Container Process (PID 1)"
            activeComponentIds={activeComponentIds}
            activeComponentId={activeComponentId}
            onSelect={onSelectComponent}
            colorClass="border-[#10b981]/60 bg-[#10b981]/10"
            accentColor="#10b981"
          />
        </div>
      </div>
    </div>
  )
}
