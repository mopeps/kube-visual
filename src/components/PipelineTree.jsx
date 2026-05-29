import { useState } from 'react'
import { PIPELINE_LAYER_BY_ID } from '../data/pipeline-layers'

const PURPLE = 'var(--k-purple)'

// Short human label for a consumed resource's underlying kernel primitive.
function primitiveNote(p) {
  if (/tmpfs/i.test(p)) return 'tmpfs RAM-disk mount · volatile'
  if (/kernel mount/i.test(p)) return 'XFS/Ext4 block-device mount'
  return 'host-backed mount'
}

// Compose the monospace gutter for a node: one cell per ancestor (spine or gap)
// plus this node's branch glyph. Produces a true ASCII tree.
function gutter(ancestorsLast, isLast) {
  let s = ''
  for (const last of ancestorsLast) s += last ? '   ' : '│  '
  return s + (isLast ? '└─ ' : '├─ ')
}

// Flatten a node spec tree (DFS) into ordered rows carrying their gutter prefix.
function flatten(node, ancestorsLast, isLast, out) {
  out.push({ node, prefix: gutter(ancestorsLast, isLast) })
  const kids = node.children || []
  kids.forEach((k, i) => flatten(k, [...ancestorsLast, isLast], i === kids.length - 1, out))
}

function RowDetail({ detail }) {
  return (
    <div className="tree-detail">
      {detail.bullets?.map((b, i) => (
        <div key={`b${i}`} className="tree-detail-bullet">• {b}</div>
      ))}
      {detail.kv?.map((p, i) => (
        <div key={`k${i}`} className="tree-detail-kv">
          <span className="tree-detail-k">{p.k}</span>
          <span className="tree-detail-v">{p.v}</span>
        </div>
      ))}
      {detail.lines?.map((l, i) => (
        <div key={`l${i}`} className="tree-detail-line">{l}</div>
      ))}
    </div>
  )
}

function Row({ row, bandColor }) {
  const [open, setOpen] = useState(false)
  const { node, prefix } = row
  const color = node.color || bandColor
  const hasDetail = !!node.detail
  return (
    <div className="tree-row">
      <span className="tree-gutter">{prefix}</span>
      <div className="tree-body">
        <button
          type="button"
          className="tree-row-head"
          onClick={hasDetail ? () => setOpen(o => !o) : undefined}
          aria-expanded={hasDetail ? open : undefined}
          style={{ color, cursor: hasDetail ? 'pointer' : 'default' }}
        >
          <span className="tree-label">{node.label}</span>
          {hasDetail && <span className="tree-toggle">{open ? '⊟' : '⊕'}</span>}
        </button>
        {node.note && <div className="tree-note">{'➔'} {node.note}</div>}
        {hasDetail && open && <RowDetail detail={node.detail} />}
      </div>
    </div>
  )
}

function Band({ layerId, groups, last }) {
  const layer = PIPELINE_LAYER_BY_ID[layerId]
  const color = `var(${layer.colorVar})`
  return (
    <div className="tree-band">
      <div className="tree-band-head" style={{ color }}>
        <span className="tree-band-num" style={{ borderColor: color }}>{layer.order}</span>
        <span className="tree-band-icon" aria-hidden="true">{layer.icon}</span>
        <span className="tree-band-title">{layer.label}</span>
      </div>
      {groups.map((g, gi) => {
        const rows = []
        g.nodes.forEach((n, i) => flatten(n, [], i === g.nodes.length - 1, rows))
        return (
          <div className="tree-group" key={gi}>
            {g.subhead && <div className="tree-subhead" style={{ color }}>{g.subhead}</div>}
            {rows.map((r, i) => <Row key={i} row={r} bandColor={color} />)}
          </div>
        )
      })}
      {!last && <div className="tree-connector" style={{ color }}>{'▼'}</div>}
    </div>
  )
}

export default function PipelineTree({ component }) {
  const { ancestry, consumedResources, kernelRealization } = component
  const cr = consumedResources || []
  const hasAny = ancestry || cr.length || kernelRealization
  if (!hasAny) return null

  const bands = []

  if (ancestry) {
    bands.push({
      layerId: 'logical-intent',
      groups: [{
        nodes: [
          ancestry.deployment && {
            label: `[Deployment] ${ancestry.deployment}`,
            note: 'defines replicas, strategy & pod template',
          },
          ancestry.replicaSet && {
            label: `[ReplicaSet] ${ancestry.replicaSet}`,
            note: 'stamps out unique pod-hash replicas',
          },
        ].filter(Boolean),
      }],
    })
  }

  const podName = ancestry?.podName || component.displayName
  bands.push({
    layerId: 'api-boundary',
    groups: [{
      nodes: [{
        label: `[${component.typePrefix || 'Pod'}] ${podName}`,
        note: 'schedulable API object handed to the node',
        children: cr.map(r => ({
          color: PURPLE,
          label: r.apiObject,
          note: primitiveNote(r.linuxPrimitive),
          detail: {
            kv: [
              { k: 'host', v: r.hostPath },
              ...(r.linkedObject ? [{ k: 'backed by', v: r.linkedObject }] : []),
            ],
          },
        })),
      }],
    }],
  })

  bands.push({
    layerId: 'translation-engine',
    groups: [{
      nodes: [
        {
          label: '[systemd] Kubelet',
          note: 'resolves the Pod spec into on-disk state',
          detail: {
            bullets: [
              'Listens to the Guest API Server for Pod assignment',
              'Creates local dir /var/lib/kubelet/pods/',
              'Resolves Secrets / ConfigMaps into RAM files',
              'Executes storage-plugin mount commands',
            ],
          },
        },
        {
          label: '[systemd] CRI-O',
          note: 'issues the kernel syscalls that build the sandbox',
          detail: {
            bullets: [
              'Receives low-level container runtime requests',
              'Issues clone() / unshare() / setns() syscalls',
            ],
            lines: ['via Unix socket /var/run/crio/crio.sock'],
          },
        },
      ],
    }],
  })

  if (kernelRealization || cr.length) {
    const groups = []
    if (kernelRealization) {
      groups.push({
        subhead: '🧬 Isolation Boundaries',
        nodes: [
          kernelRealization.cgroupPath && {
            label: `[cgroup v2] ${kernelRealization.cgroupPath}`,
            note: 'throttles CPU / RAM limits',
          },
          kernelRealization.networkNamespace && {
            label: `[netns] ${kernelRealization.networkNamespace}`,
            note: 'isolates network sockets',
          },
          kernelRealization.mountNamespace && {
            label: `[mount ns] ${kernelRealization.mountNamespace}`,
            note: 'container-private VFS',
          },
        ].filter(Boolean),
      })
    }
    if (cr.length) {
      groups.push({
        subhead: '📁 File Footprint',
        nodes: cr.map(r => ({
          label: `${r.linuxPrimitive} ${r.hostPath}`,
          note: r.apiObject,
        })),
      })
    }
    bands.push({ layerId: 'linux-primitive', groups })
  }

  return (
    <div className="pipeline-tree">
      {bands.map((b, i) => (
        <Band key={b.layerId} layerId={b.layerId} groups={b.groups} last={i === bands.length - 1} />
      ))}
    </div>
  )
}
