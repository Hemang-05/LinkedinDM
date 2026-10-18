'use client';

import React, { useState, useEffect } from 'react';
import { DueFollowUp } from '@/types/supabase';
import { getDueFollowUps, getUpcomingFollowUps, completeFollowUp } from '@/lib/supabaseDb';
import { getCurrentSupabaseUser } from '@/lib/supabaseClient';
import { copyToClipboard } from '@/lib/clipboard';
import {
  CalendarClock,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Send,
  Sparkles,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Loader2
} from 'lucide-react';

interface FollowUpsViewProps {
  onFollowUpCompleted?: () => void;
}

export function FollowUpsView({ onFollowUpCompleted }: FollowUpsViewProps) {
  const [activeTab, setActiveTab] = useState<'due' | 'upcoming'>('due');
  const [dueFollowUps, setDueFollowUps] = useState<DueFollowUp[]>([]);
  const [upcomingFollowUps, setUpcomingFollowUps] = useState<DueFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const loadFollowUps = async () => {
    setLoading(true);
    try {
      const user = await getCurrentSupabaseUser();
      if (!user) {
        setUserId(null);
        setDueFollowUps([]);
        setUpcomingFollowUps([]);
        setLoading(false);
        return;
      }
      setUserId(user.id);
      const [due, upcoming] = await Promise.all([
        getDueFollowUps(user.id),
        getUpcomingFollowUps(user.id)
      ]);
      setDueFollowUps(due);
      setUpcomingFollowUps(upcoming);
    } catch (err) {
      console.error('Error loading follow-ups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFollowUps();
  }, []);

  const handleCopy = async (id: string, text?: string | null) => {
    if (!text) return;
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleMarkSent = async (event: DueFollowUp) => {
    if (!userId) return;
    setCompletingId(event.id);
    try {
      const ok = await completeFollowUp(userId, event.id);
      if (ok) {
        // Remove from list
        setDueFollowUps((prev) => prev.filter((item) => item.id !== event.id));
        setUpcomingFollowUps((prev) => prev.filter((item) => item.id !== event.id));
        if (onFollowUpCompleted) onFollowUpCompleted();
      }
    } catch (err) {
      console.error('Error completing follow-up:', err);
    } finally {
      setCompletingId(null);
    }
  };

  const formatDueNotice = (scheduledForIso: string) => {
    const scheduled = new Date(scheduledForIso);
    const now = new Date();
    const diffHours = Math.round((scheduled.getTime() - now.getTime()) / (1000 * 60 * 60));
    const diffDays = Math.round(diffHours / 24);

    if (diffHours < -24) {
      return { text: `Overdue by ${Math.abs(diffDays)}d`, color: 'text-amber-700 bg-amber-50 border-amber-200' };
    }
    if (diffHours < 0) {
      return { text: 'Due today', color: 'text-rose-700 bg-rose-50 border-rose-200' };
    }
    if (diffDays === 0) {
      return { text: 'Due today', color: 'text-[#0A66C2] bg-blue-50 border-blue-200' };
    }
    if (diffDays === 1) {
      return { text: 'Due tomorrow', color: 'text-zinc-700 bg-zinc-50 border-zinc-200' };
    }
    return { text: `Due in ${diffDays}d (${scheduled.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})`, color: 'text-zinc-600 bg-zinc-50 border-zinc-200' };
  };

  if (!userId && !loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="w-14 h-14 mx-auto mb-4 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-500">
          <CalendarClock className="w-7 h-7 text-[#0A66C2]" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 mb-2">Cloud Persistence Required</h2>
        <p className="text-sm text-zinc-600 max-w-md mx-auto mb-6">
          Sign in or create an account with Supabase to unlock Day 5 and Day 12 automated follow-up tracking and cloud synchronization.
        </p>
      </div>
    );
  }

  const itemsToDisplay = activeTab === 'due' ? dueFollowUps : upcomingFollowUps;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6 pb-24">
      {/* Header & Sub-nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 flex items-center gap-2.5">
            <CalendarClock className="w-6 h-6 text-[#0A66C2]" />
            <span>Follow-up Sequences</span>
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Automated Day 5 and Day 12 check-in messages for your contacted prospects
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl self-start sm:self-center">
          <button
            onClick={() => setActiveTab('due')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'due'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-[#0A66C2]" />
            <span>Due Now</span>
            {dueFollowUps.length > 0 && (
              <span className="px-1.5 py-0.2 bg-[#0A66C2] text-white text-[10px] rounded-full font-bold">
                {dueFollowUps.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'upcoming'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
            <span>Upcoming</span>
            {upcomingFollowUps.length > 0 && (
              <span className="px-1.5 py-0.2 bg-zinc-200 text-zinc-700 text-[10px] rounded-full font-bold">
                {upcomingFollowUps.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-zinc-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-[#0A66C2]" />
          <span>Checking scheduled follow-ups...</span>
        </div>
      ) : itemsToDisplay.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white border border-dashed border-zinc-200 rounded-2xl">
          <div className="w-12 h-12 mx-auto mb-3 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-zinc-900 mb-1">
            {activeTab === 'due' ? 'All Caught Up!' : 'No Upcoming Follow-ups'}
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            {activeTab === 'due'
              ? 'There are no follow-ups due right now. When you contact prospects, Day 5 and Day 12 follow-ups are automatically scheduled here.'
              : 'No future follow-ups scheduled yet. Contact prospects from your New queue to build your sequence.'}
          </p>
        </div>
      ) : (
        /* Cards list */
        <div className="space-y-4">
          {itemsToDisplay.map((event) => {
            const timing = formatDueNotice(event.scheduled_for);
            const initials = event.name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();

            return (
              <div
                key={event.id}
                className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs hover:border-zinc-300 transition-all space-y-4"
              >
                {/* Person Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#EBF3FB] text-[#0A66C2] font-bold text-sm flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-zinc-900 text-sm">{event.name}</h4>
                        <span className={`px-2 py-0.5 text-[10px] font-semibold border rounded-full ${timing.color}`}>
                          {timing.text}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        {event.position} • <span className="font-medium text-zinc-700">{event.company}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2.5 py-1 bg-zinc-100 text-zinc-700 rounded-lg">
                      {event.sequence_number === 1 ? 'Follow-up #1 (Day 5)' : 'Follow-up #2 (Day 12)'}
                    </span>
                  </div>
                </div>

                {/* Follow-up Message Box */}
                {event.message && (
                  <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3.5 relative text-xs text-zinc-800 leading-relaxed font-sans whitespace-pre-line">
                    {event.message}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100">
                  <div className="flex items-center gap-2">
                    {event.linkedin_url && (
                      <a
                        href={event.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0A66C2] hover:text-[#004182] hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <span>Open LinkedIn</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}

                    <button
                      onClick={() => handleCopy(event.id, event.message)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      {copiedId === event.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Message</span>
                        </>
                      )}
                    </button>
                  </div>

                  <button
                    onClick={() => handleMarkSent(event)}
                    disabled={completingId === event.id}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0A66C2] hover:bg-[#004182] px-4 py-2 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {completingId === event.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Mark Follow-up Sent</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
