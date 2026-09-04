import { NextResponse } from 'next/server';
import { listCases } from '@/lib/cases';
import { PROVIDERS } from '@/lib/providers';

export async function GET() {
  return NextResponse.json({
    cases: listCases(),
    providers: PROVIDERS,
  });
}
