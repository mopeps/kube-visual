// Minimal example manifests, keyed by componentId. Shown behind the
// [MANIFEST] / [UNIT] chip in the detail sheet header and on the pipeline's
// logical-intent node. Each is intentionally minimal — just the fields you'd
// actually write to create the object — not a production-complete spec.
//
//   { kind: 'MANIFEST', body } → a Kubernetes YAML object
//   { kind: 'UNIT',     body } → a systemd unit file (host services, no K8s API)
//
// Components with no manifest at all — the off-cluster client and the bare
// kernel primitives (netns / cgroups / process) — are simply absent here, so
// the chip never renders for them.

const M = (body, kind = 'MANIFEST') => ({ kind, body })

// A concrete HostedControlPlane namespace stands in for the <hcp-namespace>
// placeholder used elsewhere (the real pattern is clusters-<cluster-name>).
const HCPNS = 'clusters-example'

// ── workload-controller helpers ──────────────────────────────────────────
const deployment = (name, ns, image = `${name}:latest`, replicas = 2) => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: ${ns}
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
        - name: ${name}
          image: ${image}`

const daemonset = (name, ns, image = `${name}:latest`) => `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: ${name}
  namespace: ${ns}
spec:
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
        - name: ${name}
          image: ${image}`

const statefulset = (name, ns, image = `${name}:latest`, replicas = 3) => `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: ${name}
  namespace: ${ns}
spec:
  serviceName: ${name}
  replicas: ${replicas}
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
        - name: ${name}
          image: ${image}`

const service = (selector, ns, type, port = 8080) => `apiVersion: v1
kind: Service
metadata:
  name: ${selector}
  namespace: ${ns}
spec:
  type: ${type}
  selector:
    app: ${selector}
  ports:
    - port: ${port}
      targetPort: ${port}`

const staticPod = (name, ns, command) => `apiVersion: v1
kind: Pod
metadata:
  name: ${name}
  namespace: ${ns}
  annotations:
    # Read from /etc/kubernetes/manifests by the kubelet and run directly —
    # there is no controller and it never appears in a Deployment/ReplicaSet.
    kubernetes.io/config.source: file
spec:
  hostNetwork: true
  priorityClassName: system-node-critical
  containers:
    - name: ${name}
      image: ${name}:latest
      command: ["${command}"]`

// ── systemd unit files (one template per service, reused per node) ─────────
const KUBELET_UNIT = `[Unit]
Description=Kubernetes Kubelet
After=crio.service
Requires=crio.service

[Service]
ExecStart=/usr/bin/kubelet --config=/etc/kubernetes/kubelet.conf --container-runtime-endpoint=/var/run/crio/crio.sock --kubeconfig=/var/lib/kubelet/kubeconfig
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target`

const CRIO_UNIT = `[Unit]
Description=Container Runtime Interface for OCI (CRI-O)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/bin/crio --config=/etc/crio/crio.conf
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target`

const OVS_UNIT = `[Unit]
Description=Open vSwitch Daemon (ovs-vswitchd)
After=ovsdb-server.service
Requires=ovsdb-server.service

