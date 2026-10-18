'use client';

import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  Mail,
  Phone,
  Sparkles,
  Building2,
  MapPin,
  ExternalLink,
  Users,
  Briefcase,
  Target,
  UserCheck,
  Laptop,
  CheckCircle2,
  Calendar,
  X,
  Copy,
  Check,
  ArrowUpDown,
  Zap,
  RotateCcw,
  SlidersHorizontal,
  Layers,
  XCircle
} from 'lucide-react';
import { FixedSizeList as List } from 'react-window';
import { Prospect, SegregationGroup, OutreachGoal, NotRelevantReason, UserProfile } from '@/types';
import { WorkflowType } from './WorkflowView';
import { copyTextToClipboard, openLinkedInTab } from '@/lib/clipboard';
import {
  getClientProfile,
  appendClientOutreachLog,
  updateClientProspect,
  isProfileComplete
} from '@/lib/clientStorage';
import { generatePersonalizedDM } from '@/lib/generator';
import { classifyTitle, CATEGORY_METADATA } from '@/lib/classifier';
import { ReviewQueueView } from './ReviewQueueView';

export type SortOption =
  | 'score-desc'
  | 'score-asc'
  | 'name-asc'
  | 'name-desc'
  | 'date-desc'
  | 'date-asc'
  | 'contact-first';

