export default function Breadcrumb({ expandedPods }) {
  const parts = ['CLUSTER-01', 'NODE-01']
  if (expandedPods.size > 0) {
    parts.push('NS:APP')
    parts.push('POD:WEB')
    if (expandedPods.has('app-pod')) {
      parts.push('KERNEL')
    }
  }

  if (parts.length <= 2) return null

  return (
    <nav
      className="px-3 py-1 flex items-center gap-1 text-[0.58rem] font-mono overflow-x-auto whitespace-nowrap border-b"
      style={{ borderColor: 'rgba(25,37,64,0.8)', background: 'rgba(7,11,20,0.6)' }}
    >
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && (
            <span style={{ color: 'rgba(46,74,112,1)' }}>›</span>
          )}
          <span style={{ color: i === parts.length - 1 ? '#22d3ee' : '#456688' }}>
            {part}
          </span>
        </span>
      ))}
    </nav>
  )
}
