'use client';

import { useEffect, useState } from 'react';

export interface PickerValue {
  provider: string;
  model: string;
  apiKey: string;
}

export default function ModelPicker({
  label,
  accent,
  providers,
  value,
  onChange,
}: {
  label: string;
  accent: string;
  providers: Record<string, { label: string; models: string[]; free: boolean }>;
  value: PickerValue;
  onChange: (v: PickerValue) => void;
}) {
  const providerIds = Object.keys(providers);
  const [storageKey] = useState(`llm-clinic:key:${value.provider}`);

  useEffect(() => {
    const saved = window.localStorage.getItem(`llm-clinic:key:${value.provider}`);
    if (saved && !value.apiKey) {
      onChange({ ...value, apiKey: saved });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.provider]);

  return (
    <div className="border border-ink/15 rounded-sm bg-white/40 p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
          <span className="font-mono text-xs uppercase tracking-wider text-ink/80 font-semibold">{label}</span>
        </div>
        {providers[value.provider]?.free && (
          <span className="text-[10px] font-mono text-chart uppercase tracking-wider font-medium">Free Tier Supported</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select
          className="border border-ink/20 bg-paper px-2.5 py-1.5 text-xs rounded-sm focus:outline-hidden focus:border-ink/50"
          value={value.provider}
          onChange={(e) => {
            const provider = e.target.value;
            const firstModel = providers[provider].models[0];
            const savedKey = window.localStorage.getItem(`llm-clinic:key:${provider}`) ?? '';
            onChange({ provider, model: firstModel, apiKey: savedKey });
          }}
        >
          {providerIds.map((id) => (
            <option key={id} value={id}>
              {providers[id].label}
            </option>
          ))}
        </select>

        {value.provider === 'openrouter' ? (
          <input
            type="text"
            placeholder="model-id (e.g. meta-llama/llama-3.3-70b-instruct)"
            className="border border-ink/20 bg-paper px-2.5 py-1.5 text-xs rounded-sm font-mono focus:outline-hidden focus:border-ink/50"
            value={value.model}
            onChange={(e) => onChange({ ...value, model: e.target.value })}
          />
        ) : (
          <select
            className="border border-ink/20 bg-paper px-2.5 py-1.5 text-xs rounded-sm font-mono focus:outline-hidden focus:border-ink/50"
            value={value.model}
            onChange={(e) => onChange({ ...value, model: e.target.value })}
          >
            {providers[value.provider]?.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
      </div>

      <input
        type="password"
        placeholder={`${providers[value.provider]?.label ?? 'Provider'} API key`}
        className="w-full border border-ink/20 bg-paper px-2.5 py-1.5 text-xs rounded-sm font-mono focus:outline-hidden focus:border-ink/50 placeholder:text-ink/30"
        value={value.apiKey}
        onChange={(e) => {
          onChange({ ...value, apiKey: e.target.value });
          window.localStorage.setItem(`llm-clinic:key:${value.provider}`, e.target.value);
        }}
      />
    </div>
  );
}
