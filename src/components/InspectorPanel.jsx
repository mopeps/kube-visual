import { useEffect, useState } from 'react'
import componentsData from '../data/components.json'

const LAYER_CONFIG = {
  'External':                  { color: '#89dceb', label: 'external' },
  'Management Layer':          { color: '#74c7ec', label: 'mgmt' },
  'Host Networking Subsystem': { color: '#a6e3a1', label: 'host.net' },
  'Linux Kernel Primitives':   { color: '#a6e3a1', label: 'kernel' },
}

function SectionHeader({ label, color, count }) {
  return (
    <div className="flex items-center gap-2 mb-2.5 font-mono">
      <span className="text-[10.5px] text-k-tx-mut">##</span>
      <span
        className="text-[10.5px] font-semibold uppercase tracking-[0.22em]"
        style={{ color }}
      >
        {label}
      </span>
      {count != null && (
        <span className="text-[10px] text-k-tx-dim tabular-nums">({count})</span>
      )}
      <span className="hr-dashed" />
    </div>
  )
}

export default function InspectorPanel({ componentId, onClose }) {
  const [copiedIndex, setCopiedIndex] = useState(null)
  const component = componentsData.find(c => c.componentId === componentId)

  // ESC closes the inspector — vim-style.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!component) return null

  const lc = LAYER_CONFIG[component.layer] ?? { color: '#bac2de', label: 'system' }

  const copyCommand = (text, index) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 1800)
    })
  }

  return (
    <div
      className="fixed lg:absolute top-0 right-0 h-full w-full sm:w-[380px] flex flex-col animate-slide-in z-50 overflow-hidden font-mono"
      style={{
        background: 'var(--c-s1)',
        borderLeft: '1px solid var(--c-bd-hi)',
        boxShadow: '-24px 0 60px -24px rgba(17, 17, 27, 0.85)',
      }}
    >
      {/* tmux-style pane header */}
      <div
        className="flex items-center gap-2 px-3 py-1 text-[10.5px] flex-shrink-0 border-b border-k-bd"
        style={{ background: lc.color, color: 'var(--c-crust)' }}
      >
        <span className="font-bold tracking-widest">▎ INSPECT</span>
        <span>::</span>
        <span className="font-bold truncate flex-1">{lc.label}</span>
        <button
          onClick={onClose}
          className="px-1.5 text-[12px] leading-none hover:bg-k-crust hover:text-k-tx-wh transition-colors"
          aria-label="Close inspector"
          title="esc"
        >
          ×
        </button>
      </div>

      {/* Banner */}
      <div className="px-4 pt-4 pb-3 flex-shrink-0 border-b border-k-bd-dim">
        <div className="flex items-baseline gap-1.5 mb-2 text-[10px] text-k-tx-mut">
          <span>──</span>
          <span style={{ color: lc.color }}>[{lc.label}]</span>
          <span>──</span>
        </div>
        <h2 className="font-display text-[20px] text-k-tx-wh tracking-wide leading-tight uppercase">
          {component.displayName}
        </h2>
        <p className="text-[10.5px] mt-2 text-k-tx-mut flex items-center gap-1">
          <span className="text-k-peach">@</span>
          <span>{component.componentId}</span>
          <span className="caret text-k-tx-mut" aria-hidden="true" />
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <section>
          <SectionHeader label="problem.solved" color={lc.color} />
          <p className="text-[12px] leading-relaxed text-k-tx-br pl-4 border-l border-k-bd"
             style={{ borderLeftColor: `${lc.color}55` }}>
            {component.problemSolved}
          </p>
        </section>

        <section>
          <SectionHeader label="interactions" color={lc.color} count={component.interactions.length} />
          <ul className="space-y-1.5">
            {component.interactions.map((item, i) => (
              <li key={i} className="flex gap-2 text-[11.5px] leading-relaxed text-k-tx">
                <span className="text-k-tx-dim tabular-nums flex-shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ color: lc.color }} className="flex-shrink-0">→</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SectionHeader label="explore" color={lc.color} count={component.explorationCommands.length} />
          <div className="space-y-2">
            {component.explorationCommands.map((cmd, i) => (
              <div
                key={i}
                className="relative overflow-hidden group"
                style={{
                  background: 'var(--c-crust)',
                  border: '1px solid var(--c-bd)',
                }}
              >
                <div className="flex items-center justify-between px-2.5 py-1 border-b border-k-bd-dim bg-k-s2">
                  <span className="text-[9.5px] text-k-tx-mut tracking-wider">
                    <span className="text-k-green">$</span> shell {String(i + 1).padStart(2, '0')}
                  </span>
                  <button
                    onClick={() => copyCommand(cmd, i)}
                    className="text-[10px] px-1.5 py-0 transition-all border"
                    style={{
                      color: copiedIndex === i ? 'var(--c-crust)' : 'var(--c-tx-mut)',
                      background: copiedIndex === i ? lc.color : 'transparent',
                      borderColor: copiedIndex === i ? lc.color : 'var(--c-bd)',
                    }}
                  >
                    {copiedIndex === i ? '✓ yanked' : '[y]ank'}
                  </button>
                </div>
                <pre className="text-[11px] p-2.5 overflow-x-auto whitespace-pre-wrap leading-relaxed text-k-green">
                  <span className="text-k-tx-mut select-none">▸ </span>{cmd}
                </pre>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Footer modeline */}
      <div className="px-3 py-1 border-t border-k-bd-hi flex-shrink-0 flex items-center gap-2 text-[10px]"
           style={{ background: 'var(--c-s2)' }}>
        <span className="text-k-tx-mut">─</span>
        <span className="text-k-yellow font-bold">N</span>
        <span className="text-k-tx-mut">─</span>
        <span className="text-k-tx-br">{component.componentId}</span>
        <span className="flex-1" />
        <span className="text-k-tx-mut">press</span>
        <span className="text-k-peach">esc</span>
        <span className="text-k-tx-mut">to close</span>
      </div>
    </div>
  )
}
