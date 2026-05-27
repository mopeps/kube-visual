import componentsData from '../data/components.json'
import { COMPONENT_COLOR, COMPONENT_ZONE } from '../data/zones'

// Map each component to a representative K8s "kind" + linux primitive cell.
const KIND = {
  'external-client':         'n/a (off-cluster)',
  'ingress-router-haproxy':  'Deployment · openshift-ingress',
  'api-server':              'Deployment · openshift-kube-apiserver',
  'scheduler':               'Deployment · openshift-kube-scheduler',
  'kubelet':                 'systemd unit · node-local',
  'crio':                    'systemd unit · node-local',
  'ovs-bridge-br-int':       'OVS bridge · host root netns',
  'host-veth-pair':          'veth · host root netns',
  'pod-netns':               'Linux namespace · per-Pod',
  'pod-cgroups':             'cgroup v2 slice · per-Pod',
  'container-process':       'Linux process · PID 1 in netns',
}

const PRIMITIVE = {
  'external-client':         'TCP socket (libc)',
  'ingress-router-haproxy':  'HAProxy process + iptables NAT',
  'api-server':              'Pod → kube-apiserver binary',
  'scheduler':               'Pod → kube-scheduler binary',
  'kubelet':                 'kubelet process + CRI gRPC',
  'crio':                    'crio-runc → namespaces & cgroups',
  'ovs-bridge-br-int':       'ovs-vswitchd + openflow rules',
  'host-veth-pair':          'CONFIG_VETH — kernel pair',
  'pod-netns':               'unshare(CLONE_NEWNET)',
  'pod-cgroups':             '/sys/fs/cgroup/...',
  'container-process':       'execve() under PID 1',
}

export default function ObjectMapTab() {
  return (
    <div>
      <div className="mb-5">
        <div className="font-display text-[1.35rem] font-semibold mb-1">
          K8s Object Map
        </div>
        <p className="text-[0.78rem]" style={{ color: 'var(--tx-muted)' }}>
          Every component on the diagram, mapped to its Kubernetes / OpenShift
          representation and the Linux primitive that backs it on the node.
        </p>
      </div>
      <div className="overflow-x-auto border border-border-w rounded-lg">
        <table className="object-table">
          <thead>
            <tr>
              <th>Component</th>
              <th>Layer</th>
              <th>K8s kind / runtime form</th>
              <th>Linux primitive</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {componentsData.map(c => {
              const zone = COMPONENT_ZONE[c.componentId]
              const color = COMPONENT_COLOR[c.componentId] || 'var(--tx)'
              return (
                <tr key={c.componentId}>
                  <td>
                    <span style={{ color, fontWeight: 600 }}>
                      {c.displayName}
                    </span>
                  </td>
                  <td>
                    <span
                      className="node-badge"
                      style={{
                        color,
                        borderColor: `${color}55`,
                        background: `${color}1a`,
                      }}
                    >
                      {zone?.label || c.layer}
                    </span>
                  </td>
                  <td style={{ color: 'var(--tx)' }}>
                    {KIND[c.componentId] || '—'}
                  </td>
                  <td style={{ color: 'var(--k-amber)' }}>
                    {PRIMITIVE[c.componentId] || '—'}
                  </td>
                  <td style={{ color: 'var(--tx-muted)' }}>
                    {c.problemSolved.split('. ')[0]}.
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
