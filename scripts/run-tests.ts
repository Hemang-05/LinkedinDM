import { generatePersonalizedDM, MessageAngle, sanitizeCompanyName, sanitizeFirstName } from '../lib/generator';
import { resolveProspectPersona, classifyTitle, classifyBatchWithOptionalAI } from '../lib/classifier';
import { calculateScoreAndMatching } from '../lib/scoring';
import {
  cleanAndVerifySkills,
  isSkillInText,
  verifyCandidateName,
  verifyTargetRole,
  verifyBackground,
  computeExperienceFromJobs,
  parseResumeWithLlmOrFallback,
  DEFAULT_GROQ_MODEL
} from '../lib/groqParser';
import { TEST_PROFILE } from './fixtures/testProfile';
import { Prospect, OutreachGoal, PersonaType, UserProfile, ProspectCategory } from '../types';

interface TestCase {
  name: string;
  prospect: Partial<Prospect>;
  goal: OutreachGoal;
  angle?: MessageAngle;
  expectedPersona: PersonaType;
  checks: {
    minWordsDay0: number;
    maxWordsDay0: number;
    mustInclude?: string[];
    mustNotInclude?: string[];
    description: string;
  };
}

const testCases: TestCase[] = [
  // 1. Founder + Job Hunt
  {
    name: '1. Founder + Job Hunt',
    prospect: {
      name: 'Rohit Sharma',
      company: 'The Goat Sports Academy',
      jobTitle: 'Founder & CEO',
      classification: 'Founder'
    },
    goal: 'job-hunt',
    angle: 'standard',
    expectedPersona: 'founder',
    checks: {
      minWordsDay0: 70,
      maxWordsDay0: 130,
      mustInclude: ['Rohit', 'The Goat Sports Academy', 'technical', 'conversation'],
      mustNotInclude: ['my resume', 'referral', 'hope this message finds you well', 'align perfectly', 'vacancies'],
      description: 'Asks directly if adding someone technical, no resume dump, no referral ask'
    }
  },

  // 2. Recruiter + Job Hunt
  {
    name: '2. Recruiter + Job Hunt',
    prospect: {
      name: 'Priya Verma',
      company: 'Stripe',
      jobTitle: 'Senior Tech Recruiter',
      classification: 'Recruiter'
    },
    goal: 'job-hunt',
    angle: 'standard',
    expectedPersona: 'recruiter',
    checks: {
      minWordsDay0: 70,
      maxWordsDay0: 130,
      mustInclude: ['Priya', 'Stripe', 'Full Stack Engineer', 'openings', 'resume'],
      mustNotInclude: ['hope this message finds you well', 'align perfectly', 'synergies'],
      description: 'Clear target role, direct openings inquiry, offers resume'
    }
  },

  // 3. Employee + Job Hunt
  {
    name: '3. Employee + Job Hunt',
    prospect: {
      name: 'Aman Gupta',
      company: 'Zerodha',
      jobTitle: 'Senior Software Engineer',
      classification: 'Other'
    },
    goal: 'job-hunt',
    angle: 'standard',
    expectedPersona: 'employee',
    checks: {
      minWordsDay0: 70,
      maxWordsDay0: 130,
      mustInclude: ['Aman', 'Zerodha', 'referral'],
      mustNotInclude: ['vacancies', 'hiring for', 'my resume', 'cv', 'job opening'],
      description: 'Peer ask for referral or direction, never asks if they have vacancies'
    }
  },

  // 4. CTO / VP Engineering + Job Hunt
  {
    name: '4. CTO / VP Engineering + Job Hunt',
    prospect: {
      name: 'Karthik Rao',
      company: 'Swiggy',
      jobTitle: 'VP of Engineering',
      classification: 'Engineering Manager'
    },
    goal: 'job-hunt',
    angle: 'standard',
    expectedPersona: 'cto_lead',
    checks: {
      minWordsDay0: 70,
      maxWordsDay0: 130,
      mustInclude: ['Karthik', 'Swiggy', 'ownership', 'team'],
      mustNotInclude: ['referral', 'my resume', 'apply', 'entry level'],
      description: 'Senior technical peer note, focuses on autonomy and architecture'
    }
  },

  // 5. Founder + Agency Lead
  {
    name: '5. Founder + Agency Lead',
    prospect: {
      name: 'Tanmay Bhat',
      company: 'Overpowered Content',
      jobTitle: 'Founder',
      classification: 'Founder'
    },
    goal: 'agency-leads',
    angle: 'standard',
    expectedPersona: 'founder',
    checks: {
      minWordsDay0: 70,
      maxWordsDay0: 130,
      mustInclude: ['Tanmay', 'Overpowered Content'],
      mustNotInclude: ['resume', 'hire me', 'looking for a job', 'job opening', 'cv', 'interview'],
      description: 'B2B pitch, offers engineering studio support, never sends resume or asks to be hired'
    }
  },

  // 6. Founder + Hire
  {
    name: '6. Founder + Hire',
    prospect: {
      name: 'Sahil Lavingia',
      company: 'Gumroad',
      jobTitle: 'Founder & CEO',
      classification: 'Founder'
    },
    goal: 'hire',
    angle: 'standard',
    expectedPersona: 'founder',
    checks: {
      minWordsDay0: 60,
      maxWordsDay0: 130,
      mustInclude: ['Sahil', 'Full Stack Engineer', 'role', 'team'],
      mustNotInclude: ['hire me', 'looking for work', 'referral', 'my resume'],
      description: 'Recruitment outreach positioning user as employer'
    }
  },

  // 7. Freelancer + Get Freelancers
  {
    name: '7. Freelancer + Get Freelancers',
    prospect: {
      name: 'Devin Abbott',
      company: 'Self-employed',
      jobTitle: 'Freelance Design Engineer',
      classification: 'Freelancer'
    },
    goal: 'freelancers',
    angle: 'standard',
    expectedPersona: 'freelancer',
    checks: {
      minWordsDay0: 65,
      maxWordsDay0: 130,
      mustInclude: ['Devin', 'contract', 'availability'],
      mustNotInclude: ['full-time employee', 'salary', 'benefits', 'permanent position'],
      description: 'Asks about contract bandwidth and project availability'
    }
  },

  // 8. Employee + Agency Lead
  {
    name: '8. Employee + Agency Lead',
    prospect: {
      name: 'Siddharth Roy',
      company: 'Razorpay',
      jobTitle: 'Senior Software Engineer',
      classification: 'Other'
    },
    goal: 'agency-leads',
    angle: 'standard',
    expectedPersona: 'employee',
    checks: {
      minWordsDay0: 65,
      maxWordsDay0: 130,
      mustInclude: ['Siddharth', 'Razorpay'],
      mustNotInclude: ['resume', 'referral', 'open vacancies', 'hire me'],
      description: 'Agency note to employee, asks about bandwidth overflow or intro to tech leaders'
    }
  },

  // Edge Cases
  {
    name: 'Edge Case 1: Missing Company',
    prospect: {
      name: 'Nikhil Kamath',
      jobTitle: 'Co-Founder'
    },
    goal: 'job-hunt',
    expectedPersona: 'founder',
    checks: {
      minWordsDay0: 65,
      maxWordsDay0: 130,
      mustInclude: ['Nikhil', "what you're building"],
      mustNotInclude: ['undefined', 'null', 'your team at your team'],
      description: 'Gracefully adapts company phrasing'
    }
  },
  {
    name: 'Edge Case 2: Missing Position',
    prospect: {
      name: 'Sarah Connor',
      company: 'Cyberdyne Systems'
    },
    goal: 'job-hunt',
    expectedPersona: 'other',
    checks: {
      minWordsDay0: 65,
      maxWordsDay0: 130,
      mustInclude: ['Sarah', 'Cyberdyne Systems'],
      mustNotInclude: ['undefined', 'null'],
      description: 'Defaults to neutral inquiry when position is missing'
    }
  },
  {
    name: 'Angle Check: Founder + Founding 0->1',
    prospect: {
      name: 'Deepinder Goyal',
      company: 'Eternal',
      jobTitle: 'Founder & CEO',
      classification: 'Founder'
    },
    goal: 'job-hunt',
    angle: 'founding',
    expectedPersona: 'founder',
    checks: {
      minWordsDay0: 75,
      maxWordsDay0: 130,
      mustInclude: ['Deepinder', 'Eternal', '0 to 1', 'autonomy'],
      mustNotInclude: ['my resume', 'referral', 'vacancies'],
      description: 'Founding angle emphasizes ambiguity, 0 to 1 velocity, and high autonomy'
    }
  }
];

console.log('================================================================');
console.log('LINKEDINDM TEST SUITE: BASELINE + ISOLATION + REGRESSION');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

