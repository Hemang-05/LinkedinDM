import { Prospect, JobOpportunity, ScoreExplanation, ScoreBreakdownItem, UserProfile } from '@/types';

// Built once at module load as default fallback
const KNOWN_PROFILE_SKILLS = [
  { name: 'React', patterns: ['react'] },
  { name: 'Next.js', patterns: ['next.js', 'nextjs'] },
  { name: 'TypeScript', patterns: ['typescript', 'ts'] },
  { name: 'Python', patterns: ['python'] },
  { name: 'FastAPI', patterns: ['fastapi'] },
  { name: 'PostgreSQL', patterns: ['postgresql', 'postgres'] },
  { name: 'LLM/RAG', patterns: ['llm', 'rag', 'genai', 'langchain', 'openai', 'agents'] },
  { name: 'Docker', patterns: ['docker', 'containers'] }
] as const;

const DEFAULT_TARGET_ROLES = [
  'Software Engineer',
  'Full Stack Engineer',
  'Frontend Engineer',
  'Backend Engineer',
  'Product Engineer',
  'Developer'
];

export function calculateScoreAndMatching(
  prospect: Partial<Prospect>,
  job?: JobOpportunity,
  userProfile?: UserProfile | null
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
  const rolesToMatch = userProfile?.targetRoles && userProfile.targetRoles.length > 0
    ? userProfile.targetRoles
    : DEFAULT_TARGET_ROLES;
  const targetRolesLower = rolesToMatch.map((r) => ({ raw: r, lower: r.toLowerCase() }));

  for (const targetRole of targetRolesLower) {
    if (roleText.includes(targetRole.lower)) {
      roleMatch = true;
      roleReason = `Matches target role: "${targetRole.raw}"`;
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
  const knownProfileSkills = userProfile?.skills && userProfile.skills.length > 0
    ? userProfile.skills.map(s => ({ name: s, patterns: [s.toLowerCase()] }))
    : KNOWN_PROFILE_SKILLS;

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

  // 3. Location Alignment (+20 points)
  const locPref = userProfile?.locationPreference || 'any';
  const prefLoc = (userProfile?.preferredLocation || '').trim().toLowerCase();
  let locPoints = 15;
  let locReason = 'Flexible location compatibility';

  const isRemoteEligible =
    locationText.includes('remote') ||
    locationText.includes('anywhere') ||
    locationText.includes('worldwide') ||
    effectiveJob?.remoteStatus === 'Remote Worldwide' ||
    Boolean(effectiveJob?.remoteStatus?.toLowerCase().includes('remote'));

  if (locPref === 'remote') {
    if (isRemoteEligible) {
      locPoints = 20;
      locReason = 'Matches remote-only preference';
    } else if (locationText.includes('hybrid')) {
      locPoints = 10;
      locReason = 'Hybrid role; remote flexibility required';
    } else if (locationText.includes('on-site') || locationText.includes('onsite')) {
      locPoints = 5;
      locReason = 'Strict on-site role conflicts with remote-only preference';
      blockers.push('Strict on-site requirement conflicts with remote-only preference');
    } else {
      locPoints = 15;
      locReason = 'Location flexibility to be confirmed';
    }
  } else if (locPref === 'country_city' && prefLoc) {
    if (locationText.includes(prefLoc)) {
      locPoints = 20;
      locReason = `Matches preferred location: "${userProfile?.preferredLocation}"`;
    } else if (isRemoteEligible) {
      locPoints = 15;
      locReason = `Remote position compatible with "${userProfile?.preferredLocation}"`;
    } else {
      locPoints = 5;
      locReason = `Location "${effectiveJob?.location || prospect.location || 'Unknown'}" differs from preferred "${userProfile?.preferredLocation}"`;
      gaps.push(`Location outside preferred target (${userProfile?.preferredLocation})`);
    }
  } else {
    // 'any' location preference
    locPoints = isRemoteEligible ? 20 : 18;
    locReason = isRemoteEligible ? 'Remote / worldwide location alignment' : 'General location alignment';
  }

  items.push({
    category: 'Location Alignment',
    points: locPoints,
    maxPoints: 20,
    matched: locPoints >= 10,
    reason: locReason
  });

  // 4. Experience Match (+15 points)
  const userYears = userProfile?.yearsOfExperience;
  const minYears = effectiveJob?.minExperienceYears || 3;
  let expPoints = 15;
  let expReason = userYears !== undefined
    ? `Profile experience (${userYears}+ years) matches requirements`
    : 'Experience alignment for role';

  if (userYears !== undefined) {
    if (minYears > userYears + 3) {
      expPoints = 5;
      expReason = `Requires ${minYears}+ years experience (Profile has ${userYears}+ yrs)`;
      gaps.push(`${minYears}+ years min experience requirement`);
    } else if (minYears <= userYears + 1) {
      expPoints = 15;
      expReason = `Ideal alignment for ${userYears}+ years experience`;
    }
  } else {
    if (minYears > 6) {
      expPoints = 5;
      expReason = `Requires ${minYears}+ years experience`;
      gaps.push(`${minYears}+ years min experience requirement`);
    } else {
      expPoints = 15;
      expReason = 'Matches role experience expectations';
    }
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
    strongMatches: Array.from(new Set(strongMatches.length > 0 ? strongMatches : (userProfile?.skills?.slice(0, 4) || []))),
    gaps: Array.from(new Set(gaps)),
    blockers,
    recommendedAction
  };
}
