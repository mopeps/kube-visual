import componentsData from '../data/components.json'
import { COMPONENT_COLOR, COMPONENT_ZONE } from '../data/zones'

const KIND = {
  'external-client':                 'n/a (off-cluster)',
  'hypershift-operator':             'Deployment · hypershift',
  'cluster-version-operator':        'Deployment · <hcp-namespace>',
  'guest-api-server':                'Deployment · <hcp-namespace>',
  'guest-oauth-server':              'Deployment · <hcp-namespace>',
  'guest-controller-manager':        'Deployment · <hcp-namespace>',
  'guest-kube-scheduler':            'Deployment · <hcp-namespace>',
  'etcd-static-pod':                 'StatefulSet · <hcp-namespace>',
  'shared-ingress-proxy':            'Deployment · openshift-ingress',
  'ovn-master-control':              'Deployment · openshift-ovn-kubernetes',
  'cloud-controller-manager':        'Deployment · <hcp-namespace>',
  'konnectivity-server':             'Deployment · <hcp-namespace>',
  'ignition-server':                 'Deployment · <hcp-namespace>',
  'guest-coredns':                   'Deployment · openshift-dns',
  'cluster-monitoring':              'Deployment · openshift-monitoring',
  'kubelet-host':                    'systemd unit · management worker node',
  'crio-host':                       'systemd unit · management worker node',
  'ovs-host':                        'systemd unit · management worker node',
  'ovn-node-host':                   'DaemonSet · openshift-ovn-kubernetes',
  'kubevirt-launcher':               'Pod (virt-launcher) · <hcp-namespace>',
  'guest-worker-node-vm':            'VirtualMachineInstance · <hcp-namespace>',
  'kubelet-guest':                   'systemd unit · guest worker node (in VM)',
  'crio-guest':                      'systemd unit · guest worker node (in VM)',
  'ovs-guest':                       'systemd unit · guest worker node (in VM)',
  'ovn-node-guest':                  'DaemonSet · openshift-ovn-kubernetes (in VM)',
  'konnectivity-agent':              'DaemonSet · kube-system (in VM)',
  'coredns-node':                    'DaemonSet · openshift-dns (in VM)',
  'openshift-ingress-router-guest':  'Deployment · openshift-ingress (in VM)',
  'frontend-workload-pod':           'Deployment · e-commerce-prod (in VM)',
  'backend-workload-pod':            'Deployment · e-commerce-prod (in VM)',
  'pod-netns':                       'Linux network namespace · per-Pod (in VM)',
  'pod-cgroups':                     'cgroup v2 slice · per-Pod (in VM)',
  'container-process':               'Linux process · PID 1 in netns (in VM)',
}

const PRIMITIVE = {
  'external-client':                 'TCP socket (libc)',
  'hypershift-operator':             'Pod → Go binary + controller-runtime',
  'cluster-version-operator':        'Pod → CVO binary',
  'guest-api-server':                'Pod → kube-apiserver binary',
  'guest-oauth-server':              'Pod → oauth-server binary',
  'guest-controller-manager':        'Pod → kube-controller-manager binary',
  'guest-kube-scheduler':            'Pod → kube-scheduler binary',
  'etcd-static-pod':                 'Pod → etcd binary + Raft log',
  'shared-ingress-proxy':            'Pod → HAProxy process',
  'ovn-master-control':              'Pod → ovnkube-master + OVN NB DB',
  'cloud-controller-manager':        'Pod → CCM binary + cloud API calls',
  'konnectivity-server':             'Pod → konnectivity-server + GRPC tunnel',
  'ignition-server':                 'Pod → Ignition HTTP server',
  'guest-coredns':                   'Pod → CoreDNS binary',
  'cluster-monitoring':              'Pod → Prometheus + Thanos',
  'kubelet-host':                    'systemd → kubelet binary + CRI gRPC',
  'crio-host':                       'systemd → crio + runc/crun OCI',
  'ovs-host':                        'systemd → ovs-vswitchd + OpenFlow',
  'ovn-node-host':                   'Pod → OVN controller + CNI plugin',
  'kubevirt-launcher':               'Pod → qemu-kvm process + tap0 NIC',
  'guest-worker-node-vm':            'KVM VM → RHCOS guest OS + virtio-net',
  'kubelet-guest':                   'systemd → kubelet binary (in VM)',
  'crio-guest':                      'systemd → crio + runc/crun (in VM)',
  'ovs-guest':                       'systemd → ovs-vswitchd (in VM)',
  'ovn-node-guest':                  'Pod → OVN controller (in VM)',
  'konnectivity-agent':              'Pod → konnectivity-agent + gRPC tunnel',
  'coredns-node':                    'Pod → CoreDNS binary (in VM)',
  'openshift-ingress-router-guest':  'Pod → HAProxy (in VM)',
  'frontend-workload-pod':           'Pod → app binary + network namespace',
  'backend-workload-pod':            'Pod → app binary + network namespace',
  'pod-netns':                       'unshare(CLONE_NEWNET) in VM kernel',
  'pod-cgroups':                     '/sys/fs/cgroup/... in VM kernel',
  'container-process':               'execve() under PID 1 in VM netns',
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
          representation and the Linux primitive that backs it.
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
                      {c.typePrefix && (
                        <span style={{ opacity: 0.55, fontWeight: 400, fontSize: '0.7em', marginRight: 4 }}>
                          [{c.typePrefix}]
                        </span>
                      )}
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
