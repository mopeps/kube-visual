import componentsData from '../data/components.json'
import { COMPONENT_COLOR, COMPONENT_ZONE } from '../data/zones'
import TypeIcon from './TypeIcon'

const KIND = {
  'external-client':                 'n/a (off-cluster)',
  'hypershift-operator':             'Deployment · hypershift',
  'hostedcluster-cr':                'CustomResource · clusters ns',
  'nodepool-cr':                     'CustomResource · clusters ns',
  'control-plane-operator':          'Deployment · <hcp-namespace>',
  'capi-manager':                    'Deployment · <hcp-namespace>',
  'capk-provider':                   'Deployment · <hcp-namespace>',
  'cluster-version-operator':        'Deployment · <hcp-namespace>',
  'guest-api-server':                'Deployment · <hcp-namespace>',
  'guest-oauth-server':              'Deployment · <hcp-namespace>',
  'guest-controller-manager':        'Deployment · <hcp-namespace>',
  'guest-kube-scheduler':            'Deployment · <hcp-namespace>',
  'guest-etcd':                      'StatefulSet · <hcp-namespace>',
  'shared-ingress-proxy':            'Deployment · hypershift-sharedingress',
  'svc-ingress-lb-shared':           'Service (LoadBalancer) · hypershift-sharedingress',
  'svc-apps-lb-infra':               'Service (LoadBalancer) · <hcp-namespace>',
  'ovn-master-control':              'Deployment · openshift-ovn-kubernetes',
  'cloud-controller-manager':        'Deployment · <hcp-namespace>',
  'konnectivity-server':             'Deployment · <hcp-namespace>',
  'ignition-server':                 'Deployment · <hcp-namespace>',
  'cluster-monitoring':              'Deployment · openshift-monitoring (in VM)',
  'kubelet-master':                  'systemd unit · bare metal master node',
  'crio-master':                     'systemd unit · bare metal master node',
  'ovs-master':                      'systemd unit · bare metal master node',
  'ovn-node-master':                 'DaemonSet · openshift-ovn-kubernetes',
  'mgmt-kube-apiserver':             'Static Pod · openshift-kube-apiserver',
  'mgmt-etcd':                       'Static Pod · openshift-etcd',
  'mgmt-controller-manager':         'Static Pod · openshift-kube-controller-manager',
  'mgmt-scheduler':                  'Static Pod · openshift-kube-scheduler',
  'kubelet-host':                    'systemd unit · bare metal worker node',
  'crio-host':                       'systemd unit · bare metal worker node',
  'ovs-host':                        'systemd unit · bare metal worker node',
  'ovn-node-host':                   'DaemonSet · openshift-ovn-kubernetes',
  'virt-handler':                    'DaemonSet · openshift-cnv',
  'kubevirt-launcher':               'Pod (virt-launcher) · <hcp-namespace>',
  'guest-worker-node-vm':            'VirtualMachineInstance · <hcp-namespace>',
  'kubelet-guest':                   'systemd unit · guest worker node (in VM)',
  'crio-guest':                      'systemd unit · guest worker node (in VM)',
  'ovs-guest':                       'systemd unit · guest worker node (in VM)',
  'ovn-node-guest':                  'DaemonSet · openshift-ovn-kubernetes (in VM)',
  'konnectivity-agent':              'DaemonSet · kube-system (in VM)',
  'coredns-node':                    'DaemonSet · openshift-dns (in VM)',
  'openshift-ingress-router-guest':  'Deployment · openshift-ingress (in VM)',
  'svc-ingress-lb-guest':            'Service (LoadBalancer) · openshift-ingress (in VM)',
  'frontend-workload-pod':           'Deployment · e-commerce-prod (in VM)',
  'svc-frontend':                    'Service (ClusterIP) · e-commerce-prod (in VM)',
  'backend-workload-pod':            'Deployment · e-commerce-prod (in VM)',
  'svc-backend':                     'Service (ClusterIP) · e-commerce-prod (in VM)',
  'netpol-ecommerce':                'NetworkPolicy · e-commerce-prod (in VM)',
  'pod-netns':                       'Linux network namespace · per-Pod (in VM)',
  'pod-cgroups':                     'cgroup v2 slice · per-Pod (in VM)',
  'container-process':               'Linux process · PID 1 in netns (in VM)',
  'hostedcontrolplane-cr':           'CustomResource · <hcp-namespace>',
  'capi-cluster-cr':                 'CustomResource (cluster.x-k8s.io) · <hcp-namespace>',
  'machinedeployment-cr':            'CustomResource (cluster.x-k8s.io) · <hcp-namespace>',
  'machineset-cr':                   'CustomResource (cluster.x-k8s.io) · <hcp-namespace>',
  'machine-cr':                      'CustomResource (cluster.x-k8s.io) · <hcp-namespace>',
  'kubevirtmachine-cr':              'CustomResource (infra.cluster.x-k8s.io) · <hcp-namespace>',
  'kubevirt-vm-cr':                  'CustomResource (kubevirt.io) · <hcp-namespace>',
  'clusterversion-cr':               'CustomResource (config.openshift.io) · guest cluster',
  'clusteroperator-cr':              'CustomResource (config.openshift.io) · guest cluster',
  'route-cr':                        'CustomResource (route.openshift.io) · e-commerce-prod',
  'deployment-workload':             'Deployment (apps/v1) · e-commerce-prod',
  'replicaset-workload':             'ReplicaSet (apps/v1) · e-commerce-prod',
  'secret-workload':                 'Secret (core/v1) · e-commerce-prod',
  'configmap-workload':              'ConfigMap (core/v1) · e-commerce-prod',
  'pvc-workload':                    'PersistentVolumeClaim (core/v1) · e-commerce-prod',
  'pv-workload':                     'PersistentVolume (core/v1) · cluster-scoped',
  'endpointslice':                   'EndpointSlice (discovery.k8s.io) · e-commerce-prod',
}

