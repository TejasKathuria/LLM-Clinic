import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';

// Supported inference providers and default model configurations.
export const PROVIDERS = {
  anthropic: {
    label: 'Anthropic',
    models: ['claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-opus-4-6'],
    free: false,
  },
  openai: {
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1'],
    free: false,
  },
  google: {
    label: 'Google',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
    free: false,
  },
  groq: {
    label: 'Groq (Free tier available)',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    free: true,
  },
  openrouter: {
    label: 'OpenRouter',
    models: [
      'meta-llama/llama-3.3-70b-instruct',
      'deepseek/deepseek-chat',
      'google/gemini-2.5-flash',
      'google/gemini-2.5-pro',
      'anthropic/claude-3.5-sonnet',
    ],
    free: false,
  },
} as const;

export type ProviderId = keyof typeof PROVIDERS;

/**
 * Initializes a model client for the specified provider with client-supplied credentials.
 */
export function getModel(providerId: ProviderId, modelName: string, apiKey: string) {
  switch (providerId) {
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(modelName);
    }
    case 'openai': {
      const openai = createOpenAI({ apiKey });
      return openai(modelName);
    }
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(modelName);
    }
    case 'groq': {
      const groq = createGroq({ apiKey });
      return groq(modelName);
    }
    case 'openrouter': {
      const openrouter = createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey,
        headers: {
          'HTTP-Referer': 'https://github.com/TejasKathuria/LLM-Clinic',
          'X-Title': 'LLM Clinic',
        },
      });
      return openrouter(modelName);
    }
    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
}

export interface ModelSelection {
  provider: ProviderId;
  model: string;
  apiKey: string;
}
