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
  const accent = '#89dceb' // sky

  return (
    <div
      className="p-2 relative"
      style={{
        border: `1px solid ${accent}66`,
        background: `linear-gradient(180deg, ${accent}0d 0%, transparent 100%)`,
      }}
    >
      {/* Corner ticks */}
      <span className="absolute -top-px -left-px w-1.5 h-1.5 border-t border-l" style={{ borderColor: accent }} />
      <span className="absolute -top-px -right-px w-1.5 h-1.5 border-t border-r" style={{ borderColor: accent }} />
      <span className="absolute -bottom-px -left-px w-1.5 h-1.5 border-b border-l" style={{ borderColor: accent }} />
      <span className="absolute -bottom-px -right-px w-1.5 h-1.5 border-b border-r" style={{ borderColor: accent }} />

      <div className="flex items-center justify-between mb-2 -mt-0.5">
        <span
          className="font-mono text-[9.5px] font-semibold tracking-[0.2em] uppercase"
          style={{ color: accent, textShadow: `0 0 8px ${accent}55` }}
        >
          ◀ pod ▶
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpand(podId) }}
          className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0 transition-colors border"
          style={{
            color: isExpanded ? 'var(--c-crust)' : accent,
            background: isExpanded ? accent : 'transparent',
            borderColor: `${accent}80`,
          }}
        >
          <span>{isExpanded ? '[-]' : '[+]'}</span>
          <span className="hidden sm:inline">{isExpanded ? 'collapse' : 'expand'}</span>
        </button>
      </div>

      <ComponentBox
        id={podId}
        label={label}
        activeComponentIds={activeComponentIds}
        activeComponentId={activeComponentId}
        onSelect={onSelectComponent}
        accentColor={accent}
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
