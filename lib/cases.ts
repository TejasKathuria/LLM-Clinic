import fs from 'fs';
import path from 'path';

const CASES_DIR = path.join(process.cwd(), 'cases');

export interface CaseSummary {
  id: string;
  disease_category: string;
  display_name: string;
  difficulty: string;
  file: string;
}

/**
 * Scans the cases directory and returns summary metadata for all valid case definitions.
 */
export function listCases(): CaseSummary[] {
  const summaries: CaseSummary[] = [];
  if (!fs.existsSync(CASES_DIR)) return summaries;

  const diseaseDirs = fs.readdirSync(CASES_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const dir of diseaseDirs) {
    const diseasePath = path.join(CASES_DIR, dir.name);
    const files = fs.readdirSync(diseasePath).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const full = path.join(diseasePath, file);
      const data = JSON.parse(fs.readFileSync(full, 'utf-8'));
      summaries.push({
        id: data.id,
        disease_category: data.disease_category,
        display_name: data.display_name,
        difficulty: data.difficulty,
        file: path.join(dir.name, file),
      });
    }
  }
  return summaries;
}

export function loadCaseByFile(relativeFile: string) {
  const full = path.join(CASES_DIR, relativeFile);
  if (!full.startsWith(CASES_DIR)) throw new Error('Invalid case path');
  return JSON.parse(fs.readFileSync(full, 'utf-8'));
}

export function loadCaseById(id: string) {
  const all = listCases();
  const match = all.find((c) => c.id === id);
  if (!match) throw new Error(`Case not found: ${id}`);
  return loadCaseByFile(match.file);
}
