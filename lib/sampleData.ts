import { Prospect } from '@/types';
import { calculateScoreAndMatching } from './scoring';
import { generatePersonalizedDM } from './generator';

const rawProspects: Partial<Prospect>[] = [
  {
    id: 'p-1',
    name: 'Rahul Sharma',
    jobTitle: 'Founder & CEO',
    company: 'XYZ AI',
    companyWebsite: 'https://xyzai.example.com',
    location: 'Bengaluru, India (Remote eligible)',
    connectionDegree: '1st',
    headline: 'Founder & CEO @ XYZ AI | We are hiring Full Stack AI Engineers! (Remote India)',
    notes: 'Actively scaling their multi-agent workflow platform. Looking for engineers with React, Next.js, Python, FastAPI and LLM/RAG experience.',
    linkedinUrl: 'https://linkedin.com/in/rahul-sharma-xyzai',
    classification: 'Founder',
    relationshipType: 'CEO',
    status: 'Not contacted',
    createdAt: '2026-09-24T08:00:00.000Z',
    updatedAt: '2026-09-24T08:00:00.000Z',
    jobOpportunity: {
      id: 'j-1',
      title: 'Full Stack AI Engineer',
      company: 'XYZ AI',
      url: 'https://xyzai.example.com/careers/fullstack-ai',
      location: 'Remote India',
      remoteStatus: 'Remote India',
      postedDate: '2026-09-23',
      description: 'Building autonomous agent workflows and RAG systems. Tech stack: React, Next.js, TypeScript, Python, FastAPI, PostgreSQL, Vector search.',
      source: 'Founder LinkedIn Post',
      hiringSignals: ["We're hiring", "Founding team expansion"],
      requiredSkills: ['React', 'Next.js', 'TypeScript', 'Python', 'FastAPI', 'PostgreSQL', 'RAG'],
      minExperienceYears: 3
    }
  },
  {
    id: 'p-2',
    name: 'Priya Singh',
    jobTitle: 'Technical Recruiter',
    company: 'ABC Technologies',
    companyWebsite: 'https://abctech.example.com',
    location: 'Remote, India',
    connectionDegree: '2nd',
    headline: 'Talent Acquisition Partner @ ABC Technologies | Hiring AI Engineers & Product Engineers',
    notes: 'Reached out about high-growth Series A startup building enterprise AI copilots.',
    linkedinUrl: 'https://linkedin.com/in/priya-singh-abctech',
    classification: 'Recruiter',
    relationshipType: 'Recruiter',
    status: 'Not contacted',
    createdAt: '2026-09-23T10:30:00.000Z',
    updatedAt: '2026-09-23T10:30:00.000Z',
    jobOpportunity: {
      id: 'j-2',
      title: 'AI Engineer / Full Stack',
      company: 'ABC Technologies',
      url: 'https://abctech.example.com/jobs/ai-eng',
      location: 'Remote Worldwide (India eligible)',
      remoteStatus: 'Remote Worldwide',
      postedDate: '2026-09-22',
      description: 'Seeking full stack AI engineers to lead LLM evaluation pipelines, Next.js frontends and FastAPI microservices. LangGraph experience a plus.',
      source: 'LinkedIn Job Board',
      hiringSignals: ['Hiring engineers', 'Urgent replacement'],
      requiredSkills: ['React', 'TypeScript', 'Python', 'FastAPI', 'PostgreSQL', 'LangGraph'],
      minExperienceYears: 3
    }
  },
  {
    id: 'p-3',
    name: 'Vikram Mehta',
    jobTitle: 'CTO & Co-founder',
    company: 'Nexus Scale',
    companyWebsite: 'https://nexusscale.example.com',
    location: 'Mumbai, India (Remote)',
    connectionDegree: '1st',
    headline: 'CTO @ Nexus Scale | Seed Funded | Looking for Founding Engineer #3',
    notes: 'Met at startup demo day. High ownership role with equity.',
    linkedinUrl: 'https://linkedin.com/in/vikram-mehta-nexus',
    classification: 'CTO',
    relationshipType: 'CTO',
    status: 'Not contacted',
    createdAt: '2026-09-24T09:15:00.000Z',
    updatedAt: '2026-09-24T09:15:00.000Z',
    jobOpportunity: {
      id: 'j-3',
      title: 'Founding Engineer (Full Stack / AI)',
      company: 'Nexus Scale',
      url: 'https://nexusscale.example.com/join-founding-team',
      location: 'Remote India',
      remoteStatus: 'Remote India',
      postedDate: '2026-09-24',
      description: 'Looking for founding engineer with solid full-stack experience (Next.js, Python/FastAPI, Postgres, Docker). Direct ownership with founders.',
      source: 'LinkedIn Announcement',
      hiringSignals: ["We're looking for our first 5 engineers", 'Founding role'],
      requiredSkills: ['Next.js', 'React', 'Python', 'FastAPI', 'PostgreSQL', 'Docker'],
      minExperienceYears: 3
    }
  },
  {
    id: 'p-4',
    name: 'Ananya Roy',
    jobTitle: 'Engineering Manager',
    company: 'CloudPulse Systems',
    companyWebsite: 'https://cloudpulse.example.com',
    location: 'Bengaluru / Remote',
    connectionDegree: '2nd',
    headline: 'Engineering Manager @ CloudPulse | Building modern cloud devtools',
    notes: 'Ex-coworker from previous open source project.',
    linkedinUrl: 'https://linkedin.com/in/ananya-roy-cloudpulse',
    classification: 'Engineering Manager',
    relationshipType: 'Engineering Manager',
    status: 'Not contacted',
    createdAt: '2026-09-22T14:00:00.000Z',
    updatedAt: '2026-09-22T14:00:00.000Z',
    jobOpportunity: {
      id: 'j-4',
      title: 'Senior Software Engineer (Full Stack)',
      company: 'CloudPulse Systems',
      url: 'https://cloudpulse.example.com/careers/sr-fullstack',
      location: 'Remote India',
      remoteStatus: 'Remote India',
      postedDate: '2026-09-20',
      description: 'Full stack development with Next.js, TypeScript, PostgreSQL and Kubernetes. Experience with CI/CD and cloud infra.',
      source: 'Company Careers Page',
      hiringSignals: ['Open engineering positions'],
      requiredSkills: ['Next.js', 'TypeScript', 'PostgreSQL', 'Kubernetes', 'Docker'],
      minExperienceYears: 4
    }
  }
];

export const INITIAL_PROSPECTS: Prospect[] = rawProspects.map(p => {
  const score = calculateScoreAndMatching(p, p.jobOpportunity);
  const messages = generatePersonalizedDM(p, p.jobOpportunity);
  return {
    ...p,
    score,
    draftedMessage: messages.day0,
    followUpDay5Message: messages.day5,
    followUpDay12Message: messages.day12
  } as Prospect;
});
