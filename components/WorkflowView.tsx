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
  User,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { Prospect, UserProfile } from '@/types';
import { getClientProfile, saveClientProfile, isProfileComplete } from '@/lib/clientStorage';
import { EMPTY_PROFILE } from '@/lib/profile';

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
  const existingProf = typeof window !== 'undefined' ? getClientProfile() : null;

  // Secondary file (Resume / JD / Project brief)
  const [secondaryFile, setSecondaryFile] = useState<File | null>(null);
  const [targetSector, setTargetSector] = useState('');

  // Editable Profile Form Fields
  const [candidateName, setCandidateName] = useState(existingProf?.name || '');
  const [targetRole, setTargetRole] = useState(existingProf?.targetRole || existingProf?.title || '');
  const [isCustomTargetRole, setIsCustomTargetRole] = useState(false);
  const [expYearsInput, setExpYearsInput] = useState(
    existingProf?.yearsOfExperience !== undefined ? String(existingProf.yearsOfExperience) : ''
  );
  const [skillsInput, setSkillsInput] = useState(existingProf?.skills?.join(', ') || '');
  const [domainInput, setDomainInput] = useState(existingProf?.background || '');
  const [agencySummaryInput, setAgencySummaryInput] = useState(existingProf?.agencyServiceSummary || '');
  const [agencyOfferingInput, setAgencyOfferingInput] = useState(existingProf?.agencyOffering || '');

  // Status flags
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [resumeParsed, setResumeParsed] = useState(false);
  const [isProfileConfirmed, setIsProfileConfirmed] = useState(() => isProfileComplete(existingProf, workflow));
  const [confirmErrorMsg, setConfirmErrorMsg] = useState('');

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
    setIsProfileConfirmed(false);
    setConfirmErrorMsg('');

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

          if (data.name) setCandidateName(data.name);
          if (data.targetRole) setTargetRole(data.targetRole);
          if (data.yearsOfExperience !== null && data.yearsOfExperience !== undefined) {
            setExpYearsInput(String(data.yearsOfExperience));
          } else {
            setExpYearsInput('');
          }
          if (data.skills?.length) {
            setSkillsInput(data.skills.join(', '));
          }
          if (data.domain || data.background) {
            setDomainInput(data.domain || data.background);
          }
        }
      } catch (err) {
        console.error('Failed to parse resume:', err);
        setErrorMsg('Failed to parse resume. Please enter your details below.');
      } finally {
        setIsParsingResume(false);
      }
    }
  };

  const handleConfirmProfile = () => {
    const trimmedName = candidateName.trim();
    const trimmedRole = targetRole.trim();
    const parsedExp = parseInt(expYearsInput, 10);
    const parsedSkills = skillsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const trimmedDomain = domainInput.trim();

    if (!trimmedName || trimmedName === 'Your Name') {
      setConfirmErrorMsg('Your name is required.');
      return;
    }
    if (!trimmedRole) {
      setConfirmErrorMsg('Target role is required.');
      return;
    }
    if (isNaN(parsedExp) || parsedExp < 0) {
      setConfirmErrorMsg('Years of experience must be a valid number (0 or higher).');
      return;
    }
    if (parsedSkills.length === 0) {
      setConfirmErrorMsg('At least one technical skill is required.');
      return;
    }
    if (!trimmedDomain) {
      setConfirmErrorMsg('Background or domain is required.');
      return;
    }
    if (workflow === 'agency-leads') {
      if (!agencySummaryInput.trim() || !agencyOfferingInput.trim()) {
        setConfirmErrorMsg('Agency service summary and offering are required for agency leads.');
        return;
      }
    }

    const confirmed: UserProfile = {
      ...EMPTY_PROFILE,
      name: trimmedName,
      title: trimmedRole,
      targetRole: trimmedRole,
      targetRoles: [trimmedRole],
      targetLocations: ['Remote'],
      skills: parsedSkills,
      primarySkills: parsedSkills.slice(0, 5),
      yearsOfExperience: parsedExp,
      background: trimmedDomain,
      bioSummary: `${trimmedRole} with ${parsedExp}+ years of experience in ${trimmedDomain}.`,
      relevantExperience: `Building and shipping production systems with ${parsedSkills.slice(0, 3).join(', ')}.`,
      agencyServiceSummary: agencySummaryInput.trim(),
      agencyOffering: agencyOfferingInput.trim()
    };

    saveClientProfile(confirmed);
    setIsProfileConfirmed(true);
    setConfirmErrorMsg('');
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

    const currentProf = getClientProfile();
    if (!currentProf || !isProfileComplete(currentProf, workflow)) {
      setErrorMsg('Please confirm and save your profile details before continuing.');
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

      if (currentProf.targetRole) form.append('targetRole', currentProf.targetRole);
      if (currentProf.name) form.append('senderName', currentProf.name);
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

  const currentProf = typeof window !== 'undefined' ? getClientProfile() : null;
  const isReadyToProceed = Boolean(csvFile && isProfileComplete(currentProf, workflow));

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
                <span className="font-semibold">Reading resume & detecting candidate background...</span>
              </div>
            )}
          </div>
        )}

        {/* Profile Confirmation Form Step */}
        <div className="bg-white border border-[#E0DFDC] rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E0DFDC] pb-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A66C2]">
                Profile Verification
              </span>
              <h3 className="text-sm font-bold text-zinc-900 mt-0.5">
                Confirm Your Details
              </h3>
              <p className="text-xs text-zinc-500">
                Messages will be generated strictly using these confirmed details.
              </p>
            </div>
            {isProfileConfirmed ? (
              <span className="text-xs font-semibold text-[#057642] bg-[#057642]/10 border border-[#057642]/20 px-3 py-1 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#057642]" />
                <span>Profile Confirmed</span>
              </span>
            ) : (
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Confirmation Required</span>
              </span>
            )}
          </div>

          {confirmErrorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {confirmErrorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-zinc-700 font-semibold mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={candidateName}
                onChange={(e) => {
                  setCandidateName(e.target.value);
                  setIsProfileConfirmed(false);
                }}
                placeholder="e.g. Alex Johnson"
                className="w-full bg-[#F4F2EE]/40 border border-[#E0DFDC] rounded-xl px-3 py-2 text-zinc-900 text-xs font-medium focus:outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
              />
            </div>

            <div>
              <label className="block text-zinc-700 font-semibold mb-1">
                Target Role / Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => {
                  setTargetRole(e.target.value);
                  setIsProfileConfirmed(false);
                }}
                placeholder="e.g. Senior Software Engineer"
                className="w-full bg-[#F4F2EE]/40 border border-[#E0DFDC] rounded-xl px-3 py-2 text-zinc-900 text-xs font-medium focus:outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
              />
            </div>

            <div>
              <label className="block text-zinc-700 font-semibold mb-1">
                Years of Experience <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                value={expYearsInput}
                onChange={(e) => {
                  setExpYearsInput(e.target.value);
                  setIsProfileConfirmed(false);
                }}
                placeholder="e.g. 4"
                className="w-full bg-[#F4F2EE]/40 border border-[#E0DFDC] rounded-xl px-3 py-2 text-zinc-900 text-xs font-medium focus:outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
              />
            </div>

            <div>
              <label className="block text-zinc-700 font-semibold mb-1">
                Background / Domain <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={domainInput}
                onChange={(e) => {
                  setDomainInput(e.target.value);
                  setIsProfileConfirmed(false);
                }}
                placeholder="e.g. B2B SaaS & Distributed Systems"
                className="w-full bg-[#F4F2EE]/40 border border-[#E0DFDC] rounded-xl px-3 py-2 text-zinc-900 text-xs font-medium focus:outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-zinc-700 font-semibold mb-1">
                Technical Skills (comma-separated) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={skillsInput}
                onChange={(e) => {
                  setSkillsInput(e.target.value);
                  setIsProfileConfirmed(false);
                }}
                placeholder="e.g. React, Next.js, TypeScript, Node.js, GraphQL"
                className="w-full bg-[#F4F2EE]/40 border border-[#E0DFDC] rounded-xl px-3 py-2 text-zinc-900 text-xs font-medium focus:outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
              />
            </div>

            {workflow === 'agency-leads' && (
              <>
                <div className="sm:col-span-2">
                  <label className="block text-zinc-700 font-semibold mb-1">
                    Agency Service Summary <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={agencySummaryInput}
                    onChange={(e) => {
                      setAgencySummaryInput(e.target.value);
                      setIsProfileConfirmed(false);
                    }}
                    placeholder="e.g. boutique engineering team helping startups build scalable web products"
                    className="w-full bg-[#F4F2EE]/40 border border-[#E0DFDC] rounded-xl px-3 py-2 text-zinc-900 text-xs font-medium focus:outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-zinc-700 font-semibold mb-1">
                    Agency Offering <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={agencyOfferingInput}
                    onChange={(e) => {
                      setAgencyOfferingInput(e.target.value);
                      setIsProfileConfirmed(false);
                    }}
                    placeholder="e.g. shipping production MVPs, feature roadmaps, and automation"
                    className="w-full bg-[#F4F2EE]/40 border border-[#E0DFDC] rounded-xl px-3 py-2 text-zinc-900 text-xs font-medium focus:outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
                  />
                </div>
              </>
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleConfirmProfile}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0A66C2] hover:bg-[#004182] text-white font-semibold text-xs shadow-xs transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Confirm & Save Profile</span>
            </button>
          </div>
        </div>

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
            disabled={!isReadyToProceed || isProcessing}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-xs sm:text-sm shadow-xs transition-all ${
              isReadyToProceed && !isProcessing
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
