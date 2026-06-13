// ── The Overview's network-mode pairs ───────────────────────────────────────
// Network mode (Big view + Network) renders the network-filtered Overview three
// times in parallel columns — one per bare-metal node pair — and opens each
// drillable component box to show its internal Linux primitives + integrations
// (see network-internals.js + PrimitiveBoxCard). This module just enumerates the
// three pairs the columns iterate over.

export const NET_PAIRS = [0, 1, 2]
