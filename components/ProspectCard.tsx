'use client';

import React, { useState } from 'react';
import { Prospect } from '@/types';
import { Building2, MapPin, Sparkles, ExternalLink, Check } from 'lucide-react';
import { getClientProfile, isProfileComplete, updateClientProspect } from '@/lib/clientStorage';
import { generatePersonalizedDM } from '@/lib/generator';
import { copyTextToClipboard, openLinkedInTab } from '@/lib/clipboard';

interface ProspectCardProps {
  prospect: Prospect;
  onSelect: (prospect: Prospect) => void;
}

export function ProspectCard({ prospect, onSelect }: ProspectCardProps) {
  const matchScore = prospect.score?.totalScore || 70;
  const isContacted = prospect.status === 'Contacted';
  const [quickCopied, setQuickCopied] = useState(false);

  const statusColors: Record<string, string> = {
    'Not contacted': 'bg-[#F4F2EE] text-zinc-600 border-[#E0DFDC]',
    'Message drafted': 'bg-[#EBF3FB] text-[#0A66C2] border-[#C2E0F9]',
    'Approved': 'bg-amber-50 text-amber-700 border-amber-200',
    'Contacted': 'bg-[#057642]/10 text-[#057642] border-[#057642]/20',
    'Replied': 'bg-purple-50 text-purple-700 border-purple-200',
    'Interested': 'bg-[#057642]/10 text-[#057642] border-[#057642]/20',
    'Interview': 'bg-pink-50 text-pink-700 border-pink-200',
  };

  const statusClass = statusColors[prospect.status] || 'bg-[#F4F2EE] text-zinc-600 border-[#E0DFDC]';

  const handleQuickCopyAndOpen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const prof = getClientProfile();
    if (!prof || !isProfileComplete(prof, 'job-hunt')) {
      onSelect(prospect);
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
      onSelect(prospect);
    }
  };

  return (
    <div
      onClick={() => onSelect(prospect)}
      className="touch-card bg-white border border-[#E0DFDC] hover:border-[#0A66C2]/60 hover:shadow-md rounded-xl p-5 shadow-xs cursor-pointer flex flex-col justify-between transition-all group"
    >
      <div>
        <div className="flex items-start justify-between gap-2.5 mb-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h4 className="text-sm sm:text-base font-bold text-zinc-900 group-hover:text-[#0A66C2] tracking-tight break-words transition-colors">
                {prospect.name}
              </h4>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F4F2EE] text-zinc-700 border border-[#E0DFDC] shrink-0">
                {prospect.classification}
              </span>
            </div>
            <p className="text-xs text-zinc-600 font-medium line-clamp-2 mt-1 break-words">
              {prospect.jobTitle}
            </p>
            <p className="text-xs text-zinc-500 flex items-center gap-1.5 mt-1">
              <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="font-semibold text-zinc-700 break-words">{prospect.company}</span>
            </p>
          </div>

          <div className="flex flex-col items-end shrink-0">
            <span className="text-xs font-bold text-[#057642] bg-[#057642]/10 border border-[#057642]/20 px-2.5 py-0.5 rounded-full">
              {matchScore}%
            </span>
          </div>
        </div>

        {/* Location & Remote */}
        {prospect.location && (
          <div className="flex items-center gap-2 text-[11px] text-zinc-500 mb-2.5">
            <span className="flex items-center gap-1 break-words">
              <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span>{prospect.location}</span>
            </span>
          </div>
        )}

        {/* Hiring summary if exists */}
        {prospect.jobOpportunity && (
          <div className="text-[11px] bg-[#F4F2EE]/40 rounded-lg p-2 border border-[#E0DFDC] mb-2.5 text-zinc-700">
            <span className="text-zinc-900 font-bold">Target Role: </span>
            {prospect.jobOpportunity.title}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-3.5 border-t border-[#E0DFDC] mt-3.5">
        <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${statusClass}`}>
          {prospect.status}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleQuickCopyAndOpen}
            title="1-Click: Copy personalized message & open LinkedIn profile"
            className="text-xs bg-[#0A66C2] hover:bg-[#004182] text-white px-3 py-1.5 rounded-full font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
          >
            {quickCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Copied & Opened!</span>
              </>
            ) : (
              <>
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Copy & Open</span>
              </>
            )}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(prospect);
            }}
            title="Review full sequence and customization"
            className="text-xs text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 border border-zinc-200 px-2.5 py-1.5 rounded-full font-medium transition-colors cursor-pointer"
          >
            {isContacted ? 'Outreach' : 'Review'}
          </button>
        </div>
      </div>
    </div>
  );
}
