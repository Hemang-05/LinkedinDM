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
  X
} from 'lucide-react';
import { Prospect, SegregationGroup } from '@/types';
import { WorkflowType } from './WorkflowView';

interface SegregatedConnectionsViewProps {
  workflow: WorkflowType;
  prospects: Prospect[];
  onBack: () => void;
  onReviewDM: (prospect: Prospect) => void;
}

export function SegregatedConnectionsView({
  workflow,
  prospects,
  onBack,
  onReviewDM
}: SegregatedConnectionsViewProps) {
  const [activeGroup, setActiveGroup] = useState<'All' | SegregationGroup>('All');
  const [hasContactOnly, setHasContactOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('All');

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

  // Distinct companies for filtering
  const companies = useMemo(() => {
    const set = new Set<string>();
    prospects.forEach((p) => {
      if (p.company && p.company !== 'Startup') set.add(p.company);
    });
    return Array.from(set).slice(0, 30);
  }, [prospects]);

  // Group metrics
  const stats = useMemo(() => {
    const total = prospects.length;
    const founders = prospects.filter((p) => p.segregationGroup === 'Founder').length;
    const hr = prospects.filter((p) => p.segregationGroup === 'HR').length;
    const employees = prospects.filter((p) => p.segregationGroup === 'Employee').length;
    const withContact = prospects.filter((p) => Boolean(p.email || p.phoneNumber)).length;
    return { total, founders, hr, employees, withContact };
  }, [prospects]);

  // Filtered & Prioritized Prospects
  const filtered = useMemo(() => {
    return prospects.filter((p) => {
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
  }, [prospects, activeGroup, hasContactOnly, selectedCompany, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Bar / Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors py-1.5 px-2.5 rounded-lg hover:bg-zinc-200/60 w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Upload New Files / Change Mode</span>
        </button>

        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-zinc-100 text-zinc-800 border border-zinc-200 w-fit">
          {meta.badge} · {stats.total} Total Connections
        </span>
      </div>

      {/* Header card with summary breakdown */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">{meta.title}</h2>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">{meta.desc}</p>
        </div>

        {/* 4 Summary Stat Pills (Clickable as Quick Segregation Filters) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-zinc-100">
          <div
            onClick={() => setActiveGroup('Founder')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              activeGroup === 'Founder'
                ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                : 'bg-zinc-50 hover:bg-zinc-100/80 border-zinc-200 text-zinc-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${activeGroup === 'Founder' ? 'text-zinc-300' : 'text-zinc-500'}`}>
                Founders & CXOs
              </span>
              <Target className={`w-3.5 h-3.5 ${activeGroup === 'Founder' ? 'text-zinc-300' : 'text-zinc-500'}`} />
            </div>
            <span className="text-xl font-black mt-1 block">{stats.founders}</span>
          </div>

          <div
            onClick={() => setActiveGroup('HR')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              activeGroup === 'HR'
                ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                : 'bg-zinc-50 hover:bg-zinc-100/80 border-zinc-200 text-zinc-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${activeGroup === 'HR' ? 'text-zinc-300' : 'text-zinc-500'}`}>
                HR & Recruiters
              </span>
              <Users className={`w-3.5 h-3.5 ${activeGroup === 'HR' ? 'text-zinc-300' : 'text-zinc-500'}`} />
            </div>
            <span className="text-xl font-black mt-1 block">{stats.hr}</span>
          </div>

          <div
            onClick={() => setActiveGroup('Employee')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              activeGroup === 'Employee'
                ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                : 'bg-zinc-50 hover:bg-zinc-100/80 border-zinc-200 text-zinc-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${activeGroup === 'Employee' ? 'text-zinc-300' : 'text-zinc-500'}`}>
                Working Employees
              </span>
              <Briefcase className={`w-3.5 h-3.5 ${activeGroup === 'Employee' ? 'text-zinc-300' : 'text-zinc-500'}`} />
            </div>
            <span className="text-xl font-black mt-1 block">{stats.employees}</span>
          </div>

          <div
            onClick={() => setHasContactOnly(!hasContactOnly)}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              hasContactOnly
                ? 'bg-emerald-800 text-white border-emerald-800 shadow-sm'
                : 'bg-emerald-50/70 hover:bg-emerald-100/70 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${hasContactOnly ? 'text-emerald-200' : 'text-emerald-700'}`}>
                With Email / Phone
              </span>
              <Mail className={`w-3.5 h-3.5 ${hasContactOnly ? 'text-emerald-200' : 'text-emerald-700'}`} />
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black">{stats.withContact}</span>
              <span className="text-[10px] opacity-75 font-medium">prioritized</span>
            </div>
          </div>
        </div>
      </div>

      {/* LinkedIn-Style Filters Bar */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Group Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 no-scrollbar text-xs">
            {(['All', 'Founder', 'HR', 'Employee'] as const).map((grp) => {
              const label =
                grp === 'All'
                  ? 'All Connections'
                  : grp === 'Founder'
                  ? 'Founders & Execs'
                  : grp === 'HR'
                  ? 'HR / Recruiters'
                  : 'Working Employees';
              const isSelected = activeGroup === grp;
              return (
                <button
                  key={grp}
                  onClick={() => setActiveGroup(grp)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-zinc-900 text-white shadow-sm'
                      : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900 border border-zinc-200'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Quick Toggle: Direct Email/Phone */}
          <button
            onClick={() => setHasContactOnly(!hasContactOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
              hasContactOnly
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-zinc-100 text-zinc-700 hover:text-zinc-900 border-zinc-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Has Email or Phone</span>
            {hasContactOnly && <CheckCircle2 className="w-3 h-3 text-white ml-0.5" />}
          </button>
        </div>

        {/* Search & Company Filter Row */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-zinc-100">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, role, company or email..."
              className="w-full bg-zinc-50 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 rounded-xl pl-9 pr-8 py-2 border border-zinc-200 focus:outline-none focus:border-zinc-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {companies.length > 0 && (
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full sm:w-56 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-800 focus:outline-none focus:border-zinc-400"
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

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
        <span>
          Showing <strong className="text-zinc-900">{filtered.length}</strong> segregated connections
          {hasContactOnly ? ' (contact info prioritized)' : ''}
        </span>
        <span className="hidden sm:inline text-zinc-400">
          Sorted: Contacts with Email & Phone First
        </span>
      </div>

      {/* Segregated Connections Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center text-xs sm:text-sm text-zinc-500 shadow-sm space-y-2">
          <p className="font-bold text-zinc-900">No connections match the selected filters.</p>
          <p className="text-xs text-zinc-500">Try resetting the search or category filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((prospect) => {
            const hasEmail = Boolean(prospect.email);
            const hasPhone = Boolean(prospect.phoneNumber);
            const hasDirectContact = hasEmail || hasPhone;

            return (
              <div
                key={prospect.id}
                className="touch-card bg-white border border-zinc-200 hover:border-zinc-400 rounded-2xl p-4.5 shadow-sm flex flex-col justify-between transition-all group"
              >
                <div className="space-y-3">
                  {/* Top line: Name & Segregation Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-zinc-900 truncate group-hover:text-zinc-700">
                          {prospect.name}
                        </h3>
                      </div>
                      <p className="text-xs text-zinc-600 font-medium truncate mt-0.5">
                        {prospect.jobTitle}
                      </p>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                        prospect.segregationGroup === 'Founder'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : prospect.segregationGroup === 'HR'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                      }`}
                    >
                      {prospect.segregationGroup === 'Founder'
                        ? 'Founder'
                        : prospect.segregationGroup === 'HR'
                        ? 'Recruiter'
                        : 'Employee'}
                    </span>
                  </div>

                  {/* Company & Location */}
                  <div className="text-[11px] text-zinc-500 space-y-1">
                    <p className="flex items-center gap-1.5 truncate">
                      <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="font-semibold text-zinc-700 truncate">{prospect.company}</span>
                    </p>
                    {prospect.location && (
                      <p className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="truncate">{prospect.location}</span>
                      </p>
                    )}
                  </div>

                  {/* Prioritized Contact Badges (Email & Phone) */}
                  {hasDirectContact ? (
                    <div className="bg-emerald-50 border border-emerald-200/90 rounded-xl p-2.5 space-y-1 text-xs">
                      {hasEmail && (
                        <div className="flex items-center gap-1.5 text-emerald-800 font-medium truncate">
                          <Mail className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{prospect.email}</span>
                        </div>
                      )}
                      {hasPhone && (
                        <div className="flex items-center gap-1.5 text-emerald-800 font-medium truncate">
                          <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{prospect.phoneNumber}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] text-zinc-400 italic">
                      LinkedIn InMail / Message only
                    </div>
                  )}

                  {/* Connected on Date if available */}
                  {prospect.connectedOn && (
                    <p className="text-[10px] text-zinc-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-zinc-300" />
                      <span>Connected: {prospect.connectedOn}</span>
                    </p>
                  )}
                </div>

                {/* Bottom CTA Row */}
                <div className="pt-3 mt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                  <a
                    href={prospect.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-zinc-500 hover:text-zinc-900 font-semibold flex items-center gap-1 transition-colors"
                  >
                    <span>Profile</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    onClick={() => onReviewDM(prospect)}
                    className="py-1.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Review & Send DM</span>
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
