// A compact row of relationship chips: each names how this interface connects to
// a peer component (mechanism → peer) and opens the link's detail on tap. Shared
// by both lenses — docked AT an interface sub-box (a port / socket / daemon)
// inside an opened component, replacing the old floating "connects" strip. The
// wire itself (ReconLoopOverlay) already terminates on the same interface, so the
// chip sits where the line lands.
export default function ConnectionChips({ connections, onSelectConnection, lead, className }) {
  if (!connections?.length) return null
  return (
    <div className={`box-connections ${className || ''}`}>
      {lead && <span className="box-connections-lead">{lead}</span>}
      {connections.map((c) => (
        <button
          key={c.id}
          type="button"
          className="box-conn-chip"
          style={{ '--edge-color': `var(--${c.accentVar})` }}
          onClick={(e) => { e.stopPropagation(); onSelectConnection?.(c.edge, c.peerId) }}
          title={`${c.outgoing ? 'to' : 'from'} ${c.peerTitle} — over ${c.mechanism}`}
        >
          <span className="box-conn-mech">{c.mechanism}</span>
          <span className="box-conn-dir" aria-hidden>{c.outgoing ? '→' : '←'}</span>
          <span className="box-conn-peer">{c.peerTitle}</span>
        </button>
      ))}
    </div>
  )
}
