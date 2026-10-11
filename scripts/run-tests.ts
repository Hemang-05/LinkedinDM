import { generatePersonalizedDM, MessageAngle } from '../lib/generator';
import { resolveProspectPersona } from '../lib/classifier';
import { DEFAULT_PROFILE } from '../lib/profile';
import { Prospect, OutreachGoal, PersonaType } from '../types';

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
      name: 'Arjun Patel',
      company: 'Razorpay',
      jobTitle: 'Senior Software Engineer',
      relationshipType: 'Peer'
    },
    goal: 'job-hunt',
    angle: 'standard',
    expectedPersona: 'employee',
    checks: {
      minWordsDay0: 70,
      maxWordsDay0: 130,
      mustInclude: ['Arjun', 'Razorpay', 'referral'],
      mustNotInclude: ['are you hiring', 'do you have vacancies', 'hope this message finds you well', 'synergies'],
      description: 'Peer tone, asks for referral/direction, never asks employee if they have vacancies'
    }
  },

  // 4. CTO / VP Engineering + Job Hunt
  {
    name: '4. CTO / VP Engineering + Job Hunt',
    prospect: {
      name: 'Devendra Singh',
      company: 'Postman',
      jobTitle: 'VP of Engineering',
      classification: 'CTO'
    },
    goal: 'job-hunt',
    angle: 'standard',
    expectedPersona: 'cto_lead',
    checks: {
      minWordsDay0: 70,
      maxWordsDay0: 130,
      mustInclude: ['Devendra', 'Postman', 'ownership', 'stack'],
      mustNotInclude: ['my resume', 'referral', 'hope this message finds you well', 'align perfectly'],
      description: 'Emphasizes technical ownership and stack capabilities, not mini cover letter'
    }
  },

  // 5. Founder + Agency Lead
  {
    name: '5. Founder + Agency Lead',
    prospect: {
      name: 'Rohit Sharma',
      company: 'The Goat Sports Academy',
      jobTitle: 'Founder & CEO',
      classification: 'Founder'
    },
    goal: 'agency-leads',
    angle: 'standard',
    expectedPersona: 'founder',
    checks: {
      minWordsDay0: 70,
      maxWordsDay0: 130,
      mustInclude: ['Rohit', 'The Goat Sports Academy', 'team', 'product'],
      mustNotInclude: ['resume', 'job', 'seeking', 'hiring', 'referral', 'interview', 'applicant'],
      description: 'Sells product development bandwidth, absolutely no job seeking language'
    }
  },

  // 6. Founder + Hire (User is hiring)
  {
    name: '6. Founder + Hire',
    prospect: {
      name: 'Vikram Mehta',
      company: 'Acme Studio',
      jobTitle: 'Lead Full Stack Architect',
      classification: 'Founder'
    },
    goal: 'hire',
    angle: 'standard',
    expectedPersona: 'founder',
    checks: {
      minWordsDay0: 70,
      maxWordsDay0: 130,
      mustInclude: ['Vikram', 'stood out', 'opportunity'],
      mustNotInclude: ['looking for a job', 'my resume', 'hire me', 'referral'],
      description: 'User acts as employer/buyer seeking candidate'
    }
  },

  // 7. Freelancer + Hire / Contract
  {
    name: '7. Freelancer + Get Freelancers',
    prospect: {
      name: 'Sameer Khan',
      company: 'Self-employed',
      jobTitle: 'Freelance React / Python Engineer',
      classification: 'Freelancer'
    },
    goal: 'freelancers',
    angle: 'standard',
    expectedPersona: 'freelancer',
    checks: {
      minWordsDay0: 65,
      maxWordsDay0: 130,
      mustInclude: ['Sameer', 'collaboration'],
      mustNotInclude: ['my resume', 'referral', 'hire me as an employee'],
      description: 'Project collaboration, asks about bandwidth/availability'
    }
  },

  // 8. Employee + Agency Lead
  {
    name: '8. Employee + Agency Lead',
    prospect: {
      name: 'Neha Gupta',
      company: 'Flipkart',
      jobTitle: 'Engineering Manager',
      classification: 'Engineering Manager'
    },
    goal: 'agency-leads',
    angle: 'standard',
    expectedPersona: 'cto_lead',
    checks: {
      minWordsDay0: 65,
      maxWordsDay0: 130,
      mustInclude: ['Neha', 'Flipkart'],
      mustNotInclude: ['resume', 'job search', 'applying', 'referral'],
      description: 'Peer engineering outreach exploring overflow/bandwidth partnerships'
    }
  },

  // Edge Case 1: Missing company
  {
    name: 'Edge Case 1: Missing Company',
    prospect: {
      name: 'Anita Roy',
      company: '',
      jobTitle: 'Founder',
      classification: 'Founder'
    },
    goal: 'job-hunt',
    angle: 'standard',
    expectedPersona: 'founder',
    checks: {
      minWordsDay0: 65,
      maxWordsDay0: 130,
      mustInclude: ['Anita', 'what you\'re building'],
      mustNotInclude: ['at undefined', 'at your team', 'Self-employed'],
      description: 'Handles missing company smoothly without awkward grammar'
    }
  },

  // Edge Case 2: Missing position
  {
    name: 'Edge Case 2: Missing Position',
    prospect: {
      name: 'Karan Johar',
      company: 'Dharma Media Inc.',
      jobTitle: '',
      classification: 'Other'
    },
    goal: 'job-hunt',
    angle: 'standard',
    expectedPersona: 'employee',
    checks: {
      minWordsDay0: 65,
      maxWordsDay0: 130,
      mustInclude: ['Karan', 'Dharma Media'],
      mustNotInclude: ['undefined', 'null'],
      description: 'Strips legal Inc. suffix and defaults gracefully'
    }
  },

  // Edge Case 3: Angle Variations (Founding 0->1 vs AI/RAG)
  {
    name: 'Angle Check: Founder + Founding 0->1',
    prospect: {
      name: 'Gaurav Munjal',
      company: 'Unacademy',
      jobTitle: 'Co-Founder & CEO',
      classification: 'Founder'
    },
    goal: 'job-hunt',
    angle: 'founding',
    expectedPersona: 'founder',
    checks: {
      minWordsDay0: 70,
      maxWordsDay0: 130,
      mustInclude: ['Gaurav', '0 to 1', 'early-stage', 'ambiguity'],
      mustNotInclude: ['resume', 'referral'],
      description: 'Founding angle emphasizes speed, 0 to 1 ownership and ambiguity'
    }
  }
];

console.log('================================================================');
console.log('LINKEDINDM PERSONA & GOAL OUTREACH MATRIX TEST SUITE');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const result = generatePersonalizedDM(
    tc.prospect,
    'Full Stack Engineer',
    tc.angle || 'standard',
    DEFAULT_PROFILE,
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
    console.log('--- GENERATED MESSAGE ---');
    console.log(result.day0);
    console.log('-------------------------\n');
  }
}

console.log('\n================================================================');
console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
