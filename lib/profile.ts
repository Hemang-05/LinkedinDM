import type { UserProfile } from '@/types';

export const EMPTY_PROFILE: UserProfile = {
  name: '',
  title: '',
  yearsOfExperience: undefined,
  skills: [],
  primarySkills: [],
  secondarySkills: [],
  targetRoles: [],
  targetRole: '',
  targetLocations: [],
  location: '',
  workPreference: 'Remote',
  background: '',
  bioSummary: '',
  startupExperienceSummary: '',
  relevantExperience: '',
  agencyName: '',
  agencyServiceSummary: '',
  agencyOffering: ''
};
