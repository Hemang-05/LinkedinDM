'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Prospect, OutreachLogEntry, OutreachStatus, UserProfile } from '@/types';
import {
  getClientProspects,
  saveClientProspects,
  getClientOutreachLogs,
  saveClientOutreachLogs,
  addClientProspect,
  updateClientOutreachStatus,
  downloadOutreachLogFile,
  getClientProfile,
  saveClientProfile
} from '@/lib/clientStorage';
import { EMPTY_PROFILE } from '@/lib/profile';
import { Header } from '@/components/Header';
import { BottomNav, NavTab } from '@/components/BottomNav';
import { HighPriorityCard } from '@/components/HighPriorityCard';
import { ProspectCard } from '@/components/ProspectCard';
import { DMReviewModal } from '@/components/DMReviewModal';
import { OutreachHistoryCard } from '@/components/OutreachHistoryCard';
import { ManualProspectModal } from '@/components/ManualProspectModal';
import { CsvImportSection } from '@/components/CsvImportSection';
import { LinkedInCsvGuideModal } from '@/components/LinkedInCsvGuideModal';
import { WorkflowView, WorkflowType } from '@/components/WorkflowView';
import { SegregatedConnectionsView } from '@/components/SegregatedConnectionsView';
import {
  Sparkles,
  Zap,
  CheckCircle,
  Users,
  Send,
  FileText,
  ChevronRight,
  Download,
  Briefcase,
  Target,
  UserCheck,
  Laptop,
  Edit3,
  Check
} from 'lucide-react';

