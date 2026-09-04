# LLM Clinic: Diagnostic Benchmark Arena

An open evaluation framework for benchmarking large language models on interactive clinical diagnosis and management. Models interview a deterministic patient simulation, order diagnostic tests, and establish differential diagnoses under identical constraints.

<img width="960" height="756" alt="LLM Clinic Interface" src="https://github.com/user-attachments/assets/cc7929b1-b4f4-4655-b5aa-e61e0c81eb16" />

## Protocol & Architecture

- **Ground Truth Cases (`/cases/<disease>/*.json`)**: Standardized case specifications containing patient demographics, presenting symptoms, lab and imaging findings, differential progression rules, and hidden ground-truth diagnoses.
- **Deterministic Patient Simulator**: Responds dynamically to history-taking questions and specific test orders based on the case specification without exposing hidden diagnostic labels.
- **Double-Blind Parallel Evaluation**: Doctor A and Doctor B interact with the simulated encounter simultaneously and independently under identical starting conditions.
- **Scorecard & Metrics**: Evaluates transcripts across diagnostic accuracy, treatment appropriateness, test ordering efficiency, and turn count.

## Quickstart

### 1. Installation

```bash
git clone https://github.com/TejasKathuria/LLM-Clinic.git
cd LLM-Clinic
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

### 2. Running an Evaluation

1. Select a clinical case from the dropdown.
2. Choose the model provider and model ID for **Doctor A** and **Doctor B**.
3. Provide an API key for each provider (stored locally in browser storage, sent only to the respective model provider during the run).
4. Click **Run Comparative Benchmark**.

> Note: Free-tier inference is supported out of the box via [Groq](https://console.groq.com). Additional supported providers include OpenAI, Anthropic, Google Gemini, and OpenRouter.

## Adding Clinical Cases

To introduce a new clinical case or disease variant, add a JSON file to `/cases/<disease_name>/case_00N_<variant>.json`. The benchmark engine discovers cases dynamically without code changes.

Case files adhere to the following schema:

```json
{
  "id": "cardiology_001",
  "disease_category": "cardiology",
  "display_name": "Acute Coronary Syndrome (STEMI)",
  "difficulty": "medium",
  "blind_mode_default": true,
  "max_turns": 10,
  "patient_profile": {
    "name": "Patient A",
    "age": 58,
    "sex": "M",
    "occupation": "accountant",
    "history": ["hypertension", "20 pack-year smoking history"],
    "presenting_complaint": "crushing substernal chest pain for 45 minutes, radiating to left jaw and arm"
  },
  "hidden_ground_truth": {
    "diagnosis": "Acute ST-Elevation Myocardial Infarction (STEMI), anterior wall",
    "stage": "acute presentation",
    "correct_first_line_treatment": "immediate cardiology consult for emergent PCI; chew aspirin 325mg, sublingual nitroglycerin, oxygen if SpO2 < 90%",
    "critical_early_tests": ["12-lead ECG", "cardiac troponin I or T", "CBC and basic metabolic panel"],
    "red_herrings": []
  },
  "symptom_presentation": {
    "initial": ["severe crushing chest pressure", "diaphoresis", "shortness of breath", "nausea"],
    "on_direct_questioning": {
      "radiation": "radiates to left shoulder, arm, and jaw",
      "onset": "sudden onset at rest approximately 45 minutes ago"
    }
  },
  "lab_results": {
    "vitals": { "bp": "158/94 mmHg", "hr": "102 bpm", "rr": "22 /min", "spo2": "94% on room air" },
    "ecg": "ST elevation in leads V1-V4 with reciprocal ST depression in II, III, aVF",
    "troponin": "Troponin I: 2.8 ng/mL (reference < 0.04 ng/mL, elevated)"
  },
  "progression_rules": {
    "if_untreated_or_delayed": "risk of cardiogenic shock and malignant arrhythmia within 60-90 minutes",
    "if_correct_treatment": "door-to-balloon time under 90 minutes results in preserved ejection fraction"
  },
  "scoring_notes": {
    "diagnostic_accuracy_weight": 0.40,
    "treatment_appropriateness_weight": 0.35,
    "efficiency_safety_weight": 0.25
  }
}
```

## Adding Model Providers

Providers and models are configured in `lib/providers.ts` using the [Vercel AI SDK](https://sdk.vercel.dev). To add a new provider, register it in `PROVIDERS` and add the provider client mapping to `getModel()`.

## Directory Structure

```
app/
  page.tsx                Client application interface and comparative scorecard
  layout.tsx              Root layout and typography configuration
  globals.css             Color system and theme variables
  api/
    match/route.ts        Simulation orchestration and evaluation handler
    models/route.ts       Available cases and provider metadata endpoint
lib/
  matchEngine.ts          Execution loop and multi-criteria scoring engine
  programmaticPatient.ts  Deterministic keyword query resolver for clinical cases
  prompts.ts              Clinician and evaluation prompts
  providers.ts            Model provider registry and client initialization
  cases.ts                Case loader and validation helpers
cases/
  <disease>/*.json        Structured clinical case definitions
components/
  ModelPicker.tsx         Provider, model, and credential configuration
  ScoreCard.tsx           Multi-dimensional score visualization
  Transcript.tsx          Consultation encounter log
  Leaderboard.tsx         Local run history and benchmark rankings
```

## Disclaimer

This simulation is strictly intended for computational benchmarking and artificial intelligence research. It does not provide medical advice, clinical diagnoses, or treatment recommendations, and must not be used for clinical decision-making.

## License

MIT License. See [LICENSE](LICENSE) for details.
