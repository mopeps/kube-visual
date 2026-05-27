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
    <nav className="px-4 py-1.5 bg-gray-800 border-b border-gray-700 flex items-center gap-1 text-xs text-gray-400 overflow-x-auto whitespace-nowrap">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-gray-600">➔</span>}
          <span className={i === parts.length - 1 ? 'text-blue-300 font-medium' : ''}>{part}</span>
        </span>
      ))}
    </nav>
  )
}
