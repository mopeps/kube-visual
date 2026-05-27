import { useState } from 'react'
import componentsData from '../data/components.json'

const layerAccent = {
  'External':                 { color: '#00e5ff', bg: 'rgba(0,229,255,0.12)' },
  'Management Layer':         { color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
  'Host Networking Subsystem':{ color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  'Linux Kernel Primitives':  { color: '#10b981', bg: 'rgba(16,185,129,0.18)' },
}

export default function InspectorPanel({ componentId, onClose }) {
  const [copiedIndex, setCopiedIndex] = useState(null)
  const component = componentsData.find(c => c.componentId === componentId)

  if (!component) return null

  const accent = layerAccent[component.layer] ?? { color: '#fff', bg: 'rgba(255,255,255,0.08)' }

  const copyCommand = (text, index) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    })
  }

  return (
    <div className="fixed lg:absolute top-0 right-0 h-full w-full sm:w-80 bg-k-bg2 border-l border-white/10 flex flex-col shadow-2xl animate-slide-in z-50 overflow-hidden">
      {/* Banner */}
      <div
        className="px-4 py-3 flex items-start justify-between gap-2 border-b border-white/10"
        style={{ background: accent.bg }}
      >
        <div>
          <p className="text-[0.6rem] font-mono font-semibold uppercase tracking-[0.15em]" style={{ color: accent.color, opacity: 0.7 }}>
            {component.layer}
          </p>
          <h2 className="text-sm font-display font-bold text-white mt-0.5">{component.displayName}</h2>
        </div>
        <button
          onClick={onClose}
          className="mt-0.5 w-7 h-7 flex items-center justify-center rounded border border-white/20 text-white/55 hover:text-white flex-shrink-0 transition-colors"
          aria-label="Close inspector"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <section>
          <h3 className="text-[0.6rem] font-mono font-semibold text-white/45 uppercase tracking-[0.15em] mb-2 pb-1.5 border-b border-white/7">
            Problem Solved
          </h3>
          <p className="text-[0.72rem] text-white/75 leading-relaxed">{component.problemSolved}</p>
        </section>

        <section>
          <h3 className="text-[0.6rem] font-mono font-semibold text-white/45 uppercase tracking-[0.15em] mb-2 pb-1.5 border-b border-white/7">
            Interactions
          </h3>
          <ul className="space-y-1.5">
            {component.interactions.map((item, i) => (
              <li key={i} className="flex gap-2 text-[0.72rem] text-white/75 leading-relaxed">
                <span className="flex-shrink-0 mt-0.5" style={{ color: accent.color }}>▸</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-[0.6rem] font-mono font-semibold text-white/45 uppercase tracking-[0.15em] mb-2 pb-1.5 border-b border-white/7">
            Terminal Exploration
          </h3>
          <div className="space-y-3">
            {component.explorationCommands.map((cmd, i) => (
              <div key={i} className="relative rounded border border-white/10 bg-black/40">
                <pre className="text-[0.65rem] p-3 pr-16 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed" style={{ color: '#a8ff78' }}>
                  {cmd}
                </pre>
                <button
                  onClick={() => copyCommand(cmd, i)}
                  className="absolute top-2 right-2 text-[0.6rem] px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-white/55 hover:text-white transition-colors border border-white/10"
                >
                  {copiedIndex === i ? 'Copied!' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