[Service]
ExecStart=/usr/sbin/ovs-vswitchd --pidfile --detach
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target`

export const MANIFESTS = {
  // ── HyperShift management + guest control-plane Deployments ─────────────
  'hypershift-operator': M(deployment('operator', 'hypershift')),
  'cluster-version-operator': M(deployment('cluster-version-operator', HCPNS)),
  'control-plane-operator': M(deployment('control-plane-operator', HCPNS)),
  'capi-manager': M(deployment('cluster-api', HCPNS)),
  'capk-provider': M(deployment('capi-provider-kubevirt', HCPNS)),
  'guest-api-server': M(deployment('kube-apiserver', HCPNS, 'kube-apiserver:latest', 3)),
  'guest-oauth-server': M(deployment('oauth-openshift', HCPNS)),
  'guest-controller-manager': M(deployment('kube-controller-manager', HCPNS)),
  'guest-kube-scheduler': M(deployment('kube-scheduler', HCPNS)),
  'guest-etcd': M(statefulset('etcd', HCPNS, 'etcd:latest', 3)),
  'shared-ingress-proxy': M(deployment('router', 'hypershift-sharedingress')),
  'ovn-master-control': M(deployment('ovnkube-control-plane', 'openshift-ovn-kubernetes')),
  'cloud-controller-manager': M(deployment('cloud-controller-manager', HCPNS)),
  'konnectivity-server': M(deployment('konnectivity-server', HCPNS)),
  'ignition-server': M(deployment('ignition-server', HCPNS)),
  'openshift-ingress-router-guest': M(deployment('router-default', 'openshift-ingress')),

  // ── Control-plane operands (Control Plane Operator "operator set") ──────
  'openshift-apiserver': M(deployment('openshift-apiserver', HCPNS, 'openshift-apiserver:latest', 3)),
  'openshift-oauth-apiserver': M(deployment('openshift-oauth-apiserver', HCPNS)),
  'openshift-controller-manager': M(deployment('openshift-controller-manager', HCPNS)),
  'route-controller-manager': M(deployment('route-controller-manager', HCPNS)),
  'hosted-cluster-config-operator': M(deployment('hosted-cluster-config-operator', HCPNS, 'hosted-cluster-config-operator:latest', 1)),
  'cluster-network-operator': M(deployment('cluster-network-operator', HCPNS, 'cluster-network-operator:latest', 1)),
  'multus-admission-controller': M(deployment('multus-admission-controller', HCPNS)),
  'cluster-policy-controller': M(deployment('cluster-policy-controller', HCPNS)),
  'machine-approver': M(deployment('machine-approver', HCPNS, 'cluster-machine-approver:latest', 1)),
  'cluster-autoscaler': M(deployment('cluster-autoscaler', HCPNS, 'cluster-autoscaler:latest', 1)),

  // ── Cluster operators (Cluster Version Operator "operator set") ─────────
  'ingress-operator': M(deployment('ingress-operator', HCPNS, 'cluster-ingress-operator:latest', 1)),
  'dns-operator': M(deployment('dns-operator', HCPNS, 'cluster-dns-operator:latest', 1)),
  'cluster-authentication-operator': M(deployment('cluster-authentication-operator', HCPNS, 'cluster-authentication-operator:latest', 1)),
  'cluster-storage-operator': M(deployment('cluster-storage-operator', HCPNS, 'cluster-storage-operator:latest', 1)),
  'csi-snapshot-controller': M(deployment('csi-snapshot-controller', HCPNS)),
  'cluster-image-registry-operator': M(deployment('cluster-image-registry-operator', HCPNS, 'cluster-image-registry-operator:latest', 1)),
  'cluster-node-tuning-operator': M(deployment('cluster-node-tuning-operator', HCPNS, 'cluster-node-tuning-operator:latest', 1)),
  'olm-operator': M(deployment('olm-operator', HCPNS, 'olm:latest', 1)),
  'catalog-operator': M(deployment('catalog-operator', HCPNS, 'olm:latest', 1)),
  'packageserver': M(deployment('packageserver', HCPNS)),

  // ── StatefulSets / DaemonSets ───────────────────────────────────────────
  'cluster-monitoring': M(statefulset('prometheus-k8s', 'openshift-monitoring', 'prometheus:latest', 2)),
  'ovn-node-master': M(daemonset('ovnkube-node', 'openshift-ovn-kubernetes')),
  'ovn-node-host': M(daemonset('ovnkube-node', 'openshift-ovn-kubernetes')),
  'ovn-node-guest': M(daemonset('ovnkube-node', 'openshift-ovn-kubernetes')),
  'virt-handler': M(daemonset('virt-handler', 'openshift-cnv')),
  'multus-guest': M(daemonset('multus', 'openshift-multus')),
  'tuned-guest': M(daemonset('tuned', 'openshift-cluster-node-tuning-operator')),
  'csi-node-guest': M(daemonset('kubevirt-csi-node', 'openshift-cluster-csi-drivers')),
  'image-registry-guest': M(deployment('image-registry', 'openshift-image-registry', 'image-registry:latest', 2)),
  'konnectivity-agent': M(daemonset('konnectivity-agent', 'kube-system')),
  'coredns-node': M(daemonset('dns-default', 'openshift-dns')),

  // ── KubeVirt launcher Pod (created by KubeVirt, shown for reference) ─────
  'kubevirt-launcher': M(`apiVersion: v1
kind: Pod
metadata:
  name: virt-launcher-example-workers-abcde
  namespace: ${HCPNS}
  labels:
    kubevirt.io: virt-launcher
spec:
  containers:
    - name: compute
      image: virt-launcher:latest
