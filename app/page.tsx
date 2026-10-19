'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  saveClientProfile,
  requestStoragePersistence,
  getLastExportedDate,
  recordExportDate,
  getClientSession,
  saveClientSession,
  clearClientSession,
  setActiveStorageUser,
  getLegacyUnmigratedProspects,
  clearLegacyStorage
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
import { ReviewQueueView } from '@/components/ReviewQueueView';
import { FollowUpsView } from '@/components/FollowUpsView';
import { AuthScreen } from '@/components/AuthScreen';
import { DMLogo } from '@/components/DMLogo';
import { normalizeLinkedInUrl } from '@/lib/urlNormalizer';
import { getCurrentSupabaseUser, getSupabaseClient } from '@/lib/supabaseClient';
import {
  getSupabaseConnections,
  getSupabaseProfile,
  getDueFollowUps,
  migrateLocalDataToSupabase,
  saveSupabaseProfile,
  ensureSupabaseProfile,
  markConnectionContacted,
  markConnectionSkipped,
  resetConnectionStatus
} from '@/lib/supabaseDb';
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
  Check,
  ShieldAlert,
  X,
  Upload,
  Loader2,
  Layers,
  CalendarClock
} from 'lucide-react';

export default function Home() {
  const currentUserIdRef = useRef<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authUser, setAuthUser] = useState<any | null>(null);

  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowType | null>(null);
  const [workflowStep, setWorkflowStep] = useState<'upload' | 'segregated'>('upload');
  const [prospectsViewMode, setProspectsViewMode] = useState<'queue' | 'grid'>('queue');
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [outreachLogs, setOutreachLogs] = useState<OutreachLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [dueFollowUpsCount, setDueFollowUpsCount] = useState<number>(0);

  // User profile state (editable per user)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editTargetRole, setEditTargetRole] = useState('');
  const [editSkills, setEditSkills] = useState('');
  const [isParsingSettingsResume, setIsParsingSettingsResume] = useState(false);
  const [settingsResumeFeedback, setSettingsResumeFeedback] = useState<string | null>(null);

  // Modals
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

  // Filters for Prospects tab
  const [prospectFilter, setProspectFilter] = useState<string>('All');
  const [classificationFilter, setClassificationFilter] = useState<string>('All');

  // Filters for Outreach tab
  const [outreachFilter, setOutreachFilter] = useState<string>('All');

  // Backup reminder state
  const [lastExportDate, setLastExportDate] = useState<string | null>(null);
  const [showBackupReminder, setShowBackupReminder] = useState<boolean>(true);

  // Centralized user data loader (Supabase is Single Source of Truth)
  const loadUserData = async (user: any) => {
    try {
      currentUserIdRef.current = user.id;
      setActiveStorageUser(user.id);
      setAuthUser(user);

      // 1. Fetch user profile from Supabase (Requirement 3: UUID is primary identity key)
      let supaProf = await getSupabaseProfile(user.id);
      if (!supaProf || !supaProf.name || supaProf.name === 'Your Name') {
        supaProf = await ensureSupabaseProfile(user.id, user.email, {
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'User'
        });
      }
      setUserProfile(supaProf);
      saveClientProfile(supaProf, user.id);
      setEditName(supaProf.name || '');
      setEditTitle(supaProf.title || '');
      setEditTargetRole(supaProf.targetRole || supaProf.targetRoles?.[0] || '');
      setEditSkills(supaProf.skills?.join(', ') || '');

      // 2. Fetch connections for this user from Supabase (Requirement 4 & 5)
      let supaConns = await getSupabaseConnections(user.id);

      // One-time legacy local storage migration only for first unassigned cache
      const legacyP = getLegacyUnmigratedProspects();
      if (supaConns.length === 0 && legacyP.length > 0) {
        await migrateLocalDataToSupabase(user.id, legacyP);
        clearLegacyStorage();
        supaConns = await getSupabaseConnections(user.id);
      }

      setProspects(supaConns);
      saveClientProspects(supaConns, user.id);

      // 3. Due follow-ups count for badge (Requirement 7)
      const due = await getDueFollowUps(user.id);
      setDueFollowUpsCount(due.length);

      // 4. Outreach logs for this user
      const userLogs = getClientOutreachLogs(user.id);
      setOutreachLogs(userLogs);

      // 5. Restore user's session
      const session = getClientSession(user.id);
      if (supaConns.length > 0) {
        setSelectedWorkflow((session?.selectedWorkflow as WorkflowType) || 'job-hunt');
        setWorkflowStep('segregated');
        if (session?.currentTab) setCurrentTab(session.currentTab as NavTab);
        if (session?.prospectsViewMode) setProspectsViewMode(session.prospectsViewMode);
      } else if (session?.selectedWorkflow) {
        setSelectedWorkflow(session.selectedWorkflow as WorkflowType);
        setWorkflowStep(session.workflowStep || 'upload');
        if (session?.currentTab) setCurrentTab(session.currentTab as NavTab);
      } else {
        setSelectedWorkflow('job-hunt');
        setWorkflowStep('upload');
      }
    } catch (err) {
      console.error('[Page] Error loading user data:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOutUser = () => {
    currentUserIdRef.current = null;
    if (authUser?.id) {
      clearClientSession(authUser.id);
    }
    setActiveStorageUser(null);
    setAuthUser(null);
    setProspects([]);
    setUserProfile(null);
    setOutreachLogs([]);
    setDueFollowUpsCount(0);
    setSelectedWorkflow(null);
    setWorkflowStep('upload');
    setAuthLoading(false);
  };

  // Restore session & determine authenticated user on startup (Requirement 9)
  useEffect(() => {
    setLastExportDate(getLastExportedDate());

    const initAuth = async () => {
      setAuthLoading(true);

      const client = getSupabaseClient();
      // Handle email verification redirect with PKCE auth code (?code=...) or Implicit hash tokens (#access_token=...)
      if (client && typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        if (code) {
          try {
            const { data, error } = await client.auth.exchangeCodeForSession(code);
            if (data?.session?.user) {
              url.searchParams.delete('code');
              window.history.replaceState({}, document.title, url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''));
              await loadUserData(data.session.user);
              return;
            }
          } catch (err) {
            console.warn('[Supabase] Failed exchanging auth code for session:', err);
          }
        }

        // Handle implicit flow hash tokens
        if (window.location.hash && window.location.hash.includes('access_token')) {
          try {
            const { data: hashData } = await client.auth.getSession();
            if (hashData?.session?.user) {
              window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
              await loadUserData(hashData.session.user);
              return;
            }
          } catch (err) {
            console.warn('[Supabase] Failed restoring session from hash:', err);
          }
        }
      }

      const user = await getCurrentSupabaseUser();
      if (!user) {
        setAuthUser(null);
        setActiveStorageUser(null);
        setProspects([]);
        setUserProfile(null);
        setAuthLoading(false);
        return;
      }
      currentUserIdRef.current = user.id;
      await loadUserData(user);
    };

    initAuth();

    const client = getSupabaseClient();
    if (client) {
      const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          // Only re-load user data if a genuinely different user authenticated,
          // avoiding overwriting local optimistic updates during token refreshes.
          if (event === 'SIGNED_IN' && session.user.id !== currentUserIdRef.current) {
            await loadUserData(session.user);
          }
        } else if (event === 'SIGNED_OUT') {
          handleSignOutUser();
        }
      });
      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  // Persist session state to localStorage for the active user whenever navigation or workflow changes
  useEffect(() => {
    if (authUser?.id) {
      saveClientSession({
        selectedWorkflow,
        workflowStep,
        currentTab,
        prospectsViewMode
      }, authUser.id);
    }
  }, [selectedWorkflow, workflowStep, currentTab, prospectsViewMode, authUser?.id]);

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
    saveClientProfile(updated, authUser?.id);
    if (authUser?.id) {
      saveSupabaseProfile(authUser.id, updated, authUser.email);
    }
    setIsEditingProfile(false);
  };

  const handleSettingsResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingSettingsResume(true);
    setSettingsResumeFeedback(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/parse-resume', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        const skillsArray = Array.isArray(data.skills) ? data.skills : [];
        const skillsString = skillsArray.join(', ');
        const name = data.name || '';
        const role = data.targetRole || '';
        const title = data.targetRole || '';
        const years = data.yearsOfExperience ?? null;
        const domain = data.domain || data.background || '';

        setEditName(name);
        setEditTitle(title);
        setEditTargetRole(role);
        setEditSkills(skillsString);
        setIsEditingProfile(true);

        const updated: UserProfile = {
          ...(userProfile || EMPTY_PROFILE),
          name,
          title,
          targetRole: role,
          targetRoles: role ? [role] : (userProfile?.targetRoles || []),
          skills: skillsArray,
          yearsOfExperience: years !== null && years !== undefined ? Number(years) : undefined,
          background: domain || undefined,
          bioSummary: data.bioSummary || undefined,
          relevantExperience: data.relevantExperience || undefined
        };
        setUserProfile(updated);
        saveClientProfile(updated, authUser?.id);
        if (authUser?.id) {
          saveSupabaseProfile(authUser.id, updated, authUser.email);
        }
        setSettingsResumeFeedback('Resume parsed with AI! Details auto-filled and saved below.');
      } else {
        setSettingsResumeFeedback(`Failed: ${data.error || 'Could not parse resume'}`);
      }
    } catch (err: any) {
      setSettingsResumeFeedback('Error uploading or parsing resume');
    } finally {
      setIsParsingSettingsResume(false);
    }
  };

  const handleProspectUpdated = (updated: Prospect) => {
    // 1. Functional state update for prospects
    setProspects((prev) => {
      const updatedList = prev.map((p) => (p.id === updated.id ? updated : p));
      saveClientProspects(updatedList, authUser?.id);
      return updatedList;
    });
    
    // 2. Persist status directly to Supabase if authenticated
    if (authUser?.id) {
      if (updated.status === 'Contacted') {
        markConnectionContacted(authUser.id, updated.id, {
          initialMessage: updated.draftedMessage,
          followUpDay5: updated.followUpDay5Message,
          followUpDay12: updated.followUpDay12Message
        });
        getDueFollowUps(authUser.id).then((due) => setDueFollowUpsCount(due.length));
      } else if (updated.status === 'not_relevant') {
        markConnectionSkipped(authUser.id, updated.id);
      } else if (updated.status === 'Not contacted') {
        resetConnectionStatus(authUser.id, updated.id);
      }
    }

    // 3. Ensure DM review modal is closed if marked contacted
    if (updated.status === 'Contacted') {
      setSelectedProspect(null);
    } else if (selectedProspect && selectedProspect.id === updated.id) {
      setSelectedProspect(updated);
    }

    // 4. Fresh outreach logs state
    const updatedLogs = getClientOutreachLogs(authUser?.id);
    setOutreachLogs(updatedLogs);
  };

  const handleProspectAdded = (newP: Prospect) => {
    addClientProspect(newP);
    const updated = [newP, ...prospects];
    setProspects(updated);
    saveClientProspects(updated, authUser?.id);
    setSelectedProspect(newP);
  };

  const handleExportBackup = async () => {
    try {
      const { exportUserDataJson, recordExportDate } = await import('@/lib/clientDb');
      const json = await exportUserDataJson();
      const nowIso = recordExportDate();
      setLastExportDate(nowIso);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `directmessage_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export backup error:', err);
      alert('Failed to export backup data.');
    }
  };

  const handleCsvImportComplete = async (imported: Prospect[]) => {
    let currentList = prospects;
    if (authUser?.id) {
      currentList = await getSupabaseConnections(authUser.id);
    }

    const map = new Map<string, Prospect>();
    for (const p of currentList) {
      const norm = normalizeLinkedInUrl(p.linkedinUrl, p.name, p.company);
      map.set(norm, p);
    }

    for (const p of imported) {
      const norm = normalizeLinkedInUrl(p.linkedinUrl, p.name, p.company);
      const existing = map.get(norm);
      if (!existing) {
        map.set(norm, p);
      } else if (existing.status === 'Contacted' || existing.status === 'not_relevant') {
        // Strict preservation: Contacted and Skipped are terminal states for the NEW queue
      } else {
        map.set(norm, p);
      }
    }

    const cleaned = Array.from(map.values());
    setProspects(cleaned);
    saveClientProspects(cleaned, authUser?.id);
    if (authUser?.id) {
      const due = await getDueFollowUps(authUser.id);
      setDueFollowUpsCount(due.length);
    }
    requestStoragePersistence();
    setCurrentTab('prospects');
  };

  const handleWorkflowImportComplete = async (imported: Prospect[]) => {
    let currentList = prospects;
    if (authUser?.id) {
      currentList = await getSupabaseConnections(authUser.id);
    }

    const map = new Map<string, Prospect>();
    for (const p of currentList) {
      const norm = normalizeLinkedInUrl(p.linkedinUrl, p.name, p.company);
      map.set(norm, p);
    }

    for (const p of imported) {
      const norm = normalizeLinkedInUrl(p.linkedinUrl, p.name, p.company);
      const existing = map.get(norm);
      if (!existing) {
        map.set(norm, p);
      } else if (existing.status === 'Contacted' || existing.status === 'not_relevant') {
        // Strict preservation: Contacted and Skipped are terminal states for the NEW queue
      } else {
        map.set(norm, p);
      }
    }

    const cleaned = Array.from(map.values());
    setProspects(cleaned);
    saveClientProspects(cleaned, authUser?.id);
    if (authUser?.id) {
      const due = await getDueFollowUps(authUser.id);
      setDueFollowUpsCount(due.length);
    }
    requestStoragePersistence();
    setWorkflowStep('segregated');
  };

  const handleOutreachStatusChange = async (entry: OutreachLogEntry, newStatus: OutreachStatus) => {
    updateClientOutreachStatus(entry.linkedinUrl, entry.name, entry.company, newStatus);
    const updatedLogs = getClientOutreachLogs(authUser?.id);
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
    saveClientProspects(updatedProspects, authUser?.id);
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
        prospectFilter === 'All'
          ? p.status !== 'not_relevant'
          : prospectFilter === 'Not relevant'
          ? p.status === 'not_relevant'
          : p.status === prospectFilter;

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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F4F2EE] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
          <DMLogo size="lg" />
          <div className="flex items-center gap-2 text-zinc-600 text-sm font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-[#0A66C2]" />
            <span>Restoring secure workspace...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <AuthScreen onAuthSuccess={(user) => loadUserData(user)} />;
  }

  return (
    <div className="min-h-screen bg-[#F4F2EE] text-zinc-900 flex flex-col justify-between selection:bg-[#0A66C2]/20">
      {/* Clean Header */}
      <Header
        currentTab={currentTab}
        activeWorkflow={selectedWorkflow}
        dueFollowUpsCount={dueFollowUpsCount}
        contactedCount={outreachLogs.length}
        authUser={authUser}
        userProfile={userProfile}
        onSignOut={handleSignOutUser}
        onTabChange={(tab) => {
          setCurrentTab(tab);
        }}
        onChangeGoal={() => {
          setSelectedWorkflow(null);
          setWorkflowStep('upload');
          setCurrentTab('home');
        }}
        onBackToLanding={() => {
          setSelectedWorkflow(null);
          setWorkflowStep('upload');
          setCurrentTab('home');
        }}
        onDataImported={async () => {
          if (authUser?.id) {
            const conns = await getSupabaseConnections(authUser.id);
            setProspects(conns);
            saveClientProspects(conns, authUser.id);
            const due = await getDueFollowUps(authUser.id);
            setDueFollowUpsCount(due.length);
          }
        }}
      />

      <div className="w-full max-w-7xl mx-auto flex-1 flex flex-col relative pb-20 md:pb-8 px-4 sm:px-6 lg:px-8 pt-6">
        {/* Back up your data Reminder */}
        {showBackupReminder && prospects.length > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 text-amber-700">
                <ShieldAlert className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-semibold text-amber-950">Back up your data: </span>
                <span>
                  All prospects are stored locally in this browser. Last exported:{' '}
                  <strong className="text-amber-950 font-semibold">
                    {lastExportDate ? new Date(lastExportDate).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                  </strong>.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleExportBackup}
                className="text-[11px] font-semibold bg-[#0A66C2] hover:bg-[#004182] text-white px-3 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>Export Backup</span>
              </button>
              <button
                onClick={() => setShowBackupReminder(false)}
                className="text-zinc-400 hover:text-zinc-600 p-1 rounded-md cursor-pointer"
                title="Dismiss reminder"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

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
                  userProfile={userProfile}
                  onOpenSettings={() => setCurrentTab('settings')}
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
                            setWorkflowStep(prospects.length > 0 ? 'segregated' : 'upload');
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
                <div>
                  <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#0A66C2]" />
                    <span>Prospects & Outreach Review</span>
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {prospects.length} total imported connections · {prospects.filter((p) => p.status !== 'Contacted' && p.status !== 'not_relevant').length} pending outreach
                  </p>
                </div>

                {/* View Switcher: ⚡ Direct Message Review Queue vs ▦ Grid View */}
                {prospects.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-[#F4F2EE] p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
                    <button
                      onClick={() => setProspectsViewMode('queue')}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        prospectsViewMode === 'queue'
                          ? 'bg-[#0A66C2] text-white shadow-xs font-bold'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Review Queue</span>
                    </button>

                    <button
                      onClick={() => setProspectsViewMode('grid')}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        prospectsViewMode === 'grid'
                          ? 'bg-white text-zinc-900 shadow-xs font-bold'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Grid View</span>
                    </button>
                  </div>
                )}
              </div>

              {prospects.length === 0 ? (
                <div className="bg-white border border-[#E0DFDC] rounded-2xl p-10 text-center text-xs sm:text-sm text-zinc-500 shadow-xs space-y-3 max-w-lg mx-auto">
                  <div className="w-12 h-12 rounded-2xl bg-[#EBF3FB] text-[#0A66C2] flex items-center justify-center mx-auto">
                    <Users className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-zinc-900 text-base">No prospects imported yet</p>
                  <p className="text-xs text-zinc-500">
                    Upload your LinkedIn Connections CSV file on the Home tab to start reviewing and generating direct messages.
                  </p>
                  <button
                    onClick={() => {
                      setCurrentTab('home');
                    }}
                    className="inline-flex items-center gap-2 bg-[#0A66C2] hover:bg-[#004182] text-white font-bold text-xs px-4 py-2.5 rounded-full shadow-xs transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Choose Outreach Goal & Import</span>
                  </button>
                </div>
              ) : prospectsViewMode === 'queue' ? (
                /* REVIEW QUEUE (1-BY-1 HIGH-SPEED TRIAGE) */
                <ReviewQueueView
                  prospects={prospects}
                  workflow={(selectedWorkflow || 'job-hunt') as any}
                  onProspectUpdated={handleProspectUpdated}
                  onSwitchToList={() => setProspectsViewMode('grid')}
                  userProfile={userProfile}
                  onOpenSettings={() => setCurrentTab('settings')}
                  userId={authUser?.id}
                />
              ) : (
                /* GRID VIEW */
                <div className="space-y-4">
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
                      {['All', 'Not contacted', 'Contacted', 'Replied', 'Not relevant'].map((st) => (
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 xl:gap-7">
                    {filteredProspects.map((prospect) => (
                      <ProspectCard
                        key={prospect.id}
                        prospect={prospect}
                        onSelect={(p) => setSelectedProspect(p)}
                      />
                    ))}
                  </div>
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

          {/* TAB 4B: FOLLOW-UPS SEQUENCES */}
          {currentTab === 'followups' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <FollowUpsView
                onFollowUpCompleted={async () => {
                  const user = await getCurrentSupabaseUser();
                  if (user) {
                    const due = await getDueFollowUps(user.id);
                    setDueFollowUpsCount(due.length);
                  }
                }}
              />
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

                  {/* AI Resume Upload & Auto-fill */}
                  <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/50 border border-blue-200/70 rounded-xl p-3.5 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#0A66C2] shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-zinc-900 block">
                            Auto-Fill Profile with AI
                          </span>
                          <span className="text-[11px] text-zinc-500">
                            Upload resume (.pdf, .docx, .txt) to extract profile data via Groq LLM
                          </span>
                        </div>
                      </div>

                      <label className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#0A66C2] hover:bg-[#004182] text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-colors shrink-0">
                        {isParsingSettingsResume ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Parsing AI...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload Resume</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept=".pdf,.docx,.txt"
                          onChange={handleSettingsResumeUpload}
                          disabled={isParsingSettingsResume}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {settingsResumeFeedback && (
                      <p className={`text-xs font-medium pt-1 ${
                        settingsResumeFeedback.startsWith('Resume') ? 'text-emerald-700' : 'text-rose-600'
                      }`}>
                        {settingsResumeFeedback}
                      </p>
                    )}
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
          dueFollowUpsCount={dueFollowUpsCount}
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