const PRIMITIVE = {
  'external-client':                 'TCP socket (libc)',
  'hypershift-operator':             'Pod → Go binary + controller-runtime',
  'hostedcluster-cr':                'etcd record (mgmt API Server)',
  'nodepool-cr':                     'etcd record (mgmt API Server)',
  'control-plane-operator':          'Pod → CPO binary + controller-runtime',
  'capi-manager':                    'Pod → cluster-api controller-manager',
  'capk-provider':                   'Pod → capk controller-manager',
  'cluster-version-operator':        'Pod → CVO binary',
  'guest-api-server':                'Pod → kube-apiserver binary',
  'guest-oauth-server':              'Pod → oauth-server binary',
  'guest-controller-manager':        'Pod → kube-controller-manager binary',
  'guest-kube-scheduler':            'Pod → kube-scheduler binary',
  'guest-etcd':                      'StatefulSet Pod → etcd binary + Raft log',
  'shared-ingress-proxy':            'Pod → HAProxy process (SNI routing)',
  'svc-ingress-lb-shared':           'MetalLB L2 VIP (ARP/NDP) → OVN LB flows',
  'svc-apps-lb-infra':               'MetalLB L2 VIP (ARP/NDP) → virt-launcher endpoints',
  'ovn-master-control':              'Pod → ovnkube-master + OVN NB DB',
  'cloud-controller-manager':        'Pod → CCM binary + cloud API calls',
  'konnectivity-server':             'Pod → konnectivity-server + GRPC tunnel',
  'ignition-server':                 'Pod → Ignition HTTP server',
  'cluster-monitoring':              'Pod → Prometheus + Thanos (in VM)',
  'kubelet-master':                  'systemd → kubelet binary + CRI gRPC',
  'crio-master':                     'systemd → crio + runc/crun OCI',
  'ovs-master':                      'systemd → ovs-vswitchd + OpenFlow',
  'ovn-node-master':                 'Pod → OVN controller + CNI plugin',
  'mgmt-kube-apiserver':             'Static Pod → kube-apiserver binary',
  'mgmt-etcd':                       'Static Pod → etcd binary + Raft log',
  'mgmt-controller-manager':         'Static Pod → kube-controller-manager binary',
  'mgmt-scheduler':                  'Static Pod → kube-scheduler binary',
  'kubelet-host':                    'systemd → kubelet binary + CRI gRPC',
  'crio-host':                       'systemd → crio + runc/crun OCI',
  'ovs-host':                        'systemd → ovs-vswitchd + OpenFlow',
  'ovn-node-host':                   'Pod → OVN controller + CNI plugin',
  'virt-handler':                    'Pod → virt-handler + libvirt/VMI lifecycle',
  'kubevirt-launcher':               'Pod → qemu-kvm process + tap0 NIC',
  'guest-worker-node-vm':            'KVM VM → RHCOS guest OS + virtio-net',
  'kubelet-guest':                   'systemd → kubelet binary (in VM)',
  'crio-guest':                      'systemd → crio + runc/crun (in VM)',
  'ovs-guest':                       'systemd → ovs-vswitchd (in VM)',
  'ovn-node-guest':                  'Pod → OVN controller (in VM)',
  'konnectivity-agent':              'Pod → konnectivity-agent + gRPC tunnel',
  'coredns-node':                    'Pod → CoreDNS binary (in VM)',
  'openshift-ingress-router-guest':  'Pod → HAProxy (in VM)',
  'svc-ingress-lb-guest':            'router-default LB → kubevirt CCM mirror → OVN LB flows',
  'frontend-workload-pod':           'Pod → app binary + network namespace',
  'svc-frontend':                    'Virtual ClusterIP → OVN LB flows (DNAT)',
  'backend-workload-pod':            'Pod → app binary + network namespace',
  'svc-backend':                     'Virtual ClusterIP → OVN LB flows (DNAT)',
  'netpol-ecommerce':                'OVN ACL + address set → OVS allow/drop flows',
  'pod-netns':                       'unshare(CLONE_NEWNET) in VM kernel',
  'pod-cgroups':                     '/sys/fs/cgroup/... in VM kernel',
  'container-process':               'execve() under PID 1 in VM netns',
  'hostedcontrolplane-cr':           'etcd record (mgmt API Server)',
  'capi-cluster-cr':                 'etcd record (mgmt API Server)',
  'machinedeployment-cr':            'etcd record (mgmt API Server)',
  'machineset-cr':                   'etcd record (mgmt API Server)',
  'machine-cr':                      'etcd record (mgmt API Server)',
  'kubevirtmachine-cr':              'etcd record (mgmt API Server)',
  'kubevirt-vm-cr':                  'etcd record (mgmt API Server)',
  'clusterversion-cr':               'etcd record (guest etcd)',
  'clusteroperator-cr':              'etcd record (guest etcd)',
  'route-cr':                        'etcd record (guest etcd)',
  'deployment-workload':             'etcd record (guest etcd)',
  'replicaset-workload':             'etcd record (guest etcd)',
  'secret-workload':                 'etcd record (guest etcd, encrypted at rest)',
  'configmap-workload':              'etcd record (guest etcd)',
  'pvc-workload':                    'etcd record (guest etcd)',
  'pv-workload':                     'etcd record (guest etcd)',
  'endpointslice':                   'etcd record (guest etcd)',
}

// First sentence of a description, with exactly one trailing period — avoids
// the double "." that a naive split + append produces when the source text
// already ends in (or lacks) a period.
function firstSentence(text) {
  if (!text) return '—'
  const match = text.match(/^.*?\.(?:\s|$)/)
  const first = (match ? match[0] : text).trim()
  return first.endsWith('.') ? first : `${first}.`
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
                    <span className="object-name" style={{ color, fontWeight: 600 }}>
                      <TypeIcon
                        typePrefix={c.typePrefix}
                        size="0.95em"
                        title={c.typePrefix}
                        className="object-type-icon"
                      />
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
                    {firstSentence(c.problemSolved)}
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
