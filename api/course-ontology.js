// Course → competency ontology (§25).
//
// ── WHAT THIS IS FOR, AND WHY IT IS NOT WHAT IT LOOKS LIKE ──────────────────────────────
// This file maps courses onto competencies. That is normally the first move of exactly the
// product Covenda exists to argue against: read a transcript, infer ability, rank people.
// This one is built to reach the opposite conclusion, and the machinery enforces it.
//
// The position is already stated elsewhere in this codebase and this file has to agree with
// it. `batches.js` splits by sector rather than skill because skill-shaped taxonomies are
// "how a curriculum thinks, not how a company hires". `super-intern.js` calls the thing that
// actually predicts work "the one thing a course transcript structurally cannot contain".
//
// So: a course is not evidence. It is a QUESTION GENERATOR.
//
// What a completed course honestly supports is one narrow claim, that a student sat in front
// of a syllabus, which makes it fair to ask them about its contents. It does not establish
// they can do the work, and it cannot separate a top mark from a bare pass, because the same
// transcript line covers both. Everything here is recorded through `completed_coursework`,
// whose ceiling in the source registry is `claimed`, which is excluded from matching. A
// caller asking for a higher tier is capped by `normaliseEvidence`, not by politeness.
//
// The output that carries the value is `provingPlan()`: it turns a list of courses into a
// list of things to BUILD. That is the funnel this is for. A student arrives holding the
// resume-shaped thing they already have and leaves with a to-build list that would produce
// evidence which actually counts. The transcript is the input, never the product.
//
// ── WHAT IS DELIBERATELY ABSENT ────────────────────────────────────────────────────────
// No score, rank, percentile, or readiness number. No GPA, no grades, no institution, and no
// weighting by school. No hiring-probability estimate. A course list that produced a number
// would be a resume screen with extra steps, and the number would be fabricated: there is no
// outcome data behind it, because Covenda has not placed a student yet.
import { SOURCES, normaliseEvidence } from './evidence.js';
import { canonicalizeSkill } from './skills-taxonomy.js';

export const COURSE_ONTOLOGY_VERSION = 'course-ontology-1.0.0';

// ── Families ──────────────────────────────────────────────────────────────────────────
// Coarse on purpose. These group the to-build list into readable sections; they are not a
// classification of the student.
export const FAMILIES = {
  computing: { id: 'computing', label: 'Computing' },
  data: { id: 'data', label: 'Data & machine learning' },
  mathematics: { id: 'mathematics', label: 'Mathematics' },
  finance: { id: 'finance', label: 'Finance & economics' },
  engineering: { id: 'engineering', label: 'Engineering & physical science' },
  life_science: { id: 'life_science', label: 'Life science' },
  method: { id: 'method', label: 'Research & communication' },
};

export const FAMILY_IDS = Object.keys(FAMILIES);

