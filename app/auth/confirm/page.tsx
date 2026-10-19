'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient, getCurrentSupabaseUser } from '@/lib/supabaseClient';
import { setActiveStorageUser } from '@/lib/clientStorage';
import { ensureSupabaseProfile } from '@/lib/supabaseDb';
import { DMLogo } from '@/components/DMLogo';
import { CheckCircle2, ArrowRight, Loader2, AlertCircle, Laptop, Smartphone } from 'lucide-react';

export default function AuthConfirmPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(3);

  useEffect(() => {
    let isMounted = true;

    async function handleConfirm() {
      const client = getSupabaseClient();
      if (!client) {
        if (isMounted) {
          setStatus('error');
          setErrorDetails('Authentication service unavailable.');
        }
        return;
      }

      try {
        // 1. Check if PKCE code parameter exists (?code=...)
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');

        if (code) {
          const { data, error } = await client.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (data?.session?.user) {
            if (!isMounted) return;
            setUserEmail(data.session.user.email || null);
            setActiveStorageUser(data.session.user.id);
            await ensureSupabaseProfile(data.session.user.id, data.session.user.email);
            setStatus('success');
            return;
          }
        }

        // 2. Check if hash fragment contains access_token (#access_token=...)
        if (window.location.hash && window.location.hash.includes('access_token')) {
          const { data, error } = await client.auth.getSession();
          if (error) throw error;
          if (data?.session?.user) {
            if (!isMounted) return;
            setUserEmail(data.session.user.email || null);
            setActiveStorageUser(data.session.user.id);
            await ensureSupabaseProfile(data.session.user.id, data.session.user.email);
            setStatus('success');
            return;
          }
        }

        // 3. Fallback: check if session is already active
        const existingUser = await getCurrentSupabaseUser();
        if (existingUser) {
          if (!isMounted) return;
          setUserEmail(existingUser.email || null);
          setActiveStorageUser(existingUser.id);
          await ensureSupabaseProfile(existingUser.id, existingUser.email);
          setStatus('success');
          return;
        }

        // If no code, token, or session found
        if (isMounted) {
          setStatus('error');
          setErrorDetails('No verification tokens found. Your email may already be confirmed.');
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.warn('[AuthConfirm] Verification error:', err);
        // If error message indicates user already confirmed, treat as success
        const msg = err.message || '';
        if (msg.toLowerCase().includes('already confirmed') || msg.toLowerCase().includes('already verified')) {
          setStatus('success');
        } else {
          setStatus('error');
          setErrorDetails(msg || 'Failed to verify email confirmation link.');
        }
      }
    }

    handleConfirm();

    return () => {
      isMounted = false;
    };
  }, []);

  // Countdown timer for automatic workspace redirect
  useEffect(() => {
    if (status !== 'success') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status, router]);

  return (
    <div className="min-h-screen bg-[#F4F2EE] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Logo & Brand Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <DMLogo size="lg" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Direct Message
          </h1>
          <p className="mt-1 text-xs text-zinc-500 font-medium">
            Account Email Verification
          </p>
        </div>

        {/* Verification Card */}
        <div className="bg-white py-8 px-6 shadow-sm border border-[#E0DFDC] rounded-2xl sm:px-8 text-center animate-in fade-in duration-300">
          {status === 'verifying' && (
            <div className="py-6 space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 flex items-center justify-center text-[#0A66C2]">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <h2 className="text-lg font-bold text-zinc-900">
                Verifying your email...
              </h2>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                Securing your authentication session and linking your cloud profile.
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="py-4 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-zinc-900">
                  Email Verified!
                </h2>
                <p className="text-xs text-zinc-600 mt-1">
                  {userEmail ? (
                    <>
                      <span className="font-semibold text-zinc-800">{userEmail}</span> is now fully confirmed.
                    </>
                  ) : (
                    'Your email address has been successfully verified.'
                  )}
                </p>
              </div>

              {/* Multi-Device Sync Notice */}
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-left text-xs text-blue-900 space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-blue-950">
                  <Laptop className="w-4 h-4 text-[#0A66C2] shrink-0" />
                  <span>Verifying from your phone?</span>
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Your desktop browser screen has automatically detected this verification and logged you in! You can safely switch back to your computer.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="w-full py-2.5 px-4 bg-[#0A66C2] hover:bg-[#004182] text-white font-semibold text-sm rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Open Workspace Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <p className="text-[11px] text-zinc-400">
                  Redirecting to workspace in <span className="font-semibold text-zinc-700">{countdown}s</span>...
                </p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="py-4 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <AlertCircle className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-lg font-bold text-zinc-900">
                  Verification Notice
                </h2>
                <p className="text-xs text-zinc-600 mt-1">
                  {errorDetails || 'This verification link may have already been used or expired.'}
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="w-full py-2.5 px-4 bg-[#0A66C2] hover:bg-[#004182] text-white font-semibold text-sm rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Proceed to Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-zinc-400">
          Direct Message Outreach Assistant &bull; Isolated Row-Level Security
        </div>
      </div>
    </div>
  );
}
