import { generatePersonalizedDM, MessageAngle, sanitizeCompanyName, sanitizeFirstName } from '../lib/generator';
import { resolveProspectPersona } from '../lib/classifier';
import { TEST_PROFILE } from './fixtures/testProfile';
import { Prospect, OutreachGoal, PersonaType, UserProfile } from '../types';

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
      jobTitle: 'Product Lead',
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
      description: 'Agency note to employee, asks about bandwidth overflow or intro to product leaders'
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
    expectedPersona: 'employee',
    checks: {
      minWordsDay0: 65,
      maxWordsDay0: 130,
      mustInclude: ['Sarah', 'Cyberdyne Systems'],
      mustNotInclude: ['undefined', 'null'],
      description: 'Defaults to respectful employee referral ask'
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

if (resZero.day0.includes('0+ years of experience') && !resZero.day0.includes('3+ years')) {
  passed++;
  console.log('✅ [PASS] yearsOfExperience: 0 correctly renders as "0+ years of experience" and never "3+ years".');
} else {
  failed++;
  console.error('❌ [FAIL] yearsOfExperience: 0 failed. Message was:\n', resZero.day0);
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

console.log('\n================================================================');
console.log(`TOTAL TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
