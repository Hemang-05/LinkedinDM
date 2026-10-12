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
  Sparkles,
  Loader2,
  User
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

  // Candidate name state (extracted from resume or custom)
  const [candidateName, setCandidateName] = useState(() => {
    if (typeof window !== 'undefined') {
      return getClientProfile().name || '';
    }
    return '';
  });
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [resumeParsed, setResumeParsed] = useState(false);
  const [detectedSkills, setDetectedSkills] = useState<string[]>([]);
  const [detectedDomain, setDetectedDomain] = useState<string>('');
  const [detectedExp, setDetectedExp] = useState<number | null>(null);
  
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

  const handleSecondaryFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSecondaryFile(file);

    // If job-hunt workflow (or any resume upload), immediately parse file to extract candidate name & role
    if (workflow === 'job-hunt') {
      setIsParsingResume(true);
      setErrorMsg('');

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/parse-resume', {
          method: 'POST',
          body: formData
        });

        const data = await res.json();
        if (data.success) {
          setResumeParsed(true);
          const currentProf = getClientProfile();

          if (data.name) setCandidateName(data.name);
          if (data.skills?.length) setDetectedSkills(data.skills);
          if (data.domain || data.background) setDetectedDomain(data.domain || data.background);
          if (data.yearsOfExperience) setDetectedExp(data.yearsOfExperience);
          if (data.targetRole && !isCustomTargetRole) setTargetRole(data.targetRole);

          // Persist the full extracted candidate profile so DM generator tailors to their exact background
          const updatedProf = {
            ...currentProf,
            name: data.name || candidateName || currentProf.name,
            title: data.targetRole || currentProf.title || 'Software Engineer',
            targetRole: data.targetRole || currentProf.targetRole || targetRole,
            targetRoles: [data.targetRole || currentProf.targetRole || targetRole],
            skills: data.skills && data.skills.length > 0 ? data.skills : currentProf.skills,
            primarySkills: data.primarySkills && data.primarySkills.length > 0 ? data.primarySkills : (data.skills?.slice(0, 5) || currentProf.skills),
            yearsOfExperience: data.yearsOfExperience ?? currentProf.yearsOfExperience ?? 3,
            background: data.background || data.domain || currentProf.background,
            bioSummary: data.bioSummary || currentProf.bioSummary,
            relevantExperience: data.relevantExperience || currentProf.relevantExperience
          };
          saveClientProfile(updatedProf);
        }
      } catch (err) {
        console.error('Failed to parse resume:', err);
      } finally {
        setIsParsingResume(false);
      }
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

      // Persist and send candidate name & target role
      const prof = getClientProfile();
      const effectiveName = candidateName?.trim() || prof.name;
      const effectiveRole = targetRole || prof.targetRole;

      saveClientProfile({
        ...prof,
        name: effectiveName,
        targetRole: effectiveRole
      });

      if (effectiveRole) form.append('targetRole', effectiveRole);
      if (effectiveName) form.append('senderName', effectiveName);
      if (secondaryFile) form.append('resumeFile', secondaryFile);

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
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-[#0A66C2] hover:bg-[#0A66C2]/10 transition-colors py-1.5 px-3 rounded-full"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to all options</span>
        </button>
      </div>

      {/* Header banner */}
      <div className="bg-white border border-[#E0DFDC] rounded-xl p-6 shadow-xs flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#0A66C2] text-white flex items-center justify-center shrink-0 shadow-xs">
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
          <div className="bg-white border border-[#E0DFDC] rounded-xl p-6 shadow-xs space-y-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A66C2]">Step 1</span>
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
              className="w-full bg-[#F4F2EE]/40 border border-[#E0DFDC] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2] transition-colors"
            />
          </div>
        ) : (
          <div className="bg-white border border-[#E0DFDC] rounded-xl p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A66C2]">Step 1</span>
                <h3 className="text-sm font-bold text-zinc-900 mt-0.5">{meta.secondaryLabel}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{meta.secondaryDesc}</p>
              </div>
              {secondaryFile && (
                <span className="text-xs font-semibold text-[#057642] bg-[#057642]/10 border border-[#057642]/20 px-3 py-1 rounded-full flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Selected</span>
                </span>
              )}
            </div>

            <label className="border-2 border-dashed border-[#E0DFDC] hover:border-[#0A66C2] rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-[#F4F2EE]/30 hover:bg-[#F4F2EE]/70 transition-colors group">
              <div className="w-10 h-10 rounded-full bg-[#EBF3FB] group-hover:bg-[#0A66C2] flex items-center justify-center text-[#0A66C2] group-hover:text-white mb-2 transition-colors">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-zinc-800">
                {secondaryFile ? secondaryFile.name : `Select or drag ${meta.secondaryLabel.toLowerCase()} here`}
              </span>
              <span className="text-[10px] text-zinc-500 mt-1">Supports PDF, DOCX, or TXT</span>
              <input
                type="file"
                accept={meta.acceptSecondary}
                onChange={handleSecondaryFileChange}
                className="hidden"
              />
            </label>

            {/* Resume Parsing Indicator */}
            {isParsingResume && (
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center gap-2.5 text-xs text-[#0A66C2] animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-[#0A66C2]" />
                <span className="font-semibold">Reading resume & detecting candidate name...</span>
              </div>
            )}

            {/* Candidate Name Card for DM Sign-off */}
            {workflow === 'job-hunt' && (
              <div className="p-3.5 bg-[#F4F2EE]/40 border border-[#E0DFDC] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#0A66C2]" />
                    <span className="text-xs font-bold text-zinc-900">
                      Candidate Name (Used in DM Signature)
                    </span>
                  </div>
                  {resumeParsed && candidateName ? (
                    <span className="text-[11px] font-semibold text-[#057642] bg-[#057642]/10 border border-[#057642]/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>Extracted from Resume</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-400">Signs custom DMs</span>
                  )}
                </div>
                <input
                  type="text"
                  value={candidateName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCandidateName(val);
                    const currentProf = getClientProfile();
                    saveClientProfile({ ...currentProf, name: val });
                  }}
                  placeholder="Your Full Name (e.g. Alex Johnson)"
                  className="w-full bg-white border border-[#E0DFDC] rounded-xl px-3 py-2 text-xs font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2] transition-colors"
                />
                <p className="text-[11px] text-zinc-500">
                  Outreach messages will sign off as: <strong className="text-zinc-800">Best, {candidateName || 'Your Name'}</strong>
                </p>

                {resumeParsed && (detectedSkills.length > 0 || detectedDomain) && (
                  <div className="pt-2 border-t border-[#E0DFDC]/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#0A66C2] flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span>Resume Intelligence Active</span>
                      </span>
                      {detectedDomain && (
                        <span className="text-[10px] font-semibold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full">
                          {detectedDomain}
                        </span>
                      )}
                    </div>
                    {detectedSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {detectedSkills.slice(0, 6).map((sk) => (
                          <span
                            key={sk}
                            className="text-[10px] font-semibold bg-white text-zinc-700 border border-[#E0DFDC] px-2 py-0.5 rounded-md"
                          >
                            {sk}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-zinc-500">
                      Outreach messages will be tailored specifically to your {detectedDomain || 'background'} and your {detectedSkills.slice(0, 3).join(', ')} skillset.
                    </p>
                  </div>
                )}
              </div>
            )}

            {workflow === 'job-hunt' && (
              <div className="pt-3 border-t border-[#E0DFDC] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-[#0A66C2]" />
                    <span className="text-xs font-bold text-zinc-900">
                      Target Role / Opportunity You Are Seeking
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCustomTargetRole(!isCustomTargetRole)}
                    className="text-[11px] font-semibold text-[#0A66C2] hover:underline"
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
                    className="w-full bg-[#F4F2EE]/40 border border-[#E0DFDC] rounded-xl px-3 py-2 text-xs text-zinc-900 font-semibold focus:outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
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
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                          targetRole === r
                            ? 'bg-[#0A66C2] text-white shadow-xs'
                            : 'bg-white text-zinc-700 border border-[#E0DFDC] hover:border-[#0A66C2] hover:text-[#0A66C2]'
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
        <div className="bg-white border border-[#E0DFDC] rounded-xl p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A66C2]">Step 2</span>
              <h3 className="text-sm font-bold text-zinc-900 mt-0.5">Upload LinkedIn Connections CSV</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Upload your Connections.csv file exported from LinkedIn to parse and segregate contacts.
              </p>
            </div>
            {csvFile && (
              <span className="text-xs font-semibold text-[#057642] bg-[#057642]/10 border border-[#057642]/20 px-3 py-1 rounded-full flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Selected</span>
              </span>
            )}
          </div>

          <label className="border-2 border-dashed border-[#E0DFDC] hover:border-[#0A66C2] rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer bg-[#F4F2EE]/30 hover:bg-[#F4F2EE]/70 transition-colors group">
            <div className="w-12 h-12 rounded-full bg-[#EBF3FB] group-hover:bg-[#0A66C2] flex items-center justify-center text-[#0A66C2] group-hover:text-white mb-3 transition-colors">
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
              className="text-xs text-zinc-600 hover:text-[#0A66C2] flex items-center gap-1.5 transition-colors group"
            >
              <HelpCircle className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#0A66C2]" />
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
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-xs sm:text-sm shadow-xs transition-all ${
              canContinue && !isProcessing
                ? 'bg-[#0A66C2] hover:bg-[#004182] text-white cursor-pointer active:scale-[0.98]'
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