// ── Competencies ──────────────────────────────────────────────────────────────────────
// The shared vocabulary courses map onto. `provenBy` is the load-bearing field: it names the
// artifact that would move this competency off `claimed` and onto something a company can
// read. A competency with no proving route would be a dead end and does not belong here.
export const COMPETENCIES = {
  program_decomposition: {
    id: 'program_decomposition', label: 'Breaking a problem into parts', family: 'computing',
    provenBy: 'A repository where the commit history shows the structure arrived at over time.',
  },
  data_structure_choice: {
    id: 'data_structure_choice', label: 'Choosing a data structure for a constraint', family: 'computing',
    provenBy: 'Work where the choice was forced by a real limit, and an account of the alternative rejected.',
  },
  algorithmic_cost: {
    id: 'algorithmic_cost', label: 'Reasoning about time and memory cost', family: 'computing',
    provenBy: 'A measured before and after on something that was actually too slow.',
  },
  concurrency: {
    id: 'concurrency', label: 'Reasoning about concurrent execution', family: 'computing',
    provenBy: 'A race condition found and fixed, with the reproduction that showed it.',
  },
  memory_management: {
    id: 'memory_management', label: 'Managing memory explicitly', family: 'computing',
    provenBy: 'Code in a language without a garbage collector that survives a leak check.',
  },
  persistence_design: {
    id: 'persistence_design', label: 'Designing how data is stored and queried', family: 'computing',
    provenBy: 'A schema plus the queries it was shaped for, and what it is bad at.',
  },
  systems_debugging: {
    id: 'systems_debugging', label: 'Finding a fault in a running system', family: 'computing',
    provenBy: 'An account of a bug that took real time, including the wrong hypotheses first.',
  },
  interface_design: {
    id: 'interface_design', label: 'Designing an interface others call', family: 'computing',
    provenBy: 'An API somebody else integrated against, and what broke when they did.',
  },
  testing_discipline: {
    id: 'testing_discipline', label: 'Testing work before it ships', family: 'computing',
    provenBy: 'A test that failed first and caught a real regression later.',
  },
  statistical_inference: {
    id: 'statistical_inference', label: 'Inferring from a sample', family: 'data',
    provenBy: 'An analysis stating its assumptions and what would invalidate the result.',
  },
  probability_modelling: {
    id: 'probability_modelling', label: 'Modelling uncertainty', family: 'data',
    provenBy: 'A prediction made in advance, and the record of how it landed.',
  },
  data_cleaning: {
    id: 'data_cleaning', label: 'Getting real data into usable shape', family: 'data',
    provenBy: 'A messy public dataset, the cleaning steps, and the rows deliberately dropped.',
  },
  feature_construction: {
    id: 'feature_construction', label: 'Turning raw data into inputs', family: 'data',
    provenBy: 'Features with a stated reason each, and the ones that turned out not to help.',
  },
  model_training: {
    id: 'model_training', label: 'Training a model end to end', family: 'data',
    provenBy: 'A run somebody else can reproduce from the repository.',
  },
  model_evaluation: {
    id: 'model_evaluation', label: 'Evaluating a model honestly', family: 'data',
    provenBy: 'A held-out result plus the failure cases, not only the headline metric.',
  },
  overfitting_control: {
    id: 'overfitting_control', label: 'Telling learning from memorising', family: 'data',
    provenBy: 'A split defended against leakage, and the leak that was found and closed.',
  },
  text_processing: {
    id: 'text_processing', label: 'Working with language data', family: 'data',
    provenBy: 'A system evaluated on text it had never seen, including where it failed.',
  },
  image_processing: {
    id: 'image_processing', label: 'Working with image data', family: 'data',
    provenBy: 'A pipeline run against images collected outside the training conditions.',
  },
  calculus_methods: {
    id: 'calculus_methods', label: 'Continuous methods', family: 'mathematics',
    provenBy: 'A derivation applied to something physical, with units carried through.',
  },
  linear_algebra_methods: {
    id: 'linear_algebra_methods', label: 'Linear methods', family: 'mathematics',
    provenBy: 'An implementation from the mathematics up, not a library call.',
  },
  discrete_proof: {
    id: 'discrete_proof', label: 'Proving a discrete claim', family: 'mathematics',
    provenBy: 'A proof of a property of the student’s own code or algorithm.',
  },
  optimisation_methods: {
    id: 'optimisation_methods', label: 'Optimising under constraints', family: 'mathematics',
    provenBy: 'A formulation of a real constraint, solved, with the binding constraint named.',
  },
  accounting_mechanics: {
    id: 'accounting_mechanics', label: 'How the statements connect', family: 'finance',
    provenBy: 'A three-statement model that ties, built rather than downloaded.',
  },
  valuation_methods: {
    id: 'valuation_methods', label: 'Putting a value on a business', family: 'finance',
    provenBy: 'A valuation with the driver assumptions defended out loud.',
  },
  capital_structure: {
    id: 'capital_structure', label: 'How a business is financed', family: 'finance',
    provenBy: 'A structure analysed under a downside case that actually breaks it.',
  },
  portfolio_construction: {
    id: 'portfolio_construction', label: 'Combining positions', family: 'finance',
    provenBy: 'A sizing decision with the reason it is not larger.',
  },
  econometric_estimation: {
    id: 'econometric_estimation', label: 'Estimating a relationship from data', family: 'finance',
    provenBy: 'A specification with the identifying assumption stated and challenged.',
  },
  circuit_analysis: {
    id: 'circuit_analysis', label: 'Analysing a circuit', family: 'engineering',
    provenBy: 'A board that was built and measured, including what the measurement disagreed with.',
  },
  control_design: {
    id: 'control_design', label: 'Controlling a physical system', family: 'engineering',
    provenBy: 'A controller run on hardware, and how it behaved when the model was wrong.',
  },
  thermodynamic_analysis: {
    id: 'thermodynamic_analysis', label: 'Energy and transport analysis', family: 'engineering',
    provenBy: 'An analysis checked against a measurement rather than a textbook answer.',
  },
  mechanics_analysis: {
    id: 'mechanics_analysis', label: 'Forces and structures', family: 'engineering',
    provenBy: 'A part that was loaded, with the failure mode predicted beforehand.',
  },
  reaction_mechanisms: {
    id: 'reaction_mechanisms', label: 'Reasoning about reactions', family: 'life_science',
    provenBy: 'A synthesis attempted, including the step that did not work.',
  },
  molecular_methods: {
    id: 'molecular_methods', label: 'Molecular technique', family: 'life_science',
    provenBy: 'A protocol run with controls, and an account of a failed replicate.',
  },
  lab_technique: {
    id: 'lab_technique', label: 'Working at a bench', family: 'life_science',
    provenBy: 'A notebook somebody else could repeat the work from.',
  },
  experimental_design: {
    id: 'experimental_design', label: 'Designing an experiment', family: 'method',
    provenBy: 'A design with the control chosen for a stated reason and the confound named.',
  },
  literature_review: {
    id: 'literature_review', label: 'Reading a field', family: 'method',
    provenBy: 'A review that disagrees with something it cites, for a reason.',
  },
  technical_writing: {
    id: 'technical_writing', label: 'Writing for a reader who must act', family: 'method',
    provenBy: 'A document somebody made a decision from, and what they asked afterwards.',
  },
};

