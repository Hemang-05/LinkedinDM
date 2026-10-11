import type { Prospect, JobOpportunity, UserProfile, OutreachGoal, PersonaType } from '@/types';
import { DEFAULT_PROFILE } from './profile';
import { resolveProspectPersona } from './classifier';

export type MessageAngle = 'standard' | 'founding' | 'ai_rag' | 'product_ownership';

export interface MessageContext {
  firstName: string;
  senderName: string;
  companyName: string;
  hasSpecificCompany: boolean;
  prospectTitle: string;
  targetRole: string;
  expYears: number;
  expText: string;
  primaryStack: string;
  shortStack: string;
  agencySummary: string;
  agencyOffering: string;
  persona: PersonaType;
  goal: OutreachGoal;
  angle: MessageAngle;
}

export interface QualityIssue {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface MessageValidationResult {
  isValid: boolean;
  wordCount: number;
  targetRange: string;
  hasGreetingName: boolean;
  issues: QualityIssue[];
}

export interface GeneratedSequence {
  day0: string;
  day5: string;
  day12: string;
  persona: PersonaType;
  goal: OutreachGoal;
  angle: MessageAngle;
  validation: MessageValidationResult;
}

// Banned generic AI clichés
const BANNED_AI_PHRASES = [
  'hope this message finds you well',
  'impressive profile',
  'align perfectly',
  'leverage my expertise',
  'potential synergies',
  'confident that',
  'thrilled to',
  'remarkable journey',
  'esteemed organization',
  'reach out and connect',
  'let me know if there are any opportunities',
  'myself ',
  'pushed to the highest level',
  'in these unprecedented times'
];

// Unsupported claims to prevent hallucinations
const UNSUPPORTED_CLAIMS = [
  'following your company for years',
  'saw your recent post',
  'loved your recent launch',
  'recently raised',
  'impressed by your growth'
];

/**
 * Clean and extract first name without honorifics or emojis
 */
export function sanitizeFirstName(rawName?: string): string {
  if (!rawName) return 'there';
  const cleaned = rawName
    .replace(/^(mr|mrs|ms|dr|prof)\.?\s+/i, '')
    .replace(/[^a-zA-Z\s'-]/g, '')
    .trim();
  const first = cleaned.split(/\s+/)[0];
  if (!first || first.length < 2) return 'there';
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/**
 * Clean company name, stripping legal suffixes (Inc., LLC, Pvt Ltd, etc.)
 */
export function sanitizeCompanyName(rawCompany?: string): { clean: string; isGeneric: boolean } {
  if (!rawCompany) return { clean: 'your team', isGeneric: true };
  const lower = rawCompany.trim().toLowerCase();
  if (
    !lower ||
    lower === 'self-employed' ||
    lower === 'freelance' ||
    lower === 'stealth' ||
    lower === 'confidential' ||
    lower === 'unknown' ||
    lower === 'n/a'
  ) {
    return { clean: 'your team', isGeneric: true };
  }

  const cleaned = rawCompany
    .replace(/,?\s*(inc\.?|llc\.?|ltd\.?|pvt\.?\s*ltd\.?|private limited|corporation|corp\.?|gmbh|co\.?)$/i, '')
    .trim();

  return { clean: cleaned || 'your team', isGeneric: false };
}

/**
 * Format tech skills concisely (2–4 technologies max, avoiding tech dumps)
 */
export function formatConciseSkills(profile: UserProfile): { primary: string; short: string } {
  const pool = (profile.primarySkills && profile.primarySkills.length > 0)
    ? profile.primarySkills
    : (profile.skills && profile.skills.length > 0)
    ? profile.skills
    : ['React', 'Next.js', 'TypeScript', 'Python'];

  const short = pool.slice(0, 2).join(' and ');
  const primary = pool.length >= 4
    ? `${pool.slice(0, 3).join(', ')} and ${pool[3]}`
    : pool.join(', ');

  return { primary, short };
}

/**
 * Extract target role cleanly
 */
export function resolveTargetRole(
  profile: UserProfile,
  jobOrRole?: JobOpportunity | string,
  prospectTitle?: string
): string {
  if (typeof jobOrRole === 'string' && jobOrRole.trim()) {
    return jobOrRole.trim();
  }
  if (jobOrRole && typeof jobOrRole === 'object' && jobOrRole.title) {
    if (jobOrRole.title !== prospectTitle) {
      return jobOrRole.title;
    }
  }
  return profile.targetRole || profile.targetRoles?.[0] || 'Full Stack Engineer';
}

/**
 * Deterministic quality validation layer
 */
export function validateMessageQuality(
  text: string,
  context: {
    persona: PersonaType;
    goal: OutreachGoal;
    touchpoint: 'day0' | 'day5' | 'day12';
    firstName: string;
  }
): MessageValidationResult {
  const issues: QualityIssue[] = [];
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const lower = text.toLowerCase();

  // 1. Greeting check
  const hasGreetingName =
    lower.startsWith(`hi ${context.firstName.toLowerCase()}`) ||
    lower.startsWith(`hello ${context.firstName.toLowerCase()}`) ||
    lower.startsWith(`hey ${context.firstName.toLowerCase()}`);

  if (!hasGreetingName && context.touchpoint === 'day0') {
    issues.push({
      rule: 'greeting-name',
      severity: 'error',
      message: `Message does not start with personalized greeting for "${context.firstName}".`
    });
  }

  // 2. Word count constraints
  let targetRange = '70–130 words';
  if (context.touchpoint === 'day0') {
    targetRange = '70–130 words';
    if (wordCount < 60) {
      issues.push({
        rule: 'word-count-low',
        severity: 'warning',
        message: `Day 0 message is too brief (${wordCount} words; expected 70–130).`
      });
    } else if (wordCount > 140) {
      issues.push({
        rule: 'word-count-high',
        severity: 'error',
        message: `Day 0 message is too long (${wordCount} words; max 130).`
      });
    }
  } else if (context.touchpoint === 'day5') {
    targetRange = '25–60 words';
    if (wordCount > 75) {
      issues.push({
        rule: 'followup-too-long',
        severity: 'warning',
        message: `Day 5 follow-up is too long (${wordCount} words; should be concise).`
      });
    }
  } else if (context.touchpoint === 'day12') {
    targetRange = '20–50 words';
    if (wordCount > 65) {
      issues.push({
        rule: 'final-followup-too-long',
        severity: 'warning',
        message: `Day 12 follow-up is too long (${wordCount} words).`
      });
    }
  }

  // 3. Check for banned generic AI phrases
  for (const banned of BANNED_AI_PHRASES) {
    if (lower.includes(banned)) {
      issues.push({
        rule: 'banned-ai-phrase',
        severity: 'error',
        message: `Contains AI cliché phrase: "${banned}".`
      });
    }
  }

  // 4. Check for unsupported claims
  for (const claim of UNSUPPORTED_CLAIMS) {
    if (lower.includes(claim)) {
      issues.push({
        rule: 'unsupported-claim',
        severity: 'error',
        message: `Contains unsupported claim: "${claim}".`
      });
    }
  }

  // 4b. Check for em dashes (—)
  if (text.includes('—')) {
    issues.push({
      rule: 'no-em-dash',
      severity: 'error',
      message: 'Message must not contain em dashes (—).'
    });
  }

  // 5. Goal & Persona integrity checks
  if (context.goal === 'agency-leads') {
    if (lower.includes('my resume') || lower.includes('send my resume') || lower.includes('attach my cv')) {
      issues.push({
        rule: 'agency-resume-violation',
        severity: 'error',
        message: 'Agency outreach must not offer a resume.'
      });
    }
    if (lower.includes('hiring me') || lower.includes('job opening') || lower.includes('looking for a role')) {
      issues.push({
        rule: 'agency-job-seek-violation',
        severity: 'error',
        message: 'Agency outreach must sell product/services, not seek a job.'
      });
    }
  }

  if (context.goal === 'job-hunt') {
    if (context.persona === 'employee') {
      if (lower.includes('are you hiring') || lower.includes('do you have vacancies') || lower.includes('do you have any vacancies')) {
        issues.push({
          rule: 'employee-vacancy-ask',
          severity: 'error',
          message: 'Do not ask normal employees if they have vacancies; ask for a referral or direction.'
        });
      }
    }
    if (context.persona === 'founder') {
      if (lower.includes('appreciate a referral') || lower.includes('give me a referral')) {
        issues.push({
          rule: 'founder-referral-ask',
          severity: 'error',
          message: 'Do not ask founders for referrals; ask directly about adding to the team.'
        });
      }
    }
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  return {
    isValid: !hasErrors,
    wordCount,
    targetRange,
    hasGreetingName,
    issues
  };
}

// =========================================================================
// PERSONA × GOAL × ANGLE MESSAGE STRATEGY BUILDERS
// =========================================================================

/**
 * 1. JOB HUNT STRATEGIES
 */
function buildJobHuntDay0(ctx: MessageContext): string {
  const { firstName, senderName, companyName, hasSpecificCompany, targetRole, expText, primaryStack, shortStack, angle, persona } = ctx;

  // A. FOUNDER / CXO
  if (persona === 'founder') {
    const compRef = hasSpecificCompany
      ? `what you're building at ${companyName}`
      : `what you're building`;

    if (angle === 'founding') {
      return `Hi ${firstName},

Came across ${hasSpecificCompany ? companyName : 'your company'} and really liked your approach to building in this space.

I'm a ${targetRole} with ${expText} of experience in early-stage startups, comfortable owning systems from 0 to 1 and moving fast through ambiguity.

I'm currently exploring new engineering opportunities and wanted to ask: are you looking to add a hands-on technical builder to the team?

If you're exploring additions, I'd love to chat briefly and see if there could be a fit.

Best,
${senderName}`;
    }

    if (angle === 'ai_rag') {
      return `Hi ${firstName},

I've been following ${compRef}. Really compelling product direction.

I'm a ${targetRole} with ${expText} of experience building web applications and production AI/RAG workflows that solve real user problems.

I'm currently exploring new engineering roles and wanted to see if you're looking to add someone who can bridge modern software engineering and applied AI.

If that's relevant to your roadmap, I'd love to have a quick conversation.

Best,
${senderName}`;
    }

    if (angle === 'product_ownership') {
      return `Hi ${firstName},

Came across ${hasSpecificCompany ? companyName : 'your team'} and really appreciate how you're executing on the product side.

I'm a ${targetRole} with ${expText} of experience, focused on high-autonomy product development where engineers talk to users and ship features end-to-end.

I'm currently exploring opportunities and wanted to ask: are you looking to bring on an engineer who can own features with minimal overhead?

Would be glad to have a quick conversation if that fits your current plans.

Best,
${senderName}`;
    }

    // Standard Founder
    return `Hi ${firstName},

I've been following ${compRef}. Really interesting space.

I'm a ${targetRole} with ${expText} of experience, mostly working with startups and building products end-to-end.

I'm currently exploring engineering opportunities and wanted to ask: are you looking to add someone technical to the team?

If yes, I'd love to have a quick conversation and see if there could be a fit.

Best,
${senderName}`;
  }

  // B. CTO / VP ENGINEERING / TECH LEAD
  if (persona === 'cto_lead') {
    const compRef = hasSpecificCompany ? ` at ${companyName}` : '';

    if (angle === 'founding') {
      return `Hi ${firstName},

Came across your profile leading engineering${compRef}.

I'm a ${targetRole} with ${expText} of experience architecting and shipping systems from 0 to 1, working primarily across ${shortStack} in fast-paced startup environments.

I'm currently exploring new opportunities and wanted to check if you're looking for an engineer who operates comfortably with high autonomy and rapid iteration.

Would love to connect if that aligns with your hiring plans.

Best,
${senderName}`;
    }

    if (angle === 'ai_rag') {
      return `Hi ${firstName},

Came across your profile while researching the tech team${compRef}.

I'm a ${targetRole} with ${expText} of experience building robust production software across ${shortStack} alongside practical AI/RAG integrations.

I'm currently looking for engineering opportunities and wanted to see if you're looking to add engineers who can ship reliable full-stack and AI capabilities without unnecessary complexity.

Happy to connect if that's relevant to your roadmap.

Best,
${senderName}`;
    }

    if (angle === 'product_ownership') {
      return `Hi ${firstName},

I came across your profile while looking into the engineering group${compRef}.

I'm a ${targetRole} with ${expText} of experience, focused on strong product ownership, handling everything from schema design to production deployment with minimal management friction.

I'm exploring new roles and wanted to ask if you're looking to bring on someone technical who can take full feature ownership across ${shortStack}.

Would be great to connect if there might be a fit.

Best,
${senderName}`;
    }

    // Standard CTO/Lead
    return `Hi ${firstName},

I came across your profile while looking into the engineering team${compRef}.

I'm a ${targetRole} with ${expText} of experience building and shipping products end-to-end across ${primaryStack}. I'm accustomed to high autonomy, moving fast, and taking features from architecture to deployment with minimal management friction.

I'm currently exploring engineering opportunities and wanted to see if you're looking to add someone to the team who can take ownership across the stack.

Would be great to connect if that aligns with your current roadmap.

Best,
${senderName}`;
  }

  // C. RECRUITER / HR / TALENT ACQUISITION
  if (persona === 'recruiter') {
    const compRef = hasSpecificCompany ? ` at ${companyName}` : '';

    if (angle === 'founding') {
      return `Hi ${firstName},

I'm currently exploring new ${targetRole} roles and came across ${hasSpecificCompany ? companyName : 'your team'}.

I bring ${expText} of experience building 0-to-1 production systems with ${primaryStack}, with a track record in fast-paced startup environments.

Do you have any current or upcoming engineering openings${compRef} where a high-ownership builder would be a strong match?

Glad to share my resume if you're actively hiring.

Best,
${senderName}`;
    }

    if (angle === 'ai_rag') {
      return `Hi ${firstName},

I'm exploring ${targetRole} opportunities and wanted to check in regarding engineering roles${compRef}.

I have ${expText} of experience shipping applications with ${primaryStack} alongside production LLM/RAG workflows.

Are there any active openings on your team where this technical background aligns with your hiring roadmap?

Happy to share my resume and relevant project details.

Best,
${senderName}`;
    }

    if (angle === 'product_ownership') {
      return `Hi ${firstName},

I'm currently exploring ${targetRole} opportunities and came across the engineering team${compRef}.

I have ${expText} of experience delivering end-to-end features with ${primaryStack}, specializing in autonomous product delivery and clean architecture.

Are you hiring for any software engineering positions that align with my background?

Happy to pass along my resume if helpful.

Best,
${senderName}`;
    }

    // Standard Recruiter
    return `Hi ${firstName},

I'm currently exploring new ${targetRole} opportunities and came across ${hasSpecificCompany ? companyName : 'your open positions'}.

I bring ${expText} of experience building products end-to-end with ${primaryStack}, primarily in fast-paced startup environments where I owned features from concept to production.

Are there any current ${targetRole} or software engineering openings${compRef} that could be a fit for my profile?

Happy to share my resume and work samples if you have active or upcoming roles on the team.

Best,
${senderName}`;
  }

  // D. EMPLOYEE / PEER ENGINEER (Referral & Direction Ask)
  const compRef = hasSpecificCompany ? ` at ${companyName}` : '';

  if (angle === 'founding') {
    return `Hi ${firstName},

Came across your profile while looking into engineering${compRef}.

I'm a ${targetRole} with ${expText} of experience shipping 0-to-1 systems in early-stage startups, working with ${primaryStack}.

I'm currently exploring new roles and wanted to see if you'd be open to referring me if your team or an adjacent engineering squad is looking for a hands-on builder?

Really appreciate any guidance or direction.

Thanks,
${senderName}`;
  }

  if (angle === 'ai_rag') {
    return `Hi ${firstName},

Saw your work on the engineering side${compRef} and wanted to reach out.

I'm a ${targetRole} with ${expText} of experience across ${primaryStack} and production AI/RAG systems, currently looking for my next role.

If you feel my background could be a fit for any engineering openings${compRef}, would you be open to pointing me in the right direction or offering a referral?

Thanks,
${senderName}`;
  }

  if (angle === 'product_ownership') {
    return `Hi ${firstName},

Came across your profile while exploring the engineering team${compRef}.

I'm a ${targetRole} with ${expText} of experience building and shipping features end-to-end with ${primaryStack}.

I'm currently looking for new opportunities and wanted to check: if there are open engineering roles, would you be comfortable putting in a referral?

Glad to share my resume or work samples anytime.

Thanks,
${senderName}`;
  }

  // Standard Employee
  return `Hi ${firstName},

Came across your profile while looking into the engineering team${compRef}.

I'm a ${targetRole} with ${expText} of experience in ${primaryStack}, and I'm currently exploring new opportunities.

Since you're already working on the engineering side${compRef}, I wanted to reach out directly.

If you feel my background could be relevant for any current openings, I'd really appreciate a referral.

Thanks,
${senderName}`;
}

/**
 * 2. AGENCY LEADS STRATEGIES
 */
function buildAgencyLeadsDay0(ctx: MessageContext): string {
  const { firstName, senderName, companyName, hasSpecificCompany, agencySummary, angle, persona } = ctx;
  const compName = hasSpecificCompany ? companyName : 'your company';

  if (persona === 'employee' || persona === 'recruiter') {
    return `Hi ${firstName},

Came across your profile while looking into the engineering team at ${compName}.

I run a product engineering studio that partners with tech teams to help tackle backlog features and integrations when internal sprints are overloaded.

Wanted to reach out directly to see how your team handles roadmap spillover. Open to connecting if having on-demand engineering support is ever useful.

Thanks,
${senderName}`;
  }

  // Founder / CTO / Decision Maker
  if (angle === 'founding') {
    return `Hi ${firstName},

Came across ${compName} and loved your vision for the product.

My team specializes in taking 0-to-1 product concepts into production in weeks, helping founders test and launch without getting slowed down by long development cycles.

If you have upcoming product initiatives or new feature experiments you want launched quickly, happy to share how we work.

Would be glad to share a few relevant case studies if useful.

Best,
${senderName}`;
  }

  if (angle === 'ai_rag') {
    return `Hi ${firstName},

Came across ${compName} and really liked the direction you're taking with the product.

I run a specialized engineering studio helping startups integrate practical AI, automated workflows, and custom web applications into their existing stacks.

Founders we work with usually want to ship intelligent features without distracting their core team from primary roadmap goals.

If that's a priority for ${compName}, glad to show you a couple of systems we've shipped recently.

Best,
${senderName}`;
  }

  if (angle === 'product_ownership') {
    return `Hi ${firstName},

Came across ${compName} and really appreciate your execution in this space.

We partner with growing startups as a dedicated product engineering team, taking feature roadmaps from concept to production with complete autonomy.

If your backlog has high-impact features that keep getting pushed back, we could help clear that queue without added management overhead.

Happy to share a quick teardown of how we've helped similar teams if that sounds interesting.

Best,
${senderName}`;
  }

  // Standard Agency
  return `Hi ${firstName},

Came across ${compName} and really liked what you're building in this space.

I run a ${agencySummary || 'small product development team helping startups build and ship web/mobile products without needing to immediately build a full engineering team'}.

Thought I'd reach out because companies at your stage often have product or automation work that gets pushed down the roadmap.

If that's something you're dealing with, happy to share a few examples of what we've built.

Best,
${senderName}`;
}

/**
 * 3. HIRE STRATEGIES (User is employer / buyer)
 */
function buildHireDay0(ctx: MessageContext): string {
  const { firstName, senderName, targetRole, prospectTitle, shortStack, angle } = ctx;
  const roleContext = prospectTitle || 'engineering';

  if (angle === 'founding') {
    return `Hi ${firstName},

Came across your profile while looking for builders who thrive in fast-paced environments.

We're building from 0 to 1 and looking for an engineer who can take true ownership, move fast, and build high-quality systems from scratch.

Your experience in ${roleContext} stood out, and I'd love to see if you're open to exploring new roles.

Would you be up for a brief conversation this week?

Best,
${senderName}`;
  }

  if (angle === 'ai_rag') {
    return `Hi ${firstName},

Came across your profile while searching for engineers with hands-on technical depth and problem-solving skills.

We're currently scaling our technical stack and looking for someone to lead development on core product features.

Given your background in ${roleContext}, I wanted to reach out directly to see if you're open to exploring new roles.

Would you be open to a quick chat to discuss the opportunity?

Best,
${senderName}`;
  }

  if (angle === 'product_ownership') {
    return `Hi ${firstName},

Came across your work and was impressed by your product-focused engineering background.

We're looking for an autonomous engineer to take ownership of end-to-end features for our upcoming roadmap.

Your experience in ${roleContext} caught my attention.

Are you open to exploring new opportunities right now? Would love to share more context if so.

Best,
${senderName}`;
  }

  // Standard Hire
  return `Hi ${firstName},

Came across your profile while looking for engineers with strong experience in ${shortStack || 'software development'}.

I'm currently working on product initiatives and we're looking for someone who can help take ownership as a ${targetRole}.

Your background with ${roleContext} stood out, and I think you could make a strong impact on what we're building.

Would you be open to a quick conversation about the opportunity?

Best,
${senderName}`;
}

/**
 * 4. FREELANCERS STRATEGIES (Collaboration / Contractor ask)
 */
function buildFreelancersDay0(ctx: MessageContext): string {
  const { firstName, senderName, prospectTitle, shortStack, angle } = ctx;
  const domain = prospectTitle || 'technical';

  if (angle === 'founding') {
    return `Hi ${firstName},

Came across your profile while searching for an experienced freelance engineer who can build fast 0-to-1 systems.

I have an upcoming build requiring clean execution and quick turnaround.

Your hands-on track record in ${domain} stood out.

Are you currently taking on contract or freelance projects? Would love to chat if you have availability.

Best,
${senderName}`;
  }

  if (angle === 'ai_rag') {
    return `Hi ${firstName},

Came across your profile while looking for a contractor with strong development experience.

We have a project requiring implementation of automated workflows and modern web interfaces, and your skillset in ${domain} seems like a great match.

Do you currently have bandwidth for contract work? Happy to share the project scope if interested.

Best,
${senderName}`;
  }

  if (angle === 'product_ownership') {
    return `Hi ${firstName},

Came across your profile while looking for an autonomous contractor who can own a feature build end-to-end.

We need reliable help delivering upcoming requirements without heavy back-and-forth management.

If you're taking on contract work, would love to have a quick conversation about the scope and timeline.

Best,
${senderName}`;
  }

  // Standard Freelancer Collaboration
  return `Hi ${firstName},

Came across your profile while looking for an experienced engineer in ${shortStack || domain}.

I'm currently working on a project build where I may need additional hands-on development help, particularly around architecture, clean APIs, and shipping responsive user interfaces.

Your background with ${domain} caught my attention, and I wanted to see if you might have bandwidth for contract or freelance collaboration.

If you're taking on projects right now, would love to have a brief conversation about the scope and timeline.

Best,
${senderName}`;
}

/**
 * DAY 5 FOLLOW-UP BUILDER
 */
function buildDay5FollowUp(ctx: MessageContext): string {
  const { firstName, senderName, companyName, hasSpecificCompany, targetRole, goal, persona } = ctx;
  const compRef = hasSpecificCompany ? ` at ${companyName}` : '';

  if (goal === 'agency-leads') {
    return `Hi ${firstName},

Following up on my previous note.

If roadmap overflow or external product engineering is on your radar this quarter, happy to share 2-3 quick project teardowns. No pressure either way!

Best,
${senderName}`;
  }

  if (goal === 'hire') {
    return `Hi ${firstName},

Wanted to follow up on my note about the ${targetRole} role.

If you're open to exploring new opportunities, I'd love to connect for 10 minutes and share more about what we're building.

Best,
${senderName}`;
  }

  if (goal === 'freelancers') {
    return `Hi ${firstName},

Following up to see if you have any availability for contract or freelance projects in the coming weeks?

No rush at all, happy to share the scope whenever convenient.

Best,
${senderName}`;
  }

  // Job Hunt Goal
  if (persona === 'founder') {
    return `Hi ${firstName},

Just following up on my note above.

If you're currently adding engineers to the team, I'd be happy to share my profile and have a quick conversation.

Thanks!`;
  }

  if (persona === 'cto_lead') {
    return `Hi ${firstName},

Quick follow-up to see if you're looking to add hands-on engineers to the tech team${compRef}.

Glad to share a couple of production projects I've built if relevant.

Best,
${senderName}`;
  }

  if (persona === 'recruiter') {
    return `Hi ${firstName},

Following up on my note regarding ${targetRole} opportunities${compRef}.

Happy to share my resume or hop on a brief call if there's an active pipeline.

Best,
${senderName}`;
  }

  // Employee
  return `Hi ${firstName},

Quick bump on my note above.

If you feel comfortable pointing me to an opening or putting in a referral${compRef}, I'd really appreciate it. No worries at all if not!

Thanks,
${senderName}`;
}

/**
 * DAY 12 FINAL FOLLOW-UP BUILDER
 */
function buildDay12FollowUp(ctx: MessageContext): string {
  const { firstName, senderName, companyName, hasSpecificCompany, targetRole, goal, persona } = ctx;
  const compRef = hasSpecificCompany ? ` at ${companyName}` : '';

  if (goal === 'agency-leads') {
    return `Hi ${firstName},

Last follow-up from my side. Totally understand if you have all engineering bandwidth covered internally.

Wishing you and ${hasSpecificCompany ? companyName : 'your team'} continued growth, and let's stay in touch!

Best,
${senderName}`;
  }

  if (goal === 'hire') {
    return `Hi ${firstName},

Last note from my side. Understand you might be happily settled in your current role.

If you ever consider new opportunities in the future, please feel free to reach out. Wishing you the best!

Best,
${senderName}`;
  }

  if (goal === 'freelancers') {
    return `Hi ${firstName},

Final check-in from my side. Totally understand if your freelance plate is full right now.

Let's stay connected for future project collaborations!

Best,
${senderName}`;
  }

  // Job Hunt Goal
  if (persona === 'founder') {
    return `Hi ${firstName},

Last follow-up from my side, completely understand if the timing isn't right.

If you do end up looking for someone on the engineering side in the future, happy to reconnect.

Best,
${senderName}`;
  }

  if (persona === 'cto_lead') {
    return `Hi ${firstName},

Final check-in from my side. Totally understand things move fast on engineering roadmaps.

If you need someone to take ownership across the stack down the line, happy to reconnect.

Best,
${senderName}`;
  }

  if (persona === 'recruiter') {
    return `Hi ${firstName},

Checking in one final time regarding ${targetRole} openings${compRef}.

If there isn't an immediate fit right now, feel free to keep my details on file for future roles.

Best,
${senderName}`;
  }

  // Employee
  return `Hi ${firstName},

Last note from my side, completely understand if referrals aren't open right now.

Great connecting with a fellow engineer, and wishing you all the best${compRef}!

Thanks,
${senderName}`;
}

/**
 * Removes em dashes (—) and en dashes (–) from messages, replacing them with natural punctuation
 */
export function removeEmDashes(text: string): string {
  return text
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*–\s*/g, '-');
}

// =========================================================================
// MAIN ENTRY POINT
// =========================================================================

export function generatePersonalizedDM(
  prospect: Partial<Prospect>,
  jobOrRole?: JobOpportunity | string,
  angle: MessageAngle = 'standard',
  userProfile?: UserProfile,
  outreachGoal?: OutreachGoal,
  overridePersona?: PersonaType
): GeneratedSequence {
  const profile = userProfile || DEFAULT_PROFILE;
  const firstName = sanitizeFirstName(prospect.name);
  const companyInfo = sanitizeCompanyName(prospect.company);
  const senderName = profile.name || 'Hemang Mehta';
  const expYears = profile.yearsOfExperience || 3;
  const expText = `${expYears}+ years`;
  const skills = formatConciseSkills(profile);
  const targetRole = resolveTargetRole(profile, jobOrRole, prospect.jobTitle);
  const persona: PersonaType = overridePersona || prospect.persona || resolveProspectPersona(prospect);
  const goal: OutreachGoal = outreachGoal || prospect.outreachGoal || 'job-hunt';

  const ctx: MessageContext = {
    firstName,
    senderName,
    companyName: companyInfo.clean,
    hasSpecificCompany: !companyInfo.isGeneric,
    prospectTitle: prospect.jobTitle || 'Engineer',
    targetRole,
    expYears,
    expText,
    primaryStack: skills.primary,
    shortStack: skills.short,
    agencySummary: profile.agencyServiceSummary || 'small product development team helping startups build and ship web/mobile products without needing to immediately build a full engineering team',
    agencyOffering: profile.agencyOffering || 'building and shipping production MVPs, feature roadmaps, and automation',
    persona,
    goal,
    angle
  };

  // Generate sequence
  let day0 = '';
  switch (goal) {
    case 'agency-leads':
      day0 = buildAgencyLeadsDay0(ctx);
      break;
    case 'hire':
      day0 = buildHireDay0(ctx);
      break;
    case 'freelancers':
      day0 = buildFreelancersDay0(ctx);
      break;
    case 'job-hunt':
    default:
      day0 = buildJobHuntDay0(ctx);
      break;
  }

  const day5 = buildDay5FollowUp(ctx);
  const day12 = buildDay12FollowUp(ctx);

  const cleanDay0 = removeEmDashes(day0);
  const cleanDay5 = removeEmDashes(day5);
  const cleanDay12 = removeEmDashes(day12);

  // Validate Day 0 message quality
  const validation = validateMessageQuality(cleanDay0, {
    persona,
    goal,
    touchpoint: 'day0',
    firstName
  });

  return {
    day0: cleanDay0,
    day5: cleanDay5,
    day12: cleanDay12,
    persona,
    goal,
    angle,
    validation
  };
}
