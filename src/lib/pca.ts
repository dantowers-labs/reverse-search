// Projects high-dimensional vectors to 2D via PCA (the top 2 principal
// components), computed through the n×n Gram matrix rather than the d×d
// covariance matrix — standard when there are far fewer points (n, a
// handful to a few dozen captured profiles) than embedding dimensions (d,
// 384), and mathematically equivalent to full PCA. Top eigenvectors found
// via power iteration with deflation; no linear-algebra dependency needed
// at this scale.

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function matVec(m: number[][], v: number[]): number[] {
  return m.map((row) => dot(row, v));
}

function norm(v: number[]): number {
  return Math.sqrt(dot(v, v));
}

// Top eigenvector/eigenvalue of a symmetric matrix via power iteration.
function powerIteration(m: number[][], n: number, iterations = 200): { vector: number[]; value: number } {
  let v: number[] = Array.from({ length: n }, (_, i) => (i === 0 ? 1 : 0.5)); // avoid an all-equal start vector
  for (let iter = 0; iter < iterations; iter++) {
    const next = matVec(m, v);
    const len = norm(next);
    if (len < 1e-10) return { vector: v, value: 0 }; // matrix ~0 in remaining directions
    v = next.map((x) => x / len);
  }
  const mv = matVec(m, v);
  return { vector: v, value: dot(v, mv) }; // Rayleigh quotient, ||v||=1
}

// Subtracts value·v·vᵀ so the next power iteration finds the next-largest
// eigenvector instead of converging on the same one again.
function deflate(m: number[][], v: number[], value: number, n: number): number[][] {
  const out: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      out[i][j] = m[i][j] - value * v[i] * v[j];
    }
  }
  return out;
}

export function pcaProject2D(vectors: number[][]): [number, number][] {
  const n = vectors.length;
  if (n === 0) return [];
  if (n === 1) return [[0, 0]];

  const dim = vectors[0].length;
  const mean = new Array(dim).fill(0);
  for (const v of vectors) for (let i = 0; i < dim; i++) mean[i] += v[i] / n;
  const centered = vectors.map((v) => v.map((x, i) => x - mean[i]));

  const gram: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const g = dot(centered[i], centered[j]);
      gram[i][j] = g;
      gram[j][i] = g;
    }
  }

  const pc1 = powerIteration(gram, n);
  const pc2 = powerIteration(deflate(gram, pc1.vector, pc1.value, n), n);

  const scale1 = Math.sqrt(Math.max(pc1.value, 0));
  const scale2 = Math.sqrt(Math.max(pc2.value, 0));
  return pc1.vector.map((_, i) => [pc1.vector[i] * scale1, pc2.vector[i] * scale2]);
}
