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
  Zap
} from 'lucide-react';
import { Prospect, SegregationGroup } from '@/types';
import { WorkflowType } from './WorkflowView';
import { copyTextToClipboard, openLinkedInTab } from '@/lib/clipboard';
import {
  getClientProfile,
  appendClientOutreachLog,
  updateClientProspect,
  isProfileComplete
} from '@/lib/clientStorage';
import { generatePersonalizedDM } from '@/lib/generator';

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
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'P';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function SegregatedConnectionsView({
  workflow,
  prospects,
  onBack,
  onReset,
  onReviewDM,
  onProspectUpdated
}: SegregatedConnectionsViewProps) {
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

    // 5. Set tracking prospect
    setLastOpenedProspect(p);
  };

  const handleConfirmQuickContacted = async () => {
    if (!lastOpenedProspect) return;
    setIsLoggingQuick(true);
    const today = new Date().toISOString().split('T')[0];
    const prof = getClientProfile();
    const role =
      lastOpenedProspect.jobOpportunity?.title && lastOpenedProspect.jobOpportunity.title !== lastOpenedProspect.jobTitle
        ? lastOpenedProspect.jobOpportunity.title
        : prof?.targetRole || prof?.targetRoles?.[0] || '';

    const logEntry = {
      date: today,
      name: lastOpenedProspect.name,
      company: lastOpenedProspect.company,
      role,
      personPosition: lastOpenedProspect.jobTitle,
      relationshipType: lastOpenedProspect.relationshipType,
      linkedinUrl: lastOpenedProspect.linkedinUrl,
      status: 'Contacted' as const
    };

    appendClientOutreachLog(logEntry);
    updateClientProspect(lastOpenedProspect.id, 'Contacted', lastOpenedProspect.draftedMessage);

    try {
      await fetch('/api/outreach-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'append',
          prospectId: lastOpenedProspect.id,
          ...logEntry
        })
      });
    } catch {}

    const updated = {
      ...lastOpenedProspect,
      status: 'Contacted' as const,
      lastContactedDate: today
    };
    onProspectUpdated?.(updated);
    setIsLoggingQuick(false);
    setShowQuickReturnPrompt(false);
    setLastOpenedProspect(null);
  };

  const handleCopyEmail = (e: React.MouseEvent, id: string, email: string) => {
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(email);
      setCopiedEmailId(id);
      setTimeout(() => setCopiedEmailId(null), 2000);
    }
  };

  // Workflow titles
  const getWorkflowTitle = () => {
    switch (workflow) {
      case 'job-hunt':
        return {
          title: 'Job Hunt Outreach Queue',
          badge: 'Job Hunt Mode',
          desc: 'Connections segregated by hiring decision-makers, recruiters, and engineering peers.'
        };
      case 'agency-leads':
        return {
          title: 'Agency Leads & Decision Makers',
          badge: 'Agency Leads Mode',
          desc: 'High-value founders and business leaders ready for outbound agency pitching.'
        };
      case 'hire':
        return {
          title: 'Candidate Talent Pool',
          badge: 'Hiring Mode',
          desc: 'Candidates and employees matched against your uploaded Job Description.'
        };
      case 'freelancers':
        return {
          title: 'Freelance & Contract Talent',
          badge: 'Freelancers Mode',
          desc: 'Independent specialists and domain experts discovered in your connections.'
        };
    }
  };

  const meta = getWorkflowTitle();

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
        res.push(p);
      }
    }
    return res;
  }, [prospects]);

  // Distinct companies for filtering
  const companies = useMemo(() => {
    const set = new Set<string>();
    uniqueProspects.forEach((p) => {
      if (p.company && p.company !== 'Startup') set.add(p.company);
    });
    return Array.from(set).slice(0, 30);
  }, [uniqueProspects]);

  // Group metrics
  const stats = useMemo(() => {
    const total = uniqueProspects.length;
    const founders = uniqueProspects.filter((p) => p.segregationGroup === 'Founder').length;
    const hr = uniqueProspects.filter((p) => p.segregationGroup === 'HR').length;
    const employees = uniqueProspects.filter((p) => p.segregationGroup === 'Employee').length;
    const withContact = uniqueProspects.filter((p) => Boolean(p.email || p.phoneNumber)).length;
    return { total, founders, hr, employees, withContact };
  }, [uniqueProspects]);

  // Filtered & Prioritized Prospects
  const filtered = useMemo(() => {
    const list = uniqueProspects.filter((p) => {
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
  }, [uniqueProspects, activeGroup, hasContactOnly, selectedCompany, searchQuery, sortBy]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Bar / Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-[#0A66C2] hover:bg-[#0A66C2]/10 transition-colors py-1.5 px-3 rounded-full w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Upload New Files / Change Mode</span>
        </button>

        <div className="flex items-center gap-2">
          {onReset && (
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 py-1.5 px-3 rounded-full transition-colors"
            >
              <span>Reset & Re-upload</span>
            </button>
          )}
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white text-zinc-800 border border-[#E0DFDC] shadow-2xs w-fit">
            {meta.badge} · {stats.total} Total Connections
          </span>
        </div>
      </div>

      {/* Header card with summary breakdown */}
      <div className="bg-white border border-[#E0DFDC] rounded-xl p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">{meta.title}</h2>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">{meta.desc}</p>
        </div>

        {/* 4 Summary Stat Pills (Clickable as Quick Segregation Filters) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#E0DFDC]">
          <div
            onClick={() => setActiveGroup(activeGroup === 'Founder' ? 'All' : 'Founder')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              activeGroup === 'Founder'
                ? 'bg-[#0A66C2] text-white border-[#0A66C2] shadow-xs'
                : 'bg-white hover:bg-[#F4F2EE] border-[#E0DFDC] text-zinc-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${activeGroup === 'Founder' ? 'text-blue-100' : 'text-zinc-500'}`}>
                Founders & CXOs
              </span>
              <Target className={`w-3.5 h-3.5 ${activeGroup === 'Founder' ? 'text-blue-100' : 'text-[#0A66C2]'}`} />
            </div>
            <span className="text-xl font-black mt-1 block">{stats.founders}</span>
          </div>

          <div
            onClick={() => setActiveGroup(activeGroup === 'HR' ? 'All' : 'HR')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              activeGroup === 'HR'
                ? 'bg-[#0A66C2] text-white border-[#0A66C2] shadow-xs'
                : 'bg-white hover:bg-[#F4F2EE] border-[#E0DFDC] text-zinc-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${activeGroup === 'HR' ? 'text-blue-100' : 'text-zinc-500'}`}>
                HR & Recruiters
              </span>
              <Users className={`w-3.5 h-3.5 ${activeGroup === 'HR' ? 'text-blue-100' : 'text-[#0A66C2]'}`} />
            </div>
            <span className="text-xl font-black mt-1 block">{stats.hr}</span>
          </div>

          <div
            onClick={() => setActiveGroup(activeGroup === 'Employee' ? 'All' : 'Employee')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              activeGroup === 'Employee'
                ? 'bg-[#0A66C2] text-white border-[#0A66C2] shadow-xs'
                : 'bg-white hover:bg-[#F4F2EE] border-[#E0DFDC] text-zinc-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${activeGroup === 'Employee' ? 'text-blue-100' : 'text-zinc-500'}`}>
                Working Employees
              </span>
              <Briefcase className={`w-3.5 h-3.5 ${activeGroup === 'Employee' ? 'text-blue-100' : 'text-[#0A66C2]'}`} />
            </div>
            <span className="text-xl font-black mt-1 block">{stats.employees}</span>
          </div>

          <div
            onClick={() => setHasContactOnly(!hasContactOnly)}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              hasContactOnly
                ? 'bg-[#057642] text-white border-[#057642] shadow-xs'
                : 'bg-white hover:bg-[#F4F2EE] border-[#E0DFDC] text-zinc-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${hasContactOnly ? 'text-emerald-100' : 'text-[#057642]'}`}>
                With Email / Phone
              </span>
              <Mail className={`w-3.5 h-3.5 ${hasContactOnly ? 'text-emerald-100' : 'text-[#057642]'}`} />
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black">{stats.withContact}</span>
              <span className={`text-[10px] font-medium ${hasContactOnly ? 'text-emerald-100' : 'text-[#057642]'}`}>prioritized</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Controls Bar */}
      <div className="bg-white border border-[#E0DFDC] rounded-xl p-3 sm:p-3.5 shadow-xs">
        <div className="flex flex-col lg:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, role, company or email..."
              className="w-full bg-[#F4F2EE]/40 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 rounded-xl pl-9.5 pr-8 py-2.5 border border-[#E0DFDC] focus:outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full lg:w-auto">
            {/* Sort Dropdown with Icon */}
            <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-800 shrink-0 w-full sm:w-auto">
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-transparent border-none text-xs font-semibold text-zinc-800 focus:outline-none cursor-pointer w-full sm:w-auto pr-1"
              >
                <option value="score-desc">Score: High to Low (Top Match)</option>
                <option value="score-asc">Score: Low to High</option>
                <option value="name-asc">Alphabetical (A → Z)</option>
                <option value="name-desc">Alphabetical (Z → A)</option>
                <option value="date-desc">Latest Connected</option>
                <option value="date-asc">Oldest Connected</option>
                <option value="contact-first">Has Email / Phone First</option>
              </select>
            </div>

            {/* Company Filter Dropdown */}
            {companies.length > 0 && (
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full sm:w-48 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-zinc-800 focus:outline-none focus:border-zinc-400 shrink-0"
              >
                <option value="All">All Companies ({companies.length})</option>
                {companies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span>
            Showing <strong className="text-zinc-900">{filtered.length}</strong> connections
            {activeGroup !== 'All' ? ` (${activeGroup === 'Founder' ? 'Founders & CXOs' : activeGroup === 'HR' ? 'HR & Recruiters' : 'Working Employees'})` : ''}
            {hasContactOnly ? ' · with Email/Phone' : ''}
          </span>
          {(activeGroup !== 'All' || hasContactOnly || selectedCompany !== 'All' || searchQuery || sortBy !== 'score-desc') && (
            <button
              onClick={() => {
                setActiveGroup('All');
                setHasContactOnly(false);
                setSelectedCompany('All');
                setSearchQuery('');
                setSortBy('score-desc');
              }}
              className="text-xs text-zinc-600 hover:text-zinc-900 underline font-medium cursor-pointer"
            >
              Reset filters
            </button>
          )}
        </div>
        <span className="hidden sm:inline text-zinc-400">
          Sorted by:{' '}
          <strong className="text-zinc-700 font-semibold">
            {sortBy === 'score-desc'
              ? 'Highest Match Score'
              : sortBy === 'score-asc'
              ? 'Lowest Match Score'
              : sortBy === 'name-asc'
              ? 'Alphabetical (A → Z)'
              : sortBy === 'name-desc'
              ? 'Alphabetical (Z → A)'
              : sortBy === 'date-desc'
              ? 'Latest Connected'
              : sortBy === 'date-asc'
              ? 'Oldest Connected'
              : 'Has Email / Phone First'}
          </strong>
        </span>
      </div>

      {/* Segregated Connections Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-[#E0DFDC] rounded-xl p-12 text-center text-xs sm:text-sm text-zinc-500 shadow-xs space-y-2">
          <p className="font-bold text-zinc-900">No connections match the selected filters.</p>
          <p className="text-xs text-zinc-500">Try resetting the search or category filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((prospect) => {
            const hasEmail = Boolean(prospect.email);
            const hasPhone = Boolean(prospect.phoneNumber);
            const hasDirectContact = hasEmail || hasPhone;

            return (
              <div
                key={prospect.id}
                className="touch-card bg-white border border-[#E0DFDC] hover:border-[#0A66C2]/60 hover:shadow-md rounded-xl p-5 shadow-xs flex flex-col justify-between transition-all duration-200 group"
              >
                <div className="space-y-3.5">
                  {/* Top line: Avatar, Full Name & Segregation Badge */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${
                        prospect.segregationGroup === 'Founder'
                          ? 'bg-[#EDE7F6] text-[#5E35B1] border-[#D1C4E9]'
                          : prospect.segregationGroup === 'HR'
                          ? 'bg-[#EBF3FB] text-[#0A66C2] border-[#C2E0F9]'
                          : 'bg-zinc-100 text-zinc-700 border-[#E0DFDC]'
                      }`}
                    >
                      {getInitials(prospect.name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-zinc-900 leading-snug break-words group-hover:text-[#0A66C2] transition-colors">
                          {prospect.name}
                        </h3>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 tracking-wide uppercase ${
                            prospect.segregationGroup === 'Founder'
                              ? 'bg-[#EDE7F6] text-[#5E35B1] border-[#D1C4E9]'
                              : prospect.segregationGroup === 'HR'
                              ? 'bg-[#EBF3FB] text-[#0A66C2] border-[#C2E0F9]'
                              : 'bg-zinc-100 text-zinc-700 border-[#E0DFDC]'
                          }`}
                        >
                          {prospect.segregationGroup === 'Founder'
                            ? 'Founder'
                            : prospect.segregationGroup === 'HR'
                            ? 'Recruiter'
                            : 'Employee'}
                        </span>
                      </div>

                      <p
                        className="text-xs text-zinc-600 font-medium leading-relaxed line-clamp-2 mt-0.5 break-words"
                        title={prospect.jobTitle}
                      >
                        {prospect.jobTitle}
                      </p>
                    </div>
                  </div>

                  {/* Company & Location Info */}
                  <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-zinc-500 pt-0.5">
                    <span className="inline-flex items-center gap-1.5 font-medium text-zinc-700 break-words">
                      <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span>{prospect.company}</span>
                    </span>
                    {prospect.location && (
                      <span className="inline-flex items-center gap-1 text-zinc-500 break-words">
                        <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                        <span>{prospect.location}</span>
                      </span>
                    )}
                  </div>

                  {/* Direct Contact Badges (Email & Phone) */}
                  {hasDirectContact ? (
                    <div className="bg-[#057642]/5 border border-[#057642]/20 rounded-xl p-3 space-y-1.5 text-xs">
                      {hasEmail && (
                        <div className="flex items-center justify-between gap-2 text-[#057642] font-medium">
                          <div className="flex items-center gap-1.5 min-w-0 break-all select-all">
                            <Mail className="w-3.5 h-3.5 text-[#057642] shrink-0" />
                            <span className="text-xs leading-tight font-semibold">{prospect.email}</span>
                          </div>
                          <button
                            onClick={(e) => handleCopyEmail(e, prospect.id, prospect.email!)}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-[#057642]/10 hover:bg-[#057642]/20 text-[#057642] font-semibold shrink-0 flex items-center gap-1 transition-colors"
                            title="Copy email address"
                          >
                            {copiedEmailId === prospect.id ? (
                              <>
                                <Check className="w-3 h-3 text-[#057642]" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-[#057642]" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                      {hasPhone && (
                        <div className="flex items-center gap-1.5 text-[#057642] font-medium break-all select-all">
                          <Phone className="w-3.5 h-3.5 text-[#057642] shrink-0" />
                          <span className="text-xs leading-tight font-semibold">{prospect.phoneNumber}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-zinc-400 font-normal flex items-center gap-1.5 pt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-300"></span>
                      <span>LinkedIn InMail / Direct Message</span>
                    </div>
                  )}

                  {/* Connected On Date if available */}
                  {prospect.connectedOn && (
                    <p className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-zinc-400" />
                      <span>Connected on {prospect.connectedOn}</span>
                    </p>
                  )}
                </div>

                {/* Bottom Action Row */}
                <div className="pt-3.5 mt-3.5 border-t border-[#E0DFDC] flex items-center justify-between gap-2">
                  <button
                    onClick={() => onReviewDM(prospect)}
                    className="text-xs text-[#0A66C2] hover:bg-[#0A66C2]/10 border border-[#0A66C2]/30 font-semibold flex items-center gap-1.5 py-1.5 px-3 rounded-full transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#0A66C2]" />
                    <span>Review DM</span>
                  </button>

                  <button
                    onClick={() => handleQuickCopyAndOpen(prospect)}
                    className={`py-2 px-4 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98] ${
                      prospect.status === 'Contacted'
                        ? 'bg-[#057642]/10 text-[#057642] border border-[#057642]/30'
                        : copiedDMId === prospect.id
                        ? 'bg-[#057642] text-white'
                        : 'bg-[#0A66C2] hover:bg-[#004182] text-white'
                    }`}
                  >
                    {copiedDMId === prospect.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3px]" />
                        <span>Copied & Opened ✓</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                        <span>{prospect.status === 'Contacted' ? 'Contacted ✓' : 'Copy & Open Profile'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
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
              className="flex-1 py-2 px-3.5 rounded-full bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5px]" />
              <span>{isLoggingQuick ? 'Logging...' : 'Yes, Mark Contacted'}</span>
            </button>
            <button
              onClick={() => setShowQuickReturnPrompt(false)}
              className="py-2 px-3.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
