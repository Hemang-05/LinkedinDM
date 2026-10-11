import type { Prospect, JobOpportunity, UserProfile } from '@/types';
import { DEFAULT_PROFILE } from './profile';

export type MessageAngle = 'standard' | 'founding' | 'ai_rag' | 'product_ownership';

export function generatePersonalizedDM(
  prospect: Partial<Prospect>,
  jobOrRole?: JobOpportunity | string,
  angle: MessageAngle = 'standard',
  userProfile?: UserProfile
): {
  day0: string;
  day5: string;
  day12: string;
} {
  const profile = userProfile || DEFAULT_PROFILE;
  const firstName = (prospect.name || 'there').trim().split(' ')[0];
  const company = prospect.company || 'your team';
  const senderName = profile.name || DEFAULT_PROFILE.name || 'Hemang Mehta';
  const expYears = profile.yearsOfExperience || 3;
  const expText = `${expYears}+ years`;
  
  // Format primary tech stack from skills
  const skillsList = profile.skills && profile.skills.length > 0
    ? profile.skills
    : ['React', 'Next.js', 'TypeScript', 'Python', 'FastAPI', 'PostgreSQL'];
  const techStack = skillsList.slice(0, 5).join(', ');
  const techStackShort = skillsList.slice(0, 3).join(', ');

  // Determine target role strictly without mistakenly copying the recipient's job title
  let targetRole = profile.targetRole || profile.targetRoles?.[0] || 'Full Stack Engineer';
  if (typeof jobOrRole === 'string' && jobOrRole.trim()) {
    targetRole = jobOrRole.trim();
  } else if (jobOrRole && typeof jobOrRole === 'object' && jobOrRole.title) {
    // Only use job title if it was a distinct job target, not the prospect's personal title
    if (jobOrRole.title !== prospect.jobTitle) {
      targetRole = jobOrRole.title;
    }
  }

  // Segregation Detection
  const isFounder =
    prospect.segregationGroup === 'Founder' ||
    prospect.classification === 'Founder' ||
    prospect.classification === 'Co-founder' ||
    prospect.classification === 'CEO' ||
    prospect.classification === 'CTO' ||
    prospect.relationshipType === 'Founder' ||
    prospect.relationshipType === 'Co-founder' ||
    prospect.relationshipType === 'CEO' ||
    prospect.relationshipType === 'CTO';

  const isRecruiter =
    prospect.segregationGroup === 'HR' ||
    prospect.classification === 'Recruiter' ||
    prospect.classification === 'Hiring Manager' ||
    prospect.relationshipType === 'Recruiter' ||
    prospect.relationshipType === 'HR' ||
    prospect.relationshipType === 'Hiring Manager';

  // If not Founder and not Recruiter, connection is a Working Employee / Peer
  const isEmployee = !isFounder && !isRecruiter;

  let day0 = '';
  let day5 = '';
  let day12 = '';

  // ==========================================
  // 1. WORKING EMPLOYEES (Referral & Network Ask)
  // ==========================================
  if (isEmployee) {
    if (angle === 'founding') {
      day0 = `Hi ${firstName},

Myself ${senderName}. I'm a ${targetRole} with ${expText} of experience shipping 0-to-1 production systems with ${techStack}. My past experience includes early-stage startups where I owned features end-to-end.

I'm currently exploring new ${targetRole} roles and wanted to check if ${company} has any engineering openings you could refer me for, or if you know peers in your network looking for a hands-on engineer?

Happy to share my resume and relevant projects anytime.

Best,
${senderName}`;
    } else if (angle === 'ai_rag') {
      day0 = `Hi ${firstName},

Myself ${senderName}. I'm a ${targetRole} with ${expText} of experience building full-stack products across ${techStack} and LLM/RAG pipelines.

I'm actively looking for opportunities and wanted to check if there are any open spots on your engineering team at ${company} you could refer me for? Even if not on your immediate team, would really appreciate if you know of any openings among your peers.

Glad to send over my resume or discuss further if you're open to it!

Best,
${senderName}`;
    } else if (angle === 'product_ownership') {
      day0 = `Hi ${firstName},

Myself ${senderName}. I have ${expText} of experience as a ${targetRole} working across ${techStack}, with a strong focus on product autonomy and shipping reliable features end-to-end.

I'm currently looking for new roles and wanted to see if ${company} has any openings where you could refer me, or if anyone in your circle is looking for an experienced engineer.

Glad to share my resume and chat whenever convenient.

Best,
${senderName}`;
    } else {
      // Standard / Conversational Employee Referral
      day0 = `Hi ${firstName},

Myself ${senderName}. I have ${expText} of experience building scalable applications with ${techStack}, and I'm currently looking for new opportunities as a ${targetRole}.

I wanted to reach out to see if you have any open roles on your team or at ${company} that you might be able to refer me for? Or if you know of any relevant openings among your peers and network, I'd really appreciate it.

Glad to share my resume and work samples if you're open to connecting!

Best,
${senderName}`;
    }

    day5 = `Hi ${firstName}, hope you're having a productive week!

Quickly following up to see if any referral opportunities or open ${targetRole} spots came up at ${company} or in your network. No rush at all—happy to connect either way!

Best,
${senderName}`;

    day12 = `Hi ${firstName}, following up one last time.

If there aren't any matching roles or referrals open at ${company} right now, completely understand. Wishing you and the team continued success, and let's stay connected!

Best,
${senderName}`;
  }

  // ==========================================
  // 2. HR / TALENT ACQUISITION / RECRUITERS
  // ==========================================
  else if (isRecruiter) {
    if (angle === 'founding') {
      day0 = `Hi ${firstName},

Myself ${senderName}. I have ${expText} of experience delivering products end-to-end with ${techStack}, with extensive experience in fast-moving startup environments where I owned systems from 0 to 1.

I'm actively exploring ${targetRole} opportunities and wanted to ask if you have any active openings at ${company} where someone with my background could add value? I'd be glad to be considered as a candidate or share my resume for upcoming roles.

Best,
${senderName}`;
    } else if (angle === 'ai_rag') {
      day0 = `Hi ${firstName},

Myself ${senderName}. I have ${expText} of experience building full-stack applications with ${techStack} and generative AI / RAG pipelines.

I'm actively looking for ${targetRole} opportunities and wanted to check if ${company} is hiring engineers with this technical background. I'd be glad to share my resume or apply directly if there are active or upcoming openings.

Best,
${senderName}`;
    } else if (angle === 'product_ownership') {
      day0 = `Hi ${firstName},

Myself ${senderName}. I bring ${expText} of full-stack engineering experience across ${techStack}, specializing in taking complex product requirements from design to high-availability production.

I'm currently seeking ${targetRole} roles and wanted to see if ${company} has any openings. Happy to share my resume and discuss where I might best fit your hiring roadmap.

Best,
${senderName}`;
    } else {
      // Standard / Conversational HR
      day0 = `Hi ${firstName},

Myself ${senderName}. I have ${expText} of experience building production systems with ${techStack}, and I'm actively looking for ${targetRole} opportunities.

I wanted to check if you currently have any openings at ${company} that align with my background, or if you know of any upcoming roles? I would be glad to be considered as a candidate or learn where best to apply. Always glad to share my resume for both active openings and future roles as they are released.

Would welcome the opportunity to connect!

Best,
${senderName}`;
    }

    day5 = `Hi ${firstName}, following up on my previous note regarding ${targetRole} opportunities at ${company}.

If there are any current openings or pipelines where my background with ${techStackShort} would be a strong fit, I'd love to share my resume and connect.

Best,
${senderName}`;

    day12 = `Hi ${firstName}, checking in one final time regarding potential openings at ${company}.

If there's no immediate match, no problem at all—feel free to keep my profile on file for future opportunities. Wishing you and ${company} continued success!

Best,
${senderName}`;
  }

  // ==========================================
  // 3. FOUNDERS / CEOS / CTOS (Technical Spot & Startup Pitch)
  // ==========================================
  else {
    if (angle === 'founding') {
      day0 = `Hi ${firstName},

Myself ${senderName}. Love what you're building at ${company}.

I'm a ${targetRole} with ${expText} of experience across ${techStack}. Having worked at 2 early-stage startups as a founding engineer, I thrive in 0-to-1 environments with high autonomy and end-to-end execution.

I'm actively exploring my next role and wanted to ask if you have any technical spots vacant on your engineering team? Would love to chat if you're looking for a hands-on builder to help scale the product.

Best,
${senderName}`;
    } else if (angle === 'ai_rag') {
      day0 = `Hi ${firstName},

Myself ${senderName}. Really impressed with what you and the team are creating at ${company}.

I have ${expText} of experience working in fast-paced startups, building modern applications with ${techStack} and production LLM/RAG workflows. I focus on delivering end-to-end AI capabilities that move the needle for the product.

Wanted to check if you have any technical spots vacant on your team? Would love to explore whether my background could help drive key milestones on your roadmap.

Best,
${senderName}`;
    } else if (angle === 'product_ownership') {
      day0 = `Hi ${firstName},

Myself ${senderName}. Great work on ${company}—following your product updates closely.

I bring ${expText} of experience building production web applications with ${techStack}. Having worked at 2 startups, I'm accustomed to rapid execution, autonomous decision-making, and shipping features end-to-end without bottlenecks.

If you have any technical spots open or are looking for strong product engineers to join the team, I'd love to connect.

Best,
${senderName}`;
    } else {
      // Standard Founder (Loud & Clear Startup Pitch)
      day0 = `Hi ${firstName},

Myself ${senderName}. I've been following what you're building at ${company} and wanted to reach out directly.

I'm looking for ${targetRole} opportunities. My tech stack is ${techStack}, and I have ${expText} of experience. My last 2 organizations were fast-paced startups, so I have solid experience operating in high-speed environments, taking ambiguous problems, and delivering production products end-to-end.

I wanted to check if you have any technical spots vacant on your team right now? Would love to connect and see if my background could help accelerate what you're building at ${company}.

Best,
${senderName}`;
    }

    day5 = `Hi ${firstName}, bumping this quickly knowing how fast things move when building ${company}.

If you have any technical spot vacant or upcoming engineering needs where a fast-moving full stack engineer could help, I'd welcome a brief 10-minute conversation. Happy to share project demos anytime.

Best,
${senderName}`;

    day12 = `Hi ${firstName}, following up one last time regarding potential technical spots at ${company}.

I understand founding priorities shift rapidly—if the timing isn't right now, no worries at all. Wishing you and ${company} huge success, and let's definitely stay in touch!

Best,
${senderName}`;
  }

  return { day0, day5, day12 };
}
