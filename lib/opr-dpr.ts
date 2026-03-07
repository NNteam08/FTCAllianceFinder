/**
 * Shared OPR/DPR computation from match data.
 */

export interface MatchRow {
  redTeams: [number, number];
  blueTeams: [number, number];
  redScore: number;
  blueScore: number;
}

function solveLeastSquares(
  matchData: MatchRow[],
  scoreType: "alliance" | "opponent"
): Map<number, number> {
  const allTeams = new Set<number>();
  for (const m of matchData) {
    m.redTeams.forEach((t) => allTeams.add(t));
    m.blueTeams.forEach((t) => allTeams.add(t));
  }
  const teams = Array.from(allTeams);
  const n = teams.length;
  const teamToIdx = new Map<number, number>();
  teams.forEach((t, i) => teamToIdx.set(t, i));

  const rows: number[][] = [];
  const scores: number[] = [];
  for (const m of matchData) {
    const [r1, r2] = m.redTeams;
    const [b1, b2] = m.blueTeams;
    if (r1 == null || r2 == null || b1 == null || b2 == null) continue;
    const i1 = teamToIdx.get(r1);
    const i2 = teamToIdx.get(r2);
    const i3 = teamToIdx.get(b1);
    const i4 = teamToIdx.get(b2);
    if (i1 == null || i2 == null || i3 == null || i4 == null) continue;
    const redRow = new Array(n).fill(0);
    redRow[i1] = 1;
    redRow[i2] = 1;
    rows.push(redRow);
    scores.push(scoreType === "alliance" ? m.redScore : m.blueScore);
    const blueRow = new Array(n).fill(0);
    blueRow[i3] = 1;
    blueRow[i4] = 1;
    rows.push(blueRow);
    scores.push(scoreType === "alliance" ? m.blueScore : m.redScore);
  }

  const reg = 1e-6;
  const A: number[][] = teams.map(() => new Array(n).fill(0));
  const b = new Array(n).fill(0);
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const sVal = scores[r];
    for (let i = 0; i < n; i++) {
      if (row[i] === 0) continue;
      b[i] += sVal * row[i];
      for (let j = 0; j < n; j++) A[i][j] += row[i] * row[j];
    }
  }
  for (let i = 0; i < n; i++) A[i][i] += reg;

  const d = [...b];
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row;
    }
    [A[col], A[maxRow]] = [A[maxRow], A[col]];
    [d[col], d[maxRow]] = [d[maxRow], d[col]];
    const pivot = A[col][col];
    if (Math.abs(pivot) < 1e-12) continue;
    for (let row = col + 1; row < n; row++) {
      const f = A[row][col] / pivot;
      d[row] -= f * d[col];
      for (let j = col; j < n; j++) A[row][j] -= f * A[col][j];
    }
  }
  for (let col = n - 1; col >= 0; col--) {
    const pivot = A[col][col];
    if (Math.abs(pivot) < 1e-12) continue;
    for (let j = col + 1; j < n; j++) d[col] -= A[col][j] * d[j];
    d[col] /= pivot;
  }

  const out = new Map<number, number>();
  teams.forEach((t, i) => out.set(t, d[i]));
  return out;
}

export function computeOprMatrix(matchData: MatchRow[]): Map<number, number> {
  return solveLeastSquares(matchData, "alliance");
}

export function computeDprMatrix(matchData: MatchRow[]): Map<number, number> {
  return solveLeastSquares(matchData, "opponent");
}
