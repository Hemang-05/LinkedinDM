'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  FileText,
  Upload,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  Briefcase,
  Target,
  UserCheck,
  Laptop,
  Check,
  Sparkles
} from 'lucide-react';
import { Prospect } from '@/types';
import { getClientProfile, saveClientProfile } from '@/lib/clientStorage';

export type WorkflowType = 'job-hunt' | 'agency-leads' | 'hire' | 'freelancers';

interface WorkflowViewProps {
  workflow: WorkflowType;
  onBack: () => void;
  onImportComplete: (prospects: Prospect[]) => void;
  onOpenGuideModal: () => void;
}

export function WorkflowView({
  workflow,
  onBack,
  onImportComplete,
  onOpenGuideModal
}: WorkflowViewProps) {
  // State for secondary files (Resume / JD / Project brief)
  const [secondaryFile, setSecondaryFile] = useState<File | null>(null);
  const [targetSector, setTargetSector] = useState('');
  const [targetRole, setTargetRole] = useState(() => {
    if (typeof window !== 'undefined') {
      return getClientProfile().targetRole || 'Full Stack Engineer';
    }
    return 'Full Stack Engineer';
  });
  const [isCustomTargetRole, setIsCustomTargetRole] = useState(false);
  
  // CSV upload state
  const [isProcessing, setIsProcessing] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [skippedStudents, setSkippedStudents] = useState(0);

  const getWorkflowMeta = () => {
    switch (workflow) {
      case 'job-hunt':
        return {
          title: 'DM for Job Hunt',
          subtitle: 'Upload your resume and LinkedIn connections to generate personalized outreach to hiring managers and recruiters.',
          icon: Briefcase,
          secondaryLabel: 'Upload Your Resume',
          secondaryDesc: 'Upload your latest CV (.pdf, .docx, .txt) to extract your background & match relevant hiring leads.',
          acceptSecondary: '.pdf,.docx,.txt'
        };
      case 'agency-leads':
        return {
          title: 'DM for Agency Leads',
          subtitle: 'Reach decision-makers and founders in your target industry with high-converting agency pitches.',
          icon: Target,
          secondaryLabel: 'Target Sector / Industry',
          secondaryDesc: 'Specify target niche (e.g., B2B SaaS, E-commerce, FinTech, Agency Owners).',
          acceptSecondary: ''
        };
      case 'hire':
        return {
          title: 'DM to Hire',
          subtitle: 'Upload your Job Description (JD) and connections list to discover and message top candidates matching the role.',
          icon: UserCheck,
          secondaryLabel: 'Upload Job Description (JD)',
          secondaryDesc: 'Upload the job requirements document (.pdf, .docx, .txt) to match candidate titles and skill sets.',
          acceptSecondary: '.pdf,.docx,.txt'
        };
      case 'freelancers':
        return {
          title: 'DM to Get Freelancers',
          subtitle: 'Upload your project requirements to find verified freelance talent in your network.',
          icon: Laptop,
          secondaryLabel: 'Upload Project / Scope Description',
          secondaryDesc: 'Upload the project brief or role specifications (.pdf, .docx, .txt).',
          acceptSecondary: '.pdf,.docx,.txt'
        };
    }
  };

  const meta = getWorkflowMeta();
  const Icon = meta.icon;

  const handleSecondaryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSecondaryFile(file);
    }
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      setErrorMsg('');
    }
  };

  const handleContinue = async () => {
    if (!csvFile) {
      setErrorMsg('Please select your LinkedIn Connections CSV file to continue.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');
    setSuccessCount(null);

    try {
      const form = new FormData();
      form.append('file', csvFile);
      form.append('workflow', workflow);
      if (targetSector) form.append('targetSector', targetSector);

      if (workflow === 'job-hunt') {
        const prof = getClientProfile();
        saveClientProfile({ ...prof, targetRole });
        form.append('targetRole', targetRole);
      }

      const res = await fetch('/api/import-csv', { method: 'POST', body: form });

      const data = await res.json();
      if (data.success) {
        setSuccessCount(data.count);
        setSkippedStudents(data.skippedStudents || 0);
        setTimeout(() => {
          onImportComplete(data.prospects);
        }, 500);
      } else {
        setErrorMsg(data.error || 'Failed to process CSV file');
        setIsProcessing(false);
      }
    } catch (err) {
      console.error('CSV upload error:', err);
      setErrorMsg('Failed to read or upload file');
      setIsProcessing(false);
    }
  };

  const canContinue = Boolean(csvFile);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Back button */}
      <div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors py-1.5 px-2.5 rounded-lg hover:bg-zinc-200/60"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to all options</span>
        </button>
      </div>

      {/* Header banner */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-zinc-900 text-white flex items-center justify-center shrink-0">
          <Icon className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-bold text-zinc-900">{meta.title}</h2>
          <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">{meta.subtitle}</p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
          {errorMsg}
        </div>
      )}

      {successCount !== null && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Successfully processed {successCount} connections
            {skippedStudents > 0 ? ` (${skippedStudents} students/interns filtered out)` : ''}! Navigating to segregated view...
          </span>
        </div>
      )}

      {/* Inputs / Dropboxes Grid */}
      <div className="space-y-4">
        {/* Step 1: Secondary input (Resume, JD, or Sector) */}
        {workflow === 'agency-leads' ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Step 1</span>
              <h3 className="text-sm font-bold text-zinc-900 mt-0.5">Target Sector / Industry (Optional)</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Which sector or market are your agency leads in? (e.g. B2B SaaS, E-commerce, FinTech, Agency Owners)
              </p>
            </div>
            <input
              type="text"
              value={targetSector}
              onChange={(e) => setTargetSector(e.target.value)}
              placeholder="e.g. B2B SaaS, Agency Founders, Tech Startups"
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
            />
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Step 1</span>
                <h3 className="text-sm font-bold text-zinc-900 mt-0.5">{meta.secondaryLabel}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{meta.secondaryDesc}</p>
              </div>
              {secondaryFile && (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Selected</span>
                </span>
              )}
            </div>

            <label className="border-2 border-dashed border-zinc-300 hover:border-zinc-400 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer bg-zinc-50/50 hover:bg-zinc-100/50 transition-colors">
              <div className="w-10 h-10 rounded-full bg-zinc-200/80 flex items-center justify-center text-zinc-700 mb-2">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-zinc-800">
                {secondaryFile ? secondaryFile.name : `Select or drag ${meta.secondaryLabel.toLowerCase()} here`}
              </span>
              <span className="text-[10px] text-zinc-400 mt-1">Supports PDF, DOCX, or TXT</span>
              <input
                type="file"
                accept={meta.acceptSecondary}
                onChange={handleSecondaryFileChange}
                className="hidden"
              />
            </label>

            {workflow === 'job-hunt' && (
              <div className="pt-3 border-t border-zinc-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-zinc-700" />
                    <span className="text-xs font-bold text-zinc-900">
                      Target Role / Opportunity You Are Seeking
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCustomTargetRole(!isCustomTargetRole)}
                    className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 underline"
                  >
                    {isCustomTargetRole ? 'Choose preset' : 'Type custom'}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Prevents confusion between your goals and connections&apos; personal positions. Outreach will ask for referrals from employees, active openings from recruiters, and technical spots from founders.
                </p>

                {isCustomTargetRole ? (
                  <input
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    placeholder="e.g. Senior Full Stack Engineer"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 font-semibold focus:outline-none focus:border-zinc-400"
                  />
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {[
                      'Full Stack Engineer',
                      'Software Engineer',
                      'Frontend Engineer',
                      'Backend Engineer',
                      'AI Engineer',
                      'Founding Engineer'
                    ].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setTargetRole(r)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                          targetRole === r
                            ? 'bg-zinc-900 text-white shadow-xs'
                            : 'bg-zinc-100 text-zinc-700 border border-zinc-200 hover:bg-zinc-200/70'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Connections CSV Dropbox */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Step 2</span>
              <h3 className="text-sm font-bold text-zinc-900 mt-0.5">Upload LinkedIn Connections CSV</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Upload your Connections.csv file exported from LinkedIn to parse and segregate contacts.
              </p>
            </div>
            {csvFile && (
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Selected</span>
              </span>
            )}
          </div>

          <label className="border-2 border-dashed border-zinc-300 hover:border-zinc-500 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-zinc-50/50 hover:bg-zinc-100/50 transition-colors group">
            <div className="w-12 h-12 rounded-full bg-zinc-200/80 group-hover:bg-zinc-300/80 flex items-center justify-center text-zinc-700 mb-3 transition-colors">
              <Upload className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-zinc-900">
              {csvFile ? csvFile.name : 'Select or drag LinkedIn Connections CSV file here'}
            </span>
            <span className="text-[11px] text-zinc-500 mt-1">
              Accepts standard Connections.csv export
            </span>
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvFileChange}
              disabled={isProcessing}
              className="hidden"
            />
          </label>

          {/* Helper Guide Link at bottom */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 px-1">
            <button
              onClick={onOpenGuideModal}
              className="text-xs italic text-zinc-500 hover:text-zinc-900 flex items-center gap-1.5 transition-colors group"
            >
              <HelpCircle className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700" />
              <span>How to retrieve your LinkedIn Connections CSV file?</span>
              <ArrowRight className="w-3 h-3 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <span className="text-[11px] text-zinc-400">100% Client-Side Privacy</span>
          </div>
        </div>

        {/* Action Button: Next / Continue at Bottom Right */}
        <div className="flex items-center justify-end pt-2">
          <button
            onClick={handleContinue}
            disabled={!canContinue || isProcessing}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all ${
              canContinue && !isProcessing
                ? 'bg-zinc-900 hover:bg-zinc-800 text-white cursor-pointer active:scale-[0.98]'
                : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
            }`}
          >
            <span>{isProcessing ? 'Analyzing Connections...' : 'Continue to Next Step'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
