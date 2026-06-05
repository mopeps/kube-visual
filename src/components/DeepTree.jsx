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

function TreeNode({ node }) {
  const meta = node.kind ? KIND[node.kind] : null
  return (
    <li className="deep-tree-node">
      <div className="deep-tree-row">
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
          {node.children.map((c, i) => <TreeNode key={i} node={c} />)}
        </ul>
      )}
    </li>
  )
}

export default function DeepTree({ tree, accent = 'var(--k-cyan)' }) {
  if (!tree?.nodes?.length) return null
  return (
    <div
      className="deep-tree"
      style={{ '--tree-guide': `color-mix(in srgb, ${accent} 38%, transparent)` }}
    >
      {tree.caption && (
        <div className="deep-tree-caption" style={{ color: accent }}>{tree.caption}</div>
      )}
      <ul className="deep-tree-list">
        {tree.nodes.map((n, i) => <TreeNode key={i} node={n} />)}
      </ul>
      {tree.legend?.length > 0 && (
        <div className="deep-tree-legend">
          {tree.legend.map((l, i) => {
            const meta = KIND[l.kind]
            return (
              <span key={l.kind ?? `item-${i}`} className="deep-tree-legend-item">
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