export const COMPETENCY_IDS = Object.keys(COMPETENCIES);

// ── Course kinds ──────────────────────────────────────────────────────────────────────
// The unit is a KIND of course, not a course code. Codes are institution-specific and change
// between catalogues, so a registry of them would be wrong the month after it was written and
// would quietly privilege the schools whose codes we happened to enter. Titles are close to
// standard across institutions, so `aliases` matches on those.
//
// `cannotShow` is not a disclaimer bolted on. It is the field a company reads, and for a
// course it is usually longer than what the course does show.
export const COURSE_KINDS = {
  programming_foundations: {
    id: 'programming_foundations', label: 'Introductory programming', family: 'computing',
    competencies: ['program_decomposition', 'testing_discipline'],
    demonstrates: 'Exposure to writing and running code against a specification somebody else set.',
    cannotShow: 'Whether the student can work without a specification. Assignments arrive already '
      + 'decomposed, which is the part of the job that is actually hard.',
    aliases: ['intro to programming', 'introduction to programming', 'introduction to computer science',
      'intro to computer science', 'programming fundamentals', 'computer science i', 'cs1',
      'principles of programming', 'structure and interpretation of computer programs'],
  },
  data_structures: {
    id: 'data_structures', label: 'Data structures', family: 'computing',
    competencies: ['data_structure_choice', 'algorithmic_cost', 'program_decomposition'],
    demonstrates: 'Exposure to the standard structures and the costs that separate them.',
    cannotShow: 'Choosing under a real constraint. Coursework names the structure in the question.',
    aliases: ['data structures', 'data structures and algorithms', 'abstract data types',
      'computer science ii', 'cs2'],
  },
  algorithms: {
    id: 'algorithms', label: 'Algorithms', family: 'computing',
    competencies: ['algorithmic_cost', 'discrete_proof', 'optimisation_methods'],
    demonstrates: 'Exposure to complexity analysis and standard algorithm design techniques.',
    cannotShow: 'That any of it transfers. Interview-shaped problems are the exception in real work, '
      + 'where the cost that matters is usually I/O rather than the inner loop.',
    aliases: ['algorithms', 'design and analysis of algorithms', 'algorithm design',
      'introduction to algorithms', 'advanced algorithms'],
  },
  systems_programming: {
    id: 'systems_programming', label: 'Systems programming', family: 'computing',
    competencies: ['memory_management', 'systems_debugging', 'concurrency'],
    demonstrates: 'Exposure to memory, processes, and what the machine actually does.',
    cannotShow: 'Debugging something nobody has debugged before. A course assignment has a known fix.',
    aliases: ['systems programming', 'computer systems', 'introduction to computer systems',
      'c programming', 'computer organization', 'computer architecture'],
  },
  operating_systems: {
    id: 'operating_systems', label: 'Operating systems', family: 'computing',
    competencies: ['concurrency', 'memory_management', 'systems_debugging'],
    demonstrates: 'Exposure to scheduling, virtual memory, and concurrency primitives.',
    cannotShow: 'Reasoning about a concurrency bug in production, where it is not reproducible on demand.',
    aliases: ['operating systems', 'operating system design', 'concurrency', 'parallel programming',
      'concurrent programming'],
  },
  databases: {
    id: 'databases', label: 'Databases', family: 'computing',
    competencies: ['persistence_design', 'data_structure_choice'],
    demonstrates: 'Exposure to the relational model, query languages, and normalisation.',
    cannotShow: 'Designing a schema for requirements that will change. Course schemas are given and final.',
    aliases: ['databases', 'database systems', 'introduction to databases', 'database design', 'sql'],
  },
  networks: {
    id: 'networks', label: 'Networking', family: 'computing',
    competencies: ['systems_debugging', 'interface_design'],
    demonstrates: 'Exposure to the protocol stack and how machines talk to each other.',
    cannotShow: 'Diagnosing a network fault under time pressure with incomplete visibility.',
    aliases: ['computer networks', 'networking', 'introduction to computer networks',
      'network programming', 'distributed systems'],
  },
  software_engineering: {
    id: 'software_engineering', label: 'Software engineering', family: 'computing',
    competencies: ['interface_design', 'testing_discipline', 'program_decomposition'],
    demonstrates: 'Exposure to working in a team on a codebase larger than one assignment.',
    cannotShow: 'Working in a codebase you did not start, which is the normal condition of the job. '
      + 'A term project is greenfield and ends before maintenance begins.',
    aliases: ['software engineering', 'software design', 'software development',
      'object oriented programming', 'introduction to software engineering'],
  },
  machine_learning: {
    id: 'machine_learning', label: 'Machine learning', family: 'data',
    competencies: ['model_training', 'model_evaluation', 'overfitting_control', 'feature_construction'],
    demonstrates: 'Exposure to the standard model families and the train and evaluate loop.',
    cannotShow: 'Working with data nobody has cleaned. Course datasets are prepared, balanced, and '
      + 'have a known achievable result, which removes most of the actual difficulty.',
    aliases: ['machine learning', 'introduction to machine learning', 'applied machine learning',
      'statistical learning', 'pattern recognition'],
  },
  deep_learning: {
    id: 'deep_learning', label: 'Deep learning', family: 'data',
    competencies: ['model_training', 'model_evaluation', 'linear_algebra_methods'],
    demonstrates: 'Exposure to network architectures and gradient-based training.',
    cannotShow: 'Judgement about when not to use one. Coursework never has a baseline that wins.',
    aliases: ['deep learning', 'neural networks', 'introduction to deep learning',
      'artificial neural networks'],
  },
  nlp: {
    id: 'nlp', label: 'Natural language processing', family: 'data',
    competencies: ['text_processing', 'model_evaluation'],
    demonstrates: 'Exposure to language modelling and evaluation on text benchmarks.',
    cannotShow: 'Performance on the messy, domain-specific text an employer actually holds.',
    aliases: ['natural language processing', 'nlp', 'computational linguistics',
      'speech and language processing'],
  },
  computer_vision: {
    id: 'computer_vision', label: 'Computer vision', family: 'data',
    competencies: ['image_processing', 'model_evaluation', 'linear_algebra_methods'],
    demonstrates: 'Exposure to image pipelines and vision model evaluation.',
    cannotShow: 'Behaviour under real capture conditions: lighting, motion, and sensors that differ.',
    aliases: ['computer vision', 'image processing', 'introduction to computer vision',
      'digital image processing'],
  },
  statistics: {
    id: 'statistics', label: 'Statistics', family: 'data',
    competencies: ['statistical_inference', 'probability_modelling', 'experimental_design'],
    demonstrates: 'Exposure to estimation, testing, and what a confidence interval means.',
    cannotShow: 'Resisting a result that is convenient. The pressure that produces bad statistics '
      + 'is not present in a problem set.',
    aliases: ['statistics', 'introduction to statistics', 'statistical inference',
      'mathematical statistics', 'probability and statistics', 'biostatistics'],
  },
  probability: {
    id: 'probability', label: 'Probability', family: 'mathematics',
    competencies: ['probability_modelling', 'discrete_proof'],
    demonstrates: 'Exposure to random variables, distributions, and limit results.',
    cannotShow: 'Deciding what to model as random when nobody has specified the model.',
    aliases: ['probability', 'introduction to probability', 'probability theory',
      'stochastic processes', 'random processes'],
  },
  data_analysis: {
    id: 'data_analysis', label: 'Data analysis', family: 'data',
    competencies: ['data_cleaning', 'statistical_inference', 'technical_writing'],
    demonstrates: 'Exposure to exploring a dataset and reporting what is in it.',
    cannotShow: 'Getting the data in the first place, or knowing the question was worth asking.',
    aliases: ['data analysis', 'data science', 'introduction to data science', 'exploratory data analysis',
      'applied data analysis', 'data visualization'],
  },
  calculus: {
    id: 'calculus', label: 'Calculus', family: 'mathematics',
    competencies: ['calculus_methods'],
    demonstrates: 'Exposure to differentiation, integration, and multivariable methods.',
    cannotShow: 'Setting up the problem. Calculus questions arrive already formulated.',
    aliases: ['calculus', 'calculus i', 'calculus ii', 'calculus iii', 'multivariable calculus',
      'differential equations', 'vector calculus', 'real analysis'],
  },
  linear_algebra: {
    id: 'linear_algebra', label: 'Linear algebra', family: 'mathematics',
    competencies: ['linear_algebra_methods'],
    demonstrates: 'Exposure to vector spaces, decompositions, and eigenstructure.',
    cannotShow: 'Recognising the linear-algebraic structure in a problem stated in another language.',
    aliases: ['linear algebra', 'matrix theory', 'applied linear algebra',
      'introduction to linear algebra', 'matrix computations'],
  },
  discrete_mathematics: {
    id: 'discrete_mathematics', label: 'Discrete mathematics', family: 'mathematics',
    competencies: ['discrete_proof'],
    demonstrates: 'Exposure to proof technique, combinatorics, and graphs.',
    cannotShow: 'Proving something nobody has assigned, about code the student wrote.',
    aliases: ['discrete mathematics', 'discrete math', 'discrete structures', 'logic and proof',
      'combinatorics', 'graph theory'],
  },
  optimisation: {
    id: 'optimisation', label: 'Optimisation', family: 'mathematics',
    competencies: ['optimisation_methods', 'linear_algebra_methods'],
    demonstrates: 'Exposure to convex problems, duality, and solver behaviour.',
    cannotShow: 'Formulating the objective, which is where real optimisation problems are won or lost.',
    aliases: ['optimization', 'optimisation', 'convex optimization', 'linear programming',
      'operations research', 'mathematical programming'],
  },
  accounting: {
    id: 'accounting', label: 'Accounting', family: 'finance',
    competencies: ['accounting_mechanics'],
    demonstrates: 'Exposure to the three statements and how they articulate.',
    cannotShow: 'Spotting an aggressive treatment in a filing nobody flagged.',
    aliases: ['accounting', 'financial accounting', 'introduction to accounting',
      'managerial accounting', 'intermediate accounting'],
  },
  corporate_finance: {
    id: 'corporate_finance', label: 'Corporate finance', family: 'finance',
    competencies: ['valuation_methods', 'capital_structure', 'accounting_mechanics'],
    demonstrates: 'Exposure to discounting, cost of capital, and capital structure decisions.',
    cannotShow: 'Defending a driver assumption to somebody who disagrees and has more context.',
    aliases: ['corporate finance', 'introduction to finance', 'financial management',
      'principles of finance', 'business finance'],
  },
  investments: {
    id: 'investments', label: 'Investments', family: 'finance',
    competencies: ['portfolio_construction', 'probability_modelling'],
    demonstrates: 'Exposure to asset pricing, risk and return, and portfolio theory.',
    cannotShow: 'Sizing a position when being wrong costs somebody money.',
    aliases: ['investments', 'portfolio management', 'asset pricing', 'security analysis',
      'investment analysis', 'capital markets'],
  },
  financial_modelling: {
    id: 'financial_modelling', label: 'Financial modelling', family: 'finance',
    competencies: ['accounting_mechanics', 'valuation_methods'],
    demonstrates: 'Exposure to building a linked model in a spreadsheet.',
    cannotShow: 'Whether the model was built or the template was filled in. This is the single '
      + 'largest gap between a course and the work, and it is why Covenda parses the workbook.',
    aliases: ['financial modeling', 'financial modelling', 'valuation', 'financial statement analysis',
      'equity research'],
  },
  econometrics: {
    id: 'econometrics', label: 'Econometrics', family: 'finance',
    competencies: ['econometric_estimation', 'statistical_inference'],
    demonstrates: 'Exposure to regression, identification, and the standard failure modes.',
    cannotShow: 'Refusing to report a specification that only worked after the twentieth attempt.',
    aliases: ['econometrics', 'introduction to econometrics', 'applied econometrics',
      'economic statistics', 'quantitative methods in economics'],
  },
  circuits: {
    id: 'circuits', label: 'Circuits', family: 'engineering',
    competencies: ['circuit_analysis'],
    demonstrates: 'Exposure to circuit analysis and the behaviour of standard components.',
    cannotShow: 'What happens when the physical board disagrees with the analysis.',
    aliases: ['circuits', 'circuit analysis', 'electrical circuits', 'electronics',
      'introduction to electrical engineering', 'analog electronics'],
  },
  control_systems: {
    id: 'control_systems', label: 'Control systems', family: 'engineering',
    competencies: ['control_design', 'calculus_methods'],
    demonstrates: 'Exposure to feedback, stability, and controller tuning.',
    cannotShow: 'Behaviour on hardware, where the plant model is wrong and the sensors are noisy.',
    aliases: ['control systems', 'feedback control', 'linear control systems',
      'introduction to control', 'dynamics and control', 'robotics'],
  },
  thermodynamics: {
    id: 'thermodynamics', label: 'Thermodynamics', family: 'engineering',
    competencies: ['thermodynamic_analysis', 'calculus_methods'],
    demonstrates: 'Exposure to energy balance, cycles, and transport.',
    cannotShow: 'Analysis where the boundary conditions are unknown and must be assumed.',
    aliases: ['thermodynamics', 'heat transfer', 'fluid mechanics', 'transport phenomena',
      'statistical mechanics'],
  },
  mechanics: {
    id: 'mechanics', label: 'Mechanics', family: 'engineering',
    competencies: ['mechanics_analysis', 'calculus_methods'],
    demonstrates: 'Exposure to statics, dynamics, and material behaviour under load.',
    cannotShow: 'Predicting a failure mode in a part that was actually manufactured.',
    aliases: ['statics', 'dynamics', 'mechanics of materials', 'solid mechanics', 'strength of materials',
      'engineering mechanics', 'classical mechanics', 'physics i'],
  },
  organic_chemistry: {
    id: 'organic_chemistry', label: 'Organic chemistry', family: 'life_science',
    competencies: ['reaction_mechanisms', 'lab_technique'],
    demonstrates: 'Exposure to mechanisms, synthesis routes, and bench technique.',
    cannotShow: 'What the student does when a synthesis fails and the deadline does not move.',
    aliases: ['organic chemistry', 'organic chemistry i', 'organic chemistry ii',
      'general chemistry', 'physical chemistry', 'inorganic chemistry'],
  },
  molecular_biology: {
    id: 'molecular_biology', label: 'Molecular biology', family: 'life_science',
    competencies: ['molecular_methods', 'lab_technique', 'experimental_design'],
    demonstrates: 'Exposure to molecular technique and the standard protocols.',
    cannotShow: 'Troubleshooting a protocol that stopped working for no visible reason.',
    aliases: ['molecular biology', 'genetics', 'biochemistry', 'cell biology',
      'introduction to biology', 'microbiology'],
  },
  research_methods: {
    id: 'research_methods', label: 'Research methods', family: 'method',
    competencies: ['experimental_design', 'literature_review', 'statistical_inference'],
    demonstrates: 'Exposure to designing a study and reading the surrounding literature.',
    cannotShow: 'Whether the student would report a result that contradicted their hypothesis.',
    aliases: ['research methods', 'experimental design', 'scientific method',
      'introduction to research', 'design of experiments'],
  },
  technical_communication: {
    id: 'technical_communication', label: 'Technical writing', family: 'method',
    competencies: ['technical_writing', 'literature_review'],
    demonstrates: 'Exposure to writing for a technical reader.',
    cannotShow: 'Writing for a reader who has to make a decision and has ten minutes.',
    aliases: ['technical writing', 'technical communication', 'scientific writing',
      'professional communication', 'business writing'],
  },
};

