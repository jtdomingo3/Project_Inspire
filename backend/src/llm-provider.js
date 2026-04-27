import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createXai } from '@ai-sdk/xai';

import { supportedModels } from './config.js';

export const llmProviderLabels = {
  openrouter: 'OpenRouter',
  openai: 'OpenAI',
  anthropic: 'Claude',
  google: 'Gemini',
  xai: 'Grok'
};

export const llmProviderApiKeyFields = {
  openrouter: 'openrouter_api_key',
  openai: 'openai_api_key',
  anthropic: 'anthropic_api_key',
  google: 'google_api_key',
  xai: 'xai_api_key'
};

const openRouterAllModels = supportedModels.filter((model) => typeof model === 'string' && model.trim());
const openRouterFreeModels = openRouterAllModels.filter((model) => model.includes(':free'));

const providerModelPresets = {
  openrouter: openRouterAllModels,
  openai: ['gpt-4o-mini', 'gpt-4o', 'o1-preview', 'o1-mini'],
  anthropic: ['claude-3-5-haiku-20241022', 'claude-3-5-haiku', 'claude-3-haiku-20240307', 'claude-3-5-sonnet-latest', 'claude-3-5-sonnet-20241022'],
  google: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-pro-latest'],
  xai: ['grok-2-mini', 'grok-2-1212', 'grok-beta']
};

