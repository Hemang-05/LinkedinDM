import {
  ProspectCategory,
  Prospect,
  PersonaType,
  ProspectClassification,
  RelationshipType,
  SegregationGroup
} from '@/types';

export type ClassificationResult = {
  classification: ProspectClassification;
  relationshipType: RelationshipType;
  segregationGroup: SegregationGroup;
  priorityScore: number;
};

/**
 * WHOLE-WORD REGEX PATTERNS
 * Note: Word boundary \b ensures that short acronyms like 'hr' or 'ta'
 * never match substrings within words (e.g. 'Chrome' or 'Shreya' or 'Data').
 */

// 1. Excluded: student, intern, trainee, apprentice (whole-word match; do not match "fellow" alone)
const EXCLUDED_REGEX = /\b(students?|interns?|internships?|trainees?|apprentices?)\b/i;

// 2. Founder: founder, co-founder, CEO, owner, managing director
const FOUNDER_REGEX = /\b(co-?founders?|founders?|ceo|chief\s+executive\s+officer|owners?|managing\s+director)\b/i;

// 3. CTO: CTO, chief technology officer, VP engineering, head of engineering
const CTO_REGEX = /\b(cto|chief\s+technology\s+officer|vp\s+(?:of\s+)?engineering|vice\s+president\s+(?:of\s+)?engineering|head\s+of\s+engineering)\b/i;

// 4. Engineering Leader: tech lead, team lead, engineering manager, director of engineering
const ENG_LEADER_REGEX = /\b(tech(?:nical)?\s+lead|team\s+lead|engineering\s+manager|director\s+of\s+engineering)\b/i;

// 5. Recruiter: recruiter, talent acquisition, TA, HR, people ops, sourcer, headhunter
// Whole-word \bhr\b and \bta\b prevent partial matches
const RECRUITER_REGEX = /\b(recruiters?|recruiting|recruitment|talent\s+acquisition|\bta\b|\bhr\b|human\s+resources|people\s+ops|people\s+operations|sourcers?|sourcing|headhunters?)\b/i;

// 6. Employee: any hands-on role (engineer, developer, SDE, full stack, etc.) from junior to senior/staff/principal
const EMPLOYEE_REGEX = /\b(engineers?|engineering|developers?|sde(?:\s+[i|v|x\d]+)?|swe|full\s*stack|frontend|front-end|backend|back-end|programmers?|architects?|data\s+scientists?|data\s+analysts?|qa|sdet|systems?\s+engineer|devops|sre|cloud\s+engineer|mobile\s+engineer|ios\s+developer|android\s+developer)\b/i;

/**
 * Classifies a professional title into one of seven strict categories.
 * Enforces strict precedence:
 *   excluded -> founder -> cto -> eng_leader -> recruiter -> employee -> other
 */
export function classifyTitle(title: string | null | undefined): ProspectCategory {
  if (!title || typeof title !== 'string') return 'other';
  const trimmed = title.trim();
  if (!trimmed) return 'other';

  // Precedence 1: excluded
  if (EXCLUDED_REGEX.test(trimmed)) {
    return 'excluded';
  }

  // Precedence 2: founder
  if (FOUNDER_REGEX.test(trimmed)) {
    return 'founder';
  }

  // Precedence 3: cto
  if (CTO_REGEX.test(trimmed)) {
    return 'cto';
  }

  // Precedence 4: eng_leader
  if (ENG_LEADER_REGEX.test(trimmed)) {
    return 'eng_leader';
  }

  // Precedence 5: recruiter ("Senior Technical Recruiter" resolves to recruiter)
  if (RECRUITER_REGEX.test(trimmed)) {
    return 'recruiter';
  }

  // Precedence 6: employee
  if (EMPLOYEE_REGEX.test(trimmed)) {
    return 'employee';
  }

  // Precedence 7: other (never drop unmatched titles)
  return 'other';
}

/**
 * Category metadata for UI styling, badges, and filters.
 */
export const CATEGORY_METADATA: Record<
  ProspectCategory,
  { label: string; badgeColor: string; description: string }
> = {
  founder: {
    label: 'Founder / Exec',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    description: 'Founders, Co-founders, CEOs, Owners, Managing Directors'
  },
  cto: {
    label: 'CTO / VP Eng',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    description: 'CTOs, VPs of Engineering, Heads of Engineering'
  },
  eng_leader: {
    label: 'Eng Leader',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Engineering Managers, Tech Leads, Team Leads, Directors'
  },
  recruiter: {
    label: 'Recruiter / Talent',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Technical Recruiters, Talent Acquisition, HR, People Ops'
  },
  employee: {
    label: 'Engineer / Builder',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Hands-on Software Engineers, Developers, SDEs, Architects'
  },
  other: {
    label: 'Other Roles',
    badgeColor: 'bg-zinc-100 text-zinc-600 border-zinc-200',
    description: 'Product Managers, Sales, Marketing, Designers, Operations'
  },
  excluded: {
    label: 'Excluded',
    badgeColor: 'bg-red-50 text-red-600 border-red-200',
    description: 'Students, Interns, Trainees, Apprentices'
  }
};

/**
 * Clean hook for an optional future AI classification step.
 * Takes a deduped list of unclassified ('other') titles and returns enriched mappings.
 */
