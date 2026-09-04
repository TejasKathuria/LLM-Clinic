import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import { getModel, ModelSelection } from './providers';
import { patientSystemPrompt, doctorSystemPrompt, judgeSystemPrompt } from './prompts';
import { getProgrammaticResponse } from './programmaticPatient';

export interface TranscriptTurn {
  turn: number;
  role: 'doctor' | 'patient';
  content: string;
}

export const judgeSchema = z.object({
  diagnostic_accuracy: z.number().min(0).max(100),
  treatment_appropriateness: z.number().min(0).max(100),
  efficiency_safety: z.number().min(0).max(100),
  overall_score: z.number().min(0).max(100),
  turns_taken: z.number(),
  reached_correct_diagnosis: z.boolean(),
  reasoning: z.string(),
});

export type JudgeScore = z.infer<typeof judgeSchema>;

export interface MatchResult {
  transcript: TranscriptTurn[];
  score: JudgeScore | null;
  ended_reason: 'final_diagnosis' | 'max_turns' | 'error';
}

function extractJsonBlock(text: string): string {
  const backtickMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (backtickMatch && backtickMatch[1]) {
    return backtickMatch[1].trim();
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start, end + 1).trim();
  }
  return text.trim();
}

async function parseAndValidateScore(
  text: string,
  judgeModel: any,
  promptContent: string
): Promise<JudgeScore> {
  const cleaned = extractJsonBlock(text);
  try {
    const parsed = JSON.parse(cleaned);
    return judgeSchema.parse(parsed);
  } catch (err: any) {
    console.warn('Initial schema validation failed. Attempting single retry with schema formatting:', err?.message);
    const retryResp = await generateText({
      model: judgeModel,
      abortSignal: AbortSignal.timeout(45000),
      system: `You are a helper utility formatting evaluation scores into strictly valid JSON.
Output ONLY valid, parseable JSON conforming to this schema:
{
  "diagnostic_accuracy": number (0-100),
  "treatment_appropriateness": number (0-100),
  "efficiency_safety": number (0-100),
  "overall_score": number (0-100),
  "turns_taken": number,
  "reached_correct_diagnosis": boolean,
  "reasoning": string
}`,
      messages: [
        {
          role: 'user',
          content: `Reformat the following output to conform to the JSON schema:\n---\n${text}\n---`,
        },
      ],
    });

    const retryCleaned = extractJsonBlock(retryResp.text);
    const retryParsed = JSON.parse(retryCleaned);
    return judgeSchema.parse(retryParsed);
  }
}

