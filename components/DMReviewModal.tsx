'use client';

import React, { useState, useEffect } from 'react';
import { Prospect } from '@/types';
import {
  checkClientDuplicate,
  appendClientOutreachLog,
  updateClientProspect
} from '@/lib/clientStorage';
import { generatePersonalizedDM, MessageAngle } from '@/lib/generator';
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
  SlidersHorizontal
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
  const [selectedAngle, setSelectedAngle] = useState<MessageAngle>('standard');
  const [copied, setCopied] = useState(false);
  const [showScoreDetails, setShowScoreDetails] = useState(false);

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

  // Instant local angle switch (0ms latency, no AI API needed)
  const handleSwitchAngle = (angle: MessageAngle) => {
    setSelectedAngle(angle);
    const generated = generatePersonalizedDM(prospect, prospect.jobOpportunity, angle);
    let newMsg = generated.day0;
    if (activeTab === 'day5') newMsg = generated.day5;
    else if (activeTab === 'day12') newMsg = generated.day12;
    setMessage(newMsg);
    updateClientProspect(prospect.id, prospect.status, newMsg);
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

  // Initiate Mark as Contacted flow
  const handleInitiateContacted = async () => {
    // Check browser storage
    const clientCheck = checkClientDuplicate(prospect.linkedinUrl, prospect.name, prospect.company);
    if (clientCheck.isDuplicate) {
      const contactDate = clientCheck.existingEntry?.date || prospect.lastContactedDate || 'recently';
      setDuplicateWarning(`Already contacted on ${contactDate}`);
      return;
    }

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
    } catch {}

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-zinc-200 rounded-t-3xl sm:rounded-3xl w-full max-w-xl md:max-w-2xl max-h-[92vh] flex flex-col shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
        <div className="w-12 h-1.5 bg-zinc-300 rounded-full mx-auto mt-2.5 mb-1 sm:hidden" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-4 pb-3.5 border-b border-zinc-100">
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              Outreach Review
            </h2>
            <p className="text-sm font-bold text-zinc-900">Deterministic Personalized DM</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-4.5 overflow-y-auto safe-pb">
          {duplicateWarning && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />
              <div className="flex-1 font-medium">{duplicateWarning}</div>
            </div>
          )}

          {logSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Logged ✓ (Saved in browser storage & outreach log)</span>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                Contacted
              </span>
            </div>
          )}

          {/* Section 1: Person & Company Card */}
          <div className="bg-zinc-50/80 rounded-2xl p-4.5 border border-zinc-200/90 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Person
              </span>
              <h3 className="text-base font-bold text-zinc-900 tracking-tight truncate">
                {prospect.name}
              </h3>
              <p className="text-xs text-zinc-600 flex items-center gap-1.5 mt-0.5">
                <span className="font-semibold text-zinc-900">{prospect.classification}</span>
                <span>·</span>
                <span className="truncate">{company}</span>
              </p>
              <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                {prospect.jobTitle}
              </p>
            </div>

            <div className="flex flex-col items-end flex-shrink-0">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Match
              </span>
              <div className="text-xl font-black text-emerald-600 mt-0.5">
                {matchScore}%
              </div>
              <button
                onClick={() => setShowScoreDetails(!showScoreDetails)}
                className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 flex items-center gap-0.5 mt-0.5 transition-colors"
              >
                <span>Why</span>
                {showScoreDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Section 2: Expandable Transparent Match Breakdown */}
          {showScoreDetails && prospect.score && (
            <div className="bg-white rounded-2xl p-4 border border-zinc-200 text-xs space-y-2.5 shadow-xs animate-in fade-in duration-150">
              <div className="font-semibold text-zinc-800 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-zinc-500" />
                <span>Transparent Scoring Breakdown (0–100)</span>
              </div>

              <div className="space-y-1.5">
                {prospect.score.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] py-1 border-b border-zinc-100">
                    <span className="text-zinc-600">{item.category}</span>
                    <span className={`font-semibold ${item.matched ? 'text-emerald-700' : 'text-zinc-400'}`}>
                      +{item.points} / {item.maxPoints} pts
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-1.5 space-y-2">
                <div>
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">Strong Matches:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {prospect.score.strongMatches.map((m, i) => (
                      <span key={i} className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-medium">
                        ✓ {m}
                      </span>
                    ))}
                  </div>
                </div>

                {prospect.score.gaps.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-amber-700 uppercase">Gaps:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {prospect.score.gaps.map((g, i) => (
                        <span key={i} className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md font-medium">
                          - {g}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">Blockers:</span>
                  <span className="text-[11px] text-zinc-700 ml-1.5">
                    {prospect.score.blockers.length === 0 ? 'None' : prospect.score.blockers.join(', ')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Target Role Opening */}
          <div className="bg-zinc-50/60 rounded-xl p-3 border border-zinc-200/80">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">
              Role being hired for
            </span>
            <div className="text-xs font-semibold text-zinc-900">
              {hiringRole}
            </div>
            {prospect.jobOpportunity && (
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {prospect.jobOpportunity.location} · {prospect.jobOpportunity.remoteStatus}
              </p>
            )}
          </div>

          {/* Section 4: Sequence Tabs */}
          <div className="flex rounded-xl bg-zinc-100 p-1 border border-zinc-200/80">
            <button
              onClick={() => setActiveTab('day0')}
              className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${
                activeTab === 'day0' ? 'bg-zinc-900 text-white font-semibold shadow-xs' : 'text-zinc-600 hover:text-zinc-900 font-medium'
              }`}
            >
              Day 0 (Initial)
            </button>
            <button
              onClick={() => setActiveTab('day5')}
              className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${
                activeTab === 'day5' ? 'bg-zinc-900 text-white font-semibold shadow-xs' : 'text-zinc-600 hover:text-zinc-900 font-medium'
              }`}
            >
              Day 5 Follow-up
            </button>
            <button
              onClick={() => setActiveTab('day12')}
              className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${
                activeTab === 'day12' ? 'bg-zinc-900 text-white font-semibold shadow-xs' : 'text-zinc-600 hover:text-zinc-900 font-medium'
              }`}
            >
              Day 12 Final
            </button>
          </div>

          {/* Section 4B: Message Angle Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600">
              <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />
              <span>Outreach Angle</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
              {[
                { id: 'standard' as MessageAngle, label: 'Standard / Adaptive' },
                { id: 'founding' as MessageAngle, label: 'Founding 0→1 Ownership' },
                { id: 'ai_rag' as MessageAngle, label: 'Full Stack AI / RAG' },
                { id: 'product_ownership' as MessageAngle, label: 'Product & Autonomy' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleSwitchAngle(opt.id)}
                  className={`py-1.5 px-2.5 rounded-lg text-[11px] transition-all text-left truncate ${
                    selectedAngle === opt.id
                      ? 'bg-zinc-900 text-white font-semibold shadow-xs'
                      : 'bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 text-zinc-700 font-medium'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section 5: The Message Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span className="font-bold uppercase tracking-wider text-zinc-700">Generated Message</span>
              <span className={`text-[11px] font-medium ${wordCount >= 50 && wordCount <= 100 ? 'text-emerald-700 font-semibold' : 'text-zinc-500'}`}>
                {wordCount} words (Target: 50–100)
              </span>
            </div>

            <textarea
              value={message}
              onChange={(e) => handleMessageChange(e.target.value)}
              rows={5}
              className="w-full bg-zinc-50 text-zinc-900 text-xs sm:text-sm rounded-xl p-3.5 border border-zinc-200 focus:outline-none focus:border-zinc-400 focus:bg-white leading-relaxed font-sans shadow-2xs"
              placeholder="Draft your personalized message..."
            />
          </div>

          {/* Quick Action Button: Copy DM */}
          <div>
            <button
              onClick={handleCopy}
              className={`w-full py-3 px-3 rounded-xl active:scale-[0.98] text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-white'
              }`}
            >
              {copied ? <Check className="w-4 h-4 stroke-[3px]" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied to Clipboard ✓' : 'Copy DM to Clipboard'}</span>
            </button>
          </div>

          {/* Step 6: LinkedIn Handoff */}
          {copied && (
            <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs space-y-2 animate-in fade-in duration-200">
              <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>DM copied. Open LinkedIn and send it.</span>
              </div>
              <p className="text-[11px] text-zinc-500">
                Open recipient&apos;s LinkedIn page manually, paste your message, and hit send.
              </p>
              <button
                onClick={handleOpenLinkedIn}
                className="w-full py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open LinkedIn Profile</span>
              </button>
            </div>
          )}

          {!copied && (
            <button
              onClick={handleOpenLinkedIn}
              className="w-full py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 text-zinc-800 text-xs font-semibold border border-zinc-200 flex items-center justify-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
              <span>Open LinkedIn externally</span>
            </button>
          )}

          {/* Primary Bottom Action: Mark as Contacted */}
          <div className="pt-1">
            <button
              onClick={handleInitiateContacted}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all"
            >
              <Send className="w-4 h-4" />
              <span>Mark as Contacted</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Sub-Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 max-w-xs w-full shadow-2xl space-y-3.5 animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-zinc-900 text-center">
              Confirm Contact Log
            </h3>
            <p className="text-xs text-zinc-600 text-center leading-relaxed">
              Mark <span className="font-semibold text-zinc-900">{prospect.name}</span> as contacted?
            </p>
            <p className="text-[11px] text-zinc-400 text-center">
              This will update your CRM status and record the entry in your outreach log.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="py-2 rounded-xl bg-zinc-100 text-zinc-700 text-xs font-semibold hover:bg-zinc-200 transition-colors border border-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmContacted}
                disabled={isLogging}
                className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1 transition-all"
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