export default function Home() {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowType | null>(null);
  const [workflowStep, setWorkflowStep] = useState<'upload' | 'segregated'>('upload');
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [outreachLogs, setOutreachLogs] = useState<OutreachLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // User profile state (editable per user)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editTargetRole, setEditTargetRole] = useState('');
  const [editSkills, setEditSkills] = useState('');

  // Modals
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

  // Filters for Prospects tab
  const [prospectFilter, setProspectFilter] = useState<string>('All');
  const [classificationFilter, setClassificationFilter] = useState<string>('All');

  // Filters for Outreach tab
  const [outreachFilter, setOutreachFilter] = useState<string>('All');

  // Load browser storage on client mount with automatic deduplication
  useEffect(() => {
    const localP = getClientProspects();
    const seen = new Set<string>();
    const cleaned: Prospect[] = [];

    for (const p of localP) {
      // Remove any old failed parse records
      if (p.name === 'Prospect' && (p.company === 'Startup' || p.jobTitle === 'Engineer')) {
        continue;
      }
      const key = (p.linkedinUrl && p.linkedinUrl.includes('linkedin.com/in/'))
        ? p.linkedinUrl.trim().toLowerCase().replace(/\/+$/, '')
        : `${p.name.trim().toLowerCase()}|${p.company.trim().toLowerCase()}`;

      if (!seen.has(key)) {
        seen.add(key);
        cleaned.push(p);
      }
    }

    setProspects(cleaned);
    saveClientProspects(cleaned);

    const localLogs = getClientOutreachLogs();
    setOutreachLogs(localLogs);

    const localProf = getClientProfile();
    setUserProfile(localProf);
    if (localProf) {
      setEditName(localProf.name || '');
      setEditTitle(localProf.title || '');
      setEditTargetRole(localProf.targetRole || localProf.targetRoles?.[0] || '');
      setEditSkills(localProf.skills?.join(', ') || '');
    }
  }, []);

  const handleSaveProfile = () => {
    const updatedSkills = editSkills.split(',').map((s) => s.trim()).filter(Boolean);
    const updated: UserProfile = {
      ...(userProfile || EMPTY_PROFILE),
      name: editName.trim(),
      title: editTitle.trim(),
      targetRole: editTargetRole.trim(),
      targetRoles: editTargetRole.trim() ? [editTargetRole.trim()] : (userProfile?.targetRoles || []),
      skills: updatedSkills
    };
    setUserProfile(updated);
    saveClientProfile(updated);
    setIsEditingProfile(false);
  };

  const handleProspectUpdated = (updated: Prospect) => {
    const updatedList = prospects.map((p) => (p.id === updated.id ? updated : p));
    setProspects(updatedList);
    saveClientProspects(updatedList);
    
    // If marked contacted, ensure DM review modal is closed / not opened
    if (updated.status === 'Contacted') {
      setSelectedProspect(null);
    } else if (selectedProspect && selectedProspect.id === updated.id) {
      setSelectedProspect(updated);
    }

    const updatedLogs = getClientOutreachLogs();
    setOutreachLogs(updatedLogs);
  };

  const handleProspectAdded = (newP: Prospect) => {
    addClientProspect(newP);
    const updated = [newP, ...prospects];
    setProspects(updated);
    setSelectedProspect(newP);
  };

  const handleCsvImportComplete = (imported: Prospect[]) => {
    const seen = new Set<string>();
    const cleaned: Prospect[] = [];
    for (const p of [...imported, ...prospects]) {
      const key = (p.linkedinUrl && p.linkedinUrl.includes('linkedin.com/in/'))
        ? p.linkedinUrl.trim().toLowerCase().replace(/\/+$/, '')
        : `${p.name.trim().toLowerCase()}|${p.company.trim().toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        cleaned.push(p);
      }
    }
    setProspects(cleaned);
    saveClientProspects(cleaned);
    setCurrentTab('prospects');
  };

  const handleWorkflowImportComplete = (imported: Prospect[]) => {
    // Deduplicate fresh import
    const seen = new Set<string>();
    const cleaned: Prospect[] = [];
    for (const p of imported) {
      const key = (p.linkedinUrl && p.linkedinUrl.includes('linkedin.com/in/'))
        ? p.linkedinUrl.trim().toLowerCase().replace(/\/+$/, '')
        : `${p.name.trim().toLowerCase()}|${p.company.trim().toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        cleaned.push(p);
      }
    }
    setProspects(cleaned);
    saveClientProspects(cleaned);
    setWorkflowStep('segregated');
  };

  const handleOutreachStatusChange = async (entry: OutreachLogEntry, newStatus: OutreachStatus) => {
    updateClientOutreachStatus(entry.linkedinUrl, entry.name, entry.company, newStatus);
    const updatedLogs = getClientOutreachLogs();
    setOutreachLogs(updatedLogs);

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

  const scrollToCsvUpload = (catKey?: string) => {
    if (catKey) setActiveCategory(catKey);
    const el = document.getElementById('csv-upload-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
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

  // High Priority List
  const highPriorityProspects = useMemo(() => {
    return prospects
      .filter((p) => (p.score?.totalScore || 0) >= 80 && p.status !== 'Contacted')
      .slice(0, 6);
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

  // 4 Main Use-case tiles
  const categoryTiles = [
    {
      id: 'job-hunt' as WorkflowType,
      title: 'DM for Job Hunt',
      subtitle: 'Target tech recruiters & hiring managers to land interviews.',
      icon: Briefcase,
      badge: 'Recruiters & Managers'
    },
    {
      id: 'agency-leads' as WorkflowType,
      title: 'DM for Agency Leads',
      subtitle: 'Pitch B2B clients, founders & CXOs directly.',
      icon: Target,
      badge: 'Founders & Business'
    },
    {
      id: 'hire' as WorkflowType,
      title: 'DM to Hire',
      subtitle: 'Message top engineering talent & key hires.',
      icon: UserCheck,
      badge: 'Candidates'
    },
    {
      id: 'freelancers' as WorkflowType,
      title: 'DM to Get Freelancers',
      subtitle: 'Find verified contractors, agency partners & freelancers.',
      icon: Laptop,
      badge: 'Freelance & Contract'
    }
  ];

  return (
    <div className="min-h-screen bg-[#F4F2EE] text-zinc-900 flex flex-col justify-between selection:bg-[#0A66C2]/20">
      {/* Clean Header */}
      <Header
        currentTab={currentTab}
        onTabChange={(tab) => {
          setSelectedWorkflow(null);
          setWorkflowStep('upload');
          setCurrentTab(tab);
        }}
        onBackToLanding={() => {
          setSelectedWorkflow(null);
          setWorkflowStep('upload');
          setCurrentTab('home');
        }}
      />

      <div className="w-full max-w-7xl mx-auto flex-1 flex flex-col relative pb-20 md:pb-8 px-4 sm:px-6 lg:px-8 pt-6">
        <main className="flex-1 space-y-6">
          {/* TAB 1: HOME LANDING & WORKFLOWS */}
          {currentTab === 'home' && (
            <div className="space-y-8 animate-in fade-in duration-200">
              {selectedWorkflow && workflowStep === 'upload' && (
                /* Step 1: Upload Documents & Connections CSV */
                <WorkflowView
                  workflow={selectedWorkflow}
                  onBack={() => {
                    setSelectedWorkflow(null);
                    setWorkflowStep('upload');
                  }}
                  onImportComplete={handleWorkflowImportComplete}
                  onOpenGuideModal={() => setIsGuideModalOpen(true)}
                />
              )}

              {selectedWorkflow && workflowStep === 'segregated' && (
                /* Step 2: Segregated Connections View (Founders / HR / Employees + Email/Phone Priority) */
                <SegregatedConnectionsView
                  workflow={selectedWorkflow}
                  prospects={prospects}
                  onBack={() => setWorkflowStep('upload')}
                  onReset={() => {
                    setProspects([]);
                    saveClientProspects([]);
                    setWorkflowStep('upload');
                  }}
                  onReviewDM={(p) => setSelectedProspect(p)}
                  onProspectUpdated={handleProspectUpdated}
                />
              )}

              {!selectedWorkflow && (
                /* Clean 4-Tile Landing Page (Nothing Below Tiles) */
                <div className="space-y-8">
                  {/* Hero Banner Header */}
                  <div className="text-center max-w-3xl mx-auto pt-6 pb-2 space-y-3">
                    <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-zinc-900">
                      Every LinkedIn connection, one click away from a direct message.
                    </h1>
                    <p className="text-sm sm:text-base text-zinc-600 max-w-2xl mx-auto leading-relaxed">
                      Choose your outreach goal to start tailoring high-converting, human direct messages at scale.
                    </p>
                  </div>

                  {/* 4 Horizontal Rectangular Category Tiles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                    {categoryTiles.map((tile) => {
                      const Icon = tile.icon;
                      return (
                        <div
                          key={tile.id}
                          onClick={() => {
                            setSelectedWorkflow(tile.id);
                            setWorkflowStep('upload');
                          }}
                          className="touch-card bg-white border border-[#E0DFDC] hover:border-[#0A66C2] rounded-xl p-6 shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between group transition-all"
                        >
                          <div className="space-y-3.5">
                            <div className="flex items-center justify-between">
                              <div className="w-10 h-10 rounded-xl bg-[#EBF3FB] group-hover:bg-[#0A66C2] text-[#0A66C2] group-hover:text-white flex items-center justify-center transition-colors shadow-2xs">
                                <Icon className="w-5 h-5" />
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-[#F4F2EE] px-2.5 py-0.5 rounded-full border border-[#E0DFDC]">
                                {tile.badge}
                              </span>
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-zinc-900 group-hover:text-[#0A66C2] transition-colors">
                                {tile.title}
                              </h3>
                              <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                                {tile.subtitle}
                              </p>
                            </div>
                          </div>

                          <div className="pt-4 mt-3 flex items-center justify-between text-xs font-semibold text-[#0A66C2] border-t border-[#E0DFDC]">
                            <span className="group-hover:underline">Get Started</span>
                            <ChevronRight className="w-4 h-4 text-[#0A66C2] group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PROSPECTS */}
          {currentTab === 'prospects' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-[#E0DFDC] rounded-xl p-4 shadow-xs">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar text-xs">
                  <span className="text-[11px] font-bold text-zinc-400 mr-1 hidden sm:inline">Role:</span>
                  {['All', 'Founder', 'CEO', 'CTO', 'Engineering Manager', 'Recruiter'].map((role) => (
                    <button
                      key={role}
                      onClick={() => setClassificationFilter(role)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                        classificationFilter === role
                          ? 'bg-[#0A66C2] text-white shadow-xs'
                          : 'bg-white text-zinc-600 hover:text-zinc-900 border border-[#E0DFDC]'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar text-xs">
                  <span className="text-[11px] font-bold text-zinc-400 mr-1 hidden sm:inline">Status:</span>
                  {['All', 'Not contacted', 'Contacted', 'Replied'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setProspectFilter(st)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                        prospectFilter === st
                          ? 'bg-[#0A66C2] text-white shadow-xs'
                          : 'bg-white text-zinc-600 hover:text-zinc-900 border border-[#E0DFDC]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-xs text-zinc-500 flex items-center justify-between px-1">
                <span>Showing <strong className="text-zinc-900">{filteredProspects.length}</strong> prospects</span>
                <span>Sorted by Match %</span>
              </div>

              {filteredProspects.length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center text-xs sm:text-sm text-zinc-500 shadow-sm space-y-2">
                  <p className="font-bold text-zinc-900 text-sm">No prospects in your list yet</p>
                  <p className="text-xs text-zinc-500">
                    Upload your LinkedIn Connections CSV file on the Home tab to import your contacts.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 xl:gap-7">
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
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm">
                <div>
                  <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-900">
                    Detected Opportunities & Roles
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Hiring positions identified from your connection profile data
                  </p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-xl bg-zinc-100 text-zinc-800 border border-zinc-200">
                  {prospects.filter((p) => Boolean(p.jobOpportunity)).length} Roles Detected
                </span>
              </div>

              {prospects.filter((p) => Boolean(p.jobOpportunity)).length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center text-xs sm:text-sm text-zinc-500 shadow-sm space-y-2">
                  <p className="font-bold text-zinc-900">No open hiring opportunities detected yet.</p>
                  <p className="text-xs text-zinc-500">Import your LinkedIn connections CSV to detect hiring signals.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {prospects
                    .filter((p) => Boolean(p.jobOpportunity))
                    .map((p) => {
                      const job = p.jobOpportunity!;
                      return (
                        <div
                          key={job.id}
                          className="bg-white border border-zinc-200 hover:border-zinc-300 rounded-2xl p-4 space-y-3 shadow-sm flex flex-col justify-between transition-all"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {job.remoteStatus}
                                </span>
                                <h3 className="text-sm font-bold text-zinc-900 mt-1.5">{job.title}</h3>
                                <p className="text-xs text-zinc-500">{job.company} · {job.location}</p>
                              </div>

                              <div className="text-right flex-shrink-0">
                                <span className="text-base font-black text-zinc-900">
                                  {p.score?.totalScore}%
                                </span>
                                <span className="text-[10px] text-zinc-400 block">Match</span>
                              </div>
                            </div>

                            <p className="text-xs text-zinc-600 line-clamp-3 leading-relaxed">
                              {job.description}
                            </p>

                            {job.hiringSignals && job.hiringSignals.length > 0 && (
                              <div className="flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-xl border border-amber-200">
                                <Zap className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                                <span>Signal: {job.hiringSignals.join(', ')}</span>
                              </div>
                            )}
                          </div>

                          <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-zinc-500 truncate">
                              Via {p.name} ({p.classification})
                            </span>

                            <button
                              onClick={() => setSelectedProspect(p)}
                              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white flex items-center gap-1 transition-colors flex-shrink-0"
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>Review DM</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: OUTREACH CRM */}
          {currentTab === 'outreach' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-[#E0DFDC] rounded-xl p-4 shadow-xs">
                <div>
                  <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-900">
                    Outreach CRM & History
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Browser storage synced + download activity log
                  </p>
                </div>

                <button
                  onClick={downloadOutreachLogFile}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#0A66C2] bg-white hover:bg-[#0A66C2]/10 border border-[#0A66C2] px-3.5 py-1.5 rounded-full transition-colors w-fit"
                >
                  <Download className="w-4 h-4 text-[#0A66C2]" />
                  <span>Download outreach_log.txt</span>
                </button>
              </div>

              {/* Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                {['All', 'Contacted', 'Replied', 'Follow-up', 'Interview'].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => setOutreachFilter(chip)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                      outreachFilter === chip
                        ? 'bg-[#0A66C2] text-white shadow-xs font-semibold'
                        : 'bg-white text-zinc-600 hover:text-zinc-900 border border-[#E0DFDC]'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {filteredOutreachLogs.length === 0 ? (
                <div className="bg-white border border-[#E0DFDC] rounded-xl p-10 text-center text-xs sm:text-sm text-zinc-500 shadow-xs space-y-2">
                  <Send className="w-10 h-10 text-zinc-300 mx-auto" />
                  <p className="font-bold text-zinc-900">No outreach history logged yet.</p>
                  <p className="text-xs text-zinc-500">When you send or copy DMs to your contacts, your activity log will appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Editable Profile Card */}
                <div className="bg-white border border-[#E0DFDC] rounded-xl p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-[#E0DFDC] pb-3">
                    <h3 className="text-sm sm:text-base font-bold text-zinc-900 flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#0A66C2]" />
                      <span>Candidate / User Profile</span>
                    </h3>
                    <button
                      onClick={() => {
                        if (isEditingProfile) handleSaveProfile();
                        else setIsEditingProfile(true);
                      }}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#0A66C2] hover:bg-[#004182] text-white flex items-center gap-1 transition-colors shadow-2xs"
                    >
                      {isEditingProfile ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </>
                      ) : (
                        <>
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit Profile</span>
                        </>
                      )}
                    </button>
                  </div>

                  {isEditingProfile ? (
                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block text-zinc-500 font-medium mb-1">Your Name</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full bg-[#F4F2EE]/40 border border-[#E0DFDC] rounded-xl px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
                        />
                      </div>

                      <div>
                        <label className="block text-zinc-500 font-medium mb-1">Professional Title</label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full bg-[#F4F2EE]/40 border border-[#E0DFDC] rounded-xl px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
                        />
                      </div>

                      <div>
                        <label className="block text-zinc-500 font-medium mb-1">Target Role / Opportunity You Are Seeking</label>
                        <input
                          type="text"
                          value={editTargetRole}
                          onChange={(e) => setEditTargetRole(e.target.value)}
                          placeholder="e.g. Full Stack Engineer"
                          className="w-full bg-[#F4F2EE]/40 border border-[#E0DFDC] rounded-xl px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
                        />
                      </div>

                      <div>
                        <label className="block text-zinc-500 font-medium mb-1">Key Skills (comma separated)</label>
                        <input
                          type="text"
                          value={editSkills}
                          onChange={(e) => setEditSkills(e.target.value)}
                          className="w-full bg-[#F4F2EE]/40 border border-[#E0DFDC] rounded-xl px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
                        />
                      </div>
                    </div>
                  ) : !userProfile || !userProfile.name ? (
                    <div className="text-xs sm:text-sm space-y-2 text-zinc-500 py-4 text-center">
                      <p className="font-semibold text-zinc-700">No profile confirmed yet.</p>
                      <p className="text-xs">Upload your resume on the Home tab to automatically detect and confirm your background.</p>
                    </div>
                  ) : (
                    <div className="text-xs sm:text-sm space-y-2 text-zinc-700">
                      <p><span className="text-zinc-400 font-medium">Name: </span><strong className="text-zinc-900">{userProfile.name}</strong></p>
                      <p><span className="text-zinc-400 font-medium">Title: </span>{userProfile.title || 'Not specified'}</p>
                      <p><span className="text-zinc-400 font-medium">Target Role Seeking: </span><span className="font-semibold text-[#0A66C2] bg-[#EBF3FB] px-2 py-0.5 rounded-full border border-[#0A66C2]/20">{userProfile.targetRole || userProfile.title || 'Not specified'}</span></p>
                      <p><span className="text-zinc-400 font-medium">Target Roles Pool: </span>{userProfile.targetRoles?.length ? userProfile.targetRoles.join(', ') : 'None'}</p>
                      <div className="pt-2 border-t border-[#E0DFDC]">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                          Your Technical Skills
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {userProfile.skills?.map((s, idx) => (
                            <span key={idx} className="text-xs bg-[#F4F2EE] text-zinc-700 px-2.5 py-1 rounded-full border border-[#E0DFDC]">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Storage & Export Card */}
                <div className="bg-white border border-[#E0DFDC] rounded-xl p-5 space-y-4 flex flex-col justify-between shadow-xs">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-[#E0DFDC] pb-3">
                      <h3 className="text-sm sm:text-base font-bold text-zinc-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#0A66C2]" />
                        <span>Client Storage & Exports</span>
                      </h3>
                      <span className="text-xs font-semibold text-[#057642] bg-[#057642]/10 px-2.5 py-0.5 rounded-full border border-[#057642]/20">
                        {outreachLogs.length} Logged
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      All your prospect data and outreach activity logs are stored securely in your individual browser local storage. Download the formatted <code className="text-zinc-800 font-mono">outreach_log.txt</code> file anytime.
                    </p>
                  </div>

                  <button
                    onClick={downloadOutreachLogFile}
                    className="w-full py-2.5 px-4 rounded-full bg-[#0A66C2] hover:bg-[#004182] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-2xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download outreach_log.txt</span>
                  </button>
                </div>
              </div>

              <CsvImportSection
                onImportComplete={handleCsvImportComplete}
                onOpenGuideModal={() => setIsGuideModalOpen(true)}
              />
            </div>
          )}
        </main>

        {/* Mobile Bottom Navigation */}
        <BottomNav
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          pendingReviewCount={highPriorityProspects.length}
          contactedCount={outreachLogs.length}
        />

        {/* DM Review Modal */}
        <DMReviewModal
          prospect={selectedProspect}
          onClose={() => setSelectedProspect(null)}
          onProspectUpdated={handleProspectUpdated}
          workflow={selectedWorkflow || 'job-hunt'}
        />

        {/* Quick Add Prospect Modal */}
        <ManualProspectModal
          isOpen={isQuickAddOpen}
          onClose={() => setIsQuickAddOpen(false)}
          onProspectAdded={handleProspectAdded}
        />

        {/* LinkedIn CSV Step-by-Step Guide Modal */}
        <LinkedInCsvGuideModal
          isOpen={isGuideModalOpen}
          onClose={() => setIsGuideModalOpen(false)}
        />
      </div>
    </div>
  );
}
