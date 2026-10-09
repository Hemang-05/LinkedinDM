import { UserProfile } from '@/types';

export const DEFAULT_PROFILE: UserProfile = {
  name: 'Your Name',
  title: 'Full Stack / AI Engineer',
  yearsOfExperience: 3,
  skills: [
    'React',
    'Next.js',
    'TypeScript',
    'Python',
    'Node.js',
    'PostgreSQL',
    'REST APIs',
    'Cloud / CI/CD',
    'AI Integrations'
  ],
  targetRoles: [
    'Full Stack Engineer',
    'Software Engineer',
    'AI Engineer',
    'Product Engineer',
    'Founding Engineer'
  ],
  targetLocations: [
    'Remote',
    'Hybrid / On-site'
  ],
  bioSummary:
    'Experienced software engineer building web applications and AI-enabled products.'
};

// Fallback profile export
export const MY_PROFILE = DEFAULT_PROFILE;
