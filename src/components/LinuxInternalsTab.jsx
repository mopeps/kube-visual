import componentsData from '../data/components.json'
import { COMPONENT_COLOR } from '../data/zones'

// Show kernel-adjacent layers: KVM/VMI, host OS services, and Linux kernel primitives.
const LINUX_LAYERS = ['KubeVirt', 'Management Worker Node', 'Guest Worker Node', 'Linux Kernel Primitives']

const ICONS = {
  'kubevirt-launcher':           '🖥️',
  'guest-worker-node-vm':        '⚡',
  'kubelet-host':                '🛰️',
  'crio-host':                   '📦',
  'ovs-host':                    '🌐',
  'ovn-node-host':               '🔀',
  'kubelet-guest':               '🛰️',
  'crio-guest':                  '📦',
  'ovs-guest':                   '🌐',
  'ovn-node-guest':              '🔀',
  'konnectivity-agent':          '🔗',
  'coredns-node':                '📡',
  'openshift-ingress-router-guest': '🚦',
  'frontend-workload-pod':       '🌍',
  'backend-workload-pod':        '⚙️',
  'pod-netns':                   '🧭',
  'pod-cgroups':                 '🧮',
  'container-process':           '▣',
}

function LayerCard({ component }) {
  const color = COMPONENT_COLOR[component.componentId] || 'var(--k-green)'
  const icon = ICONS[component.componentId] || '▣'

  return (
    <div className="layer-card" style={{ borderColor: `${color}40` }}>
      <div
        className="layer-card-header"
        style={{ color, background: `${color}14` }}
      >
        <span style={{ fontSize: '1.1rem' }}>{icon}</span>
        <span>
          {component.typePrefix && (
            <span style={{ fontSize: '0.55rem', opacity: 0.6, marginRight: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              [{component.typePrefix}]
            </span>
          )}
          {component.displayName}
        </span>
      </div>
      <div className="layer-card-body">
        <p>{component.problemSolved}</p>
        {component.explorationCommands?.[0] && (
          <pre className="code-block">{component.explorationCommands[0]}</pre>
        )}
      </div>
    </div>
  )
}

export default function LinuxInternalsTab() {
  const items = componentsData.filter(c => LINUX_LAYERS.includes(c.layer))

  return (
    <div>
      <div className="mb-5">
        <div className="font-display text-[1.35rem] font-semibold mb-1">
          Linux / KVM Internals
        </div>
        <p className="text-[0.78rem]" style={{ color: 'var(--tx-muted)' }}>
          The KubeVirt, host OS, and Linux kernel primitives backing the Guest Worker Node —
          one card per concept, with a starter command to inspect it live.
        </p>
      </div>
      <div
        className="grid gap-5"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        }}
      >
        {items.map(c => <LayerCard key={c.componentId} component={c} />)}
      </div>
    </div>
  )
}
