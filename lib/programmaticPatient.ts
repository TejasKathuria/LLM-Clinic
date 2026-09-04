/**
 * Deterministic Clinical Simulation Engine
 * Matches clinician inquiries and test orders directly against the case specification
 * without external model latency or hallucination.
 */
export function getProgrammaticResponse(caseFile: any, doctorText: string): string {
  const query = doctorText.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. Initial presenting complaint & history of present illness
  if (
    query.includes('complaint') ||
    query.includes('symptom') ||
    query.includes('feel') ||
    query.includes('brings you in') ||
    query.includes('presenting') ||
    query.includes('what is wrong') ||
    query.includes('started') ||
    query.includes('happen') ||
    query.includes('begin') ||
    query.includes('onset')
  ) {
    const complaint = caseFile.patient_profile?.presenting_complaint ?? '';
    const initialSymptoms = caseFile.symptom_presentation?.initial?.join(', ') ?? '';
    return `PATIENT: Chief complaint: ${complaint}. Symptoms noted: ${initialSymptoms}.`;
  }

  // 2. Vital signs
  if (
    query.includes('vital') ||
    query.includes('temperature') ||
    query.includes('temp') ||
    query.includes('blood pressure') ||
    query.includes(' bp ') ||
    query.includes('heart rate') ||
    query.includes('pulse') ||
    query.includes('respiratory rate') ||
    query.includes(' rr ') ||
    query.includes('spo2') ||
    query.includes('oxygen') ||
    query.includes('o2 sat')
  ) {
    if (caseFile.lab_results?.vitals) {
      const v = caseFile.lab_results.vitals;
      if (typeof v === 'object') {
        return `VITALS: ${Object.entries(v)
          .map(([k, val]) => `${k.toUpperCase()}: ${val}`)
          .join(', ')}`;
      }
      return `VITALS: ${v}`;
    }
    if (caseFile.lab_results?.physical_exam?.vitals) {
      return `VITALS: ${JSON.stringify(caseFile.lab_results.physical_exam.vitals)}`;
    }
  }

  // 3. Physical Examination
  if (
    query.includes('physical exam') ||
    query.includes('examine') ||
    query.includes('palpat') ||
    query.includes('auscultat') ||
    query.includes('listen') ||
    query.includes('lungs') ||
    query.includes('abdomen') ||
    query.includes('heart') ||
    query.includes('steth') ||
    query.includes('pupils') ||
    query.includes('neck') ||
    query.includes('nuchal') ||
    query.includes('kernig') ||
    query.includes('brudzinski') ||
    query.includes('stridor') ||
    query.includes('psoas')
  ) {
    if (caseFile.lab_results?.physical_exam) {
      const pe = caseFile.lab_results.physical_exam;
      if (typeof pe === 'object') {
        if ((query.includes('lung') || query.includes('breath') || query.includes('respirat')) && pe.respiratory) {
          return `PHYSICAL EXAM (Respiratory): ${pe.respiratory}`;
        }
        if ((query.includes('abdomen') || query.includes('belly') || query.includes('tender')) && pe.general) {
          return `PHYSICAL EXAM (Abdomen): ${pe.general}`;
        }
        return `PHYSICAL EXAM: ${Object.entries(pe)
          .map(([k, val]) => `${k.toUpperCase()}: ${val}`)
          .join('; ')}`;
      }
      return `PHYSICAL EXAM: ${pe}`;
    }
  }

  // 4. Diagnostic tests and lab panels
  const labResults = caseFile.lab_results || {};
  const labKeys = Object.keys(labResults);

  for (const key of labKeys) {
    const normKey = key.toLowerCase();
    let isMatch = query.includes(normKey);

    if (!isMatch) {
      switch (normKey) {
        case 'cbc':
          isMatch = query.includes('blood count') || query.includes('hemoglobin') || query.includes('wbc') || query.includes('platelet') || query.includes('leukocyte');
          break;
        case 'bmp':
          isMatch = query.includes('metabolic panel') || query.includes('electrolytes') || query.includes('creatinine') || query.includes('chem');
          break;
        case 'ecg':
        case 'ekg':
          isMatch = query.includes('ecg') || query.includes('ekg') || query.includes('electrocardiogram') || query.includes('tracing');
          break;
        case 'troponin':
          isMatch = query.includes('troponin') || query.includes('cardiac enzyme') || query.includes('cardiac marker');
          break;
        case 'urinalysis':
          isMatch = query.includes('urine') || query.includes('urinalysis') || query.includes('ua');
          break;
        case 'csf_analysis':
          isMatch = query.includes('csf') || query.includes('lumbar puncture') || query.includes('spinal tap') || query.includes('cerebrospinal');
          break;
        case 'ct_head':
          isMatch = (query.includes('head') || query.includes('brain')) && query.includes('ct');
          break;
        case 'ct_abdomen_pelvis':
          isMatch = query.includes('ct') && (query.includes('abdomen') || query.includes('pelvis') || query.includes('abdominal'));
          break;
        case 'chest_ct':
        case 'chest_ct_with_contrast':
          isMatch = query.includes('ct') && (query.includes('chest') || query.includes('thorax') || query.includes('thoracic'));
          break;
        case 'chest_xray':
          isMatch = query.includes('xray') || query.includes('x-ray') || query.includes('cxr') || query.includes('radiograph');
          break;
        case 'neck_xray':
          isMatch = (query.includes('xray') || query.includes('x-ray') || query.includes('radiograph')) && query.includes('neck');
          break;
        case 'pulse_oximetry':
          isMatch = query.includes('pulse ox') || query.includes('oximetry') || query.includes('saturation');
          break;
        case 'biopsy':
          isMatch = query.includes('biopsy') || query.includes('histopathology') || query.includes('bronchoscopy') || query.includes('tissue');
          break;
        case 'pet_scan':
          isMatch = query.includes('pet scan') || query.includes('pet');
          break;
        case 'blood_cultures':
          isMatch = query.includes('blood culture') || query.includes('cultures');
          break;
        case 'lactate':
          isMatch = query.includes('lactate') || query.includes('lactic');
          break;
        case 'crp':
          isMatch = query.includes('crp') || query.includes('c-reactive') || query.includes('esr') || query.includes('inflammatory');
          break;
        case 'renal_function':
          isMatch = query.includes('renal') || query.includes('kidney') || query.includes('gfr') || query.includes('bun');
          break;
      }
    }

    if (isMatch) {
      const val = labResults[key];
      if (typeof val === 'object') {
        return `LAB REPORT [${key.toUpperCase()}]: ${Object.entries(val)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')}`;
      }
      return `LAB REPORT [${key.toUpperCase()}]: ${val}`;
    }
  }

  // 5. Direct history questioning
  const directQuestions = caseFile.symptom_presentation?.on_direct_questioning || {};
  for (const key of Object.keys(directQuestions)) {
    const normKey = key.toLowerCase().replace(/_/g, ' ');
    const keyWords = normKey.split(' ');

    const isMatch =
      keyWords.every((w) => query.includes(w)) ||
      (key === 'chest_pain' && query.includes('chest') && query.includes('pain')) ||
      (key === 'classic_rlq_pain' && (query.includes('rlq') || query.includes('right lower') || query.includes('mcburney'))) ||
      (key === 'shortness_of_breath' && (query.includes('shortness') || query.includes('breath') || query.includes('sob') || query.includes('dyspnea'))) ||
      (key === 'urinary_symptoms' && (query.includes('urination') || query.includes('urine') || query.includes('dysuria') || query.includes('burning'))) ||
      (key === 'menstrual_history' && (query.includes('period') || query.includes('menstrual') || query.includes('pregnant') || query.includes('pregnancy')));

    if (isMatch) {
      return `PATIENT: ${directQuestions[key]}`;
    }
  }

  // 6. Medical and family history
  if (
    query.includes('history') ||
    query.includes('past medical') ||
    query.includes('medical history') ||
    query.includes('smoke') ||
    query.includes('smoking') ||
    query.includes('pack-year') ||
    query.includes('family') ||
    query.includes('parents') ||
    query.includes('medication') ||
    query.includes('meds') ||
    query.includes('drug') ||
    query.includes('hypertension') ||
    query.includes('diabetes')
  ) {
    const history = caseFile.patient_profile?.history || [];
    return `PATIENT: Past medical history: ${history.join('. ')}.`;
  }

  // 7. Neutral default response
  return "PATIENT: No significant findings or symptoms noted in that area, Doctor.";
}
