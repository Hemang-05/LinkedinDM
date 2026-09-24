'use client';

import React, { useState, useEffect } from 'react';
import { Prospect } from '@/types';
import {
  checkClientDuplicate,
  appendClientOutreachLog,
  updateClientProspect
} from '@/lib/clientStorage';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Send,
  Info
} from 'lucide-react';

interface DMReviewModalProps {
  prospect: Prospect | null;
  onClose: () => void;
  onProspectUpdated: (updated: Prospect) => void;
}

export function DMReviewModal({ prospect, onClose, onProspectUpdated }: DMReviewModalProps) {
  if (!prospect) return null;

  const [message, setMessage] = useState(prospect.draftedMessage || '');
  const [activeTab, setActiveTab] = useState<'day0' | 'day5' | 'day12'>('day0');
  const [copied, setCopied] = useState(false);
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Duplicate Check & Confirmation State
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);

  // Synchronize message if prospect changes
  useEffect(() => {
    setMessage(
      activeTab === 'day0'
        ? prospect.draftedMessage || ''
        : activeTab === 'day5'
        ? prospect.followUpDay5Message || ''
        : prospect.followUpDay12Message || ''
    );
    setCopied(false);
    setDuplicateWarning(null);
    setLogSuccess(prospect.status === 'Contacted');
  }, [prospect, activeTab]);

  const matchScore = prospect.score?.totalScore || 85;
  const hiringRole = prospect.jobOpportunity?.title || prospect.jobTitle;
  const company = prospect.company;

  // Calculate word count
  const wordCount = message.trim().split(/\s+/).filter(Boolean).length;

  // Save manual edit to browser storage
  const handleMessageChange = (newVal: string) => {
    setMessage(newVal);
    updateClientProspect(prospect.id, prospect.status, newVal);
  };

  // Copy to clipboard with native API
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 3500);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Open LinkedIn manually
  const handleOpenLinkedIn = () => {
    const targetUrl = prospect.linkedinUrl || `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(prospect.name + ' ' + prospect.company)}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  // Regenerate with different angles
  const handleRegenerate = async (angle?: string) => {
    setIsRegenerating(true);
    try {
      const res = await fetch('/api/generate-dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospect,
          job: prospect.jobOpportunity,
          angle
        })
      });
      const data = await res.json();
      if (data.success) {
        let newMsg = data.day0;
        if (activeTab === 'day5') newMsg = data.day5;
        else if (activeTab === 'day12') newMsg = data.day12;
        setMessage(newMsg);
        updateClientProspect(prospect.id, prospect.status, newMsg);
      }
    } catch (err) {
      console.error('Regeneration error:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Initiate Mark as Contacted flow
  const handleInitiateContacted = async () => {
    // 1. Check browser storage first
    const clientCheck = checkClientDuplicate(prospect.linkedinUrl, prospect.name, prospect.company);
    if (clientCheck.isDuplicate) {
      const contactDate = clientCheck.existingEntry?.date || prospect.lastContactedDate || 'recently';
      setDuplicateWarning(`Already contacted on ${contactDate}`);
      return;
    }

    // 2. Try server check as additional verification if available
    try {
      const res = await fetch('/api/outreach-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check',
          linkedinUrl: prospect.linkedinUrl,
          name: prospect.name,
          company: prospect.company
        })
      });
      const data = await res.json();
      if (data.isDuplicate) {
        const contactDate = data.existingEntry?.date || prospect.lastContactedDate || 'recently';
        setDuplicateWarning(`Already contacted on ${contactDate}`);
        return;
      }
    } catch {}

    setDuplicateWarning(null);
    setShowConfirmModal(true);
  };

  // Confirm Mark as Contacted
  const handleConfirmContacted = async () => {
    setIsLogging(true);
    const today = new Date().toISOString().split('T')[0];

    const logEntry = {
      date: today,
      name: prospect.name,
      company: prospect.company,
      role: hiringRole,
      personPosition: prospect.jobTitle,
      relationshipType: prospect.relationshipType,
      linkedinUrl: prospect.linkedinUrl,
      status: 'Contacted' as const
    };

    // 1. Persist directly in browser storage
    appendClientOutreachLog(logEntry);
    updateClientProspect(prospect.id, 'Contacted', message);

    // 2. Also sync to local backend if running
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
    } catch (err) {
      console.log('Server sync skipped (browser storage active):', err);
    }

    setShowConfirmModal(false);
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
      <div className="bg-[#0f172a] border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
        <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto mt-2.5 mb-1 sm:hidden" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-400">
              Outreach Review
            </h2>
            <p className="text-xs text-slate-400">Personalized Human-in-the-Loop DM</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 space-y-4 overflow-y-auto safe-pb">
          {duplicateWarning && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
              <div className="flex-1 font-medium">{duplicateWarning}</div>
            </div>
          )}

          {logSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Logged ✓ (Saved in browser storage & outreach log)</span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-200">
                Contacted
              </span>
            </div>
          )}

          {/* Section 1: Person & Company Card */}
          <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Person
              </span>
              <h3 className="text-base font-bold text-white tracking-tight truncate">
                {prospect.name}
              </h3>
              <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
                <span className="font-semibold text-indigo-300">{prospect.classification}</span>
                <span>·</span>
                <span className="truncate">{company}</span>
              </p>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {prospect.jobTitle}
              </p>
            </div>

            <div className="flex flex-col items-end flex-shrink-0">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Match
              </span>
              <div className="text-lg font-black text-emerald-400 mt-0.5">
                {matchScore}%
              </div>
              <button
                onClick={() => setShowScoreDetails(!showScoreDetails)}
                className="text-[10px] text-indigo-400 flex items-center gap-0.5 hover:underline mt-0.5"
              >
                <span>Why</span>
                {showScoreDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Section 2: Expandable Transparent Match Breakdown */}
          {showScoreDetails && prospect.score && (
            <div className="bg-slate-950/80 rounded-2xl p-3.5 border border-slate-800 text-xs space-y-2.5 animate-in fade-in duration-150">
              <div className="font-semibold text-slate-300 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-indigo-400" />
                <span>Transparent Scoring Breakdown (0–100)</span>
              </div>

              <div className="space-y-1.5">
                {prospect.score.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] py-0.5 border-b border-slate-800/40">
                    <span className="text-slate-400">{item.category}</span>
                    <span className={`font-semibold ${item.matched ? 'text-emerald-400' : 'text-slate-500'}`}>
                      +{item.points} / {item.maxPoints} pts
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-1 space-y-1.5">
                <div>
                  <span className="text-[10px] font-semibold text-emerald-400 uppercase">Strong Matches:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {prospect.score.strongMatches.map((m, i) => (
                      <span key={i} className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                        ✓ {m}
                      </span>
                    ))}
                  </div>
                </div>

                {prospect.score.gaps.length > 0 && (
                  <div>
                    <span className="text-[10px] font-semibold text-amber-400 uppercase">Gaps:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {prospect.score.gaps.map((g, i) => (
                        <span key={i} className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.5 rounded">
                          - {g}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Blockers:</span>
                  <span className="text-[11px] text-slate-300 ml-1.5">
                    {prospect.score.blockers.length === 0 ? 'None' : prospect.score.blockers.join(', ')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Target Role Opening */}
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Role being hired for
            </span>
            <div className="text-xs font-semibold text-slate-200">
              {hiringRole}
            </div>
            {prospect.jobOpportunity && (
              <p className="text-[11px] text-slate-400 mt-0.5">
                {prospect.jobOpportunity.location} · {prospect.jobOpportunity.remoteStatus}
              </p>
            )}
          </div>

          {/* Section 4: Sequence Tabs */}
          <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
            <button
              onClick={() => setActiveTab('day0')}
              className={`flex-1 py-1 text-xs font-medium rounded-lg transition-colors ${
                activeTab === 'day0' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Day 0 (Initial)
            </button>
            <button
              onClick={() => setActiveTab('day5')}
              className={`flex-1 py-1 text-xs font-medium rounded-lg transition-colors ${
                activeTab === 'day5' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Day 5 Follow-up
            </button>
            <button
              onClick={() => setActiveTab('day12')}
              className={`flex-1 py-1 text-xs font-medium rounded-lg transition-colors ${
                activeTab === 'day12' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Day 12 Final
            </button>
          </div>

          {/* Section 5: The Message Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300">GENERATED MESSAGE</span>
              <span className={`text-[11px] ${wordCount >= 50 && wordCount <= 100 ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                {wordCount} words (Target: 50–100)
              </span>
            </div>

            <textarea
              value={message}
              onChange={(e) => handleMessageChange(e.target.value)}
              rows={5}
              className="w-full bg-slate-950 text-slate-100 text-xs sm:text-sm rounded-xl p-3.5 border border-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 leading-relaxed font-sans"
              placeholder="Draft your personalized message..."
            />
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleRegenerate()}
              disabled={isRegenerating}
              className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-slate-200 text-xs font-medium border border-slate-800 flex items-center justify-center gap-1.5 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
              <span>Regenerate</span>
            </button>

            <button
              onClick={handleCopy}
              className={`py-2.5 px-3 rounded-xl active:scale-95 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {copied ? <Check className="w-4 h-4 stroke-[3px]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied ✓' : 'Copy DM'}</span>
            </button>
          </div>

          {/* LinkedIn Handoff */}
          {copied && (
            <div className="p-3.5 rounded-2xl bg-indigo-950/60 border border-indigo-500/40 text-xs space-y-2 animate-in fade-in duration-200">
              <div className="font-semibold text-indigo-200 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>DM copied. Open LinkedIn and send it.</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Open the recipient&apos;s LinkedIn page manually, paste your message, and hit send.
              </p>
              <button
                onClick={handleOpenLinkedIn}
                className="w-full py-2 px-3 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-semibold border border-indigo-500/30 flex items-center justify-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open LinkedIn Profile</span>
              </button>
            </div>
          )}

          {!copied && (
            <button
              onClick={handleOpenLinkedIn}
              className="w-full py-2 rounded-xl bg-slate-900/60 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-800 flex items-center justify-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              <span>Open LinkedIn externally</span>
            </button>
          )}

          {/* Primary Bottom Action */}
          <div className="pt-2">
            <button
              onClick={handleInitiateContacted}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
            >
              <Send className="w-4 h-4" />
              <span>Mark as Contacted</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Sub-Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 max-w-xs w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-white text-center">
              Confirm Contact Log
            </h3>
            <p className="text-xs text-slate-300 text-center leading-relaxed">
              Mark <span className="font-semibold text-white">{prospect.name}</span> as contacted?
            </p>
            <p className="text-[11px] text-slate-400 text-center">
              This will update your CRM status and record the entry in your outreach log.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmContacted}
                disabled={isLogging}
                className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1 transition-all"
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
