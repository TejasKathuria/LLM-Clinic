import { NextRequest, NextResponse } from 'next/server';
import { loadCaseById } from '@/lib/cases';
import { runMatch, runHeadToHeadMatch } from '@/lib/matchEngine';
import { ModelSelection } from '@/lib/providers';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      caseId,
      blindMode,
      doctor,
      patient,
      judge,
      isArena,
      doctorA,
      doctorB,
      useProgrammaticPatient,
      fastJudge
    } = body as {
      caseId: string;
      blindMode: boolean;
      doctor?: ModelSelection;
      patient?: ModelSelection;
      judge?: ModelSelection;
      isArena?: boolean;
      doctorA?: ModelSelection;
      doctorB?: ModelSelection;
      useProgrammaticPatient?: boolean;
      fastJudge?: boolean;
    };

    if (isArena) {
      if (!caseId || !doctorA?.apiKey || !doctorB?.apiKey) {
        return NextResponse.json(
          { error: 'Missing caseId or one of the Arena doctor model selections + API keys.' },
          { status: 400 }
        );
      }
      if (!fastJudge && !judge?.apiKey) {
        return NextResponse.json(
          { error: 'Missing Judge API key. Please supply a key or enable Fast Judge.' },
          { status: 400 }
        );
      }
    } else {
      if (!caseId || !doctor?.apiKey) {
        return NextResponse.json(
          { error: 'Missing caseId or Doctor model selection + API key.' },
          { status: 400 }
        );
      }
      if (!useProgrammaticPatient && !patient?.apiKey) {
        return NextResponse.json(
          { error: 'Missing Patient API key. Please supply a key or enable Programmatic Patient.' },
          { status: 400 }
        );
      }
      if (!fastJudge && !judge?.apiKey) {
        return NextResponse.json(
          { error: 'Missing Judge API key. Please supply a key or enable Fast Judge.' },
          { status: 400 }
        );
      }
    }

    const caseFile = loadCaseById(caseId);

    if (isArena && doctorA && doctorB) {
      console.log(`Starting Arena Match: Case=${caseId}`);
      console.log(`Doctor A: ${doctorA.provider}:${doctorA.model}`);
      console.log(`Doctor B: ${doctorB.provider}:${doctorB.model}`);
      
      const result = await runHeadToHeadMatch({
        caseFile,
        doctorA,
        doctorB,
        judge,
        blindMode: !!blindMode,
        fastJudge: !!fastJudge,
      });
      return NextResponse.json({ ...result, isArena: true });
    } else if (doctor) {
      console.log(`Starting match: Case=${caseId}, BlindMode=${blindMode}`);
      console.log(`Doctor: Provider=${doctor.provider}, Model=${doctor.model}`);
      console.log(`Patient: Provider=${patient?.provider}, Model=${patient?.model}, Programmatic=${!!useProgrammaticPatient}`);
      console.log(`Judge: Provider=${judge?.provider}, Model=${judge?.model}, Fast=${!!fastJudge}`);

      const result = await runMatch({
        caseFile,
        doctor,
        patient,
        judge,
        blindMode: !!blindMode,
        useProgrammaticPatient: !!useProgrammaticPatient,
        fastJudge: !!fastJudge,
      });
      return NextResponse.json({ ...result, isArena: false });
    }

    return NextResponse.json({ error: 'Invalid match request payload.' }, { status: 400 });
  } catch (err: any) {
    console.error('Match error details:', err);
    let message = err?.message ?? 'Unknown error running match.';
    
    const isRateLimited = err?.statusCode === 429 || 
                          message.includes('429') || 
                          (err?.responseBody && err.responseBody.includes('429')) ||
                          (err?.errors && err.errors.some((e: any) => e?.statusCode === 429 || (e?.responseBody && e.responseBody.includes('429'))));
                          
    const isUnauthorized = err?.statusCode === 401 || 
                           message.includes('401') || 
                           (err?.responseBody && err.responseBody.includes('401')) ||
                           (err?.errors && err.errors.some((e: any) => e?.errors && e.errors.some((e2: any) => e2?.statusCode === 401 || (e2?.responseBody && e2.responseBody.includes('401')))));

    const isTimeout = err?.name === 'TimeoutError' || 
                      message.includes('timeout') || 
                      message.includes('aborted') ||
                      (err?.errors && err.errors.some((e: any) => e?.name === 'TimeoutError' || e?.message?.includes('timeout')));

    if (isRateLimited) {
      message = 'One of the selected AI models is temporarily rate-limited (HTTP 429). Please wait a moment or try another model.';
    } else if (isUnauthorized) {
      message = 'Authentication failed (HTTP 401). Please verify that your API keys are correct.';
    } else if (isTimeout) {
      message = 'The AI model took too long to respond (timed out). The API provider might be overloaded. Please try another model or try again.';
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
