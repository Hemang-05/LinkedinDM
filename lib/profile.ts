import type { UserProfile } from '@/types';

export const DEFAULT_PROFILE: UserProfile = {
  name: 'Hemang Mehta',
  title: 'Full Stack / AI Engineer',
  yearsOfExperience: 3,
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
    'AI Engineer',
    'Product Engineer',
    'Founding Engineer'
  ],
  targetRole: 'Full Stack Engineer',
  targetLocations: [
    'Remote',
    'Hybrid / On-site'
  ],
  bioSummary:
    'Full Stack & AI Engineer with 3+ years of experience building web applications and production AI workflows.',
  startupExperienceSummary:
    'Worked at 2 fast-paced startups delivering end-to-end production systems with 0-to-1 ownership.'
};

// Fallback profile export
export const MY_PROFILE = DEFAULT_PROFILE;
