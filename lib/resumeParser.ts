import mammoth from 'mammoth';

export interface ExtractedResumeData {
  name: string | null;
  email: string | null;
  phone: string | null;
  targetRole: string | null;
  skills: string[];
  primarySkills: string[];
  yearsOfExperience: number | null;
  domain: string | null;
  background: string | null;
  bioSummary: string | null;
  relevantExperience: string | null;
  rawTextPreview: string;
}

// Common headers/keywords that should never be identified as names
const NON_NAME_WORDS = new Set([
  'resume',
  'curriculum',
  'vitae',
  'cv',
  'bio',
  'biodata',
  'profile',
  'summary',
  'contact',
  'contact information',
  'objective',
  'education',
  'experience',
  'projects',
  'skills',
  'technologies',
  'certifications',
  'languages',
  'achievements',
  'work',
  'employment',
  'page',
  'confidential',
  'address',
  'phone',
  'email',
  'linkedin',
  'github',
  'portfolio',
  'developer',
  'engineer',
  'designer',
  'manager',
  'architect',
  'analyst',
  'consultant',
  'specialist',
  'intern',
  'student',
  'fresher',
  'bachelor',
  'master',
  'university',
  'college',
  'institute',
  'school',
  'personal',
  'details',
  'about',
  'career',
  'overview',
  'declaration',
  'hobbies',
  'interests',
  'references',
  'activities'
]);

// Known tech skills pool covering all core software engineering, data, cloud & mobile domains
const TECH_SKILLS_POOL = [
  // Web & Frontend
  'React',
  'Next.js',
  'TypeScript',
  'JavaScript',
  'Vue.js',
  'Angular',
  'Svelte',
  'TailwindCSS',
  'Redux',
  'HTML5',
  'CSS3',
  // Backend & Languages
  'Node.js',
  'Express',
  'NestJS',
  'Python',
  'FastAPI',
  'Django',
  'Flask',
  'Java',
  'Spring Boot',
  'Golang',
  'Go',
  'C++',
  'C#',
  '.NET',
  'ASP.NET',
  'Rust',
  'PHP',
  'Laravel',
  'Ruby on Rails',
  'Ruby',
  'Scala',
  // Mobile
  'Flutter',
  'React Native',
  'Swift',
  'Kotlin',
  'iOS',
  'Android',
  'SwiftUI',
  'Jetpack Compose',
  // Data, AI & ML
  'SQL',
  'PyTorch',
  'TensorFlow',
  'Scikit-learn',
  'Pandas',
  'NumPy',
  'Spark',
  'PySpark',
  'Databricks',
  'Snowflake',
  'BigQuery',
  'LLM',
  'RAG',
  'NLP',
  'LangChain',
  // Cloud & DevOps
  'AWS',
  'GCP',
  'Azure',
  'Docker',
  'Kubernetes',
  'Terraform',
  'CI/CD',
  'Linux',
  'Jenkins',
  'GitHub Actions',
  // Databases & Messaging
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Redis',
  'Kafka',
  'Elasticsearch',
  'DynamoDB',
  'Cassandra',
  'SQLite',
  // APIs & Architecture
  'REST APIs',
  'GraphQL',
  'gRPC',
  'Microservices',
  'System Design',
  'Distributed Systems'
];

/**
 * Extracts raw text from PDF, DOCX, or TXT file buffers
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeTypeOrFilename: string
): Promise<string> {
  const lower = mimeTypeOrFilename.toLowerCase();

  // 1. PDF
  if (lower.includes('pdf') || lower.endsWith('.pdf')) {
    try {
      const pdfModule = await import('pdf-parse');
      const PDFClass = (pdfModule as any).PDFParse || (pdfModule as any).default || pdfModule;
      if (typeof PDFClass === 'function') {
        try {
          // If class constructor
          const parser = new (PDFClass as any)({ data: buffer });
          if (typeof parser.getText === 'function') {
            const data = await parser.getText();
            return data.text || '';
          }
        } catch {
          // If callable function
          const data = await (PDFClass as any)(buffer);
          return data.text || '';
        }
      }
    } catch (err) {
      console.error('Error parsing PDF with pdf-parse:', err);
    }

    // Fallback: extract ASCII / UTF-8 strings from PDF streams
    const raw = buffer.toString('latin1');
    const textMatches = raw.match(/\(([^()]{2,})\)\s*Tj/g);
    if (textMatches && textMatches.length > 3) {
      return textMatches.map(m => m.replace(/^[()]|[()]Tj$/g, '')).join(' ');
    }
    return '';
  }

  // 2. DOCX
  if (lower.includes('word') || lower.includes('docx') || lower.endsWith('.docx')) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } catch (err) {
      console.error('Error parsing DOCX with mammoth:', err);
      return buffer.toString('utf-8');
    }
  }

  // 3. Plain Text / Markdown / Fallback
  return buffer.toString('utf-8');
}

/**
 * Converts a string to Title Case (e.g. "ROHIT SHARMA" -> "Rohit Sharma")
 */
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Extracts candidate name from resume text
 */
