// Canonical skill taxonomy + normalization (Compatibility Engine Phase-1 grounding).
//
// Every LLM- or founder-entered skill is normalized against ONE canonical vocabulary before
// it touches matching, so "JS", "Javascript" and "javascript es6" all become "JavaScript"
// and synonyms stop splitting the evidence.
//
// HONESTY NOTE (see tests/fixtures/DATASHEET.md): this is a hand-derived SEED vocabulary
// covering the pilot's verticals, structured to be replaced/extended by derived fixtures
// from Lightcast Open Skills (free/open) and O*NET (public domain, US DOL) once those
// datasets are ingested. It is NOT the Lightcast/O*NET data itself and claims no such
// provenance. The ingestion path: regenerate CANONICAL from the derived fixture files and
// bump TAXONOMY_VERSION — no call-site changes needed.

export const TAXONOMY_VERSION = 'seed-1';

// canonical -> aliases (lowercase). Keep aliases specific enough not to swallow neighbors.
const CANONICAL = {
  'JavaScript': ['js', 'javascript', 'es6', 'ecmascript', 'node', 'node.js', 'nodejs'],
  'TypeScript': ['ts', 'typescript'],
  'Python': ['py', 'python', 'python3'],
  'Java': ['java'],
  'C++': ['c++', 'cpp'],
  'C#': ['c#', 'csharp'],
  'Go': ['go', 'golang'],
  'Rust': ['rust'],
  'SQL': ['sql', 'postgres', 'postgresql', 'mysql', 'sqlite'],
  'HTML/CSS': ['html', 'css', 'html/css', 'front-end (html/css)'],
  'React': ['react', 'reactjs', 'react.js', 'next', 'next.js', 'nextjs'],
  'Machine learning': ['ml', 'machine learning', 'deep learning', 'neural networks', 'pytorch', 'tensorflow'],
  'LLMs & prompting': ['llm', 'llms', 'prompt engineering', 'genai', 'generative ai'],
  'Data analysis': ['data analysis', 'data analytics', 'analytics', 'data science', 'data science (notebooks)', 'pandas', 'jupyter'],
  'Data visualization': ['data viz', 'data visualization', 'dashboards', 'tableau', 'power bi'],
  'Spreadsheets': ['excel', 'ms excel', 'google sheets', 'sheets', 'spreadsheets', 'spreadsheet modeling'],
  'Financial modeling': ['financial modeling', 'financial modelling', 'dcf', 'dcf modeling', 'valuation', 'comps'],
  'Accounting operations': ['bookkeeping', 'reconciliation', 'accounts payable', 'accounts receivable', 'ap/ar', 'month-end close', 'accounting'],
  'Equity research': ['equity research', 'stock pitch', 'stock pitches', 'investment research'],
  'Research': ['research', 'market research', 'literature review', 'research synthesis', 'competitive analysis', 'user research'],
  'Writing & documentation': ['writing', 'documentation', 'technical writing', 'copywriting', 'docs', 'knowledge base'],
  'Operations': ['operations', 'ops', 'process mapping', 'workflow mapping', 'sops', 'sop authoring', 'crm hygiene'],
  'QA & testing': ['qa', 'testing', 'automated testing', 'test cases', 'manual testing', 'bug reproduction', 'quality assurance'],
  'Robotics (ROS)': ['ros', 'ros2', 'robotics'],
  'Computer vision': ['computer vision', 'cv', 'opencv', 'image processing'],
  'Shell scripting': ['bash', 'shell', 'shell scripting', 'zsh'],
  'Git & version control': ['git', 'github', 'version control', 'sustained delivery (version control)'],
  'API design': ['api design', 'rest api', 'apis', 'backend'],
  'Cloud & DevOps': ['aws', 'gcp', 'azure', 'devops', 'docker', 'kubernetes', 'ci/cd'],
  'Design (UI/UX)': ['figma', 'ui', 'ux', 'ui/ux', 'product design', 'design'],
  'Marketing & growth': ['marketing', 'seo', 'growth', 'social media', 'content marketing'],
  'Sales & outreach': ['sales', 'outreach', 'cold email', 'lead generation', 'crm'],
  'Project management': ['project management', 'pm', 'scrum', 'agile'],
  'Statistics': ['statistics', 'stats', 'r', 'statistical analysis', 'regression'],
  'Healthcare operations': ['healthcare operations', 'clinical operations', 'healthcare ops'],
};

// alias -> canonical lookup (built once).
const LOOKUP = new Map();
for (const [canonical, aliases] of Object.entries(CANONICAL)) {
  LOOKUP.set(canonical.toLowerCase(), canonical);
  for (const a of aliases) LOOKUP.set(a, canonical);
}

const clean = s => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');

// Normalize one raw skill string. Exact alias hit first; then a containment pass for
// strings like "python for data pipelines". Unmatched skills pass through unchanged
// (matched:false) — normalization must never DROP a skill, only unify synonyms.
export function canonicalizeSkill(raw) {
  const c = clean(raw);
  if (!c) return { canonical: '', matched: false };
  if (LOOKUP.has(c)) return { canonical: LOOKUP.get(c), matched: true };
  for (const [alias, canonical] of LOOKUP) {
    if (alias.length >= 3 && (c === alias || c.startsWith(alias + ' ') || c.endsWith(' ' + alias) || c.includes(' ' + alias + ' '))) {
      return { canonical, matched: true };
    }
  }
  return { canonical: String(raw || '').trim(), matched: false };
}

// O*NET Work Styles -> Startup-Fit env_* anchors (the mapping the Startup-Fit weights hang
// on). Names follow O*NET's Work Styles element names; the mapping itself is Covenda's.
export const WORK_STYLE_ANCHORS = {
  'Independence': { dimension: 'autonomy', value: 'independent' },
  'Adaptability/Flexibility': { dimension: 'structure', value: 'ambiguous' },
  'Dependability': { dimension: 'structure', value: 'structured' },
  'Persistence': { dimension: 'pace', value: 'fast' },
  'Attention to Detail': { dimension: 'pace', value: 'steady' },
  'Initiative': { dimension: 'stage', value: 'idea' },
};