export const COURSE_KIND_IDS = Object.keys(COURSE_KINDS);

// ── Matching a typed course title ─────────────────────────────────────────────────────
// Same contract as `canonicalizeSkill`: never drop input. A course we do not recognise is
// still the student's course, so it comes back with `matched: false` and its own text
// preserved rather than being silently discarded or forced into the nearest bucket.
const ALIAS_LOOKUP = new Map();
for (const kind of Object.values(COURSE_KINDS)) {
  ALIAS_LOOKUP.set(kind.label.toLowerCase(), kind.id);
  for (const alias of kind.aliases) ALIAS_LOOKUP.set(alias, kind.id);
}

// Course codes are stripped before matching, not registered: "CS 61A Introduction to
// Programming" and "6.006 Algorithms" should both find their kind without this file
// pretending to know any institution's catalogue.
const COURSE_CODE = /^\s*[a-z]{2,6}\s*[-.]?\s*\d{1,4}[a-z]?\b[:.\-\s]*/i;

export function matchCourse(raw = '') {
  const text = String(raw || '').trim();
  if (!text) return { kind: null, matched: false, title: '' };
  const stripped = text.replace(COURSE_CODE, '').trim() || text;
  const key = stripped.toLowerCase().replace(/\s+/g, ' ');

  const exact = ALIAS_LOOKUP.get(key);
  if (exact) return { kind: COURSE_KINDS[exact], matched: true, title: stripped };

  // Containment, longest alias first so "machine learning" is not stolen by a shorter alias
  // that happens to be a substring of it.
  const candidates = [...ALIAS_LOOKUP.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [alias, id] of candidates) {
    if (alias.length >= 5 && key.includes(alias)) {
      return { kind: COURSE_KINDS[id], matched: true, title: stripped };
    }
  }
  return { kind: null, matched: false, title: stripped };
}

