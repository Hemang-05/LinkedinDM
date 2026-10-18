'use client';

import React, { useState } from 'react';
import { getSupabaseClient, isSupabaseConfigured, getSiteUrl } from '@/lib/supabaseClient';
import { ensureSupabaseProfile } from '@/lib/supabaseDb';
import { getLegacyUnmigratedProspects, clearLegacyStorage, setActiveStorageUser } from '@/lib/clientStorage';
import { migrateLocalDataToSupabase } from '@/lib/supabaseDb';
import { DMLogo } from './DMLogo';
import {
  Lock,
  Mail,
  User as UserIcon,
  Briefcase,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  CalendarClock,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: (user: any) => void;
}

export function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [targetRole, setTargetRole] = useState('Full Stack Engineer');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const configured = isSupabaseConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!configured) {
      console.warn('[Auth] Supabase credentials not found in environment.');
      setErrorMsg('Authentication service is currently unavailable. Please restart the dev server or try again.');
      return;
    }

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    if (mode === 'signup' && !fullName.trim()) {
      setErrorMsg('Please enter your full name for your profile.');
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
            emailRedirectTo: `${getSiteUrl()}`,
            data: {
              name: fullName.trim(),
              target_role: targetRole.trim()
            }
          }
        });

        if (error) {
          setErrorMsg(error.message);
          setLoading(false);
          return;
        }

        if (data.user) {
          setSuccessMsg('Account created successfully!');
          setActiveStorageUser(data.user.id);

          // 1. Create Supabase profile for this UUID (Requirement 3)
          await ensureSupabaseProfile(data.user.id, data.user.email, {
            name: fullName.trim(),
            targetRole: targetRole.trim() || 'Full Stack Engineer'
          });

          // 2. Migrate legacy local prospects only once if present
          const legacy = getLegacyUnmigratedProspects();
          if (legacy.length > 0) {
            await migrateLocalDataToSupabase(data.user.id, legacy);
            clearLegacyStorage();
          }

          setTimeout(() => {
            onAuthSuccess(data.user);
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
          setActiveStorageUser(data.user.id);

          // Ensure profile exists for this UUID
          await ensureSupabaseProfile(data.user.id, data.user.email);

          // Migrate legacy unassigned data only once if present
          const legacy = getLegacyUnmigratedProspects();
          if (legacy.length > 0) {
            await migrateLocalDataToSupabase(data.user.id, legacy);
            clearLegacyStorage();
          }

          setTimeout(() => {
            onAuthSuccess(data.user);
          }, 400);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F2EE] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-3">
          <DMLogo size="lg" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Direct Message
        </h1>
        <p className="mt-1 text-xs text-zinc-500 font-medium">
          Production-grade LinkedIn Outreach Assistant with RLS isolation
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-[#E0DFDC] rounded-2xl sm:px-10">
          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-zinc-200 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
                mode === 'signin'
                  ? 'border-[#0A66C2] text-[#0A66C2]'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
                mode === 'signup'
                  ? 'border-[#0A66C2] text-[#0A66C2]'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Create Account
            </button>
          </div>


          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Full Name *
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Hemang Mehta"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0A66C2] focus:border-transparent text-zinc-900 placeholder:text-zinc-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Primary Target Role
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                    <input
                      type="text"
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      placeholder="Full Stack Engineer"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0A66C2] focus:border-transparent text-zinc-900 placeholder:text-zinc-400"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Email Address *
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
                Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0A66C2] focus:border-transparent text-zinc-900 placeholder:text-zinc-400"
                />
              </div>
              {mode === 'signup' && (
                <p className="text-[11px] text-zinc-400 mt-1">Must be at least 6 characters</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#0A66C2] hover:bg-[#004182] text-white font-semibold text-sm rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer mt-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              <span>{mode === 'signin' ? 'Sign In to Workspace' : 'Create Account & Continue'}</span>
            </button>
          </form>

          {/* Security Features Info Box */}
          <div className="mt-6 pt-5 border-t border-zinc-100 text-[11px] text-zinc-500 space-y-2">
            <div className="flex items-center gap-2 text-zinc-700 font-medium">
              <ShieldCheck className="w-4 h-4 text-[#0A66C2]" />
              <span>Supabase Row-Level Security Enforced</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-600">
              <CalendarClock className="w-3.5 h-3.5 text-zinc-400" />
              <span>Automated Day 0, Day 5 & Day 12 follow-up scheduling</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-600">
              <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
              <span>Private connection database isolated to your Auth UUID</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