export function extractCandidateName(text: string): string | null {
  if (!text || text.trim().length === 0) return null;

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) return null;

  // Search in the top 15 non-empty lines
  const topLines = lines.slice(0, 15);

  // 1. Try to find email in top lines for cross-referencing
  let emailUsernameParts: string[] = [];
  for (const line of topLines) {
    const emailMatch = line.match(/([a-zA-Z0-9._%+-]+)@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      const username = emailMatch[1].toLowerCase().replace(/[^a-z]/g, ' ');
      emailUsernameParts = username.split(/\s+/).filter(p => p.length >= 3);
      break;
    }
  }

  for (let i = 0; i < topLines.length; i++) {
    let line = topLines[i];

    // Strip common labels at line start (e.g., "Name:", "Resume of", "Curriculum Vitae -")
    line = line
      .replace(/^(name\s*[:\-\|]|resume\s+of\s+|curriculum\s+vitae\s*[:\-\|]?)/i, '')
      .trim();

    // Remove degrees / certifications at the end (e.g. "John Doe, B.Tech", "Jane Doe (Full Stack)")
    line = line.replace(/,\s*(b\.?tech|m\.?tech|b\.?e\.?|m\.?s\.?|ph\.?d|mba|bsc|msc).*$/i, '').trim();
    line = line.replace(/\s*\(.*?\)/g, '').trim();

    // If line has separators like "|" or "•", check the first token (often: "Name | Title | Email")
    if (line.includes('|') || line.includes('•') || line.includes('·') || line.includes('—')) {
      const firstSegment = line.split(/[|•·—]/)[0].trim();
      if (isValidNameCandidate(firstSegment)) {
        return toTitleCase(firstSegment);
      }
    }

    if (isValidNameCandidate(line)) {
      return toTitleCase(line);
    }
  }

  // 2. Fallback: If no line matched directly, check if email parts give a strong hint
  if (emailUsernameParts.length >= 2) {
    const candidateFromEmail = emailUsernameParts.slice(0, 2).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    // Verify candidateFromEmail or parts appear in text
    if (text.toLowerCase().includes(emailUsernameParts[0]) && text.toLowerCase().includes(emailUsernameParts[1])) {
      return candidateFromEmail;
    }
  }

  return null;
}

/**
 * Validates whether a line of text looks like a real person's name
 */
