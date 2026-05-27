import ComponentBox from './ComponentBox'

export default function KernelPrimitives({ activeComponentIds, activeComponentId, onSelectComponent, isVisible }) {
  return (
    <div
      className={`overflow-hidden transition-all duration-300 ease-out ${
        isVisible ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'
      }`}
    >
      <div
        className="rounded-md p-2.5"
        style={{
          border: '1px dashed rgba(52, 211, 153, 0.35)',
          background: 'linear-gradient(180deg, rgba(52, 211, 153, 0.04) 0%, transparent 100%)',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono text-[10px] font-medium tracking-wide uppercase text-k-green/80">
            Kernel Primitives
          </span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(52, 211, 153, 0.2), transparent)' }} />
        </div>

        <div className="grid grid-cols-1 gap-1.5">
          <ComponentBox
            id="pod-netns"
            label="Network Namespace · netns"
            activeComponentIds={activeComponentIds}
            activeComponentId={activeComponentId}
            onSelect={onSelectComponent}
            accentColor="#34d399"
          />
          <ComponentBox
            id="pod-cgroups"
            label="Control Groups · cgroups"
            activeComponentIds={activeComponentIds}
            activeComponentId={activeComponentId}
            onSelect={onSelectComponent}
            accentColor="#34d399"
          />
          <ComponentBox
            id="container-process"
            label="Container Process · PID 1"
            activeComponentIds={activeComponentIds}
            activeComponentId={activeComponentId}
            onSelect={onSelectComponent}
            accentColor="#34d399"
          />
        </div>
      </div>
    </div>
  )
}
