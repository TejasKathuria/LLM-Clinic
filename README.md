# LLM-Clinic
SimCity for AI doctors. Pick a disease, pick which model plays the doctor, and watch it work up and treat a simulated patient, scored against a hidden ground-truth chart. Any provider, any model, bring your own API key.

## What is this?
 
Three LLMs, three roles, one hidden case file:
 
| Role | Who plays it | What it does |
|---|---|---|
| **Patient** | An LLM seeded with a hidden case file | Role-plays symptoms and lab/imaging results — never reveals the diagnosis directly |
| **Doctor** | The model under test | Asks questions, orders tests, proposes treatment, and states a final diagnosis |
| **Judge** | A third LLM | Scores the finished transcript against the hidden case on accuracy, treatment, and efficiency |
 
Any of the three can be a different model from a different provider. That's the whole point, for example put Claude as doctor and GPT as doctor on the *exact same patient* and see who does better.
