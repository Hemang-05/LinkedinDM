export type ProspectClassification =
  | 'Founder'
  | 'Co-founder'
  | 'CEO'
  | 'CTO'
  | 'Engineering Manager'
  | 'Hiring Manager'
  | 'Recruiter'
  | 'Other';

export type RelationshipType =
  | 'CEO'
  | 'Founder'
  | 'Co-founder'
  | 'CTO'
  | 'Engineering Manager'
  | 'HR'
  | 'Recruiter'
  | 'Hiring Manager'
  | 'Peer'
  | 'Other';

export type OutreachStatus =
  | 'Not contacted'
  | 'Message drafted'
  | 'Approved'
  | 'Contacted'
  | 'Replied'
  | 'Interested'
  | 'Interview'
  | 'Rejected'
  | 'No response'
  | 'Follow-up due'
  | 'Closed';

export interface ScoreBreakdownItem {
  category: string;
  points: number;
  maxPoints: number;
  matched: boolean;
  reason: string;
}

export interface ScoreExplanation {
  totalScore: number;
  items: ScoreBreakdownItem[];
  strongMatches: string[];
  gaps: string[];
  blockers: string[];
  recommendedAction: string;
}

export interface JobOpportunity {
  id: string;
  title: string;
  company: string;
  url?: string;
  location: string;
  remoteStatus: 'Remote India' | 'Remote Worldwide' | 'Hybrid' | 'On-site';
  postedDate?: string;
  description: string;
  source: string;
  hiringSignals: string[];
  requiredSkills: string[];
  minExperienceYears?: number;
  salaryRange?: string;
}

export interface Prospect {
  id: string;
  name: string;
  avatarUrl?: string;
  jobTitle: string;
  company: string;
  companyWebsite?: string;
  location: string;
  connectionDegree?: '1st' | '2nd' | '3rd' | 'Unknown';
  headline?: string;
  notes?: string;
  linkedinUrl: string;
  classification: ProspectClassification;
  relationshipType: RelationshipType;
  
  // Associated Job / Hiring Info
  jobOpportunity?: JobOpportunity;
  
  // Scoring
  score?: ScoreExplanation;
  
  // Outreach State
  status: OutreachStatus;
  draftedMessage?: string;
  followUpDay5Message?: string;
  followUpDay12Message?: string;
  lastContactedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachLogEntry {
  id?: string;
  date: string;
  name: string;
  company: string;
  role: string;
  personPosition: string;
  relationshipType: RelationshipType;
  linkedinUrl: string;
  status: OutreachStatus;
  rawText?: string;
}

export interface UserProfile {
  name: string;
  title: string;
  yearsOfExperience: number;
  skills: string[];
  targetRoles: string[];
  targetLocations: string[];
  bioSummary: string;
}
