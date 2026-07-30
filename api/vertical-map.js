// One research anchor per specialisation, and what it implies for the simulation.
//
// ── WHAT AN ANCHOR IS ─────────────────────────────────────────────────────────────────
// A reference point for understanding how a kind of work is actually evaluated. Reading how
// deal teams brief analysts, or how a payments team reviews a pull request, is legitimate
// research and it is how the scenarios get their shape.
//
// ── WHAT AN ANCHOR IS NOT ─────────────────────────────────────────────────────────────
// A partner, a customer, an endorsement, or a source of anything proprietary. This is the one
// thing in the file that will get misread, so `anchorsArePartners` is exported as a hard false
// and a test asserts nothing in this module ever presents an anchor as a relationship.
//
// The consequence of getting it wrong is not abstract: a founder who spots an implied
// partnership that does not exist stops believing the rest of the page, and they are right to.
//
// ── WHY EACH ENTRY CARRIES `buildVsBuy` ───────────────────────────────────────────────
// Covenda should own professional context, evidence, and verification. Code execution,
// spreadsheet engines and cyber ranges are commodity. Recording the call per vertical stops
// the same argument being had twenty-five times.

export const VERTICAL_MAP_VERSION = 'vertical-map-1.0.0';

// Stated as data so it cannot drift out of a comment and into a claim.
export const anchorsArePartners = false;
export const ANCHOR_DISCLAIMER =
  'Research references only. No partnership, affiliation, customer relationship or endorsement '
  + 'is implied or claimed by any company named here.';

