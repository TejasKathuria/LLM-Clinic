'use client';

export interface LeaderboardEntry {
  caseId: string;
  caseName: string;
  doctorProvider: string;
  doctorModel: string;
  overallScore: number;
  reachedDiagnosis: boolean;
  timestamp: number;
}

export function readLeaderboard(): LeaderboardEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem('llm-clinic:leaderboard') ?? '[]');
  } catch {
    return [];
  }
}

export function recordEntry(entry: LeaderboardEntry) {
  const existing = readLeaderboard();
  existing.push(entry);
  window.localStorage.setItem('llm-clinic:leaderboard', JSON.stringify(existing));
}

export default function Leaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  const sorted = [...entries].sort((a, b) => b.overallScore - a.overallScore).slice(0, 15);

  if (sorted.length === 0) {
    return (
      <div className="border border-ink/10 bg-white/40 p-6 rounded-sm text-center">
        <p className="text-sm text-ink/50 font-mono">No evaluation runs recorded in local history.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-ink/15 rounded-sm bg-white/40">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-ink/60 border-b border-ink/15 bg-ink/[0.02]">
            <th className="py-2.5 px-3">Rank</th>
            <th className="py-2.5 px-3">Model</th>
            <th className="py-2.5 px-3">Case</th>
            <th className="py-2.5 px-3">Score</th>
            <th className="py-2.5 px-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/5">
          {sorted.map((e, i) => (
            <tr key={i} className="hover:bg-ink/[0.02] transition-colors">
              <td className="py-2.5 px-3 font-mono text-ink/40 text-xs">{i + 1}</td>
              <td className="py-2.5 px-3 font-medium">
                <span className="text-ink/60 text-xs font-mono mr-1.5">{e.doctorProvider}/</span>
                {e.doctorModel}
              </td>
              <td className="py-2.5 px-3 text-ink/80">{e.caseName}</td>
              <td className="py-2.5 px-3 font-mono font-semibold">
                {e.overallScore}
                <span className="text-xs text-ink/40 font-normal">/100</span>
              </td>
              <td className="py-2.5 px-3">
                {e.reachedDiagnosis ? (
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-chart/15 text-chart">
                    CONFIRMED
                  </span>
                ) : (
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-pulse/15 text-pulse">
                    MISSED
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