export type AIClassifierHook = (
  unclassifiedTitles: string[]
) => Promise<Record<string, ProspectCategory>>;

/**
 * Classifies a batch of titles, with an optional pluggable AI fallback
 * for any titles that remain in the 'other' category.
 */
export async function classifyBatchWithOptionalAI(
  titles: string[],
  aiHook?: AIClassifierHook
): Promise<Record<string, ProspectCategory>> {
  const results: Record<string, ProspectCategory> = {};
  const unclassified: string[] = [];

  for (const t of titles) {
    const category = classifyTitle(t);
    results[t] = category;
    if (category === 'other') {
      unclassified.push(t);
    }
  }

  // If a pluggable AI hook is supplied and we have unclassified titles, invoke it
  if (aiHook && unclassified.length > 0) {
    const uniqueUnclassified = Array.from(new Set(unclassified));
    try {
      const aiEnrichments = await aiHook(uniqueUnclassified);
      for (const [title, cat] of Object.entries(aiEnrichments)) {
        if (results[title] === 'other' && cat !== 'other') {
          results[title] = cat;
        }
      }
    } catch (err) {
      console.warn('Optional AI classification hook encountered an error; falling back to heuristic tags:', err);
    }
  }

  return results;
}

/**
 * Resolves the explicit outreach persona from prospect fields and titles.
 * Backward compatible with existing sequence generators and review modals.
 */
export function resolveProspectPersona(prospect: Partial<Prospect>): PersonaType {
  if (prospect.persona) return prospect.persona;

  if (prospect.category) {
    switch (prospect.category) {
      case 'founder':
        return 'founder';
      case 'cto':
      case 'eng_leader':
        return 'cto_lead';
      case 'recruiter':
        return 'recruiter';
      case 'employee':
        return 'employee';
      case 'other':
        return 'other';
      case 'excluded':
        return 'excluded';
      default:
        break;
    }
  }

  const classification = (prospect.classification || '').toLowerCase();
  const relationship = (prospect.relationshipType || '').toLowerCase();
  const text = `${prospect.jobTitle || ''} ${prospect.headline || ''} ${prospect.notes || ''}`.toLowerCase();

  if (
    classification === 'freelancer' ||
    classification === 'contractor' ||
    relationship === 'freelancer' ||
    relationship === 'consultant' ||
    /\b(freelance|freelancer|contractor|consultant)\b/i.test(text)
  ) {
    return 'freelancer';
  }

  const cat = classifyTitle(prospect.jobTitle || prospect.classification || prospect.headline);
  if (cat === 'excluded') return 'excluded';
  if (cat === 'founder') return 'founder';
  if (cat === 'cto' || cat === 'eng_leader') return 'cto_lead';
  if (cat === 'recruiter') return 'recruiter';
  if (cat === 'employee') return 'employee';

  if (
    classification === 'founder' ||
    classification === 'co-founder' ||
    classification === 'ceo' ||
    relationship === 'founder' ||
    relationship === 'co-founder' ||
    relationship === 'ceo'
  ) {
    return 'founder';
  }

  if (
    classification === 'cto' ||
    classification === 'engineering manager' ||
    relationship === 'cto' ||
    relationship === 'engineering manager'
  ) {
    return 'cto_lead';
  }

  if (
    classification === 'recruiter' ||
    classification === 'hiring manager' ||
    relationship === 'recruiter' ||
    relationship === 'hr' ||
    relationship === 'hiring manager'
  ) {
    return 'recruiter';
  }

  if (cat === 'other') return 'other';

  return 'other';
}

/**
 * Checks if a title represents an excluded student/intern/trainee/apprentice role.
 * Whole-word match; does not match 'fellow' alone.
 */
export function isStudentOrIntern(title: string, headline?: string): boolean {
  if (classifyTitle(title) === 'excluded') return true;
  if (headline && classifyTitle(headline) === 'excluded') return true;
  return false;
}

/**
 * Backward compatibility helper for legacy CSV import and scoring endpoints.
 */
export function classifyProspectTitle(title: string, headline?: string): ClassificationResult {
  const cat = classifyTitle(title);
  if (cat === 'founder') {
    return { classification: 'Founder', relationshipType: 'Founder', segregationGroup: 'Founder', priorityScore: 10 };
  }
  if (cat === 'cto') {
    return { classification: 'CTO', relationshipType: 'CTO', segregationGroup: 'Founder', priorityScore: 10 };
  }
  if (cat === 'eng_leader') {
    return { classification: 'Engineering Manager', relationshipType: 'Engineering Manager', segregationGroup: 'Employee', priorityScore: 9 };
  }
  if (cat === 'recruiter') {
    return { classification: 'Recruiter', relationshipType: 'Recruiter', segregationGroup: 'HR', priorityScore: 8 };
  }
  if (cat === 'employee') {
    return { classification: 'Other', relationshipType: 'Peer', segregationGroup: 'Employee', priorityScore: 5 };
  }

  const text = `${title} ${headline || ''}`.toLowerCase();
  if (/\b(freelance|freelancer|contractor|consultant)\b/i.test(text)) {
    return { classification: 'Freelancer', relationshipType: 'Freelancer', segregationGroup: 'Employee', priorityScore: 6 };
  }

  return { classification: 'Other', relationshipType: 'Other', segregationGroup: 'Employee', priorityScore: 3 };
}
