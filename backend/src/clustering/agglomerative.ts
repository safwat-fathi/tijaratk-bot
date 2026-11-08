/**
 * Average-linkage (UPGMA) agglomerative clustering on cosine distance with a distance threshold, matching
 * sklearn AgglomerativeClustering(n_clusters=None, distance_threshold=t, metric="cosine", linkage="average"):
 * clusters merge while their distance is < t. Returns a cluster index per input row.
 *
 * ponytail: O(n^2) memory, ~O(n^2) per merge worst case; fine for the nightly batch (limit=1000), swap for a
 * nearest-neighbour-chain implementation if the batch size grows by 10x.
 */
export function agglomerativeCosine(vectors: number[][], distanceThreshold: number): number[] {
  const n = vectors.length;
  const norms = vectors.map((v) => Math.sqrt(v.reduce((a, x) => a + x * x, 0)));
  const dist = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let dot = 0;
      for (let k = 0; k < vectors[i].length; k++) dot += vectors[i][k] * vectors[j][k];
      const d = 1 - dot / (norms[i] * norms[j]);
      dist[i * n + j] = d;
      dist[j * n + i] = d;
    }
  }

  const size = new Array<number>(n).fill(1);
  const active = new Array<boolean>(n).fill(true);
  const label = Array.from({ length: n }, (_, i) => i);
  const nnIdx = new Array<number>(n).fill(-1);
  const nnDist = new Array<number>(n).fill(Infinity);

  const refresh = (i: number) => {
    nnIdx[i] = -1;
    nnDist[i] = Infinity;
    for (let j = 0; j < n; j++) {
      if (j !== i && active[j] && dist[i * n + j] < nnDist[i]) {
        nnDist[i] = dist[i * n + j];
        nnIdx[i] = j;
      }
    }
  };
  for (let i = 0; i < n; i++) refresh(i);

  for (;;) {
    let a = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) if (active[i] && nnDist[i] < best) { best = nnDist[i]; a = i; }
    if (a < 0 || !(best < distanceThreshold)) break;
    const b = nnIdx[a];

    // merge b into a (Lance-Williams update for average linkage)
    for (let k = 0; k < n; k++) {
      if (!active[k] || k === a || k === b) continue;
      const d = (size[a] * dist[a * n + k] + size[b] * dist[b * n + k]) / (size[a] + size[b]);
      dist[a * n + k] = d;
      dist[k * n + a] = d;
    }
    size[a] += size[b];
    active[b] = false;
    for (let i = 0; i < n; i++) if (label[i] === b) label[i] = a;

    refresh(a);
    for (let k = 0; k < n; k++) {
      if (!active[k] || k === a) continue;
      if (nnIdx[k] === a || nnIdx[k] === b) refresh(k);
      else if (dist[k * n + a] < nnDist[k]) { nnDist[k] = dist[k * n + a]; nnIdx[k] = a; }
    }
  }

  // renumber by first appearance
  const ids = new Map<number, number>();
  return label.map((l) => ids.get(l) ?? (ids.set(l, ids.size), ids.get(l)!));
}
