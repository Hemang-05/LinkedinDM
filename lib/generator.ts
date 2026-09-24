import { Prospect, JobOpportunity } from '@/types';
import { MY_PROFILE } from './profile';

export type MessageAngle = 'standard' | 'founding' | 'ai_rag' | 'product_ownership';

export function generatePersonalizedDM(
  prospect: Partial<Prospect>,
  job?: JobOpportunity,
  angle: MessageAngle = 'standard'
): {
  day0: string;
  day5: string;
  day12: string;
} {
  const firstName = (prospect.name || 'there').trim().split(' ')[0];
  const company = prospect.company || job?.company || 'your team';
  const role = job?.title || prospect.jobTitle || 'Full Stack Engineer';
  const isFounder =
    prospect.classification === 'Founder' ||
    prospect.classification === 'Co-founder' ||
    prospect.classification === 'CEO' ||
    prospect.relationshipType === 'Founder' ||
    prospect.relationshipType === 'CEO';

  let day0 = '';

  if (angle === 'founding') {
    day0 = `Hi ${firstName}, saw you're building ${company} and looking for a ${role}.

I'm a Full Stack/AI Engineer with 3+ years of experience shipping production products using React/Next.js, TypeScript, Python/FastAPI, and PostgreSQL. I thrive with high autonomy and 0-to-1 founding ownership in fast-moving teams.

Would love to explore whether my background could help accelerate your engineering roadmap at ${company}.

Best,
${MY_PROFILE.name}`;
  } else if (angle === 'ai_rag') {
    day0 = `Hi ${firstName}, came across the ${role} opportunity at ${company}.

I'm a Full Stack / AI Engineer (3+ yrs) specializing in modern React/Next.js interfaces, FastAPI services, PostgreSQL, and LLM/RAG workflows. I build clean, reliable full-stack architectures from database schema to user experience.

Would love to connect and see if my technical skillset could support what you're building at ${company}.

Best,
${MY_PROFILE.name}`;
  } else if (angle === 'product_ownership') {
    day0 = `Hi ${firstName}, noticed the ${role} opening at ${company}.

I bring 3+ years of end-to-end full stack engineering experience across Next.js, TypeScript, Python, FastAPI, and PostgreSQL. I enjoy taking ambiguous problems, owning features end-to-end, and shipping high-quality software rapidly.

Happy to share relevant project demos if you're open to a brief chat.

Best,
${MY_PROFILE.name}`;
  } else {
    // Standard Angle (Role & Decision-Maker Adaptive)
    if (isFounder) {
      day0 = `Hi ${firstName}, noticed what you're building at ${company} and saw you're looking for a ${role}.

I'm a Full Stack / AI Engineer with 3+ years of experience building production systems using React/Next.js, TypeScript, Python/FastAPI, PostgreSQL, and LLM/RAG architectures. I thrive in founder-led startups with end-to-end ownership.

Would love to explore whether my background could help accelerate your roadmap at ${company}.

Best,
${MY_PROFILE.name}`;
    } else if (prospect.classification === 'Recruiter' || prospect.relationshipType === 'Recruiter') {
      day0 = `Hi ${firstName}, I saw the ${role} opening at ${company}.

I'm a Full Stack / AI Engineer with 3+ years of experience building scalable applications with React/Next.js, TypeScript, Python/FastAPI, PostgreSQL, and LLM/RAG pipelines. I've owned features end-to-end in fast-moving startup environments.

If you are open to a brief conversation or reviewing my profile, I'd welcome the opportunity to connect.

Best,
${MY_PROFILE.name}`;
    } else {
      day0 = `Hi ${firstName}, I came across the ${role} opportunity at ${company}.

I’m a Full Stack/AI Engineer with 3+ years of experience building production applications with React/Next.js, TypeScript, Python/FastAPI, PostgreSQL and LLM/RAG workflows. I’ve worked in startup environments with strong end-to-end ownership and would love to explore whether my background could be relevant to the team.

Best,
${MY_PROFILE.name}`;
    }
  }

  // Day 5: Concise gentle follow-up
  const day5 = `Hi ${firstName}, wanted to quickly bump this in case it got buried. Still very keen on the ${role} opportunity at ${company}. Happy to share a quick overview of recent projects or hop on a brief call whenever convenient for you.

Best,
${MY_PROFILE.name}`;

  // Day 12: Final polite check-in / keeping door open
  const day12 = `Hi ${firstName}, following up one last time regarding the ${role} role at ${company}. I understand priorities shift quickly—if the timing isn't right now, no worries at all. Wishing you and the team continued success, and let's stay in touch!

Best,
${MY_PROFILE.name}`;

  return { day0, day5, day12 };
}
