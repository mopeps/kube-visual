import { useState } from 'react'
import componentsData from '../data/components.json'

const layerColors = {
  'External': 'bg-gray-600',
  'Management Layer': 'bg-purple-700',
  'Host Networking Subsystem': 'bg-green-800',
  'Linux Kernel Primitives': 'bg-emerald-800',
}

export default function InspectorPanel({ componentId, onClose }) {
  const [copiedIndex, setCopiedIndex] = useState(null)
  const component = componentsData.find(c => c.componentId === componentId)

  if (!component) return null

  const bannerColor = layerColors[component.layer] ?? 'bg-gray-700'

  const copyCommand = (text, index) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    })
  }

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-gray-900 border-l border-gray-700 flex flex-col shadow-2xl animate-slide-in z-50 overflow-hidden">
      <div className={`px-4 py-3 ${bannerColor} flex items-start justify-between gap-2`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70">{component.layer}</p>
          <h2 className="text-sm font-bold text-white mt-0.5">{component.displayName}</h2>
        </div>
        <button
          onClick={onClose}
          className="mt-0.5 text-white/70 hover:text-white text-lg leading-none flex-shrink-0"
          aria-label="Close inspector"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Problem Solved</h3>
          <p className="text-sm text-gray-300 leading-relaxed">{component.problemSolved}</p>
        </section>

        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Interactions</h3>
          <ul className="space-y-1">
            {component.interactions.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-300">
                <span className="text-blue-400 flex-shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Terminal Exploration</h3>
          <div className="space-y-3">
            {component.explorationCommands.map((cmd, i) => (
              <div key={i} className="relative bg-gray-950 rounded border border-gray-700">
                <pre className="text-xs text-green-300 p-3 pr-16 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">{cmd}</pre>
                <button
                  onClick={() => copyCommand(cmd, i)}
                  className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
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
