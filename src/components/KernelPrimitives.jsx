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
          border: '1px dashed rgba(57, 255, 136, 0.6)',
          background: 'linear-gradient(180deg, rgba(57, 255, 136, 0.08) 0%, transparent 100%)',
          boxShadow: '0 0 0 1px rgba(57, 255, 136, 0.05) inset, 0 0 18px -8px rgba(57, 255, 136, 0.5)',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="font-mono text-[10px] font-medium tracking-wide uppercase text-k-green"
            style={{ textShadow: '0 0 8px rgba(57, 255, 136, 0.6)' }}
          >
            Kernel Primitives
          </span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(57, 255, 136, 0.5), transparent)' }} />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <ComponentBox
            id="pod-netns"
            label="Network Namespace · netns"
            activeComponentIds={activeComponentIds}
            activeComponentId={activeComponentId}
            onSelect={onSelectComponent}
            accentColor="#39ff88"
          />
          <ComponentBox
            id="pod-cgroups"
            label="Control Groups · cgroups"
            activeComponentIds={activeComponentIds}
            activeComponentId={activeComponentId}
            onSelect={onSelectComponent}
            accentColor="#39ff88"
          />
          <ComponentBox
            id="container-process"
            label="Container Process · PID 1"
            activeComponentIds={activeComponentIds}
            activeComponentId={activeComponentId}
            onSelect={onSelectComponent}
            accentColor="#39ff88"
          />
        </div>
      </div>
    </div>
  )
}
