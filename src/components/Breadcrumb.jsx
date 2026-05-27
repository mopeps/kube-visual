export default function Breadcrumb({ expandedPods }) {
  const parts = ['cluster-01', 'node-01']
  if (expandedPods.size > 0) {
    parts.push('ns:app')
    parts.push('pod:web')
    if (expandedPods.has('app-pod')) {
      parts.push('kernel')
    }
  }

  if (parts.length <= 2) return null

  return (
    <nav
      className="px-4 py-1.5 flex items-center gap-1.5 text-[11px] font-mono overflow-x-auto whitespace-nowrap border-b border-k-bd"
      style={{ background: 'rgba(7, 11, 20, 0.4)' }}
    >
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-k-tx-dim">/</span>}
          <span className={i === parts.length - 1 ? 'text-k-cyan' : 'text-k-tx-mut'}>
            {part}
          </span>
        </span>
      ))}
    </nav>
  )
}