// ── Recording coursework ──────────────────────────────────────────────────────────────
// Returns rather than throws, like every other model in this directory, so a caller can
// report the reason to a student instead of a 500.
export function recordCoursework(entry = {}) {
  const found = matchCourse(entry.title);
  if (!found.title) return { ok: false, reason: 'Enter the course name.' };
  if (!found.matched) {
    // Not an error. An unrecognised course is recorded as a course, with no competencies
    // attached, because guessing would be inventing evidence.
    return {
      ok: false, reason: `This is not a course Covenda maps yet: “${found.title}”. `
        + 'It can still be listed, and it will not carry any claims.',
      claims: [], unmapped: true, title: found.title,
    };
  }

  const kind = found.kind;
  const source = SOURCES[entry.source] ? entry.source : 'completed_coursework';

  const claims = [];
  const refused = [];
  for (const id of kind.competencies) {
    const competency = COMPETENCIES[id];
    if (!competency) continue;
    // Route the label through the shared taxonomy so these land in the same namespace
    // `match.js` and `batches.js` already read, rather than a parallel vocabulary.
    const skill = canonicalizeSkill(competency.label).canonical;
    const result = normaliseEvidence({
      source,
      skill,
      // Always `claimed`. Passed explicitly rather than defaulted so the intent is visible
      // at the call site; `normaliseEvidence` caps it regardless of what arrives here.
      tier: 'claimed',
      pointer: null,
      meta: {
        course_kind: kind.id,
        course_title: found.title,
        competency: competency.id,
        family: kind.family,
        demonstrates: kind.demonstrates,
        cannotShow: kind.cannotShow,
        proven_by: competency.provenBy,
        entry_id: entry.id || `${kind.id}:${found.title}`,
      },
    });
    if (result.ok) claims.push(result.claim);
    else refused.push({ skill, reason: result.reason });
  }

  return {
    ok: claims.length > 0,
    reason: claims.length ? null : 'That course did not produce any claims.',
    kind, title: found.title, claims, refused,
    demonstrates: kind.demonstrates,
    cannotShow: kind.cannotShow,
  };
}

