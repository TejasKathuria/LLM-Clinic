'use client';

import { useEffect, useState } from 'react';
import ModelPicker, { PickerValue } from '@/components/ModelPicker';
import Transcript from '@/components/Transcript';
import ScoreCard from '@/components/ScoreCard';
import Leaderboard, { readLeaderboard, recordEntry, LeaderboardEntry } from '@/components/Leaderboard';
import { CaseSummary } from '@/lib/cases';

const DEFAULT_PICKER = (provider: string, model: string): PickerValue => ({ provider, model, apiKey: '' });

export default function Home() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [providers, setProviders] = useState<Record<string, any>>({});
  const [caseId, setCaseId] = useState<string>('');

  const [doctorA, setDoctorA] = useState<PickerValue>(DEFAULT_PICKER('groq', 'llama-3.3-70b-versatile'));
  const [doctorB, setDoctorB] = useState<PickerValue>(DEFAULT_PICKER('groq', 'llama-3.1-8b-instant'));

  const [running, setRunning] = useState(false);
  const [arenaResult, setArenaResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    fetch('/api/models')
      .then((r) => r.json())
      .then((data) => {
        setCases(data.cases || []);
        setProviders(data.providers || {});
        if (data.cases?.length > 0) setCaseId(data.cases[0].id);
      })
      .catch((err) => {
        console.error('Failed to load initial case data:', err);
      });
    setLeaderboard(readLeaderboard());
  }, []);

  async function runMatch() {
    setRunning(true);
    setError(null);
    setArenaResult(null);

    try {
      const payload = {
        caseId,
        blindMode: true,
        isArena: true,
        doctorA,
        doctorB,
        useProgrammaticPatient: true,
        fastJudge: true,
      };

      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Diagnostic evaluation failed.');

      setArenaResult(data);

      const selectedCase = cases.find((c) => c.id === caseId);
      if (data.doctorA?.score && data.doctorB?.score) {
        const entryA: LeaderboardEntry = {
          caseId,
          caseName: (selectedCase?.display_name ?? caseId) + ' (Doctor A)',
          doctorProvider: doctorA.provider,
          doctorModel: doctorA.model,
          overallScore: data.doctorA.score.overall_score,
          reachedDiagnosis: data.doctorA.score.reached_correct_diagnosis,
          timestamp: Date.now(),
        };
        const entryB: LeaderboardEntry = {
          caseId,
          caseName: (selectedCase?.display_name ?? caseId) + ' (Doctor B)',
          doctorProvider: doctorB.provider,
          doctorModel: doctorB.model,
          overallScore: data.doctorB.score.overall_score,
          reachedDiagnosis: data.doctorB.score.reached_correct_diagnosis,
          timestamp: Date.now(),
        };
        recordEntry(entryA);
        recordEntry(entryB);
        setLeaderboard(readLeaderboard());
      }
    } catch (e: any) {
      setError(e.message ?? 'An unexpected error occurred during evaluation.');
    } finally {
      setRunning(false);
    }
  }

  const selectedCase = cases.find((c) => c.id === caseId);
  const ready = caseId && doctorA.apiKey && doctorB.apiKey && Object.keys(providers).length > 0;

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <header className="mb-10 border-b-2 border-ink pb-6">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink/60 font-semibold">
            Diagnostic Reasoning Benchmark
          </span>
          <span className="font-mono text-[11px] text-ink/40">v0.1.0</span>
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-semibold leading-tight mt-2 text-ink">
          LLM Clinic
        </h1>
        <p className="mt-3 text-ink/75 max-w-2xl leading-relaxed text-sm md:text-base">
          Evaluate language models on multi-turn clinical diagnosis, lab test sequencing, and treatment selection against standardized deterministic patient records.
        </p>
      </header>

      {/* Case Configuration */}
      <section className="grid md:grid-cols-2 gap-8 mb-8">
        <div>
          <label className="font-mono text-xs uppercase tracking-wider text-ink/70 block mb-2 font-semibold">
            Select Clinical Case
          </label>
          <select
            className="w-full border border-ink/20 bg-white/60 px-3 py-2.5 text-sm rounded-sm focus:outline-hidden focus:border-ink/50"
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
          >
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name} [{c.difficulty.toUpperCase()}]
              </option>
            ))}
          </select>
          {selectedCase && (
            <div className="mt-2 flex items-center gap-2 font-mono text-[11px] text-ink/50">
              <span className="uppercase">Category: {selectedCase.disease_category}</span>
              <span>·</span>
              <span className="uppercase">Difficulty: {selectedCase.difficulty}</span>
            </div>
          )}
        </div>

        <div className="chart-rule pt-4 md:pt-0 md:border-t-0 flex flex-col justify-center">
          <div className="text-xs text-ink/70 leading-relaxed space-y-1.5">
            <p className="font-semibold text-ink font-mono uppercase text-[11px] tracking-wider">
              Evaluation Protocol
            </p>
            <p>
              Both clinician models interact in parallel with an identical deterministic patient simulation under blind conditions. The model that establishes the correct diagnosis and management plan with optimal safety and efficiency wins the benchmark.
            </p>
          </div>
        </div>
      </section>

      {/* Model Configuration */}
      <section className="grid md:grid-cols-2 gap-6 mb-8">
        {Object.keys(providers).length > 0 && (
          <>
            <ModelPicker
              label="Doctor A"
              accent="#2f7cb8"
              providers={providers}
              value={doctorA}
              onChange={setDoctorA}
            />
            <ModelPicker
              label="Doctor B"
              accent="#a855f7"
              providers={providers}
              value={doctorB}
              onChange={setDoctorB}
            />
          </>
        )}
      </section>

      {/* Trigger Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={runMatch}
          disabled={!ready || running}
          className="font-mono text-xs uppercase tracking-wider bg-ink text-paper px-6 py-3.5 rounded-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-chart transition-colors cursor-pointer font-semibold shadow-xs"
        >
          {running ? 'Running Diagnostic Evaluation…' : 'Run Comparative Benchmark'}
        </button>

        {!ready && (
          <span className="font-mono text-xs text-ink/40">
            Provide API keys for both Doctor A and Doctor B to start.
          </span>
        )}
      </div>

      {error && (
        <div className="mt-6 border border-pulse/30 bg-pulse/5 p-4 text-xs font-mono rounded-sm text-pulse">
          Error: {error}
        </div>
      )}

      {/* Evaluation Results */}
      {arenaResult && (
        <div className="mt-12 space-y-8">
          <div className="bg-white/60 border border-ink/20 p-6 rounded-sm shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-ink/10 pb-4 mb-4">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-wider text-ink/50 block">
                  Evaluation Outcome
                </span>
                <h2 className="font-display text-2xl font-bold text-ink mt-0.5">
                  Winner: {arenaResult.winner === 'doctorA' ? 'Doctor A' : arenaResult.winner === 'doctorB' ? 'Doctor B' : 'Tie / Equivalent'}
                </h2>
              </div>
              <div className="font-mono text-xs px-3 py-1 bg-ink/5 rounded-sm text-ink/80 self-start md:self-auto">
                Case: {selectedCase?.display_name ?? caseId}
              </div>
            </div>
            <p className="text-sm text-ink/80 leading-relaxed font-sans">
              {arenaResult.winner_reason}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-2 border-b border-[#2f7cb8]/30">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#2f7cb8]" />
                  <h3 className="font-display text-lg font-semibold text-ink">Doctor A</h3>
                </div>
                <span className="font-mono text-xs text-ink/50">
                  {doctorA.provider}/{doctorA.model}
                </span>
              </div>
              <ScoreCard result={arenaResult.doctorA} />
              <div>
                <h4 className="font-mono text-xs uppercase tracking-wider text-ink/60 mb-3 font-semibold">
                  Encounter Transcript
                </h4>
                <Transcript turns={arenaResult.doctorA.transcript} />
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-center pb-2 border-b border-[#a855f7]/30">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#a855f7]" />
                  <h3 className="font-display text-lg font-semibold text-ink">Doctor B</h3>
                </div>
                <span className="font-mono text-xs text-ink/50">
                  {doctorB.provider}/{doctorB.model}
                </span>
              </div>
              <ScoreCard result={arenaResult.doctorB} />
              <div>
                <h4 className="font-mono text-xs uppercase tracking-wider text-ink/60 mb-3 font-semibold">
                  Encounter Transcript
                </h4>
                <Transcript turns={arenaResult.doctorB.transcript} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Local Benchmark History */}
      <section className="mt-16 border-t-2 border-ink pt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold text-ink">Evaluation History</h2>
          <span className="font-mono text-xs text-ink/40">Local Session Records</span>
        </div>
        <Leaderboard entries={leaderboard} />
      </section>

      {/* Footer / Disclaimer */}
      <footer className="mt-16 pt-6 border-t border-ink/10 text-xs text-ink/50 font-sans leading-relaxed flex flex-col md:flex-row justify-between gap-4">
        <p>
          Computational simulation for benchmarking purposes only. Not intended for real clinical advice or decision making.
        </p>
        <p className="font-mono text-ink/40 shrink-0">
          MIT License
        </p>
      </footer>
    </main>
  );
}
