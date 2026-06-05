// A styled, recursive tree for the deep-dive popups. Turns a nested node model
// into a real hierarchy with CSS-drawn guide lines — used to show things that
// are *inherently* trees (the cgroup v2 slice/service/scope hierarchy, the
// systemd target dependency graph) far more legibly than a raw ASCII <pre>.
//
//   tree = { caption?, nodes: [node], legend?: [{ kind, meaning }] }
//   node = { label, sub?, kind?, children?: [node] }
//
// `kind` drives the little type chip + accent colour. Unknown kinds render the
// label only, so the model stays forgiving.

const KIND = {
  root:    { accent: 'var(--k-cyan)',   tag: 'root' },
  slice:   { accent: 'var(--k-purple)', tag: 'slice' },
  service: { accent: 'var(--k-amber)',  tag: 'service' },
  scope:   { accent: 'var(--k-teal)',   tag: 'scope' },
  target:  { accent: 'var(--k-sky)',    tag: 'target' },
  socket:  { accent: 'var(--k-blue)',   tag: 'socket' },
  timer:   { accent: 'var(--k-blue)',   tag: 'timer' },
  mount:   { accent: 'var(--k-blue)',   tag: 'mount' },
  proc:    { accent: 'var(--k-green)',  tag: 'pid' },
}

// Under cgroups v2 every *directory* in the unified hierarchy is a cgroup —
// so the root, every slice, every service and every scope are all cgroups.
// Only PIDs (proc) are processes pinned *inside* a cgroup, not cgroups
// themselves. The ◆ marker makes that grouping visible on the tree.
const CGROUP_KINDS = new Set(['root', 'slice', 'service', 'scope'])

function TreeNode({ node, cgroupMarks }) {
  const meta = node.kind ? KIND[node.kind] : null
  const isCgroup = CGROUP_KINDS.has(node.kind)
  return (
    <li className="deep-tree-node">
      <div className="deep-tree-row">
        {cgroupMarks && (
          <span
            className={`deep-tree-cg${isCgroup ? '' : ' deep-tree-cg--off'}`}
            title={isCgroup ? 'a cgroup (a directory in /sys/fs/cgroup)' : 'a process — lives inside a cgroup, is not one'}
            aria-hidden="true"
          >
            ◆
          </span>
        )}
        {meta && (
          <span
            className="deep-tree-kind"
            style={{ color: meta.accent, borderColor: `color-mix(in srgb, ${meta.accent} 45%, transparent)` }}
          >
            {meta.tag}
          </span>
        )}
        <span className="deep-tree-label" style={meta ? { color: meta.accent } : undefined}>
          {node.label}
        </span>
        {node.sub && <span className="deep-tree-sub">{node.sub}</span>}
      </div>
      {node.children?.length > 0 && (
        <ul className="deep-tree-sub-list">
          {node.children.map((c, i) => <TreeNode key={i} node={c} cgroupMarks={cgroupMarks} />)}
        </ul>
      )}
    </li>
  )
}

export default function DeepTree({ tree, accent = 'var(--k-cyan)' }) {
  if (!tree?.nodes?.length) return null
  // Opt-in cgroup markers — only meaningful for the cgroup-v2 hierarchy, not
  // the target dependency tree (where the cgroup concept doesn't apply).
  const cgroupMarks = !!tree.cgroupMarks
  return (
    <div
      className="deep-tree"
      style={{ '--tree-guide': `color-mix(in srgb, ${accent} 38%, transparent)` }}
    >
      {tree.caption && (
        <div className="deep-tree-caption" style={{ color: accent }}>{tree.caption}</div>
      )}
      <ul className="deep-tree-list">
        {tree.nodes.map((n, i) => <TreeNode key={i} node={n} cgroupMarks={cgroupMarks} />)}
      </ul>
      {tree.legend?.length > 0 && (
        <div className="deep-tree-legend">
          {tree.legend.map((l, i) => {
            const meta = KIND[l.kind]
            return (
              <span key={l.kind ?? `marker-${i}`} className="deep-tree-legend-item">
                {l.marker && (
                  <span className={`deep-tree-cg${l.marker === 'proc' ? ' deep-tree-cg--off' : ''}`} aria-hidden="true">◆</span>
                )}
                {meta && (
                  <span
                    className="deep-tree-kind"
                    style={{ color: meta.accent, borderColor: `color-mix(in srgb, ${meta.accent} 45%, transparent)` }}
                  >
                    {meta.tag}
                  </span>
                )}
                {l.meaning}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
