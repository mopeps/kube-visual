export default function Breadcrumb({ expandedPods }) {
  // Always visible — shell prompt is the constant of a terminal.
  const segs = [
    { label: 'cluster-01', color: 'text-k-blue' },
    { label: 'node-01',    color: 'text-k-sapphire' },
  ]
  if (expandedPods.size > 0) {
    segs.push({ label: 'ns:app', color: 'text-k-mauve' })
    segs.push({ label: 'pod:web', color: 'text-k-mauve' })
    if (expandedPods.has('app-pod')) {
      segs.push({ label: 'kernel', color: 'text-k-green' })
    }
  }

  return (
    <nav
      className="px-3 py-1 flex items-center gap-1.5 text-[11px] font-mono whitespace-nowrap overflow-x-auto border-b border-k-bd"
      style={{ background: 'var(--c-crust)' }}
    >
      <span className="text-k-green font-bold">user</span>
      <span className="text-k-tx-dim">@</span>
      <span className="text-k-teal font-bold">cluster-01</span>
      <span className="text-k-tx-dim">:</span>
      <span className="text-k-blue">~</span>
      {segs.map((s, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="text-k-tx-dim">/</span>
          <span className={`${s.color}`}>{s.label}</span>
        </span>
      ))}
      <span className="text-k-peach ml-1">$</span>
      <span className="text-k-tx-mut ml-1 truncate">
        kvis inspect --interactive
      </span>
      <span className="caret text-k-tx-wh" aria-hidden="true" />
    </nav>
  )
}
