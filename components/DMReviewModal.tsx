'use client';

import React, { useState, useEffect } from 'react';
import { Prospect, UserProfile } from '@/types';
import {
  checkClientDuplicate,
  appendClientOutreachLog,
  updateClientProspect,
  getClientProfile,
  saveClientProfile
} from '@/lib/clientStorage';
import { generatePersonalizedDM, MessageAngle } from '@/lib/generator';
import { copyTextToClipboard, openLinkedInTab } from '@/lib/clipboard';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Send,
  Info,
  SlidersHorizontal,
  Briefcase,
  Users,
  RotateCcw,
  Sparkles,
  Zap
} from 'lucide-react';

interface DMReviewModalProps {
  prospect: Prospect | null;
  onClose: () => void;
  onProspectUpdated: (updated: Prospect) => void;
}

export function DMReviewModal({ prospect, onClose, onProspectUpdated }: DMReviewModalProps) {
  const [userProfile, setUserProfile] = useState<UserProfile>(getClientProfile());
  const [activeTab, setActiveTab] = useState<'day0' | 'day5' | 'day12'>('day0');
  const [selectedAngle, setSelectedAngle] = useState<MessageAngle>('standard');
  const [copied, setCopied] = useState(false);
  const [showScoreDetails, setShowScoreDetails] = useState(false);

  // Target role configuration
  const defaultTargetRole =
    (prospect?.jobOpportunity?.title && prospect?.jobOpportunity?.title !== prospect?.jobTitle)
      ? prospect.jobOpportunity.title
      : userProfile.targetRole || userProfile.targetRoles?.[0] || 'Full Stack Engineer';
  const [targetRole, setTargetRole] = useState<string>(defaultTargetRole);
  const [isCustomRole, setIsCustomRole] = useState(false);

  const [message, setMessage] = useState(prospect?.draftedMessage || '');

  // 1-Click Copy & Open Profile tracking state
  const [openedTabForOutreach, setOpenedTabForOutreach] = useState(false);
  const [showReturnPrompt, setShowReturnPrompt] = useState(false);

  // Duplicate Check & Confirmation State
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);

  // Determine segregation category
  const isFounder =
    prospect?.segregationGroup === 'Founder' ||
    prospect?.classification === 'Founder' ||
    prospect?.classification === 'Co-founder' ||
    prospect?.classification === 'CEO' ||
    prospect?.classification === 'CTO' ||
    prospect?.relationshipType === 'Founder' ||
    prospect?.relationshipType === 'CEO' ||
    prospect?.relationshipType === 'CTO';

  const isRecruiter =
    prospect?.segregationGroup === 'HR' ||
    prospect?.classification === 'Recruiter' ||
    prospect?.classification === 'Hiring Manager' ||
    prospect?.relationshipType === 'Recruiter' ||
    prospect?.relationshipType === 'HR' ||
    prospect?.relationshipType === 'Hiring Manager';

  const isEmployee = !isFounder && !isRecruiter;

  const firstName = (prospect?.name || 'there').trim().split(' ')[0];
  const company = prospect?.company || 'their team';

  // Strategy description for UI transparency
  const getStrategyMeta = () => {
    if (isFounder) {
      return {
        badge: 'Founder / Leadership Pitch',
        tagColor: 'bg-purple-50 text-purple-700 border-purple-200',
        title: 'Vacant Technical Spot & Startup Agility Pitch',
        desc: `Pitching ${firstName} directly on your past startup experience (delivering end-to-end production systems) and asking if there's an open technical spot on the founding team.`
      };
    }
    if (isRecruiter) {
      return {
        badge: 'Recruiter / HR Opportunity Inquiry',
        tagColor: 'bg-blue-50 text-blue-700 border-blue-200',
        title: 'Direct Opportunity & Candidate Consideration',
        desc: `Asking ${firstName} directly for active/upcoming ${targetRole} openings at ${company}, requesting candidate consideration, and offering your resume.`
      };
    }
    return {
      badge: 'Working Employee Referral Ask',
      tagColor: 'bg-zinc-100 text-zinc-700 border-zinc-200',
      title: 'Internal Referral & Peer Network Ask',
      desc: `Asking ${firstName} for an internal referral or open roles at ${company} or their network. We never ask for their own position or assume an unreleased job opening.`
    };
  };

  const strategyMeta = getStrategyMeta();

  // Load message on mount or tab change
  useEffect(() => {
    if (!prospect) return;
    const prof = getClientProfile();
    setUserProfile(prof);

    const stored =
      activeTab === 'day0'
        ? prospect.draftedMessage
        : activeTab === 'day5'
        ? prospect.followUpDay5Message
        : prospect.followUpDay12Message;

    setMessage(stored || generatePersonalizedDM(prospect, targetRole, selectedAngle, prof)[activeTab]);
    setCopied(false);
    setDuplicateWarning(null);
    setLogSuccess(prospect.status === 'Contacted');
    setOpenedTabForOutreach(false);
    setShowReturnPrompt(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospect, activeTab]);

  // Listen for user returning to tab after viewing LinkedIn
  useEffect(() => {
    const handleReturn = () => {
      if (document.visibilityState === 'visible' && openedTabForOutreach && prospect && prospect.status !== 'Contacted') {
        setShowReturnPrompt(true);
      }
    };

    document.addEventListener('visibilitychange', handleReturn);
    window.addEventListener('focus', handleReturn);

    return () => {
      document.removeEventListener('visibilitychange', handleReturn);
      window.removeEventListener('focus', handleReturn);
    };
  }, [openedTabForOutreach, prospect]);

  if (!prospect) return null;

  const matchScore = prospect.score?.totalScore || 85;
  const wordCount = message.trim().split(/\s+/).filter(Boolean).length;

  const handleMessageChange = (newVal: string) => {
    setMessage(newVal);
    updateClientProspect(prospect.id, prospect.status, newVal);
  };

  const handleSwitchAngle = (angle: MessageAngle) => {
    setSelectedAngle(angle);
    const generated = generatePersonalizedDM(prospect, targetRole, angle, userProfile);
    let newMsg = generated.day0;
    if (activeTab === 'day5') newMsg = generated.day5;
    else if (activeTab === 'day12') newMsg = generated.day12;
    setMessage(newMsg);
    updateClientProspect(prospect.id, prospect.status, newMsg);
  };

  const handleTargetRoleChange = (newRole: string) => {
    setTargetRole(newRole);
    const updatedProfile = { ...userProfile, targetRole: newRole };
    setUserProfile(updatedProfile);
    saveClientProfile(updatedProfile);

    const generated = generatePersonalizedDM(prospect, newRole, selectedAngle, updatedProfile);
    let newMsg = generated.day0;
    if (activeTab === 'day5') newMsg = generated.day5;
    else if (activeTab === 'day12') newMsg = generated.day12;
    setMessage(newMsg);
    updateClientProspect(prospect.id, prospect.status, newMsg);
  };

  const handleResetToDefaultTemplate = () => {
    const generated = generatePersonalizedDM(prospect, targetRole, selectedAngle, userProfile);
    let newMsg = generated.day0;
    if (activeTab === 'day5') newMsg = generated.day5;
    else if (activeTab === 'day12') newMsg = generated.day12;
    setMessage(newMsg);
    updateClientProspect(prospect.id, prospect.status, newMsg);
  };

  // 1-Click Action: Copies DM to clipboard and immediately opens LinkedIn Profile in new tab
  const handleCopyAndOpenProfile = async () => {
    // 1. Synchronously open window inside click event to guarantee no popup blocking
    openLinkedInTab(prospect.linkedinUrl, prospect.name, prospect.company);

    // 2. Write to clipboard
    const success = await copyTextToClipboard(message);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    }

    // 3. Mark that tab was opened for outreach
    setOpenedTabForOutreach(true);
  };

  const handleCopy = async () => {
    const success = await copyTextToClipboard(message);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 3500);
    }
  };

  const handleOpenLinkedIn = () => {
    openLinkedInTab(prospect.linkedinUrl, prospect.name, prospect.company);
  };

  const handleInitiateContacted = async () => {
    const clientCheck = checkClientDuplicate(prospect.linkedinUrl, prospect.name, prospect.company);
    if (clientCheck.isDuplicate) {
      const contactDate = clientCheck.existingEntry?.date || prospect.lastContactedDate || 'recently';
      setDuplicateWarning(`Already contacted on ${contactDate}`);
      return;
    }

    setDuplicateWarning(null);
    setShowConfirmModal(true);
  };

  const handleConfirmContacted = async () => {
    setIsLogging(true);
    const today = new Date().toISOString().split('T')[0];

    const logEntry = {
      date: today,
      name: prospect.name,
      company: prospect.company,
      role: targetRole,
      personPosition: prospect.jobTitle,
      relationshipType: prospect.relationshipType,
      linkedinUrl: prospect.linkedinUrl,
      status: 'Contacted' as const
    };

    appendClientOutreachLog(logEntry);
    updateClientProspect(prospect.id, 'Contacted', message);

    try {
      await fetch('/api/outreach-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'append',
          prospectId: prospect.id,
          ...logEntry
        })
      });
    } catch {}

    setShowConfirmModal(false);
    setShowReturnPrompt(false);
    setLogSuccess(true);
    const updated = {
      ...prospect,
      status: 'Contacted' as const,
      lastContactedDate: today,
      draftedMessage: message
    };
    onProspectUpdated(updated);
    setIsLogging(false);
  };

  const availableRoles = [
    'Full Stack Engineer',
    'Software Engineer',
    'Frontend Engineer',
    'Backend Engineer',
    'AI Engineer',
    'Founding Engineer'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#E0DFDC] overflow-hidden">
        {/* Modal Top Header */}
        <div className="px-5 py-4 border-b border-[#E0DFDC] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-900 tracking-tight">Direct Message Generator</span>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border tracking-wide uppercase ${strategyMeta.tagColor}`}>
              {strategyMeta.badge}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-zinc-900">
          {duplicateWarning && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{duplicateWarning}</span>
            </div>
          )}

          {logSuccess && (
            <div className="p-3.5 rounded-xl bg-[#057642]/10 border border-[#057642]/20 text-[#057642] text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-[#057642] shrink-0" />
              <span>Logged as contacted! Outreach record updated successfully.</span>
            </div>
          )}

          {/* Interactive Return Prompt: Triggered when user returns from LinkedIn */}
          {showReturnPrompt && prospect.status !== 'Contacted' && (
            <div className="p-4 rounded-xl bg-white border border-[#E0DFDC] text-xs space-y-2.5 animate-in slide-in-from-top-2 duration-200 shadow-md">
              <div className="flex items-center justify-between">
                <div className="font-bold text-zinc-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#0A66C2]" />
                  <span>Welcome back! Did you send the DM to {firstName}?</span>
                </div>
                <button
                  onClick={() => setShowReturnPrompt(false)}
                  className="text-zinc-400 hover:text-zinc-700 text-[11px] font-semibold"
                >
                  Dismiss
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Single click to mark as contacted and update your outreach log.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleConfirmContacted}
                  disabled={isLogging}
                  className="flex-1 py-2.5 px-4 rounded-full bg-[#0A66C2] hover:bg-[#004182] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
                >
                  <Check className="w-4 h-4 stroke-[2.5px]" />
                  <span>{isLogging ? 'Logging...' : 'Yes, Mark as Contacted'}</span>
                </button>
                <button
                  onClick={() => setShowReturnPrompt(false)}
                  className="py-2.5 px-4 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold transition-colors"
                >
                  Not yet
                </button>
              </div>
            </div>
          )}

          {/* Section 1: Person & Company Card */}
          <div className="bg-[#F4F2EE]/40 rounded-xl p-4 sm:p-5 border border-[#E0DFDC] flex items-start justify-between gap-4 shadow-2xs">
            <div className="min-w-0 space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Contact & Role
              </span>
              <h3 className="text-base sm:text-lg font-bold text-zinc-900 tracking-tight truncate">
                {prospect.name}
              </h3>
              <p className="text-xs text-zinc-600 flex items-center gap-1.5 pt-0.5">
                <span className="font-semibold text-zinc-900">{prospect.classification}</span>
                <span>·</span>
                <span className="truncate">{company}</span>
              </p>
              <p className="text-xs text-zinc-500 truncate" title={prospect.jobTitle}>
                {prospect.jobTitle}
              </p>
            </div>

            <div className="flex flex-col items-end shrink-0 pl-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Match
              </span>
              <div className="text-2xl font-black text-[#057642] mt-0.5">
                {matchScore}%
              </div>
              <button
                onClick={() => setShowScoreDetails(!showScoreDetails)}
                className="text-xs font-semibold text-[#0A66C2] hover:underline flex items-center gap-1 mt-1 transition-colors"
              >
                <span>Why</span>
                {showScoreDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Section 2: Expandable Score Breakdown */}
          {showScoreDetails && prospect.score && (
            <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#E0DFDC] text-xs space-y-3.5 shadow-2xs animate-in fade-in duration-150">
              <div className="font-semibold text-zinc-800 flex items-center gap-1.5 pb-1 border-b border-[#E0DFDC]">
                <Info className="w-4 h-4 text-[#0A66C2]" />
                <span className="text-xs font-bold">Transparent Scoring Breakdown</span>
              </div>

              <div className="space-y-2">
                {prospect.score.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-[#E0DFDC]/50">
                    <span className="text-zinc-600">{item.category}</span>
                    <span className={`font-semibold ${item.matched ? 'text-[#057642]' : 'text-zinc-400'}`}>
                      +{item.points} / {item.maxPoints} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Outreach Strategy & Target Opportunity */}
          <div className="bg-[#F4F2EE]/40 rounded-xl p-4 sm:p-4.5 border border-[#E0DFDC] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#0A66C2]" />
                <span className="text-xs font-bold text-zinc-900">
                  Opportunity You Are Seeking
                </span>
              </div>
              <button
                onClick={() => setIsCustomRole(!isCustomRole)}
                className="text-[11px] font-semibold text-[#0A66C2] hover:underline transition-colors"
              >
                {isCustomRole ? 'Choose preset' : 'Custom title'}
              </button>
            </div>

            {isCustomRole ? (
              <input
                type="text"
                value={targetRole}
                onChange={(e) => handleTargetRoleChange(e.target.value)}
                placeholder="e.g. Senior Full Stack Engineer"
                className="w-full bg-white border border-[#E0DFDC] rounded-xl px-3 py-2 text-xs text-zinc-900 font-semibold focus:outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
              />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {availableRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => handleTargetRoleChange(role)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      targetRole === role
                        ? 'bg-[#0A66C2] text-white shadow-xs'
                        : 'bg-white text-zinc-700 border border-[#E0DFDC] hover:border-[#0A66C2] hover:text-[#0A66C2]'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-[#E0DFDC] text-xs text-zinc-600 space-y-1">
              <div className="font-semibold text-zinc-900 flex items-center gap-1">
                <span>Strategy:</span>
                <span>{strategyMeta.title}</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                {strategyMeta.desc}
              </p>
            </div>
          </div>

          {/* Section 4: Sequence Tabs */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block px-0.5">
              Outreach Sequence Touchpoint
            </span>
            <div className="flex rounded-full bg-[#F4F2EE] p-1 gap-1 border border-[#E0DFDC]">
              <button
                onClick={() => setActiveTab('day0')}
                className={`flex-1 py-1.5 text-xs rounded-full transition-all ${
                  activeTab === 'day0' ? 'bg-[#0A66C2] text-white font-semibold shadow-xs' : 'text-zinc-600 hover:text-[#0A66C2] font-semibold'
                }`}
              >
                Day 0 (Initial)
              </button>
              <button
                onClick={() => setActiveTab('day5')}
                className={`flex-1 py-1.5 text-xs rounded-full transition-all ${
                  activeTab === 'day5' ? 'bg-[#0A66C2] text-white font-semibold shadow-xs' : 'text-zinc-600 hover:text-[#0A66C2] font-semibold'
                }`}
              >
                Day 5 Follow-up
              </button>
              <button
                onClick={() => setActiveTab('day12')}
                className={`flex-1 py-1.5 text-xs rounded-full transition-all ${
                  activeTab === 'day12' ? 'bg-[#0A66C2] text-white font-semibold shadow-xs' : 'text-zinc-600 hover:text-[#0A66C2] font-semibold'
                }`}
              >
                Day 12 Final
              </button>
            </div>
          </div>

          {/* Section 4B: Message Angle Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs px-0.5">
              <div className="flex items-center gap-1.5 font-semibold text-zinc-600">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#0A66C2]" />
                <span>Outreach Angle / Pitch Hook</span>
              </div>
              <button
                onClick={handleResetToDefaultTemplate}
                className="text-[11px] font-semibold text-[#0A66C2] hover:underline flex items-center gap-1 transition-colors"
                title="Reset message to clean template"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset template</span>
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { id: 'standard' as MessageAngle, label: 'Standard / Adaptive' },
                { id: 'founding' as MessageAngle, label: 'Founding 0→1' },
                { id: 'ai_rag' as MessageAngle, label: 'Full Stack AI / RAG' },
                { id: 'product_ownership' as MessageAngle, label: 'Product & Autonomy' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleSwitchAngle(opt.id)}
                  className={`py-2 px-3 rounded-full text-[11px] transition-all text-center truncate ${
                    selectedAngle === opt.id
                      ? 'bg-[#0A66C2] text-white font-semibold shadow-xs'
                      : 'bg-white hover:bg-[#F4F2EE] border border-[#E0DFDC] text-zinc-700 hover:border-[#0A66C2] hover:text-[#0A66C2] font-medium'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section 5: The Message Textarea */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs px-0.5">
              <span className="font-bold uppercase tracking-wider text-zinc-700">Generated Message</span>
              <span className={`text-[11px] font-medium ${wordCount >= 50 && wordCount <= 120 ? 'text-[#057642] font-semibold' : 'text-zinc-500'}`}>
                {wordCount} words (Target: 50–100)
              </span>
            </div>

            <textarea
              value={message}
              onChange={(e) => handleMessageChange(e.target.value)}
              rows={8}
              className="w-full bg-[#F4F2EE]/30 text-zinc-900 text-xs sm:text-sm rounded-xl p-4 border border-[#E0DFDC] focus:outline-none focus:border-[#0A66C2] focus:bg-white focus:ring-1 focus:ring-[#0A66C2] leading-relaxed font-sans shadow-2xs min-h-[160px] transition-colors"
              placeholder="Draft your personalized message..."
            />
          </div>

          {/* Action Buttons Section */}
          <div className="space-y-3 pt-2">
            {/* 1-Click Power Action: Copy DM and open LinkedIn tab */}
            <button
              onClick={handleCopyAndOpenProfile}
              className="w-full py-3.5 px-4 rounded-full bg-[#0A66C2] hover:bg-[#004182] active:scale-[0.98] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all"
            >
              <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
              <span>Copy DM & Open Profile (1-Click)</span>
              <ExternalLink className="w-3.5 h-3.5 text-blue-200" />
            </button>

            {/* Notification when copied */}
            {copied && (
              <div className="p-3.5 rounded-xl bg-[#057642]/10 border border-[#057642]/20 text-xs flex items-center justify-between text-[#057642] animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#057642] stroke-[3px]" />
                  <span>
                    DM copied! Open chat with {firstName} and paste (<strong>⌘V</strong> / <strong>Ctrl+V</strong>).
                  </span>
                </div>
              </div>
            )}

            {/* Sub-actions Row */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                onClick={handleCopy}
                className="py-2.5 px-3 rounded-full bg-white hover:bg-[#0A66C2]/10 text-[#0A66C2] text-xs font-semibold border border-[#0A66C2] flex items-center justify-center gap-1.5 transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-[#0A66C2]" />
                <span>Copy Only</span>
              </button>

              <button
                onClick={handleInitiateContacted}
                className="py-2.5 px-3 rounded-full bg-white hover:bg-[#057642]/10 text-[#057642] text-xs font-semibold border border-[#057642] flex items-center justify-center gap-1.5 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{prospect.status === 'Contacted' ? 'Contacted ✓' : 'Mark Contacted'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Sub-Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white border border-[#E0DFDC] rounded-2xl p-5 max-w-xs w-full shadow-2xl space-y-3.5 animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-zinc-900 text-center">
              Confirm Contact Log
            </h3>
            <p className="text-xs text-zinc-600 text-center leading-relaxed">
              Mark <span className="font-semibold text-zinc-900">{prospect.name}</span> as contacted?
            </p>
            <p className="text-[11px] text-zinc-400 text-center">
              This will record the entry in your outreach log for role &ldquo;{targetRole}&rdquo;.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="py-2 rounded-full bg-white text-zinc-700 text-xs font-semibold hover:bg-[#F4F2EE] transition-colors border border-[#E0DFDC]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmContacted}
                disabled={isLogging}
                className="py-2 rounded-full bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1 transition-all"
              >
                {isLogging ? 'Logging...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
