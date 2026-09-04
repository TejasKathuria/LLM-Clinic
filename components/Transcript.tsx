'use client';

import { TranscriptTurn } from '@/lib/matchEngine';

export default function Transcript({ turns }: { turns: TranscriptTurn[] }) {
  return (
    <div className="space-y-2">
      {turns.map((t, i) => (
        <div
          key={i}
          className={`p-3.5 border-l-2 rounded-r-sm text-sm ${
            t.role === 'doctor'
              ? 'border-vitals bg-vitals/[0.04]'
              : 'border-ink/20 bg-white/40'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5 font-mono text-[11px]">
            <span
              className={`uppercase tracking-wider font-semibold ${
                t.role === 'doctor' ? 'text-vitals' : 'text-ink/60'
              }`}
            >
              {t.role === 'doctor' ? 'Physician Action' : 'Patient / Diagnostic Finding'}
            </span>
            <span className="text-ink/40">Turn {t.turn}</span>
          </div>
          <p className="text-xs md:text-sm text-ink/90 leading-relaxed whitespace-pre-wrap font-sans">
            {t.content}
          </p>
        </div>
      ))}
    </div>
  );
}