export const VERTICALS = {
  // ── Software & AI ───────────────────────────────────────────────────────────────────
  'ai-ml': {
    batch: 'Software & AI',
    anchors: ['OpenAI', 'Anthropic', 'Google DeepMind'],
    evaluates: 'Whether someone can tell a real result from a leak, and say which.',
    simulation: 'An evaluation harness reporting a suspiciously good number. Find why.',
    skills: ['experiment design', 'data leakage detection', 'metric selection'],
    buildVsBuy: { buy: 'notebook execution', build: 'the scenario, the defense, the evidence' },
  },
  'physical-ai': {
    batch: 'Software & AI',
    anchors: ['Boston Dynamics', 'NVIDIA'],
    evaluates: 'Whether simulation intuition survives contact with hardware.',
    simulation: 'Conversational. A controller that held setpoint in sim and oscillates on the rig.',
    skills: ['control intuition', 'sensor reasoning', 'failure diagnosis'],
    buildVsBuy: { buy: 'nothing usable here', build: 'the anecdote probe, because the work happened months ago on hardware' },
  },
  'infrastructure-data': {
    batch: 'Software & AI',
    anchors: ['Snowflake', 'Databricks'],
    evaluates: 'Whether someone notices data disappearing quietly.',
    simulation: 'A pipeline that runs clean and drops three percent of rows.',
    skills: ['pipeline debugging', 'join semantics', 'data validation'],
    buildVsBuy: { buy: 'query execution', build: 'the silent-failure scenario' },
  },
  'product-engineering': {
    batch: 'Software & AI',
    anchors: ['Stripe', 'Linear', 'GitHub'],
    evaluates: 'Whether someone understood the code they changed.',
    simulation: 'An inherited bug with a test that passes for the wrong reason.',
    skills: ['debugging', 'reading unfamiliar code', 'test design'],
    buildVsBuy: { buy: 'code execution and test harnesses', build: 'the professional context and ownership defense' },
  },
  'security-reliability': {
    batch: 'Software & AI',
    anchors: ['CrowdStrike', 'Cloudflare'],
    evaluates: 'Whether someone contains first and explains after, or the reverse.',
    simulation: 'An incident in progress, with information arriving out of order.',
    skills: ['incident triage', 'blast-radius reasoning', 'communication under pressure'],
    buildVsBuy: { buy: 'cyber range environments', build: 'the decision sequence and the evidence' },
  },

  // ── Accounting & finance ────────────────────────────────────────────────────────────
  'investment-banking': {
    batch: 'Accounting & finance',
    anchors: ['Goldman Sachs', 'Evercore', 'JPMorgan'],
    evaluates: 'What someone does when a number stops making sense on a deadline.',
    simulation: 'A deal room with a recurring add-back management calls one-off.',
    skills: ['financial statement analysis', 'valuation', 'prioritisation under pressure'],
    buildVsBuy: { buy: 'spreadsheet tooling', build: 'the scenario, the VP pressure, the defense' },
  },
  'private-equity': {
    batch: 'Accounting & finance',
    anchors: ['Blackstone', 'KKR', 'Apollo'],
    evaluates: 'Whether someone underwrites the downside or only the base case.',
    simulation: 'An investment committee where the sponsor case assumes the cycle holds.',
    skills: ['LBO mechanics', 'downside underwriting', 'diligence prioritisation'],
    buildVsBuy: { buy: 'modelling tools', build: 'the committee scenario' },
  },
  'venture-capital': {
    batch: 'Accounting & finance',
    anchors: ['Sequoia', 'Benchmark'],
    evaluates: 'Whether someone can decide on thin information without pretending it is thick.',
    simulation: 'A company with strong growth, weak retention, and a founder who has an answer for both.',
    skills: ['market judgement', 'retention reading', 'founder assessment'],
    buildVsBuy: { buy: 'nothing', build: 'the memo and the partner-meeting defense' },
  },
  'asset-wealth-management': {
    batch: 'Accounting & finance',
    anchors: ['BlackRock', 'Fidelity'],
    evaluates: 'Whether someone sizes to a rule or to a hunch. Returns are not the measure.',
    simulation: 'A client mandate, a drawdown limit, and a market shock mid-scenario.',
    skills: ['suitability', 'risk sizing', 'rebalancing discipline'],
    buildVsBuy: { buy: 'portfolio maths', build: 'the suitability judgement, which is the whole job' },
  },
  'accounting-audit': {
    batch: 'Accounting & finance',
    anchors: ['Deloitte', 'PwC', 'EY', 'KPMG'],
    evaluates: 'Whether someone reconciles or accepts.',
    simulation: 'Two ledgers that should agree, with six discrepancies and matching row counts.',
    skills: ['reconciliation', 'anomaly detection', 'workpaper discipline'],
    buildVsBuy: { buy: 'spreadsheet parsing', build: 'the discrepancy design' },
  },

  // ── Professional services ───────────────────────────────────────────────────────────
  'management-consulting': {
    batch: 'Professional services',
    anchors: ['McKinsey', 'BCG', 'Bain'],
    evaluates: 'Whether structure survives a fact that breaks the hypothesis.',
    simulation: 'A live case where a mid-case fact contradicts the obvious answer.',
    skills: ['problem structuring', 'hypothesis revision', 'synthesis'],
    buildVsBuy: { buy: 'nothing', build: 'the adaptive case, because the branch IS the assessment' },
  },
  'strategy-research': {
    batch: 'Professional services',
    anchors: ['Gartner', 'Forrester'],
    evaluates: 'Whether someone frames before answering, and says what they could not find.',
    simulation: 'A vague question and sources, two of which contradict each other.',
    skills: ['framing', 'source triangulation', 'stating limits'],
    buildVsBuy: { buy: 'nothing', build: 'the source set and the gap probe' },
  },
  'market-intelligence': {
    batch: 'Professional services',
    anchors: ['Nielsen', 'Euromonitor'],
    evaluates: 'Whether someone sizes bottom-up and states how wrong they might be.',
    simulation: 'A market to size with deliberately incomplete public data.',
    skills: ['bottom-up sizing', 'assumption exposure', 'error bounding'],
    buildVsBuy: { buy: 'nothing', build: 'the incomplete data set' },
  },
  'legal-operations': {
    batch: 'Professional services',
    anchors: ['Ironclad', 'Clio'],
    evaluates: 'Whether someone designs for the exception rather than the happy path.',
    simulation: 'A contract-request process with three named failure modes.',
    skills: ['process design', 'exception handling', 'escalation logic'],
    buildVsBuy: { buy: 'nothing', build: 'the messy process' },
  },
  'technical-writing': {
    batch: 'Professional services',
    anchors: ['Stripe Docs', 'Twilio'],
    evaluates: 'Whether someone documents what is true rather than what is intended.',
    simulation: 'An unfamiliar API whose behaviour differs from its README.',
    skills: ['reading source', 'audience calibration', 'documenting the gap'],
    buildVsBuy: { buy: 'nothing', build: 'the mismatch between doc and behaviour' },
  },

  'content-production': {
    batch: 'Professional services',
    anchors: ['Stripe Press', 'Substack'],
    evaluates: 'Whether someone refuses to publish a claim they cannot source, even when it performs.',
    simulation: 'A high-performing post built on a figure that traces back to nothing.',
    skills: ['sourcing a claim', 'editorial judgement', 'holding a line under traffic pressure'],
    buildVsBuy: { buy: 'nothing', build: 'the correction nobody asked for' },
  },
  'creator-marketing': {
    batch: 'Professional services',
    anchors: ['TikTok Creative Center', 'Later'],
    evaluates: 'Whether someone can judge other people\u2019s work, not just produce their own.',
    simulation: 'Four creators where the best audience fit carries the most brand risk.',
    skills: ['creator judgement', 'briefing to a boundary', 'measuring the right thing'],
    buildVsBuy: { buy: 'reach', build: 'the reason this creator and not that one' },
  },

  // ── Consumer & retail ───────────────────────────────────────────────────────────────
  'growth-performance': {
    batch: 'Consumer & retail',
    anchors: ['Meta', 'Google Ads'],
    evaluates: 'Whether someone chases the obvious drop or finds the real one.',
    simulation: 'A funnel where the visible drop-off is a red herring.',
    skills: ['funnel analysis', 'segmentation', 'experiment design'],
    buildVsBuy: { buy: 'analytics sandboxes', build: 'the red herring' },
  },
  'brand-content': {
    batch: 'Consumer & retail',
    anchors: ['Glossier', 'Oatly'],
    evaluates: 'Whether someone can defend a creative choice against a constraint.',
    simulation: 'Three directions and a constraint that rules out the strongest.',
    skills: ['creative judgement', 'constraint reasoning', 'defending a choice'],
    buildVsBuy: { buy: 'nothing', build: 'the constraint that bites' },
  },
  merchandising: {
    batch: 'Consumer & retail',
    anchors: ['Zara', 'Target'],
    evaluates: 'Whether someone reads basket contribution or only SKU margin.',
    simulation: 'A range where the obvious cut is also the traffic driver.',
    skills: ['assortment reasoning', 'margin vs basket', 'cannibalisation'],
    buildVsBuy: { buy: 'nothing', build: 'the loss-leader trap' },
  },
  'supply-chain': {
    batch: 'Consumer & retail',
    anchors: ['Amazon', 'Maersk'],
    evaluates: 'Whether someone notices a structural break or fits through it.',
    simulation: 'Demand history with a break partway, and a cost of being wrong.',
    skills: ['forecasting', 'break detection', 'pricing the error'],
    buildVsBuy: { buy: 'nothing', build: 'the break' },
  },
  'ecommerce-marketplace': {
    batch: 'Consumer & retail',
    anchors: ['Shopify', 'Etsy'],
    evaluates: 'Whether someone can tell which side of a marketplace is starving.',
    simulation: 'Healthy demand, concentrated supply, worsening experience.',
    skills: ['two-sided reasoning', 'liquidity diagnosis', 'metric selection'],
    buildVsBuy: { buy: 'nothing', build: 'the concentration that hides in aggregates' },
  },

  // ── Healthcare operations ───────────────────────────────────────────────────────────
  // Built last, per the plan. Synthetic data only, human review mandatory.
  'clinical-operations': {
    batch: 'Healthcare operations',
    anchors: ['Kaiser Permanente', 'Cleveland Clinic'],
    evaluates: 'Whether someone finds the constraint or adds capacity to a symptom.',
    simulation: 'An intake queue whose bottleneck moves when you staff around it.',
    skills: ['constraint identification', 'process mapping', 'exception design'],
    buildVsBuy: { buy: 'nothing', build: 'the moving bottleneck. Synthetic data only' },
  },
  'health-analytics': {
    batch: 'Healthcare operations',
    anchors: ['Epic', 'Komodo Health'],
    evaluates: 'Whether someone checks why data is missing before analysing what remains.',
    simulation: 'A dataset where the sickest patients have no follow-up recorded.',
    skills: ['missingness reasoning', 'denominator definition', 'bias detection'],
    buildVsBuy: { buy: 'nothing', build: 'the non-random missingness. Synthetic data only' },
  },
  'revenue-cycle': {
    batch: 'Healthcare operations',
    anchors: ['Change Healthcare', 'Waystar'],
    evaluates: 'Whether someone disaggregates a denial code or treats it as one cause.',
    simulation: 'One reason code hiding three distinct causes, one date-triggered.',
    skills: ['denial analysis', 'root cause separation', 'payer rule reading'],
    buildVsBuy: { buy: 'nothing', build: 'the composite code. Synthetic data only' },
  },
  'regulatory-quality': {
    batch: 'Healthcare operations',
    anchors: ['Veeva', 'MasterControl'],
    evaluates: 'Whether someone can tell a control from evidence that it ran.',
    simulation: 'A control described well with no trail behind it.',
    skills: ['evidence chains', 'audit reasoning', 'retrospective proof'],
    buildVsBuy: { buy: 'nothing', build: 'the undocumented control' },
  },
  'digital-health-product': {
    batch: 'Healthcare operations',
    anchors: ['Oscar Health', 'Ro'],
    evaluates: 'Whether someone asks whose workflow pays for a patient-side gain.',
    simulation: 'An improvement that helps patients and costs clinicians two minutes each.',
    skills: ['workflow tradeoffs', 'stakeholder reasoning', 'adoption realism'],
    buildVsBuy: { buy: 'nothing', build: 'the hidden cost' },
  },
};

export function verticalFor(slug) {
  const entry = VERTICALS[slug];
  if (!entry) return null;
  // The disclaimer travels with every read, so no caller can surface anchors without it.
  return { slug, ...entry, disclaimer: ANCHOR_DISCLAIMER, arePartners: false };
}

export function coverage() {
  const all = Object.values(VERTICALS);
  const byBatch = {};
  for (const v of all) byBatch[v.batch] = (byBatch[v.batch] || 0) + 1;
  return { total: all.length, byBatch, buildEverything: all.filter(v => v.buildVsBuy.buy === 'nothing').length };
}
