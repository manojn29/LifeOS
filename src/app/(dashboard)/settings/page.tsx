'use client';

import { useState, useEffect } from 'react';
import { Settings, Shield, Cpu, Key, Check, Download, Database, CheckCircle2 } from 'lucide-react';
import { AIProviderType } from '@/types/database';

export default function SettingsPage() {
  const [provider, setProvider] = useState<AIProviderType>('gemini');
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [claudeKey, setClaudeKey] = useState('');
  const [keyStatus, setKeyStatus] = useState({
    has_gemini_key: false,
    has_openai_key: false,
    has_claude_key: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    fetchSettings();

    // Listen for PWA beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    });
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.settings) {
        setProvider(data.settings.default_ai_provider || 'gemini');
        setKeyStatus({
          has_gemini_key: data.settings.has_gemini_key,
          has_openai_key: data.settings.has_openai_key,
          has_claude_key: data.settings.has_claude_key,
        });
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_ai_provider: provider,
          gemini_api_key: geminiKey ? geminiKey.trim() : undefined,
          openai_api_key: openaiKey ? openaiKey.trim() : undefined,
          claude_api_key: claudeKey ? claudeKey.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (data.settings) {
        setKeyStatus({
          has_gemini_key: data.settings.has_gemini_key,
          has_openai_key: data.settings.has_openai_key,
          has_claude_key: data.settings.has_claude_key,
        });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  }

  const handleInstallPWA = async () => {
    if (!installPrompt) {
      alert('PWA install prompt is available via browser address bar or menu ("Add to Home Screen").');
      return;
    }
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
          <Settings className="w-6 h-6 text-emerald-400" />
          Settings & AI Configuration
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Customize your default AI model provider and manage private API keys.
        </p>
      </div>

      {/* Philosophy Banner */}
      <div className="glass-panel border-emerald-500/20 bg-emerald-950/20 rounded-2xl p-5 mb-8 flex items-start gap-4">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 mb-1">LifeOS Privacy Principle</h3>
          <p className="text-xs text-zinc-300 leading-relaxed">
            "My data belongs to me. AI models are replaceable." All raw memories and tasks are stored in your own PostgreSQL database. You can swap between Google Gemini, OpenAI, and Anthropic Claude at any moment.
          </p>
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Provider Selection */}
        <div className="glass-panel rounded-2xl p-6">
          <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2 mb-4">
            <Cpu className="w-4 h-4 text-emerald-400" />
            Default AI Provider
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { id: 'gemini', name: 'Google Gemini', desc: 'Fast cleaning & Flash models', badge: 'Recommended' },
              { id: 'openai', name: 'OpenAI', desc: 'GPT-4o & text-embedding-3', badge: 'Popular' },
              { id: 'claude', name: 'Anthropic Claude', desc: 'Claude 3.5 Sonnet / Haiku', badge: 'Analytical' },
            ].map((p) => {
              const isSelected = provider === p.id;
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setProvider(p.id as AIProviderType)}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-950/30 shadow-md ring-1 ring-emerald-500/30'
                      : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-zinc-100">{p.name}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <p className="text-xs text-zinc-400">{p.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bring Your Own Keys (BYOK) */}
        <div className="glass-panel rounded-2xl p-6">
          <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2 mb-1">
            <Key className="w-4 h-4 text-emerald-400" />
            API Keys (Bring Your Own Key)
          </h2>
          <p className="text-xs text-zinc-400 mb-5">
            Keys are encrypted and stored in your private database record. If left blank, server-level environment variables are used.
          </p>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1 text-xs">
                <label className="font-medium text-zinc-300">Google Gemini API Key</label>
                <span className="font-mono text-[10px] text-emerald-400">
                  {keyStatus.has_gemini_key ? '✓ Configured' : 'Not configured'}
                </span>
              </div>
              <input
                type="password"
                placeholder={keyStatus.has_gemini_key ? '••••••••••••••••••••••••' : 'AIzaSy...'}
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1 text-xs">
                <label className="font-medium text-zinc-300">OpenAI API Key</label>
                <span className="font-mono text-[10px] text-emerald-400">
                  {keyStatus.has_openai_key ? '✓ Configured' : 'Not configured'}
                </span>
              </div>
              <input
                type="password"
                placeholder={keyStatus.has_openai_key ? '••••••••••••••••••••••••' : 'sk-proj-...'}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1 text-xs">
                <label className="font-medium text-zinc-300">Anthropic Claude API Key</label>
                <span className="font-mono text-[10px] text-emerald-400">
                  {keyStatus.has_claude_key ? '✓ Configured' : 'Not configured'}
                </span>
              </div>
              <input
                type="password"
                placeholder={keyStatus.has_claude_key ? '••••••••••••••••••••••••' : 'sk-ant-...'}
                value={claudeKey}
                onChange={(e) => setClaudeKey(e.target.value)}
                className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center justify-between pt-2">
          {saveSuccess ? (
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono">
              <Check className="w-4 h-4" />
              <span>Settings saved successfully!</span>
            </div>
          ) : (
            <span />
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm transition-all shadow-lg shadow-emerald-950/40 cursor-pointer"
          >
            {isSaving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </form>

      {/* PWA & Database Card */}
      <div className="mt-12 pt-8 border-t border-zinc-800/80 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <Download className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Progressive Web App (PWA)</h3>
          </div>
          <p className="text-xs text-zinc-400 mb-4">
            Install LifeOS on iOS, Android, or Mac/Windows desktop for full-screen offline-ready access.
          </p>
          <button
            onClick={handleInstallPWA}
            className="w-full py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 cursor-pointer transition-colors"
          >
            Install LifeOS App
          </button>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <Database className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-semibold text-zinc-200">PostgreSQL + pgvector</h3>
          </div>
          <p className="text-xs text-zinc-400 mb-2">
            Database schema includes <code className="text-emerald-400 font-mono">match_journal_entries</code> RPC with cosine distance vector indexing.
          </p>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/50">
            ✓ Active
          </span>
        </div>
      </div>
    </div>
  );
}