export function programmaticFallbackScore(caseFile: any, transcript: TranscriptTurn[]): JudgeScore {
  const doctorTurns = transcript.filter((t) => t.role === 'doctor');
  if (doctorTurns.length === 0) {
    return {
      diagnostic_accuracy: 0,
      treatment_appropriateness: 0,
      efficiency_safety: 50,
      overall_score: 15,
      turns_taken: transcript.length,
      reached_correct_diagnosis: false,
      reasoning: 'No physician actions recorded during the encounter.',
    };
  }

  const finalDoctorTurn = doctorTurns[doctorTurns.length - 1].content.toLowerCase();
  const diagnosisLower = caseFile.hidden_ground_truth.diagnosis.toLowerCase();

  const stopWords = new Set(['acute', 'secondary', 'to', 'the', 'a', 'an', 'and', 'or', 'of', 'in', 'with', 'for', 'atypical', 'classic', 'stage', 'phase']);
  const diagWords = diagnosisLower
    .replace(/[()]/g, '')
    .split(/[\s,-]+/)
    .map((w: string) => w.trim())
    .filter((w: string) => w.length > 2 && !stopWords.has(w));

  let matchedDiagWords = 0;
  let reachedDiagnosis = false;
  let diagnosticAccuracy = 0;

  if (diagWords.length > 0) {
    for (const word of diagWords) {
      if (finalDoctorTurn.includes(word)) {
        matchedDiagWords++;
      }
    }
    const matchRatio = matchedDiagWords / diagWords.length;
    if (matchRatio >= 0.5) {
      reachedDiagnosis = true;
      diagnosticAccuracy = Math.round(50 + matchRatio * 50);
    } else {
      diagnosticAccuracy = Math.round(matchRatio * 80);
    }
  }

  const treatmentLower = caseFile.hidden_ground_truth.correct_first_line_treatment.toLowerCase();
  const rxWords = treatmentLower
    .replace(/[()]/g, '')
    .split(/[\s,-]+/)
    .map((w: string) => w.trim())
    .filter((w: string) => w.length > 2 && !stopWords.has(w));

  let matchedRxWords = 0;
  let treatmentAppropriateness = 0;
  if (rxWords.length > 0) {
    for (const word of rxWords) {
      const mentionedInHistory = doctorTurns.some((t) => t.content.toLowerCase().includes(word));
      if (mentionedInHistory) {
        matchedRxWords++;
      }
    }
    const rxRatio = matchedRxWords / rxWords.length;
    treatmentAppropriateness = Math.round(rxRatio * 100);
  }

  const maxTurns = caseFile.max_turns ?? 10;
  const turnsTaken = doctorTurns.length;
  const turnPenalty = Math.max(0, (turnsTaken / maxTurns) * 30);
  let efficiencySafety = Math.round(100 - turnPenalty);

  const criticalTests = caseFile.hidden_ground_truth.critical_early_tests || [];
  let matchedTests = 0;
  if (criticalTests.length > 0) {
    for (const test of criticalTests) {
      const testLower = test.toLowerCase();
      const testWords = testLower.split(/\s+/).filter((w: string) => w.length > 2 && !stopWords.has(w));
      const testOrdered = doctorTurns.some((t) => {
        const content = t.content.toLowerCase();
        return testWords.every((w: string) => content.includes(w));
      });
      if (testOrdered) {
        matchedTests++;
      }
    }
    const testRatio = matchedTests / criticalTests.length;
    efficiencySafety = Math.round(efficiencySafety * (0.5 + 0.5 * testRatio));
  }

  const weights = caseFile.scoring_notes ?? {
    diagnostic_accuracy_weight: 0.33,
    treatment_appropriateness_weight: 0.33,
    efficiency_safety_weight: 0.34,
  };

  const overallScore = Math.round(
    diagnosticAccuracy * (weights.diagnostic_accuracy_weight ?? 0.33) +
    treatmentAppropriateness * (weights.treatment_appropriateness_weight ?? 0.33) +
    efficiencySafety * (weights.efficiency_safety_weight ?? 0.34)
  );

  return {
    diagnostic_accuracy: diagnosticAccuracy,
    treatment_appropriateness: treatmentAppropriateness,
    efficiency_safety: efficiencySafety,
    overall_score: Math.min(100, Math.max(0, overallScore)),
    turns_taken: turnsTaken,
    reached_correct_diagnosis: reachedDiagnosis,
    reasoning: `Standard evaluation rubric: matched ${matchedDiagWords}/${diagWords.length} primary diagnostic terms, ${matchedRxWords}/${rxWords.length} treatment elements, and ${matchedTests}/${criticalTests.length} recommended diagnostic studies.`,
  };
}

async function scoreMatch(opts: {
  judgeModel: any;
  caseFile: any;
  transcript: TranscriptTurn[];
}): Promise<JudgeScore> {
  const { judgeModel, caseFile, transcript } = opts;
  const promptContent = `HIDDEN CASE FILE:\n${JSON.stringify(caseFile, null, 2)}\n\nTRANSCRIPT:\n${transcript
    .map((t) => `[Turn ${t.turn}] ${t.role.toUpperCase()}: ${t.content}`)
    .join('\n')}`;

  try {
    const response = await generateObject({
      model: judgeModel,
      schema: judgeSchema,
      system: judgeSystemPrompt(),
      messages: [{ role: 'user', content: promptContent }],
      abortSignal: AbortSignal.timeout(45000),
    });
    return response.object;
  } catch (err: any) {
    console.warn('generateObject fallback to generateText:', err?.message);
  }

  try {
    const responseText = await generateText({
      model: judgeModel,
      system: judgeSystemPrompt(),
      messages: [{ role: 'user', content: promptContent }],
      abortSignal: AbortSignal.timeout(45000),
    });
    return await parseAndValidateScore(responseText.text, judgeModel, promptContent);
  } catch (err: any) {
    console.error('LLM evaluation unavailable, utilizing standard programmatic rubric:', err?.message);
    return programmaticFallbackScore(caseFile, transcript);
  }
}

const FINAL_MARKERS = ['final diagnosis', 'my diagnosis is', 'diagnosis:'];

function looksLikeFinalAnswer(text: string) {
  const lower = text.toLowerCase();
  return FINAL_MARKERS.some((m) => lower.includes(m));
}