// ── The profile ───────────────────────────────────────────────────────────────────────
// Aggregates by family for readability. There is no score and there will not be one: see the
// header. `unproven` is the headline number precisely because it is the honest one.
export function courseworkProfile(claims = []) {
  const families = {};
  const courses = new Set();
  const competencies = new Map();

  for (const claim of claims) {
    const meta = claim?.evidence_meta || {};
    if (!meta.course_kind) continue;
    const family = meta.family || 'method';
    families[family] = families[family] || { id: family, label: FAMILIES[family]?.label || family, courses: new Set(), competencies: new Set() };
    families[family].courses.add(meta.course_title);
    families[family].competencies.add(meta.competency);
    courses.add(meta.course_title);
    if (meta.competency) competencies.set(meta.competency, meta.proven_by);
  }

  return {
    version: COURSE_ONTOLOGY_VERSION,
    families: Object.values(families).map(f => ({
      id: f.id, label: f.label,
      courses: [...f.courses], competencies: [...f.competencies],
    })),
    courses: [...courses],
    courseCount: courses.size,
    competencies: [...competencies.keys()],
    // Every one of them. Coursework cannot rise above `claimed`, so the count of unproven
    // competencies is always the count of competencies. Stated as a number anyway, because a
    // student reading their own page should see the size of the gap rather than infer it.
    unproven: competencies.size,
    note: 'Coursework is recorded as claimed and is excluded from matching. It sets what a '
      + 'company can fairly ask about, not what has been shown.',
  };
}

