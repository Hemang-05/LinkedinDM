'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Prospect,
  UserProfile,
  OutreachGoal,
  ProspectCategory,
  NotRelevantReason,
  PersonaType
} from '@/types';
import { MessageAngle, generatePersonalizedDM, GeneratedSequence } from '@/lib/generator';
import { classifyTitle, CATEGORY_METADATA } from '@/lib/classifier';
import { copyTextToClipboard, openLinkedInTab } from '@/lib/clipboard';
import {
  getClientProfile,
  updateClientProspect,
  appendClientOutreachLog,
  isProfileComplete
} from '@/lib/clientStorage';
import {
  Check,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  SkipForward,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Filter,
  Layers,
  Building2,
  MapPin,
  HelpCircle,
  SlidersHorizontal
} from 'lucide-react';

interface ReviewQueueViewProps {
  prospects: Prospect[];
  workflow: OutreachGoal;
  onProspectUpdated: (updated: Prospect) => void;
  onSwitchToList: () => void;
  userProfile?: UserProfile | null;
  onOpenSettings?: () => void;
}

interface UndoAction {
  type: 'contacted' | 'not_relevant' | 'skip';
  prospectId: string;
  previousStatus: Prospect['status'];
  previousReason?: NotRelevantReason;
  previousContactedDate?: string;
  originalProspect: Prospect;
}

const CATEGORY_TABS: { id: 'all' | ProspectCategory; label: string }[] = [
  { id: 'all', label: 'All Categories' },
  { id: 'recruiter', label: 'Recruiters' },
  { id: 'employee', label: 'Engineers / Peers' },
  { id: 'founder', label: 'Founders / Execs' },
  { id: 'cto', label: 'CTOs / VPs' },
  { id: 'eng_leader', label: 'Eng Leaders' },
  { id: 'other', label: 'Other Roles' }
];

