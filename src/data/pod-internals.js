// ── Per-pod filesystem + socket (Primitives mode) ───────────────────────────
// The volumes a pod mounts and the port it listens on depend on what the pod
// *does*, so we derive them from the component's `role` (with a few per-id
// refinements) rather than showing one identical mock for every pod. Every
// container still gets the universals — the overlayfs root, the projected
// ServiceAccount token, and /proc — and its role adds the real certs / config /
// data volumes on top, so an etcd's filesystem (a data PVC + peer certs) differs
// from an operator's (a serving cert + a config bundle) or an OVN node's (host
// OVS/OVN bind mounts).
//
// These are representative of real OpenShift HCP workloads, not live cluster
// reads — accurate enough to teach the shape, authored in the same curated
// spirit as the rest of the data.

// ── volume-descriptor helpers ───────────────────────────────────────────────
const SEC  = (path, source, keys) => ({ kind: 'secret', path, source, keys })
const TLS  = (path, source) => SEC(path, source, ['tls.crt', 'tls.key'])
const CM   = (path, source, keys) => ({ kind: 'configmap', path, source, keys })
const PVC  = (path, source, keys, fs = 'ext4 · block') => ({ kind: 'pvc', path, source, keys, fs })
const HOST = (path, note) => ({ kind: 'hostpath', path, source: path, note })
const TMP  = (path, note) => ({ kind: 'emptydir', path, note })

// The universals every container's mount namespace carries.
const ROOT = { kind: 'overlayfs', path: '/', note: 'image layers + writable upper' }
const SA_TOKEN = { kind: 'projected', path: '…/serviceaccount', source: 'kube-api-access', keys: ['token', 'ca.crt', 'namespace'] }
const PROC = { kind: 'procfs', path: '/proc', note: 'contents from the PID ns', linksPidns: true }

// Role → the extra volumes a pod of that role typically mounts.
const ROLE_MOUNTS = {
  'OPERATOR': [
    TLS('/etc/tls/private', 'serving-cert'),
    CM('/etc/config/ca', 'trusted-ca-bundle', ['ca-bundle.crt']),
  ],
  'CONTROLLER': [
    SEC('/etc/kubernetes/kubeconfig', 'service-network-admin-kubeconfig', ['kubeconfig']),
    TLS('/etc/tls/private', 'serving-cert'),
  ],
  'API SERVER': [
    TLS('/etc/kubernetes/certs/serving', 'serving-cert'),
    SEC('/etc/kubernetes/certs/etcd-client', 'etcd-client-tls', ['tls.crt', 'tls.key', 'ca.crt']),
    SEC('/etc/kubernetes/secrets/sa-signing', 'sa-signing-key', ['service-account.key']),
    CM('/etc/kubernetes/config', 'config', ['config.yaml']),
  ],
  'AUTH SERVER': [
    TLS('/etc/oauth/serving', 'serving-cert'),
    SEC('/etc/oauth/config', 'oauth-config', ['oauthConfig.json']),
    SEC('/etc/oauth/templates', 'login-templates', ['login.html', 'errors.html']),
  ],
  'KEY-VALUE STORE': [
    PVC('/var/lib/etcd', 'data-etcd-0', ['member/snap/', 'member/wal/']),
    SEC('/etc/etcd/tls/server', 'etcd-serving', ['server.crt', 'server.key']),
    SEC('/etc/etcd/tls/peer', 'etcd-peer', ['peer.crt', 'peer.key']),
    CM('/etc/etcd/ca', 'etcd-ca', ['ca.crt']),
  ],
  'SCHEDULER': [
    SEC('/etc/kubernetes/kubeconfig', 'scheduler-kubeconfig', ['kubeconfig']),
    CM('/etc/kubernetes/config', 'scheduler-config', ['config.yaml']),
    TLS('/etc/tls/private', 'serving-cert'),
  ],
  'DNS': [
    CM('/etc/coredns', 'dns-default', ['Corefile']),
    TLS('/etc/coredns/tls', 'dns-metrics-tls'),
  ],
  'INGRESS ROUTER': [
    TLS('/etc/pki/tls/private', 'router-default-cert'),
    CM('/var/lib/haproxy/conf', 'router-config', ['haproxy.config']),
    TMP('/var/lib/haproxy/run', 'haproxy sockets'),
  ],
  'INGRESS PROXY': [
    TLS('/etc/pki/tls/private', 'serving-cert'),
    CM('/etc/haproxy', 'proxy-config', ['haproxy.cfg']),
  ],
  'TUNNEL': [
    SEC('/etc/konnectivity/certs', 'konnectivity-tls', ['tls.crt', 'tls.key', 'ca.crt']),
    SEC('/etc/konnectivity/kubeconfig', 'konnectivity-kubeconfig', ['kubeconfig']),
  ],
  'NETWORK CONTROL': [
    SEC('/etc/ovn/tls', 'ovn-cert', ['tls.crt', 'tls.key']),
    CM('/run/ovnkube-config', 'ovnkube-config', ['ovnkube.conf']),
  ],
  'NODE NETWORKING': [
    HOST('/run/openvswitch', 'host OVS runtime sockets'),
    HOST('/etc/openvswitch', 'host OVS conf.db'),
    HOST('/run/ovn', 'host OVN sockets'),
    SEC('/etc/ovn/tls', 'ovn-cert', ['tls.crt', 'tls.key']),
  ],
  'NODE TUNING': [
    HOST('/sys', 'host sysfs (sysctl / hugepages)'),
    CM('/etc/tuned', 'tuned-profiles', ['tuned.conf']),
  ],
  'STORAGE NODE': [
    HOST('/var/lib/kubelet/plugins', 'CSI socket dir'),
    HOST('/dev', 'host block devices'),
  ],
  'STORAGE PROVISIONER': [
    SEC('/etc/cloud/credentials', 'cloud-credentials', ['credentials']),
    TLS('/etc/tls/private', 'serving-cert'),
  ],
  'REGISTRY': [
    PVC('/registry', 'image-registry-storage', ['docker/'], 'xfs · block'),
    TLS('/etc/secrets', 'image-registry-tls'),
  ],
  'MONITORING': [
    PVC('/prometheus', 'prometheus-data', ['wal/', 'chunks_head/']),
    SEC('/etc/prometheus/tls', 'prometheus-tls', ['tls.crt', 'tls.key']),
    CM('/etc/prometheus/config', 'prometheus-config', ['prometheus.yaml']),
  ],
  'VIRT AGENT': [
    HOST('/dev/kvm', 'host KVM device'),
    HOST('/var/run/kubevirt', 'host kubevirt runtime'),
    HOST('/proc/1/root/var/lib/kubelet', 'host kubelet dir'),
  ],
  'VM WRAPPER': [
    HOST('/dev/kvm', 'host KVM device'),
    TMP('/var/run/kubevirt-ephemeral-disks', 'ephemeral VM disk overlays'),
    PVC('/var/run/kubevirt-private/vmi-disks/rootdisk', 'guest-rootvolume', undefined, 'raw · block'),
  ],
  'LB CONTROLLER': [
    TLS('/tmp/k8s-webhook-server/serving-certs', 'metallb-webhook-cert'),
    CM('/etc/metallb', 'metallb-config', ['config.yaml']),
  ],
  'LB SPEAKER': [
    SEC('/etc/ml_secret_key', 'metallb-memberlist', ['secretkey']),
  ],
  'ADMISSION': [
    TLS('/etc/webhook/certs', 'webhook-cert'),
  ],
  'BOOTSTRAP': [
    TLS('/etc/ignition/serving', 'ignition-serving-cert'),
    SEC('/etc/ignition/payload', 'ignition-payload', ['config.ign']),
  ],
  'APPLICATION': [
    CM('/etc/app', 'app-config', ['app.yaml', 'log-level']),
    SEC('/etc/app/secrets', 'db-credentials', ['DB_URL', 'DB_PASSWORD']),
    PVC('/var/lib/app/data', 'app-data'),
  ],
}

