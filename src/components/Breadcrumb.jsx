export default function Breadcrumb({ expandedPods }) {
  const parts = ['Cluster', 'Node-01']
  if (expandedPods.size > 0) {
    parts.push('Project: app')
    parts.push('Pod: web')
    if (expandedPods.has('app-pod')) {
      parts.push('Linux NetNS')
    }
  }

  if (parts.length <= 2) return null

  return (
    <nav className="px-4 py-1.5 bg-k-bg2 border-b border-white/10 flex items-center gap-1 text-[0.65rem] text-white/45 overflow-x-auto whitespace-nowrap">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-white/20">›</span>}
          <span className={i === parts.length - 1 ? 'text-k-cyan font-display font-semibold' : ''}>
            {part}
          </span>
        </span>
      ))}
    </nav>
  )
}