export function ReviewQueueView({
  prospects,
  workflow,
  onProspectUpdated,
  onSwitchToList,
  userProfile: propProfile,
  onOpenSettings
}: ReviewQueueViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | ProspectCategory>('all');
  const [includeOther, setIncludeOther] = useState<boolean>(false);
  const [activeQueue, setActiveQueue] = useState<Prospect[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [copyFeedback, setCopyFeedback] = useState<'day0' | 'day5' | 'day12' | 'copied_and_opened' | null>(null);

  // Set of handled prospect IDs in the current session (contacted or not_relevant).
  // Prevents prospects from ever flashing or blinking back into the queue during background parent updates.
  const handledIdsRef = React.useRef<Set<string>>(new Set());
  const isHandlingRef = React.useRef<boolean>(false);

  // Collapsed "More" accordion state
  const [isMoreOpen, setIsMoreOpen] = useState<boolean>(false);

  // Per-card sequence override controls
  const [customGoal, setCustomGoal] = useState<OutreachGoal>(workflow);
  const [customAngle, setCustomAngle] = useState<MessageAngle>('standard');
  const [customPersona, setCustomPersona] = useState<PersonaType | null>(null);

  // Not relevant modal / inline reason picker state
  const [showReasonPicker, setShowReasonPicker] = useState<boolean>(false);

  // Next-card pregeneration cache: maps prospect id -> GeneratedSequence
  const [sequenceCache, setSequenceCache] = useState<Record<string, GeneratedSequence>>({});

  // Sync active queue when prospects or selected category change
  useEffect(() => {
    // Only pending prospects (not contacted, not marked not_relevant, and not handled in this session)
    const pending = prospects.filter((p) => {
      if (handledIdsRef.current.has(p.id)) return false;
      const isPending = p.status !== 'Contacted' && p.status !== 'not_relevant';
      if (!isPending) return false;
      const cat = p.category || classifyTitle(p.jobTitle);
      if (cat === 'excluded') return false; // Excluded roles never enter review queue
      if (selectedCategory === 'all') {
        if (!includeOther && cat === 'other') return false; // Excluded by default with toggle
        return true;
      }
      return cat === selectedCategory;
    });

    setActiveQueue(pending);
    setCurrentIndex(0);
    setIsMoreOpen(false);
    setShowReasonPicker(false);
  }, [prospects, selectedCategory, includeOther]);

  const currentProspect: Prospect | undefined = activeQueue[currentIndex];
  const rawProfile: UserProfile | null = propProfile || getClientProfile();

  const userProfile: UserProfile | null = useMemo(() => {
    if (!rawProfile) return null;
    const name = rawProfile.name?.trim();
    if (!name || name === 'Your Name') return null;

    return {
      ...rawProfile,
      name,
      targetRole: rawProfile.targetRole || rawProfile.title || 'Software Engineer',
      skills: (rawProfile.skills && rawProfile.skills.length > 0) ? rawProfile.skills : ['React', 'TypeScript', 'Node.js'],
      primarySkills: (rawProfile.primarySkills && rawProfile.primarySkills.length > 0)
        ? rawProfile.primarySkills
        : (rawProfile.skills && rawProfile.skills.length > 0)
        ? rawProfile.skills.slice(0, 5)
        : ['React', 'TypeScript', 'Node.js'],
      background: rawProfile.background || rawProfile.bioSummary || rawProfile.title || 'software engineering'
    };
  }, [rawProfile]);

  // Reset custom controls whenever active card changes
  useEffect(() => {
    setCustomGoal(workflow);
    setCustomAngle('standard');
    setCustomPersona(null);
    setIsMoreOpen(false);
    setShowReasonPicker(false);
  }, [currentProspect?.id, workflow]);

  // Pre-generate current and next card's messages
  useEffect(() => {
    if (!userProfile || !isProfileComplete(userProfile, customGoal)) return;

    const generateAndCache = (p: Prospect) => {
      if (!sequenceCache[p.id]) {
        try {
          const targetRole = userProfile.targetRole || userProfile.title || p.jobOpportunity?.title || 'Software Engineer';
          const seq = generatePersonalizedDM(
            p,
            targetRole,
            customAngle,
            userProfile,
            customGoal
          );
          setSequenceCache((prev) => ({ ...prev, [p.id]: seq }));
        } catch (e) {
          console.warn('Error pre-generating sequence for prospect:', p.name, e);
        }
      }
    };

    if (currentProspect) {
      generateAndCache(currentProspect);
    }

    const nextProspect = activeQueue[currentIndex + 1];
    if (nextProspect) {
      generateAndCache(nextProspect);
    }
  }, [currentProspect, activeQueue, currentIndex, userProfile, customGoal, customAngle, sequenceCache]);

  // Current sequence computation
  const currentSequence: GeneratedSequence | null = useMemo(() => {
    if (!currentProspect || !userProfile || !isProfileComplete(userProfile, customGoal)) {
      return null;
    }

    // If custom persona or angle overrides are active, regenerate dynamically
    if (customPersona || customAngle !== 'standard' || customGoal !== workflow) {
      try {
        const targetRole = userProfile.targetRole || currentProspect.jobOpportunity?.title || 'Software Engineer';
        const overrideProspect = customPersona ? { ...currentProspect, persona: customPersona } : currentProspect;
        return generatePersonalizedDM(
          overrideProspect,
          targetRole,
          customAngle,
          userProfile,
          customGoal
        );
      } catch (err) {
        console.error('Failed to generate customized DM:', err);
        return null;
      }
    }

    // Return cached pregeneration if available
    if (sequenceCache[currentProspect.id]) {
      return sequenceCache[currentProspect.id];
    }

    try {
      const targetRole = userProfile.targetRole || currentProspect.jobOpportunity?.title || 'Software Engineer';
      return generatePersonalizedDM(
        currentProspect,
        targetRole,
        'standard',
        userProfile,
        customGoal
      );
    } catch {
      return null;
    }
  }, [currentProspect, userProfile, customGoal, customAngle, customPersona, workflow, sequenceCache]);

  // 1-Click Action: Copy Day 0 DM and open LinkedIn Profile in new tab
  const handleCopyAndOpen = useCallback(async () => {
    if (!currentProspect || !currentSequence) return;
    openLinkedInTab(currentProspect.linkedinUrl, currentProspect.name, currentProspect.company);
    await copyTextToClipboard(currentSequence.day0);
    setCopyFeedback('copied_and_opened');
    setTimeout(() => setCopyFeedback(null), 2500);
  }, [currentProspect, currentSequence]);

  // Action: Copy Day 0
  const handleCopyDay0 = useCallback(async () => {
    if (!currentSequence) return;
    await copyTextToClipboard(currentSequence.day0);
    setCopyFeedback('day0');
    setTimeout(() => setCopyFeedback(null), 1800);
  }, [currentSequence]);

  // Action: Open LinkedIn
  const handleOpenLinkedIn = useCallback(() => {
    if (!currentProspect) return;
    openLinkedInTab(currentProspect.linkedinUrl, currentProspect.name, currentProspect.company);
  }, [currentProspect]);

  // Action: Mark Contacted
  const handleContacted = useCallback(() => {
    if (!currentProspect || isHandlingRef.current) return;
    isHandlingRef.current = true;
    setTimeout(() => {
      isHandlingRef.current = false;
    }, 200);

    const targetProspect = currentProspect;
    handledIdsRef.current.add(targetProspect.id);

    const previousStatus = targetProspect.status;
    const previousDate = targetProspect.lastContactedDate;

    // Push to undo stack
    setUndoStack((prev) => [
      {
        type: 'contacted',
        prospectId: targetProspect.id,
        previousStatus,
        previousContactedDate: previousDate,
        originalProspect: targetProspect
      },
      ...prev
    ]);

    // Optimistically remove from activeQueue immediately so next prospect shows with zero delay
    setActiveQueue((prev) => prev.filter((p) => p.id !== targetProspect.id));

    // Save status
    const updated = updateClientProspect(targetProspect.id, 'Contacted', currentSequence?.day0);

    // Log to outreach CRM before triggering parent update (so getClientOutreachLogs has fresh entry)
    appendClientOutreachLog({
      date: new Date().toISOString().split('T')[0],
      name: targetProspect.name,
      company: targetProspect.company,
      role: userProfile?.targetRole || targetProspect.jobOpportunity?.title || 'Software Engineer',
      personPosition: targetProspect.jobTitle,
      relationshipType: targetProspect.relationshipType,
      linkedinUrl: targetProspect.linkedinUrl,
      status: 'Contacted',
      notes: `Sent ${currentSequence?.persona || 'standard'} pitch via Review Queue`
    });

    if (updated) {
      onProspectUpdated(updated);
    }
  }, [currentProspect, currentSequence, onProspectUpdated, userProfile]);

  // Action: Mark Not Relevant
  const handleMarkNotRelevant = useCallback((reason?: NotRelevantReason) => {
    if (!currentProspect || isHandlingRef.current) return;
    isHandlingRef.current = true;
    setTimeout(() => {
      isHandlingRef.current = false;
    }, 200);

    const targetProspect = currentProspect;
    handledIdsRef.current.add(targetProspect.id);

    const previousStatus = targetProspect.status;
    const previousReason = targetProspect.notRelevantReason;

    // Push to undo stack
    setUndoStack((prev) => [
      {
        type: 'not_relevant',
        prospectId: targetProspect.id,
        previousStatus,
        previousReason,
        originalProspect: targetProspect
      },
      ...prev
    ]);

    // Optimistically remove from activeQueue immediately
    setActiveQueue((prev) => prev.filter((p) => p.id !== targetProspect.id));

    const updated = updateClientProspect(targetProspect.id, 'not_relevant', undefined, reason);
    if (updated) {
      onProspectUpdated(updated);
    }

    setShowReasonPicker(false);
  }, [currentProspect, onProspectUpdated]);

  // Action: Skip (move to back of queue)
  const handleSkip = useCallback(() => {
    if (!currentProspect || activeQueue.length <= 1) return;

    setUndoStack((prev) => [
      {
        type: 'skip',
        prospectId: currentProspect.id,
        previousStatus: currentProspect.status,
        originalProspect: currentProspect
      },
      ...prev
    ]);

    setActiveQueue((prev) => {
      const rest = prev.slice(1);
      return [...rest, currentProspect];
    });
  }, [currentProspect, activeQueue]);

  // Action: Undo last action
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;

    const [lastAction, ...remainingStack] = undoStack;
    setUndoStack(remainingStack);

    // Remove from handledIdsRef so it can be viewed again
    handledIdsRef.current.delete(lastAction.prospectId);

    if (lastAction.type === 'skip') {
      // Move last item of queue back to the front
      setActiveQueue((prev) => {
        if (prev.length <= 1) return prev;
        const last = prev[prev.length - 1];
        return [last, ...prev.slice(0, prev.length - 1)];
      });
      return;
    }

    // Revert status for 'contacted' or 'not_relevant'
    const reverted = updateClientProspect(
      lastAction.prospectId,
      lastAction.previousStatus,
      undefined,
      lastAction.previousReason
    );

    if (reverted) {
      onProspectUpdated(reverted);
      // Put prospect back at head of current queue
      setActiveQueue((prev) => [reverted, ...prev.filter((p) => p.id !== reverted.id)]);
    } else if (lastAction.originalProspect) {
      setActiveQueue((prev) => [lastAction.originalProspect!, ...prev.filter((p) => p.id !== lastAction.prospectId)]);
    }
  }, [undoStack, onProspectUpdated]);

  // Global Keyboard Shortcuts (C, N, S, U, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside an input, textarea, or contentEditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      if (e.key === 'Enter') {
        e.preventDefault();
        handleCopyAndOpen();
      } else if (key === 'c') {
        e.preventDefault();
        handleContacted();
      } else if (key === 'n') {
        e.preventDefault();
        setShowReasonPicker((prev) => !prev);
      } else if (key === 's') {
        e.preventDefault();
        handleSkip();
      } else if (key === 'u') {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCopyAndOpen, handleContacted, handleSkip, handleUndo]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    for (const p of prospects) {
      if (p.status !== 'Contacted' && p.status !== 'not_relevant' && !handledIdsRef.current.has(p.id)) {
        counts.all = (counts.all || 0) + 1;
        const cat = p.category || classifyTitle(p.jobTitle);
        counts[cat] = (counts[cat] || 0) + 1;
      }
    }
    return counts;
  }, [prospects, activeQueue.length]);

  const activeCategoryCount = categoryCounts[selectedCategory] || 0;
  const currentCategory: ProspectCategory = currentProspect
    ? (currentProspect.category || classifyTitle(currentProspect.jobTitle))
    : 'other';
  const categoryMeta = CATEGORY_METADATA[currentCategory] || CATEGORY_METADATA.other;

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
      {/* Category Tabs & Header */}
      <div className="bg-white border border-[#E0DFDC] rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0A66C2]" />
              <span>Direct Message Review Queue</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Review one prospect at a time. High-speed keyboard triage enabled.
            </p>
          </div>

          <button
            onClick={onSwitchToList}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 rounded-xl border border-zinc-200 transition-colors cursor-pointer w-fit"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Switch to Virtualized List</span>
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-100">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            {CATEGORY_TABS.map((tab) => {
              const count = categoryCounts[tab.id] || 0;
              const isSelected = selectedCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`px-3 py-1.5 rounded-xl font-medium shrink-0 cursor-pointer transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#0A66C2] text-white shadow-2xs font-semibold'
                      : 'bg-[#F4F2EE] text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-zinc-300 text-zinc-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-900 cursor-pointer select-none shrink-0 py-1">
            <input
              type="checkbox"
              checked={includeOther}
              onChange={(e) => setIncludeOther(e.target.checked)}
              className="rounded border-zinc-300 text-[#0A66C2] focus:ring-[#0A66C2] w-3.5 h-3.5 cursor-pointer"
            />
            <span className="text-[11px] font-medium">Include &apos;Other&apos; roles in queue</span>
          </label>
        </div>
      </div>

      {/* Main Single Prospect Review Card */}
      {!currentProspect ? (
        <div className="bg-white border border-[#E0DFDC] rounded-2xl p-12 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-zinc-900">Queue is Clear!</h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              All prospects in this category have been reviewed or marked. Switch categories or view all connections in the list.
            </p>
          </div>
          <button
            onClick={() => setSelectedCategory('all')}
            className="text-xs font-semibold text-[#0A66C2] bg-[#EBF3FB] hover:bg-[#0A66C2] hover:text-white px-4 py-2 rounded-xl transition-colors cursor-pointer"
          >
            Show All Pending Prospects
          </button>
        </div>
      ) : (
        <div className="bg-white border border-[#E0DFDC] rounded-2xl shadow-sm overflow-hidden divide-y divide-zinc-100 transition-all">
          {/* Progress Bar & Counter */}
          <div className="bg-zinc-50/70 px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600 font-medium">
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-900">
                Card {currentIndex + 1} of {activeQueue.length}
              </span>
              <span className="text-zinc-400">·</span>
              <span className="text-[11px] text-zinc-500">
                {activeQueue.length} remaining
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>{prospects.filter(p => p.status === 'Contacted').length} Contacted</span>
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  <XCircle className="w-3 h-3 text-amber-600" />
                  <span>{prospects.filter(p => p.status === 'not_relevant').length} Skipped</span>
                </span>
              </div>
              <div className="w-20 bg-zinc-200 h-1.5 rounded-full overflow-hidden hidden sm:block">
                <div
                  className="bg-[#0A66C2] h-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.round(((currentIndex + 1) / Math.max(activeQueue.length, 1)) * 100))}%`
                  }}
                />
              </div>
            </div>
          </div>

          {/* Prospect Profile Header */}
          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3.5">
                {/* Avatar Initials */}
                <div className="w-12 h-12 rounded-2xl bg-[#0A66C2]/10 text-[#0A66C2] border border-[#0A66C2]/20 font-bold text-base flex items-center justify-center shrink-0">
                  {currentProspect.name.slice(0, 2).toUpperCase()}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-zinc-900 hover:text-[#0A66C2] transition-colors">
                      <a
                        href={currentProspect.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline flex items-center gap-1.5"
                      >
                        {currentProspect.name}
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                      </a>
                    </h3>

                    {/* Category Badge */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${categoryMeta.badgeColor}`}
                    >
                      {categoryMeta.label}
                    </span>

                    {/* Score Badge */}
                    {currentProspect.score && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {currentProspect.score.totalScore}% Match
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-medium text-zinc-700">{currentProspect.jobTitle}</p>
                  <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{currentProspect.company}</span>
                    {currentProspect.location && (
                      <>
                        <span>·</span>
                        <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{currentProspect.location}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* 1-Click Copy DM & Open LinkedIn Profile */}
              <button
                onClick={handleCopyAndOpen}
                title="Copies Day 0 DM to clipboard and opens LinkedIn profile in one click"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0A66C2] hover:text-white bg-[#EBF3FB] hover:bg-[#0A66C2] border border-[#0A66C2]/30 px-3.5 py-2 rounded-xl transition-colors cursor-pointer w-fit shrink-0"
              >
                {copyFeedback === 'copied_and_opened' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied & Opened!</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Copy & Open Profile</span>
                  </>
                )}
              </button>
            </div>

            {/* Prominent Day 0 Message Box */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#0A66C2]" />
                  <span>Day 0 Message (Initial Note)</span>
                </span>
                {currentSequence && (
                  <span className="text-[11px] text-zinc-500">
                    {currentSequence.day0.trim().split(/\s+/).filter(Boolean).length} words · Target:{' '}
                    {currentSequence.validation.targetRange}
                  </span>
                )}
              </div>

              <div className="relative">
                <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm text-zinc-800 leading-relaxed font-sans whitespace-pre-wrap select-all font-normal">
                  {currentSequence ? (
                    currentSequence.day0
                  ) : (
                    <div className="text-amber-800 space-y-2 py-1">
                      <p className="font-semibold text-xs text-amber-900">Profile Setup Required</p>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        To generate tailored outreach direct messages, please open Settings and enter your Name and Target Role.
                      </p>
                      {onOpenSettings && (
                        <button
                          type="button"
                          onClick={onOpenSettings}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0A66C2] hover:bg-[#004182] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Open Settings
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Inline Reason Picker (shown when user taps 'Not Relevant' or presses N) */}
            {showReasonPicker && (
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900">
                    Select a reason to dismiss prospect:
                  </span>
                  <button
                    onClick={() => setShowReasonPicker(false)}
                    className="text-xs text-amber-700 hover:text-amber-900 font-bold"
                  >
                    Cancel
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    onClick={() => handleMarkNotRelevant('wrong_company')}
                    className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 font-semibold cursor-pointer transition-colors"
                  >
                    Wrong Company
                  </button>
                  <button
                    onClick={() => handleMarkNotRelevant('wrong_role')}
                    className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 font-semibold cursor-pointer transition-colors"
                  >
                    Wrong Role
                  </button>
                  <button
                    onClick={() => handleMarkNotRelevant('not_hiring')}
                    className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 font-semibold cursor-pointer transition-colors"
                  >
                    Not Hiring
                  </button>
                  <button
                    onClick={() => handleMarkNotRelevant('other')}
                    className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 font-semibold cursor-pointer transition-colors"
                  >
                    Other Reason
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons Bar with Keyboard Shortcut Badges */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                {/* 1. Primary Action: Copy & Open LinkedIn [↵ Enter] */}
                <button
                  onClick={handleCopyAndOpen}
                  title="Copies Day 0 message and opens LinkedIn profile in one click"
                  className="inline-flex items-center gap-2 text-xs font-bold bg-[#0A66C2] hover:bg-[#004182] text-white px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {copyFeedback === 'copied_and_opened' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied & Opened!</span>
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Copy & Open LinkedIn</span>
                    </>
                  )}
                  <kbd className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded font-mono">
                    ↵ Enter
                  </kbd>
                </button>

                {/* Secondary Action: Copy Only */}
                <button
                  onClick={handleCopyDay0}
                  title="Copy DM text only (without opening profile tab)"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 px-3 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  {copyFeedback === 'day0' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Copy Only</span>
                    </>
                  )}
                </button>

                {/* 2. Contacted [C] */}
                <button
                  onClick={handleContacted}
                  className="inline-flex items-center gap-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Contacted</span>
                  <kbd className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded font-mono">
                    C
                  </kbd>
                </button>

                {/* 3. Not Relevant [N] */}
                <button
                  onClick={() => setShowReasonPicker((prev) => !prev)}
                  className="inline-flex items-center gap-2 text-xs font-bold bg-zinc-100 hover:bg-amber-100 text-zinc-700 hover:text-amber-800 border border-zinc-200 hover:border-amber-300 px-3 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Not relevant</span>
                  <kbd className="text-[10px] bg-zinc-200 text-zinc-700 px-1.5 py-0.5 rounded font-mono">
                    N
                  </kbd>
                </button>

                {/* 4. Skip [S] */}
                <button
                  onClick={handleSkip}
                  className="inline-flex items-center gap-2 text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-3 py-2.5 rounded-xl border border-zinc-200 transition-colors cursor-pointer"
                >
                  <SkipForward className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Skip</span>
                  <kbd className="text-[10px] bg-zinc-200 text-zinc-700 px-1.5 py-0.5 rounded font-mono">
                    S
                  </kbd>
                </button>
              </div>

              {/* 5. Undo [U] */}
              <button
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-xl border transition-colors cursor-pointer ${
                  undoStack.length > 0
                    ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300'
                    : 'bg-zinc-50 text-zinc-300 border-zinc-100 cursor-not-allowed'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo</span>
                <kbd className="text-[10px] bg-zinc-200 text-zinc-600 px-1.5 py-0.5 rounded font-mono">
                  U
                </kbd>
              </button>
            </div>
          </div>

          {/* Collapsible "More" Section: Day 5, Day 12, Validation & Controls */}
          <div className="bg-zinc-50/50">
            <button
              onClick={() => setIsMoreOpen((prev) => !prev)}
              className="w-full px-6 py-3 flex items-center justify-between text-xs font-bold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#0A66C2]" />
                <span>More Details: Follow-ups (Day 5, 12), Controls & Validation</span>
              </span>
              {isMoreOpen ? (
                <ChevronUp className="w-4 h-4 text-zinc-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              )}
            </button>

            {isMoreOpen && currentSequence && (
              <div className="px-6 pb-6 pt-2 space-y-5 border-t border-zinc-100 animate-in fade-in duration-150">
                {/* Angle & Goal Controls */}
                <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-zinc-900">Customization Controls</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-600 block mb-1">
                        Outreach Goal
                      </label>
                      <select
                        value={customGoal}
                        onChange={(e) => setCustomGoal(e.target.value as OutreachGoal)}
                        className="w-full text-xs font-medium bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-800"
                      >
                        <option value="job-hunt">Job Hunt</option>
                        <option value="agency-leads">Agency Leads</option>
                        <option value="hire">DM to Hire</option>
                        <option value="freelancers">DM to Get Freelancers</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-zinc-600 block mb-1">
                        Pitch Angle
                      </label>
                      <select
                        value={customAngle}
                        onChange={(e) => setCustomAngle(e.target.value as MessageAngle)}
                        className="w-full text-xs font-medium bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-800"
                      >
                        <option value="standard">Standard Direct</option>
                        <option value="founding">Founding 0-to-1</option>
                        <option value="ai_rag">AI & RAG Workflows</option>
                        <option value="product_ownership">Product Ownership</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-zinc-600 block mb-1">
                        Persona Override
                      </label>
                      <select
                        value={customPersona || currentSequence.persona}
                        onChange={(e) => setCustomPersona(e.target.value as PersonaType)}
                        className="w-full text-xs font-medium bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-800"
                      >
                        <option value="founder">Founder / CEO</option>
                        <option value="cto_lead">CTO / Eng Leader</option>
                        <option value="recruiter">Recruiter / Talent</option>
                        <option value="employee">Engineer / Peer</option>
                        <option value="freelancer">Freelancer / Consultant</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Day 5 Message Box */}
                <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-800">
                      Day 5 Polite Follow-up Note
                    </span>
                    <button
                      onClick={async () => {
                        await copyTextToClipboard(currentSequence.day5);
                        setCopyFeedback('day5');
                        setTimeout(() => setCopyFeedback(null), 1500);
                      }}
                      className="text-xs text-[#0A66C2] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      {copyFeedback === 'day5' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copyFeedback === 'day5' ? 'Copied' : 'Copy Day 5'}</span>
                    </button>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-lg text-xs text-zinc-700 whitespace-pre-wrap">
                    {currentSequence.day5}
                  </div>
                </div>

                {/* Day 12 Message Box */}
                <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-800">
                      Day 12 Final Break-up Note
                    </span>
                    <button
                      onClick={async () => {
                        await copyTextToClipboard(currentSequence.day12);
                        setCopyFeedback('day12');
                        setTimeout(() => setCopyFeedback(null), 1500);
                      }}
                      className="text-xs text-[#0A66C2] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      {copyFeedback === 'day12' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copyFeedback === 'day12' ? 'Copied' : 'Copy Day 12'}</span>
                    </button>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-lg text-xs text-zinc-700 whitespace-pre-wrap">
                    {currentSequence.day12}
                  </div>
                </div>

                {/* Quality Validation Details */}
                <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-zinc-800">Sequence Quality Checks</h4>
                  <div className="text-xs space-y-1.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-zinc-600">
                        Greeting personalized: <strong>{currentSequence.validation.hasGreetingName ? 'Yes' : 'No'}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-zinc-600">
                        Zero banned AI clichés found
                      </span>
                    </div>
                    {currentSequence.validation.issues.length > 0 && (
                      <div className="pt-2 text-amber-700 space-y-1">
                        {currentSequence.validation.issues.map((issue, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-xs">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{issue.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