export async function runMatch(opts: {
  caseFile: any;
  doctor: ModelSelection;
  patient?: ModelSelection;
  judge?: ModelSelection;
  blindMode: boolean;
  useProgrammaticPatient?: boolean;
  fastJudge?: boolean;
  label?: string;
}): Promise<MatchResult> {
  const { caseFile, doctor, patient, judge, blindMode, useProgrammaticPatient, fastJudge } = opts;
  const label = opts.label ?? `Doctor(${doctor.provider}:${doctor.model})`;
  const maxTurns = caseFile.max_turns ?? 10;

  const doctorModel = getModel(doctor.provider, doctor.model, doctor.apiKey);
  const patientModel = (!useProgrammaticPatient && patient)
    ? getModel(patient.provider, patient.model, patient.apiKey)
    : null;
  const judgeModel = (!fastJudge && judge)
    ? getModel(judge.provider, judge.model, judge.apiKey)
    : null;

  const doctorSys = doctorSystemPrompt(blindMode, caseFile.disease_category);
  const patientSys = (!useProgrammaticPatient) ? patientSystemPrompt(caseFile) : null;

  const doctorHistory: { role: 'user' | 'assistant'; content: string }[] = [];
  const patientHistory: { role: 'user' | 'assistant'; content: string }[] = [];

  const transcript: TranscriptTurn[] = [];

  // Patient opens encounter with presenting complaint.
  let opening = '';
  if (useProgrammaticPatient) {
    opening = `Patient presents with chief complaint: ${caseFile.patient_profile.presenting_complaint}`;
  } else if (patientModel && patientSys) {
    const openingPatient = await generateText({
      model: patientModel,
      system: patientSys,
      messages: [{ role: 'user', content: 'Begin the clinical encounter.' }],
      abortSignal: AbortSignal.timeout(45000),
    });
    opening = openingPatient.text.trim();
  } else {
    opening = `Chief complaint: ${caseFile.patient_profile.presenting_complaint}`;
  }

  transcript.push({ turn: 0, role: 'patient', content: opening });
  doctorHistory.push({ role: 'user', content: `Patient presentation: ${opening}` });
  if (!useProgrammaticPatient) {
    patientHistory.push({ role: 'assistant', content: opening });
  }

  let endedReason: MatchResult['ended_reason'] = 'max_turns';

  for (let t = 1; t <= maxTurns; t++) {
    // Physician action turn
    let doctorResp;
    try {
      doctorResp = await generateText({
        model: doctorModel,
        system: doctorSys,
        messages: doctorHistory,
        abortSignal: AbortSignal.timeout(45000),
      });
    } catch (e: any) {
      console.error(`[${label}] Turn ${t} request failed:`, e?.message);
      throw e;
    }

    const doctorText = doctorResp.text.trim();
    transcript.push({ turn: t, role: 'doctor', content: doctorText });
    doctorHistory.push({ role: 'assistant', content: doctorText });
    if (!useProgrammaticPatient) {
      patientHistory.push({ role: 'user', content: doctorText });
    }

    if (looksLikeFinalAnswer(doctorText)) {
      endedReason = 'final_diagnosis';
      break;
    }

    // Patient and diagnostic report turn
    let patientText = '';
    if (useProgrammaticPatient) {
      patientText = getProgrammaticResponse(caseFile, doctorText);
    } else if (patientModel && patientSys) {
      const patientResp = await generateText({
        model: patientModel,
        system: patientSys,
        messages: patientHistory,
        abortSignal: AbortSignal.timeout(45000),
      });
      patientText = patientResp.text.trim();
    }

    transcript.push({ turn: t, role: 'patient', content: patientText });
    doctorHistory.push({ role: 'user', content: `Patient / diagnostic findings: ${patientText}` });
    if (!useProgrammaticPatient) {
      patientHistory.push({ role: 'assistant', content: patientText });
    }
  }

  // Score encounter against case ground truth
  let score: MatchResult['score'] = null;
  try {
    if (fastJudge || !judgeModel) {
      score = programmaticFallbackScore(caseFile, transcript);
    } else {
      score = await scoreMatch({ judgeModel, caseFile, transcript });
    }
  } catch (err: any) {
    console.error('Scoring error:', err?.message);
    endedReason = endedReason === 'max_turns' ? 'error' : endedReason;
    score = programmaticFallbackScore(caseFile, transcript);
  }

  return { transcript, score, ended_reason: endedReason };
}

export interface HeadToHeadResult {
  doctorA: MatchResult;
  doctorB: MatchResult;
  winner: 'doctorA' | 'doctorB' | 'tie';
  winner_reason: string;
}