// ── The to-build list ─────────────────────────────────────────────────────────────────
// The output this file exists for. Every competency a course exposed becomes a route to work
// that would actually establish it.
export function provingPlan(profile = {}, options = {}) {
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 6;
  const wanted = Array.isArray(options.family) ? options.family : null;

  const plan = [];
  for (const id of profile.competencies || []) {
    const competency = COMPETENCIES[id];
    if (!competency) continue;
    if (wanted && !wanted.includes(competency.family)) continue;
    plan.push({
      competency: competency.id,
      label: competency.label,
      family: competency.family,
      currently: 'claimed',
      build: competency.provenBy,
    });
  }
  return { version: COURSE_ONTOLOGY_VERSION, plan: plan.slice(0, limit), total: plan.length };
}

// ── Rehydration ───────────────────────────────────────────────────────────────────────
// Stored rows are re-read through `recordCoursework` rather than storing derived claims, for
// the same reason `finance-evidence.js` does it: a correction to a ceiling or a mapping then
// applies to rows already written instead of only to new ones.
export function claimsFromStoredCoursework(rows = []) {
  const claims = [];
  for (const row of rows) {
    if (!row || !COURSE_KINDS[row.course_kind]) continue;
    const assessed = recordCoursework({
      id: row.id,
      title: row.course_title,
      source: row.source,
    });
    if (assessed.ok) claims.push(...assessed.claims);
  }
  return claims;
}
