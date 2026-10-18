'use client';

import React, { useState } from 'react';
import { getSupabaseClient, isSupabaseConfigured, getSiteUrl } from '@/lib/supabaseClient';
import { getClientProspects } from '@/lib/clientStorage';
import { migrateLocalDataToSupabase } from '@/lib/supabaseDb';
import { X, Lock, Mail, Loader2, CheckCircle2, AlertCircle, Cloud } from 'lucide-react';
import { DMLogo } from './DMLogo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: () => void;
}

export function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const configured = isSupabaseConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!configured) {
      setErrorMsg('Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local');
      return;
    }

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setErrorMsg('Failed to initialize Supabase client.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            emailRedirectTo: `${getSiteUrl()}`
          }
        });

        if (error) {
          setErrorMsg(error.message);
          setLoading(false);
          return;
        }

        if (data.user) {
          setSuccessMsg('Account created successfully!');
          const { setActiveStorageUser, getLegacyUnmigratedProspects, clearLegacyStorage } = await import('@/lib/clientStorage');
          setActiveStorageUser(data.user.id);

          const { ensureSupabaseProfile } = await import('@/lib/supabaseDb');
          await ensureSupabaseProfile(data.user.id, data.user.email);

          // Attempt safe migration of any existing unmigrated legacy prospects
          const legacyP = getLegacyUnmigratedProspects();
          if (legacyP.length > 0) {
            await migrateLocalDataToSupabase(data.user.id, legacyP);
            clearLegacyStorage();
          }

          setTimeout(() => {
            if (onAuthSuccess) onAuthSuccess();
            onClose();
          }, 600);
        }
      } else {
        const { data, error } = await client.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim()
        });

        if (error) {
          setErrorMsg(error.message);
          setLoading(false);
          return;
        }

        if (data.user) {
          setSuccessMsg('Signed in successfully!');
          const { setActiveStorageUser, getLegacyUnmigratedProspects, clearLegacyStorage } = await import('@/lib/clientStorage');
          setActiveStorageUser(data.user.id);

          const { ensureSupabaseProfile } = await import('@/lib/supabaseDb');
          await ensureSupabaseProfile(data.user.id, data.user.email);

          const legacyP = getLegacyUnmigratedProspects();
          if (legacyP.length > 0) {
            await migrateLocalDataToSupabase(data.user.id, legacyP);
            clearLegacyStorage();
          }

          setTimeout(() => {
            if (onAuthSuccess) onAuthSuccess();
            onClose();
          }, 400);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-md overflow-hidden relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-zinc-100 flex items-center gap-3">
          <DMLogo size="sm" />
          <div>
            <h2 className="text-lg font-bold text-zinc-900">
              {mode === 'signin' ? 'Sign In to Direct Message' : 'Create an Account'}
            </h2>
            <p className="text-xs text-zinc-500">
              Cloud persistence, incremental CSV discovery & follow-up tracking
            </p>
          </div>
        </div>

        {/* Notice if Supabase keys not set */}
        {!configured && (
          <div className="m-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>Supabase Not Configured</span>
            </div>
            <p className="text-amber-800 leading-relaxed">
              To enable cloud persistence, copy your Supabase Project URL and Anon Public Key into <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">.env.local</code>:
            </p>
            <pre className="p-2 bg-amber-100/70 rounded text-[11px] font-mono text-amber-950 overflow-x-auto">
              NEXT_PUBLIC_SUPABASE_URL=https://xyz.supabase.co{'\n'}
              NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
            </pre>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0A66C2] focus:border-transparent text-zinc-900 placeholder:text-zinc-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0A66C2] focus:border-transparent text-zinc-900 placeholder:text-zinc-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-[#0A66C2] hover:bg-[#004182] text-white font-semibold text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Cloud className="w-4 h-4" />
            )}
            <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
          </button>

          <div className="pt-2 text-center text-xs text-zinc-500">
            {mode === 'signin' ? (
              <span>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setErrorMsg('');
                  }}
                  className="text-[#0A66C2] font-semibold hover:underline cursor-pointer"
                >
                  Sign Up
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMsg('');
                  }}
                  className="text-[#0A66C2] font-semibold hover:underline cursor-pointer"
                >
                  Sign In
                </button>
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
