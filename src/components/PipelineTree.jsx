import { PIPELINE_LAYER_BY_ID } from '../data/pipeline-layers'

// The universal host-daemon narrative. Kubelet → CRI-O is the same translation
// path for every Pod, so it lives here as explanatory UI text rather than in
// per-component data (mirroring how primitives.js carries fixed descriptions).
const TRANSLATION_ENGINE = [
  {
    label: '[systemd Service] Kubelet',
    bullets: [
      'Listens to the Guest API Server for Pod assignment',
      'Creates local dir: /var/lib/kubelet/pods/',
      'Resolves Secrets / ConfigMaps into RAM files',
      'Executes storage-plugin mount commands',
    ],
  },
  {
    label: '[systemd Service] CRI-O',
    bullets: [
      'Receives low-level container runtime requests',
      'Issues native Linux kernel syscalls: clone(), unshare(), setns()',
    ],
  },
]

// A single labeled box inside a band: "[Kind] name  ➔ note".
function TreeNode({ text, note, color, children }) {
  return (
    <div className="pipeline-node" style={{ borderColor: `${color}` }}>
      <div className="pipeline-node-label">
        <span style={{ color }}>{text}</span>
        {note && <span className="pipeline-node-note"> ➔ {note}</span>}
      </div>
      {children}
    </div>
  )
}

function Band({ layerId, children }) {
  const layer = PIPELINE_LAYER_BY_ID[layerId]
  const color = `var(${layer.colorVar})`
  return (
    <div className="pipeline-band" style={{ '--band': color }}>
      <div className="pipeline-band-header" style={{ color }}>
        <span className="pipeline-band-order">{layer.order}</span>
        <span className="pipeline-band-icon" aria-hidden="true">{layer.icon}</span>
        <span className="pipeline-band-title">{layer.label}</span>
      </div>
      <div className="pipeline-band-body">{children}</div>
    </div>
  )
}

// Vertical spine + downward arrow drawn purely in CSS between bands.
function Connector({ color }) {
  return <div className="pipeline-connector" style={{ '--band': color }} aria-hidden="true" />
}

export default function PipelineTree({ component }) {
  const { ancestry, consumedResources, kernelRealization } = component
  const hasAny = ancestry || consumedResources?.length || kernelRealization
  if (!hasAny) return null

  const cyan = 'var(--k-cyan)'
  const sky = 'var(--k-sky)'
  const amber = 'var(--k-amber)'
  const purple = 'var(--k-purple)'
  const green = 'var(--k-green)'

  const podName = component.ancestry?.podName || component.displayName

  return (
    <div className="pipeline-tree">
      {ancestry && (
        <>
          <Band layerId="logical-intent">
            {ancestry.deployment && (
              <TreeNode
                text={`[Deployment] ${ancestry.deployment}`}
                note="Defines replicas, strategies, and template"
                color={cyan}
              />
            )}
            {ancestry.replicaSet && (
              <TreeNode
                text={`[ReplicaSet] ${ancestry.replicaSet}`}
                note="Stamps out unique pod hashes"
                color={cyan}
              />
            )}
          </Band>
          <Connector color={cyan} />
        </>
      )}

      <Band layerId="api-boundary">
        <div className="pipeline-row">
          <div className="pipeline-row-main">
            <TreeNode
              text={`[${component.typePrefix || 'Pod'}] ${podName}`}
              note="Schedulable API object — the contract handed to the node"
              color={sky}
            />
          </div>

          {consumedResources?.length > 0 && (
            <div className="pipeline-consumed">
              <div className="pipeline-consumed-header" style={{ color: purple }}>
                ◄── Consumed Resources (API Objects)
              </div>
              {consumedResources.map((r, i) => (
                <div key={i} className="pipeline-consumed-item" style={{ borderColor: `${purple}55` }}>
                  <div className="pipeline-node-label">
                    <span style={{ color: purple }}>{r.apiObject}</span>
                  </div>
                  {r.linkedObject && (
                    <div className="pipeline-consumed-sub" style={{ color: 'var(--tx-muted)' }}>
                      └── {r.linkedObject}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Band>
      <Connector color={sky} />

      <Band layerId="translation-engine">
        {TRANSLATION_ENGINE.map((d, i) => (
          <TreeNode key={i} text={d.label} color={amber}>
            <ul className="pipeline-bullets">
              {d.bullets.map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
          </TreeNode>
        ))}
        <div className="pipeline-socket" style={{ color: 'var(--tx-muted)' }}>
          ───► Talks via Unix Domain Socket (/var/run/crio/crio.sock)
        </div>
      </Band>
      <Connector color={amber} />

      <Band layerId="linux-primitive">
        {kernelRealization && (
          <div className="pipeline-subgroup">
            <div className="pipeline-subgroup-title" style={{ color: green }}>
              🧬 Isolation Boundaries (Processes)
            </div>
            {kernelRealization.cgroupPath && (
              <TreeNode
                text={`[cgroup v2] ${kernelRealization.cgroupPath}`}
                note="Throttles CPU / RAM limits"
                color={green}
              />
            )}
            {kernelRealization.networkNamespace && (
              <TreeNode
                text={`[netns] ${kernelRealization.networkNamespace}`}
                note="Isolates network sockets"
                color={green}
              />
            )}
            {kernelRealization.mountNamespace && (
              <TreeNode
                text={`[mount ns] ${kernelRealization.mountNamespace}`}
                note="Container's isolated VFS"
                color={green}
              />
            )}
          </div>
        )}

        {consumedResources?.length > 0 && (
          <div className="pipeline-subgroup">
            <div className="pipeline-subgroup-title" style={{ color: green }}>
              📁 Storage &amp; Config Injections (The File Footprint)
            </div>
            {consumedResources.map((r, i) => (
              <TreeNode
                key={i}
                text={`${r.linuxPrimitive} ${r.hostPath}`}
                note={r.apiObject}
                color={green}
              />
            ))}
          </div>
        )}
      </Band>
    </div>
  )
}
