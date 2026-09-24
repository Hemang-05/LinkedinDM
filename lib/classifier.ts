import { ProspectClassification, RelationshipType } from '@/types';

export function classifyProspectTitle(title: string, headline?: string): {
  classification: ProspectClassification;
  relationshipType: RelationshipType;
  priorityScore: number;
} {
  const text = `${title} ${headline || ''}`.toLowerCase();

  // Co-founder check
  if (text.includes('co-founder') || text.includes('cofounder')) {
    return { classification: 'Co-founder', relationshipType: 'Co-founder', priorityScore: 10 };
  }

  // Founder check
  if (text.includes('founder')) {
    return { classification: 'Founder', relationshipType: 'Founder', priorityScore: 10 };
  }

  // CEO check
  if (/\bceo\b/.test(text) || text.includes('chief executive')) {
    return { classification: 'CEO', relationshipType: 'CEO', priorityScore: 10 };
  }

  // CTO check
  if (/\bcto\b/.test(text) || text.includes('chief technology') || text.includes('chief technical')) {
    return { classification: 'CTO', relationshipType: 'CTO', priorityScore: 10 };
  }

  // Engineering Manager / VP / Director check
  if (
    text.includes('engineering manager') ||
    text.includes('em') ||
    text.includes('vp of engineering') ||
    text.includes('vp engineering') ||
    text.includes('head of engineering') ||
    text.includes('director of engineering') ||
    text.includes('lead engineer') ||
    text.includes('tech lead')
  ) {
    return { classification: 'Engineering Manager', relationshipType: 'Engineering Manager', priorityScore: 9 };
  }

  // Hiring Manager check
  if (text.includes('hiring manager') || text.includes('hiring lead')) {
    return { classification: 'Hiring Manager', relationshipType: 'Hiring Manager', priorityScore: 9 };
  }

  // Recruiter / Talent Acquisition / HR check
  if (
    text.includes('recruiter') ||
    text.includes('talent acquisition') ||
    text.includes('talent partner') ||
    text.includes('sourcer') ||
    text.includes('technical recruiter')
  ) {
    return { classification: 'Recruiter', relationshipType: 'Recruiter', priorityScore: 8 };
  }

  if (text.includes('human resources') || /\bhr\b/.test(text) || text.includes('people ops')) {
    return { classification: 'Recruiter', relationshipType: 'HR', priorityScore: 7 };
  }

  // Peer check
  if (
    text.includes('software engineer') ||
    text.includes('developer') ||
    text.includes('full stack') ||
    text.includes('ai engineer')
  ) {
    return { classification: 'Other', relationshipType: 'Peer', priorityScore: 5 };
  }

  return { classification: 'Other', relationshipType: 'Other', priorityScore: 3 };
}