function isValidNameCandidate(line: string): boolean {
  if (!line || line.length < 3 || line.length > 35) return false;

  // Ignore lines with emails, URLs, digits, or phone numbers
  if (/@|http|www\.|\.com|\.in|\.io|\.org|\d/.test(line)) return false;

  // Ignore lines with punctuation like colons, slashes, brackets
  if (/[:;{}[\]\/\\_+=*&^%$#@!~?]/.test(line)) return false;

  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;

  // Check each word
  for (const word of words) {
    const cleanWord = word.replace(/['’-]/g, '').toLowerCase();

    // Name parts should be letters only
    if (!/^[a-zA-Z]+$/.test(cleanWord)) return false;

    // Check against non-name words dictionary
    if (NON_NAME_WORDS.has(cleanWord)) return false;

    // Reject single-letter words (unless middle initial like "K.")
    if (cleanWord.length < 2 && words.length === 2) return false;
  }

  // The line should be either Title Cased (e.g. "Rohit Sharma") or ALL CAPS (e.g. "ROHIT SHARMA")
  const isTitleCase = words.every(w => /^[A-Z][a-z'-]*$/.test(w));
  const isAllCaps = words.every(w => /^[A-Z'-]+$/.test(w));

  return isTitleCase || isAllCaps;
}

/**
 * Extracts target role / title from resume
 */
export function extractTargetRole(text: string, candidateName?: string | null): string | null {
  if (!text) return null;

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // 1. Check lines immediately following candidate name or in top 8 lines
  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const line = lines[i];
    if (candidateName && line.toLowerCase().includes(candidateName.toLowerCase())) continue;
    if (/@|http|\.com|\d{5,}/.test(line)) continue;

    const segments = line.split(/[|•·—,]/);
    for (const segment of segments) {
      const seg = segment.trim();
      if (
        seg.length >= 4 &&
        seg.length <= 40 &&
        /(developer|engineer|architect|scientist|analyst|manager|specialist|designer|programmer|consultant|sdet|administrator|lead)/i.test(seg) &&
        !/(resume|curriculum|summary|experience|education|project|skill|university|college|contact)/i.test(seg)
      ) {
        return toTitleCase(seg);
      }
    }
  }

  // 2. Comprehensive role catalog
  const commonRoles = [
    'Senior Full Stack Engineer',
    'Full Stack Engineer',
    'Full Stack Developer',
    'Senior Software Engineer',
    'Lead Software Engineer',
    'Staff Software Engineer',
    'Principal Software Engineer',
    'Software Engineer',
    'Software Development Engineer',
    'Senior Frontend Engineer',
    'Frontend Engineer',
    'Frontend Developer',
    'Senior Backend Engineer',
    'Backend Engineer',
    'Backend Developer',
    'Java Developer',
    'Python Developer',
    'Android Developer',
    'iOS Developer',
    'Mobile Engineer',
    'Flutter Developer',
    'React Native Developer',
    'Data Engineer',
    'Senior Data Engineer',
    'Data Scientist',
    'Senior Data Scientist',
    'Machine Learning Engineer',
    'AI Engineer',
    'Data Analyst',
    'DevOps Engineer',
    'Cloud Engineer',
    'Site Reliability Engineer',
    'Product Manager',
    'Technical Program Manager',
    'QA Engineer',
    'SDET',
    'Product Designer',
    'UI/UX Designer',
    'Founding Engineer',
    'Product Engineer'
  ];

  const lower = text.toLowerCase();
  for (const role of commonRoles) {
    const re = new RegExp(`\\b${role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(lower)) {
      return role;
    }
  }

  return 'Software Engineer';
}

/**
 * Extracts skills mentioned in the resume and ranks by frequency
 */
export function extractSkills(text: string): { all: string[]; primary: string[] } {
  const lower = text.toLowerCase();
  const skillCounts: { skill: string; count: number }[] = [];

  for (const skill of TECH_SKILLS_POOL) {
    const re = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = lower.match(re);
    if (matches && matches.length > 0) {
      skillCounts.push({ skill, count: matches.length });
    }
  }

  skillCounts.sort((a, b) => b.count - a.count);
  const all = skillCounts.map(s => s.skill);
  const primary = all.slice(0, 5);

  return { all, primary };
}

/**
 * Extracts candidate's primary domain and background from resume text
 */
export function extractBackgroundDomain(text: string, role?: string | null, skills?: string[]): string {
  const lower = text.toLowerCase();

  if (/(\bdeep learning\b|\bnlp\b|\bllm\b|\bmachine learning\b|\btransformers\b|\bpytorch\b|\btensorflow\b)/i.test(lower)) {
    return 'AI / Machine Learning';
  }
  if (/(\bfintech\b|\bfinancial\b|\bpayments?\b|\btrading\b|\bbanking\b)/i.test(lower)) {
    return 'FinTech & Distributed Systems';
  }
  if (/(\bdevops\b|\bkubernetes\b|\bterraform\b|\bsre\b|\bcloud infrastructure\b|\bci\/cd\b)/i.test(lower)) {
    return 'Cloud Infrastructure & DevOps';
  }
  if (/(\bdata engineering\b|\bdata pipelines?\b|\betl\b|\bspark\b|\bsnowflake\b|\bbigquery\b|\bdatabricks\b)/i.test(lower)) {
    return 'Data Engineering & Analytics';
  }
  if (/(\bflutter\b|\breact native\b|\bios\b|\bandroid\b|\bswift\b|\bkotlin\b|\bmobile apps?\b)/i.test(lower)) {
    return 'Mobile Application Development';
  }
  if (/(\be-?commerce\b|\bretail\b|\bmarketplace\b|\bshopify\b)/i.test(lower)) {
    return 'E-commerce & Consumer Tech';
  }
  if (/(\bhealthtech\b|\bhealthcare\b|\bmedical\b|\bhipaa\b)/i.test(lower)) {
    return 'HealthTech & Medical Software';
  }
  if (/(\bstartups?\b|\bearly-?stage\b|\b0 to 1\b|\bfounding\b)/i.test(lower)) {
    return 'Early-Stage Startups & Product Innovation';
  }
  if (/(\bsaas\b|\bb2b\b|\benterprise\b|\bmicroservices\b)/i.test(lower)) {
    return 'B2B SaaS & Distributed Systems';
  }

  if (role) {
    const lowerRole = role.toLowerCase();
    if (lowerRole.includes('frontend')) return 'Frontend & Web Applications';
    if (lowerRole.includes('backend')) return 'Backend Architecture & APIs';
    if (lowerRole.includes('full stack')) return 'Full Stack Product Engineering';
    if (lowerRole.includes('data')) return 'Data & Analytics Systems';
    if (lowerRole.includes('mobile')) return 'Mobile Applications';
    if (lowerRole.includes('cloud') || lowerRole.includes('devops')) return 'Cloud Infrastructure';
  }

  return 'Software Engineering & Production Systems';
}

/**
 * Extracts years of experience from resume text
 */
export function extractExperienceYears(text: string): number | null {
  const match = text.match(/(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+experience/i);
  if (match && match[1]) {
    const yrs = parseInt(match[1], 10);
    if (!isNaN(yrs) && yrs > 0 && yrs <= 30) {
      return yrs;
    }
  }

  // Check date ranges like 2020 - 2024 or 2019 - Present
  const dateRanges = text.match(/\b(201\d|202\d)\s*[-–—to]+\s*(present|current|202\d)\b/gi);
  if (dateRanges && dateRanges.length > 0) {
    const currentYear = new Date().getFullYear();
    let earliest = currentYear;
    for (const range of dateRanges) {
      const startMatch = range.match(/\b(201\d|202\d)\b/);
      if (startMatch) {
        const start = parseInt(startMatch[1], 10);
        if (start < earliest) earliest = start;
      }
    }
    const diff = currentYear - earliest;
    if (diff > 0 && diff <= 25) return diff;
  }

  return null;
}

/**
 * Full resume parsing function
 */
export async function parseResumeBuffer(
  buffer: Buffer,
  filename: string
): Promise<ExtractedResumeData> {
  const text = await extractTextFromBuffer(buffer, filename);
  const name = extractCandidateName(text);
  const targetRole = extractTargetRole(text, name);
  const { all: skills, primary: primarySkills } = extractSkills(text);
  const yearsOfExperience = extractExperienceYears(text) || 3;
  const domain = extractBackgroundDomain(text, targetRole, skills);

  const topSkillsText = primarySkills.length > 0 ? primarySkills.slice(0, 4).join(', ') : 'modern tech stacks';
  const bioSummary = `${targetRole || 'Software Engineer'} with ${yearsOfExperience}+ years of experience in ${domain}, specializing in ${topSkillsText}.`;
  const relevantExperience = `Building and shipping production systems, end-to-end feature delivery, and scalable architecture with ${topSkillsText}.`;
  const background = domain;

  // Email and phone
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+91[-.\s]?\d{10}/);

  return {
    name,
    email: emailMatch ? emailMatch[1] : null,
    phone: phoneMatch ? phoneMatch[0] : null,
    targetRole,
    skills,
    primarySkills,
    yearsOfExperience,
    domain,
    background,
    bioSummary,
    relevantExperience,
    rawTextPreview: text.slice(0, 300).trim()
  };
}
