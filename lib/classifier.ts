import { ProspectClassification, RelationshipType, SegregationGroup } from '@/types';

export type ClassificationResult = {
  classification: ProspectClassification;
  relationshipType: RelationshipType;
  segregationGroup: SegregationGroup;
  priorityScore: number;
};

// Precompiled once at module load (instead of many .includes() calls per row)
const COFOUNDER_RE = /co-?founder/;
const FOUNDER_RE = /founder|proprietor|(?<!product )\bowner\b/;
const PARTNER_RE = /\bpartner\b/;
const CEO_RE = /\bceo\b|chief executive/;
const CXO_RE = /\bcto\b|chief technology|chief technical|\bc[a-z]o\b/;
const RECRUITER_RE =
  /recruit|talent acquisition|talent partner|sourcer|human resources|\bhr\b|people ops|people partner/;
const ENG_MANAGER_RE =
  /engineering manager|\bem\b|vp,? (of )?engineering|head of engineering|director of engineering|lead engineer|tech lead/;
const HIRING_MANAGER_RE = /hiring manager|hiring lead/;
const PEER_RE =
  /engineer|developer|full stack|frontend|backend|architect|product manager|designer|analyst|consultant|specialist/;

// Interns, students and freshers: they can't hire or refer, so they're excluded at import
const STUDENT_RE =
  /\b(intern|interns|internship|student|undergrad|undergraduate|fresher|trainee|apprentice|aspiring|b\.?\s?tech|m\.?\s?tech|bachelor'?s?|mba candidate|phd (student|candidate|scholar)|research scholar|campus ambassador|class of 20\d\d)\b/;
// Real seniority overrides the student match (e.g. "Founder | B.Tech student", "Student Success Manager"),
// as do university staff roles that serve students rather than being students.
const SENIOR_OVERRIDE_RE =
  /founder|\bceo\b|\bcto\b|director|head of|\bvp\b|manager|\blead\b|student (success|placement|affairs|services|support)/;

export function isStudentOrIntern(title: string, headline?: string): boolean {
  const text = `${title} ${headline || ''}`.toLowerCase();
  return STUDENT_RE.test(text) && !SENIOR_OVERRIDE_RE.test(text);
}

export function classifyProspectTitle(title: string, headline?: string): ClassificationResult {
  const text = `${title} ${headline || ''}`.toLowerCase();
  const isRecruiter = RECRUITER_RE.test(text);

  if (COFOUNDER_RE.test(text)) {
    return { classification: 'Co-founder', relationshipType: 'Co-founder', segregationGroup: 'Founder', priorityScore: 10 };
  }

  // "Partner" only counts as a founder when it isn't an HR/talent partner
  if (FOUNDER_RE.test(text) || (PARTNER_RE.test(text) && !isRecruiter)) {
    return { classification: 'Founder', relationshipType: 'Founder', segregationGroup: 'Founder', priorityScore: 10 };
  }

  if (CEO_RE.test(text)) {
    return { classification: 'CEO', relationshipType: 'CEO', segregationGroup: 'Founder', priorityScore: 10 };
  }

  if (CXO_RE.test(text)) {
    return { classification: 'CTO', relationshipType: 'CTO', segregationGroup: 'Founder', priorityScore: 10 };
  }

  if (isRecruiter) {
    return { classification: 'Recruiter', relationshipType: 'Recruiter', segregationGroup: 'HR', priorityScore: 8 };
  }

  if (ENG_MANAGER_RE.test(text)) {
    return { classification: 'Engineering Manager', relationshipType: 'Engineering Manager', segregationGroup: 'Employee', priorityScore: 9 };
  }

  if (HIRING_MANAGER_RE.test(text)) {
    return { classification: 'Hiring Manager', relationshipType: 'Hiring Manager', segregationGroup: 'HR', priorityScore: 9 };
  }

  if (PEER_RE.test(text)) {
    return { classification: 'Other', relationshipType: 'Peer', segregationGroup: 'Employee', priorityScore: 5 };
  }

  return { classification: 'Other', relationshipType: 'Other', segregationGroup: 'Employee', priorityScore: 3 };
}
