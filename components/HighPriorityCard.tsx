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

  // Badge color based on match score
  const isTopMatch = matchScore >= 90;

  return (
    <div className="touch-card bg-[#111827] border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 shadow-lg shadow-black/20 flex flex-col justify-between relative overflow-hidden group">
      {/* Glow highlight for top match */}
      {isTopMatch && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
      )}

      <div>
        {/* Header row: Person & Match Badge */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white tracking-tight truncate group-hover:text-indigo-300 transition-colors">
              {prospect.name}
            </h3>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
              <span className="font-medium text-slate-300">{classification}</span>
              <span>·</span>
              <span className="flex items-center gap-1 text-slate-400">
                <Building2 className="w-3 h-3 text-slate-500 flex-shrink-0" />
                <span className="truncate">{company}</span>
              </span>
            </p>
          </div>

          {/* Match Score Badge */}
          <div className={`flex flex-col items-end flex-shrink-0 px-2.5 py-1 rounded-xl border ${
            isTopMatch
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
          }`}>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Match</span>
            <span className="text-sm font-extrabold tracking-tight leading-none mt-0.5">
              {matchScore}%
            </span>
          </div>
        </div>

        {/* Hiring Opportunity */}
        <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800/80 mb-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-300 mb-1">
            <Zap className="w-3 h-3 text-amber-400 flex-shrink-0" />
            <span>Hiring</span>
          </div>
          <p className="text-xs font-semibold text-slate-200 truncate">
            {hiringRole}
          </p>
          {prospect.jobOpportunity?.location && (
            <p className="text-[10px] text-slate-400 mt-0.5">
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
                className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/50"
              >
                ✓ {tech}
              </span>
            ))}
            {prospect.score.strongMatches.length > 4 && (
              <span className="text-[10px] text-slate-500 py-0.5">
                +{prospect.score.strongMatches.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Primary Mobile CTA Button */}
      <button
        onClick={() => onReviewDM(prospect)}
        className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>Review DM</span>
        <ChevronRight className="w-3.5 h-3.5 ml-auto text-indigo-200" />
      </button>
    </div>
  );
}
