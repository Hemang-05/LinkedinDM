import type { UserProfile } from '../../types';

export const TEST_PROFILE: UserProfile = {
  name: 'Hemang Mehta',
  title: 'Full Stack Engineer',
  yearsOfExperience: 3,
  primarySkills: [
    'React',
    'Next.js',
    'TypeScript',
    'Python',
    'FastAPI',
    'PostgreSQL'
  ],
  secondarySkills: [
    'Docker',
    'Redis',
    'TailwindCSS',
    'LLM/RAG',
    'REST APIs'
  ],
  skills: [
    'React',
    'Next.js',
    'TypeScript',
    'Python',
    'FastAPI',
    'PostgreSQL',
    'LLM/RAG',
    'REST APIs'
  ],
  targetRoles: [
    'Full Stack Engineer',
    'Software Engineer',
    'Founding Engineer',
    'Product Engineer'
  ],
  targetRole: 'Full Stack Engineer',
  targetLocations: [
    'Remote',
    'Hybrid / On-site'
  ],
  location: 'Remote / India',
  workPreference: 'Remote',
  background: 'Startup / product development',
  bioSummary:
    'Full Stack Engineer with 3+ years of experience building products across React, Next.js, and Python in fast-paced startup environments.',
  startupExperienceSummary:
    'Experienced in early-stage startups taking products from 0 to 1 with end-to-end ownership.',
  relevantExperience:
    'Building and shipping production systems, end-to-end feature delivery, and scalable APIs.',
  agencyName: 'Product Engineering Studio',
  agencyServiceSummary:
    'small product development team helping startups build and ship web/mobile products without needing to immediately build a full engineering team',
  agencyOffering:
    'building and shipping production MVPs, feature roadmaps, and automation'
};

export const DEFAULT_PROFILE = TEST_PROFILE;
