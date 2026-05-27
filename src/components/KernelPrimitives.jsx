import ComponentBox from './ComponentBox'

const accent = '#a6e3a1' // catppuccin green

export default function KernelPrimitives({ activeComponentIds, activeComponentId, onSelectComponent, isVisible }) {
  return (
    <div
      className={`overflow-hidden transition-all duration-300 ease-out ${
        isVisible ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'
      }`}
    >
      <div
        className="p-2 relative"
        style={{
          border: `1px dashed ${accent}88`,
          background: `linear-gradient(180deg, ${accent}0d 0%, transparent 100%)`,
        }}
      >
        <span className="absolute -top-px -left-px w-1.5 h-1.5 border-t border-l border-dashed" style={{ borderColor: accent }} />
        <span className="absolute -top-px -right-px w-1.5 h-1.5 border-t border-r border-dashed" style={{ borderColor: accent }} />

        <div className="flex items-center gap-2 mb-2 -mt-0.5">
          <span className="font-mono text-[9.5px] text-k-tx-mut">╞═</span>
          <span
            className="font-mono text-[9.5px] font-semibold tracking-[0.2em] uppercase"
            style={{ color: accent, textShadow: `0 0 8px ${accent}55` }}
          >
            kernel.syms
          </span>
          <span className="font-mono text-[9.5px] text-k-tx-mut">═╡</span>
          <span className="hr-dashed" />
          <span className="font-mono text-[9.5px] text-k-tx-dim">3</span>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9.5px] text-k-tx-dim tabular-nums">0x00</span>
            <ComponentBox
              id="pod-netns"
              label="netns"
              activeComponentIds={activeComponentIds}
              activeComponentId={activeComponentId}
              onSelect={onSelectComponent}
              accentColor={accent}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9.5px] text-k-tx-dim tabular-nums">0x01</span>
            <ComponentBox
              id="pod-cgroups"
              label="cgroups"
              activeComponentIds={activeComponentIds}
              activeComponentId={activeComponentId}
              onSelect={onSelectComponent}
              accentColor={accent}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9.5px] text-k-tx-dim tabular-nums">0x02</span>
            <ComponentBox
              id="container-process"
              label="pid 1"
              activeComponentIds={activeComponentIds}
              activeComponentId={activeComponentId}
              onSelect={onSelectComponent}
              accentColor={accent}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
