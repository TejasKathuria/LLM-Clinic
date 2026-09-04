'use client';

import { MatchResult } from '@/lib/matchEngine';

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs font-mono mb-1.5">
        <span className="text-ink/70">{label}</span>
        <span className="font-semibold">{value}<span className="text-ink/40 font-normal">/100</span></span>
      </div>
      <div className="h-2 w-full bg-ink/10 rounded-sm overflow-hidden">
        <div
          className="h-full rounded-sm transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function ScoreCard({ result }: { result: MatchResult }) {
  const s = result.score;
  if (!s) {
    return (
      <div className="border border-pulse/30 bg-pulse/5 p-4 text-xs font-mono rounded-sm text-pulse">
        Evaluation score unavailable. Check provider configuration and API key limits.
      </div>
    );
  }

  return (
    <div className="border border-ink/15 bg-white/50 p-5 rounded-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-ink/10">
        <div>
          <span className="font-display text-3xl font-bold">{s.overall_score}</span>
          <span className="text-sm font-mono text-ink/40 ml-1">/100</span>
        </div>
        <span
          className={`font-mono text-xs px-2.5 py-1 rounded-sm uppercase tracking-wider font-medium ${
            s.reached_correct_diagnosis ? 'bg-chart/15 text-chart' : 'bg-pulse/15 text-pulse'
          }`}
        >
          {s.reached_correct_diagnosis ? 'Ground Truth Confirmed' : 'Differential Missed'}
        </span>
      </div>

      <div className="space-y-3">
        <MetricBar label="Diagnostic Accuracy" value={s.diagnostic_accuracy} color="#2f7cb8" />
        <MetricBar label="Treatment Appropriateness" value={s.treatment_appropriateness} color="#1f6f5c" />
        <MetricBar label="Workup Efficiency & Safety" value={s.efficiency_safety} color="#e0563a" />
      </div>

      <div className="border-t border-ink/10 pt-3">
        <p className="text-xs text-ink/80 leading-relaxed font-sans">{s.reasoning}</p>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-ink/5 font-mono text-[11px] text-ink/40">
          <span>{s.turns_taken} turns completed</span>
          <span>Status: {result.ended_reason.replace('_', ' ')}</span>
        </div>
      </div>
    </div>
  );
}