export function trimOptional(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function hasValue(value) {
  return Boolean(trimOptional(value));
}

function uniqueList(values) {
  const seen = new Set();
  const result = [];
  for (const raw of values) {
    const value = trimOptional(raw);
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

export function normalizeLlmProvider(value) {
  const normalized = trimOptional(value).toLowerCase();
  if (Object.prototype.hasOwnProperty.call(llmProviderLabels, normalized)) {
    return normalized;
  }
  return 'openrouter';
}

export function getLlmProviderOptions() {
  return Object.entries(llmProviderLabels).map(([id, label]) => ({ id, label }));
}

export function getDefaultUserLlmSettings(userId = 1) {
  return {
    user_id: Number(userId || 1),
    provider: 'openrouter',
    preferred_model: '',
    openrouter_api_key: '',
    openai_api_key: '',
    anthropic_api_key: '',
    google_api_key: '',
    xai_api_key: ''
  };
}

function getOpenRouterModelListForSettings(settings) {
  const hasUserOverride = hasValue(settings?.openrouter_api_key);
  const hasManagedKey = hasValue(process.env.OPENROUTER_API_KEY);

  if (!hasUserOverride && hasManagedKey && openRouterFreeModels.length > 0) {
    return openRouterFreeModels;
  }

  return openRouterAllModels.length > 0 ? openRouterAllModels : openRouterFreeModels;
}

export function buildModelListForProvider(provider, settings = {}) {
  const normalizedProvider = normalizeLlmProvider(provider);

  const presetModels = normalizedProvider === 'openrouter'
    ? getOpenRouterModelListForSettings(settings)
    : (providerModelPresets[normalizedProvider] || []);

  const preferredModel = trimOptional(settings.preferred_model);
  return uniqueList([preferredModel, ...presetModels]);
}

function maskApiKey(raw) {
  const value = trimOptional(raw);
  if (!value) {
    return '';
  }

  if (value.length <= 8) {
    return '****';
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function sanitizeStoredLlmSettings(settings) {
  const merged = {
    ...getDefaultUserLlmSettings(settings?.user_id || 1),
    ...(settings || {})
  };

  const provider = normalizeLlmProvider(merged.provider);
  const usingManagedOpenRouterKey = !hasValue(merged.openrouter_api_key) && hasValue(process.env.OPENROUTER_API_KEY);

  return {
    provider,
    provider_label: llmProviderLabels[provider],
    preferred_model: trimOptional(merged.preferred_model),
    has_openrouter_api_key: hasValue(merged.openrouter_api_key),
    has_openai_api_key: hasValue(merged.openai_api_key),
    has_anthropic_api_key: hasValue(merged.anthropic_api_key),
    has_google_api_key: hasValue(merged.google_api_key),
    has_xai_api_key: hasValue(merged.xai_api_key),
    openrouter_api_key_masked: maskApiKey(merged.openrouter_api_key),
    openai_api_key_masked: maskApiKey(merged.openai_api_key),
    anthropic_api_key_masked: maskApiKey(merged.anthropic_api_key),
    google_api_key_masked: maskApiKey(merged.google_api_key),
    xai_api_key_masked: maskApiKey(merged.xai_api_key),
    using_managed_openrouter_key: usingManagedOpenRouterKey
  };
}

function getApiKeyForProvider(settings, provider) {
  if (provider === 'openrouter') {
    return trimOptional(settings.openrouter_api_key) || trimOptional(process.env.OPENROUTER_API_KEY);
  }

  const field = llmProviderApiKeyFields[provider];
  return field ? trimOptional(settings[field]) : '';
}

export function buildMissingApiKeyMessage(provider) {
  if (provider === 'openrouter') {
    return 'OpenRouter key is not available. Add your own OpenRouter API key in Profile > LLM Settings, or configure OPENROUTER_API_KEY on the backend.';
  }

  const label = llmProviderLabels[provider] || provider;
  return `${label} is selected, but no API key is configured. Add your ${label} API key in Profile > LLM Settings.`;
}

function pickModelForRuntime({ provider, settings, requestedModel, modelOptions }) {
  const requested = trimOptional(requestedModel);
  const preferred = trimOptional(settings.preferred_model);
  const hasManagedOpenRouterKey = provider === 'openrouter'
    && !hasValue(settings.openrouter_api_key)
    && hasValue(process.env.OPENROUTER_API_KEY);

  // If the provider is NOT OpenRouter, but the requested model looks like an OpenRouter ID (contains /),
  // we must ignore it and fall back to preferred or preset models.
  const isRequestedOpenRouterModel = requested.includes('/');
  const actualRequested = (provider !== 'openrouter' && isRequestedOpenRouterModel) ? '' : requested;

  const candidate = actualRequested || preferred || modelOptions[0] || '';
  
  if (provider !== 'openrouter') {
    return candidate;
  }

  if (!hasManagedOpenRouterKey) {
    return candidate;
  }

  const freeModels = openRouterFreeModels.length > 0 ? openRouterFreeModels : modelOptions;
  if (candidate && freeModels.includes(candidate)) {
    return candidate;
  }

  return freeModels[0] || candidate;
}

export function resolveLlmRuntimeConfig({ settings, requestedModel }) {
  const merged = {
    ...getDefaultUserLlmSettings(settings?.user_id || 1),
    ...(settings || {})
  };

  let provider = normalizeLlmProvider(merged.provider);
  const hasGoogleKey = hasValue(merged.google_api_key);
  const hasOpenAIKey = hasValue(merged.openai_api_key);
  const hasAnthropicKey = hasValue(merged.anthropic_api_key);
  const hasXaiKey = hasValue(merged.xai_api_key);
  const hasOpenRouterKey = hasValue(merged.openrouter_api_key);

  // Automatic provider switching if using default 'openrouter'
  if (provider === 'openrouter' && !hasOpenRouterKey) {
    if (hasGoogleKey) {
      provider = 'google';
    } else if (hasOpenAIKey) {
      provider = 'openai';
    } else if (hasAnthropicKey) {
      provider = 'anthropic';
    } else if (hasXaiKey) {
      provider = 'xai';
    }
  }

  const modelOptions = buildModelListForProvider(provider, merged);
  const model = pickModelForRuntime({
    provider,
    settings: merged,
    requestedModel,
    modelOptions
  });
  const apiKey = getApiKeyForProvider(merged, provider);

  return {
    provider,
    provider_label: llmProviderLabels[provider],
    model,
    model_options: modelOptions,
    apiKey,
    hasApiKey: Boolean(apiKey),
    missingKeyMessage: buildMissingApiKeyMessage(provider)
  };
}

function createModelForProvider(provider, apiKey, model) {
  switch (provider) {
    case 'openai': {
      const openai = createOpenAI({ apiKey });
      return openai(model);
    }
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(model);
    }
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(model);
    }
    case 'xai': {
      const xai = createXai({ apiKey });
      return xai(model);
    }
    case 'openrouter':
    default: {
      const openrouter = createOpenAI({
        name: 'openrouter',
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        headers: {
          'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://project-inspire.local',
          'X-Title': process.env.OPENROUTER_APP_TITLE || 'Project INSPIRE'
        }
      });
      return openrouter(model);
    }
  }
}

export async function generateProviderText({ provider, model, apiKey, messages, maxTokens, temperature = 0.4 }) {
  if (!apiKey) {
    throw new Error('API key is required for provider call.');
  }

  if (!trimOptional(model)) {
    throw new Error('Model is required for provider call.');
  }

  try {
    const llmModel = createModelForProvider(provider, apiKey, model);
    const result = await generateText({
      model: llmModel,
      messages,
      maxTokens,
      temperature
    });

    return trimOptional(result?.text);
  } catch (error) {
    console.error(`[LLM ERROR] ${provider} (${model}):`, error);
    throw error;
  }
}
