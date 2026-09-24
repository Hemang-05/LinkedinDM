'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Prospect, OutreachLogEntry, OutreachStatus } from '@/types';
import { MY_PROFILE } from '@/lib/profile';
import {
  getClientProspects,
  saveClientProspects,
  getClientOutreachLogs,
  saveClientOutreachLogs,
  addClientProspect,
  updateClientOutreachStatus,
  downloadOutreachLogFile
} from '@/lib/clientStorage';
import { Header } from '@/components/Header';
import { BottomNav, NavTab } from '@/components/BottomNav';
import { HighPriorityCard } from '@/components/HighPriorityCard';
import { ProspectCard } from '@/components/ProspectCard';
import { DMReviewModal } from '@/components/DMReviewModal';
import { OutreachHistoryCard } from '@/components/OutreachHistoryCard';
import { ManualProspectModal } from '@/components/ManualProspectModal';
import { CsvImportSection } from '@/components/CsvImportSection';
import {
  Sparkles,
  Zap,
  CheckCircle,
  Users,
  Send,
  FileText,
  AlertCircle,
  ChevronRight,
  Download
} from 'lucide-react';

export default function Home() {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [outreachLogs, setOutreachLogs] = useState<OutreachLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  // Filters for Prospects tab
  const [prospectFilter, setProspectFilter] = useState<string>('All');
  const [classificationFilter, setClassificationFilter] = useState<string>('All');

  // Filters for Outreach tab
  const [outreachFilter, setOutreachFilter] = useState<string>('All');

  // Load from browser storage immediately on client
  useEffect(() => {
    const localP = getClientProspects();
    setProspects(localP);

    const localLogs = getClientOutreachLogs();
    setOutreachLogs(localLogs);

    // Optional background sync with server if available
    fetch('/api/prospects')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.prospects && d.prospects.length > 0) {
          // If browser has fewer items, merge
          if (localP.length <= 4) {
            setProspects(d.prospects);
            saveClientProspects(d.prospects);
          }
        }
      })
      .catch(() => {});

    fetch('/api/outreach-log')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.entries && d.entries.length > localLogs.length) {
          setOutreachLogs(d.entries);
          saveClientOutreachLogs(d.entries);
        }
      })
      .catch(() => {});
  }, []);

  // Update a single prospect after review/contacted
  const handleProspectUpdated = (updated: Prospect) => {
    const updatedList = prospects.map((p) => (p.id === updated.id ? updated : p));
    setProspects(updatedList);
    saveClientProspects(updatedList);
    setSelectedProspect(updated);

    // Reload logs from browser storage
    const updatedLogs = getClientOutreachLogs();
    setOutreachLogs(updatedLogs);
  };

  // Add new prospect
  const handleProspectAdded = (newP: Prospect) => {
    addClientProspect(newP);
    const updated = [newP, ...prospects];
    setProspects(updated);
    setSelectedProspect(newP); // Immediately open review
  };

  // Bulk import complete
  const handleCsvImportComplete = (imported: Prospect[]) => {
    const updated = [...imported, ...prospects];
    setProspects(updated);
    saveClientProspects(updated);
    setCurrentTab('prospects');
  };

  // Update status in outreach history
  const handleOutreachStatusChange = async (entry: OutreachLogEntry, newStatus: OutreachStatus) => {
    updateClientOutreachStatus(entry.linkedinUrl, entry.name, entry.company, newStatus);
    const updatedLogs = getClientOutreachLogs();
    setOutreachLogs(updatedLogs);

    // Also update matching prospect if exists
    const updatedProspects = prospects.map((p) => {
      if (
        (entry.linkedinUrl && p.linkedinUrl === entry.linkedinUrl) ||
        (p.name.toLowerCase() === entry.name.toLowerCase() && p.company.toLowerCase() === entry.company.toLowerCase())
      ) {
        return { ...p, status: newStatus };
      }
      return p;
    });
    setProspects(updatedProspects);
    saveClientProspects(updatedProspects);

    // Try server sync
    try {
      await fetch('/api/outreach-log', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkedinUrl: entry.linkedinUrl,
          name: entry.name,
          company: entry.company,
          status: newStatus
        })
      });
    } catch {}
  };

  // Filtered Prospects
  const filteredProspects = useMemo(() => {
    return prospects.filter((p) => {
      const matchSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.classification.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.jobOpportunity?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.score?.strongMatches.some((m) => m.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus =
        prospectFilter === 'All' || p.status === prospectFilter;

      const matchClassification =
        classificationFilter === 'All' || p.classification === classificationFilter;

      return matchSearch && matchStatus && matchClassification;
    });
  }, [prospects, searchQuery, prospectFilter, classificationFilter]);

  // High Priority List (Top matches, uncontacted)
  const highPriorityProspects = useMemo(() => {
    return prospects
      .filter((p) => (p.score?.totalScore || 0) >= 80 && p.status !== 'Contacted')
      .slice(0, 5);
  }, [prospects]);

  // Follow-ups due
  const followUpsDue = useMemo(() => {
    return prospects.filter((p) => p.status === 'Follow-up due');
  }, [prospects]);

  // Outreach Filtered Logs
  const filteredOutreachLogs = useMemo(() => {
    return outreachLogs.filter((entry) => {
      const matchSearch =
        !searchQuery ||
        entry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.relationshipType.toLowerCase().includes(searchQuery.toLowerCase());

      const matchFilter =
        outreachFilter === 'All' ||
        (outreachFilter === 'Contacted' && entry.status === 'Contacted') ||
        (outreachFilter === 'Replied' && entry.status === 'Replied') ||
        (outreachFilter === 'Follow-up' && entry.status === 'Follow-up due') ||
        (outreachFilter === 'Interview' && entry.status === 'Interview');

      return matchSearch && matchFilter;
    });
  }, [outreachLogs, searchQuery, outreachFilter]);

  // Metrics
  const metrics = useMemo(() => {
    const total = prospects.length;
    const highMatch = prospects.filter((p) => (p.score?.totalScore || 0) >= 80).length;
    const contacted = outreachLogs.length;
    const replied = outreachLogs.filter((e) => e.status === 'Replied' || e.status === 'Interested' || e.status === 'Interview').length;
    const conversion = contacted > 0 ? Math.round((replied / contacted) * 100) : 0;
    return { total, highMatch, contacted, replied, conversion };
  }, [prospects, outreachLogs]);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between selection:bg-indigo-500/30">
      <div className="w-full max-w-xl mx-auto flex-1 flex flex-col relative pb-20">
        {/* Sticky Mobile Header */}
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        />

        {/* Main Content Body */}
        <main className="flex-1 p-4 space-y-5">
          {/* TAB 1: HOME */}
          {currentTab === 'home' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Quick Metrics Bar */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-[#111827] border border-slate-800 rounded-xl p-2.5 text-center">
                  <span className="text-[10px] font-semibold uppercase text-slate-400 block">High Match</span>
                  <span className="text-base font-black text-indigo-400 leading-tight">{metrics.highMatch}</span>
                </div>
                <div className="bg-[#111827] border border-slate-800 rounded-xl p-2.5 text-center">
                  <span className="text-[10px] font-semibold uppercase text-slate-400 block">Contacted</span>
                  <span className="text-base font-black text-emerald-400 leading-tight">{metrics.contacted}</span>
                </div>
                <div className="bg-[#111827] border border-slate-800 rounded-xl p-2.5 text-center">
                  <span className="text-[10px] font-semibold uppercase text-slate-400 block">Replied</span>
                  <span className="text-base font-black text-purple-400 leading-tight">{metrics.replied}</span>
                </div>
                <div className="bg-[#111827] border border-slate-800 rounded-xl p-2.5 text-center">
                  <span className="text-[10px] font-semibold uppercase text-slate-400 block">Conversion</span>
                  <span className="text-base font-black text-amber-400 leading-tight">{metrics.conversion}%</span>
                </div>
              </div>

              {/* HIGH PRIORITY SECTION */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      High Priority Opportunities
                    </h2>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {highPriorityProspects.length} Ready
                  </span>
                </div>

                {highPriorityProspects.length === 0 ? (
                  <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-400">
                    <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                    <p className="font-semibold text-slate-200">All high priority contacts addressed!</p>
                    <p className="mt-1">Add new prospects or explore the Prospects tab.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {highPriorityProspects.map((prospect) => (
                      <HighPriorityCard
                        key={prospect.id}
                        prospect={prospect}
                        onReviewDM={(p) => setSelectedProspect(p)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Follow-up Due Section (if any) */}
              {followUpsDue.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Follow-ups Due Today</span>
                  </h3>
                  <div className="space-y-2">
                    {followUpsDue.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => setSelectedProspect(p)}
                        className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between cursor-pointer"
                      >
                        <div>
                          <p className="text-xs font-bold text-white">{p.name}</p>
                          <p className="text-[11px] text-slate-300">{p.company} · {p.jobTitle}</p>
                        </div>
                        <span className="text-xs font-semibold text-amber-300 flex items-center gap-1">
                          Review Day 5 <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PROSPECTS */}
          {currentTab === 'prospects' && (
            <div className="space-y-3.5 animate-in fade-in duration-200">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                {['All', 'Founder', 'CEO', 'CTO', 'Engineering Manager', 'Recruiter'].map((role) => (
                  <button
                    key={role}
                    onClick={() => setClassificationFilter(role)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                      classificationFilter === role
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                {['All', 'Not contacted', 'Contacted', 'Replied'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setProspectFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                      prospectFilter === st
                        ? 'bg-slate-700 text-white'
                        : 'bg-slate-900/60 text-slate-500 border border-slate-800'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
                <span>Showing {filteredProspects.length} prospects</span>
                <span>Sorted by Match %</span>
              </div>

              {filteredProspects.length === 0 ? (
                <div className="bg-[#111827] border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
                  <p>No prospects found matching your search or filters.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredProspects.map((prospect) => (
                    <ProspectCard
                      key={prospect.id}
                      prospect={prospect}
                      onSelect={(p) => setSelectedProspect(p)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: JOBS */}
          {currentTab === 'jobs' && (
            <div className="space-y-3.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Detected Engineering Openings
                </h2>
                <span className="text-[11px] text-slate-400">
                  Remote India & Worldwide Eligible
                </span>
              </div>

              <div className="space-y-3">
                {prospects
                  .filter((p) => Boolean(p.jobOpportunity))
                  .map((p) => {
                    const job = p.jobOpportunity!;
                    return (
                      <div
                        key={job.id}
                        className="bg-[#111827] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {job.remoteStatus}
                            </span>
                            <h3 className="text-sm font-bold text-white mt-1.5">{job.title}</h3>
                            <p className="text-xs text-slate-400">{job.company} · {job.location}</p>
                          </div>

                          <div className="text-right">
                            <span className="text-sm font-black text-indigo-400">
                              {p.score?.totalScore}%
                            </span>
                            <span className="text-[10px] text-slate-500 block">Match</span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                          {job.description}
                        </p>

                        {job.hiringSignals && job.hiringSignals.length > 0 && (
                          <div className="flex items-center gap-1 text-[11px] text-amber-300 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                            <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                            <span>Signal: {job.hiringSignals.join(', ')}</span>
                          </div>
                        )}

                        <div className="pt-1 flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">
                            Via {p.name} ({p.classification})
                          </span>

                          <button
                            onClick={() => setSelectedProspect(p)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Review DM</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* TAB 4: OUTREACH CRM & LOGS */}
          {currentTab === 'outreach' && (
            <div className="space-y-3.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Outreach CRM & History
                  </h2>
                  <p className="text-[10px] text-slate-400">
                    Browser storage + formatted export
                  </p>
                </div>

                <button
                  onClick={downloadOutreachLogFile}
                  className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1.5 rounded-xl transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Log</span>
                </button>
              </div>

              {/* Horizontal Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                {['All', 'Contacted', 'Replied', 'Follow-up', 'Interview'].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => setOutreachFilter(chip)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                      outreachFilter === chip
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* History Cards */}
              {filteredOutreachLogs.length === 0 ? (
                <div className="bg-[#111827] border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
                  <Send className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="font-semibold text-slate-300">No outreach history records yet.</p>
                  <p className="mt-1">Review high-priority prospects on Home to generate and send your first DM.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredOutreachLogs.map((entry, index) => (
                    <OutreachHistoryCard
                      key={index}
                      entry={entry}
                      onStatusChange={handleOutreachStatusChange}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SETTINGS */}
          {currentTab === 'settings' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Profile Card */}
              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span>Active Profile Config</span>
                  </h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                    3+ Years Exp
                  </span>
                </div>

                <div className="text-xs space-y-1.5 text-slate-300">
                  <p><span className="text-slate-500 font-medium">Candidate: </span>{MY_PROFILE.name} ({MY_PROFILE.title})</p>
                  <p><span className="text-slate-500 font-medium">Target Roles: </span>{MY_PROFILE.targetRoles.join(', ')}</p>
                  <p><span className="text-slate-500 font-medium">Locations: </span>{MY_PROFILE.targetLocations.join(', ')}</p>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Matching Core Skills
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {MY_PROFILE.skills.map((s, idx) => (
                      <span key={idx} className="text-[10px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Outreach Log Export Card */}
              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span>Outreach Log (Browser Storage)</span>
                  </h3>
                  <span className="text-xs font-bold text-emerald-400">
                    {outreachLogs.length} Logged
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Saved securely in your browser storage. You can download the exact <code className="text-indigo-300">outreach_log.txt</code> formatted file anytime to your device.
                </p>

                <button
                  onClick={downloadOutreachLogFile}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-emerald-400 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download outreach_log.txt</span>
                </button>
              </div>

              {/* CSV Import */}
              <CsvImportSection onImportComplete={handleCsvImportComplete} />

              {/* PWA Mobile Installation Hint */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-xs space-y-2">
                <span className="font-bold text-indigo-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Install on Mobile Home Screen</span>
                </span>
                <p className="text-slate-400 leading-relaxed">
                  Open this page in Chrome or Safari on your phone, tap <strong>Share</strong> or the <strong>Three Dots</strong> menu, and select <strong>&quot;Add to Home Screen&quot;</strong> to use it as a standalone app!
                </p>
              </div>
            </div>
          )}
        </main>

        {/* Sticky Mobile Bottom Navigation */}
        <BottomNav
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          pendingReviewCount={highPriorityProspects.length}
          contactedCount={outreachLogs.length}
        />

        {/* The Most Important Screen: DM Review Modal */}
        <DMReviewModal
          prospect={selectedProspect}
          onClose={() => setSelectedProspect(null)}
          onProspectUpdated={handleProspectUpdated}
        />

        {/* Quick Add Prospect Modal */}
        <ManualProspectModal
          isOpen={isQuickAddOpen}
          onClose={() => setIsQuickAddOpen(false)}
          onProspectAdded={handleProspectAdded}
        />
      </div>
    </div>
  );
}
