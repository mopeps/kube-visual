// A condensed bare-metal node: the cluster runs three masters and three
// workers, but only one of each is drawn in full — these slim cards stand in
// for the identical siblings, giving overlays and flows a real per-node DOM
// anchor (id) without duplicating every inner component's id. Clicking one
// opens a small popup explaining the replica story (owned by OverviewTab).
export default function ReplicaNodeCard({ id, title, color, isDimmed, onClick }) {
  return (
    <div
      id={id}
      role="button"
      tabIndex={0}
      aria-label={`${title} — identical replica node`}
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          onClick?.()
        }
      }}
      className={`node replica-node ${isDimmed ? 'is-dimmed' : ''}`}
      style={{ '--node-accent': color }}
    >
      <span className="node-type-prefix" style={{ color: 'var(--tx-muted)' }}>[BareMetal]</span>
      <div className="node-title" style={{ color }}>{title}</div>
      <div className="node-subtitle">same stack, condensed</div>
    </div>
  )
}