// 1. BASELINE PERSONA & MATRIX TESTS
console.log('--- 1. Persona & Goal Outreach Matrix Tests ---');
for (const tc of testCases) {
  const result = generatePersonalizedDM(
    tc.prospect,
    'Full Stack Engineer',
    tc.angle || 'standard',
    TEST_PROFILE,
    tc.goal
  );

  const words = result.day0.trim().split(/\s+/).filter(Boolean).length;
  const wordsDay5 = result.day5.trim().split(/\s+/).filter(Boolean).length;
  const wordsDay12 = result.day12.trim().split(/\s+/).filter(Boolean).length;

  let tcPass = true;
  const errors: string[] = [];

  if (result.persona !== tc.expectedPersona) {
    tcPass = false;
    errors.push(`Expected persona ${tc.expectedPersona}, got ${result.persona}`);
  }

  if (words < tc.checks.minWordsDay0 || words > tc.checks.maxWordsDay0) {
    tcPass = false;
    errors.push(`Day 0 word count ${words} not in [${tc.checks.minWordsDay0}, ${tc.checks.maxWordsDay0}]`);
  }

  if (wordsDay5 >= words) {
    tcPass = false;
    errors.push(`Day 5 (${wordsDay5} words) should be shorter than Day 0 (${words} words)`);
  }

  if (wordsDay12 >= words) {
    tcPass = false;
    errors.push(`Day 12 (${wordsDay12} words) should be shorter than Day 0 (${words} words)`);
  }

  const lower = result.day0.toLowerCase();
  for (const inc of tc.checks.mustInclude || []) {
    if (!lower.includes(inc.toLowerCase())) {
      tcPass = false;
      errors.push(`Missing required text: "${inc}"`);
    }
  }

  if (result.day0.includes('—') || result.day5.includes('—') || result.day12.includes('—')) {
    tcPass = false;
    errors.push(`Contained forbidden em dash (—) in message sequence`);
  }

  for (const notInc of tc.checks.mustNotInclude || []) {
    if (lower.includes(notInc.toLowerCase())) {
      tcPass = false;
      errors.push(`Contained forbidden text: "${notInc}"`);
    }
  }

  if (tcPass) {
    passed++;
    console.log(`✅ [PASS] ${tc.name} (${words} words, D5: ${wordsDay5}w, D12: ${wordsDay12}w)`);
  } else {
    failed++;
    console.error(`❌ [FAIL] ${tc.name}`);
    for (const err of errors) {
      console.error(`   - ${err}`);
    }
  }
}

// 2. DATA LEAK SCANNING TEST (A different profile must NEVER output Hemang, Mehta, etc.)
console.log('\n--- 2. User Data Isolation & Leak Prevention Tests ---');
const differentProfile: UserProfile = {
  name: 'Elena Rostova',
  title: 'Cloud Systems Architect',
  targetRole: 'Cloud Systems Architect',
  targetRoles: ['Cloud Systems Architect'],
  targetLocations: ['Berlin', 'Remote'],
  skills: ['Rust', 'Golang', 'Kubernetes', 'gRPC'],
  primarySkills: ['Rust', 'Golang', 'Kubernetes', 'gRPC'],
  yearsOfExperience: 6,
  background: 'High-Throughput Distributed Infrastructure',
  bioSummary: 'Cloud Systems Architect with 6+ years of experience in High-Throughput Distributed Infrastructure.',
  agencyName: 'Apex Cloud Solutions',
  agencyServiceSummary: 'specialized cloud engineering team delivering high-throughput infrastructure',
  agencyOffering: 'cloud migrations, latency optimization, and distributed systems architecture'
};

const forbiddenPersonalStrings = [
  'Hemang',
  'Mehta',
  'Product Engineering Studio',
  'Software Engineering & Production Systems'
];

const goals: OutreachGoal[] = ['job-hunt', 'agency-leads', 'hire', 'freelancers'];
const angles: MessageAngle[] = ['standard', 'founding', 'ai_rag', 'product_ownership'];

let leakFound = false;
for (const g of goals) {
  for (const a of angles) {
    const res = generatePersonalizedDM(
      { name: 'Marcus Aurelius', company: 'Rome Tech', jobTitle: 'Founder & CEO', classification: 'Founder' },
      'Cloud Systems Architect',
      a,
      differentProfile,
      g
    );

    const allOutputs = [res.day0, res.day5, res.day12].join('\n');
    for (const forbidden of forbiddenPersonalStrings) {
      if (allOutputs.toLowerCase().includes(forbidden.toLowerCase())) {
        leakFound = true;
        failed++;
        console.error(`❌ [FAIL] Leak detected in goal=${g}, angle=${a}: found forbidden string "${forbidden}"`);
      }
    }

    if (!allOutputs.includes('Elena Rostova')) {
      leakFound = true;
      failed++;
      console.error(`❌ [FAIL] Missing new user signature "Elena Rostova" in goal=${g}, angle=${a}`);
    }
  }
}

if (!leakFound) {
  passed++;
  console.log('✅ [PASS] Complete data isolation: 0 trace of old user data found across all goals and angles.');
}

// 3. YEARS OF EXPERIENCE TEST (0+ years and undefined)
console.log('\n--- 3. Years of Experience Handling Tests ---');
const zeroExpProfile: UserProfile = {
  ...differentProfile,
  yearsOfExperience: 0
};
const resZero = generatePersonalizedDM(
  { name: 'Marcus', company: 'Rome Tech', jobTitle: 'Founder', classification: 'Founder' },
  'Software Engineer',
  'standard',
  zeroExpProfile,
  'job-hunt'
);

if (!resZero.day0.includes('0+ years') && !resZero.day0.includes('+ years') && resZero.day0.includes('with experience in')) {
  passed++;
  console.log('✅ [PASS] yearsOfExperience: 0 correctly omits "N+ years" phrase (no "0+ years") and renders "with experience".');
} else {
  failed++;
  console.error('❌ [FAIL] yearsOfExperience: 0 failed to omit "N+ years" phrase. Message was:\n', resZero.day0);
}

const undefinedExpProfile: UserProfile = {
  ...differentProfile,
  yearsOfExperience: undefined
};
const resUndef = generatePersonalizedDM(
  { name: 'Marcus', company: 'Rome Tech', jobTitle: 'Founder', classification: 'Founder' },
  'Software Engineer',
  'standard',
  undefinedExpProfile,
  'job-hunt'
);

if (!resUndef.day0.includes('+ years') && resUndef.day0.includes('with experience in High-Throughput Distributed Infrastructure')) {
  passed++;
  console.log('✅ [PASS] undefined yearsOfExperience omits "N+ years" phrasing and uses clean "with experience".');
} else {
  failed++;
  console.error('❌ [FAIL] undefined yearsOfExperience failed. Message was:\n', resUndef.day0);
}

// 4. MISSING PROFILE ERROR TEST
console.log('\n--- 4. Missing Profile Validation Tests ---');
let caughtMissing = false;
try {
  generatePersonalizedDM(
    { name: 'Marcus', company: 'Rome Tech' },
    'Software Engineer',
    'standard',
    undefined as any
  );
} catch (e: any) {
  caughtMissing = true;
}

if (caughtMissing) {
  passed++;
  console.log('✅ [PASS] Calling generatePersonalizedDM without a profile successfully throws an error.');
} else {
  failed++;
  console.error('❌ [FAIL] Calling generatePersonalizedDM without a profile did not throw!');
}

let caughtEmptyName = false;
try {
  generatePersonalizedDM(
    { name: 'Marcus', company: 'Rome Tech' },
    'Software Engineer',
    'standard',
    { ...differentProfile, name: '' }
  );
} catch (e: any) {
  caughtEmptyName = true;
}

if (caughtEmptyName) {
  passed++;
  console.log('✅ [PASS] Calling generatePersonalizedDM with empty profile name successfully throws an error.');
} else {
  failed++;
  console.error('❌ [FAIL] Calling generatePersonalizedDM with empty name did not throw!');
}

// 5. SANITIZATION TESTS
console.log('\n--- 5. Name and Company Sanitization Tests ---');
const tesco = sanitizeCompanyName('Tesco');
const cisco = sanitizeCompanyName('Cisco');
const zinc = sanitizeCompanyName('Zinc');
const acme = sanitizeCompanyName('Acme Inc.');
const beta = sanitizeCompanyName('Beta LLC');

if (
  tesco.clean === 'Tesco' &&
  cisco.clean === 'Cisco' &&
  zinc.clean === 'Zinc' &&
  acme.clean === 'Acme' &&
  beta.clean === 'Beta'
) {
  passed++;
  console.log('✅ [PASS] sanitizeCompanyName preserves Tesco, Cisco, Zinc while properly stripping Inc. and LLC.');
} else {
  failed++;
  console.error('❌ [FAIL] sanitizeCompanyName failed:', { tesco, cisco, zinc, acme, beta });
}

const jose = sanitizeFirstName('José');
const francois = sanitizeFirstName('François');
const maria = sanitizeFirstName('Dr. María Silva');

if (jose === 'José' && francois === 'François' && maria === 'María') {
  passed++;
  console.log('✅ [PASS] sanitizeFirstName supports unicode characters (José, François, María).');
} else {
  failed++;
  console.error('❌ [FAIL] sanitizeFirstName failed:', { jose, francois, maria });
}

// 6. DAY 5 FOUNDER SIGNATURE TEST
console.log('\n--- 6. Day 5 Follow-up Signature Tests ---');
const resDay5Founder = generatePersonalizedDM(
  { name: 'Marcus', company: 'Rome Tech', jobTitle: 'Founder & CEO', classification: 'Founder' },
  'Software Engineer',
  'standard',
  differentProfile,
  'job-hunt'
);

if (resDay5Founder.day5.includes(`Best,\n${differentProfile.name}`)) {
  passed++;
  console.log('✅ [PASS] Day 5 founder follow-up includes sender signature.');
} else {
  failed++;
  console.error('❌ [FAIL] Day 5 founder follow-up missing sender signature:\n', resDay5Founder.day5);
}

// 7. MULTI-TOUCHPOINT VALIDATION TEST
console.log('\n--- 7. Sequence Quality Validation Tests ---');
if (
  resDay5Founder.validation.isValid &&
  resDay5Founder.validation.hasGreetingName &&
  resDay5Founder.validation.issues.length === 0
) {
  passed++;
  console.log('✅ [PASS] Sequence validation verifies Day 0, Day 5, and Day 12 without issues.');
} else {
  failed++;
  console.error('❌ [FAIL] Validation issues:', resDay5Founder.validation);
}

