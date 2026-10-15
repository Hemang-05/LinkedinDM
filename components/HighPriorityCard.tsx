'use client';

import React, { useState } from 'react';
import { Prospect } from '@/types';
import { Building2, Zap, ExternalLink, Check } from 'lucide-react';
import { getClientProfile, isProfileComplete, updateClientProspect } from '@/lib/clientStorage';
import { generatePersonalizedDM } from '@/lib/generator';
import { copyTextToClipboard, openLinkedInTab } from '@/lib/clipboard';

interface HighPriorityCardProps {
  prospect: Prospect;
  onReviewDM: (prospect: Prospect) => void;
}

export function HighPriorityCard({ prospect, onReviewDM }: HighPriorityCardProps) {
  const matchScore = prospect.score?.totalScore || 85;
  const hiringRole = prospect.jobOpportunity?.title || prospect.jobTitle;
  const company = prospect.company;
  const classification = prospect.classification || 'Founder';
  const [quickCopied, setQuickCopied] = useState(false);

  const isTopMatch = matchScore >= 90;

  const handleQuickCopyAndOpen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const prof = getClientProfile();
    if (!prof || !isProfileComplete(prof, 'job-hunt')) {
      onReviewDM(prospect);
      return;
    }

    const targetRole =
      prospect.jobOpportunity?.title && prospect.jobOpportunity.title !== prospect.jobTitle
        ? prospect.jobOpportunity.title
        : prof.targetRole || prof.targetRoles?.[0] || 'Software Engineer';

    try {
      const generated = generatePersonalizedDM(prospect, targetRole, 'standard', prof, 'job-hunt');
      const msg = generated.day0;
      openLinkedInTab(prospect.linkedinUrl, prospect.name, prospect.company);
      await copyTextToClipboard(msg);
      setQuickCopied(true);
      setTimeout(() => setQuickCopied(false), 2500);
      updateClientProspect(prospect.id, prospect.status, msg);
    } catch {
      onReviewDM(prospect);
    }
  };

  return (
    <div className="touch-card bg-white border border-[#E0DFDC] hover:border-[#0A66C2]/60 hover:shadow-md rounded-xl p-5 shadow-xs flex flex-col justify-between relative overflow-hidden group transition-all">
      <div>
        {/* Header row: Person & Match Badge */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-zinc-900 tracking-tight truncate group-hover:text-[#0A66C2] transition-colors">
              {prospect.name}
            </h3>
            <p className="text-xs text-zinc-500 flex items-center gap-1.5 mt-0.5 truncate">
              <span className="font-semibold text-zinc-700">{classification}</span>
              <span>·</span>
              <span className="flex items-center gap-1 text-zinc-500">
                <Building2 className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                <span className="truncate">{company}</span>
              </span>
            </p>
          </div>

          {/* Match Score Badge */}
          <div className={`flex flex-col items-end flex-shrink-0 px-2.5 py-1 rounded-xl border ${
            isTopMatch
              ? 'bg-[#057642]/10 border-[#057642]/20 text-[#057642]'
              : 'bg-[#F4F2EE] border-[#E0DFDC] text-zinc-800'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Match</span>
            <span className="text-sm font-black tracking-tight leading-none mt-0.5">
              {matchScore}%
            </span>
          </div>
        </div>

        {/* Hiring Opportunity */}
        <div className="bg-[#F4F2EE]/40 rounded-xl p-2.5 border border-[#E0DFDC] mb-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-700 mb-1">
            <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span>Target Role</span>
          </div>
          <p className="text-xs font-bold text-zinc-900 truncate">
            {hiringRole}
          </p>
          {prospect.jobOpportunity?.location && (
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {prospect.jobOpportunity.location} · {prospect.jobOpportunity.remoteStatus}
            </p>
          )}
        </div>

        {/* Strong matches pill preview */}
        {prospect.score?.strongMatches && prospect.score.strongMatches.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3.5">
            {prospect.score.strongMatches.slice(0, 4).map((tech) => (
              <span
                key={tech}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F4F2EE] text-zinc-700 border border-[#E0DFDC]"
              >
                ✓ {tech}
              </span>
            ))}
            {prospect.score.strongMatches.length > 4 && (
              <span className="text-[10px] text-zinc-400 py-0.5">
                +{prospect.score.strongMatches.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons: 1-Click Copy & Open + Review Modal */}
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={handleQuickCopyAndOpen}
          className="flex-1 py-2.5 px-3 rounded-xl bg-[#0A66C2] hover:bg-[#004182] active:scale-[0.98] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
          title="1-Click: Copy personalized DM and open LinkedIn Profile tab"
        >
          {quickCopied ? (
            <>
              <Check className="w-3.5 h-3.5 text-white" />
              <span>Copied & Opened!</span>
            </>
          ) : (
            <>
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Copy & Open Profile</span>
            </>
          )}
        </button>

        <button
          onClick={() => onReviewDM(prospect)}
          className="py-2.5 px-3.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer border border-zinc-200"
          title="Review all 3 sequence steps, angles, and prompt customization"
        >
          Review
        </button>
      </div>
    </div>
  );
}