interface SegregatedConnectionsViewProps {
  workflow: WorkflowType;
  prospects: Prospect[];
  onBack: () => void;
  onReset?: () => void;
  onReviewDM: (prospect: Prospect) => void;
  onProspectUpdated?: (updated: Prospect) => void;
  userProfile?: UserProfile | null;
  onOpenSettings?: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'P';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const REASON_LABELS: Record<NotRelevantReason, string> = {
  wrong_company: 'Wrong Company',
  wrong_role: 'Wrong Role',
  not_hiring: 'Not Hiring',
  other: 'Not Relevant'
};

export function SegregatedConnectionsView({
  workflow,
  prospects,
  onBack,
  onReset,
  onReviewDM,
  onProspectUpdated,
  userProfile,
  onOpenSettings
}: SegregatedConnectionsViewProps) {
  // View mode: 'queue' (Single card review queue), 'list' (Virtualized list), 'not_relevant' (Dismissed prospects)
  const [viewMode, setViewMode] = useState<'queue' | 'list' | 'not_relevant'>('queue');

  const [activeGroup, setActiveGroup] = useState<'All' | SegregationGroup>('All');
  const [hasContactOnly, setHasContactOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('All');
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null);
  const [copiedDMId, setCopiedDMId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('score-desc');
  const [lastOpenedProspect, setLastOpenedProspect] = useState<Prospect | null>(null);
  const [showQuickReturnPrompt, setShowQuickReturnPrompt] = useState(false);
  const [isLoggingQuick, setIsLoggingQuick] = useState(false);

  // Detect when user returns from LinkedIn tab
  React.useEffect(() => {
    const handleReturn = () => {
      if (document.visibilityState === 'visible' && lastOpenedProspect && lastOpenedProspect.status !== 'Contacted') {
        setShowQuickReturnPrompt(true);
      }
    };
    document.addEventListener('visibilitychange', handleReturn);
    window.addEventListener('focus', handleReturn);
    return () => {
      document.removeEventListener('visibilitychange', handleReturn);
      window.removeEventListener('focus', handleReturn);
    };
  }, [lastOpenedProspect]);

  const handleQuickCopyAndOpen = async (p: Prospect) => {
    const prof = getClientProfile();
    if (!prof || !isProfileComplete(prof, workflow)) {
      alert('Please upload your resume and confirm your profile details on the Home tab first.');
      return;
    }

    const targetRole =
      p.jobOpportunity?.title && p.jobOpportunity.title !== p.jobTitle
        ? p.jobOpportunity.title
        : prof.targetRole || prof.targetRoles?.[0] || '';

    // 1. Synchronously open LinkedIn
    openLinkedInTab(p.linkedinUrl, p.name, p.company);

    // 2. Generate persona-aware DM
    const generated = generatePersonalizedDM(p, targetRole, 'standard', prof, workflow);
    const msg = generated.day0;

    // 3. Write to clipboard
    await copyTextToClipboard(msg);
    setCopiedDMId(p.id);
    setTimeout(() => setCopiedDMId(null), 3000);

    // 4. Save drafted message
    updateClientProspect(p.id, p.status, msg);
    setLastOpenedProspect(p);
  };

  const handleConfirmQuickContacted = () => {
    if (!lastOpenedProspect) return;
    setIsLoggingQuick(true);
    try {
      const prof = getClientProfile();
      const updated = updateClientProspect(lastOpenedProspect.id, 'Contacted');
      if (updated && onProspectUpdated) {
        onProspectUpdated(updated);
      }

      appendClientOutreachLog({
        date: new Date().toISOString().split('T')[0],
        name: lastOpenedProspect.name,
        company: lastOpenedProspect.company,
        role: prof?.targetRole || lastOpenedProspect.jobOpportunity?.title || 'Software Engineer',
        personPosition: lastOpenedProspect.jobTitle,
        relationshipType: lastOpenedProspect.relationshipType,
        linkedinUrl: lastOpenedProspect.linkedinUrl,
        status: 'Contacted',
        notes: `Quick 1-click DM sent via Segregated Dashboard`
      });

      setShowQuickReturnPrompt(false);
      setLastOpenedProspect(null);
    } finally {
      setIsLoggingQuick(false);
    }
  };

  const handleCopyEmail = async (e: React.MouseEvent, id: string, email: string) => {
    e.stopPropagation();
    await copyTextToClipboard(email);
    setCopiedEmailId(id);
    setTimeout(() => setCopiedEmailId(null), 2000);
  };

  // Restore a prospect from not_relevant back to Not contacted
  const handleRestore = (p: Prospect) => {
    const updated = updateClientProspect(p.id, 'Not contacted', undefined, undefined);
    if (updated && onProspectUpdated) {
      onProspectUpdated(updated);
    }
  };

  // Restore all dismissed prospects
  const handleRestoreAll = () => {
    for (const p of prospects) {
      if (p.status === 'not_relevant') {
        const updated = updateClientProspect(p.id, 'Not contacted', undefined, undefined);
        if (updated && onProspectUpdated) {
          onProspectUpdated(updated);
        }
      }
    }
  };

  // Strictly deduplicate prospects by LinkedIn URL or name|company
  const uniqueProspects = useMemo(() => {
    const seen = new Set<string>();
    const res: Prospect[] = [];
    for (const p of prospects) {
      if (p.name === 'Prospect' && (p.company === 'Startup' || p.jobTitle === 'Engineer')) {
        continue;
      }
      const key = (p.linkedinUrl && p.linkedinUrl.includes('linkedin.com/in/'))
        ? p.linkedinUrl.trim().toLowerCase().replace(/\/+$/, '')
        : `${p.name.trim().toLowerCase()}|${p.company.trim().toLowerCase()}`;

      if (!seen.has(key)) {
        seen.add(key);
        // Ensure category is assigned
        if (!p.category) {
          p.category = classifyTitle(p.jobTitle);
        }
        res.push(p);
      }
    }
    return res;
  }, [prospects]);

  // Not relevant prospects
  const notRelevantProspects = useMemo(() => {
    return uniqueProspects.filter((p) => p.status === 'not_relevant');
  }, [uniqueProspects]);

  // Active prospects for list view (excluding not_relevant)
  const activeProspects = useMemo(() => {
    return uniqueProspects.filter((p) => p.status !== 'not_relevant');
  }, [uniqueProspects]);

  // Distinct companies for filtering
  const companies = useMemo(() => {
    const set = new Set<string>();
    activeProspects.forEach((p) => {
      if (p.company && p.company !== 'Startup') set.add(p.company);
    });
    return Array.from(set).slice(0, 30);
  }, [activeProspects]);

  // Group metrics
  const stats = useMemo(() => {
    const total = activeProspects.length;
    const founders = activeProspects.filter((p) => p.segregationGroup === 'Founder').length;
    const hr = activeProspects.filter((p) => p.segregationGroup === 'HR').length;
    const employees = activeProspects.filter((p) => p.segregationGroup === 'Employee').length;
    const withContact = activeProspects.filter((p) => Boolean(p.email || p.phoneNumber)).length;
    return { total, founders, hr, employees, withContact };
  }, [activeProspects]);

  // Filtered & Prioritized Prospects for list view
  const filtered = useMemo(() => {
    const list = activeProspects.filter((p) => {
      // Group filter
      if (activeGroup !== 'All' && p.segregationGroup !== activeGroup) {
        return false;
      }

      // Has email/phone only filter
      if (hasContactOnly && !p.email && !p.phoneNumber) {
        return false;
      }

      // Company filter
      if (selectedCompany !== 'All' && p.company !== selectedCompany) {
        return false;
      }

      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchCompany = p.company.toLowerCase().includes(q);
        const matchTitle = p.jobTitle.toLowerCase().includes(q);
        const matchEmail = p.email?.toLowerCase().includes(q);
        if (!matchName && !matchCompany && !matchTitle && !matchEmail) {
          return false;
        }
      }

      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === 'score-desc') {
        const diff = (b.score?.totalScore ?? 0) - (a.score?.totalScore ?? 0);
        if (diff !== 0) return diff;
        const aContact = a.email || a.phoneNumber ? 1 : 0;
        const bContact = b.email || b.phoneNumber ? 1 : 0;
        return bContact - aContact;
      }
      if (sortBy === 'score-asc') {
        return (a.score?.totalScore ?? 0) - (b.score?.totalScore ?? 0);
      }
      if (sortBy === 'name-asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'name-desc') {
        return b.name.localeCompare(a.name);
      }
      if (sortBy === 'date-desc') {
        const dateA = a.connectedOn ? Date.parse(a.connectedOn) || 0 : 0;
        const dateB = b.connectedOn ? Date.parse(b.connectedOn) || 0 : 0;
        return dateB - dateA;
      }
      if (sortBy === 'date-asc') {
        const dateA = a.connectedOn ? Date.parse(a.connectedOn) || 0 : 0;
        const dateB = b.connectedOn ? Date.parse(b.connectedOn) || 0 : 0;
        return dateA - dateB;
      }
      if (sortBy === 'contact-first') {
        const aContact = a.email || a.phoneNumber ? 1 : 0;
        const bContact = b.email || b.phoneNumber ? 1 : 0;
        if (bContact !== aContact) return bContact - aContact;
        return (b.score?.totalScore ?? 0) - (a.score?.totalScore ?? 0);
      }
      return 0;
    });
  }, [activeProspects, activeGroup, hasContactOnly, selectedCompany, searchQuery, sortBy]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Bar / Navigation & View Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white border border-[#E0DFDC] rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-[#0A66C2] hover:bg-[#0A66C2]/10 transition-colors py-1.5 px-3 rounded-full w-fit cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Change Upload / Mode</span>
          </button>

          {onReset && (
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 py-1.5 px-3 rounded-full transition-colors cursor-pointer"
            >
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* View Switcher Pills */}
        <div className="flex items-center gap-1.5 bg-[#F4F2EE] p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setViewMode('queue')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'queue'
                ? 'bg-white text-[#0A66C2] shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Review Queue</span>
          </button>

          <button
            onClick={() => setViewMode('list')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'list'
                ? 'bg-white text-[#0A66C2] shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Prospects ({activeProspects.length})</span>
          </button>

          <button
            onClick={() => setViewMode('not_relevant')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'not_relevant'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Not Relevant</span>
            {notRelevantProspects.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-bold">
                {notRelevantProspects.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: REVIEW QUEUE (SINGLE CARD) */}
      {viewMode === 'queue' && (
        <ReviewQueueView
          prospects={uniqueProspects}
          workflow={workflow as OutreachGoal}
          onProspectUpdated={(updated) => {
            if (onProspectUpdated) onProspectUpdated(updated);
          }}
          onSwitchToList={() => setViewMode('list')}
          userProfile={userProfile}
          onOpenSettings={onOpenSettings}
        />
      )}

      {/* VIEW MODE 2: NOT RELEVANT LIST (WITH RESTORE) */}
      {viewMode === 'not_relevant' && (
        <div className="bg-white border border-[#E0DFDC] rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-amber-600" />
                <span>Dismissed & Not Relevant Prospects</span>
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Prospects marked as not relevant are excluded from outreach. You can restore anyone with one click.
              </p>
            </div>

            {notRelevantProspects.length > 0 && (
              <button
                onClick={handleRestoreAll}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-2 rounded-xl transition-colors cursor-pointer w-fit"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore All ({notRelevantProspects.length})</span>
              </button>
            )}
          </div>

          {notRelevantProspects.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-zinc-300 mx-auto" />
              <p className="text-sm font-semibold text-zinc-700">No dismissed prospects.</p>
              <p className="text-xs text-zinc-500">
                When you dismiss a card in the Review Queue using &quot;Not Relevant&quot;, it will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notRelevantProspects.map((prospect) => {
                const cat = prospect.category || classifyTitle(prospect.jobTitle);
                const catMeta = CATEGORY_METADATA[cat] || CATEGORY_METADATA.other;
                const reasonLabel = prospect.notRelevantReason
                  ? REASON_LABELS[prospect.notRelevantReason]
                  : 'Not Relevant';

                return (
                  <div
                    key={prospect.id}
                    className="p-4 rounded-xl border border-zinc-200 hover:border-zinc-300 bg-zinc-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-200 text-zinc-600 font-bold text-xs flex items-center justify-center shrink-0">
                        {getInitials(prospect.name)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-zinc-900">{prospect.name}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${catMeta.badgeColor}`}>
                            {catMeta.label}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                            Reason: {reasonLabel}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-600">{prospect.jobTitle} · {prospect.company}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRestore(prospect)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-300 px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer w-fit shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore to Queue</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 3: ALL PROSPECTS (VIRTUALIZED LIST VIEW) */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {/* Controls: Search, Sort & Company filter */}
          <div className="bg-white border border-[#E0DFDC] rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search connections by name, company, title, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#F4F2EE]/50 border border-[#E0DFDC] focus:border-[#0A66C2] focus:bg-white rounded-xl pl-10 pr-9 py-2 text-xs font-medium text-zinc-900 focus:outline-none transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                <div className="flex items-center gap-1.5 bg-[#F4F2EE] border border-[#E0DFDC] rounded-xl px-3 py-1.5 text-xs font-semibold text-zinc-800 shrink-0">
                  <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="bg-transparent border-none text-xs font-semibold text-zinc-800 focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="score-desc">Score: High to Low</option>
                    <option value="score-asc">Score: Low to High</option>
                    <option value="name-asc">Alphabetical (A → Z)</option>
                    <option value="name-desc">Alphabetical (Z → A)</option>
                    <option value="date-desc">Latest Connected</option>
                    <option value="date-asc">Oldest Connected</option>
                    <option value="contact-first">Has Direct Contact First</option>
                  </select>
                </div>

                {companies.length > 0 && (
                  <select
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value)}
                    className="bg-[#F4F2EE] border border-[#E0DFDC] rounded-xl px-3 py-2 text-xs font-semibold text-zinc-800 focus:outline-none cursor-pointer"
                  >
                    <option value="All">All Companies ({companies.length})</option>
                    {companies.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Results count & reset */}
            <div className="flex items-center justify-between text-xs text-zinc-500 pt-1">
              <span>
                Showing <strong className="text-zinc-900">{filtered.length}</strong> active connections
              </span>
              {(searchQuery || selectedCompany !== 'All' || sortBy !== 'score-desc') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCompany('All');
                    setSortBy('score-desc');
                  }}
                  className="text-xs text-[#0A66C2] hover:underline font-semibold cursor-pointer"
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>

          {/* Virtualized Prospect List via react-window */}
          {filtered.length === 0 ? (
            <div className="bg-white border border-[#E0DFDC] rounded-2xl p-12 text-center text-xs sm:text-sm text-zinc-500 shadow-xs space-y-2">
              <p className="font-bold text-zinc-900">No connections match your search.</p>
              <p className="text-xs text-zinc-500">Try clearing the search query or company filter.</p>
            </div>
          ) : (
            <div className="bg-white border border-[#E0DFDC] rounded-2xl shadow-xs overflow-hidden p-2">
              <List
                height={680}
                itemCount={filtered.length}
                itemSize={134}
                width="100%"
              >
                {({ index, style }) => {
                  const prospect = filtered[index];
                  if (!prospect) return null;

                  const hasEmail = Boolean(prospect.email);
                  const hasPhone = Boolean(prospect.phoneNumber);
                  const cat = prospect.category || classifyTitle(prospect.jobTitle);
                  const catMeta = CATEGORY_METADATA[cat] || CATEGORY_METADATA.other;

                  return (
                    <div style={style} className="p-1.5">
                      <div className="bg-white border border-zinc-200 hover:border-[#0A66C2] rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 h-full">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-[#0A66C2]/10 text-[#0A66C2] font-bold text-xs flex items-center justify-center shrink-0">
                            {getInitials(prospect.name)}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-zinc-900 truncate">
                                {prospect.name}
                              </h4>
                              <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${catMeta.badgeColor}`}>
                                {catMeta.label}
                              </span>
                              {prospect.score && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {prospect.score.totalScore}%
                                </span>
                              )}
                              {prospect.status === 'Contacted' && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                                  Contacted ✓
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-600 font-medium truncate">
                              {prospect.jobTitle}
                            </p>
                            <p className="text-xs text-zinc-400 flex items-center gap-1.5 truncate">
                              <span>{prospect.company}</span>
                              {prospect.location && <span>· {prospect.location}</span>}
                              {hasEmail && <span className="text-emerald-600 font-semibold">· Email available</span>}
                            </p>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => onReviewDM(prospect)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors cursor-pointer"
                          >
                            Review DM
                          </button>
                          <button
                            onClick={() => handleQuickCopyAndOpen(prospect)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                              copiedDMId === prospect.id
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[#0A66C2] hover:bg-[#004182] text-white'
                            }`}
                          >
                            {copiedDMId === prospect.id ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Copied & Opened</span>
                              </>
                            ) : (
                              <>
                                <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
                                <span>Copy & Open</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }}
              </List>
            </div>
          )}
        </div>
      )}

      {/* Floating Prompt on Returning from LinkedIn */}
      {showQuickReturnPrompt && lastOpenedProspect && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white border border-[#E0DFDC] rounded-2xl p-4 shadow-xl animate-in slide-in-from-bottom-4 duration-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#0A66C2]" />
              Did you send the DM to {lastOpenedProspect.name.split(' ')[0]}?
            </span>
            <button
              onClick={() => setShowQuickReturnPrompt(false)}
              className="text-zinc-400 hover:text-zinc-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-zinc-500">
            Click to mark as contacted and update your outreach log.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleConfirmQuickContacted}
              disabled={isLoggingQuick}
              className="flex-1 py-2 px-3.5 rounded-full bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5px]" />
              <span>{isLoggingQuick ? 'Logging...' : 'Yes, Mark Contacted'}</span>
            </button>
            <button
              onClick={() => setShowQuickReturnPrompt(false)}
              className="py-2 px-3.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