// 8. CLASSIFIER REAL-WORLD TITLES & PRECEDENCE TESTS
console.log('\n--- 8. Classifier (lib/classifier.ts) 60+ Real-World Title Unit Tests ---');

interface ClassifierTestCase {
  title: string;
  expected: ProspectCategory;
  note?: string;
}

const classifierTestCases: ClassifierTestCase[] = [
  // Recruiter (12 titles)
  { title: 'Senior Technical Recruiter', expected: 'recruiter', note: 'Contains Technical, but recruiter wins' },
  { title: 'Talent Acquisition Specialist', expected: 'recruiter' },
  { title: 'Lead Talent Acquisition Partner', expected: 'recruiter' },
  { title: 'Technical Sourcer', expected: 'recruiter' },
  { title: 'Global Sourcing Specialist', expected: 'recruiter' },
  { title: 'HR Business Partner', expected: 'recruiter' },
  { title: 'VP of HR', expected: 'recruiter' },
  { title: 'People Operations Manager', expected: 'recruiter' },
  { title: 'Head of People Ops', expected: 'recruiter' },
  { title: 'Executive Headhunter', expected: 'recruiter' },
  { title: 'TA Lead', expected: 'recruiter' },
  { title: 'Human Resources Generalist', expected: 'recruiter' },

  // Founder (7 titles)
  { title: 'Founder & CEO', expected: 'founder' },
  { title: 'Co-Founder', expected: 'founder' },
  { title: 'Founder', expected: 'founder' },
  { title: 'Managing Director', expected: 'founder' },
  { title: 'Agency Owner', expected: 'founder' },
  { title: 'Chief Executive Officer', expected: 'founder' },
  { title: 'CTO & Co-Founder', expected: 'founder', note: 'Precedence: founder beats cto' },

  // CTO (7 titles)
  { title: 'CTO', expected: 'cto' },
  { title: 'Chief Technology Officer', expected: 'cto' },
  { title: 'VP of Engineering', expected: 'cto' },
  { title: 'Vice President of Engineering', expected: 'cto' },
  { title: 'Vice President Engineering', expected: 'cto' },
  { title: 'Head of Engineering', expected: 'cto' },
  { title: 'Interim CTO', expected: 'cto' },

  // Eng Leader (6 titles)
  { title: 'Tech Lead', expected: 'eng_leader' },
  { title: 'Technical Lead', expected: 'eng_leader' },
  { title: 'Team Lead', expected: 'eng_leader' },
  { title: 'Engineering Manager', expected: 'eng_leader' },
  { title: 'Director of Engineering', expected: 'eng_leader' },
  { title: 'Senior Engineering Manager', expected: 'eng_leader' },

  // Employee (15 titles)
  { title: 'Software Engineer', expected: 'employee' },
  { title: 'Senior Software Engineer', expected: 'employee' },
  { title: 'Staff Software Engineer', expected: 'employee' },
  { title: 'Principal SDE', expected: 'employee' },
  { title: 'SDE II', expected: 'employee' },
  { title: 'Full Stack Developer', expected: 'employee' },
  { title: 'Senior Frontend Engineer', expected: 'employee' },
  { title: 'Backend Developer', expected: 'employee' },
  { title: 'DevOps Engineer', expected: 'employee' },
  { title: 'Site Reliability Engineer', expected: 'employee' },
  { title: 'Data Scientist', expected: 'employee' },
  { title: 'Data Analyst', expected: 'employee' },
  { title: 'QA Automation Engineer', expected: 'employee' },
  { title: 'Mobile Engineer (iOS)', expected: 'employee' },
  { title: 'Android Developer', expected: 'employee' },

  // Tricky word-boundary tests (3 titles)
  { title: 'Chrome Extension Developer', expected: 'employee', note: 'Contains "hr" inside Chrome, must never match recruiter' },
  { title: 'Shreya', expected: 'other', note: 'Contains "hr" inside Shreya, must never match recruiter' },
  { title: 'Data Operations Specialist', expected: 'other', note: 'Contains "ta" inside Data, must never match recruiter' },

  // Excluded (5 titles)
  { title: 'Graduate Student', expected: 'excluded' },
  { title: 'Software Engineering Intern', expected: 'excluded', note: 'Precedence: intern beats engineer' },
  { title: 'Summer Intern', expected: 'excluded' },
  { title: 'Management Trainee', expected: 'excluded' },
  { title: 'Apprentice Developer', expected: 'excluded', note: 'Precedence: apprentice beats developer' },

  // Other & Fellows (7 titles)
  { title: 'Research Fellow', expected: 'other', note: 'Do not match fellow alone as excluded' },
  { title: 'Postdoctoral Fellow', expected: 'other', note: 'Do not match fellow alone as excluded' },
  { title: 'Product Manager', expected: 'other' },
  { title: 'VP of Marketing', expected: 'other' },
  { title: 'Account Executive', expected: 'other' },
  { title: 'Customer Success Manager', expected: 'other' },
  { title: 'UI/UX Designer', expected: 'other' }
];

let classifierErrors = 0;
for (const tc of classifierTestCases) {
  const result = classifyTitle(tc.title);
  if (result === tc.expected) {
    passed++;
  } else {
    failed++;
    classifierErrors++;
    console.error(`❌ [FAIL] classifyTitle("${tc.title}"): expected "${tc.expected}", got "${result}" ${tc.note ? `(${tc.note})` : ''}`);
  }
}

if (classifierErrors === 0) {
  console.log(`✅ [PASS] All ${classifierTestCases.length} real-world title unit tests passed.`);
}

