'use client';

import React from 'react';
import { Prospect } from '@/types';
import { Sparkles, Building2, ChevronRight, Zap } from 'lucide-react';

interface HighPriorityCardProps {
  prospect: Prospect;
  onReviewDM: (prospect: Prospect) => void;
}

export function HighPriorityCard({ prospect, onReviewDM }: HighPriorityCardProps) {
  const matchScore = prospect.score?.totalScore || 85;
  const hiringRole = prospect.jobOpportunity?.title || prospect.jobTitle;
  const company = prospect.company;
  const classification = prospect.classification || 'Founder';

  const isTopMatch = matchScore >= 90;

  return (
    <div className="touch-card bg-white border border-zinc-200/90 hover:border-zinc-300 rounded-2xl p-4.5 shadow-sm flex flex-col justify-between relative overflow-hidden group transition-all">
      <div>
        {/* Header row: Person & Match Badge */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-zinc-900 tracking-tight truncate group-hover:text-zinc-700 transition-colors">
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
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-zinc-100 border-zinc-200 text-zinc-800'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Match</span>
            <span className="text-sm font-black tracking-tight leading-none mt-0.5">
              {matchScore}%
            </span>
          </div>
        </div>

        {/* Hiring Opportunity */}
        <div className="bg-zinc-50 rounded-xl p-2.5 border border-zinc-200/80 mb-3">
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
                className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 border border-zinc-200"
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

      {/* Primary CTA Button */}
      <button
        onClick={() => onReviewDM(prospect)}
        className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:scale-[0.98] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>Review DM</span>
        <ChevronRight className="w-3.5 h-3.5 ml-auto text-zinc-400" />
      </button>
    </div>
  );
}
