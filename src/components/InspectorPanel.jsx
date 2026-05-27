import { useState } from 'react'
import componentsData from '../data/components.json'

const LAYER_CONFIG = {
  'External':                  { color: '#00f0ff', label: 'External' },
  'Management Layer':          { color: '#33c8ff', label: 'Management' },
  'Host Networking Subsystem': { color: '#39ff88', label: 'Host Networking' },
  'Linux Kernel Primitives':   { color: '#39ff88', label: 'Kernel' },
}

function SectionHeader({ label, color }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <span className="font-display text-[11px] font-semibold tracking-wider uppercase text-k-tx-br">
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${color}30, transparent)` }} />
    </div>
  )
}

export default function InspectorPanel({ componentId, onClose }) {
  const [copiedIndex, setCopiedIndex] = useState(null)
  const component = componentsData.find(c => c.componentId === componentId)

  if (!component) return null

  const lc = LAYER_CONFIG[component.layer] ?? { color: '#94a3b8', label: 'System' }

  const copyCommand = (text, index) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    })
  }

  return (
    <div
      className="fixed lg:absolute top-0 right-0 h-full w-full sm:w-[360px] flex flex-col animate-slide-in z-50 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(17, 27, 48, 0.7) 0%, rgba(7, 11, 20, 0.98) 100%)',
        borderLeft: '1px solid var(--c-bd)',
        backdropFilter: 'blur(16px)',
        boxShadow: '-24px 0 60px -24px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Banner */}
      <div className="relative px-5 pt-5 pb-4 flex-shrink-0 border-b border-k-bd">
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${lc.color}, transparent)` }}
        />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-mono font-medium"
                style={{
                  color: lc.color,
                  background: `${lc.color}15`,
                  border: `1px solid ${lc.color}40`,
                }}
              >
                <span
                  className="w-1 h-1 rounded-full"
                  style={{ background: lc.color, boxShadow: `0 0 6px ${lc.color}` }}
                />
                {lc.label}
              </span>
            </div>
            <h2
              className="font-display text-[18px] font-semibold tracking-tight leading-tight text-k-tx-wh"
            >
              {component.displayName}
            </h2>
            <p className="font-mono text-[10.5px] mt-1.5 text-k-tx-mut">
              {component.componentId}
            </p>
          </div>

          <button
            onClick={onClose}
            className="mt-0.5 w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md text-k-tx-mut hover:text-k-tx-wh hover:bg-white/5 transition-colors"
            aria-label="Close inspector"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        <section>
          <SectionHeader label="What it solves" color={lc.color} />
          <p className="text-[13px] leading-relaxed text-k-tx-br">
            {component.problemSolved}
          </p>
        </section>

        <section>
          <SectionHeader label="Interactions" color={lc.color} />
          <ul className="space-y-2">
            {component.interactions.map((item, i) => (
              <li key={i} className="flex gap-2.5 text-[12.5px] leading-relaxed text-k-tx">
                <span
                  className="flex-shrink-0 mt-1.5 w-1 h-1 rounded-full"
                  style={{ background: lc.color }}
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SectionHeader label="Explore in cluster" color={lc.color} />
          <div className="space-y-2.5">
            {component.explorationCommands.map((cmd, i) => (
              <div
                key={i}
                className="relative rounded-md overflow-hidden group"
                style={{
                  background: '#050810',
                  border: '1px solid var(--c-bd)',
                }}
              >
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-k-bd">
                  <span className="font-mono text-[10px] text-k-tx-mut">$ shell</span>
                  <button
                    onClick={() => copyCommand(cmd, i)}
                    className="text-[10px] font-mono px-2 py-0.5 rounded transition-all"
                    style={{
                      color: copiedIndex === i ? lc.color : '#64748b',
                      background: copiedIndex === i ? `${lc.color}15` : 'transparent',
                    }}
                  >
                    {copiedIndex === i ? 'copied' : 'copy'}
                  </button>
                </div>
                <pre
                  className="text-[11.5px] font-code p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed text-k-green"
                >
                  {cmd}
                </pre>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-k-bd flex-shrink-0 flex items-center justify-between">
        <p className="font-mono text-[10px] text-k-tx-mut">
          esc · click canvas to close
        </p>
      </div>
    </div>
  )
}