export async function runHeadToHeadMatch(opts: {
  caseFile: any;
  doctorA: ModelSelection;
  doctorB: ModelSelection;
  judge?: ModelSelection;
  blindMode: boolean;
  fastJudge?: boolean;
}): Promise<HeadToHeadResult> {
  const { caseFile, doctorA, doctorB, judge, blindMode, fastJudge } = opts;

  // Execute Doctor A and Doctor B in parallel under identical deterministic patient conditions
  const [resA, resB] = await Promise.all([
    runMatch({
      caseFile,
      doctor: doctorA,
      judge,
      blindMode,
      useProgrammaticPatient: true,
      fastJudge,
      label: 'Doctor A',
    }).catch((err) => {
      console.error('Doctor A encountered an execution error:', err?.message);
      return {
        transcript: [
          { turn: 0, role: 'patient' as const, content: `Chief complaint: ${caseFile.patient_profile.presenting_complaint}` },
          { turn: 1, role: 'doctor' as const, content: `[Model Execution Failed: ${err?.message || 'Inference error'}]` },
        ],
        score: null,
        ended_reason: 'error' as const,
      };
    }),
    runMatch({
      caseFile,
      doctor: doctorB,
      judge,
      blindMode,
      useProgrammaticPatient: true,
      fastJudge,
      label: 'Doctor B',
    }).catch((err) => {
      console.error('Doctor B encountered an execution error:', err?.message);
      return {
        transcript: [
          { turn: 0, role: 'patient' as const, content: `Chief complaint: ${caseFile.patient_profile.presenting_complaint}` },
          { turn: 1, role: 'doctor' as const, content: `[Model Execution Failed: ${err?.message || 'Inference error'}]` },
        ],
        score: null,
        ended_reason: 'error' as const,
      };
    }),
  ]);

  const scoreA = resA.score;
  const scoreB = resB.score;

  if (resA.ended_reason === 'error' && resB.ended_reason === 'error') {
    throw new Error('Both models failed to complete the evaluation due to API rate limits or connection errors.');
  }

  let winner: HeadToHeadResult['winner'] = 'tie';
  let reason = '';

  if (!scoreA && !scoreB) {
    winner = 'tie';
    reason = 'Neither model generated a valid evaluation transcript.';
  } else if (scoreA && !scoreB) {
    winner = 'doctorA';
    reason = `Doctor A completed the diagnostic evaluation successfully (${scoreA.overall_score}/100); Doctor B encountered an upstream inference error.`;
  } else if (!scoreA && scoreB) {
    winner = 'doctorB';
    reason = `Doctor B completed the diagnostic evaluation successfully (${scoreB.overall_score}/100); Doctor A encountered an upstream inference error.`;
  } else if (scoreA && scoreB) {
    const accuracyA = scoreA.reached_correct_diagnosis;
    const accuracyB = scoreB.reached_correct_diagnosis;

    if (accuracyA && !accuracyB) {
      winner = 'doctorA';
      reason = 'Doctor A successfully identified the correct diagnosis; Doctor B failed to reach the primary differential.';
    } else if (!accuracyA && accuracyB) {
      winner = 'doctorB';
      reason = 'Doctor B successfully identified the correct diagnosis; Doctor A failed to reach the primary differential.';
    } else {
      const scoreDiff = scoreA.overall_score - scoreB.overall_score;
      if (Math.abs(scoreDiff) >= 5) {
        if (scoreDiff > 0) {
          winner = 'doctorA';
          reason = `Doctor A scored higher overall (${scoreA.overall_score}/100 vs ${scoreB.overall_score}/100).`;
        } else {
          winner = 'doctorB';
          reason = `Doctor B scored higher overall (${scoreB.overall_score}/100 vs ${scoreA.overall_score}/100).`;
        }
      } else {
        const turnDiff = scoreA.turns_taken - scoreB.turns_taken;
        if (turnDiff < 0) {
          winner = 'doctorA';
          reason = `Doctor A established the target diagnosis with greater efficiency (${scoreA.turns_taken} turns vs ${scoreB.turns_taken} turns).`;
        } else if (turnDiff > 0) {
          winner = 'doctorB';
          reason = `Doctor B established the target diagnosis with greater efficiency (${scoreB.turns_taken} turns vs ${scoreA.turns_taken} turns).`;
        } else {
          winner = 'tie';
          reason = `Both models demonstrated equivalent performance across accuracy (${scoreA.overall_score}/100 vs ${scoreB.overall_score}/100) and turn count.`;
        }
      }
    }
  }

  return {
    doctorA: resA,
    doctorB: resB,
    winner,
    winner_reason: reason,
  };
}