// A sensible baseline for any role not listed (a typical control-plane pod).
const DEFAULT_MOUNTS = [
  TLS('/etc/tls/private', 'serving-cert'),
  CM('/etc/config', 'config', ['config.yaml']),
]

// Per-id refinements where the role alone is too generic.
const ID_MOUNTS = {
  'frontend-application-pod': [
    CM('/etc/nginx/conf.d', 'frontend-config', ['default.conf', 'features.json']),
    TLS('/etc/nginx/tls', 'frontend-tls'),
  ],
  'backend-application-pod': [
    CM('/etc/app', 'backend-config', ['application.yaml']),
    SEC('/etc/app/secrets', 'db-credentials', ['DB_URL', 'DB_USER', 'DB_PASSWORD']),
    PVC('/var/lib/app/uploads', 'backend-uploads'),
  ],
}

export function podMounts(component) {
  const extra = ID_MOUNTS[component?.componentId] || ROLE_MOUNTS[component?.role] || DEFAULT_MOUNTS
  return [ROOT, ...extra, SA_TOKEN, PROC]
}

// The TCP port a pod of this role typically listens on (the socket's bound port).
const ROLE_LISTEN = {
  'API SERVER': 6443, 'AUTH SERVER': 6443, 'KEY-VALUE STORE': 2379,
  'DNS': 5353, 'INGRESS ROUTER': 443, 'INGRESS PROXY': 443, 'TUNNEL': 8091,
  'REGISTRY': 5000, 'MONITORING': 9091, 'LB CONTROLLER': 9443, 'LB SPEAKER': 7472,
  'APPLICATION': 8080, 'ADMISSION': 6443,
}
const ID_LISTEN = {
  'openshift-apiserver': 8443, 'openshift-oauth-apiserver': 8443, 'packageserver': 5443,
  'frontend-application-pod': 8080, 'backend-application-pod': 8080,
  'guest-etcd': 2379, 'mgmt-etcd': 2379,
}
const DEFAULT_LISTEN = 8443

export function podListen(component) {
  const port = ID_LISTEN[component?.componentId] ?? ROLE_LISTEN[component?.role] ?? DEFAULT_LISTEN
  return { port }
}
