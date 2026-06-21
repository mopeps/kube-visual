// ── Authentication mechanisms — an EDGE attribute, never a node/hop ─────────
// A trace step that crosses a real authn/authz trust boundary carries an
// `auth: <id>` referencing one of these. The data plane (pod→pod, DNS, OVS/OVN,
// the app payload) carries NONE — Kubernetes/OVN don't authenticate it; it is
// NetworkPolicy-gated, and any real authentication there is the app's own mTLS.
//
// Defined once here and referenced by id from events.json, so the same mechanism
// can mark many hops without duplicating its detail, and the graph never grows a
// box for "auth". The chip (AuthChip.jsx) shows the label collapsed and reveals
// these ordered sub-steps — the clickable depth — on demand.
//
//   entry = { label, summary, steps: [{ k, v }] }   // k = phase, v = what happens

export const AUTH_FLOWS = {
  'bearer-oauth': {
    label: 'user token · RBAC',
    summary: 'A human oc / kubectl user proving identity to the kube-apiserver, then being authorized.',
    steps: [
      { k: 'TLS', v: 'Opens TLS to the API server and verifies its serving certificate against the cluster CA.' },
      { k: 'Credential', v: 'Sends a bearer token (an OpenShift OAuth access token) — or a client certificate from the kubeconfig — with the request.' },
      { k: 'Authenticate', v: 'The API server validates the token with the OAuth server (or the cert against the CA) and resolves the user and its groups.' },
      { k: 'Authorize', v: 'RBAC checks the user/groups’ (Cluster)RoleBindings for this verb + resource — a SubjectAccessReview; no matching rule → 403.' },
      { k: 'Admission', v: 'Admission plugins and any webhooks run before the object is written to etcd.' },
    ],
  },
  'sa-token': {
    label: 'SA token · RBAC',
    summary: 'An in-cluster Pod (operator, controller, CSI sidecar, node agent) proving identity to the API server.',
    steps: [
      { k: 'TLS', v: 'Opens TLS to the API server, verifying the serving cert against the cluster CA mounted in the Pod.' },
      { k: 'Token', v: 'Presents its projected ServiceAccount token — a short-lived, audience-scoped signed JWT — as a Bearer credential.' },
      { k: 'Authenticate', v: 'The API server verifies the JWT signature against the SA token-signing key and maps it to system:serviceaccount:<ns>:<name>.' },
      { k: 'Authorize', v: 'RBAC evaluates that ServiceAccount’s RoleBindings for the verb + resource (SubjectAccessReview).' },
    ],
  },
  'client-cert': {
    label: 'client cert · RBAC',
    summary: 'A core control-plane component (controller-manager, scheduler) — or a cross-cluster controller using a provisioned kubeconfig — authenticating with an X.509 client certificate.',
    steps: [
      { k: 'mTLS', v: 'Presents an X.509 client certificate from its kubeconfig; the API server verifies it against the cluster CA and presents its own serving cert back.' },
      { k: 'Identity', v: 'The certificate’s subject IS the identity, e.g. system:kube-controller-manager or system:kube-scheduler.' },
      { k: 'Authorize', v: 'RBAC checks that identity’s (Cluster)RoleBindings for the verb + resource.' },
      { k: 'Cross-cluster', v: 'Controllers reaching the guest (Cluster API, CSI) use a kubeconfig HyperShift mints into a Secret — same mechanism, different CA.' },
    ],
  },
  'kubelet-cert': {
    label: 'node cert · Node authz',
    summary: 'A node’s kubelet authenticating to the API server with an identity it earned at join time.',
    steps: [
      { k: 'Bootstrap', v: 'At first boot the kubelet uses a bootstrap credential delivered by Ignition only to submit a CSR.' },
      { k: 'CSR', v: 'machine-approver approves the CSR and the controller-manager’s signer issues a client cert for system:node:<node>.' },
      { k: 'mTLS', v: 'Thereafter the kubelet presents that client cert; the API server verifies it against the cluster CA.' },
      { k: 'Authorize', v: 'The Node authorizer + NodeRestriction admission limit it to the objects its own node legitimately needs.' },
    ],
  },
  'mtls': {
    label: 'mTLS (peer certs)',
    summary: 'Two fixed infrastructure peers authenticating each other with certificates from a shared CA — no user, no token.',
    steps: [
      { k: 'Server cert', v: 'The initiator verifies the peer’s serving certificate against the shared CA.' },
      { k: 'Client cert', v: 'It also presents its OWN client certificate, which the peer verifies against the same CA — both ends are authenticated.' },
      { k: 'Identity = authz', v: 'The certificate subject is the authorization: etcd trusts the apiserver client cert; the Konnectivity server and agent trust each other’s certs.' },
      { k: 'No RBAC', v: 'These are dedicated peers, not arbitrary API callers — there is no per-request RBAC.' },
    ],
  },
  'machine-token': {
    label: 'machine token',
    summary: 'A booting RHCOS node authorizing itself to download its secret-bearing Ignition config.',
    steps: [
      { k: 'Token', v: 'The VM’s kernel args carry a per-NodePool token; it presents it to the Ignition Server over TLS.' },
      { k: 'Authenticate', v: 'The HCP Ignition Server validates the token before serving anything — the payload holds the pull secret and the kubelet’s bootstrap kubeconfig.' },
      { k: 'Scope', v: 'The token buys exactly one thing — fetching Ignition — not API access; the kubelet still earns its own node cert via CSR afterward.' },
    ],
  },
  'registry-auth': {
    label: 'pull secret · registry',
    summary: 'How the kubelet / CRI-O authenticates to an image registry to pull a container image — and, where policy requires, verifies it.',
    steps: [
      { k: 'Credentials', v: 'CRI-O resolves the pull secret referenced by the Pod (or its ServiceAccount’s imagePullSecrets) — a docker config JSON of registry credentials.' },
      { k: 'Registry auth', v: 'It authenticates to the registry — a bearer token from the registry’s token endpoint, or basic auth — scoped to pull the requested repository.' },
      { k: 'Verify', v: 'If a ClusterImagePolicy / sigstore policy is configured, the image’s signature and digest are checked before it is allowed to run.' },
      { k: 'Cache', v: 'Layers already on the node are reused; only the missing blobs are fetched. No API server or RBAC is involved — this is node ↔ registry.' },
    ],
  },
}

export const findAuth = (id) => AUTH_FLOWS[id] || null