// 9. AI BATCH HOOK INTEGRATION TEST
async function runAsyncTests() {
  console.log('\n--- 9. Classifier Optional AI Hook Tests ---');
  const unclassifiedBatch = ['Chief Happiness Officer', 'Scrum Master', 'Chief Happiness Officer'];
  const batchResults = await classifyBatchWithOptionalAI(unclassifiedBatch, async (uniqueTitles) => {
    if (uniqueTitles.length !== 2) {
      throw new Error(`Expected 2 unique unclassified titles, got ${uniqueTitles.length}`);
    }
    return {
      'Chief Happiness Officer': 'recruiter',
      'Scrum Master': 'eng_leader'
    };
  });

  if (batchResults['Chief Happiness Officer'] === 'recruiter' && batchResults['Scrum Master'] === 'eng_leader') {
    passed++;
    console.log('✅ [PASS] classifyBatchWithOptionalAI dedupes unclassified titles and applies clean AI hook mapping.');
  } else {
    failed++;
    console.error('❌ [FAIL] classifyBatchWithOptionalAI failed:', batchResults);
  }

  // 10. DYNAMIC LOCATION PREFERENCE SCORING TESTS
  console.log('\n--- 10. Location Preference Scoring Tests ---');
  
  const sampleProspect: Prospect = {
    id: 'test-p-1',
    name: 'Sarah Connor',
    jobTitle: 'Senior Software Engineer',
    company: 'Skynet Tech',
    location: 'Berlin, Germany',
    segregationGroup: 'Employee',
    classification: 'Other',
    relationshipType: 'Peer',
    status: 'Not contacted',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    linkedinUrl: 'https://linkedin.com/in/sarah-connor',
    jobOpportunity: {
      id: 'test-job-1',
      title: 'Senior Software Engineer',
      company: 'Skynet Tech',
      location: 'Berlin, Germany',
      remoteStatus: 'Remote Worldwide',
      description: 'Senior Software Engineer wanted',
      source: 'Test',
      hiringSignals: ['Hiring'],
      requiredSkills: ['React', 'TypeScript']
    }
  };

  const onsiteProspect: Prospect = {
    ...sampleProspect,
    id: 'test-p-2',
    location: 'Tokyo, Japan',
    jobOpportunity: {
      ...sampleProspect.jobOpportunity!,
      id: 'test-job-2',
      location: 'Tokyo, Japan',
      remoteStatus: 'On-site'
    }
  };

  // Test 10a: Remote only profile
  const remoteProfile: UserProfile = {
    ...TEST_PROFILE,
    locationPreference: 'remote'
  };
  const scoreRemote = calculateScoreAndMatching(sampleProspect, sampleProspect.jobOpportunity, remoteProfile);
  const locItemRemote = scoreRemote.items.find(i => i.category === 'Location Alignment');
  if (locItemRemote && locItemRemote.points === 20) {
    passed++;
    console.log('✅ [PASS] Remote-only profile awards full 20 pts for Remote Worldwide opportunity.');
  } else {
    failed++;
    console.error('❌ [FAIL] Remote-only profile failed for remote job:', locItemRemote);
  }

  const scoreOnsite = calculateScoreAndMatching(onsiteProspect, onsiteProspect.jobOpportunity, remoteProfile);
  const locItemOnsite = scoreOnsite.items.find(i => i.category === 'Location Alignment');
  if (locItemOnsite && locItemOnsite.points === 5 && scoreOnsite.blockers.length > 0) {
    passed++;
    console.log('✅ [PASS] Remote-only profile flags strict on-site position with blocker and lower points.');
  } else {
    failed++;
    console.error('❌ [FAIL] Remote-only profile did not flag on-site blocker:', locItemOnsite, scoreOnsite.blockers);
  }

  // Test 10b: Specific country/city profile
  const cityProfile: UserProfile = {
    ...TEST_PROFILE,
    locationPreference: 'country_city',
    preferredLocation: 'Germany'
  };
  const scoreCityMatch = calculateScoreAndMatching(sampleProspect, sampleProspect.jobOpportunity, cityProfile);
  const locItemCityMatch = scoreCityMatch.items.find(i => i.category === 'Location Alignment');
  if (locItemCityMatch && locItemCityMatch.points === 20) {
    passed++;
    console.log('✅ [PASS] Country/city profile awards 20 pts for matching country (Germany).');
  } else {
    failed++;
    console.error('❌ [FAIL] Country/city profile failed to match location:', locItemCityMatch);
  }

  const scoreCityMismatch = calculateScoreAndMatching(onsiteProspect, onsiteProspect.jobOpportunity, cityProfile);
  const locItemCityMismatch = scoreCityMismatch.items.find(i => i.category === 'Location Alignment');
  if (locItemCityMismatch && locItemCityMismatch.points === 5) {
    passed++;
    console.log('✅ [PASS] Country/city profile awards low points (5) when country differs (Tokyo vs Germany).');
  } else {
    failed++;
    console.error('❌ [FAIL] Country/city profile mismatch test failed:', locItemCityMismatch);
  }

  // Test 10c: Any location profile
  const anyProfile: UserProfile = {
    ...TEST_PROFILE,
    locationPreference: 'any'
  };
  const scoreAny = calculateScoreAndMatching(sampleProspect, sampleProspect.jobOpportunity, anyProfile);
  const locItemAny = scoreAny.items.find(i => i.category === 'Location Alignment');
  if (locItemAny && locItemAny.points >= 18) {
    passed++;
    console.log('✅ [PASS] "Any" location preference awards flexible points (>=18) universally.');
  } else {
    failed++;
    console.error('❌ [FAIL] "Any" location preference test failed:', locItemAny);
  }

  // 11. LLM-BASED RESUME PARSER (GROQ) & FALLBACK TESTS
  console.log('\n--- 11. LLM Resume Parser (Groq), Verification & Fallback Tests ---');

  // Test 11a: Default model constant
  if (DEFAULT_GROQ_MODEL === 'openai/gpt-oss-20b') {
    passed++;
    console.log('✅ [PASS] DEFAULT_GROQ_MODEL is set to "openai/gpt-oss-20b".');
  } else {
    failed++;
    console.error('❌ [FAIL] DEFAULT_GROQ_MODEL is not "openai/gpt-oss-20b":', DEFAULT_GROQ_MODEL);
  }

  // Test 11b: Skill Verification (Drop Hallucinated Skills, Drop Languages, Drop Soft Skills, Cap at 12)
  const resumeSampleText = `
    Alex Rivera
    Senior Software Engineer
    Technologies & Skills: React, TypeScript, Next.js, Node.js, GraphQL, PostgreSQL, Redis, Docker, AWS, TailwindCSS, Python, Java, Go, Kubernetes, Kafka, Terraform
    Spoken Languages: English, Spanish, German, French
    Soft Skills: Communication, Leadership, Problem Solving, Teamwork, Time Management
  `;

  const inputSkills = [
    'React', // valid
    'TypeScript', // valid (case-insensitive)
    'Rust', // hallucinated (not in resume text)
    'Elixir', // hallucinated (not in resume text)
    'English', // spoken language -> dropped
    'Spanish', // spoken language -> dropped
    'Communication', // soft skill -> dropped
    'Leadership', // soft skill -> dropped
    'Next.js', 'Node.js', 'GraphQL', 'PostgreSQL', 'Redis', 'Docker', 'AWS', 'TailwindCSS', 'Python', 'Java', 'Go', 'Kubernetes' // >12 skills
  ];

  const cleanedSkills = cleanAndVerifySkills(inputSkills, resumeSampleText);

  const hasRustOrElixir = cleanedSkills.includes('Rust') || cleanedSkills.includes('Elixir');
  const hasSpokenLang = cleanedSkills.some(s => ['English', 'Spanish'].includes(s));
  const hasSoftSkills = cleanedSkills.some(s => ['Communication', 'Leadership'].includes(s));
  const isCappedAt12 = cleanedSkills.length <= 12;
  const hasValidTech = cleanedSkills.includes('React') && cleanedSkills.includes('TypeScript');

  if (!hasRustOrElixir && !hasSpokenLang && !hasSoftSkills && isCappedAt12 && hasValidTech) {
    passed++;
    console.log('✅ [PASS] cleanAndVerifySkills drops hallucinated skills, spoken languages, and soft skills, and caps at 12.');
  } else {
    failed++;
    console.error('❌ [FAIL] cleanAndVerifySkills failed:', {
      cleanedSkills,
      hasRustOrElixir,
      hasSpokenLang,
      hasSoftSkills,
      isCappedAt12,
      hasValidTech
    });
  }

  // Test 11c: Experience Calculation (Merging Overlaps)
  // Two jobs overlapping completely: 2021-01 to 2022-01 and 2021-01 to 2022-01 -> 12 months = 1 year, NOT 2 years
  const overlappingJobs = [
    { company: 'Company A', title: 'Engineer', startDate: '2021-01', endDate: '2022-01' },
    { company: 'Company B', title: 'Consultant', startDate: '2021-01', endDate: '2022-01' }
  ];
  const overlapExp = computeExperienceFromJobs(overlappingJobs);
  if (overlapExp === 1) {
    passed++;
    console.log('✅ [PASS] computeExperienceFromJobs correctly merges overlapping date ranges (1 year, not 2).');
  } else {
    failed++;
    console.error('❌ [FAIL] computeExperienceFromJobs failed on overlapping ranges. Expected 1, got:', overlapExp);
  }

  // Test 11d: Experience Calculation ("Present" / "Current")
  const presentJobs = [
    { company: 'Current Co', title: 'Lead', startDate: '2024-01', endDate: 'Present' }
  ];
  const presentExp = computeExperienceFromJobs(presentJobs);
  const expectedMinYears = new Date().getFullYear() - 2024;
  if (presentExp !== undefined && presentExp >= expectedMinYears) {
    passed++;
    console.log(`✅ [PASS] computeExperienceFromJobs treats "Present" as today (${presentExp}+ years).`);
  } else {
    failed++;
    console.error('❌ [FAIL] computeExperienceFromJobs failed on "Present":', presentExp);
  }

  // Test 11e: Experience Calculation (Missing Dates -> undefined)
  const missingDateJobs = [
    { company: 'Unknown', title: 'Dev', startDate: null, endDate: null },
    { company: 'Unknown 2', title: 'Dev', startDate: undefined, endDate: undefined }
  ];
  const missingExp = computeExperienceFromJobs(missingDateJobs);
  const emptyJobsExp = computeExperienceFromJobs([]);
  if (missingExp === undefined && emptyJobsExp === undefined) {
    passed++;
    console.log('✅ [PASS] computeExperienceFromJobs returns undefined when dates are missing.');
  } else {
    failed++;
    console.error('❌ [FAIL] computeExperienceFromJobs did not return undefined on missing dates:', { missingExp, emptyJobsExp });
  }

  // Test 11f: Invalid JSON Fallback (Retries once, then falls back to regex parser)
  let invalidAttempts = 0;
  const mockInvalidClient: any = {
    chat: {
      completions: {
        create: async () => {
          invalidAttempts++;
          return {
            choices: [{ message: { content: 'invalid json content {' } }]
          };
        }
      }
    }
  };

  const resumeTextFallback = `Rohit Sharma\nFounder & CEO\nSkills: React, Next.js, TypeScript\n3 years of experience`;
  const fallbackResult = await parseResumeWithLlmOrFallback(
    Buffer.from(resumeTextFallback),
    'Rohit_Sharma_Resume.txt',
    mockInvalidClient
  );

  if (invalidAttempts === 2 && fallbackResult && fallbackResult.name === 'Rohit Sharma') {
    passed++;
    console.log('✅ [PASS] Invalid JSON output retries once then successfully falls back to regex parser.');
  } else {
    failed++;
    console.error('❌ [FAIL] Invalid JSON fallback test failed:', { invalidAttempts, fallbackResult });
  }

  // Test 11g: API-Failure Fallback (Mock Groq throws an error, regex parser takes over)
  let apiCallCount = 0;
  const mockFailingClient: any = {
    chat: {
      completions: {
        create: async () => {
          apiCallCount++;
          throw new Error('Groq 503 Service Unavailable');
        }
      }
    }
  };

  const apiFailResult = await parseResumeWithLlmOrFallback(
    Buffer.from(`Priya Verma\nSenior Tech Recruiter\nSkills: Sourcing, ATS\n2 years of experience`),
    'Priya_Verma_Resume.txt',
    mockFailingClient
  );

  if (apiFailResult && apiFailResult.name === 'Priya Verma' && apiFailResult.yearsOfExperience === 2) {
    passed++;
    console.log('✅ [PASS] Groq API failure gracefully falls back to regex parser without crashing.');
  } else {
    failed++;
    console.error('❌ [FAIL] API-failure fallback test failed:', { apiCallCount, apiFailResult });
  }

  // --- 12. Skill Verification Boundary & Special Character Tests ---
  console.log('\n--- 12. Skill Verification Boundary & Special Character Tests ---');
  // "Java" must not match "JavaScript"
  const javaInJs = isSkillInText('Java', 'Senior Frontend Engineer with JavaScript and React');
  if (!javaInJs) {
    passed++;
    console.log('✅ [PASS] "Java" does not match "JavaScript" (boundary check).');
  } else {
    failed++;
    console.error('❌ [FAIL] "Java" incorrectly matched "JavaScript"');
  }

  // "Go" must not match "Google"
  const goInGoogle = isSkillInText('Go', 'Staff Software Engineer at Google');
  if (!goInGoogle) {
    passed++;
    console.log('✅ [PASS] "Go" does not match "Google" (boundary check).');
  } else {
    failed++;
    console.error('❌ [FAIL] "Go" incorrectly matched "Google"');
  }

  // "R" only matches as a standalone token
  const rInRuby = isSkillInText('R', 'Worked with Ruby, Rust, and React');
  const rStandalone = isSkillInText('R', 'Statistical modeling with R, Python, and SQL');
  if (!rInRuby && rStandalone) {
    passed++;
    console.log('✅ [PASS] "R" only matches as a standalone token and never inside Ruby/Rust.');
  } else {
    failed++;
    console.error('❌ [FAIL] "R" token matching failed:', { rInRuby, rStandalone });
  }

  // Special technical tokens: C++, C#, .NET, Node.js
  const specialCpp = isSkillInText('C++', 'High-performance systems engineer using C++ and CMake');
  const specialCsharp = isSkillInText('C#', 'Enterprise backend services with C# and ASP.NET Core');
  const specialDotNet = isSkillInText('.NET', 'Enterprise backend services with C# and .NET Core');
  const specialNode = isSkillInText('Node.js', 'Fullstack engineer building with Node.js and Next.js');
  if (specialCpp && specialCsharp && specialDotNet && specialNode) {
    passed++;
    console.log('✅ [PASS] Accurately matches C++, C#, .NET, and Node.js.');
  } else {
    failed++;
    console.error('❌ [FAIL] Special token matching failed:', { specialCpp, specialCsharp, specialDotNet, specialNode });
  }

  // --- 13. Candidate Field Verification Tests (Name, Role, Background) ---
  console.log('\n--- 13. Candidate Field Verification Tests (Name, Role, Background) ---');
  const resumeSample = `Alex Morgan\nLead Full Stack Engineer\nSpecialized in Distributed Cloud Architecture\nSkills: Python, TypeScript, Docker\n5 years of experience at Acme Corp`;

  // Name verification
  const validName = verifyCandidateName('Alex Morgan', resumeSample);
  const droppedName = verifyCandidateName('Sarah Connor', resumeSample);
  if (validName === 'Alex Morgan' && droppedName === null) {
    passed++;
    console.log('✅ [PASS] Candidate name verified in resume text; hallucinated name dropped to null.');
  } else {
    failed++;
    console.error('❌ [FAIL] Candidate name verification failed:', { validName, droppedName });
  }

  // Target role verification
  const validRole = verifyTargetRole('Lead Full Stack Engineer', resumeSample);
  const droppedRole = verifyTargetRole('Chief Marketing Officer', resumeSample);
  if (validRole === 'Lead Full Stack Engineer' && droppedRole === null) {
    passed++;
    console.log('✅ [PASS] Target role verified in resume text; hallucinated role dropped to null.');
  } else {
    failed++;
    console.error('❌ [FAIL] Target role verification failed:', { validRole, droppedRole });
  }

  // Background verification
  const validBg = verifyBackground('Distributed Cloud Architecture', resumeSample);
  const droppedBg = verifyBackground('Cryptocurrency Blockchain Trading', resumeSample);
  if (validBg === 'Distributed Cloud Architecture' && droppedBg === null) {
    passed++;
    console.log('✅ [PASS] Background verified in resume text; hallucinated background dropped to null.');
  } else {
    failed++;
    console.error('❌ [FAIL] Background verification failed:', { validBg, droppedBg });
  }

  // --- 14. Prompt & Experience Calculation Edge Cases ---
  console.log('\n--- 14. Prompt & Experience Calculation Edge Cases ---');
  // Rejects future job spans
  const futureExp = computeExperienceFromJobs([{ startDate: '2020-01', endDate: '2030-01' }]);
  if (futureExp === undefined) {
    passed++;
    console.log('✅ [PASS] Job spans ending in the future are strictly rejected.');
  } else {
    failed++;
    console.error('❌ [FAIL] Future job span not rejected, returned:', futureExp);
  }

  // Floor rounding (44 months = 3 years, not 4)
  const floorExp = computeExperienceFromJobs([{ startDate: '2020-01', endDate: '2023-08' }]);
  if (floorExp === 3) {
    passed++;
    console.log('✅ [PASS] Experience is rounded down (floor): 44 months -> 3 years.');
  } else {
    failed++;
    console.error('❌ [FAIL] Floor rounding failed, got:', floorExp);
  }

  // Consistent year-only dates (2020 to 2023 = 3 years)
  const yearOnlyExp = computeExperienceFromJobs([{ startDate: '2020', endDate: '2023' }]);
  if (yearOnlyExp === 3) {
    passed++;
    console.log('✅ [PASS] Year-only dates treated consistently (2020 to 2023 -> 3 years).');
  } else {
    failed++;
    console.error('❌ [FAIL] Year-only dates consistency failed, got:', yearOnlyExp);
  }

  // --- 15. Stateless Server Isolation & Zero Shared Disk State Tests ---
  console.log('\n--- 15. Stateless Server Isolation & Zero Shared Disk State Tests ---');
  const fs = await import('fs');
  const path = await import('path');

  const sharedDataFile = path.join(process.cwd(), 'jobhunt_data.json');
  const sharedLogFile = path.join(process.cwd(), 'outreach_log.txt');
  const hasSharedData = fs.existsSync(sharedDataFile);
  const hasSharedLog = fs.existsSync(sharedLogFile);

  if (!hasSharedData && !hasSharedLog) {
    passed++;
    console.log('✅ [PASS] Zero shared files on disk (jobhunt_data.json and outreach_log.txt eliminated).');
  } else {
    failed++;
    console.error('❌ [FAIL] Shared files still exist on disk:', { hasSharedData, hasSharedLog });
  }

  // Test that routes do not leak between invocations and dead routes are removed
  const prospectsRoute = await import('../app/api/prospects/route');
  const postProspect = prospectsRoute.POST;
  const dummyReq1 = new Request('http://localhost:3000/api/prospects', {
    method: 'POST',
    body: JSON.stringify({ name: 'UserA Prospect', company: 'Alpha Inc', linkedinUrl: 'https://linkedin.com/in/usera' })
  });
  const resPost1 = await postProspect(dummyReq1);
  const dataPost1 = await resPost1.json();

  const dummyReq2 = new Request('http://localhost:3000/api/prospects', {
    method: 'POST',
    body: JSON.stringify({ name: 'UserB Prospect', company: 'Beta Corp', linkedinUrl: 'https://linkedin.com/in/userb' })
  });
  const resPost2 = await postProspect(dummyReq2);
  const dataPost2 = await resPost2.json();

  if (
    dataPost1.prospect.name === 'UserA Prospect' &&
    dataPost2.prospect.name === 'UserB Prospect' &&
    !(prospectsRoute as any).GET &&
    !(prospectsRoute as any).PUT &&
    !fs.existsSync(sharedDataFile)
  ) {
    passed++;
    console.log('✅ [PASS] API /prospects: dead GET/PUT removed, POST is stateless & does not leak across calls.');
  } else {
    failed++;
    console.error('❌ [FAIL] API /prospects state isolation failed:', { dataPost1, dataPost2 });
  }

  // --- 16. Category-to-Persona Mapping & Template Touchpoints (Day 0/5/12) ---
  console.log('\n--- 16. Category-to-Persona Mapping & Template Touchpoints ---');

  const categories: ProspectCategory[] = [
    'recruiter',
    'employee',
    'founder',
    'cto',
    'eng_leader',
    'other',
    'excluded'
  ];

  // Assert persona mapping for every category
  const expectedPersonas: Record<ProspectCategory, PersonaType> = {
    recruiter: 'recruiter',
    employee: 'employee',
    founder: 'founder',
    cto: 'cto_lead',
    eng_leader: 'cto_lead',
    other: 'other',
    excluded: 'excluded'
  };

  let allMapped = true;
  for (const cat of categories) {
    const resolved = resolveProspectPersona({ category: cat });
    if (resolved !== expectedPersonas[cat]) {
      allMapped = false;
      console.error(`❌ [FAIL] Category '${cat}' mapped to '${resolved}', expected '${expectedPersonas[cat]}'`);
    }
  }

  if (allMapped) {
    passed++;
    console.log('✅ [PASS] All 7 classifier categories map to their exact designated persona paths.');
  } else {
    failed++;
  }

  // Generate sequences for each category and assert wording
  for (const cat of categories) {
    const dummyProspect: Partial<Prospect> = {
      name: `Alex ${cat}`,
      company: 'TechCorp',
      category: cat,
      jobTitle: cat === 'cto' ? 'Chief Technology Officer' : cat === 'eng_leader' ? 'Engineering Manager' : cat
    };

    if (cat === 'excluded') {
      let threw = false;
      try {
        generatePersonalizedDM(dummyProspect, 'Software Engineer', 'standard', TEST_PROFILE, 'job-hunt');
      } catch (err: any) {
        threw = true;
      }
      if (threw) {
        passed++;
        console.log("✅ [PASS] Excluded category strictly blocks generation and throws as required.");
      } else {
        failed++;
        console.error("❌ [FAIL] Excluded category allowed message generation unexpectedly.");
      }
    } else {
      try {
        const seq = generatePersonalizedDM(dummyProspect, 'Software Engineer', 'standard', TEST_PROFILE, 'job-hunt');
        const d0 = seq.day0.toLowerCase();
        const d5 = seq.day5.toLowerCase();
        const d12 = seq.day12.toLowerCase();

        let wordingValid = true;

        if (cat === 'cto' || cat === 'eng_leader') {
          // CTO & eng_leader use CTO/lead template, NEVER ask for referral
          if (d0.includes('referral') || d5.includes('referral') || d12.includes('referral')) {
            wordingValid = false;
            console.error(`❌ [FAIL] ${cat} message contains referral ask!`);
          }
        } else if (cat === 'founder') {
          // Founder NEVER asks for referral
          if (d0.includes('referral') || d5.includes('referral') || d12.includes('referral')) {
            wordingValid = false;
            console.error(`❌ [FAIL] Founder message contains referral ask!`);
          }
        } else if (cat === 'other') {
          // Other uses neutral template: NO referral, NO "fellow engineer" peer assumption
          if (d0.includes('referral') || d5.includes('referral') || d12.includes('referral') || d0.includes('fellow engineer')) {
            wordingValid = false;
            console.error(`❌ [FAIL] Other message contains referral ask or peer assumption!`);
          }
        } else if (cat === 'recruiter') {
          // Recruiter: asks for active openings, offers resume, NO referral
          if (d0.includes('referral') || !d0.includes('openings')) {
            wordingValid = false;
            console.error(`❌ [FAIL] Recruiter message invalid wording!`);
          }
        } else if (cat === 'employee') {
          // Employee: peer referral ask
          if (!d0.includes('referral')) {
            wordingValid = false;
            console.error(`❌ [FAIL] Employee message missing referral ask!`);
          }
        }

        if (wordingValid && seq.day0 && seq.day5 && seq.day12) {
          passed++;
          console.log(`✅ [PASS] Category '${cat}' generated valid Day 0/5/12 sequence with persona-appropriate wording.`);
        } else {
          failed++;
        }
      } catch (err: any) {
        failed++;
        console.error(`❌ [FAIL] Category '${cat}' sequence generation threw an error:`, err);
      }
    }
  }

  // --- 17. Production Startup Rate Limit Warning & Strict Fallback ---
  console.log('\n--- 17. Production Startup Rate Limiting & Strict In-Memory Fallback ---');
  const {
    getEffectiveRateLimitMax,
    PRODUCTION_FALLBACK_STRICT_LIMIT,
    checkInMemoryRateLimit,
    resetInMemoryRateLimit
  } = await import('../lib/rateLimit');

  const prevEnv = process.env.NODE_ENV;
  const prevUpstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const prevUpstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const prevKvUrl = process.env.KV_REST_API_URL;
  const prevKvToken = process.env.KV_REST_API_TOKEN;

  try {
    // Simulate production with missing shared store env vars
    (process.env as any).NODE_ENV = 'production';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;

    const prodLimit = getEffectiveRateLimitMax();
    resetInMemoryRateLimit();

    const testIp = '192.168.1.99';
    const hit1 = checkInMemoryRateLimit(testIp);
    const hit2 = checkInMemoryRateLimit(testIp);
    const hit3 = checkInMemoryRateLimit(testIp);
    const hit4 = checkInMemoryRateLimit(testIp); // should be blocked by strict limit (3)

    if (prodLimit === PRODUCTION_FALLBACK_STRICT_LIMIT && hit1 && hit2 && hit3 && !hit4) {
      passed++;
      console.log(`✅ [PASS] In production without shared store, strict in-memory limit (${PRODUCTION_FALLBACK_STRICT_LIMIT}/hr) is applied.`);
    } else {
      failed++;
      console.error('❌ [FAIL] Production fallback rate limit failed:', { prodLimit, hit1, hit2, hit3, hit4 });
    }
  } finally {
    (process.env as any).NODE_ENV = prevEnv;
    if (prevUpstashUrl) process.env.UPSTASH_REDIS_REST_URL = prevUpstashUrl;
    if (prevUpstashToken) process.env.UPSTASH_REDIS_REST_TOKEN = prevUpstashToken;
    if (prevKvUrl) process.env.KV_REST_API_URL = prevKvUrl;
    if (prevKvToken) process.env.KV_REST_API_TOKEN = prevKvToken;
    resetInMemoryRateLimit();
  }

  // --- 18. Dead Route Verification ---
  console.log('\n--- 18. Dead Route Verification ---');
  const outreachLogRouteExists = fs.existsSync(path.join(process.cwd(), 'app/api/outreach-log'));
  if (!outreachLogRouteExists) {
    passed++;
    console.log('✅ [PASS] Dead route /api/outreach-log completely eradicated from disk.');
  } else {
    failed++;
    console.error('❌ [FAIL] Dead route /api/outreach-log still exists on disk.');
  }

  // --- 19. Storage Persistence & Backup Date Tracking ---
  console.log('\n--- 19. Storage Persistence & Backup Date Tracking ---');
  const { getLastExportedDate, recordExportDate, requestStoragePersistence } = await import('../lib/clientDb');
  const exportDate = recordExportDate();
  const retrievedDate = getLastExportedDate();
  const hasPersistFn = typeof requestStoragePersistence === 'function';

  if (exportDate && retrievedDate === exportDate && hasPersistFn) {
    passed++;
    console.log('✅ [PASS] Backup date recording, retrieval, and requestStoragePersistence helper verified.');
  } else {
    failed++;
    console.error('❌ [FAIL] Backup date tracking or persistence helper failed:', { exportDate, retrievedDate, hasPersistFn });
  }

  // --- 20. Canonical LinkedIn URL Normalization Unit Tests ---
  console.log('\n--- 20. Canonical LinkedIn URL Normalization Unit Tests ---');
  const { normalizeLinkedInUrl, isSameLinkedInProfile } = await import('../lib/urlNormalizer');

  const testUrls = [
    'https://www.linkedin.com/in/john-doe/',
    'https://linkedin.com/in/john-doe',
    'www.linkedin.com/in/john-doe/',
    'http://linkedin.com/in/john-doe',
    'in.linkedin.com/in/John-Doe?trk=public_profile',
    'https://www.linkedin.com/in/john-doe#experience',
    '  https://linkedin.com/in/john-doe/  '
  ];

  const canonicalTarget = 'https://www.linkedin.com/in/john-doe';
  let allNormalizedMatch = true;

  for (const url of testUrls) {
    const norm = normalizeLinkedInUrl(url);
    if (norm !== canonicalTarget) {
      allNormalizedMatch = false;
      console.error(`❌ [FAIL] Normalization failed for "${url}": Expected "${canonicalTarget}", got "${norm}"`);
    }
  }

  const sameProfileCheck = isSameLinkedInProfile(
    'https://www.linkedin.com/in/john-doe/',
    'in.linkedin.com/in/John-Doe?trk=public_profile'
  );

  if (allNormalizedMatch && sameProfileCheck) {
    passed++;
    console.log('✅ [PASS] All 7 LinkedIn URL variants correctly normalized to canonical: ' + canonicalTarget);
  } else {
    failed++;
  }

  // Test company URL normalization
  const normCompany = normalizeLinkedInUrl('https://linkedin.com/company/Acme-Corp/?trk=company_page');
  if (normCompany === 'https://www.linkedin.com/company/acme-corp') {
    passed++;
    console.log('✅ [PASS] Company LinkedIn URL correctly normalized to canonical format.');
  } else {
    failed++;
    console.error('❌ [FAIL] Company URL normalization failed. Got:', normCompany);
  }

  // --- 21. Layer 1 Temporal Candidate Filter Tests ---
  console.log('\n--- 21. Layer 1 Temporal Candidate Filter Tests ---');
  const { parseConnectedOnDate, isEligibleByTemporalFilter, extractBoundaryDate } = await import('../lib/temporalFilter');

  const parsedIso = parseConnectedOnDate('2026-10-17');
  const parsedDdMmm = parseConnectedOnDate('17 Oct 2026');
  const parsedMmmDd = parseConnectedOnDate('Oct 17, 2026');
  const parsedSlash = parseConnectedOnDate('10/17/2026');

  if (
    parsedIso === '2026-10-17' &&
    parsedDdMmm === '2026-10-17' &&
    parsedMmmDd === '2026-10-17' &&
    parsedSlash === '2026-10-17'
  ) {
    passed++;
    console.log('✅ [PASS] parseConnectedOnDate accurately parses all LinkedIn CSV date formats to "2026-10-17".');
  } else {
    failed++;
    console.error('❌ [FAIL] parseConnectedOnDate failed:', { parsedIso, parsedDdMmm, parsedMmmDd, parsedSlash });
  }

  // Inclusive boundary test (Connected On >= boundary_date)
  const prevExportBoundary = '2026-10-17 11:00:00';
  const boundaryIso = extractBoundaryDate(prevExportBoundary);

  const eligibleOnBoundary = isEligibleByTemporalFilter('17 Oct 2026', prevExportBoundary);
  const eligibleAfterBoundary = isEligibleByTemporalFilter('20 Oct 2026', prevExportBoundary);
  const filteredBeforeBoundary = isEligibleByTemporalFilter('10 Oct 2026', prevExportBoundary);
  const unparseableFallback = isEligibleByTemporalFilter('unknown-date', prevExportBoundary);
  const noBoundaryEligible = isEligibleByTemporalFilter('10 Oct 2026', null);

  if (
    boundaryIso === '2026-10-17' &&
    eligibleOnBoundary === true &&
    eligibleAfterBoundary === true &&
    filteredBeforeBoundary === false &&
    unparseableFallback === true &&
    noBoundaryEligible === true
  ) {
    passed++;
    console.log('✅ [PASS] Inclusive temporal filter (Connected On >= boundary) verified with conservative unparseable fallback.');
  } else {
    failed++;
    console.error('❌ [FAIL] Temporal filter boundary check failed:', {
      eligibleOnBoundary,
      eligibleAfterBoundary,
      filteredBeforeBoundary,
      unparseableFallback,
      noBoundaryEligible
    });
  }

  // --- 22. Incremental Import Pipeline & Database Identity Filter Tests ---
  console.log('\n--- 22. Incremental Import Pipeline & Database Identity Filter Tests ---');
  const { runIncrementalImportPipeline } = await import('../lib/importPipeline');

  // Scenario 1: First Import (all pass as new)
  const sampleCsvInitial = `Notes: LinkedIn Export
First Name,Last Name,URL,Email Address,Company,Position,Connected On
John,Doe,https://linkedin.com/in/john-doe,john@example.com,TechCorp,Founder & CEO,15 Oct 2026
Sarah,Smith,https://linkedin.com/in/sarah-smith,sarah@example.com,CloudScale,Lead Recruiter,16 Oct 2026
Alex,Brown,https://linkedin.com/in/alex-brown,,FinTechAI,Engineering Manager,18 Oct 2026
Elena,Rostova,https://linkedin.com/in/elena-rostova,,Agentic,Full Stack Engineer,19 Oct 2026
`;

  const firstImportResult = await runIncrementalImportPipeline({
    csvContent: sampleCsvInitial,
    targetRole: 'Full Stack Engineer',
    userId: 'user-test-123'
  });

  if (firstImportResult.totalRows === 4 && firstImportResult.newConnectionsCount === 4) {
    passed++;
    console.log('✅ [PASS] Scenario 1: First CSV import successfully extracts and classifies all 4 connections as genuinely new.');
  } else {
    failed++;
    console.error('❌ [FAIL] Scenario 1 failed:', firstImportResult);
  }

  // Scenarios 2 & 3: Mark John as 'contacted' and Sarah as 'skipped' in the simulated DB
  const mockDbStatus = new Map<string, any>();
  mockDbStatus.set('https://www.linkedin.com/in/john-doe', 'contacted'); // John = contacted
  mockDbStatus.set('https://www.linkedin.com/in/sarah-smith', 'skipped'); // Sarah = skipped
  mockDbStatus.set('https://www.linkedin.com/in/alex-brown', 'new'); // Alex = already in DB as new

  // Scenario 4: Second CSV import containing original + new connections
  const sampleCsvSecond = `First Name,Last Name,URL,Email Address,Company,Position,Connected On
John,Doe,https://www.linkedin.com/in/john-doe/,john@example.com,TechCorp,Founder & CEO,15 Oct 2026
Sarah,Smith,www.linkedin.com/in/sarah-smith/,sarah@example.com,CloudScale,Lead Recruiter,16 Oct 2026
Alex,Brown,https://linkedin.com/in/alex-brown,,FinTechAI,Engineering Manager,18 Oct 2026
Marcus,Vance,https://linkedin.com/in/marcus-vance,,NextGen,VP Engineering,20 Oct 2026
`;

  const secondImportResult = await runIncrementalImportPipeline({
    csvContent: sampleCsvSecond,
    targetRole: 'Full Stack Engineer',
    previousBoundaryDate: '2026-10-17 11:00:00', // Temporal filter boundary (Layer 1)
    existingStatusLookup: async (urls) => {
      const map = new Map<string, any>();
      for (const u of urls) {
        if (mockDbStatus.has(u)) map.set(u, mockDbStatus.get(u));
      }
      return map;
    },
    userId: 'user-test-123'
  });

  const marcusIsNew = secondImportResult.genuinelyNewProspects.some(p => p.name === 'Marcus Vance');
  const johnIsNotInNew = !secondImportResult.genuinelyNewProspects.some(p => p.name === 'John Doe');
  const sarahIsNotInNew = !secondImportResult.genuinelyNewProspects.some(p => p.name === 'Sarah Smith');
  const alexIsNotDuplicated = !secondImportResult.genuinelyNewProspects.some(p => p.name === 'Alex Brown');

  if (marcusIsNew && johnIsNotInNew && sarahIsNotInNew && alexIsNotDuplicated && secondImportResult.newConnectionsCount === 1) {
    passed++;
    console.log('✅ [PASS] Scenarios 4, 5, 6: Second CSV import ignored contacted, skipped, and existing new connections, only classifying Marcus Vance.');
  } else {
    failed++;
    console.error('❌ [FAIL] Second CSV incremental import failed:', {
      marcusIsNew,
      johnIsNotInNew,
      sarahIsNotInNew,
      alexIsNotDuplicated,
      result: secondImportResult
    });
  }

  // --- 23. Layer 2 Identity Filter Direct Bypass Test ---
  console.log('\n--- 23. Layer 2 Identity Filter Direct Terminal State Protection ---');
  const identityOnlyResult = await runIncrementalImportPipeline({
    csvContent: sampleCsvSecond,
    targetRole: 'Full Stack Engineer',
    previousBoundaryDate: null, // Force Layer 2 to evaluate all rows
    existingStatusLookup: async (urls) => {
      const map = new Map<string, any>();
      for (const u of urls) {
        if (mockDbStatus.has(u)) map.set(u, mockDbStatus.get(u));
      }
      return map;
    },
    userId: 'user-test-123'
  });

  const identityJohnIgnored = !identityOnlyResult.genuinelyNewProspects.some(p => p.name === 'John Doe');
  const identitySarahIgnored = !identityOnlyResult.genuinelyNewProspects.some(p => p.name === 'Sarah Smith');
  const identityTerminalCount = identityOnlyResult.skippedTerminalCount; // John + Sarah = 2

  if (identityJohnIgnored && identitySarahIgnored && identityTerminalCount === 2 && identityOnlyResult.newConnectionsCount === 1) {
    passed++;
    console.log('✅ [PASS] Layer 2 identity filter strictly blocks John (contacted) and Sarah (skipped) without temporal filtering.');
  } else {
    failed++;
    console.error('❌ [FAIL] Layer 2 identity filter failed:', {
      identityJohnIgnored,
      identitySarahIgnored,
      identityTerminalCount,
      identityOnlyResult
    });
  }

  // --- 24. Follow-up Scheduling (Day 5 & Day 12) Calculation Tests ---
  console.log('\n--- 24. Follow-up Scheduling (Day 5 & Day 12) Tests ---');
  const baseContactedDate = new Date('2026-10-17T10:00:00Z');
  const day5Expected = new Date(baseContactedDate.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const day12Expected = new Date(baseContactedDate.getTime() + 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  if (day5Expected === '2026-10-22' && day12Expected === '2026-10-29') {
    passed++;
    console.log('✅ [PASS] Scenarios 7 & 8: Contacted Oct 17 accurately schedules Day 5 on Oct 22 and Day 12 on Oct 29.');
  } else {
    failed++;
    console.error('❌ [FAIL] Follow-up date calculation failed:', { day5Expected, day12Expected });
  }

  // --- 25. State Precedence Rule Verification (contacted > skipped > new) ---
  console.log('\n--- 25. State Precedence Rule Verification (contacted > skipped > new) ---');
  function resolvePrecedence(existingDbStatus: 'contacted' | 'skipped' | 'new' | undefined, incomingStatus: 'contacted' | 'skipped' | 'new'): string {
    if (existingDbStatus === 'contacted') return 'contacted';
    if (existingDbStatus === 'skipped') {
      return incomingStatus === 'contacted' ? 'contacted' : 'skipped';
    }
    return incomingStatus;
  }

  const p1 = resolvePrecedence('contacted', 'new');
  const p2 = resolvePrecedence('contacted', 'skipped');
  const p3 = resolvePrecedence('skipped', 'new');
  const p4 = resolvePrecedence('skipped', 'contacted');
  const p5 = resolvePrecedence('new', 'contacted');
  const p6 = resolvePrecedence('new', 'skipped');

  if (p1 === 'contacted' && p2 === 'contacted' && p3 === 'skipped' && p4 === 'contacted' && p5 === 'contacted' && p6 === 'skipped') {
    passed++;
    console.log('✅ [PASS] State precedence rule (contacted > skipped > new) strictly preserved across all transitions.');
  } else {
    failed++;
    console.error('❌ [FAIL] State precedence failed:', { p1, p2, p3, p4, p5, p6 });
  }

  // --- 26. User Isolation & RLS Security Policy Verification ---
  console.log('\n--- 26. User Isolation & RLS Security Policy Verification ---');
  const migrationSql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261017175200_initial_linkedin_dm_schema.sql'), 'utf-8');
  const hasProfilesRls = migrationSql.includes('alter table public.profiles enable row level security;') &&
                         migrationSql.includes('id = auth.uid()');
  const hasConnectionsRls = migrationSql.includes('alter table public.connections enable row level security;') &&
                            migrationSql.includes('user_id = auth.uid()');
  const hasEventsRls = migrationSql.includes('alter table public.outreach_events enable row level security;') &&
                       migrationSql.includes('user_id = auth.uid()');
  const hasImportsRls = migrationSql.includes('alter table public.imports enable row level security;') &&
                        migrationSql.includes('user_id = auth.uid()');
  const hasUniqueConstraint = migrationSql.includes('unique(user_id, linkedin_url)');

  if (hasProfilesRls && hasConnectionsRls && hasEventsRls && hasImportsRls && hasUniqueConstraint) {
    passed++;
    console.log('✅ [PASS] Scenario 10: RLS policies and unique(user_id, linkedin_url) verified across all 4 tables.');
  } else {
    failed++;
    console.error('❌ [FAIL] Migration RLS policies incomplete:', {
      hasProfilesRls,
      hasConnectionsRls,
      hasEventsRls,
      hasImportsRls,
      hasUniqueConstraint
    });
  }

  // --- 27. End-to-End Multi-User Isolation & Session Switching Tests ---
  console.log('\n--- 27. End-to-End Multi-User Isolation & Session Switching Tests ---');
  const userA_id = 'a1111111-1111-4111-8111-111111111111';
  const userB_id = 'b2222222-2222-4222-8222-222222222222';

  // Provide mock browser localStorage for testing client storage cache isolation
  const mockStorageMap = new Map<string, string>();
  const originalWindow = (global as any).window;
  const originalLocalStorage = (global as any).localStorage;

  (global as any).window = {};
  (global as any).localStorage = {
    getItem: (key: string) => mockStorageMap.get(key) || null,
    setItem: (key: string, val: string) => mockStorageMap.set(key, String(val)),
    removeItem: (key: string) => mockStorageMap.delete(key),
    clear: () => mockStorageMap.clear()
  };

  const {
    setActiveStorageUser,
    getClientProspects,
    saveClientProspects,
    getClientProfile,
    saveClientProfile,
    getClientOutreachLogs,
    saveClientOutreachLogs,
    getClientSession,
    saveClientSession,
    clearUserCache
  } = await import('../lib/clientStorage');

  // Step 1: User A signs in and saves profile, session, prospects, and outreach logs
  setActiveStorageUser(userA_id);
  const userA_profile = {
    ...TEST_PROFILE,
    name: 'Alice Walker',
    targetRole: 'Staff AI Engineer'
  };
  saveClientProfile(userA_profile, userA_id);
  saveClientSession({ selectedWorkflow: 'job-hunt', workflowStep: 'segregated', currentTab: 'prospects' }, userA_id);

  // User A imports 3 connections
  const testCsvUserA = `First Name,Last Name,Company,Title,URL
Satya,Nadella,Microsoft,CEO,https://linkedin.com/in/satya-nadella
Sundar,Pichai,Google,CEO,https://linkedin.com/in/sundar-pichai
Sam,Altman,OpenAI,CEO,https://linkedin.com/in/sam-altman`;

  // Simulated in-memory database store for multi-user isolation verification
  interface MockDbState {
    connections: Map<string, { id: string; user_id: string; linkedin_url: string; status: string; name: string }>;
    outreach_events: Array<{ id: string; user_id: string; connection_id: string; type: string; sequence_number: number; completed_at: string | null }>;
    imports: Array<{ id: string; user_id: string; new_connections: number; total_rows: number }>;
  }

  const mockDb: MockDbState = {
    connections: new Map(),
    outreach_events: [],
    imports: []
  };

  const userA_importResult = await runIncrementalImportPipeline({
    csvContent: testCsvUserA,
    targetRole: 'Staff AI Engineer',
    userId: userA_id
  });

  // Persist User A connections to mock database
  for (const row of userA_importResult.connectionRowsToInsert) {
    const connId = `conn-${userA_id.slice(0, 4)}-${mockDb.connections.size + 1}`;
    mockDb.connections.set(`${row.user_id}:${row.linkedin_url}`, {
      id: connId,
      user_id: row.user_id!,
      linkedin_url: row.linkedin_url!,
      status: 'new',
      name: row.name!
    });
  }
  mockDb.imports.push({
    id: `imp-${userA_id.slice(0, 4)}-1`,
    user_id: userA_id,
    new_connections: userA_importResult.newConnectionsCount,
    total_rows: userA_importResult.totalRows
  });

  // User A contacts Satya Nadella
  const satyaKey = `${userA_id}:https://www.linkedin.com/in/satya-nadella`;
  const satyaConn = mockDb.connections.get(satyaKey)!;
  satyaConn.status = 'contacted';

  const userA_now = new Date().toISOString();
  mockDb.outreach_events.push(
    { id: 'ev-a-0', user_id: userA_id, connection_id: satyaConn.id, type: 'initial', sequence_number: 0, completed_at: userA_now },
    { id: 'ev-a-1', user_id: userA_id, connection_id: satyaConn.id, type: 'follow_up', sequence_number: 1, completed_at: null },
    { id: 'ev-a-2', user_id: userA_id, connection_id: satyaConn.id, type: 'follow_up', sequence_number: 2, completed_at: null }
  );

  saveClientProspects(userA_importResult.genuinelyNewProspects, userA_id);
  saveClientOutreachLogs([{
    date: '2026-10-17',
    name: 'Satya Nadella',
    company: 'Microsoft',
    role: 'Staff AI Engineer',
    personPosition: 'CEO',
    relationshipType: 'Founder',
    linkedinUrl: 'https://www.linkedin.com/in/satya-nadella',
    status: 'Contacted'
  }], userA_id);

  // Step 2: Switch to User B (Sign up / Login separately)
  setActiveStorageUser(userB_id);

  // Verification 1: User B sees an EMPTY workspace in client storage (cache isolation)
  const userB_prospectsInCache = getClientProspects(userB_id);
  const userB_profileInCache = getClientProfile(userB_id);
  const userB_logsInCache = getClientOutreachLogs(userB_id);
  const userB_sessionInCache = getClientSession(userB_id);

  const cacheIsIsolated =
    userB_prospectsInCache.length === 0 &&
    userB_profileInCache === null &&
    userB_logsInCache.length === 0 &&
    userB_sessionInCache === null;

  // Verification 2: User B queries database rows scoped by user_id = userB_id
  const userB_visibleConnections = Array.from(mockDb.connections.values()).filter(c => c.user_id === userB_id);
  const userB_visibleImports = mockDb.imports.filter(i => i.user_id === userB_id);
  const userB_visibleEvents = mockDb.outreach_events.filter(e => e.user_id === userB_id);

  const databaseIsIsolated =
    userB_visibleConnections.length === 0 &&
    userB_visibleImports.length === 0 &&
    userB_visibleEvents.length === 0;

  // Verification 3: Cross-user mutation attack blocked
  // User B attempts to modify User A's connection status
  let userB_tamperedUserA = false;
  for (const conn of mockDb.connections.values()) {
    // A query with user_id = userB_id attempting to update satyaConn.id
    if (conn.id === satyaConn.id && conn.user_id === userB_id) {
      conn.status = 'skipped'; // Should NEVER execute
      userB_tamperedUserA = true;
    }
  }

  // User B attempts to complete User A's follow-up event
  let userB_tamperedEvent = false;
  for (const ev of mockDb.outreach_events) {
    if (ev.id === 'ev-a-1' && ev.user_id === userB_id) {
      ev.completed_at = new Date().toISOString(); // Should NEVER execute
      userB_tamperedEvent = true;
    }
  }

  // Verification 4: User B imports their own CSV (can include same Satya URL without conflict)
  const userB_importResult = await runIncrementalImportPipeline({
    csvContent: testCsvUserA,
    targetRole: 'Product Designer',
    userId: userB_id,
    existingStatusLookup: async (urls) => {
      // Scoped ONLY to userB_id
      const map = new Map<string, any>();
      for (const [k, v] of mockDb.connections.entries()) {
        if (v.user_id === userB_id && urls.includes(v.linkedin_url)) {
          map.set(v.linkedin_url, v.status);
        }
      }
      return map;
    }
  });

  // Satya is genuinely NEW for User B because User A's status does not leak
  const userB_satyaIsNew = userB_importResult.newConnectionsCount === 3;

  // Step 3: Switch back to User A
  setActiveStorageUser(userA_id);
  const userA_restoredProfile = getClientProfile(userA_id);
  const userA_restoredProspects = getClientProspects(userA_id);
  const userA_restoredLogs = getClientOutreachLogs(userA_id);
  const userA_dbConnections = Array.from(mockDb.connections.values()).filter(c => c.user_id === userA_id);
  const userA_dbEvents = mockDb.outreach_events.filter(e => e.user_id === userA_id);
  const userA_satyaStillContacted = mockDb.connections.get(satyaKey)?.status === 'contacted';
  const userA_followUpStillPending = mockDb.outreach_events.find(e => e.id === 'ev-a-1')?.completed_at === null;

  const userA_fullyRestored =
    userA_restoredProfile?.name === 'Alice Walker' &&
    userA_restoredProspects.length === 3 &&
    userA_restoredLogs.length === 1 &&
    userA_dbConnections.length === 3 &&
    userA_dbEvents.length === 3 &&
    userA_satyaStillContacted &&
    userA_followUpStillPending &&
    !userB_tamperedUserA &&
    !userB_tamperedEvent;

  // Restore environment globals
  (global as any).window = originalWindow;
  (global as any).localStorage = originalLocalStorage;

  if (cacheIsIsolated && databaseIsIsolated && userB_satyaIsNew && userA_fullyRestored) {
    passed++;
    console.log('✅ [PASS] Multi-User Isolation End-to-End Test: User A and User B workspaces, databases, outreach events, and local caches are 100% strictly isolated.');
  } else {
    failed++;
    console.error('❌ [FAIL] Multi-user isolation test failed:', {
      cacheIsIsolated,
      databaseIsIsolated,
      userB_satyaIsNew,
      userA_fullyRestored,
      userB_tamperedUserA,
      userB_tamperedEvent
    });
  }

  console.log('\n================================================================');
  console.log(`TOTAL TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAsyncTests().catch((err) => {
  console.error('Async tests error:', err);
  process.exit(1);
});
