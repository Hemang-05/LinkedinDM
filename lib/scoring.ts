import { Prospect, JobOpportunity, ScoreExplanation, ScoreBreakdownItem } from '@/types';
import { MY_PROFILE } from './profile';

export function calculateScoreAndMatching(
  prospect: Partial<Prospect>,
  job?: JobOpportunity
): ScoreExplanation {
  const items: ScoreBreakdownItem[] = [];
  const strongMatches: string[] = [];
  const gaps: string[] = [];
  const blockers: string[] = [];

  const effectiveJob = job || prospect.jobOpportunity;
  const roleText = `${effectiveJob?.title || prospect.jobTitle || ''}`.toLowerCase();
  const descText = `${effectiveJob?.description || ''} ${prospect.notes || ''} ${prospect.headline || ''}`.toLowerCase();
  const locationText = `${effectiveJob?.location || prospect.location || ''} ${effectiveJob?.remoteStatus || ''}`.toLowerCase();

  // 1. Role Match (+25 points)
  let roleMatch = false;
  let roleReason = 'Target role mismatch';
  for (const targetRole of MY_PROFILE.targetRoles) {
    if (roleText.includes(targetRole.toLowerCase())) {
      roleMatch = true;
      roleReason = `Matches target role: "${targetRole}"`;
      break;
    }
  }
  if (!roleMatch && (roleText.includes('engineer') || roleText.includes('developer'))) {
    roleMatch = true;
    roleReason = 'Software engineering role alignment';
  }
  items.push({
    category: 'Role Match',
    points: roleMatch ? 25 : 0,
    maxPoints: 25,
    matched: roleMatch,
    reason: roleReason
  });

  // 2. Stack Match (+20 points)
  const stackMatches: string[] = [];
  const knownProfileSkills = [
    { name: 'React', patterns: ['react'] },
    { name: 'Next.js', patterns: ['next.js', 'nextjs'] },
    { name: 'TypeScript', patterns: ['typescript', 'ts'] },
    { name: 'Python', patterns: ['python'] },
    { name: 'FastAPI', patterns: ['fastapi'] },
    { name: 'PostgreSQL', patterns: ['postgresql', 'postgres'] },
    { name: 'LLM/RAG', patterns: ['llm', 'rag', 'genai', 'langchain', 'openai', 'agents'] },
    { name: 'Docker', patterns: ['docker', 'containers'] }
  ];

  for (const skill of knownProfileSkills) {
    if (skill.patterns.some(p => descText.includes(p) || roleText.includes(p))) {
      stackMatches.push(skill.name);
      strongMatches.push(skill.name);
    }
  }

  // Check required skills list if provided
  if (effectiveJob?.requiredSkills && effectiveJob.requiredSkills.length > 0) {
    for (const req of effectiveJob.requiredSkills) {
      const isKnown = knownProfileSkills.some(k =>
        k.patterns.some(p => req.toLowerCase().includes(p))
      );
      if (!isKnown && !strongMatches.includes(req)) {
        gaps.push(req);
      }
    }
  }

  const stackMatched = stackMatches.length >= 2;
  const stackPoints = stackMatched
    ? Math.min(20, Math.max(10, stackMatches.length * 4))
    : stackMatches.length > 0 ? 10 : 0;

  items.push({
    category: 'Stack Match',
    points: stackPoints,
    maxPoints: 20,
    matched: stackPoints > 0,
    reason: stackMatches.length > 0
      ? `Overlapping stack: ${stackMatches.join(', ')}`
      : 'General engineering stack overlap'
  });

  // 3. Remote India Eligibility (+20 points)
  const isRemoteIndia =
    locationText.includes('remote') ||
    locationText.includes('india') ||
    locationText.includes('anywhere') ||
    locationText.includes('worldwide') ||
    effectiveJob?.remoteStatus === 'Remote India' ||
    effectiveJob?.remoteStatus === 'Remote Worldwide';

  const isHardUSBlocker =
    (locationText.includes('us only') || locationText.includes('us citizen') || locationText.includes('on-site new york') || locationText.includes('on-site sf')) &&
    !isRemoteIndia;

  if (isHardUSBlocker) {
    blockers.push('Strict non-India location requirement detected');
  }

  items.push({
    category: 'Remote India',
    points: isRemoteIndia ? 20 : 5,
    maxPoints: 20,
    matched: isRemoteIndia,
    reason: isRemoteIndia ? 'Remote India or Worldwide eligible' : 'Location flexibility needs verification'
  });

  // 4. Experience Match (+15 points)
  let expPoints = 15;
  let expReason = 'Profile experience (3+ years) matches mid/senior range';
  const minYears = effectiveJob?.minExperienceYears || 3;
  if (minYears > 6) {
    expPoints = 5;
    expReason = `Requires ${minYears}+ years experience (Profile has 3+ yrs)`;
    gaps.push(`${minYears}+ years min experience requirement`);
  } else if (minYears <= 4) {
    expPoints = 15;
    expReason = 'Ideal alignment for 3+ years experience';
  }
  items.push({
    category: 'Experience Match',
    points: expPoints,
    maxPoints: 15,
    matched: expPoints >= 10,
    reason: expReason
  });

  // 5. Founder / CTO / Decision Maker (+10 points)
  const isDecisionMaker =
    prospect.classification === 'Founder' ||
    prospect.classification === 'Co-founder' ||
    prospect.classification === 'CEO' ||
    prospect.classification === 'CTO' ||
    prospect.classification === 'Engineering Manager' ||
    prospect.relationshipType === 'CEO' ||
    prospect.relationshipType === 'Founder' ||
    prospect.relationshipType === 'CTO';

  items.push({
    category: 'Founder / CTO / Decision Maker',
    points: isDecisionMaker ? 10 : 5,
    maxPoints: 10,
    matched: isDecisionMaker,
    reason: isDecisionMaker
      ? `${prospect.classification || prospect.relationshipType || 'Decision Maker'} with direct hiring influence`
      : 'Team member or recruiter path'
  });

  // 6. Recent Hiring Signal (+10 points)
  const hasHiringSignal =
    (effectiveJob && effectiveJob.hiringSignals && effectiveJob.hiringSignals.length > 0) ||
    descText.includes("we're hiring") ||
    descText.includes('we are hiring') ||
    descText.includes('looking for') ||
    descText.includes('open roles') ||
    Boolean(effectiveJob?.title);

  items.push({
    category: 'Recent Hiring Signal',
    points: hasHiringSignal ? 10 : 2,
    maxPoints: 10,
    matched: hasHiringSignal,
    reason: hasHiringSignal
      ? 'Active hiring post or verified engineering opening'
      : 'Opportunistic network connection'
  });

  // Default common gap if none identified
  if (gaps.length === 0 && descText.includes('langgraph')) {
    gaps.push('LangGraph');
  }
  if (gaps.length === 0 && descText.includes('kubernetes')) {
    gaps.push('Kubernetes');
  }

  // Calculate sum
  const totalScore = items.reduce((acc, curr) => acc + curr.points, 0);

  // Recommended Action
  let recommendedAction = 'Standard Outreach';
  if (blockers.length > 0) {
    recommendedAction = 'Low Priority - Review Blockers';
  } else if (totalScore >= 80 && isDecisionMaker) {
    recommendedAction = 'High Priority - Immediate Direct Outreach';
  } else if (totalScore >= 70) {
    recommendedAction = 'Recommended Outreach';
  }

  return {
    totalScore,
    items,
    strongMatches: Array.from(new Set(strongMatches.length > 0 ? strongMatches : ['React', 'Next.js', 'Python', 'FastAPI'])),
    gaps: Array.from(new Set(gaps)),
    blockers,
    recommendedAction
  };
}
