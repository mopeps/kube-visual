import { useState } from 'react'
import componentsData from '../data/components.json'

const layerConfig = {
  'External':                  { color: '#22d3ee', tag: 'EXT' },
  'Management Layer':          { color: '#38bdf8', tag: 'MGMT' },
  'Host Networking Subsystem': { color: '#34d399', tag: 'HOST' },
  'Linux Kernel Primitives':   { color: '#34d399', tag: 'KERN' },
}

function SectionHeader({ label, color }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="font-display text-sm tracking-widest" style={{ color }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: `${color}25` }} />
    </div>
  )
}

export default function InspectorPanel({ componentId, onClose }) {
  const [copiedIndex, setCopiedIndex] = useState(null)
  const component = componentsData.find(c => c.componentId === componentId)

  if (!component) return null

  const lc = layerConfig[component.layer] ?? { color: '#9abcd8', tag: 'SYS' }

  const copyCommand = (text, index) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    })
  }

  return (
    <div
      className="fixed lg:absolute top-0 right-0 h-full w-full sm:w-80 flex flex-col animate-slide-in z-50 overflow-hidden"
      style={{ background: '#070b14', borderLeft: '1px solid #192540' }}
    >
      {/* Banner */}
      <div
        className="px-4 pt-4 pb-3 flex items-start justify-between gap-2 border-b flex-shrink-0"
        style={{ borderColor: '#192540', borderBottom: `1px solid ${lc.color}30` }}
      >
        <div className="min-w-0">
          {/* Layer tag */}
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="font-mono text-[0.5rem] tracking-[0.18em] px-1.5 py-0.5 border"
              style={{
                color: lc.color,
                borderColor: `${lc.color}50`,
                background: `${lc.color}0f`,
              }}
            >
              {lc.tag}
            </span>
            <span className="font-mono text-[0.5rem] tracking-[0.12em]" style={{ color: '#2e4a70' }}>
              {component.layer.toUpperCase()}
            </span>
          </div>
          <h2 className="font-display text-xl tracking-wider leading-tight" style={{ color: lc.color }}>
            {component.displayName.toUpperCase()}
          </h2>
          <p className="font-mono text-[0.55rem] mt-0.5" style={{ color: '#2e4a70' }}>
            ID: {component.componentId}
          </p>
        </div>
        <button
          onClick={onClose}
          className="mt-0.5 w-6 h-6 flex-shrink-0 flex items-center justify-center border font-mono text-xs transition-colors"
          style={{ borderColor: '#1f3054', color: '#456688' }}
          aria-label="Close inspector"
        >
          ✕
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Problem solved */}
        <section>
          <SectionHeader label="PROBLEM_SOLVED" color={lc.color} />
          <p className="text-[0.68rem] font-mono leading-relaxed" style={{ color: '#6c92b4' }}>
            {component.problemSolved}
          </p>
        </section>

        {/* Interactions */}
        <section>
          <SectionHeader label="INTERACTIONS" color={lc.color} />
          <ul className="space-y-1.5">
            {component.interactions.map((item, i) => (
              <li key={i} className="flex gap-2 text-[0.68rem] font-mono leading-relaxed" style={{ color: '#6c92b4' }}>
                <span className="flex-shrink-0 mt-0.5 font-bold" style={{ color: lc.color }}>›</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Terminal exploration */}
        <section>
          <SectionHeader label="EXPLORATION" color={lc.color} />
          <div className="space-y-2.5">
            {component.explorationCommands.map((cmd, i) => (
              <div
                key={i}
                className="relative border overflow-hidden"
                style={{ borderColor: '#192540', background: '#050810' }}
              >
                {/* Code line numbers + content */}
                <pre
                  className="text-[0.62rem] font-code p-3 pr-14 overflow-x-auto whitespace-pre-wrap leading-relaxed"
                  style={{ color: '#34d399' }}
                >
                  {cmd}
                </pre>
                <button
                  onClick={() => copyCommand(cmd, i)}
                  className="absolute top-2 right-2 text-[0.5rem] font-mono px-1.5 py-0.5 border transition-all duration-150"
                  style={{
                    borderColor: copiedIndex === i ? lc.color : '#192540',
                    color: copiedIndex === i ? lc.color : '#2e4a70',
                    background: copiedIndex === i ? `${lc.color}10` : 'transparent',
                  }}
                >
                  {copiedIndex === i ? 'COPIED' : 'COPY'}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2 border-t flex-shrink-0"
        style={{ borderColor: '#192540' }}
      >
        <p className="font-mono text-[0.5rem] tracking-widest uppercase" style={{ color: '#1f3054' }}>
          CLICK CANVAS TO DISMISS
        </p>
      </div>
    </div>
  )
}