# Generated by KubeVirt from the VirtualMachineInstance — not authored directly.`),

  // ── Application Pods (their declarative source is a Deployment) ──────────
  'frontend-application-pod': M(deployment('frontend', 'e-commerce-prod', 'frontend:latest', 3)),
  'backend-application-pod': M(deployment('backend', 'e-commerce-prod', 'backend:latest', 3)),

  // ── Management static Pods (kubelet-run from disk) ──────────────────────
  'mgmt-kube-apiserver': M(staticPod('kube-apiserver', 'openshift-kube-apiserver', 'kube-apiserver')),
  'mgmt-etcd': M(staticPod('etcd', 'openshift-etcd', 'etcd')),
  'mgmt-controller-manager': M(staticPod('kube-controller-manager', 'openshift-kube-controller-manager', 'kube-controller-manager')),
  'mgmt-scheduler': M(staticPod('kube-scheduler', 'openshift-kube-scheduler', 'kube-scheduler')),

  // ── Services ────────────────────────────────────────────────────────────
  'svc-ingress-lb-shared': M(service('shared-ingress', 'hypershift-sharedingress', 'LoadBalancer', 443)),
  'svc-apps-lb-infra': M(service('kube-apiserver', HCPNS, 'LoadBalancer', 6443)),
  'svc-ingress-lb-guest': M(service('router-default', 'openshift-ingress', 'LoadBalancer', 443)),
  'svc-frontend': M(service('frontend', 'e-commerce-prod', 'ClusterIP', 8080)),
  'svc-backend': M(service('backend', 'e-commerce-prod', 'ClusterIP', 8080)),

  // ── systemd units (host services on each node) ──────────────────────────
  'kubelet-master': M(KUBELET_UNIT, 'UNIT'),
  'kubelet-host': M(KUBELET_UNIT, 'UNIT'),
  'kubelet-guest': M(KUBELET_UNIT, 'UNIT'),
  'crio-master': M(CRIO_UNIT, 'UNIT'),
  'crio-host': M(CRIO_UNIT, 'UNIT'),
  'crio-guest': M(CRIO_UNIT, 'UNIT'),
  'ovs-master': M(OVS_UNIT, 'UNIT'),
  'ovs-host': M(OVS_UNIT, 'UNIT'),
  'ovs-guest': M(OVS_UNIT, 'UNIT'),

  // ── VirtualMachineInstance ──────────────────────────────────────────────
  'guest-worker-node-vm': M(`apiVersion: kubevirt.io/v1
kind: VirtualMachineInstance
metadata:
  name: example-workers-abcde
  namespace: ${HCPNS}
spec:
  domain:
    cpu:
      cores: 2
    memory:
      guest: 8Gi
    devices:
      disks:
        - name: rootdisk
          disk:
            bus: virtio
      interfaces:
        - name: default
          masquerade: {}
  networks:
    - name: default
      pod: {}
  volumes:
    - name: rootdisk
      containerDisk:
        image: rhcos:latest
# Normally created for you by a VirtualMachine — rarely authored directly.`),

  // ── Custom Resources ────────────────────────────────────────────────────
  'hostedcluster-cr': M(`apiVersion: hypershift.openshift.io/v1beta1
kind: HostedCluster
metadata:
  name: example
  namespace: clusters
spec:
  release:
    image: quay.io/openshift-release-dev/ocp-release:4.18.0-x86_64
  pullSecret:
    name: example-pull-secret
  sshKey:
    name: example-ssh-key
  platform:
    type: KubeVirt
  services:
    - service: APIServer
      servicePublishingStrategy:
        type: LoadBalancer`),

  'nodepool-cr': M(`apiVersion: hypershift.openshift.io/v1beta1
kind: NodePool
metadata:
  name: example-workers
  namespace: clusters
spec:
  clusterName: example
  replicas: 2
  release:
    image: quay.io/openshift-release-dev/ocp-release:4.18.0-x86_64
  platform:
    type: KubeVirt
    kubevirt:
      compute:
        cores: 2
        memory: 8Gi`),

  'hostedcontrolplane-cr': M(`apiVersion: hypershift.openshift.io/v1beta1
kind: HostedControlPlane
metadata:
  name: example
  namespace: ${HCPNS}
spec:
  releaseImage: quay.io/openshift-release-dev/ocp-release:4.18.0-x86_64
  pullSecret:
    name: pull-secret
# Created by the HyperShift operator from the HostedCluster — not authored by hand.`),

  'capi-cluster-cr': M(`apiVersion: cluster.x-k8s.io/v1beta1
kind: Cluster
metadata:
  name: example
  namespace: ${HCPNS}
spec:
  infrastructureRef:
    apiVersion: infrastructure.cluster.x-k8s.io/v1alpha1
    kind: KubevirtCluster
    name: example`),

  'machinedeployment-cr': M(`apiVersion: cluster.x-k8s.io/v1beta1
kind: MachineDeployment
metadata:
  name: example-workers
  namespace: ${HCPNS}
spec:
  clusterName: example
  replicas: 2
  selector:
    matchLabels:
      cluster.x-k8s.io/cluster-name: example
  template:
    spec:
      clusterName: example
      bootstrap:
        dataSecretName: example-worker-userdata
      infrastructureRef:
        apiVersion: infrastructure.cluster.x-k8s.io/v1alpha1
        kind: KubevirtMachineTemplate
        name: example-workers`),

  'machineset-cr': M(`apiVersion: cluster.x-k8s.io/v1beta1
kind: MachineSet
metadata:
  name: example-workers-abcde
  namespace: ${HCPNS}
spec:
  clusterName: example
  replicas: 2
  selector:
    matchLabels:
      cluster.x-k8s.io/cluster-name: example
  template:
    spec:
      clusterName: example
      bootstrap:
        dataSecretName: example-worker-userdata
      infrastructureRef:
        apiVersion: infrastructure.cluster.x-k8s.io/v1alpha1
        kind: KubevirtMachineTemplate
        name: example-workers`),

  'machine-cr': M(`apiVersion: cluster.x-k8s.io/v1beta1
kind: Machine
metadata:
  name: example-workers-abcde
  namespace: ${HCPNS}
  labels:
    cluster.x-k8s.io/cluster-name: example
spec:
  clusterName: example
  bootstrap:
    dataSecretName: example-worker-userdata
  infrastructureRef:
    apiVersion: infrastructure.cluster.x-k8s.io/v1alpha1
    kind: KubevirtMachine
    name: example-workers-abcde`),

  'kubevirtmachine-cr': M(`apiVersion: infrastructure.cluster.x-k8s.io/v1alpha1
kind: KubevirtMachine
metadata:
  name: example-workers-abcde
  namespace: ${HCPNS}
spec:
  virtualMachineTemplate:
    spec:
      runStrategy: Always
      template:
        spec:
          domain:
            cpu:
              cores: 2
            memory:
              guest: 8Gi`),

  'kubevirt-vm-cr': M(`apiVersion: kubevirt.io/v1
kind: VirtualMachine
metadata:
  name: example-workers-abcde
  namespace: ${HCPNS}
spec:
  running: true
  template:
    spec:
      domain:
        cpu:
          cores: 2
        memory:
          guest: 8Gi
        devices:
          disks:
            - name: rootdisk
              disk:
                bus: virtio
          interfaces:
            - name: default
              masquerade: {}
      networks:
        - name: default
          pod: {}
      volumes:
        - name: rootdisk
          containerDisk:
            image: rhcos:latest`),

  'clusterversion-cr': M(`apiVersion: config.openshift.io/v1
kind: ClusterVersion
metadata:
  name: version
spec:
  clusterID: <generated-uuid>
  channel: stable-4.18
  desiredUpdate:
    version: 4.18.0`),

  'clusteroperator-cr': M(`apiVersion: config.openshift.io/v1
kind: ClusterOperator
metadata:
  name: ingress
spec: {}
# status (Available / Progressing / Degraded) is written by the operator, not by you.`),

  'route-cr': M(`apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: frontend
  namespace: e-commerce-prod
spec:
  host: shop.apps.example.com
  to:
    kind: Service
    name: frontend
  port:
    targetPort: 8080
  tls:
    termination: edge`),

  // ── NetworkPolicy ───────────────────────────────────────────────────────
  'netpol-ecommerce': M(`apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-allow-frontend
  namespace: e-commerce-prod
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - protocol: TCP
          port: 8080`),

  // ── Application API objects ─────────────────────────────────────────────
  'deployment-application': M(deployment('frontend', 'e-commerce-prod', 'frontend:latest', 3)),

  'replicaset-application': M(`apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: frontend-7f4c9b
  namespace: e-commerce-prod
  labels:
    app: frontend
    pod-template-hash: 7f4c9b
spec:
  replicas: 3
  selector:
    matchLabels:
      app: frontend
      pod-template-hash: 7f4c9b
  template:
    metadata:
      labels:
        app: frontend
        pod-template-hash: 7f4c9b
    spec:
      containers:
        - name: frontend
          image: frontend:latest
# Normally created and owned by a Deployment, not authored directly.`),

  'secret-application': M(`apiVersion: v1
kind: Secret
metadata:
  name: frontend-tls-certs
  namespace: e-commerce-prod
type: kubernetes.io/tls
data:
  tls.crt: <base64-encoded certificate>
  tls.key: <base64-encoded private key>`),

  'configmap-application': M(`apiVersion: v1
kind: ConfigMap
metadata:
  name: frontend-app-config
  namespace: e-commerce-prod
data:
  APP_MODE: production
  LOG_LEVEL: info`),

  'pvc-application': M(`apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pvc-frontend-assets
  namespace: e-commerce-prod
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: kubevirt-csi`),

  'pv-application': M(`apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-block-assets
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: kubevirt-csi
  csi:
    driver: csi.kubevirt.io
    volumeHandle: pvc-frontend-assets`),

  'endpointslice': M(`apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: frontend-abcde
  namespace: e-commerce-prod
  labels:
    kubernetes.io/service-name: frontend
addressType: IPv4
ports:
  - name: http
    port: 8080
    protocol: TCP
endpoints:
  - addresses:
      - 10.128.2.15
    conditions:
      ready: true
# Written automatically by the EndpointSlice controller from the Service's selector.`),
}
