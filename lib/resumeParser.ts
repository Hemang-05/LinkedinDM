import mammoth from 'mammoth';

export interface ExtractedResumeData {
  name: string | null;
  email: string | null;
  phone: string | null;
  targetRole: string | null;
  skills: string[];
  yearsOfExperience: number | null;
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

// Known tech skills pool for matching
const TECH_SKILLS_POOL = [
  'React',
  'Next.js',
  'TypeScript',
  'JavaScript',
  'Python',
  'FastAPI',
  'Django',
  'Flask',
  'Node.js',
  'Express',
  'PostgreSQL',
  'MongoDB',
  'MySQL',
  'Redis',
  'Docker',
  'Kubernetes',
  'AWS',
  'GCP',
  'Azure',
  'GraphQL',
  'REST APIs',
  'TailwindCSS',
  'LLM/RAG',
  'Git'
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
export function extractTargetRole(text: string): string | null {
  const commonRoles = [
    'Full Stack Engineer',
    'Full Stack Developer',
    'Software Engineer',
    'Senior Software Engineer',
    'Frontend Engineer',
    'Frontend Developer',
    'Backend Engineer',
    'Backend Developer',
    'Product Engineer',
    'Founding Engineer',
    'AI Engineer',
    'Machine Learning Engineer',
    'Software Development Engineer'
  ];

  const lower = text.toLowerCase();
  for (const role of commonRoles) {
    if (lower.includes(role.toLowerCase())) {
      return role;
    }
  }
  return null;
}

/**
 * Extracts skills mentioned in the resume
 */
export function extractSkills(text: string): string[] {
  const lower = text.toLowerCase();
  const matched: string[] = [];

  for (const skill of TECH_SKILLS_POOL) {
    // Regex word boundary matching
    const re = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(lower)) {
      matched.push(skill);
    }
  }

  return Array.from(new Set(matched));
}

/**
 * Extracts years of experience from resume
 */
export function extractExperienceYears(text: string): number | null {
  const match = text.match(/(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+experience/i);
  if (match && match[1]) {
    const yrs = parseInt(match[1], 10);
    if (!isNaN(yrs) && yrs > 0 && yrs <= 30) {
      return yrs;
    }
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
  const targetRole = extractTargetRole(text);
  const skills = extractSkills(text);
  const yearsOfExperience = extractExperienceYears(text);

  // Email and phone
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+91[-.\s]?\d{10}/);

  return {
    name,
    email: emailMatch ? emailMatch[1] : null,
    phone: phoneMatch ? phoneMatch[0] : null,
    targetRole,
    skills,
    yearsOfExperience,
    rawTextPreview: text.slice(0, 300).trim()
  };
}
