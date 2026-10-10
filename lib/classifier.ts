import { ProspectClassification, RelationshipType, SegregationGroup } from '@/types';

export function classifyProspectTitle(title: string, headline?: string): {
  classification: ProspectClassification;
  relationshipType: RelationshipType;
  segregationGroup: SegregationGroup;
  priorityScore: number;
} {
  const text = `${title} ${headline || ''}`.toLowerCase();

  // Co-founder check
  if (text.includes('co-founder') || text.includes('cofounder')) {
    return { classification: 'Co-founder', relationshipType: 'Co-founder', segregationGroup: 'Founder', priorityScore: 10 };
  }

  // Founder check
  if (text.includes('founder') || text.includes('owner') || text.includes('partner') || text.includes('proprietor')) {
    return { classification: 'Founder', relationshipType: 'Founder', segregationGroup: 'Founder', priorityScore: 10 };
  }

  // CEO check
  if (/\bceo\b/.test(text) || text.includes('chief executive')) {
    return { classification: 'CEO', relationshipType: 'CEO', segregationGroup: 'Founder', priorityScore: 10 };
  }

  // CTO / C-suite check
  if (/\bcto\b/.test(text) || text.includes('chief technology') || text.includes('chief technical') || /\bc[a-z]o\b/.test(text)) {
    return { classification: 'CTO', relationshipType: 'CTO', segregationGroup: 'Founder', priorityScore: 10 };
  }

  // Recruiter / Talent Acquisition / HR check
  if (
    text.includes('recruiter') ||
    text.includes('talent acquisition') ||
    text.includes('talent partner') ||
    text.includes('sourcer') ||
    text.includes('technical recruiter') ||
    text.includes('human resources') ||
    /\bhr\b/.test(text) ||
    text.includes('people ops') ||
    text.includes('people partner')
  ) {
    return { classification: 'Recruiter', relationshipType: 'Recruiter', segregationGroup: 'HR', priorityScore: 8 };
  }

  // Engineering Manager / VP / Director / Lead check
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
    return { classification: 'Engineering Manager', relationshipType: 'Engineering Manager', segregationGroup: 'Employee', priorityScore: 9 };
  }

  // Hiring Manager check
  if (text.includes('hiring manager') || text.includes('hiring lead')) {
    return { classification: 'Hiring Manager', relationshipType: 'Hiring Manager', segregationGroup: 'HR', priorityScore: 9 };
  }

  // Peer / Software Engineer / Employee check
  if (
    text.includes('software engineer') ||
    text.includes('developer') ||
    text.includes('full stack') ||
    text.includes('frontend') ||
    text.includes('backend') ||
    text.includes('engineer') ||
    text.includes('architect') ||
    text.includes('product manager') ||
    text.includes('designer') ||
    text.includes('analyst') ||
    text.includes('consultant') ||
    text.includes('specialist')
  ) {
    return { classification: 'Other', relationshipType: 'Peer', segregationGroup: 'Employee', priorityScore: 5 };
  }

  return { classification: 'Other', relationshipType: 'Other', segregationGroup: 'Employee', priorityScore: 3 };
}
