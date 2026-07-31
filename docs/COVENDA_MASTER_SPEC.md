---
title: "Covenda System Design Blueprint"
subtitle: "Evidence Graphs, Company DNA, Compatibility, Verification, Professional Simulations, Marketplace, and Implementation"
author: "Covenda"
date: "July 30, 2026"
documentclass: extreport
classoption:
  - openany
fontsize: 9pt
geometry:
  - margin=0.68in
toc: true
toc-depth: 3
numbersections: false
colorlinks: true
linkcolor: black
urlcolor: blue
mainfont: "Inter"
monofont: "DejaVu Sans Mono"
mathfont: "Noto Sans Math"
header-includes:
  - |
    \usepackage{fancyhdr}
    \pagestyle{fancy}
    \fancyhf{}
    \fancyhead[L]{\small Covenda System Design Blueprint}
    \fancyhead[R]{\small Version 1.0}
    \fancyfoot[C]{\thepage}
    \setlength{\headheight}{14pt}
  - |
    \usepackage{booktabs}
    \usepackage{longtable}
    \usepackage{array}
    \usepackage{enumitem}
    \setlist{nosep}
  - |
    \usepackage{fvextra}
    \DefineVerbatimEnvironment{Highlighting}{Verbatim}{breaklines,commandchars=\\\{\}}
    \DefineVerbatimEnvironment{verbatim}{Verbatim}{breaklines}
  - |
    \usepackage{xcolor}
    \definecolor{shadecolor}{RGB}{246,247,249}
    \usepackage{framed}
    \renewenvironment{Shaded}{\begin{snugshade}}{\end{snugshade}}
---

\thispagestyle{empty}

# Document control

| Field | Value |
|---|---|
| Version | 1.0 |
| Status | Consolidated operating blueprint |
| Primary use | Product, engineering, AI, design, research, recruiting, and company strategy |
| Initial market | High-agency early-career talent and technical startups |
| Initial campus | Columbia University |
| Core transaction | Verified company need -> evidence-backed shortlist -> approved introduction -> evaluation -> outcome |
| Source policy | Integrated chapters control; source appendices preserve prior drafts |
| Writing standard | Concise, implementation-oriented, evidence-linked, no marketing filler |

\clearpage

# Executive system map

```text
Student identity and preferences
        |
        v
Evidence Graph ---- Verification ---- Work Records
        |                  |
        v                  v
Capability Framework ---- Trust
        |
        +---------------------------+
        |                           |
        v                           v
Company DNA -------------------- Role / Talent Brief
        |                           |
        +------------+--------------+
                     v
              Compatibility
                     |
                     v
      Search / Shortlist / Introduction
                     |
                     v
  Interview / Assessment / Paid Trial / Work
                     |
                     v
                  Outcome
                     |
                     v
      Hiring Intelligence and Company Memory
```

The product begins with a simple transaction and compounds toward a professional evidence and organizational intelligence system.

\clearpage


# Chapter 1: Introduction and Document Contract

## 1.1 Purpose

This document is the operating blueprint for Covenda. It consolidates product strategy, system architecture, evidence design, company and student workflows, verification, compatibility, professional simulations, marketplace strategy, safety controls, and implementation sequencing into one source of truth.

It is not a pitch deck. It is not a marketing page. It is not a collection of disconnected feature ideas. It is a working specification intended to let a founding engineer, product designer, machine-learning engineer, researcher, recruiter, advisor, or coding agent understand the system without reconstructing prior conversations.

Covenda is defined here as an evidence-based talent intelligence platform for exceptional early-career people and the organizations that need to understand them. The platform begins with undergraduate and early-career talent, technical startups, trusted campus communities, and evidence-heavy professional fields. It may later expand to larger companies, additional career stages, and broader professional identity infrastructure.

## 1.2 Product thesis

Traditional recruiting systems primarily store claims:

- job titles;
- school names;
- skill keywords;
- résumé bullets;
- application answers;
- recruiter notes.

Covenda should store evidence, provenance, relationships, uncertainty, and outcomes.

The system is built around the following transformation:

```text
Claim
  -> Evidence
  -> Verification
  -> Capability inference
  -> Company-specific compatibility
  -> Evaluation
  -> Outcome
  -> Institutional learning
```

The long-term product is not a better résumé database. It is a computational model of demonstrated capability and company-specific success conditions.

## 1.3 Initial market

The initial target is intentionally narrow:

```text
High-agency undergraduate and early-career builders
+
Technical startups and small technical teams, initially about 5-75 employees
+
Trusted universities, clubs, laboratories, professors, hackathons, and professional communities
```

The employee range is an operating hypothesis, not a permanent boundary. The initial customer is likely to have limited recruiting infrastructure, real near-term work, a qualified evaluator, and a willingness to consider emerging talent based on evidence rather than pedigree alone.

Columbia is the proposed first campus because the founding network can supply students, clubs, professors, laboratories, alumni, and New York company relationships. The goal is not immediate scale. The goal is a dense, credible local market with observable outcomes.

## 1.4 Document status labels

Every major statement should be interpreted as one of four types:

| Label | Meaning |
|---|---|
| Decision | Current product direction unless explicitly revised |
| Requirement | Behavior the implemented system must satisfy |
| Hypothesis | Claim requiring market, legal, technical, or user validation |
| Extension | Future capability that should not distort the first implementation |

When the document contains tension between an ambitious long-term system and a simpler first version, the implementation sequence controls. Covenda should not overbuild a graph, simulation engine, or marketplace before basic student-company introductions produce repeated value.

## 1.5 Non-negotiable instructions for future agents

1. Inspect the existing codebase before proposing replacement architecture.
2. Reuse existing abstractions unless a documented limitation makes extension impractical.
3. Separate compatibility from admission and hiring decisions.
4. Never reduce a person to one opaque score.
5. Never claim verification that the available evidence cannot establish.
6. Assume students can use frontier AI tools.
7. Test ownership, understanding, adaptation, and judgment rather than attempting perfect AI detection.
8. Keep referrals optional.
9. Distinguish invitations from evidence-bearing endorsements.
10. Preserve uncertainty and evidence limitations.
11. Keep humans in the loop for high-stakes decisions.
12. Do not use protected attributes or prestige proxies for ranking.
13. Protect students from unpaid useful work and unclear trials.
14. Do not imply a company, school, or community is a partner without an actual relationship.
15. Build the smallest workflow that creates verified outcomes, then expand.

## 1.6 Success condition

This blueprint succeeds when another capable operator can answer the following without asking the founder to repeat the entire thesis:

- What is Covenda?
- Who is it initially for?
- What is the core transaction?
- What data does the system own?
- What does it deliberately not own?
- How are students represented?
- How are companies represented?
- How is evidence verified?
- How is compatibility produced and explained?
- How are trials and assessments kept safe?
- Which systems are V1, later, or research?
- What should an engineering agent build next?


# Chapter 2: Problem Definition

## 2.1 Hiring is an information problem

The early-career hiring market is not primarily constrained by the absence of people or applications. It is constrained by weak information.

Students have limited formal experience. Their strongest work may live across GitHub, coursework, research laboratories, hackathons, clubs, independent products, technical writing, competitions, internships, and recommendations. Conventional applications compress this into a one-page résumé and a small set of keywords.

Companies face the opposite problem. Application volume can be high while usable signal remains low. AI-generated résumés, cover letters, project descriptions, and interview preparation increase the quantity and polish of applications without proportionally increasing the amount of verified information. Recruiters and founders must infer capability from incomplete and increasingly standardized representations.

The result is an information market with four defects:

### Compression

Rich histories are compressed into documents that omit process, ownership, relationships, and growth.

### Fragmentation

Evidence is distributed across platforms and private contexts. No single system explains how the pieces relate.

### Asymmetry

Students know more about their own contribution than companies can observe. Companies know more about their actual environment than job descriptions reveal.

### Decay

Hiring knowledge disappears after each recruiting cycle. Interview notes, internship outcomes, manager judgments, and successful evidence patterns are rarely converted into reusable institutional memory.

## 2.2 Student problem

The student's problem is not simply a shortage of job listings. It includes:

- difficulty identifying which opportunities are genuinely relevant;
- large application volumes with low response rates;
- dependence on school, prior employer, or network proxies;
- inability to show unconventional or private work;
- repeated applications that do not compound;
- generic advice that does not explain missing evidence;
- opaque rejection;
- fragmented referrals;
- limited access to off-cycle and small-company opportunities;
- pressure to produce artificial résumé bullets instead of durable work.

A student should be able to build a professional identity once and continuously strengthen it. Every verified project, course, research contribution, work record, recommendation, and assessment should increase future legibility.

## 2.3 Company problem

The company problem is not simply sourcing. It includes:

- reviewing too many low-signal applications;
- uncertainty about what a student personally contributed;
- limited recruiter or founder time;
- inconsistent interview processes;
- difficulty evaluating early-career candidates without prior employers;
- unstructured referrals;
- inability to express company-specific success conditions;
- expensive onboarding when interns require excessive senior-engineer supervision;
- loss of knowledge after hiring;
- overreliance on prestige and familiarity.

Covenda's company-side value should be described in operational terms:

> Tell Covenda what work exists, what evidence you trust, how much autonomy is required, and what success looks like. Covenda returns a small number of candidates with traceable evidence, explicit uncertainty, and a controlled path to evaluation.

The company should not receive a magical list. It should receive an understandable shortlist.

## 2.4 AI-era distortion

AI changes both the supply of applications and the meaning of evidence.

Weak responses can be polished. Generic projects can be generated. Code can be produced without full understanding. Written work can look sophisticated while concealing the candidate's actual process.

Covenda should therefore avoid a false promise of detecting all AI use. The system should instead collect process evidence and create opportunities to demonstrate:

- ownership;
- source provenance;
- decision-making;
- ability to modify work;
- debugging;
- defense of tradeoffs;
- reaction to changed constraints;
- distinction between personal and team contribution;
- transparent AI assistance.

AI use is not automatically negative. Undisclosed substitution of understanding is the problem.

## 2.5 Root problem statement

The early-career talent market does not adequately connect:

```text
What a person can actually do
+
What that person wants to do
+
What evidence supports the claim
+
What remains uncertain
+
What a company actually needs
+
What environment predicts success
```

Covenda exists to make that connection personalized, evidence-based, explainable, and continuously improving.

## 2.6 Constraints

Covenda must solve the information problem without creating new harms:

- universal person scores;
- hidden admissions;
- unpaid speculative labor;
- prestige reinforcement;
- surveillance-heavy assessments;
- inaccessible mandatory video;
- referral gatekeeping;
- fabricated verification;
- company impersonation;
- confidential-data leakage;
- black-box automated employment decisions.

These constraints are architectural, not merely policy language.


# Chapter 3: Product Definition and Boundaries

## 3.1 What Covenda is

Covenda is a combined system for:

- evidence-backed professional identity;
- student and company discovery;
- company-specific compatibility;
- evidence verification and provenance;
- optional referrals and endorsements;
- professional simulations and assessments;
- mutually approved introductions;
- paid trials when appropriate;
- employer-confirmed work records;
- batch-based talent programs;
- mentorship;
- hiring outcome learning;
- organizational hiring memory.

The product can support multiple talent-acquisition paths:

| Path | Typical use |
|---|---|
| Direct introduction | Company finds a student and requests a conversation |
| Internship or part-time role | Defined ongoing work with standard hiring process |
| Project engagement | Bounded deliverable with compensation and outcome |
| Paid trial | Shortlisted candidate completes a limited compensated evaluation |
| Research placement | Lab or technical team evaluates specialized evidence |
| Talent pipeline | Company builds a future candidate pool before a role opens |
| Batch | Time-bound cohort organized around a capability or company need |
| Referral-assisted discovery | A trusted person provides context without controlling access |

## 3.2 What Covenda is not

Covenda is not:

- only a project marketplace;
- only a startup internship board;
- a referral-only network;
- a generic ATS;
- a résumé database with an AI score;
- a universal intelligence test;
- a hidden ranking system;
- a traditional testing company;
- a replacement for every coding environment, work tool, interview platform, or payroll system;
- a platform where unlimited students perform unpaid company work.

Projects and paid trials are mechanisms within a larger evidence system. Batches are discovery and development structures, not a substitute for every hiring workflow.

## 3.3 Core transaction

The clearest initial transaction is:

```text
A verified company defines a real talent need
-> Covenda identifies a small set of students with traceable evidence
-> the company requests an introduction
-> the student approves or declines
-> evaluation occurs through interview, existing assessment, or paid trial
-> the outcome becomes structured evidence and hiring memory
```

Every feature should support this transaction or the quality of future transactions.

## 3.4 Compatibility versus admission

Compatibility and admission must remain separate.

Compatibility asks:

> Is this role, batch, path, or company likely to fit this student based on available evidence, preferences, goals, and environment?

Admission asks:

> Has the student satisfied the published requirements for a batch, program, or controlled opportunity?

A student may have high compatibility but incomplete requirements. The correct output is a gap analysis. A student may satisfy requirements but have low interest or environmental alignment. The correct output is not automatic advancement.

Hiring remains a company decision.

## 3.5 Build, buy, partner, or human rail

Covenda should own the layers that compound strategically:

- Evidence Graph;
- Company DNA;
- compatibility and explanation;
- evidence provenance;
- cross-source synthesis;
- candidate-specific defense;
- batch admission logic;
- work records;
- hiring memory;
- company-facing talent intelligence.

Covenda should usually integrate commodity infrastructure:

- code execution;
- generic test delivery;
- identity checks;
- video infrastructure;
- scheduling;
- payments;
- payroll;
- file scanning;
- standard proctoring, where justified;
- standard ATS export.

Human review is required where judgment, authorship, safety, fairness, or context cannot be credibly automated.

## 3.6 Product hierarchy

```text
Professional Identity Layer
  Evidence Graph
  Verification
  Work Records
  Membership

Understanding Layer
  Capability Framework
  Domain Ontologies
  Company DNA
  Compatibility

Evaluation Layer
  Assessments
  Simulations
  Interviews
  Paid Trials
  Human Review

Marketplace Layer
  Discovery
  Talent Briefs
  Opportunities
  Introductions
  Batches
  Mentorship

Learning Layer
  Outcomes
  Hiring Memory
  Process Analytics
  Model Improvement
```

This hierarchy prevents the product from collapsing into a job board or assessment vendor.


# Chapter 4: Core Philosophy and Design Principles

## 4.1 Evidence over claims

Claims are allowed, but claims and evidence must be distinct objects. "I know Rust" is not equivalent to a maintained Rust repository, a systems course, a production deployment, or a verified manager attestation.

The interface must show what is self-reported, artifact-linked, contribution-confirmed, observer-verified, employer-confirmed, or Covenda work-verified.

## 4.2 Context over universal ranking

Capability is not a single ladder. A student can be excellent for one environment and poorly suited to another. Covenda should model person-company-role relationships rather than produce an absolute talent rank.

## 4.3 Missing evidence is not negative evidence

The system must distinguish:

```text
No evidence available
```

from:

```text
Evidence suggests weakness
```

A private internship, inaccessible repository, or limited opportunity access should not be interpreted as lack of capability.

## 4.4 Growth is evidence

Covenda should model trajectory:

- increasing project complexity;
- movement from coursework to independent work;
- faster iteration;
- improved documentation;
- expanding responsibility;
- ability to enter new domains;
- response to feedback;
- sustained maintenance.

The graph should preserve historical states so the platform can explain not only where a person is, but how they arrived there.

## 4.5 High agency as an emergent property

"High agency" should not be a subjective personality score.

It should emerge from combinations of observable capabilities:

```text
Ownership
+ Learning velocity
+ Ambiguity navigation
+ Execution
+ Curiosity
+ Initiative
```

Examples include starting work without an assigned syllabus, shipping under incomplete specifications, learning unfamiliar technology, maintaining a project, identifying missing tasks, and adapting after requirements change.

## 4.6 Trust is constructed

Trust should increase through multiple independent mechanisms:

- verified identity;
- source connection;
- contribution evidence;
- defense;
- observer attestation;
- company-confirmed outcomes;
- consistent history;
- transparent corrections;
- professional conduct.

No single source should become an unquestioned truth oracle.

## 4.7 Open participation, earned visibility

Anyone should be able to create a profile and develop evidence. Company visibility, verified-builder status, and selective batches may require published standards.

The standard should create exclusivity, not arbitrary secrecy.

Rejection or non-admission should produce an explicit roadmap whenever possible.

## 4.8 Human judgment remains legitimate

Covenda should not pretend all hiring can be automated. Human judgment is required for:

- nuanced tradeoffs;
- domain judgment;
- contradictory evidence;
- appeals;
- safety;
- confidential work;
- unusual backgrounds;
- high-stakes admissions;
- final employment decisions.

The system's role is to improve judgment quality, consistency, and memory.

## 4.9 Explainability is a product requirement

Every major output should answer:

- What evidence supports this?
- How was the evidence verified?
- What is inferred?
- What is missing?
- What contradicts the conclusion?
- How confident is the system?
- What should happen next?

"AI says yes" is never an acceptable explanation.

## 4.10 Minimal coercion

The platform should avoid forcing students into performative behavior. No mandatory public profile, camera, social posting, public leaderboard, or constant activity requirement should be necessary for basic participation.

Profiles can become stale, but inactivity should not erase past work.

## 4.11 Design requirements

| ID | Requirement |
|---|---|
| DP-01 | Every evaluative claim links to evidence or is explicitly labeled as self-reported. |
| DP-02 | Compatibility is role- and company-specific; no global public rank is generated. |
| DP-03 | Uncertainty is stored and displayed, not hidden. |
| DP-04 | Every admission requirement is published and versioned. |
| DP-05 | Students control profile visibility and approve introductions. |
| DP-06 | Referrals are optional and separated from endorsements. |
| DP-07 | High-stakes adverse actions support human review and appeal. |
| DP-08 | The system records what evidence can and cannot prove. |
| DP-09 | AI assistance is disclosed and interpreted, not automatically punished. |
| DP-10 | V1 prioritizes outcome-producing workflows over speculative platform breadth. |


# Chapter 5: System Model and Core Entities

## 5.1 System model

Covenda models seven primary domains:

```text
People
Evidence
Capabilities
Organizations
Opportunities
Evaluations
Outcomes
```

The system's value comes from relationships among these domains rather than isolated records.

## 5.2 Core entities

### Student

A person building an evidence-backed professional identity.

Key properties:

- identity;
- education or current role;
- preferences;
- availability;
- goals;
- visibility;
- Evidence Graph;
- capability estimates;
- verification history;
- memberships;
- applications and introductions;
- outcomes.

### Evidence

A structured record supporting or challenging a claim.

Key properties:

- source;
- source type;
- claim;
- artifact;
- timestamp;
- contribution;
- verification state;
- confidence;
- limitations;
- visibility;
- AI-use disclosure;
- linked capabilities;
- linked people and organizations.

### Capability

A latent property inferred from evidence, such as technical depth, ownership, communication, or research ability.

Capabilities are probabilistic, contextual, and time-sensitive.

### Company

A verified organization with a public profile, team members, Company DNA, talent needs, roles, evaluation processes, and hiring outcomes.

### Company DNA

A versioned representation of how a company recognizes success, operates, supervises early-career talent, and weighs evidence.

### Talent Brief

The company's structured statement of:

- work;
- expected outputs;
- constraints;
- capabilities;
- trusted evidence;
- compensation;
- supervision;
- evaluation;
- success conditions.

A Talent Brief is broader and more operational than a generic job description.

### Opportunity

A role, project, internship, research placement, contract, trial, or future pipeline.

### Compatibility Assessment

A versioned, evidence-linked analysis of student-company-role fit. It includes component fit, hard constraints, uncertainty, gaps, risks, and recommended next action.

### Assessment or Simulation

A structured evaluation designed to generate new evidence.

### Paid Trial

A limited compensated engagement offered to shortlisted candidates after company approval and student acceptance.

### Work Record

An employer-confirmed outcome describing what was completed, whether it was accepted, timing, contribution, and future willingness to work together.

### Batch

A time-bound or capability-bound talent cohort with published admission requirements, development activities, company participation, and hiring pathways.

### Endorsement

A structured statement by a verified observer about a specific contribution or capability directly observed.

### Invitation

A network-growth event showing how a person reached Covenda. It is not capability evidence.

### Outcome

A structured result such as interview completion, trial completion, offer, acceptance, work quality, return offer, retention, or promotion.

## 5.3 Canonical relationship graph

```text
Student
  CREATED -> Evidence
  CONTRIBUTED_TO -> Project
  COMPLETED -> Course
  WORKED_AT -> Company
  RECEIVED -> Endorsement
  COMPLETED -> Assessment
  PARTICIPATED_IN -> Batch
  APPROVED -> Introduction
  PRODUCED -> Work Record

Evidence
  SUPPORTS -> Capability
  CONTRADICTS -> Capability
  VERIFIED_BY -> Verification
  RELEVANT_TO -> Domain
  GENERATED_BY -> Assessment
  RESULTED_IN -> Outcome

Company
  HAS -> Company DNA
  DEFINES -> Talent Brief
  OFFERS -> Opportunity
  REQUESTS -> Introduction
  EVALUATES -> Student
  CONFIRMS -> Work Record
  GENERATES -> Outcome

Compatibility
  COMPARES -> Student
  WITH -> Company
  FOR -> Role
  USES -> Evidence snapshot
  USES -> Company DNA version
```

## 5.4 Versioning

The following objects must be versioned:

- Company DNA;
- role and Talent Brief;
- admission requirements;
- rubrics;
- simulations;
- domain ontology;
- capability mappings;
- compatibility model;
- evidence snapshot;
- explanations.

A later model must not silently rewrite the historical rationale for an earlier decision.

## 5.5 State separation

The architecture must not collapse distinct states:

- profile complete versus verified;
- evidence linked versus contribution confirmed;
- compatibility versus admission;
- interest versus application;
- application versus introduction;
- trial invited versus funded;
- work completed versus employer-confirmed;
- invitation versus endorsement;
- company verified versus company approved for trials.

This separation is necessary for accurate UI, analytics, policy enforcement, and learning.


# Chapter 6: Evidence Graph

## 6.1 Purpose

The Evidence Graph is Covenda's canonical representation of professional identity.

Traditional systems represent candidates through linear documents. Covenda represents each person through a continuously evolving graph of claims, artifacts, contributions, observers, verifications, capabilities, domains, organizations, and outcomes.

The graph should answer:

- What has this person built, studied, researched, or completed?
- What did the person personally contribute?
- Which source supports the claim?
- How was the source verified?
- Which capabilities does the evidence support?
- Which evidence contradicts or limits the conclusion?
- How has the person changed over time?
- Which evidence is relevant to a particular company and role?
- What remains unknown?

## 6.2 Node types

Initial node families:

| Family | Representative nodes |
|---|---|
| Identity | person, university, company, laboratory, organization |
| Education | major, course, assignment, capstone, grade, transcript |
| Engineering | repository, commit, pull request, issue, deployment, architecture document, package, API |
| Research | paper, experiment, dataset, poster, publication, advisor, citation, replication |
| Employment | internship, part-time role, assistantship, consulting engagement, paid trial |
| Community | hackathon, club, competition, conference, meetup, mentorship |
| Portfolio | demo, video, blog, presentation, design document, whitepaper |
| Recognition | award, scholarship, grant, recommendation, competition result |
| Evaluation | assessment, simulation, interview, rubric, defense response |
| Outcome | accepted deliverable, offer, return offer, performance review, promotion, rehire |

New node types should extend the graph without requiring destructive redesign.

## 6.3 Edge types

Edges carry meaning and direction.

Examples:

- CREATED;
- CONTRIBUTED_TO;
- MAINTAINED;
- DEPLOYED;
- REVIEWED;
- MENTORED;
- ADVISED_BY;
- COLLABORATED_WITH;
- VERIFIED_BY;
- OBSERVED_BY;
- CITES;
- BUILDS_ON;
- PREREQUISITE_FOR;
- DEMONSTRATES;
- CONTRADICTS;
- RELEVANT_TO;
- GENERATED_BY;
- RESULTED_IN;
- EMPLOYED_BY;
- COMPLETED_AT;
- RECOMMENDED_BY.

Every edge may store:

- confidence;
- source;
- timestamp;
- method;
- visibility;
- limitations;
- reviewer;
- version.

## 6.4 Evidence record

A normalized evidence record should include:

```yaml
evidence_id: ev_18372
candidate_id: student_293
type: repository
title: Distributed Event Queue
claim: Designed and implemented retry and idempotency mechanisms
source:
  provider: GitHub
  url: private_or_public_reference
  connected_at: 2026-07-18
contribution:
  claimed_role: primary developer
  estimated_share: 0.72
  collaboration_context: team_of_3
verification:
  level: contribution_confirmed
  methods:
    - oauth_ownership
    - commit_history
    - candidate_defense
  confidence: 0.91
capability_links:
  systems_thinking: 0.88
  technical_depth: 0.82
  ownership: 0.79
domain_links:
  distributed_systems: 0.90
  backend_engineering: 0.83
limitations:
  - no independent production user evidence
  - commit history cannot prove authorship of every line
ai_assistance:
  disclosed: true
  tools: [code_assistant]
  candidate_verified_components:
    - retry design
    - testing
visibility: verified_companies
```

## 6.5 Evidence strength and verification confidence

Evidence strength and verification confidence must remain separate.

### Evidence strength

How much the artifact can demonstrate if authentic.

Factors include:

- difficulty;
- complexity;
- independence;
- duration;
- external use;
- production exposure;
- stakes;
- novelty;
- quality;
- observed outcome;
- relevance.

### Verification confidence

How certain Covenda is that the evidence exists, is attributable to the candidate, and is understood.

Factors include:

- source connection;
- account ownership;
- contribution history;
- observer confirmation;
- defense;
- external outcome;
- consistency;
- identity match.

A sophisticated artifact with weak attribution may have high strength and low verification. A simple course assignment with confirmed authorship may have lower strength and high verification.

A provisional record may therefore display:

```text
Evidence strength: 8.8 / 10
Verification confidence: 4.2 / 10
Status: High-value evidence requiring attribution review
```

## 6.6 Evidence hierarchy

A default hierarchy:

| Level | Description | Example |
|---:|---|---|
| 0 | Claim only | "I know Rust" |
| 1 | Source linked | Repository or document exists |
| 2 | Ownership connected | Authenticated account or verified identity relation |
| 3 | Contribution supported | History, observer, or work record supports personal contribution |
| 4 | Understanding demonstrated | Candidate defends, modifies, or explains the work |
| 5 | Outcome validated | Deployed, published, adopted, accepted, or employer-confirmed |

This hierarchy is not a universal quality score. It describes evidentiary depth.

## 6.7 Mathematical representation

Let the Evidence Graph be:

```text
G = (V, E, X, T)
```

where:

- `V` is the set of nodes;
- `E` is the set of typed directed edges;
- `X` contains node and edge attributes;
- `T` contains timestamps and version history.

For evidence item `i`, maintain a vector:

```text
z[i] = [strength, verification, relevance, ownership, diversity, temporal_relevance, quality]
```

where:

- `strength[i]`: intrinsic evidence strength;
- `verification[i]`: verification confidence;
- `relevance[i]`: relevance to a queried role or domain;
- `ownership[i]`: ownership estimate;
- `diversity[i]`: evidence diversity contribution;
- `temporal_relevance[i]`: temporal relevance;
- `quality[i]`: quality or outcome signal.

A simplified contextual evidence value can be written as:

```text
contextual_evidence[i, capability, role] = f(z[i], capability, role)
```

for a queried capability and role.

The production system should not assume a single permanent formula. Different evidence types require different normalization and uncertainty models.

## 6.8 Propagation

Evidence should influence connected capabilities and domains, but propagation must decay with graph distance and relationship uncertainty.

A conceptual propagation rule:

```text
signal[u -> v, step + 1] = signal[u, step] * edge_weight[u,v] * distance_decay * verification[u]
```

where:

- `signal[u, step]` is signal at node `u` on traversal step `step`;
- `edge_weight[u,v]` is the semantic strength of the edge;
- `distance_decay in (0,1)` is a distance-decay factor;
- `verification[u]` is source verification confidence.

Example:

```text
Compiler project
  -> supports low-level systems
  -> supports memory management
  -> adjacent to performance engineering
  -> partially relevant to infrastructure engineering
```

The signal should be strongest for direct demonstrated knowledge and weaker for transferable adjacent knowledge.

Propagation must never convert a weak association into a strong claim. It should produce phrases such as:

- direct evidence;
- adjacent evidence;
- inferred transfer;
- prerequisite coverage;
- unresolved gap.

## 6.9 Contradictory evidence

The graph must support negative and limiting relationships.

Examples:

- a project is listed as completed, but repository history shows only a template;
- a manager attests to teamwork, while a later work record notes repeated communication failures;
- a candidate claims primary ownership, but teammate attestations describe a smaller contribution;
- a high assessment result conflicts with weak live defense.

Contradiction should reduce confidence and trigger review. It should not silently delete either record.

## 6.10 Temporal behavior and decay

Not all evidence decays equally.

### Low-decay evidence

- published research;
- accepted work record;
- completed degree;
- patent;
- verified historical project.

### Moderate-decay evidence

- framework familiarity;
- cloud platform expertise;
- recent coding-language fluency;
- current availability.

### High-decay evidence

- active job interest;
- weekly availability;
- location;
- short-lived certification;
- fast-changing tool expertise.

The graph should retain historical facts while reducing their weight for current compatibility where appropriate.

A conceptual recency term:

```text
temporal_weight[i] = exp(-decay_rate[capability] * elapsed_time)
```

where `decay_rate[capability]` depends on the capability or evidence class.

Historical evidence should remain visible even when its predictive weight decreases.

## 6.11 Evidence diversity

Confidence should increase when independent evidence types converge.

For example:

```text
Systems course
+ independent repository
+ technical article
+ employer work record
+ live defense
```

is more reliable than five similar repositories with no external validation.

The confidence model should account for source correlation. Two endorsements from close collaborators may not equal two independent company outcomes.

## 6.12 Domain ontologies

Covenda requires formal domain maps rather than flat skill lists.

Example AI ontology:

```text
Artificial Intelligence
  Machine Learning
    Supervised Learning
    Unsupervised Learning
    Reinforcement Learning
  Deep Learning
    Computer Vision
    Natural Language Processing
      Transformers
      Retrieval
      Evaluation
      Alignment
  ML Systems
    Data Pipelines
    Training Infrastructure
    Inference
    Monitoring
```

Example robotics ontology:

```text
Robotics
  Controls
  Planning
  Perception
    Computer Vision
  Localization
    SLAM
  Embedded Systems
  Simulation
  Hardware Integration
  Safety
```

Example finance ontology:

```text
Finance
  Accounting
  Corporate Finance
  Valuation
    DCF
    Trading Comparables
    Precedent Transactions
  Investment Banking
    Deal Process
    Merger Model
  Private Equity
    LBO
    Diligence
  Asset Management
    Portfolio Construction
    Risk
```

Every ontology relationship should specify type:

- parent-child;
- prerequisite;
- adjacent;
- tool-for;
- method-used-in;
- transferable-to;
- specialization-of.

## 6.13 Cross-domain reasoning

Cross-domain reasoning should identify transferable evidence without pretending equivalence.

Examples:

- compiler optimization can support systems and performance engineering;
- reinforcement learning can support robotics planning;
- experimental design can transfer from biology research to model evaluation;
- financial modeling can support corporate strategy analysis;
- technical writing can support developer relations and research communication;
- supply-chain forecasting can support operations analytics.

The system should return a transfer explanation:

```text
Direct match: low-level systems
Transferable methods: profiling, optimization, memory reasoning
Role gap: no verified distributed deployment
```

## 6.14 Search

Company queries should operate over graph structure:

- students who built compilers;
- students with robotics research and embedded deployment;
- students who maintained a product for more than one year;
- students with technical writing and production debugging evidence;
- students with private work verified by a manager;
- students who moved from beginner coursework to independent research within twelve months.

Search results must cite the exact evidence path.

## 6.15 Graph user interface

The profile should support:

- center-node view;
- timeline view;
- domain view;
- capability view;
- verification view;
- company-relevance view.

A company reviewing a candidate should be able to click:

```text
Strong systems-thinking estimate
  -> distributed queue project
  -> architecture document
  -> commit and issue history
  -> candidate defense
  -> verification limitations
```

## 6.16 Failure modes

| Failure | Mitigation |
|---|---|
| Activity quantity becomes quality | Diminishing returns, quality weighting, outcome evidence |
| Public-work bias | Private evidence, attestations, confidential review |
| Graph becomes unreadable | Multiple filtered views and progressive disclosure |
| Ontology overclaims transfer | Distance decay, transfer labels, domain review |
| Prestigious source dominates | Separate source prestige from direct evidence |
| Stale data appears current | Recency rules and profile freshness |
| Verification is overstated | Explicit methods and limitations |
| Contradictions disappear | Preserve conflicting records and route to review |

## 6.17 Success metrics

- percentage of company recommendations with evidence paths;
- verification coverage by evidence type;
- student profile update rate;
- percentage of capability estimates supported by diverse evidence;
- company use of evidence explorer;
- correction and appeal resolution time;
- retrieval precision for expert-reviewed queries;
- outcome prediction improvement as graph history grows.

## Design principle

Resumes describe people. Evidence Graphs explain how claims, work, verification, and outcomes connect.


# Chapter 7: Capability Framework

## 7.1 Purpose

Evidence is not the final object of hiring. Companies evaluate whether a person can learn, execute, collaborate, reason, and operate effectively in a particular environment.

Capabilities are latent variables inferred from repeated observable behavior. They are not self-declared traits and should not be treated as permanent labels.

The Capability Framework provides a shared language for:

- student profiles;
- Company DNA;
- compatibility;
- search;
- assessment design;
- mentorship;
- batch admission;
- hiring analytics.

## 7.2 Primary dimensions

### Technical depth

Ability to understand and operate at increasing levels of complexity within a domain.

Signals:

- advanced coursework;
- architecture;
- research;
- difficult debugging;
- production systems;
- ability to explain first principles and tradeoffs.

### Technical breadth

Demonstrated competence across multiple adjacent or distinct technical areas.

Breadth should not reward shallow tool lists. It should reflect meaningful evidence across domains.

### Learning velocity

Rate at which a person acquires and applies new knowledge.

Signals:

- rapid movement into unfamiliar technology;
- increasing project difficulty;
- response to changed requirements;
- independent study followed by working output;
- improved performance over time.

### Ownership

Willingness and ability to take responsibility for an outcome.

Signals:

- self-initiated work;
- long-term maintenance;
- identifying unassigned problems;
- managing blockers;
- following through;
- accepting responsibility for mistakes.

### Execution

Ability to finish useful work reliably.

Signals:

- completed deliverables;
- production deployment;
- accepted work records;
- deadlines;
- iteration after feedback;
- consistency across multiple engagements.

### Ambiguity navigation

Ability to make progress when specifications, information, or priorities are incomplete.

Signals:

- startup work;
- research;
- open-ended simulations;
- clarification quality;
- prioritization;
- decision-making under uncertainty.

### Communication

Ability to explain, document, clarify, listen, and surface risk.

Signals:

- technical writing;
- documentation;
- presentations;
- structured questions;
- stakeholder communication;
- mentorship;
- manager feedback.

### Collaboration

Ability to contribute effectively with others.

Signals:

- pull requests;
- code review;
- team projects;
- research collaboration;
- teammate endorsements;
- conflict resolution;
- shared ownership.

### Research ability

Ability to formulate questions, review evidence, design methods, run experiments, interpret results, and state limitations.

### Product thinking

Ability to connect work to users, constraints, outcomes, and prioritization.

### Systems thinking

Ability to reason about components, interactions, failure modes, scale, and second-order effects.

### Reliability

Likelihood of following through with professional discipline.

Reliability should be inferred cautiously and should not become a moral judgment.

### Curiosity

Pattern of exploring, questioning, and extending beyond assigned work.

### Leadership

Ability to coordinate, mentor, set direction, and improve group performance.

### Integrity

Accuracy of representation, attribution, disclosure, and response to correction.

Integrity is partly a trust-system output and should not be reduced to a personality score.

### Judgment

Ability to choose among imperfect alternatives and explain tradeoffs.

### Adaptability

Ability to change approach when assumptions, tools, requirements, or evidence change.

## 7.3 Capability vector

Internally, a student may be represented by a distribution over capabilities:

```text
capability_state[student] = {
  estimate,
  uncertainty,
  time_context
} for each capability
```

where:

- `estimate(c[j] | evidence)` is the estimated capability based on evidence;
- `uncertainty(c[j])` is uncertainty;
- `time_context(c[j])` is the relevant time context.

The system should not expose the raw vector as a public scorecard. User-facing views should present evidence-backed narratives and bands.

## 7.4 Evidence-to-capability mapping

Each evidence type has a capability mapping with limitations.

| Evidence | Strongest signals | Cannot establish alone |
|---|---|---|
| Long-maintained repository | ownership, execution, technical depth | team collaboration, production impact |
| Research publication | research ability, communication, domain depth | independent authorship, commercial execution |
| Hackathon | initiative, speed, collaboration | long-term reliability, production quality |
| Manager work record | reliability, execution, collaboration | general performance outside observed context |
| Timed assessment | task-specific proficiency | long-term ownership or motivation |
| Technical defense | understanding, communication | sustained execution |
| Course grade | academic mastery in a defined syllabus | independent agency |

## 7.5 High-agency composite

High agency may be modeled as a derived construct:

```text
agency_evidence[student] = g(ownership, learning_velocity, execution, ambiguity_navigation, curiosity)
```

where:

- `ownership`: ownership;
- `learning_velocity`: learning velocity;
- `execution`: execution;
- `ambiguity_navigation`: ambiguity navigation;
- `curiosity`: curiosity or initiative.

The output should not be "Agency Score: 91." It should be:

```text
Evidence of high agency:
- independently launched and maintained a product;
- learned an unfamiliar framework to complete the work;
- adapted architecture after usage increased;
- initiated customer interviews without being assigned;
- completed the project across nine months.
```

## 7.6 Contextual weighting

Companies define different capability weights.

| Capability | Research lab | Pre-seed SaaS | Infrastructure team |
|---|---:|---:|---:|
| Research ability | 35% | 5% | 10% |
| Ownership | 10% | 25% | 20% |
| Learning velocity | 20% | 20% | 15% |
| Technical depth | 25% | 15% | 25% |
| Execution | 5% | 25% | 20% |
| Communication | 5% | 10% | 10% |

Weights are a representation of stated priorities, not unquestionable truth. Outcomes may later suggest that actual success factors differ.

## 7.7 Capability inference requirements

| ID | Requirement |
|---|---|
| CF-01 | Capability estimates must cite supporting and contradictory evidence. |
| CF-02 | Self-report may initialize retrieval but cannot establish high confidence. |
| CF-03 | Multiple correlated artifacts must not be treated as independent proof. |
| CF-04 | Missing evidence must be represented as uncertainty, not automatic weakness. |
| CF-05 | Capability histories must preserve changes over time. |
| CF-06 | Companies may weight capabilities differently by role and team. |
| CF-07 | No public universal capability ranking is generated. |
| CF-08 | Sensitive attributes and prestige proxies are excluded from inference. |
| CF-09 | Assessments state which capabilities they measure and what they cannot measure. |
| CF-10 | Human reviewers can dispute or refine capability mappings. |

## 7.8 Failure modes

- Overfitting to visible output.
- Mistaking confidence for capability.
- Treating extroversion as communication quality.
- Treating rapid completion as learning velocity when prior familiarity is unknown.
- Rewarding quantity of side projects.
- Penalizing students with work, family, disability, or privacy constraints.
- Converting professional reliability into a permanent moral label.
- Allowing company preference to redefine a person globally.

## 7.9 Success metrics

- expert agreement with capability explanations;
- calibration of confidence bands;
- evidence diversity per high-confidence estimate;
- student correction rate;
- company usefulness ratings;
- predictive value for defined outcomes;
- invariance across name, school-prestige, and presentation changes.


# Chapter 8: Verification Architecture

## 8.1 Purpose

Verification estimates whether submitted evidence exists, is attributable to the student, reflects the claimed contribution, and is understood by the person presenting it.

Verification should feel like earning trust, not proving innocence.

Covenda does not need to prove every statement with certainty. It must show what was checked, what remains uncertain, and what the evidence can support.

## 8.2 Verification dimensions

Every evidence item may be evaluated across:

- existence;
- identity linkage;
- ownership;
- contribution;
- understanding;
- external validation;
- recency;
- integrity;
- source reliability.

A structured result:

```json
{
  "existence": 1.00,
  "identity_linkage": 0.96,
  "ownership": 0.88,
  "contribution": 0.71,
  "understanding": 0.86,
  "external_validation": 0.52,
  "recency": 0.93,
  "integrity": 0.97
}
```

## 8.3 Verification states

| State | Meaning |
|---|---|
| Self-reported | Student entered the claim |
| Artifact linked | A source or artifact exists |
| Identity connected | Source account or document is linked to verified identity |
| Contribution confirmed | History, observer, or process supports the claimed contribution |
| Understanding demonstrated | Student defended, modified, or explained the work |
| Outcome verified | External result or employer confirms the outcome |
| Disputed | Evidence has a material unresolved conflict |
| Revoked | Verification was withdrawn or invalidated |

The interface should avoid the generic word "verified" without a level.

## 8.4 Source classes

Possible sources:

- GitHub, GitLab, or Bitbucket;
- package registries;
- deployment platforms;
- app stores;
- university email;
- transcript or learning-management system;
- company email;
- manager or professor attestation;
- DOI and publication registries;
- conference archives;
- competition results;
- design files;
- spreadsheet files;
- presentation recordings;
- third-party assessment platforms;
- Covenda simulations;
- Covenda-paid work records.

No source is perfect. A connected GitHub account confirms access to the account, not authorship of every line.

## 8.5 Repository verification

Repository analysis may examine:

- authenticated account ownership;
- repository age;
- commit history;
- file and language distribution;
- branch history;
- issue and pull-request activity;
- code-review behavior;
- contributor overlap;
- deployment evidence;
- testing;
- dependency structure;
- copied or generated code patterns;
- timing anomalies;
- project evolution.

Commit count must not be used as a quality score.

The system should generate a contribution summary:

```text
Likely contribution:
- primary author of backend queue and retry modules;
- contributor to test suite;
- limited evidence of frontend work.

Verification limits:
- repository history cannot prove unaided authorship;
- private team communication is unavailable;
- deployment usage is self-reported.
```

## 8.6 Research verification

Research evidence may use:

- author identity match;
- DOI;
- institutional profile;
- advisor confirmation;
- contribution statement;
- dataset or code;
- presentation;
- defense;
- replication or experiment walkthrough.

Authorship position should not automatically determine contribution.

## 8.7 Coursework verification

Coursework may be supported by:

- transcript;
- course catalog;
- assignment;
- professor or teaching assistant;
- learning-management export;
- project defense.

A grade establishes performance in a course context. It does not establish independent ownership or production ability.

## 8.8 Employment verification

Employment verification may confirm:

- organization;
- dates;
- role;
- manager relationship;
- project context;
- accepted deliverable;
- work record.

It should not force companies to disclose confidential or legally sensitive performance information.

## 8.9 Structured endorsements

An endorsement must state:

- identity of observer;
- relationship;
- duration;
- direct observation context;
- contribution observed;
- capability observed;
- level of supervision;
- evidence link, if available;
- permission to contact;
- confidence;
- limitations.

Generic endorsements such as "great person" carry limited evidentiary weight.

## 8.10 Candidate-specific defense

Defense questions are generated from the candidate's own work.

Example:

```text
Your repository uses exponential backoff for retries.

1. Which failure mode was this intended to address?
2. How did you choose the retry ceiling?
3. What happens if processing is not idempotent?
4. Change the traffic assumption from 100 requests per minute to 10,000.
5. Which part fails first and what would you modify?
```

The defense evaluates:

- understanding;
- contribution;
- tradeoffs;
- modification ability;
- debugging;
- communication;
- transparency about AI and collaborators.

It should not become a trivia examination.

## 8.11 Perturbation

A strong authenticity pattern combines:

```text
Original artifact
+ process evidence
+ defense
+ changed constraint
+ modification
```

Examples:

- change scale;
- add a security requirement;
- remove a key assumption;
- provide new data;
- ask the candidate to diagnose an intentionally flawed output;
- ask which AI-generated suggestion should be rejected.

## 8.12 Human review

Human review is required when:

- machine evidence conflicts;
- authorship is materially disputed;
- evidence is private;
- a capability depends on judgment;
- healthcare, legal, or sensitive data is involved;
- adverse action may result;
- the student appeals;
- the system is below confidence threshold.

Review should use anchored rubrics, dual raters where justified, adjudication, and inter-rater reliability monitoring.

## 8.13 Fraud and abuse detection

Potential signals:

- fabricated organizations;
- identity mismatch;
- copied projects;
- purchased repository activity;
- impossible timelines;
- synchronized recommendation rings;
- assessment answer sharing;
- unexplained sudden artifact creation;
- strong written defense but inability to modify work;
- false company verification;
- company attempts to collect unpaid useful labor.

A flag initiates review. It should not silently alter a compatibility score.

## 8.14 Appeals

Students and companies must be able to:

- see the disputed object;
- understand the reason;
- submit clarification;
- add evidence;
- request human review;
- correct factual errors;
- challenge unauthorized disclosure;
- appeal suspension or invalidation.

Every decision should be logged with reviewer, evidence, policy version, and rationale.

## 8.15 Verification requirements

| ID | Requirement |
|---|---|
| VR-01 | Every verification result records method, date, reviewer or service, confidence, and limitations. |
| VR-02 | A connected source never implies more than the source can establish. |
| VR-03 | Contribution and understanding are separate from artifact existence. |
| VR-04 | AI use disclosure is supported without automatic penalty. |
| VR-05 | Fraud flags route to review and are not hidden score penalties. |
| VR-06 | Students can appeal adverse verification outcomes. |
| VR-07 | Private evidence supports controlled company-specific access. |
| VR-08 | Verification labels are precise and user-readable. |
| VR-09 | High-risk domains require domain-appropriate human rails. |
| VR-10 | Verification history is immutable except through superseding records. |


# Chapter 9: Company DNA and Hiring Memory

## 9.1 Purpose

Traditional recruiting software models jobs. Covenda must model organizations.

Two companies hiring for the same title can require different behaviors, evidence, supervision, pace, communication, and risk tolerance.

Company DNA is a versioned representation of:

- how the organization operates;
- what success looks like;
- what evidence it trusts;
- what can be taught;
- what is difficult to teach;
- how much ambiguity exists;
- how early-career people are supervised;
- what previous outcomes suggest.

The product should ask a company:

> Teach Covenda how your team recognizes excellence.

## 9.2 Company DNA layers

```text
Organization
  -> team
  -> environment
  -> capability priorities
  -> evidence preferences
  -> role
  -> evaluation process
  -> historical outcomes
  -> learned hiring memory
```

### Organization profile

- industry;
- stage;
- size;
- product;
- customers;
- location;
- remote policy;
- technical stack;
- hiring velocity.

### Operating environment

- ambiguity;
- documentation;
- speed;
- feedback frequency;
- manager availability;
- customer contact;
- autonomy;
- cross-functional work;
- security or compliance sensitivity;
- tolerance for mistakes.

### Hiring philosophy

- strongest past performers;
- failure patterns;
- teachable skills;
- non-negotiable behaviors;
- preferred evidence;
- immediate interview triggers;
- disqualifying conditions;
- risk tolerance for limited experience.

### Capability priorities

Weights and thresholds vary by role.

### Evidence preferences

A company may trust:

- long-term project ownership;
- research;
- code review;
- production deployment;
- work samples;
- manager attestations;
- coursework;
- live defense;
- paid trial.

The company must state why the evidence matters.

### Evaluation process

- interview stages;
- intent of each stage;
- assessment;
- rubric;
- decision authority;
- expected timeline;
- feedback requirements.

## 9.3 Company DNA interview

The onboarding interview should ask:

1. What problems will the person solve in the first thirty days?
2. What distinguishes your strongest junior contributors?
3. Describe someone who exceeded expectations.
4. Describe someone who struggled.
5. How much ambiguity exists?
6. How much supervision is available?
7. Which skills can be learned after joining?
8. Which behaviors are difficult to teach?
9. What evidence makes you trust a candidate?
10. Which evidence has misled you?
11. How quickly must the person ship useful work?
12. How often will the person interact with customers?
13. What would cause immediate rejection?
14. What would cause immediate advancement?
15. What does a successful internship or project produce?
16. How will the manager evaluate the outcome?
17. What level of senior-engineer time is acceptable?
18. What confidential access is required?
19. Is a paid trial appropriate?
20. Which company assumptions are uncertain?

The interview can be asynchronous, facilitated, or concierge-led in early pilots.

## 9.4 Company DNA output

```text
Company DNA v1

Environment
- high ambiguity
- limited written documentation
- weekly founder feedback
- rapid product changes
- moderate customer interaction

Primary capabilities
- ownership
- learning velocity
- execution
- product thinking
- communication

Preferred evidence
- independently shipped product
- existing-codebase work
- customer-informed iteration
- technical defense

Risks
- limited manager availability
- role may be unsuitable for students requiring structured training

Recommended evaluation
- portfolio walkthrough
- collaborative debugging
- short paid trial for finalists
```

## 9.5 Hiring memory

Every recruiting and work event should update institutional knowledge.

```text
Candidate evidence
  -> interview
  -> assessment
  -> decision
  -> offer
  -> work outcome
  -> manager feedback
  -> return offer or retention
  -> Company DNA update
```

The system should identify:

- evidence patterns associated with strong outcomes;
- unnecessary role requirements;
- assessments with little incremental value;
- interviewer disagreement;
- managers with strong development outcomes;
- onboarding practices associated with retention;
- profiles systematically overlooked.

## 9.6 Causal caution

Company history may encode bias, narrow sourcing, inconsistent management, or obsolete needs.

Insights should be labeled:

- observed association;
- weak pattern;
- high-confidence predictive relationship;
- insufficient sample;
- possible confounder;
- human hypothesis.

A company with five interns should not receive a highly confident proprietary success model.

## 9.7 Human override

Authorized users may:

- edit capability weights;
- change evidence preferences;
- override hard constraints;
- ignore recommendations;
- create team-specific DNA;
- dispute learned patterns;
- freeze a version;
- reset obsolete assumptions.

Overrides should be logged but not treated automatically as correct.

## 9.8 Company DNA requirements

| ID | Requirement |
|---|---|
| CD-01 | Company DNA is versioned by organization, team, and role. |
| CD-02 | Stated preferences are separated from outcome-derived patterns. |
| CD-03 | Sample size and uncertainty are displayed. |
| CD-04 | Company DNA captures supervision and onboarding burden. |
| CD-05 | Every role defines success outcomes and decision authority. |
| CD-06 | The company can inspect and edit its representation. |
| CD-07 | Historical bias tests are run before outcome-based adjustment. |
| CD-08 | Compatibility references the DNA version used at generation. |
| CD-09 | Company DNA does not contain illegal or discriminatory preferences. |
| CD-10 | Hiring memory retains reasons for non-capability outcomes such as role closure. |


# Chapter 10: Compatibility Engine

## 10.1 Purpose

The Compatibility Engine estimates how well a specific student may fit a specific role within a specific company, based on available evidence and uncertainty.

It does not answer:

> Is this person universally talented?

It answers:

> Does the available evidence support success in this role and environment, and what remains uncertain?

## 10.2 Inputs

```text
Student Evidence Graph
+ Capability estimates
+ Company DNA
+ Role or Talent Brief
+ Student preferences
+ Hard constraints
+ Historical outcomes
+ Domain ontology
= Compatibility assessment
```

## 10.3 Output

A compatibility assessment includes:

- overall fit band;
- confidence;
- hard-constraint status;
- domain alignment;
- capability alignment;
- environment alignment;
- interest and logistics alignment;
- supporting evidence;
- contradictory evidence;
- missing evidence;
- risk areas;
- recommended next evaluation;
- version metadata.

The engine should avoid false precision. "Strong fit, moderate confidence" may be more useful than "8.237."

## 10.4 Pipeline

```text
1. Validate inputs and consent
2. Evaluate hard constraints
3. Retrieve relevant evidence
4. Normalize evidence
5. Infer capabilities
6. Map domain transfer
7. Compare environment
8. Incorporate preferences
9. Apply outcome-based adjustments
10. Identify risks and gaps
11. Estimate confidence
12. Calibrate score or band
13. Generate evidence-linked explanation
14. Capture human feedback
```

## 10.5 Hard constraints

Hard constraints may include:

- work authorization;
- location;
- graduation window;
- schedule;
- security clearance;
- professional license;
- minimum availability.

Results should be:

- pass;
- fail;
- unknown;
- clarification required;
- overridden.

Preferences such as prior startup experience or exact framework familiarity should not be silently converted into hard constraints.

## 10.6 Evidence retrieval

Retrieval combines:

- structured filters;
- graph traversal;
- semantic search;
- domain-ontology expansion;
- recency;
- verification confidence;
- evidence strength;
- company-specific evidence preference.

The goal is not to retrieve every artifact. It is to retrieve the smallest sufficient set supporting and challenging the recommendation.

## 10.7 Evidence normalization

A conceptual contextual evidence function:

```text
contextual_evidence[i] = f(strength, verification, relevance, ownership, temporal_relevance, diversity)
```

where:

- `strength[i]`: evidence strength;
- `verification[i]`: verification;
- `relevance[i]`: role relevance;
- `ownership[i]`: ownership;
- `temporal_relevance[i]`: temporal relevance;
- `diversity[i]`: diversity contribution.

No single formula should be applied blindly across code, research, finance, design, and healthcare.

## 10.8 Component model

A conceptual compatibility model:

```text
compatibility =
    alpha   * domain
  + beta    * capability
  + gamma   * environment
  + delta   * preferences
  + epsilon * history
  - lambda  * risk
```

where:

- `domain_alignment`: domain alignment;
- `capability_alignment`: capability alignment;
- `environment_alignment`: environment alignment;
- `preference_alignment`: preference and logistical alignment;
- `historical_alignment`: historical outcome alignment;
- `risk_adjustment`: material risk adjustment.

Weights are role-specific and versioned.

Example:

```json
{
  "fit_band": "strong",
  "display_score": 8.6,
  "confidence": 0.72,
  "components": {
    "domain_alignment": 8.8,
    "capability_alignment": 8.6,
    "environment_alignment": 8.2,
    "preference_alignment": 9.1,
    "historical_alignment": 7.3,
    "risk_adjustment": -0.3
  }
}
```

## 10.9 Confidence

Confidence depends on:

- relevant evidence coverage;
- source diversity;
- verification quality;
- consistency;
- recency;
- company-model maturity;
- role clarity;
- historical sample depth.

Twenty weak artifacts should not outweigh three high-quality independent sources.

Example decomposition:

```text
Relevant evidence coverage: 81%
Verification quality: 88%
Company DNA maturity: 47%
Historical outcome depth: 33%
Overall confidence: 61%
```

## 10.10 Explainability

Company view:

```text
Strong fit
Confidence: moderate

Why:
- maintained a distributed-systems project for thirteen months;
- completed advanced operating-systems coursework;
- demonstrated high ownership in a manager-confirmed work record;
- matches the team's high-independence environment.

Investigate:
- limited collaborative code-review evidence;
- no verified Go project;
- company history is too sparse for strong outcome-based inference.

Recommended next step:
Collaborative debugging and systems-design conversation.
```

Student view:

```text
Strongest alignment:
- systems thinking
- ownership
- independent learning

Role priorities:
- Go
- production debugging
- collaboration

Current evidence gap:
- team-based code review
- monitoring and observability
```

## 10.11 Cold start

### New student

Use resume, GitHub, school, major, coursework, portfolio, interests, and one evidence source. Label output preliminary and recommend the smallest actions that increase confidence.

### New company

Use Company DNA interview, explicit role needs, domain templates, and cautiously labeled comparable-company priors.

### New role

Inherit company and team defaults but require manager confirmation.

## 10.12 Fairness architecture

Exclude from scoring:

- name;
- photo;
- race;
- gender;
- age;
- disability;
- nationality, except lawful work authorization handling;
- neighborhood;
- family background;
- social-media following;
- school prestige.

School may provide course context, but direct evidence must be separated from institutional reputation.

Test:

- name swapping;
- school-prestige swapping;
- profile-format swapping;
- missing-public-work conditions;
- false-negative rates;
- override patterns;
- score stability.

## 10.13 Human review

Companies can:

- inspect evidence;
- dispute inferences;
- request clarification;
- change weights;
- advance lower-ranked candidates;
- override constraints;
- record decision reasons.

Feedback must distinguish capability reasons from:

- role closure;
- compensation;
- timing;
- visa;
- candidate withdrawal;
- manager availability.

## 10.14 Initial architecture

V1 should be modular:

```text
Rules engine
+ structured retrieval
+ graph retrieval
+ semantic retrieval
+ capability mapping
+ weighted model
+ confidence model
+ explanation generator
+ human review
```

Start with interpretable rules, manual company weights, and evidence-linked explanations. Add learned ranking only after outcome data is reliable.

## 10.15 Evaluation

Offline:

- precision at k;
- recall at k;
- ranking quality;
- calibration error;
- hard-constraint accuracy;
- evidence-citation accuracy;
- explanation factuality;
- fairness invariance.

Online:

- shortlist relevance;
- interview conversion;
- offer conversion;
- manager satisfaction;
- student satisfaction;
- return offers;
- repeated company usage;
- time saved;
- override rate.

## 10.16 Failure modes

- prestige leakage;
- public-work bias;
- evidence-quantity bias;
- small-sample overfitting;
- score fixation;
- explanation hallucination;
- company preference laundering;
- missing evidence treated as weakness;
- historical bias reproduction;
- stale Company DNA.

## 10.17 Version record

Every assessment stores:

```yaml
assessment_id: assessment_827
model_version: compatibility_v0.8.2
company_dna_version: dna_12
role_version: role_930_v4
evidence_snapshot: snapshot_2201
ontology_version: ontology_2026_07
rules_version: rules_19
created_at: 2026-07-30T19:22:00Z
```

## Design principle

A résumé asks whether someone looks qualified. Compatibility asks whether the available evidence supports success in a particular environment.


# Chapter 11: Hiring Intelligence Engine

## 11.1 Purpose

The Hiring Intelligence Engine converts recruiting and work outcomes into reusable organizational knowledge.

Most companies repeat hiring processes without systematically learning which evidence, questions, assessments, managers, or onboarding practices predicted successful outcomes.

Covenda should preserve:

- what the company believed;
- what evidence it reviewed;
- why it advanced or rejected;
- what evaluation occurred;
- what outcome followed;
- which signals proved useful;
- which signals were misleading;
- how the company changed.

## 11.2 Outcome taxonomy

### Recruiting

- viewed;
- saved;
- introduction requested;
- introduction approved;
- interviewed;
- assessment completed;
- rejected;
- offered;
- accepted;
- withdrew;
- role closed.

### Work

- trial funded;
- trial started;
- submitted;
- revision requested;
- accepted;
- declined;
- paid;
- deadline met;
- communication quality;
- deliverable quality;
- would work again.

### Employment

- internship completed;
- return offer;
- retention;
- promotion;
- expanded responsibility;
- rehire;
- manager rating;
- team feedback.

## 11.3 Learning questions

- Which evidence predicts strong work outcomes?
- Which role requirements are unnecessary?
- Which interview questions add information?
- Which stages are redundant?
- Which managers produce strong student development?
- Which candidate types are overlooked?
- Which assessments create adverse impact without predictive value?
- Which sources produce repeatable hires?
- Which onboarding conditions reduce senior-engineer burden?
- Which students were initially uncertain but succeeded?

## 11.4 Process analytics

The engine should identify:

- time-to-review;
- candidate drop-off;
- delayed feedback;
- interviewer disagreement;
- repeated evaluation;
- assessment burden;
- low-value stages;
- offer reasons;
- rejection-reason quality;
- outcome data completeness.

Example:

```text
The technical screen consumes 45 minutes per candidate and changes the final decision in 4% of cases. The current sample is 68 candidates. Review whether the screen duplicates the work-sample stage.
```

The system should recommend review, not automatically remove stages.

## 11.5 Predictive versus causal language

Outputs must distinguish:

- descriptive pattern;
- predictive association;
- hypothesis;
- causal conclusion.

Causal conclusions require stronger design than ordinary product analytics.

## 11.6 Manager and team effects

Student success may depend on manager quality, project scope, onboarding, and supervision.

Covenda must avoid attributing every weak outcome to the student.

Outcome analysis should include:

- manager availability;
- clarity of project;
- access delays;
- changing priorities;
- feedback quality;
- team support;
- compensation and hours;
- company-side cancellation.

## 11.7 Hiring memory interface

A company should see:

```text
What changed since the last hiring cycle
- ownership increased in predictive importance;
- exact framework match did not predict success;
- candidates with long-term independent projects performed strongly;
- one assessment stage produced little incremental information;
- interns with weekly manager feedback had higher completion rates.
```

Each insight links to sample size, data period, uncertainty, and supporting records.

## 11.8 Requirements

| ID | Requirement |
|---|---|
| HI-01 | Outcome reasons separate capability signals from logistical and company-side causes. |
| HI-02 | Insights display sample size and uncertainty. |
| HI-03 | Manager and onboarding conditions are included in analysis. |
| HI-04 | Correlation is not presented as causation. |
| HI-05 | Historical patterns do not override legal and fairness constraints. |
| HI-06 | Companies can dispute and annotate insights. |
| HI-07 | Outcome records are permissioned and retention-controlled. |
| HI-08 | Student-facing outcomes do not expose confidential company analytics. |
| HI-09 | Model updates are versioned and reversible. |
| HI-10 | The engine measures whether Covenda reduced review time without reducing quality. |


# Chapter 12: Student Identity, Onboarding, and Consent

## 12.1 Purpose

The student product should allow a person to create an evidence-backed professional identity quickly, privately, and without requiring a referral.

The initial onboarding must create immediate value while avoiding a long application form.

## 12.2 Entry paths

Students may discover Covenda through:

- self-signup;
- professor;
- laboratory;
- club;
- hackathon;
- friend;
- referral link;
- employer;
- public profile;
- opportunity;
- direct outreach;
- professional community.

The entry source may be recorded for attribution and growth analysis. It does not determine capability.

## 12.3 Initial promise

The student-facing message should communicate:

> Your résumé says where you were. Covenda shows what you actually did.

Core commitments:

- profiles are free;
- private by default;
- no opportunity guarantee;
- students approve company introductions;
- students are never charged to apply or be introduced;
- referrals are optional;
- profiles can be shared outside the platform;
- evidence states are explicit.

## 12.4 Minimal onboarding

Target completion time: under ten minutes.

Required:

- legal or preferred name;
- email;
- secure authentication;
- school or current role;
- graduation year or career stage;
- major or primary field;
- opportunity interests;
- one evidence source or artifact;
- privacy and introduction preferences.

Optional:

- resume;
- GitHub;
- LinkedIn;
- portfolio;
- transcript;
- research profile;
- availability;
- location;
- work authorization;
- compensation expectations;
- video or text walkthrough;
- mentor interest.

The system should not block initial value because every optional source is absent.

## 12.5 Identity verification

Verification may include:

- email confirmation;
- school email;
- government or third-party identity check for high-risk actions;
- professional email;
- linked professional identity;
- manual review.

A school email confirms access to the email. It does not prove permanent enrollment or talent quality.

Use labels such as:

```text
University email confirmed
```

Do not use:

```text
University-verified talent
```

## 12.6 Profile states

| State | Meaning |
|---|---|
| Draft | Account exists; required sections incomplete |
| Profile complete | Required identity and preference fields complete |
| Company-visible | Meets minimum evidence and privacy requirements |
| Evidence-confirmed | At least one meaningful evidence item has independent support |
| Work-verified | Employer-confirmed outcome exists |
| Paused | Not currently open to opportunity |
| Stale | Profile has not been updated within the defined period |
| Restricted | Access limited after policy or verification review |

These are operational states, not public talent rankings.

## 12.7 Consent architecture

Students control:

- public profile link;
- discoverability;
- verified-company access;
- artifact-level visibility;
- confidential evidence sharing;
- compensation visibility;
- observer contact permission;
- active-search status;
- introduction approval;
- data export;
- account deletion.

Recommended default:

> Ask before every introduction.

The student should see exactly what the company will receive before approval.

## 12.8 Optional project walkthrough

A short walkthrough is more useful than a generic personality video.

Prompt:

> Explain one thing you built, what you personally contributed, what changed during the work, and what you would improve.

Recommended controls:

- 60-90 seconds;
- captions;
- text alternative;
- optional;
- no automatic personality scoring;
- no requirement for company visibility;
- accessible recording and upload flow.

## 12.9 Onboarding outputs

After onboarding, the student should receive:

- preliminary Evidence Graph;
- strongest visible evidence;
- compatibility examples;
- verification opportunities;
- missing-evidence list;
- recommended next action;
- privacy preview.

Example:

```text
Profile foundation complete

Strongest current evidence:
- deployed Flutter application
- verified university coursework
- technical research project

Highest-value next action:
Add a short contribution explanation for the deployed application.
Estimated time: 6 minutes.
```

## 12.10 Requirements

| ID | Requirement |
|---|---|
| SO-01 | Self-signup is available without referral. |
| SO-02 | The initial flow can be completed without mandatory video. |
| SO-03 | Profiles are private by default. |
| SO-04 | Students approve each company introduction by default. |
| SO-05 | Every connected source explains what the connection verifies. |
| SO-06 | The system provides useful output before full profile completion. |
| SO-07 | Accessibility alternatives exist for all media requirements. |
| SO-08 | Students can pause opportunity visibility without deleting history. |
| SO-09 | Referrer identity and endorsement are not inferred from link use. |
| SO-10 | Consent events are versioned and auditable. |


# Chapter 13: Student Profile and Evidence Explorer

## 13.1 Product objective

The student portal should feel like a career operating system and body-of-work environment, not another job board.

It should help a person understand:

- who they are professionally;
- what they have demonstrated;
- which evidence is strongest;
- which opportunities fit;
- what remains unverified;
- how to improve;
- how their professional identity grows over time.

## 13.2 Navigation

Recommended student navigation:

```text
Home
Explore
Applications
Trials and Work
Messages
Profile
Referrals
Mentorship
Settings
```

The home screen should not contain dozens of empty analytics cards.

### Home

- profile and visibility status;
- active availability;
- recommended next action;
- company interest;
- application updates;
- active engagement;
- recent verification changes.

### Explore

- companies;
- opportunities;
- batches;
- learning and evidence recommendations.

### Applications

Every application and current state.

### Trials and Work

Paid trials, projects, engagements, submissions, decisions, and Work Records.

### Messages

Conversations after mutual interest.

### Profile

Evidence Graph, preferences, goals, privacy, and shareable views.

## 13.3 Profile representations

### Graph view

Student at center with expandable evidence, domains, organizations, and outcomes.

### Timeline view

Chronological growth and updates.

### Domain view

Evidence grouped by technical or professional ontology.

### Capability view

Evidence-linked capability narratives.

### Verification view

Self-reported, linked, contribution-confirmed, understanding-demonstrated, and outcome-verified items.

### Company relevance view

How selected evidence relates to a specific opportunity.

## 13.4 Evidence card

Every evidence card should include:

- title;
- context;
- claim;
- personal contribution;
- artifact or link;
- collaborators;
- observer or supervisor;
- outcome;
- date;
- verification state;
- AI-use disclosure;
- limitations;
- permissions;
- capabilities supported.

Example:

```text
Distributed Event Queue

Context:
Independent systems project

Contribution:
Designed retry, idempotency, and monitoring modules

Evidence:
Private GitHub repository and architecture document

Verification:
Account connected
Commit history reviewed
Technical defense completed

Supports:
Systems thinking
Technical depth
Ownership

Limitations:
No independent production usage confirmed
```

## 13.5 Technical profile

For Software and AI, the profile should include:

- technical breadth;
- technical depth;
- agency;
- builder history;
- AI engineering;
- collaboration;
- verification;
- current gaps;
- recommended next evidence.

Do not display one "engineering quality score."

## 13.6 Profile health

Profile health measures information quality, not human worth.

Dimensions:

- identity completeness;
- evidence coverage;
- contribution clarity;
- verification coverage;
- recency;
- privacy configuration;
- goal clarity;
- availability freshness.

The interface should avoid manipulative streaks and public leaderboards.

## 13.7 Compatibility explorer

Each role should show:

- fit band;
- strongest alignment;
- role environment;
- hard constraints;
- missing evidence;
- actual capability gaps, where supported;
- recommended preparation;
- company evidence preferences;
- opportunity terms.

The wording must distinguish:

```text
No evidence of collaborative code review is currently connected.
```

from:

```text
You are weak at collaboration.
```

## 13.8 External sharing

Students can generate:

- public profile;
- private company-specific link;
- selected evidence packet;
- PDF or export;
- QR code;
- short profile summary.

Every shared view should respect artifact permissions.

## 13.9 Growth recommendations

Recommendations should identify the highest information gain, not simply ask for more data.

Example:

```text
Highest-value next evidence:
A collaborator endorsement for your robotics project.

Why:
The project supports technical depth, but current evidence does not clarify team contribution.
```

## 13.10 Success metrics

- evidence added after onboarding;
- profile update frequency;
- company-specific link creation;
- student understanding of verification labels;
- recommendation completion;
- opportunity save-to-application rate;
- student-reported usefulness;
- percentage of profiles with at least one independently supported artifact.


# Chapter 14: Membership, Reputation, and the Covenda Builder Credential

## 14.1 Purpose

Covenda should become a trusted credential because it publishes a difficult standard and preserves evidence, not because it declares itself elite.

Membership must avoid popularity scoring, social-media incentives, or permanent person rankings.

## 14.2 Credential thesis

A respected campus fund, laboratory, open-source project, or selective technical organization can become a signal because membership implies a known process and body of work.

Covenda can create a similar signal through:

- published requirements;
- evidence verification;
- practical demonstration;
- professional conduct;
- continued improvement;
- visible limitations;
- employer-confirmed outcomes.

The product term "Covenda Builder" should represent evidence-backed standing, not marketing status.

## 14.3 Suggested levels

| Status | Minimum meaning |
|---|---|
| Member | Identity confirmed and profile created |
| Verified Builder | Multiple evidence items with meaningful verification |
| Advanced Builder | Strong verified evidence in a defined domain |
| Distinguished Builder | Sustained work with independent external validation |
| Mentor | Approved to support others based on verified experience and conduct |
| Alumni | Prior active member with preserved evidence history |

Names and thresholds require user research. The architecture should support published criteria and version history.

## 14.4 Published standard

Every status should have:

- required evidence classes;
- minimum verification depth;
- conduct requirements;
- recency rules;
- review method;
- appeal process;
- expiration or stale-state rule;
- explanation of what the status does not prove.

Example:

```text
Verified Builder does not mean universally excellent.
It means Covenda has confirmed identity, reviewed multiple evidence items, and established meaningful personal contribution in at least one domain.
```

## 14.5 Good standing

Good standing requires:

- truthful representation;
- correct attribution;
- professional conduct;
- assessment integrity;
- response to material verification requests;
- compliance with confidentiality and platform rules.

Inactivity should not erase standing. The profile may become stale.

## 14.6 Disqualifying conduct

Potential violations:

- fabricated work;
- identity fraud;
- copied assessment;
- false recommendation;
- deliberate misattribution;
- harassment;
- confidentiality violation;
- repeated low-quality AI-generated submissions without understanding;
- manipulation of verification;
- refusal to correct material falsehoods.

Consequences must be proportional, documented, and appealable.

## 14.7 Rejection as roadmap

A student who does not meet a batch or credential standard should receive:

- missing requirement;
- evidence accepted;
- evidence not accepted;
- reason;
- recommended path;
- reapplication condition;
- estimated time or scope.

Example:

```text
Requirement not yet satisfied:
Independent ownership

Current evidence:
Two team hackathon projects

What would close the gap:
A maintained independent project, a verified work record, or an ownership defense demonstrating primary responsibility.
```

## 14.8 Public visibility

Public badges may link to a verification page showing:

- status;
- domain;
- issue date;
- criteria version;
- evidence summary;
- expiration or stale state;
- revocation status.

Sensitive evidence should not be public.

## 14.9 Anti-gaming controls

- no public cross-student leaderboard;
- no raw activity-count thresholds;
- no status purchase;
- no referral-count status;
- no school-prestige shortcut;
- periodic audit;
- random defense;
- reviewer conflict disclosure;
- evidence diversity rules.

## 14.10 Metrics

- credential completion;
- company recognition;
- false-positive audit rate;
- appeal rate;
- renewal or freshness;
- correlation with positive work outcomes;
- student understanding;
- distribution across school and background categories.


# Chapter 15: Invitations, Referrals, Endorsements, and Trust Networks

## 15.1 Separation of concepts

Covenda must distinguish four objects:

### Invitation

Someone believes a person should know about Covenda.

An invitation is a growth event, not capability evidence.

### Referral context

A person or organization explains how the candidate entered the network or why an introduction may be relevant.

### Endorsement

A verified observer confirms a specific contribution or capability directly observed.

### Recommendation

A broader professional statement that may combine context, examples, and future potential.

Only evidence-bearing statements should affect trust or capability interpretation.

## 15.2 Open access

A student can join, build evidence, apply, and become visible without a referral.

Referrals should enrich the graph without becoming an access gate.

## 15.3 Referral flow

1. Referrer creates invitation link.
2. System records source, campaign, and referrer.
3. Student creates independent account.
4. No endorsement is inferred.
5. If the referrer intends to endorse, Covenda requests a separate structured attestation.
6. Referrer identity is verified where possible.
7. Student can accept or decline display of the endorsement.

## 15.4 Endorsement structure

```yaml
endorsement_id: end_1042
observer_id: person_382
candidate_id: student_293
relationship: project_teammate
observation_period: 2025-09_to_2026-03
context: robotics_club
observed_contribution:
  - designed perception pipeline
  - led integration testing
capabilities:
  collaboration: strong
  technical_depth: moderate
verification:
  observer_email_confirmed: true
  project_membership_supported: true
limitations:
  - observer did not review all code
contact_permission: request_first
```

## 15.5 Trust graph

The trust graph can connect:

- students;
- professors;
- mentors;
- managers;
- laboratories;
- clubs;
- companies;
- work records;
- endorsements.

Trust should depend on specificity, relationship, evidence, and historical reliability.

It should not become a popularity graph where central people automatically confer high status.

## 15.6 Organization partnerships

Clubs, laboratories, and communities may:

- nominate students;
- verify membership;
- host workshops;
- review rubrics;
- contribute domain expertise;
- sponsor batches;
- provide mentors.

The platform must not imply that membership in a partner organization proves capability.

## 15.7 Abuse prevention

Risks:

- endorsement rings;
- reciprocal praise;
- fabricated observers;
- pressure to endorse;
- referral gatekeeping;
- discriminatory closed networks;
- company solicitation spam.

Controls:

- identity checks;
- relationship evidence;
- rate limits;
- conflict disclosure;
- structured prompts;
- anomaly review;
- student consent;
- no ranking by endorsement count.

## 15.8 Metrics

- invitation-to-profile conversion;
- endorsement completion;
- percentage of endorsements with specific evidence;
- company use of endorsements;
- disagreement between endorsements and later outcomes;
- abuse reports;
- access parity for students without referrals.


# Chapter 16: Company Platform and Onboarding

## 16.1 Purpose

The company platform should reduce the time required to understand and evaluate emerging talent.

It should not force a founder through a long ATS setup before demonstrating value.

## 16.2 Company acquisition profile

The first companies most likely to use Covenda are those that:

- hire off-cycle;
- have limited recruiting infrastructure;
- are open to early-career talent;
- can articulate real work;
- value portfolios and direct evidence;
- have a qualified evaluator;
- can pay;
- have near-term demand;
- care about reducing senior-engineer onboarding burden.

The proposition:

> Do not review hundreds of applications. Tell Covenda what you need and what evidence you trust. Covenda shows a small number of students with visible work, explicit contribution, and clear uncertainty.

Covenda should not promise better hires before outcome evidence exists.

## 16.3 Account creation

Minimal fields:

- work email;
- name;
- role;
- company website;
- secure authentication;
- terms agreement.

Do not require a full hiring wizard before showing the product.

## 16.4 Verification

Risk-based controls:

### Basic

- email confirmation;
- company-domain match;
- website review;
- professional identity;
- role confirmation.

### Additional

- founder or employee confirmation;
- payment method;
- business registration;
- manual review;
- reference from existing company;
- video call.

A legitimate early startup using a personal email should trigger manual review, not automatic rejection.

Company states:

- email unverified;
- verification pending;
- verified;
- restricted;
- suspended.

Only verified companies may view full discoverable profiles, request introductions, post opportunities, invite trials, or contact students.

## 16.5 Public company profile

Fields:

- name;
- logo;
- website;
- verified status;
- founders;
- location;
- team size;
- stage, optional;
- funding, optional;
- product;
- customer type;
- industry;
- current priorities;
- why a student might join;
- work types;
- learning opportunities;
- expected ownership;
- mentorship and supervision;
- communication cadence;
- environment;
- stack and tools;
- departments;
- engagement types;
- typical hours;
- remote or location expectations;
- compensation approach;
- work authorization;
- hiring timeline;
- product, career, technical, and founder links.

Covenda may prefill public information, but the company must confirm it.

## 16.6 Private settings

- team members;
- permissions;
- billing;
- recruiter access;
- notification preferences;
- data retention;
- internal notes;
- confidential materials;
- integrations;
- legal contacts.

## 16.7 Dashboard

Recommended navigation:

```text
Home
Talent
Opportunities
Applications
Trials
Messages
Company Profile
Hiring Memory
Billing
Settings
```

Home should show:

- active hiring;
- required actions;
- new student responses;
- saved candidates;
- trial deadlines;
- recent outcomes;
- company-data freshness.

## 16.8 Candidate discovery modes

### Browse

Filters:

- capability;
- evidence type;
- verification state;
- availability;
- compensation;
- time zone;
- engagement type;
- industry;
- location;
- graduation year;
- school only where operationally relevant;
- Work Records.

No hidden personality or intelligence score.

### Curated shortlist

Company submits Talent Brief. Covenda returns approximately three to five candidates.

Each explanation states:

- requirement supported;
- evidence;
- self-reported information;
- missing requirement;
- uncertainty;
- recommended next action.

## 16.9 Candidate card

- professional headline;
- availability;
- desired work;
- relevant capability claims;
- evidence cards;
- contribution;
- outcome;
- observer;
- verification state;
- limitations;
- compatibility explanation.

Contact details remain hidden until student approval.

## 16.10 Requirements

| ID | Requirement |
|---|---|
| CO-01 | Only verified companies can request introductions or trials. |
| CO-02 | Company onboarding creates a Company DNA draft. |
| CO-03 | Public company information is confirmed by an authorized user. |
| CO-04 | Candidate review cites evidence and limitations. |
| CO-05 | Student contact details remain hidden before approval. |
| CO-06 | Compensation and workload are visible before application. |
| CO-07 | Company-side actions generate audit events. |
| CO-08 | Permissions support founder, recruiter, evaluator, billing, and read-only roles. |
| CO-09 | The company can export or delete data according to policy. |
| CO-10 | Company pages never imply a partnership without approval. |


# Chapter 17: Talent Briefs, Opportunities, and Introductions

## 17.1 Talent Brief

A Talent Brief is the operational representation of what the company needs.

It includes:

- problem or work context;
- expected responsibilities;
- deliverables or outcomes;
- capability priorities;
- required and preferred skills;
- evidence trusted;
- evidence not required;
- environment;
- supervision;
- compensation;
- hours;
- duration;
- start date;
- location;
- work authorization;
- evaluation process;
- potential continuation;
- decision maker;
- timeline.

The Talent Brief may generate one or more opportunities.

## 17.2 Opportunity types

- internship;
- part-time role;
- full-time role;
- contract;
- project;
- research engagement;
- paid trial;
- future pipeline;
- batch participation.

## 17.3 Problem-first framing

For small companies, the strongest entry may be:

> Tell Covenda what is blocked or what must be accomplished.

The system can help transform a problem into:

- bounded scope;
- required evidence;
- likely student profile;
- supervision requirement;
- risk;
- appropriate engagement type;
- estimated effort;
- evaluation criteria.

The product should sell bandwidth and outcomes, not generic "interns."

## 17.4 Mini work contract

Project-like opportunities should state:

- problem;
- deliverable;
- inputs;
- dependencies;
- milestones;
- hours;
- payment;
- evaluator;
- acceptance criteria;
- confidentiality;
- IP;
- AI policy;
- portfolio permission;
- potential next step.

## 17.5 Student discovery

Each opportunity card displays:

- company;
- title;
- type;
- compensation;
- weekly hours;
- duration;
- start;
- location;
- capabilities;
- evidence requested;
- deadline;
- trial requirement;
- conversion potential.

Filters should support capability, engagement, compensation, time, location, stage, industry, and start date.

## 17.6 Application

A student applies with selected evidence rather than resubmitting an entire generic profile.

Application packet:

- interest statement;
- relevant evidence cards;
- availability;
- hard-constraint responses;
- optional question;
- disclosure of conflicts or restrictions;
- consent to company access.

## 17.7 Introduction request

The company sends:

- opportunity;
- why the student appears relevant;
- compensation;
- time commitment;
- next step;
- personal message.

The student may:

- accept;
- ask a question;
- decline;
- report concern.

Direct communication opens only after approval.

## 17.8 Application and introduction states

```text
Saved
Interested
Applied
Under review
Shortlisted
Introduction requested
Student question
Introduction accepted
Interviewing
Assessment
Trial invited
Offer
Closed
Withdrawn
```

States should capture who must act next and expected date.

## 17.9 Spam and fairness controls

- company request limits;
- meaningful interest limits;
- no public contact by default;
- no automated mass outreach;
- explanation required for shortlist;
- response deadlines;
- report and block;
- no sponsored listings in the early product;
- later promotion must be labeled clearly.

## 17.10 Metrics

- Talent Brief completion;
- shortlist size;
- introduction acceptance;
- time to first response;
- application-to-interview;
- student decline reasons;
- company relevance rating;
- opportunity-term completeness;
- repeated company usage.


# Chapter 18: Paid Trials, Projects, and Work Records

## 18.1 Role of paid trials

Paid trials are an optional evaluation mechanism for shortlisted candidates. They are not the definition of Covenda and must not become an open marketplace where many students perform speculative work.

Required sequence:

```text
Browse or apply
-> shortlist
-> company approval
-> paid invitation
-> student acceptance
-> funding
-> work
-> decision
-> payment
-> Work Record
```

## 18.2 Trial requirements

Every trial defines:

- purpose;
- deliverable;
- inputs;
- expected hours;
- payment;
- acceptance criteria;
- reviewer;
- AI policy;
- confidentiality;
- IP;
- start and deadline;
- revision allowance;
- decision date;
- potential next step.

Covenda reviews for completeness, safety, compensation, and prohibited terms. It does not automatically certify technical quality.

## 18.3 No unpaid useful labor

A trial must not be:

- unpaid;
- broad production work disguised as evaluation;
- assigned to unlimited candidates;
- missing a reviewer;
- missing a decision timeline;
- dependent on production credentials;
- requesting confidential customer or patient data without proper controls;
- reusable by the company without agreed compensation and rights.

## 18.4 Workspace

The trial workspace includes:

- overview;
- materials;
- milestones;
- questions;
- submission;
- activity;
- terms;
- payment status.

The actual work may occur in GitHub, Figma, Google Docs, Office, Notion, Jupyter, a company sandbox, or another approved tool. Covenda manages relationship, terms, evidence, and outcome rather than replacing every work tool.

## 18.5 Communication

Each question may include:

- question;
- why it matters;
- checks already performed;
- blocker status;
- requested response date;
- attachment.

Covenda provides notifications, reminders, moderation, reporting, and meeting scheduling.

## 18.6 Submission

Student submits:

- deliverable;
- links;
- methodology;
- AI-use disclosure;
- known limitations;
- unresolved questions;
- portfolio permission request.

## 18.7 State machine

```text
Invited
Awaiting acceptance
Awaiting funding
Ready
In progress
Submitted
Under review
Revision requested
Resubmitted
Accepted
Not selected
Paid
Closed
Disputed
Cancelled
```

Each state displays:

- current status;
- responsible actor;
- expected date;
- payment;
- last update;
- allowed action.

## 18.8 Company evaluation

Possible decisions:

- accept and offer role;
- accept and offer another engagement;
- accept without further engagement;
- request agreed revision;
- do not proceed;
- cancel with reason.

Covenda should not automatically publish a numerical rating.

## 18.9 Work Record

A completed engagement may generate an employer-confirmed Work Record.

Fields:

- company;
- engagement type;
- scope;
- contribution;
- accepted deliverable;
- deadline;
- communication;
- revision;
- would work again;
- artifact visibility;
- compensation paid;
- company confirmation;
- student response;
- dispute status.

Example:

```text
Product QA trial for a B2B software startup

- tested 18 onboarding workflows;
- submitted 11 reproducible bug reports;
- completed on time;
- deliverable accepted after one clarification;
- employer confirmed contribution;
- artifact remains private.
```

This is stronger than a generic rating because it preserves context.

## 18.10 Disputes

Students may dispute:

- factual errors;
- completion state;
- nonpayment;
- unauthorized disclosure;
- misrepresented feedback.

Companies may dispute:

- plagiarism;
- false contribution;
- confidentiality violation;
- noncompletion;
- required AI-use nondisclosure.

Human review and records are mandatory.

## 18.11 Conversion and retention

Covenda should treat a company hiring a student as success, not leakage.

Potential commercial design:

- transparent placement or conversion fee;
- declining fee based on prior on-platform relationship;
- membership plan;
- on-platform guarantee;
- payer-of-record support where legally viable;
- company data and workflow value that remains after a person is hired.

The company should stay for the talent-and-work system, not because Covenda blocks direct relationships.

## 18.12 Metrics

- funded trials;
- completion;
- decision latency;
- payment latency;
- conversion;
- estimated versus actual company time;
- accepted deliverables;
- disputes;
- repeat projects;
- company referrals;
- student satisfaction.


# Chapter 19: Homework, Assessments, and Professional Simulations

## 19.1 Purpose

Assessments should generate role-relevant evidence while minimizing candidate burden.

Covenda should not build generic testing infrastructure already solved by mature vendors. It should own contextual interpretation, evidence synthesis, candidate-specific defense, and connection to Company DNA.

## 19.2 Assessment principles

1. Use work resembling the real role.
2. State the capability measured.
3. State what the assessment cannot prove.
4. Assume frontier AI access.
5. Capture process where justified.
6. Test defense and adaptation.
7. Avoid invasive surveillance.
8. Limit duration.
9. Compensate productive company-specific work.
10. Reuse evidence where possible.
11. Use human review where judgment is the capability.
12. Version rubrics and scenarios.

## 19.3 Assessment types

- debugging;
- code review;
- existing-codebase change;
- systems design;
- data analysis;
- research synthesis;
- financial modeling;
- investment judgment;
- structured case;
- technical writing;
- security review;
- product prioritization;
- experiment design;
- presentation;
- scenario response;
- portfolio walkthrough.

## 19.4 Required metadata

Every assessment defines:

- title;
- purpose;
- capabilities;
- domain;
- difficulty;
- time;
- allowed tools;
- AI policy;
- inputs;
- outputs;
- objective checks;
- rubric;
- reviewer;
- compensation;
- confidentiality;
- data policy;
- evidence generated;
- what it proves;
- what it cannot prove;
- version.

## 19.5 Universal vetting stack

```text
Eligibility
-> Compatibility
-> Existing evidence
-> External assessment
-> Covenda-specific practical assessment, only if needed
-> Ownership defense
-> Human review
-> Published-requirement admission
```

Not every candidate needs every stage. The system should choose the least burdensome credible rail.

## 19.6 Build versus integrate

### Build

- compatibility;
- Evidence Graph;
- provenance;
- defense generation;
- cross-source synthesis;
- batch admission;
- company-facing explanations;
- simulation orchestration where strategic.

### Integrate

- code execution;
- standard test grading;
- identity checks;
- generic skill testing;
- video;
- scheduling;
- proctoring where justified.

### Human rail

- nuanced judgment;
- private work;
- healthcare;
- authorship disputes;
- high-stakes admission;
- appeals.

## 19.7 Adaptive simulations

A shared scenario engine should support:

- persistent state;
- branching;
- dynamic information;
- changed requirements;
- time pressure where job-relevant;
- event logging;
- candidate-specific defense;
- objective checks;
- human review;
- explicit limitations;
- versioned rubrics.

Example software scenario:

```text
Stage 1: inspect unfamiliar codebase
Stage 2: diagnose a reliability problem
Stage 3: implement a bounded change
Stage 4: traffic increases 100x
Stage 5: data becomes sensitive
Stage 6: latency requirement changes
Stage 7: defend architecture and tradeoffs
```

Example investment-banking scenario:

```text
Receive deal context and financials
-> build analysis
-> new management information arrives
-> senior banker requests change
-> prioritize and communicate
-> defend assumptions and errors
```

## 19.8 AI-era authenticity

Do not rely on static take-home output alone.

Combine:

- process;
- version history;
- candidate explanation;
- perturbation;
- modification;
- defense;
- collaborator attribution;
- AI disclosure.

Residual uncertainty must be stored.

## 19.9 Rubrics

Rubrics should use anchored performance levels.

Example:

| Level | Description |
|---:|---|
| 4 | Meets baseline with material errors or heavy support |
| 6 | Solid independent performance for target level |
| 9 | Exceptional judgment, clarity, and adaptation |

Anchors should describe observable behavior, not adjectives.

## 19.10 Reusable evidence

A completed general assessment may be reused across companies with student consent.

Company-specific confidential assessments may remain restricted.

The system should discourage repeated nearly identical unpaid tasks.

## 19.11 Vendor evaluation matrix

Assess providers on:

- realism;
- validity;
- reliability;
- AI resistance;
- authorship support;
- scalability;
- cost;
- API;
- webhooks;
- embedding;
- white label;
- evidence depth;
- student experience;
- employer trust;
- domain fit;
- lock-in;
- impact on Covenda differentiation.

## 19.12 Success metrics

- completion rate;
- abandonment;
- candidate time;
- inter-rater reliability;
- incremental predictive value;
- evidence reuse;
- company trust;
- student fairness rating;
- AI-defense failure detection;
- assessment-to-outcome calibration.


# Chapter 20: Batch Architecture

## 20.1 Purpose

A batch is a structured talent cohort organized around a domain, capability, availability window, or company need.

A batch is not a universal ranking and should not replace the initial student-company introduction workflow.

Build batches only after recurring employer demand exists in a capability category.

## 20.2 Five-batch catalogue

| Batch | Specializations |
|---|---|
| Software and AI | AI/ML; Physical AI and Robotics; Infrastructure and Data; Product Engineering; Security and Reliability |
| Accounting and Finance | Investment Banking; Private Equity; Venture Capital; Asset and Wealth Management; Accounting and Audit |
| Professional Services | Management Consulting; Strategy and Research; Market Intelligence; Legal Operations; Technical Writing |
| Consumer and Retail | Growth and Performance; Brand and Content; Merchandising; Supply Chain; E-commerce and Marketplace |
| Healthcare Operations | Clinical Operations; Health Analytics; Revenue Cycle; Regulatory and Quality; Digital Health Product |

## 20.3 Batch components

- title;
- domain;
- target profile;
- published requirements;
- evidence rails;
- assessments;
- mentors;
- participating companies;
- cohort capacity;
- schedule;
- application;
- admission review;
- development activities;
- company matching;
- outcomes.

## 20.4 Batch types

- open;
- verified;
- company-sponsored;
- multi-company;
- university;
- club or laboratory;
- invite-assisted;
- private pilot.

Invitations may identify candidates but cannot prevent open application where the batch is intended to be open.

## 20.5 Lifecycle

```text
DRAFT
VETTING
CALIBRATION
PRIVATE
INVITE_ONLY
INTEREST_OPEN
APPLICATION_OPEN
IN_REVIEW
AWAITING_CAPACITY
BATCH_FORMING
ACTIVE
MATCHING
INTERVIEW_OR_TRIAL
COMPLETED
ARCHIVED
```

States should be configurable rather than hardcoded to one batch type.

## 20.6 Student journey

```text
Interested
-> eligibility review
-> qualified
-> application submitted
-> awaiting capacity
-> admitted
-> active cohort
-> company matching
-> company selection
-> interview or trial
-> matched or completed
```

Eligibility, qualification, application, and admission must be separate.

## 20.7 Admission

Admission is a published requirements checklist, never a hidden person score.

A miss produces:

- requirement;
- current evidence;
- missing evidence;
- path to improvement;
- reapplication condition.

The engine may draft a recommendation. A human operator makes the final high-stakes admission decision with rationale.

## 20.8 Capacity

Capacity may depend on:

- mentor availability;
- reviewer availability;
- company demand;
- assessment infrastructure;
- cohort quality;
- safety;
- funding.

Qualified students may enter an "awaiting capacity" state rather than being rejected.

## 20.9 Company participation

Companies may:

- sponsor;
- define Company DNA;
- select capability priorities;
- choose simulation templates;
- review evidence;
- request introductions;
- invite interviews or trials;
- provide outcomes.

Companies should not receive undisclosed control over public batch standards.

## 20.10 Metrics

- interest-to-application;
- qualification;
- admission;
- capacity delay;
- cohort completion;
- company participation;
- matching;
- offers;
- student development;
- repeat sponsorship;
- admission appeals;
- outcome quality.


# Chapter 21: Mentorship and Development

## 21.1 Purpose

Mentorship helps students build stronger evidence, understand professional domains, and improve judgment.

It must not become a paid referral marketplace or a mechanism for buying access.

## 21.2 Mentor types

- older student;
- graduate student;
- researcher;
- engineer;
- founder;
- recruiter;
- domain expert;
- alumnus.

## 21.3 Activities

- project review;
- portfolio review;
- technical guidance;
- research guidance;
- interview preparation;
- career exploration;
- accountability;
- evidence explanation;
- simulation review;
- professional communication.

## 21.4 Matching

Inputs:

- domain;
- goal;
- experience level;
- availability;
- language;
- format;
- accessibility;
- compensation;
- conflict restrictions.

Mentorship compatibility should not expose sensitive personality inferences.

## 21.5 Quality controls

Mentors require:

- identity verification;
- relevant experience evidence;
- conduct agreement;
- ratings;
- complaint process;
- conflict disclosure;
- session records;
- removal and appeal process.

## 21.6 Compensation

Possible models:

- volunteer;
- company-sponsored;
- university-sponsored;
- student-paid optional session;
- Covenda-funded;
- mentor credit.

Core profile access and opportunity access should not require purchasing mentorship.

## 21.7 Evidence relationship

Mentorship may generate evidence only when the mentor directly observes work.

A session attendance record is not capability evidence.

A structured project review may support:

- communication;
- iteration;
- technical understanding;
- response to feedback.

## 21.8 Safety

- no guaranteed referrals;
- no payment for endorsements;
- no undisclosed company recruitment;
- no harassment;
- protected communication;
- reporting;
- age-appropriate controls for minors;
- session boundaries;
- no unauthorized confidential material.

## 21.9 Metrics

- match completion;
- repeat sessions;
- student progress;
- evidence improvement;
- complaints;
- mentor quality;
- access equity;
- company-sponsored development outcomes.


# Chapter 22: Search, Retrieval, and Recommendation Systems

## 22.1 Purpose

Search should let companies and students retrieve evidence, people, roles, companies, mentors, assessments, and developmental actions through structured and semantic intent.

Search is not a keyword layer over résumés.

## 22.2 Search modes

### Structured

For exact filters:

- graduation year;
- availability;
- location;
- compensation;
- verification state;
- course;
- role type;
- work authorization;
- domain.

### Graph

For connected relationships:

```text
Student
-> created
-> repository
-> demonstrates
-> distributed systems
-> relevant to
-> infrastructure role
```

### Semantic

For conceptual intent:

> Students who have diagnosed performance bottlenecks and can explain tradeoffs.

Possible retrieval:

- compiler optimization;
- database indexing;
- inference optimization;
- profiling report.

### Outcome-informed

Retrieve evidence patterns associated with relevant outcomes, subject to sample and fairness controls.

## 22.3 Query interpretation

The system should parse:

- target object;
- hard filters;
- desired capabilities;
- evidence types;
- environment;
- exclusions;
- confidence requirement;
- recency;
- privacy scope.

Ambiguous queries should show interpretation rather than silently guess.

## 22.4 Ranking

Ranking may combine:

- filter satisfaction;
- evidence relevance;
- verification;
- diversity;
- compatibility;
- recency;
- student preference;
- company permission;
- outcome signal.

The ranking explanation should identify the dominant evidence.

## 22.5 Recommendation classes

Student recommendations:

- opportunities;
- companies;
- batches;
- assessments;
- projects;
- courses;
- research laboratories;
- open-source work;
- mentors;
- evidence improvements.

Company recommendations:

- candidates;
- evaluation steps;
- assessment templates;
- role requirement changes;
- onboarding improvements;
- overlooked profiles.

## 22.6 Active evidence acquisition

The system should recommend the smallest action that reduces uncertainty.

Example:

```text
Current uncertainty:
Team contribution to robotics project

Highest-information action:
Request one structured teammate endorsement

Alternative:
Complete a collaborative code-review simulation
```

## 22.7 Diversity and exploration

Recommendation systems can overconcentrate attention.

Controls:

- exploration quota;
- score-band randomization;
- school-blind modes;
- evidence-diversity retrieval;
- new-profile exposure;
- audit of repeated non-exposure;
- student preference constraints.

## 22.8 Retrieval provenance

Every result stores:

- query;
- interpretation;
- retrieval method;
- candidate evidence;
- ranking features;
- model version;
- permission context;
- timestamp.

## 22.9 Metrics

- precision;
- company save rate;
- introduction acceptance;
- evidence click-through;
- diversity of exposure;
- zero-result queries;
- query reformulation;
- explanation usefulness;
- privacy violations;
- cold-start performance.


# Chapter 23: AI Architecture and Model Governance

## 23.1 Purpose

AI should help extract, organize, retrieve, explain, and challenge evidence. It should not become an unbounded autonomous employment decision maker.

## 23.2 Appropriate uses

- résumé and document extraction;
- evidence classification;
- ontology mapping;
- semantic retrieval;
- candidate-specific question generation;
- explanation drafting;
- contradiction detection;
- company interview summarization;
- rubric assistance;
- profile gap recommendations;
- workflow support;
- simulation state generation;
- anomaly prioritization.

## 23.3 Restricted uses

AI should not independently:

- make final hiring decisions;
- impose hidden admissions;
- infer protected traits;
- generate personality diagnoses;
- claim authorship certainty;
- issue irreversible fraud sanctions;
- expose private evidence;
- create company requirements that violate policy;
- score appearance, accent, or emotion;
- invent partner relationships;
- fabricate verification.

## 23.4 Model pattern

Prefer a hybrid architecture:

```text
Deterministic rules
+ structured data
+ retrieval
+ graph reasoning
+ calibrated statistical models
+ constrained language models
+ human review
```

Avoid a single end-to-end opaque model for V1.

## 23.5 Language-model grounding

Explanation generation should receive:

- structured assessment result;
- cited evidence IDs;
- allowed claims;
- limitations;
- prohibited inferences;
- required output schema.

Generated statements must be checked against evidence records.

## 23.6 Prompt and model versioning

Store:

- prompt template;
- model;
- model provider;
- parameters;
- retrieved evidence;
- output;
- validator result;
- human edit;
- timestamp.

## 23.7 Model card

Each model or significant AI component should document:

- purpose;
- users;
- inputs;
- outputs;
- training or provider;
- evaluation;
- limitations;
- prohibited uses;
- fairness tests;
- monitoring;
- rollback;
- owner.

## 23.8 Human feedback

Human corrections should be categorized:

- evidence extraction error;
- relevance error;
- unsupported inference;
- tone issue;
- missing limitation;
- incorrect domain mapping;
- fairness concern;
- useful recommendation;
- decision disagreement.

Decision disagreement is not automatically model error.

## 23.9 Data use

Student and company data should not be used for external model training without clear policy, legal basis, and consent where required.

Private evidence should be minimized in prompts and isolated by tenant and purpose.

## 23.10 Evaluation

- factuality;
- citation accuracy;
- extraction accuracy;
- domain mapping;
- calibration;
- unsafe inference rate;
- protected-attribute leakage;
- prompt-injection resistance;
- privacy;
- latency;
- cost;
- human correction rate.

## 23.11 Failure modes

- explanation hallucination;
- prompt injection from uploaded files;
- proxy inference;
- overconfident language;
- training-data leakage;
- model drift;
- inconsistent outputs;
- cost escalation;
- vendor dependence;
- unsupported domain transfer.

## 23.12 Requirements

| ID | Requirement |
|---|---|
| AI-01 | Language-model outputs cannot create verification state without a verification rail. |
| AI-02 | Every evaluative explanation is grounded in evidence IDs. |
| AI-03 | Prompts and model versions are recorded for reproducibility. |
| AI-04 | Protected attributes are excluded and proxy leakage is tested. |
| AI-05 | High-stakes outputs have human review or override. |
| AI-06 | Uploaded content is treated as untrusted input. |
| AI-07 | Models can be disabled or rolled back by component. |
| AI-08 | Private tenant data is isolated. |
| AI-09 | Costs and latency are monitored per workflow. |
| AI-10 | Users are informed when AI generated or summarized content. |


# Chapter 24: AI-Era Authenticity and Authorship

## 24.1 Problem

Frontier AI can generate code, analysis, writing, presentations, and explanations. Static artifact quality is no longer sufficient evidence of human understanding or ownership.

Covenda should not attempt perfect AI detection. Detection is brittle and can punish legitimate users.

## 24.2 Authenticity model

Authenticity is estimated through convergence:

```text
Identity
+ source history
+ process
+ contribution
+ defense
+ perturbation
+ modification
+ observer
+ outcome
```

## 24.3 AI-use levels

A disclosure framework may distinguish:

| Level | Description |
|---:|---|
| 1 | AI used for brainstorming, formatting, or minor assistance |
| 2 | AI generated components that the candidate reviewed and integrated |
| 3 | AI generated substantial work, with candidate directing, testing, and modifying |
| 4 | AI produced most output with limited demonstrated candidate understanding |

These levels should not become automatic pass or fail. Different roles may value AI orchestration.

## 24.4 Evidence collection

Potential signals:

- version history;
- edit sequence;
- test behavior;
- prompts voluntarily disclosed;
- rejected suggestions;
- debugging path;
- architecture decisions;
- source citations;
- candidate modification;
- live explanation;
- collaborator statements.

Avoid invasive keystroke surveillance unless a narrowly defined, consented, job-relevant assessment requires instrumentation.

## 24.5 Defense patterns

### Explain

Why was this approach chosen?

### Attribute

Which parts did you personally produce?

### Diagnose

What is wrong or fragile?

### Modify

Change a requirement.

### Compare

Why not an alternative?

### Extend

What happens at larger scale or new risk?

### Reflect

What did AI get wrong?

## 24.6 Role-specific interpretation

For AI engineering, effective tool use may be positive when the candidate demonstrates:

- evaluation;
- architecture;
- prompt and context design;
- testing;
- failure analysis;
- security;
- product judgment;
- model limitations.

The objective is not to reward manual typing. It is to understand human contribution.

## 24.7 Residual uncertainty

Output example:

```text
Authorship confidence: moderate

Supported:
- candidate controlled repository;
- work evolved across six weeks;
- candidate explained architecture and modified retry logic.

Unresolved:
- degree of AI generation in early modules;
- no independent observer;
- limited evidence of original problem formulation.
```

## 24.8 Policy

- disclose requirements before assessment;
- no automatic punishment for permitted AI use;
- no false authorship certainty;
- route material contradictions to review;
- support accessibility;
- protect prompt and work privacy;
- distinguish policy violation from ordinary assistance.


# Chapter 25: Data Architecture

## 25.1 Storage strategy

A practical implementation can use multiple storage systems.

### PostgreSQL

Authoritative transactional data:

- users;
- profiles;
- companies;
- roles;
- permissions;
- applications;
- introductions;
- trials;
- payments;
- outcomes;
- verification;
- audit events.

### Graph layer

Relationships:

- Evidence Graph;
- capability mapping;
- domain ontology;
- Company DNA relationships;
- trust graph;
- hiring memory.

The graph may initially be represented in relational tables and materialized views before adopting a dedicated graph database.

### Vector index

- semantic evidence retrieval;
- role and company retrieval;
- document search;
- explanation support.

### Object storage

- resumes;
- transcripts;
- videos;
- code archives;
- spreadsheets;
- assessment submissions;
- confidential artifacts.

### Analytics warehouse

Later:

- product analytics;
- model evaluation;
- aggregate hiring intelligence;
- fairness audits.

## 25.2 Core tables

```text
users
student_profiles
student_preferences
companies
company_members
company_dna_versions
teams
roles
talent_briefs
opportunities
evidence_items
evidence_edges
evidence_sources
verifications
capabilities
capability_estimates
domain_nodes
domain_edges
compatibility_assessments
applications
introduction_requests
conversations
assessments
assessment_submissions
defense_sessions
batches
batch_requirements
batch_applications
paid_trials
trial_participants
trial_submissions
work_records
endorsements
mentorship_sessions
outcomes
payments
reports
appeals
audit_events
```

## 25.3 Evidence object

A reusable evidence object must not be hardcoded by vertical.

Fields:

- type;
- domain;
- skills;
- strength;
- ownership;
- verification;
- status;
- deployment;
- collaboration;
- AI disclosure;
- defense;
- source;
- limitations;
- visibility.

Vertical-specific metadata should use validated schemas or extension tables.

## 25.4 Event model

Key events:

```text
profile.created
evidence.added
evidence.updated
verification.requested
verification.completed
compatibility.generated
company.verified
talent_brief.published
application.submitted
introduction.requested
introduction.accepted
assessment.completed
trial.funded
trial.submitted
work_record.confirmed
outcome.recorded
appeal.opened
```

Events support audit, notifications, analytics, and model learning.

## 25.5 Tenant and permission boundaries

Data access depends on:

- owner;
- organization;
- role;
- purpose;
- consent;
- artifact visibility;
- engagement state;
- retention policy.

Company users should not obtain broad access merely because one introduction was approved.

## 25.6 Data lifecycle

- collect minimum;
- classify sensitivity;
- encrypt;
- restrict;
- audit;
- retain according to purpose;
- allow correction;
- export;
- delete or de-identify when required;
- preserve lawful immutable audit records.

## 25.7 Migration strategy

V1 should use simple relational models and explicit JSON where stable schemas are unknown.

Do not prematurely create 25 duplicated vertical tables.

Migrate to dedicated graph infrastructure only when traversal, performance, or maintainability justifies it.

## 25.8 Data quality

Monitor:

- missing fields;
- stale availability;
- orphaned evidence;
- inconsistent verification;
- duplicate identity;
- broken links;
- unsupported score;
- missing version;
- permission drift;
- outcome ambiguity.


# Chapter 26: API and Service Architecture

## 26.1 API domains

```text
/auth
/users
/students
/companies
/teams
/roles
/talent-briefs
/opportunities
/evidence
/verifications
/capabilities
/compatibility
/search
/applications
/introductions
/assessments
/defense
/batches
/trials
/work-records
/endorsements
/mentorship
/outcomes
/analytics
/billing
/audit
/reports
/appeals
```

## 26.2 Service boundaries

Initial modular monolith:

- identity and access;
- profiles;
- companies;
- evidence;
- compatibility;
- marketplace;
- evaluation;
- outcomes;
- notifications;
- administration.

Do not split into microservices before operational need.

## 26.3 Compatibility request

```http
POST /compatibility/assess
```

```json
{
  "student_id": "student_293",
  "role_id": "role_930",
  "company_dna_version": "dna_12",
  "purpose": "company_shortlist"
}
```

Response:

```json
{
  "assessment_id": "assessment_827",
  "fit_band": "strong",
  "score": 8.6,
  "confidence": 0.72,
  "hard_constraints": {
    "status": "pass"
  },
  "components": {
    "domain_alignment": 8.8,
    "capability_alignment": 8.6,
    "environment_alignment": 8.2
  },
  "supporting_evidence": ["ev_18372", "ev_11402"],
  "risks": ["limited_collaboration_evidence"],
  "recommended_next_step": "collaborative_debugging"
}
```

## 26.4 Evidence API

Required operations:

- create claim;
- attach source;
- request verification;
- add collaborator;
- set visibility;
- add limitation;
- update contribution;
- revoke source;
- create edge;
- view history;
- dispute.

## 26.5 Idempotency and audit

Consequential writes require:

- idempotency key;
- actor;
- purpose;
- timestamp;
- previous state;
- new state;
- request source;
- policy version.

## 26.6 Integrations

Connector pattern:

```text
Provider adapter
-> authorization
-> fetch
-> normalize
-> provenance
-> capability mapping
-> verification limitation
-> refresh
-> revocation
```

Potential connectors:

- GitHub;
- GitLab;
- Google Drive;
- university systems;
- assessment providers;
- scheduling;
- payment;
- payroll;
- ATS;
- calendar;
- video.

No connector should imply a verification level beyond its actual capability.

## 26.7 Background jobs

- source refresh;
- link health;
- embedding;
- compatibility generation;
- explanation validation;
- notification;
- document parsing;
- fraud review prioritization;
- expiration;
- analytics.

Use queues and retry policies with idempotency.

## 26.8 Rate limits

Separate limits for:

- search;
- AI generation;
- source sync;
- company outreach;
- endorsement requests;
- assessment starts;
- file upload;
- admin actions.

## 26.9 API requirements

| ID | Requirement |
|---|---|
| API-01 | Every response exposing evaluation includes version and provenance. |
| API-02 | Permissions are enforced server-side. |
| API-03 | Consequential writes are idempotent and audited. |
| API-04 | Connector data can be revoked and refreshed. |
| API-05 | Public APIs do not expose private contact or evidence by default. |
| API-06 | Errors distinguish user, permission, validation, provider, and internal failures. |
| API-07 | Webhook signatures and replay protection are required. |
| API-08 | Long-running jobs expose state. |
| API-09 | Schemas support backward compatibility. |
| API-10 | Evaluation endpoints cannot be used for prohibited automated decision workflows. |


# Chapter 27: Security, Privacy, and Compliance

## 27.1 Security objectives

Covenda stores identity, education, work, assessment, and employment information. Security must be designed before broad company access.

Controls:

- multi-factor authentication;
- secure sessions;
- role-based access;
- least privilege;
- encryption in transit;
- encryption at rest;
- secrets management;
- file scanning;
- dependency monitoring;
- vulnerability management;
- audit logs;
- incident response;
- backups;
- recovery testing.

## 27.2 Data classification

| Class | Examples |
|---|---|
| Public | approved public profile and company page |
| Internal | platform operations and non-sensitive metadata |
| Confidential | private evidence, applications, company notes |
| Restricted | identity documents, transcripts, payment, healthcare-sensitive data |

Access and logging increase by class.

## 27.3 Student privacy

Students should know:

- which company accessed the profile;
- which artifacts were viewed;
- why data is collected;
- how it is used;
- retention;
- correction process;
- export;
- deletion;
- sharing choices.

## 27.4 Company privacy

Companies control:

- private hiring criteria;
- internal notes;
- confidential assessments;
- outcomes;
- team permissions;
- data retention.

Covenda should not expose one company's hiring memory to another.

## 27.5 Education records

Where institutions disclose educational records, legal review may be required for FERPA-related obligations and agreements.

A student upload is not equivalent to direct institutional disclosure. The system should document source and consent.

## 27.6 Employment and automated decisions

Automated employment decision laws and regulations may apply depending on geography and use.

Requirements may include:

- notice;
- explanation;
- audit;
- bias testing;
- human review;
- data rights;
- vendor obligations.

Qualified counsel must review deployment. The product should be architected for transparency and audit rather than retrofitting it.

## 27.7 Healthcare data

Healthcare is the highest-risk vertical.

Before accepting healthcare artifacts:

- PHI intake warning;
- prohibited-data checklist;
- synthetic data preference;
- upload scanning;
- human review;
- restricted access;
- retention limit;
- incident process.

Do not rely on automated detection to catch every prohibited identifier.

## 27.8 Video and biometric risk

Do not infer emotion, personality, honesty, or capability from facial movement, voice, or accent.

No mandatory camera use for standard participation.

Identity verification using biometric methods requires separate legal and policy review.

## 27.9 Compliance roadmap

1. foundational privacy and security controls;
2. documented data map;
3. vendor review;
4. incident response;
5. access reviews;
6. privacy rights process;
7. penetration testing;
8. SOC 2 readiness when customer demand justifies;
9. jurisdiction-specific employment review;
10. high-risk vertical controls.

## 27.10 Requirements

| ID | Requirement |
|---|---|
| SEC-01 | All sensitive data is encrypted in transit and at rest. |
| SEC-02 | Every company access to private student evidence is logged. |
| SEC-03 | Students can revoke future access subject to lawful retention. |
| SEC-04 | Restricted data uses separate controls and minimal retention. |
| SEC-05 | No biometric or emotion inference is used for ranking. |
| SEC-06 | High-risk uploads are scanned and may require human review. |
| SEC-07 | Incident response includes student and company communication. |
| SEC-08 | Vendors are reviewed for data use, retention, security, and subprocessors. |
| SEC-09 | Production access follows least privilege and periodic review. |
| SEC-10 | Legal requirements are validated before jurisdictional deployment. |


# Chapter 28: Trust, Safety, Accessibility, and Appeals

## 28.1 Student protections

Companies must not:

- request unpaid useful work;
- misrepresent compensation;
- request unnecessary sensitive information;
- collect banking information through chat;
- request production credentials;
- pressure off-platform payment;
- expose student contact information;
- publish confidential evidence;
- discriminate;
- retaliate;
- impose deceptive terms.

## 28.2 Company protections

Students must not:

- fabricate evidence;
- impersonate;
- share confidential assessments;
- manipulate endorsements;
- plagiarize;
- violate confidentiality;
- harass;
- misrepresent contribution;
- hide required AI use.

## 28.3 Accessibility

Required product support:

- keyboard navigation;
- screen-reader labels;
- high contrast;
- captions;
- text alternatives;
- accessible upload status;
- saved drafts;
- flexible timeouts;
- clear errors;
- reduced motion;
- accommodation request;
- no mandatory camera;
- accessible assessment alternatives where the capability allows.

## 28.4 Reporting

Users can report:

- harassment;
- fraud;
- unsafe trial;
- nonpayment;
- impersonation;
- privacy breach;
- discrimination;
- misleading opportunity;
- confidential-data request;
- accessibility issue.

Reports require severity, routing, response target, evidence, and audit trail.

## 28.5 Enforcement ladder

- education;
- warning;
- content correction;
- evidence restriction;
- trial cancellation;
- temporary suspension;
- company restriction;
- permanent removal;
- external escalation where legally required.

The consequence should match harm, intent, repetition, and risk.

## 28.6 Appeals

Appeals include:

- decision;
- policy;
- evidence;
- reviewer;
- deadline;
- independent review where possible;
- final rationale;
- correction and restoration.

## 28.7 Marketplace integrity

- verified companies only;
- transparent terms;
- introduction consent;
- compensation before application;
- no open direct messaging;
- rate limits;
- no hidden paid promotion;
- no public ranking;
- no status purchase;
- no false partnership claim.

## 28.8 Metrics

- report volume;
- severity;
- resolution time;
- repeat offenders;
- appeal reversal;
- nonpayment;
- unsafe-trial prevention;
- accessibility defects;
- company verification false positives;
- student trust.


# Chapter 29: Marketplace Dynamics and Cold Start

## 29.1 Marketplace structure

Covenda is a multi-sided system involving:

- students;
- companies;
- mentors;
- universities and communities;
- reviewers;
- assessment partners.

The first marketplace objective is not maximum signups. It is enough trusted supply and real demand to produce repeated, high-quality outcomes.

## 29.2 Cold-start problem

Students will not invest deeply if companies are absent. Companies will not trust the system if profiles are incomplete.

The solution is staged value.

### Immediate student value

- preliminary compatibility;
- reusable professional profile;
- evidence organization;
- shareable profile;
- gap analysis;
- development roadmap.

### Immediate company value

- concierge Company DNA;
- manually curated shortlist;
- reduced review volume;
- evidence-linked profiles;
- structured introductions;
- optional trial support.

## 29.3 Concierge first

Initial operations should be manually intensive:

- recruit 25-50 strong students;
- onboard 5-10 companies;
- interview companies;
- verify selected evidence;
- build shortlists manually;
- support introductions;
- collect outcome detail.

Manual operations are not a failure. They are the fastest way to learn which information matters before automating.

## 29.4 Liquidity

Marketplace liquidity is not applications per listing.

Useful liquidity means:

- a company can receive a relevant shortlist within a defined time;
- students receive credible opportunities;
- introductions are accepted;
- evaluations occur;
- outcomes are recorded;
- companies return.

Potential liquidity metrics:

- qualified candidates per active Talent Brief;
- time to shortlist;
- introduction acceptance;
- company response;
- student opportunity rate;
- repeated company requests.

## 29.5 Quality control

Do not expose every incomplete profile to companies.

Use objective visibility conditions:

- profile complete;
- identity confirmed;
- at least one evidence item;
- privacy configured;
- current availability;
- no unresolved serious integrity issue.

Higher-trust pools may require stronger verification.

## 29.6 Supply strategy

Recruit through:

- Columbia clubs;
- research laboratories;
- professors;
- hackathons;
- startup communities;
- technical workshops;
- peer referrals;
- high-school and college builder networks;
- international communities later.

The goal is evidence-rich students, not generic account volume.

## 29.7 Demand strategy

Acquire through:

- founder-led outreach;
- alumni;
- venture funds;
- accelerators;
- technical communities;
- startup lawyers and service providers;
- engineering leaders;
- university entrepreneurship centers;
- student-led warm introductions.

## 29.8 Disintermediation

Companies may hire students directly. This should be treated as a successful conversion, with transparent fees or membership terms.

Retention should come from recurring value:

- new talent;
- scoping;
- Company DNA;
- hiring memory;
- verification;
- guarantees;
- payment and compliance;
- batches;
- analytics.

Avoid surveillance and punitive contact blocking.

## 29.9 Marketplace failure modes

- too many students, too few roles;
- low-quality company demand;
- unpaid trials;
- founder churn after one hire;
- school concentration;
- company ghosting;
- opaque rejection;
- overbuilt batch system;
- no outcome collection;
- students optimizing profiles for algorithms;
- recruiters treating compatibility as decision.

## 29.10 Kill criteria

A pilot should be reconsidered if:

- companies do not request a second shortlist;
- students do not approve introductions;
- evidence does not change company decisions;
- verification costs exceed value;
- paid trials create frequent disputes;
- company time is not reduced;
- outcome data cannot be collected;
- strong students prefer ordinary direct networking.

Kill criteria prevent attachment to an unvalidated architecture.


# Chapter 30: Go-to-Market: Columbia and Technical Startups

## 30.1 Launch objective

The Columbia launch should prove a repeatable local network:

```text
Trusted student source
-> evidence-backed profiles
-> real company demand
-> explainable shortlist
-> introduction
-> outcome
-> repeat usage
```

## 30.2 Student acquisition

Priority groups:

- engineering and AI clubs;
- robotics;
- hackathons;
- research laboratories;
- student founders;
- finance and consulting organizations for later verticals;
- professors and teaching assistants;
- high-agency independent builders.

Outreach should publish the standard and show example profiles rather than claim generic exclusivity.

## 30.3 Company acquisition

Initial target:

- technical startups;
- developer-tools companies;
- AI infrastructure;
- SaaS;
- robotics;
- data;
- security;
- selected larger technical teams willing to pilot.

The ideal customer has an actual hiring or project need and an identified evaluator.

## 30.4 Company pitch

Core message:

> Covenda helps companies avoid reviewing hundreds of low-signal applications. You define the work, environment, and evidence you trust. Covenda gives you a small number of students whose relevant contributions are visible and explainable.

Operational claims should be validated before use:

- time saved;
- shortlist relevance;
- interview conversion;
- onboarding burden;
- return offers.

## 30.5 Community partnerships

The proposition to a community should be:

> Covenda is building a professional evidence and simulation layer that helps emerging talent demonstrate what they can actually do. We want practitioners to help ensure the evidence and simulations reflect real work.

Communities can provide:

- talent;
- mentors;
- rubric review;
- events;
- employer relationships;
- domain expertise.

## 30.6 Hackathon strategy

Attend in person to:

- meet high-agency builders;
- observe teams;
- recruit evidence-rich students;
- meet company recruiters and engineers;
- validate assessment design;
- build community trust.

Hackathon evidence should include team role, repository, demo, organizer record, and defense. Winning is not the only signal.

## 30.7 Pilot sequence

### Phase 0: preparation

- example profiles;
- Company DNA interview;
- Talent Brief;
- privacy;
- company verification;
- manual evidence review;
- outcome form.

### Phase 1: supply

- 25-50 students;
- 15-20 evidence-rich profiles;
- technical focus;
- invitation and self-signup.

### Phase 2: demand

- 5-10 companies;
- one real need each;
- concierge onboarding.

### Phase 3: transactions

- shortlists;
- introductions;
- interviews or trials;
- outcomes.

### Phase 4: repeat

- second company request;
- company referral;
- new student cohort;
- process refinement.

## 30.8 Expansion conditions

Expand beyond Columbia only after:

- repeated company usage;
- predictable shortlist quality;
- clear student value;
- verified outcomes;
- functioning safety;
- operational evidence cost understood;
- local supply exceeds demand without dilution.

## 30.9 Messaging constraints

Do not say:

- every student is vetted;
- Covenda guarantees better hires;
- companies are partners without agreement;
- referrals are required;
- AI can detect all cheating;
- the score determines hiring;
- paid trials guarantee roles.

Use precise evidence language.

## 30.10 Metrics

- qualified profiles;
- active companies;
- Talent Briefs;
- time to shortlist;
- introduction acceptance;
- interview and trial;
- outcome completion;
- repeat company project rate;
- company referral;
- student referral;
- cost per verified outcome.


# Chapter 31: Business Model and Unit Economics

## 31.1 Principle

Revenue should align with successful relationships and recurring company value.

Student access to core profile and opportunity functions should remain free or very low cost.

## 31.2 Revenue options

### Company subscription

Includes:

- discovery;
- Company DNA;
- compatibility;
- shortlists;
- collaboration;
- assessments;
- hiring memory.

### Search or engagement fee

Fixed fee for a concierge or structured search.

### Placement or conversion fee

Charged on successful hire.

A transparent declining schedule may reduce disintermediation incentives.

### Sponsored batch

Companies fund a targeted cohort, evidence program, or simulation.

### Enterprise hiring intelligence

Larger organizations pay for:

- historical-data ingestion;
- process analytics;
- institutional memory;
- campus recruiting intelligence;
- evaluation design.

### Assessment design

Custom simulation, rubric, and validation work.

### Payment and compliance services

Where legally and operationally feasible:

- payer of record;
- contractor or payroll support;
- guarantees;
- trial funding.

### Mentorship marketplace

Optional platform fee without making opportunity access dependent on payment.

## 31.3 Pricing principles

- transparent;
- no student application fees;
- no hidden commission;
- conversion treated as success;
- no incentive to push poor-fit candidates;
- company guarantees only for on-platform transactions;
- recurring value priced separately from placement;
- early pilots may use fixed concierge pricing.

## 31.4 Unit-economic drivers

Costs:

- company acquisition;
- student acquisition;
- evidence verification;
- human review;
- AI inference;
- support;
- trial payment processing;
- disputes;
- compliance;
- integrations.

Value:

- recruiter time saved;
- founder time saved;
- reduced screening;
- reduced onboarding risk;
- better access;
- faster fill;
- repeat projects;
- hiring memory.

## 31.5 Core unit

A useful economic unit may be:

```text
One verified company talent need
-> one accepted shortlist
-> one completed evaluation
-> one recorded outcome
```

Track contribution margin at this unit before optimizing account growth.

## 31.6 Retention model

Companies remain because the system helps with:

- repeated needs;
- broader bench;
- role scoping;
- Company DNA;
- saved evidence;
- work history;
- outcome analytics;
- payment and guarantees;
- referrals;
- batches.

## 31.7 Risks

- placement-fee dependency;
- long hiring cycles;
- expensive verification;
- company willingness to bypass;
- student supply without demand;
- custom-services trap;
- legal cost;
- low-frequency company hiring;
- enterprise sales distraction.

## 31.8 Validation questions

- Will companies pay before hire?
- Which step saves measurable time?
- Is Company DNA valuable independently?
- Do companies return after hiring one person?
- What verification depth changes decisions?
- Can small companies support paid trials?
- What gross margin is possible after human review?
- Does a subscription match hiring frequency?


# Chapter 32: Metrics and Evaluation Framework

## 32.1 North star

Recommended north-star metric:

> Successful evidence-backed student-company relationships.

A relationship counts after a meaningful outcome, not merely a click or application.

Possible qualifying outcomes:

- accepted introduction plus completed interview;
- completed paid trial;
- accepted project;
- internship or role offer;
- employer-confirmed Work Record;
- repeated engagement.

## 32.2 Marketplace metrics

- active verified companies;
- active company-visible students;
- qualified supply per Talent Brief;
- time to shortlist;
- introduction acceptance;
- response time;
- evaluation completion;
- repeat company usage.

## 32.3 Student metrics

- onboarding completion;
- evidence connected;
- verification coverage;
- profile updates;
- shareable-profile use;
- company interest;
- interview;
- offer;
- satisfaction;
- mentorship;
- work records;
- retention.

## 32.4 Company metrics

- Company DNA completion;
- Talent Brief completion;
- candidate review depth;
- shortlist relevance;
- time saved;
- interview conversion;
- offer conversion;
- manager satisfaction;
- return offers;
- repeat search;
- company referral;
- outcome completion.

## 32.5 Model metrics

- retrieval precision;
- ranking quality;
- calibration;
- confidence reliability;
- explanation citation accuracy;
- unsupported inference;
- fairness invariance;
- override;
- false negative;
- drift;
- cost and latency.

## 32.6 Trust metrics

- verification disputes;
- fraud rate;
- unsafe trial flags;
- nonpayment;
- appeal rate;
- reversal;
- company impersonation;
- privacy incidents;
- accessibility complaints.

## 32.7 Development metrics

- evidence-gap closure;
- assessment reuse;
- mentor outcome;
- learning velocity evidence;
- profile freshness;
- batch completion.

## 32.8 Metric definitions

Every metric requires:

- formula;
- owner;
- data source;
- time window;
- inclusion;
- exclusion;
- interpretation;
- known bias;
- target;
- alert threshold.

## 32.9 Avoid vanity metrics

Do not prioritize:

- total profiles;
- total applications;
- total evidence cards;
- total AI recommendations;
- total invitations.

These can grow while marketplace value declines.

## 32.10 Experimentation

Experiments should test:

- profile format;
- evidence explanation;
- shortlist size;
- Company DNA onboarding;
- verification requests;
- student consent;
- assessment burden;
- recommendation ordering.

Employment outcomes require caution. Do not expose candidates to arbitrary high-stakes experimentation without safeguards.


# Chapter 33: Strategic Moats and Network Effects

## 33.1 Evidence Graph moat

Student profiles become richer through connected artifacts, verification, contribution history, and outcomes.

The moat is not raw data volume. It is structured, permissioned, longitudinal evidence with provenance.

## 33.2 Company DNA moat

Each company develops a proprietary representation of environment, preferences, assessments, and successful outcomes.

This data is company-specific and compounds with use.

## 33.3 Outcome-data moat

Applications are common. Reliable post-evaluation and post-hire outcomes are scarce.

Outcome quality depends on:

- clear definitions;
- company participation;
- manager context;
- student response;
- time;
- anti-bias controls.

## 33.4 Trust moat

Relationships among:

- students;
- professors;
- laboratories;
- mentors;
- communities;
- companies;
- evaluators;
- Work Records.

Trust is difficult to copy when it is evidence-specific and built over time.

## 33.5 Ontology moat

Covenda can build domain-specific maps connecting evidence to capabilities and company needs across:

- software;
- AI;
- robotics;
- finance;
- professional services;
- consumer operations;
- healthcare operations.

The ontology becomes valuable when validated by real outcomes.

## 33.6 Workflow moat

The platform may become embedded across:

- sourcing;
- profile review;
- Company DNA;
- introduction;
- assessment;
- trial;
- payment;
- outcome;
- future hiring.

Workflow integration creates legitimate switching cost.

## 33.7 Community moat

Trusted campus and professional communities can supply high-quality talent, reviewers, mentors, and employer access.

The partnership must provide value beyond lead generation.

## 33.8 Network effects

### Student

More evidence and outcomes improve future legibility.

### Company

More hiring cycles improve Company DNA.

### Cross-side

More trusted students attract companies; more real opportunities attract students.

### Data

More outcomes improve retrieval and recommendations.

### Trust

More verified relationships reduce uncertainty.

## 33.9 Anti-moats

The following do not create durable advantage alone:

- generic AI matching;
- job listings;
- résumé parsing;
- chatbot interface;
- generic coding test;
- public profile UI;
- unverified user volume.

## 33.10 Defensibility test

For every feature ask:

1. Does it create unique structured data?
2. Does it improve with outcomes?
3. Does it increase trust?
4. Does it embed workflow?
5. Does it improve the next decision?
6. Can a general platform copy it without the underlying graph?


# Chapter 34: Implementation Roadmap and Stage Gates

## 34.1 Principle

The long-term architecture is broad. The implementation must remain narrow.

Do not build every batch, graph feature, assessment, or enterprise analytic before proving the core transaction.

## 34.2 Phase 0: foundation

Build or confirm:

- authentication;
- student profile;
- company profile;
- evidence cards;
- privacy;
- company verification;
- Talent Brief;
- introduction approval;
- audit;
- basic administration.

Exit gate:

- complete student and company walkthroughs;
- no critical privacy or safety gaps;
- example profile understandable without founder explanation.

## 34.3 Phase 1: concierge marketplace

Operations:

- 25-50 students;
- 5-10 companies;
- manual Company DNA;
- manual shortlists;
- manual evidence review;
- introductions;
- outcomes.

Product:

- simple dashboard;
- evidence filters;
- shortlist;
- messaging after approval;
- outcome form.

Exit gate:

- at least several completed evaluations;
- companies rate shortlists as relevant;
- at least two companies request additional help;
- students find the profile independently useful.

## 34.4 Phase 2: compatibility and verification

Add:

- capability mappings;
- rules;
- evidence retrieval;
- preliminary compatibility;
- confidence;
- explanation;
- repository verification;
- endorsements;
- appeals.

Exit gate:

- explanations are accurate;
- companies use evidence;
- no severe fairness or privacy defect;
- verification cost is understood.

## 34.5 Phase 3: paid trials and Work Records

Add:

- trial terms;
- funding;
- workspace;
- submission;
- company evaluation;
- payment;
- Work Record;
- disputes.

Exit gate:

- trials are compensated;
- decisions are timely;
- disputes manageable;
- Work Records affect future decisions.

## 34.6 Phase 4: first simulations

Build one technical and one finance simulation using a shared engine:

- Software Engineering existing-codebase challenge;
- Investment Banking live-deal scenario.

Exit gate:

- shared infrastructure supports materially different workflows;
- rubrics show acceptable reliability;
- students and companies view evidence as useful;
- AI-era defense works operationally.

## 34.7 Phase 5: Software and AI batch

Add:

- AI/ML;
- Physical AI and Robotics;
- Infrastructure and Data;
- Product Engineering;
- Security and Reliability.

Build technical ontology, evidence rails, and mentor/reviewer network.

## 34.8 Phase 6: additional verticals

Order:

1. Finance;
2. Professional Services;
3. Consumer and Retail;
4. Healthcare last.

Healthcare requires privacy and safety infrastructure first.

## 34.9 Phase 7: multi-campus

Expand only after local liquidity.

Create a campus launch playbook:

- student-source partners;
- company demand;
- reviewers;
- ambassadors;
- safety;
- evidence calibration;
- local metrics.

## 34.10 Phase 8: enterprise hiring intelligence

- import historical recruiting data;
- process analytics;
- hiring memory;
- campus recruiter workflows;
- team-level Company DNA;
- enterprise security and compliance.

## 34.11 Stage-gate rules

Do not proceed because a date arrived. Proceed when evidence supports the next phase.

Every phase requires:

- product criterion;
- market criterion;
- safety criterion;
- data criterion;
- operational criterion;
- economic criterion.

## 34.12 First ninety days

### Days 1-30

- finalize V1 objects;
- design example profiles;
- build Company DNA interview;
- verify companies manually;
- recruit first students;
- recruit first companies.

### Days 31-60

- produce shortlists;
- facilitate introductions;
- record objections;
- refine evidence cards;
- launch simple compatibility explanation;
- collect outcome data.

### Days 61-90

- repeat company searches;
- add structured endorsements;
- pilot one paid trial;
- quantify company time;
- decide whether to automate verification or matching next.

## 34.13 Long-term system vision

```text
Evidence
-> capability understanding
-> Company DNA
-> compatibility
-> evaluation
-> outcome
-> institutional learning
-> better future decision
```

The central product law is:

> Every meaningful interaction should create knowledge that improves the next decision.


# Chapter 35: Vertical System: Five Batches and Twenty-Five Specializations

## 35.1 Shared framework

Covenda should support twenty-five specializations through one configurable evidence and simulation architecture, not twenty-five disconnected applications.

Every specialization must define:

1. job function;
2. representative employers;
3. junior recruiting process;
4. capability ontology;
5. evidence types;
6. verification rails;
7. assessment options;
8. AI-era weaknesses;
9. Covenda simulation;
10. objective checks;
11. human review;
12. defense questions;
13. evidence generated;
14. what evidence proves;
15. what it cannot prove;
16. company customization;
17. student personalization;
18. partners;
19. safety;
20. outcome metrics.

## 35.2 Shared object model

```yaml
specialization:
  id: infrastructure_data
  batch_id: software_ai
  capability_framework_version: 3
  domain_ontology_version: 5
  evidence_requirements: []
  external_assessments: []
  simulations: []
  defense_templates: []
  human_review_rules: []
  company_configuration_schema: {}
  student_gap_actions: []
```

## 35.3 Shared vetting rails

- machine or API verification;
- external assessment;
- uploaded artifact;
- instrumented simulation;
- structured endorsement;
- employer-confirmed Work Record;
- human review;
- hybrid rail.

Each rail states limitations.

## 35.4 Specialization catalogue

### Software and AI

1. AI and Machine Learning  
2. Physical AI and Robotics  
3. Infrastructure and Data  
4. Product Engineering  
5. Security and Reliability

### Accounting and Finance

6. Investment Banking  
7. Private Equity  
8. Venture Capital  
9. Asset and Wealth Management  
10. Accounting and Audit

### Professional Services

11. Management Consulting  
12. Strategy and Research  
13. Market Intelligence  
14. Legal Operations  
15. Technical Writing

### Consumer and Retail

16. Growth and Performance  
17. Brand and Content  
18. Merchandising  
19. Supply Chain  
20. E-commerce and Marketplace

### Healthcare Operations

21. Clinical Operations  
22. Health Analytics  
23. Revenue Cycle  
24. Regulatory and Quality  
25. Digital Health Product

## 35.5 Evidence standard

Every specialization should present company output in the same structure:

```text
What the student claims
What the student demonstrated
What was verified
How it was verified
What remains uncertain
What work the evidence supports
What work the evidence does not yet support
Recommended next evaluation
```

## 35.6 Admission standard

Batch admission is a requirements checklist.

Example:

```text
Requirement: one domain-relevant artifact
Status: satisfied

Requirement: ownership defense
Status: satisfied

Requirement: one external or human validation
Status: missing

Action:
Request an observer endorsement or complete a Covenda-reviewed simulation.
```

## 35.7 Research standard

Before implementation, researchers must use public and primary information where available and label assumptions.

Never invent proprietary employer processes or claim partnership.

## 35.8 Generalization test

The first two simulations should be deliberately different:

- Software Engineering: existing codebase, debugging, implementation, scale change.
- Investment Banking: financial model, transaction context, incoming information, prioritization, communication.

If the same engine cannot support both without extensive hardcoding, the abstraction is incomplete.


# Chapter 36: Software and AI Vertical

## 36.1 Vertical thesis

The Software and AI profile should represent technical depth, technical breadth, agency, builder history, collaboration, AI use, verification, and gaps.

It should not rank engineers with one score.

## 36.2 Evidence ontology

### Code and systems

- repository;
- commit;
- pull request;
- issue;
- architecture document;
- deployment;
- monitoring;
- testing;
- security review;
- package;
- open-source contribution.

### Building and shipping

- product launch;
- active users;
- demo;
- customer feedback;
- app-store listing;
- production incident;
- iteration history.

### Research

- paper;
- experiment;
- model;
- dataset;
- benchmark;
- evaluation;
- replication;
- poster.

### Community

- hackathon;
- club;
- open source;
- technical writing;
- conference;
- mentorship.

## 36.3 Technical depth

Measure:

- conceptual complexity;
- architecture;
- difficult debugging;
- performance;
- reliability;
- security;
- scale;
- first-principles explanation;
- production tradeoffs.

## 36.4 Technical breadth

Represent demonstrated domains:

- frontend;
- backend;
- mobile;
- infrastructure;
- databases;
- AI/ML;
- data;
- security;
- embedded systems;
- robotics;
- developer tools;
- product engineering.

Breadth requires evidence, not tool badges.

## 36.5 High agency

Signals:

- independent projects;
- products;
- hackathons;
- open source;
- self-directed learning;
- customer discovery;
- maintenance;
- proactive issue identification;
- adaptation.

## 36.6 Hackathons

Hackathon evidence may include:

- organizer verification;
- public submission;
- repository;
- demo;
- team confirmation;
- candidate defense;
- role;
- time limit;
- follow-up maintenance.

Winning is not required. A non-winning project may show stronger ownership or technical depth.

## 36.7 Open source

Evaluate:

- issue selection;
- contribution difficulty;
- code review;
- maintainer response;
- sustained activity;
- community conduct;
- independent understanding.

Do not count stars or commits as quality alone.

## 36.8 AI engineering

Evidence should distinguish:

- calling an API;
- building retrieval or agent workflows;
- evaluation;
- model training;
- inference;
- data pipeline;
- safety;
- observability;
- product integration;
- architecture;
- cost and latency reasoning.

Defense prompts:

- Why this model?
- How did you evaluate?
- Which failure modes matter?
- What did the model generate incorrectly?
- How would cost change at scale?
- What data risks exist?
- Which component did you personally implement?

## 36.9 Polymath builder simulation

```text
Problem introduced
-> clarify
-> choose approach
-> learn unfamiliar technology
-> prototype
-> test
-> debug
-> explain tradeoffs
-> requirements change
-> adapt
-> defend
```

Possible changes:

- traffic increases 100x;
- data becomes sensitive;
- latency requirement tightens;
- user changes;
- dependency fails;
- budget drops;
- offline mode required.

## 36.10 Specialization focus

### AI and ML

- data quality;
- experimentation;
- evaluation;
- model behavior;
- inference;
- AI product judgment.

### Physical AI and Robotics

- controls;
- perception;
- planning;
- simulation;
- hardware;
- sim-to-real;
- safety.

### Infrastructure and Data

- distributed systems;
- databases;
- networking;
- cloud;
- reliability;
- observability;
- data pipelines.

### Product Engineering

- unfamiliar codebase;
- shipping;
- frontend and backend;
- user feedback;
- iteration;
- product judgment.

### Security and Reliability

- threat modeling;
- secure coding;
- incident analysis;
- testing;
- reliability;
- operational discipline.

## 36.11 Company customization

Company A, AI startup:

- Python;
- ML;
- rapid prototyping;
- product;
- agency.

Company B, infrastructure:

- distributed systems;
- Linux;
- networking;
- reliability;
- systems thinking.

Company C, SaaS:

- full stack;
- shipping;
- customer feedback;
- breadth.

The student profile should explain fit and gaps for each.

## 36.12 Backend fields

- evidence_type;
- technical_domain;
- skill;
- skill_depth;
- skill_breadth;
- agency_signal;
- ownership_level;
- verification_level;
- project_status;
- deployment_status;
- collaboration_signal;
- hackathon_metadata;
- open_source_metadata;
- AI_assistance_disclosure;
- defense_result.

Use reusable evidence objects.

## 36.13 Company dashboard

```text
Technical breadth
Technical depth
Agency
Builder history
AI engineering
Collaboration
Verification
Current gaps
Recommended next evidence
```

## 36.14 First implementation

Build Product Engineering or Infrastructure as the first reference workflow, then test the shared engine with Investment Banking.


# Chapter 37: Accounting and Finance Vertical

## 37.1 Vertical thesis

Finance evidence should measure process, sourcing, assumptions, judgment, risk, and communication.

A polished spreadsheet is not sufficient. The system must understand the driver tree, formulas, sources, sensitivity, and candidate defense.

## 37.2 Evidence types

- financial model;
- valuation;
- investment memo;
- stock pitch;
- market map;
- due-diligence report;
- portfolio construction;
- audit workpaper;
- accounting analysis;
- presentation;
- transaction case;
- research methodology;
- source list.

Do not accept material nonpublic information, client records, or confidential deal information.

## 37.3 Investment Banking

Capabilities:

- accounting;
- valuation;
- transaction mechanics;
- modeling;
- attention to detail;
- prioritization;
- communication;
- deadline management.

Simulation:

```text
Deal context
-> financials
-> model
-> management update
-> senior request
-> changed assumption
-> error diagnosis
-> recommendation
-> defense
```

Evidence:

- formulas;
- assumptions;
- sources;
- outputs;
- error log;
- written communication;
- defense.

## 37.4 Private Equity

Capabilities:

- LBO;
- downside analysis;
- diligence;
- industry;
- risk;
- investment judgment;
- value creation.

Do not reward only high projected returns.

Simulation should introduce adverse information and require the candidate to revise thesis and model.

## 37.5 Venture Capital

Capabilities:

- market reasoning;
- founder and product judgment;
- uncertainty;
- research;
- thesis;
- sourcing;
- decision clarity.

Avoid pretending there is one correct answer. Use human review and evidence of reasoning.

## 37.6 Asset and Wealth Management

Capabilities:

- suitability;
- portfolio construction;
- risk;
- diversification;
- drawdown;
- research;
- communication;
- fiduciary reasoning.

Simulation:

```text
Client profile
-> risk framework
-> allocation
-> market shock
-> rebalance decision
-> explanation
```

Maximum return is not the objective.

## 37.7 Accounting and Audit

Capabilities:

- financial statements;
- controls;
- reconciliation;
- anomaly detection;
- documentation;
- skepticism;
- process discipline.

Use synthetic or authorized data.

## 37.8 Workbook verification

A parser may examine:

- formulas;
- hardcodes;
- links;
- assumptions;
- circularity;
- sensitivity;
- error cells;
- source notes;
- structure.

It cannot prove investment judgment or authorship without defense.

## 37.9 AI-era authenticity

Require:

- source provenance;
- assumption defense;
- formula modification;
- changed scenario;
- error diagnosis;
- explanation of AI use;
- ability to rebuild a section.

## 37.10 Company output

```text
Demonstrated:
- three-statement model construction
- DCF assumptions and sensitivity
- transaction prioritization

Verified:
- workbook structure parsed
- candidate defended formulas
- human reviewer confirmed baseline accuracy

Uncertain:
- live transaction experience
- performance under actual client pressure
```


# Chapter 38: Professional Services Vertical

## 38.1 Vertical thesis

Professional Services requires structured thinking, research quality, synthesis, communication, provenance, and defensibility.

AI can produce polished documents. The system must probe method and judgment.

## 38.2 Management Consulting

Capabilities:

- clarification;
- structure;
- hypothesis;
- quantitative analysis;
- prioritization;
- synthesis;
- recommendation;
- communication.

Simulation should resemble a structured case with published criteria.

Evidence should include issue tree, analysis, assumptions, synthesis, and defense.

## 38.3 Strategy and Research

Capabilities:

- question formation;
- source quality;
- methodology;
- synthesis;
- uncertainty;
- recommendation;
- writing.

Require source provenance and ability to revise when evidence changes.

## 38.4 Market Intelligence

Capabilities:

- market definition;
- segmentation;
- competitor research;
- source validation;
- sizing;
- trend analysis;
- decision relevance.

Avoid false precision in market sizing.

## 38.5 Legal Operations

Capabilities:

- workflow;
- documentation;
- issue identification;
- process design;
- vendor and matter operations;
- risk awareness.

The system must not ask students to provide legal advice or confidential client records.

## 38.6 Technical Writing

Capabilities:

- audience understanding;
- accuracy;
- structure;
- examples;
- source use;
- revision;
- clarity;
- technical understanding.

Authorship is a major risk. Use source history, defense, and revision.

## 38.7 Simulation pattern

```text
Ambiguous client question
-> clarify objective
-> structure research
-> assess sources
-> produce analysis
-> new contradictory evidence
-> revise
-> present recommendation
-> defend limitations
```

## 38.8 Human review

Professional judgment cannot be reduced to automatic correctness.

Use anchored rubrics and at least one domain reviewer for high-stakes admission.

## 38.9 Output

```text
Strengths:
- clear problem structure
- strong source provenance
- concise synthesis
- transparent limitations

Gaps:
- limited quantitative sensitivity analysis
- no observed client communication

Next evidence:
Recorded case defense or employer-confirmed research Work Record
```


# Chapter 39: Consumer and Retail Vertical

## 39.1 Vertical thesis

Consumer and Retail roles require decisions under imperfect data, customer understanding, experimentation, forecasting, margin reasoning, and creative judgment.

Self-reported campaign results are difficult to verify. Instrumented challenges or authorized data may be necessary.

## 39.2 Growth and Performance

Capabilities:

- funnel analysis;
- experimentation;
- attribution;
- creative testing;
- unit economics;
- budget discipline;
- measurement;
- iteration.

A small sandbox or synthetic campaign can generate evidence.

Do not reward vanity metrics.

## 39.3 Brand and Content

Capabilities:

- audience;
- positioning;
- brief interpretation;
- creative judgment;
- consistency;
- iteration;
- performance interpretation.

AI can generate attractive content. Evaluate choices, reasoning, and revision.

## 39.4 Merchandising

Capabilities:

- assortment;
- pricing;
- demand;
- inventory;
- margin;
- seasonality;
- customer;
- tradeoffs.

Simulation may require assortment choice under budget and space constraints.

## 39.5 Supply Chain

Capabilities:

- forecasting;
- capacity;
- lead time;
- inventory;
- disruption;
- service level;
- cost;
- operational response.

Scenario should introduce supplier failure or demand shock.

## 39.6 E-commerce and Marketplace

Capabilities:

- conversion;
- marketplace dynamics;
- pricing;
- seller or customer behavior;
- merchandising;
- experiment design;
- operations.

Use instrumented or synthetic data where production access is unavailable.

## 39.7 Evidence

- campaign analysis;
- experiment plan;
- creative brief;
- assortment model;
- forecast;
- inventory decision;
- marketplace analysis;
- dashboard;
- postmortem;
- presentation.

## 39.8 Verification limits

A screenshot of performance does not prove causation or ownership.

Require:

- source;
- date;
- role;
- methodology;
- budget;
- baseline;
- confounders;
- observer;
- defense.

## 39.9 Output

```text
Demonstrated:
- experiment design
- conversion analysis
- budget tradeoffs

Uncertain:
- access to live campaign execution
- attribution quality

Recommended:
Instrumented growth simulation with changed budget and audience
```


# Chapter 40: Healthcare Operations Vertical

## 40.1 Risk classification

Healthcare Operations should be implemented last.

Risks include:

- protected health information;
- patient safety;
- regulatory interpretation;
- professional licensure;
- sensitive data;
- false confidence;
- domain-specific harm.

Human review is essential.

## 40.2 PHI intake gate

Before upload:

- explicit prohibition;
- identifier checklist;
- synthetic-data preference;
- redaction guidance;
- consent;
- automated scan;
- human review path;
- deletion and incident process.

Prohibited examples include names, medical-record numbers, dates of birth, addresses, Social Security numbers, account identifiers, biometric identifiers, and full-face photographs where protected.

Do not depend solely on automated detection.

## 40.3 Clinical Operations

Capabilities:

- protocol workflow;
- site operations;
- documentation;
- scheduling;
- issue escalation;
- process discipline.

Do not simulate clinical judgment reserved for licensed professionals.

## 40.4 Health Analytics

Capabilities:

- data quality;
- cohort definition;
- statistics;
- bias;
- interpretation;
- privacy;
- communication.

Use synthetic or properly de-identified data.

## 40.5 Revenue Cycle

Capabilities:

- workflow;
- coding process awareness;
- claims;
- denial analysis;
- documentation;
- operations;
- compliance.

Avoid real patient records.

## 40.6 Regulatory and Quality

Capabilities:

- documentation;
- traceability;
- deviation;
- corrective action;
- risk;
- process;
- quality systems.

Human reviewers with relevant expertise are required.

## 40.7 Digital Health Product

Capabilities:

- product;
- workflow;
- privacy;
- safety;
- user needs;
- interoperability;
- experimentation;
- communication.

Simulations should include clinical-user and patient-safety constraints without asking candidates to make medical decisions.

## 40.8 Evidence

- synthetic analysis;
- process map;
- quality case;
- product brief;
- risk assessment;
- documentation exercise;
- supervisor attestation;
- non-sensitive Work Record.

## 40.9 Claims

Never claim that a Covenda assessment establishes clinical competence, licensure, or legal compliance.

Output example:

```text
Demonstrated:
- operational workflow analysis
- synthetic health-data quality checks
- privacy-aware product reasoning

Not demonstrated:
- clinical judgment
- independent regulatory authority
- work with live patient records
```

## 40.10 Stage gate

Healthcare launches only after:

- privacy counsel;
- PHI controls;
- domain reviewers;
- incident process;
- synthetic datasets;
- company safety requirements;
- explicit limitation language;
- tested human-review workflow.


# Chapter 41: User Experience and Design System

## 41.1 Design objective

Covenda should feel like a technical professional system rather than a social network or generic job board.

The interface should communicate:

- evidence;
- state;
- uncertainty;
- action;
- provenance;
- privacy;
- progress.

Avoid oversized marketing headers, decorative AI gradients, empty analytics cards, and dense unstructured forms.

## 41.2 Visual principles

- compact information hierarchy;
- readable typography;
- restrained color;
- clear status labels;
- evidence-first cards;
- progressive disclosure;
- consistent tables;
- explicit next actions;
- strong accessibility;
- no gamified popularity.

## 41.3 Information hierarchy

Every evaluation screen should follow:

```text
Decision context
-> summary
-> evidence
-> limitations
-> next action
-> audit and history
```

## 41.4 Status language

Use precise labels:

- self-reported;
- source linked;
- contribution confirmed;
- understanding demonstrated;
- outcome verified;
- disputed;
- stale;
- private;
- company-visible.

Avoid ambiguous labels such as "AI verified" or "top talent."

## 41.5 Student profile layout

Recommended sections:

```text
Header
Professional focus
Availability and preferences
Evidence graph
Featured evidence
Domain map
Builder history
Work records
Endorsements
Compatibility
Current gaps
Recommended next evidence
Privacy controls
```

## 41.6 Company candidate layout

```text
Candidate summary
Compatibility band and confidence
Hard constraints
Strongest alignment
Relevant evidence
Contribution and verification
Potential gaps
Environment fit
Recommended evaluation
Team notes
Introduction action
Audit
```

## 41.7 Company onboarding layout

Do not begin with a generic job-posting form.

Flow:

```text
Company verification
-> what work exists
-> environment
-> success examples
-> evidence trusted
-> capability priorities
-> supervision
-> role terms
-> Company DNA preview
-> candidate preview
```

## 41.8 Batch cards

Batch cards should be large enough to explain:

- domain;
- target students;
- companies or sample company types;
- evidence required;
- time;
- application;
- status;
- capacity;
- outcomes.

Use "Learn more" and place the application in the logged-in portal.

## 41.9 Accessibility

- WCAG-aligned contrast;
- keyboard operation;
- semantic headings;
- focus state;
- screen-reader status;
- captions;
- text alternatives;
- reduced motion;
- accessible graphs;
- non-color status cues;
- mobile support;
- save and resume.

## 41.10 Design tokens

Recommended categories:

- typography scale;
- spacing;
- radius;
- border;
- elevation;
- status semantic colors;
- data visualization;
- motion;
- breakpoints.

Exact values belong in the design-system repository.

## 41.11 Error design

Errors should state:

- what happened;
- what was preserved;
- what the user can do;
- who acts next;
- support path.

Avoid "Something went wrong" when a specific state is known.

## 41.12 Empty states

Every empty state should teach or direct.

Example:

```text
No verified evidence yet.

Add one project, research item, Work Record, or structured endorsement. Covenda will show what the source can verify before you connect it.
```

## 41.13 Design review checklist

- Is the score overemphasized?
- Can evidence be traced?
- Is uncertainty visible?
- Is the next action clear?
- Are privacy settings understandable?
- Is a referral mistaken for endorsement?
- Can the flow be completed without video?
- Is the company verified?
- Is compensation visible?
- Is the screen usable with keyboard and screen reader?


# Chapter 42: Research, Vendor, and Partnership Framework

## 42.1 Purpose

Covenda should research existing infrastructure before building.

Research is a systems architecture function, not a list of competitors.

## 42.2 Required provider categories

- coding assessment;
- work samples;
- simulation;
- skills testing;
- structured interviews;
- identity verification;
- scheduling;
- video;
- payments;
- payroll;
- ATS;
- proctoring;
- file scanning;
- education verification;
- research identity.

## 42.3 Comparison dimensions

| Dimension | Question |
|---|---|
| Realism | Does the candidate perform job-like work? |
| Validity | Does it measure the intended capability? |
| Reliability | Are results consistent? |
| AI resistance | Can AI complete it without candidate understanding? |
| Authorship | Can contribution be evaluated? |
| Scalability | Can the system support volume? |
| Cost | What is full operating cost? |
| API | Are structured results available? |
| Webhooks | Can completion events be received? |
| Integration | Can it fit Covenda workflows? |
| Evidence depth | Is there evidence beyond a final score? |
| Student UX | Is burden reasonable? |
| Employer trust | Is the output understandable? |
| Domain fit | Does it fit the specialization? |
| Lock-in | Can Covenda switch providers? |
| Differentiation | Does use strengthen Covenda's unique layer? |
| Privacy | How is candidate data used and retained? |
| Accessibility | Are accommodations supported? |

## 42.4 Decision categories

### Build

When the capability is core, proprietary data matters, or no mature provider exists.

### Buy or integrate

When infrastructure is commodity and mature.

### Partner or embed

When provider expertise and distribution are strategic.

### Human rail

When judgment is the actual competency or automation is unsafe.

### Do not build

When the feature adds burden without improving evidence or outcomes.

## 42.5 Research output

For each component:

- user need;
- current Covenda system;
- provider options;
- official integration evidence;
- pricing, where available;
- data access;
- limitations;
- decision;
- fallback;
- implementation plan;
- review date.

## 42.6 Partnership categories

For each vertical:

1. assessment technology;
2. professional community;
3. employer;
4. industry expert.

## 42.7 Partnership proposition

Do not ask only for student referrals.

Offer:

- professional evidence infrastructure;
- realistic simulations;
- community visibility;
- employer access;
- rubric development;
- talent development;
- outcome data;
- mentor opportunities.

## 42.8 Partnership truth standard

Never describe an organization as:

- partner;
- backed by;
- integrated;
- verified by;
- hiring through Covenda;

unless the relationship is documented and current.

## 42.9 Review cycle

Vendor and partnership decisions should be revisited because:

- APIs change;
- pricing changes;
- privacy terms change;
- vendor quality changes;
- Covenda scale changes;
- internal strategic value changes.


# Chapter 43: Decision Ledger

## 43.1 Established decisions

| Area | Decision |
|---|---|
| Product | Evidence-backed talent intelligence, not a generic job board |
| Student identity | Evidence Graph rather than résumé-only profile |
| Company model | Company DNA rather than job description alone |
| Matching | Company- and role-specific compatibility |
| Scores | Explainable components and confidence; no universal rank |
| Admission | Published requirements checklist |
| Referrals | Optional; invitations separate from endorsements |
| Access | Open participation; earned visibility and credentials |
| AI | Assume use; test understanding and adaptation |
| Verification | Multiple rails with explicit limitations |
| High agency | Emergent from ownership, learning, execution, ambiguity, curiosity |
| Initial customer | Technical startups and small teams with real needs |
| Initial campus | Columbia |
| Trials | Paid, shortlisted, controlled, not open speculative work |
| Work records | Contextual employer-confirmed outcomes |
| Assessments | Integrate commodity infrastructure; own interpretation layer |
| Batches | Later, after recurring demand; five batches and 25 specializations |
| Healthcare | Last due to privacy and safety |
| Architecture | Modular monolith first; graph concepts can begin relationally |
| Human role | Final authority in high-stakes decisions and appeals |
| Design | Compact, evidence-first, accessible, no AI fluff |

## 43.2 Hypotheses requiring validation

- Companies will invest time in a Company DNA interview.
- Evidence Graphs materially change shortlist decisions.
- Small technical companies will pay for evidence-backed student discovery.
- Students will maintain profiles without immediate company demand.
- A Covenda Builder credential can become respected.
- Paid trials can be run safely and economically.
- Compatibility explanations improve student and company trust.
- Outcome data can be collected consistently.
- Columbia can provide enough local density.
- The 5-75 employee target is the strongest initial segment.
- The same simulation engine can support software and finance.
- Company hiring memory creates independent subscription value.

## 43.3 Deferred decisions

- exact database graph technology;
- exact public credential names;
- final score display;
- assessment vendors;
- payroll provider;
- placement versus subscription pricing;
- enterprise contract terms;
- multi-campus expansion order;
- university integrations;
- healthcare launch scope;
- public API;
- social features;
- mobile application.

## 43.4 Prohibited shortcuts

- infer capability from school prestige;
- claim universal talent quality;
- call all profiles vetted;
- use referral as access gate;
- show a company without approval in a way implying participation;
- start trials before company approval and payment;
- allow open direct messages;
- require video;
- publish a leaderboard;
- hide score weights while using them for admission;
- treat AI detection as authorship proof;
- replace human review with language-model confidence.


# Chapter 44: Terminal and Agent Operating Protocol

## 44.1 Purpose

This bundle is designed to be loaded into terminal-based AI agents, coding agents, and research agents.

Use the Markdown or plain-text prompt packet for terminal tools. Use the PDF for human reading, review, or attachment to systems that accept PDF context.

## 44.2 Agent startup sequence

1. Read `00_START_HERE.md`.
2. Read `MASTER_SPEC.md`.
3. Read the relevant chapter files.
4. Inspect the actual Covenda repository.
5. Read existing architecture files before proposing changes.
6. State which requirements are already implemented.
7. State conflicts, unknowns, and assumptions.
8. Produce an implementation plan.
9. Make the smallest coherent change.
10. Add tests and documentation.
11. Report exactly what changed and what remains.

## 44.3 Core repository files to inspect

Where present:

- `api/batches.js`;
- `api/connectors.js`;
- `api/hardening.js`;
- `api/xlsx-parse.js`;
- `docs/PROOF_CONNECTORS.md`;
- `docs/MODEL_CARD.md`;
- `docs/COMPATIBILITY_ENGINE_MASTER.md`.

Do not rebuild these systems without explaining their limitation.

## 44.4 Prompt format

A task prompt should include:

```text
Objective
Current system
Relevant blueprint chapters
Files to inspect
Non-negotiable requirements
Acceptance criteria
Tests
Deliverables
Out of scope
```

## 44.5 Coding-agent rule

The agent must not begin by generating a new architecture from memory.

It must inspect existing code and map:

```text
Existing abstraction
-> requirement
-> gap
-> change
-> migration
-> test
```

## 44.6 Research-agent rule

Research agents must:

- use current primary or official sources;
- label assumptions;
- separate public employer process from speculation;
- compare build, buy, partner, and human rail;
- avoid claiming partnerships;
- document integration and privacy limits;
- deliver actionable architecture, not generic summaries.

## 44.7 Design-agent rule

Design agents must:

- use evidence-first hierarchy;
- include states, permissions, errors, accessibility, and responsive behavior;
- show what each screen allows;
- avoid marketing filler;
- generate implementation-ready component and data requirements.

## 44.8 Review-agent rule

Review agents should test:

- contradiction with decisions;
- missing evidence provenance;
- hidden ranking;
- fairness;
- privacy;
- unpaid labor;
- verification overclaim;
- missing state;
- missing audit;
- overbuilt V1;
- code duplication.

## 44.9 Output standard

Every agent response should include:

1. summary;
2. files inspected;
3. decision mapping;
4. implementation;
5. tests;
6. limitations;
7. next required action.

## 44.10 Command-line use

The included script builds a single prompt packet:

```bash
./scripts/assemble_context.sh
```

Then pipe or paste the packet into the AI terminal tool used by the operator.

Generic pattern:

```bash
cat PROMPT_PACKET.txt | YOUR_AI_CLI
```

Because AI terminal tools differ, the bundle uses a placeholder rather than assuming one vendor command.



\clearpage

# Appendix F: Requirements Index

The chapter files in `chapters/` are the modular source of truth for terminal and coding-agent use. Requirement IDs are intentionally repeated in their relevant chapters rather than centralized into a fragile separate spreadsheet.

Core requirement families:

- DP: design principles
- CF: capability framework
- VR: verification
- CD: Company DNA
- HI: hiring intelligence
- SO: student onboarding
- CO: company platform
- AI: AI governance
- API: API architecture
- SEC: security and privacy

\clearpage

# Appendix G: Terminal Prompt Packet

The ZIP bundle includes:

- `00_START_HERE.md`
- `MASTER_SPEC.md`
- `PROMPT_PACKET.txt`
- `prompts/TERMINAL_MASTER_PROMPT.md`
- `prompts/CODING_AGENT_PROMPT.md`
- `prompts/RESEARCH_AGENT_PROMPT.md`
- `prompts/PRODUCT_DESIGN_AGENT_PROMPT.md`
- `prompts/CRITIQUE_AGENT_PROMPT.md`
- `scripts/assemble_context.sh`

Use the Markdown or text packet for terminal agents. Use this PDF for human review or systems that accept document attachments.


\clearpage

# Appendix A: Prior Future-AI Context Transfer

> Source appendix. Included to preserve prior Covenda material. The integrated blueprint above controls when source drafts conflict.

## Covenda  -  Future Ai Context Transfer
DOCUMENT
Comprehensive product, strategy, positioning, vetting, personalization, partnership, and architectural context developed in the current
conversation.

Purpose: Give a future AI system enough context to understand the current state of Covenda and continue
product strategy, research, writing, architecture, and outreach without forcing Tyler to reconstruct the
conversation.

Important: This is a living context document. Some concepts are established decisions; others are hypotheses or areas
requiring validation. Do not treat every idea as final without checking the current product and codebase.

## 1. EXECUTIVE SUMMARY
Covenda is a platform designed to improve how undergraduate and early-career talent is discovered, understood, vetted,
personalized, and connected with companies and opportunities. The core problem is that the early-career talent market
is fragmented: students struggle to find relevant and effective opportunities, while companies struggle to identify capable
candidates beyond résumés, school names, generic applications, and existing networks.

Covenda is NOT merely a project marketplace, internship board, or referral network. Paid projects and trials are one
mechanism within a broader talent infrastructure platform. The larger vision includes personalized student profiles,
personalized company portals, compatibility analysis, batch-based talent communities, structured vetting, evidence
verification, optional referrals and endorsements, professional development, opportunity matching, and company-side
talent discovery.

The central product shift is from a résumé-centric system to an evidence-centric system. Covenda should help answer:
What can this person actually do? What do they want to do? What evidence supports that? How was it verified? What
work are they compatible with? What remains uncertain? How can a company evaluate them efficiently and fairly?

Covenda should not build another generic coding test, generic internship board, or generic ATS simply for the sake of
having one. It should take the best ideas and infrastructure from existing companies and frameworks while owning the
layers that create Covenda-specific value: compatibility, evidence aggregation, personalization, verification,
ownership/authorship defense, batch admission, and company-readable talent intelligence.

## 2. THE PROBLEM COVENDA IS ADDRESSING
The founder's problem is not simply a shortage of applicants. The deeper issue is that early-career talent is difficult to
evaluate because candidates have limited formal experience, résumés are noisy, traditional signals can be biased or
incomplete, and companies often lack the time to discover what a student can actually do.

The student's problem is not simply a shortage of jobs. Students face a fragmented opportunity ecosystem where
internships can be limited, highly competitive, poorly matched, geographically constrained, or ineffective at
demonstrating their real capabilities. Platforms such as Handshake provide valuable distribution, but they do not
necessarily solve personalized capability discovery and evidence-based matching.

Tyler's own experience with the internship market - including difficulty finding effective opportunities through existing
channels and limited availability of strong opportunities in competitive markets such as New York - is part of Covenda's
motivation. This should be communicated as a personal observation and market problem, not as an overly narrow attack
on one platform.

Core problem: The early-career talent market does not adequately connect what a student can actually do,
what they want to do, and what a company actually needs. Covenda is designed to make that connection
more personalized, evidence-based, and actionable.

## 3. WHAT COVENDA IS  -  AND IS NOT
Covenda IS: a talent discovery and matching platform; a personalized professional profile system; an evidence and
verification layer; a compatibility engine; a structured vetting system organized around professional batches and
specializations; a platform where referrals and endorsements can strengthen profiles without being mandatory; a
company-side talent intelligence system; and a mechanism for companies to evaluate emerging talent through relevant
evidence and, when appropriate, paid practical work.

Covenda IS NOT: solely a project marketplace; solely a startup internship board; a referral-only network; a résumé
database with a matching score added on top; a generic assessment company; or a system where students need
prestigious schools or existing connections to participate.

4. CORE ACCESS PRINCIPLE: ANYONE CAN PARTICIPATE
Anyone should be able to participate. A student does not need a referral to join Covenda or apply for
opportunities.

Referrals and endorsements are optional evidence layers. They can improve personalization and trust when someone
has genuinely observed the student's work, but they should not become a gatekeeping mechanism.

The ideal profile becomes richer over time: student self-profile -> interests -> skills -> projects -> work history ->
assessments -> Covenda vetting -> referrals/endorsements -> paid work -> accepted deliverables -> company feedback
-> verified professional evidence.

A student without a referral can still build a strong profile through demonstrated capabilities, work, assessments, projects,
and outcomes. A student with a credible referral can add context that may otherwise be difficult for a company to
discover.

The referral is therefore a personalization and evidence enhancement mechanism, not an access credential.

5. REFERRALS VS. ENDORSEMENTS
Invitation: Someone thinks a person may benefit from knowing about Covenda. This is a network-growth mechanism
and should not be treated as capability evidence.

Endorsement: Someone directly observed a candidate's work and can attest to a specific capability, behavior, or
experience. This can strengthen the profile.

Strong endorsements should be specific and contextual rather than generic statements such as 'great person' or 'very
smart.' They should answer: What did you observe? In what context? What did the person actually do? For what type of
work would you recommend them? How directly did you observe it?

Potential endorsers include professors, research supervisors, managers, previous employers, project leads, club
leaders, peers, or others who directly worked with the candidate.

Referrals should complement, not replace, Covenda's own vetting. A company that has never heard of the referring
organization should still understand the signal because Covenda contextualizes it.

## 6. PERSONALIZATION IS CENTRAL
Student and company portals should feel meaningfully different for each user rather than functioning as static
dashboards.

Student personalization should include: professional interests; desired industries; role types; company stages;
geography; remote/in-person preferences; skills and confidence; demonstrated capabilities; projects; work history;
learning goals; availability; batch participation; compatibility; referrals and endorsements; verified work history; gaps; and
recommended next actions.

Company personalization should include: company needs; open roles; project needs; required skills; working
preferences; company stage; industry; team structure; candidate compatibility; relevant evidence; vetting status;
referral/endorsement context; prior interactions; recommended candidates; recommended batches; and talent pools the
company may not have discovered through traditional channels.

## 7. COMPANY PORTAL VISION
The company portal should be more than an applicant tracking system. It should help a company understand talent.

Instead of: Candidate: Tyler Park; School: Columbia University; Major: Financial Engineering; Resume:
PDF

Show: Interested in AI, finance, and early-stage companies. Demonstrated experience in financial analysis
and technical projects. Relevant evidence includes financial modeling, technical work, and structured
assessments. Compatibility is high for the company's current needs. Verified signals include Covenda
assessment, work evidence, and optional endorsements. Remaining uncertainty is limited direct transaction
experience. Recommended work includes financial analysis, research, modeling, and technical/analytical
projects.

The objective is not to reduce a candidate to a score. The objective is to make the candidate understandable.

## 8. STUDENT PORTAL VISION
The student portal should feel like a personalized career operating system rather than a list of job postings.

Students should see who they are professionally, what they are good at, what they have demonstrated, what
opportunities align with them, which paths are compatible with their interests and capabilities, which requirements they
satisfy, which requirements they are missing, exactly how to close those gaps, which referrals or endorsements would
strengthen their profile, what assessments they can complete, what evidence they can add, what paid opportunities they
can pursue, and how their profile becomes stronger over time.

A failed requirement should never simply say 'Rejected.' It should explain the specific gap and provide an actionable
route to improve.

9. COMPATIBILITY VS. ADMISSION
Covenda already has a compatibility/scoring mechanism that evaluates how appropriate or compatible a path, batch,
opportunity, or career direction is for a student.

Compatibility asks: Is this path a good fit for this person based on interests, preferences, capabilities, evidence, and
goals?

Admission asks: Has this person satisfied the published requirements for entry into this batch or opportunity?

These must remain conceptually distinct. A student may be highly compatible with a field but not yet satisfy its
requirements. The correct response is a personalized gap analysis, not simple rejection. Conversely, a student may
satisfy technical requirements but have low compatibility with a particular path.

Compatibility should be explainable. Companies should understand why a candidate is recommended, not merely see a
black-box percentage.

## 10. BATCH MODEL
Covenda organizes talent into professional batches and specializations. The current catalogue consists of five batches
and 25 specializations:

Software & AI: AI/ML; Physical AI & Robotics; Infrastructure & Data; Product Engineering; Security & Reliability.

Accounting & Finance: Investment Banking; Private Equity; Venture Capital; Asset & Wealth Management; Accounting
& Audit.

Professional Services: Management Consulting; Strategy & Research; Market Intelligence; Legal Operations;
Technical Writing.

Consumer & Retail: Growth & Performance; Brand & Content; Merchandising; Supply Chain; E-commerce &
Marketplace.

Healthcare Operations: Clinical Operations; Health Analytics; Revenue Cycle; Regulatory & Quality; Digital Health
Product.

Batch requirements should be published as requirements checklists. Do not expose hidden scorer weights or create
public cross-student leaderboards. A miss should generate a specific, actionable gap. The engine drafts; a human
operator makes the final admission decision with a mandatory rationale.

## 11. VETTING PHILOSOPHY
The core principle is: Admission is a published REQUIREMENTS CHECKLIST, never a person-score.

A miss is never simply a rejection. It should tell the student what is missing and how to close the gap.

The system must never invent verification. Where an API cannot prove something, route it to a human process and state
the limitation plainly.

Assume every candidate has access to a frontier LLM. Any task an AI can complete alone is not sufficient as a filter.
Design for defensible process rather than AI detection.

No protected attributes or proxies should be used, including school prestige and name. Fairness-invariance tests should
be able to identify whether proxies change outcomes.

## 12. EXISTING COVENDA INFRASTRUCTURE TO PRESERVE
Future AI systems should first understand and extend the current codebase rather than rebuild it. Important files include:
`api/batches.js` for the admission engine, REQ descriptors, VETTING_RAILS, and specializations; `api/connectors.js`
and `docs/PROOF_CONNECTORS.md` for machine verification; `api/hardening.js` for dual-rater anchored rubrics,
adjudication, inter-rater reliability, and ownership defense; `api/xlsx-parse.js` for financial workbook parsing;
`docs/MODEL_CARD.md`; and `docs/COMPATIBILITY_ENGINE_MASTER.md`.

## 13. VETTING RAILS
Covenda should use a hybrid architecture: machine/API verification; external assessment providers; uploaded artifacts;
instrumented trials; human review; and hybrid combinations.

No rail should claim more than it can establish. For example, a GitHub commit history can establish that a repository
changed over time but cannot prove that the candidate authored every line. A financial model parser can establish
formula structure but cannot prove investment judgment. A referral can establish that someone observed a candidate but
not that the candidate is universally excellent.

## 14. UNIVERSAL VETTING TEMPLATE
Every specialization should document: 1) the bar and why it matters; 2) exactly what the candidate submits; 3) evidence
source; 4) machine verification; 5) machine limitations; 6) anchored 4/6/9 rubric; 7) candidate-specific defense questions;
8) follow-ups exposing non-authorship; 9) failure modes caught; 10) failure modes not caught; 11) requirement set using
existing REQ.* descriptors; and 12) justification for any new requirements.

## 15. SOFTWARE & AI
Specializations: AI/ML, Physical AI & Robotics, Infrastructure & Data, Product Engineering, Security & Reliability.

Current conceptual bar: ownership + history (60-90 days) + skills (2) + defense + hours (6-8).

Research should compare CodeSignal, HackerRank, Codility, GitHub evidence, portfolio evidence, code review, system
design, and practical work samples.

Ownership defense should be generated from the candidate's own commits and decisions. A student who gradually
pastes AI-generated code into a repository is a real edge case: ownership verification does not prove authorship.
Mitigation should combine process history, defense, perturbation, and the ability to modify the work.

Product Engineering should emphasize working inside an unfamiliar existing codebase. Physical AI should investigate
simulation-to-real failure, robotics environments, controls, perception, hardware constraints, and sim-to-real reasoning.

## 16. ACCOUNTING & FINANCE
Specializations: Investment Banking, Private Equity, Venture Capital, Asset & Wealth Management, Accounting & Audit.

Current conceptual bar: artifact (1) + skills (1-2) + defense + hours (6-8).

Research actual bank and fund processes: timed modeling tests, LBO builds, stock pitches, superdays, financial
statement tests, and case interviews.

A defensible financial model is not merely a pretty spreadsheet. It should demonstrate driver trees, assumptions,
sourcing, sensitivity analysis, formulas, and logical structure.

Venture Capital should test judgment under uncertainty. Asset & Wealth Management should not reward maximum
simulated returns; evaluate risk discipline, diversification, drawdowns, suitability, investment process, and order-trail
behavior.

The Alpaca connector is gated pending terms review. No design should depend on it shipping.

## 17. PROFESSIONAL SERVICES

Specializations: Management Consulting, Strategy & Research, Market Intelligence, Legal Operations, Technical
Writing.

Current conceptual bar: artifact (1) + defense + skills (1) + hours (5-6). Legal Operations also requires referral.

Management Consulting should resemble a structured case: clarify, structure, hypothesize, analyze, synthesize,
recommend. Use a recorded structured case and published evaluation criteria.

Strategy & Research and Technical Writing have a major authorship problem. Probe source provenance, method,
decision-making, and the ability to defend and modify the work.

Legal Operations should assess workflows, documentation, issue identification, and operational judgment rather than
legal advice.

## 18. CONSUMER & RETAIL
Specializations: Growth & Performance, Brand & Content, Merchandising, Supply Chain, E-commerce & Marketplace.

Growth & Performance and E-commerce & Marketplace require instrumented challenges because self-reported
campaign numbers are difficult to verify.

The minimum viable trial may use a small fixed budget, sandbox, or synthetic dataset. Clearly state what the cheap
version cannot prove.

Brand & Content should evaluate creative judgment, audience, positioning, brief interpretation, and iteration - not simply
whether AI can generate an attractive artifact.

Merchandising and Supply Chain should use forecasting, assortment, pricing, inventory, margin, capacity, and
operational tradeoff exercises.

## 19. HEALTHCARE OPERATIONS
Specializations: Clinical Operations, Health Analytics, Revenue Cycle, Regulatory & Quality, Digital Health Product.

This is the highest-risk vertical and should be implemented last.

The system is explicitly a human rail because no API should be assumed to verify professional process work.

Before healthcare rubrics, build a PHI intake gate. Structurally discourage and prohibit uploads containing names,
medical record numbers, dates of birth, addresses, Social Security numbers, health-plan information, account numbers,
biometric identifiers, full-face photographs, and other protected identifiers.

Prefer synthetic datasets. Do not rely on automated detection to catch every PHI violation.

For real experience, use structured supervisor/PI references rather than asking students to upload real patient data.
Research HIPAA Safe Harbor and Expert Determination carefully.

## 20. DO NOT REINVENT THE WHEEL
A major strategic conclusion is that Covenda should not build every assessment engine internally.

Research and compare Litmus Hiring, HackerRank, CodeSignal, Codility, Vervoe, TestGorilla, Mercer | Mettl, SHL,
HireVue, and other relevant providers.

Evaluate each on realism, validity, reliability, AI resistance, authorship, scalability, cost, API availability, webhooks,
integration, embedding, white-label capability, evidence depth, student UX, employer trust, domain fit, vendor lock-in,

and impact on Covenda differentiation.

Every component should be classified as BUILD, BUY/INTEGRATE, PARTNER/EMBED, or HUMAN RAIL.

Build what is strategically unique. Buy commodity infrastructure. Partner where another provider already has strong
infrastructure. Use human review where judgment is the actual competency.

## 21. LITMUS AS A MODEL
Litmus Hiring is relevant because the underlying work-sample philosophy aligns with Covenda: evaluate candidates
through work resembling what they would actually perform.

Covenda should study, not clone, this model. The key lesson is that realistic work can provide stronger signal than
generic résumé screening.

Covenda's differentiation is connecting practical evaluation to a broader evidence graph, compatibility engine,
personalized profile, batch admission, optional referral context, and company talent discovery.

## 22. TAKE THE BEST FROM HANDSHAKE, LINKEDIN, WELLFOUND,
## And Litmus
From Handshake: opportunity distribution, student career profiles, employer relationships, university/community context.

From LinkedIn: professional identity, skills, network, endorsements, experience history, professional graph.

From Wellfound: startup-specific discovery, startup talent/company context, early-stage ecosystem positioning.

From Litmus and practical assessment providers: realistic work-sample evaluation.

From technical assessment providers: structured technical evidence and automated evaluation.

From Covenda: compatibility, evidence aggregation, batch-specific vetting, candidate-specific defense, optional referrals,
personalized gap remediation, and company-facing explanations of why a candidate is relevant.

The goal is not to copy interfaces. It is to combine the strongest underlying workflows into a coherent talent system.

## 23. EVIDENCE GRAPH
A central architectural concept is an evidence graph rather than a flat score.

Every evidence item should ideally include: Evidence ID; Candidate ID; Source; Source Type; Timestamp; Claim;
Verification Level; Verification Method; Assessment; Result; Human Review; Confidence; Expiration.

Example: Financial Model -> Source: uploaded XLSX -> Verification: workbook parser -> Additional
evidence: defense -> Human review: two raters -> Status: Verified -> Proves: candidate can construct and
explain a basic financial model -> Does not prove: candidate can execute live transactions under real
deadlines.

Do not store only `student.financial_model_score = 87`. Store the evidence and provenance behind the claim.

## 24. COMPANY-FACING OUTPUT
Compatibility: High
Demonstrated capability: Strong

Evidence: Financial model verified; valuation analysis defended; accounting fundamentals assessed
Verification: External assessment + work sample + ownership defense + human review
Strengths: Financial modeling, valuation, analytical reasoning
Remaining uncertainty: Limited transaction experience
Recommended work: Financial modeling, company research, valuation analysis
Less validated for: Live transaction execution

The company should understand why the candidate is recommended rather than relying on a black-box score.

## 25. STUDENT-FACING OUTPUT
Investment Banking Batch

Requirement 1  -  Accounting fundamentals: Complete
Requirement 2  -  Financial modeling: Missing
How to satisfy: Complete Covenda Financial Modeling Assessment
Requirement 3  -  Demonstrated ownership: Pending
Requirement 4  -  Defense: Complete

This creates a developmental experience. The student knows exactly what to do next.

## 26. PAID TRIALS ARE IMPORTANT  -  BUT DO NOT DEFINE COVENDA
Paid trials are an important mechanism, not the entire company.

Covenda helps companies discover and evaluate talent through multiple mechanisms. When a company has concrete
work that needs to be done, a paid trial can be powerful because the company sees actual work and the student gains
paid experience.

The broader flow is: Profile -> Compatibility -> Evidence -> Vetting -> Application -> Optional referral/endorsement ->
Company evaluation -> Paid trial when appropriate -> Accepted deliverable -> Verified experience.

Companies should be able to use Covenda without creating a project. They may use it to discover talent, search by
capability, review profiles, identify compatible candidates, or recruit from verified batches.

Students should also be able to build strong profiles without completing a Covenda project.

## 27. CURRENT COMPANY PITCH
Hi [Name]  -  I'm building Covenda, a platform focused on helping undergraduate and early-career talent
build more personalized, credible professional profiles and connecting them with companies and
opportunities that are actually aligned with their skills, interests, and experience. We're building tools
around talent discovery, compatibility, vetting, referrals, and real-world opportunities to make it easier for
both companies and emerging talent to find the right fit.

The strongest pitch emphasizes the broader platform rather than describing Covenda as simply a project marketplace.

## 28. COMMUNITY OUTREACH PITCH

Hi John!

I just missed the Luma event yesterday, but I'm looking forward to making it out to more in the future! I'm
Tyler, a rising sophomore and new builder interested in getting involved with the SF engineering
community.

I'm building Covenda, a platform addressing the limited and often ineffective internship opportunities I
experienced firsthand through platforms like Handshake, particularly in New York. We help undergraduate
and early-career talent build more personalized, credible profiles and connect with companies and
opportunities aligned with their skills, interests, and experience.

Given your work with Code & Coffee and relationships across engineering teams and startups, I thought
there could be an interesting overlap. I'd love to hear how you're currently helping members find
opportunities and explore whether there's a way we could work together.

## 29. CODE & COFFEE PARTNERSHIP OPPORTUNITY
The person discussed is a National Executive Advisor and Organizer for Code & Coffee, a developer community
spanning 40+ cities and reaching approximately 75,000+ software engineers, AI practitioners, cloud professionals,
cybersecurity specialists, and technology leaders.

Potential value to Covenda: access to technical talent communities; relationships with engineering teams and developer
advocates; founder and startup relationships; company introductions; credibility in Software & AI; and potential
community distribution.

Potential value to Code & Coffee: more tangible career outcomes for members; a pathway from learning/networking to
demonstrated work and opportunities; differentiated member value; company-sponsored challenges; a structured way to
surface talent; and potentially help finding people for Code & Coffee's own needs.

Recommendation: take the call. Treat it as partnership discovery, not a sales call. Do not immediately ask them to send
students.

The framing should be: Code & Coffee provides a community and network of talented people; Covenda provides
infrastructure for personalization, verification, compatibility, and access to relevant opportunities.

Useful questions: How many members are undergraduates or recent graduates? How does Code & Coffee currently help
members find opportunities? Are there direct relationships with startups hiring technical talent? How does it work with
companies and sponsors? Would it consider referring members? Would it co-host a technical challenge or event? Could
it introduce Covenda to startups needing technical talent?

## 30. FUTURE PRODUCT ARCHITECTURE
Student side: Student -> Covenda Profile -> Compatibility Engine -> Existing Evidence -> External
Assessment -> Covenda Practical Assessment where necessary -> Ownership/Defense -> Human Review
-> Batch Admission -> Company-Facing Talent Profile

Company side: Company -> Company Profile -> Needs/Preferences -> Role or Opportunity -> Required
Capabilities -> Compatibility Search -> Evidence Review -> Candidate Shortlist -> Optional Paid Trial ->
Feedback -> Talent Relationship

The key is to maintain a persistent relationship between a student's evolving evidence and a company's evolving needs.

## 31. COVENDA'S PROPOSED MOAT
Covenda's moat should not be a single assessment.

The moat should be the combination of compatibility, demonstrated capability, verified evidence, ownership/authorship
defense, human validation, referral context, personalized student profiles, personalized company profiles, historical work
evidence, batch-specific standards, company-readable explanations, and a growing evidence graph.

Borrow the best infrastructure. Borrow the best assessment methodologies. Borrow the best hiring
frameworks. Do not blindly copy any one company. Do not rebuild commodity infrastructure. Own the
evidence layer. Own the verification layer. Own the compatibility layer. Own the candidate's verified
professional profile. Own the connection between demonstrated capability and actual company work.

## 32. KEY STRATEGIC PRINCIPLES FOR FUTURE AI
1. Never pigeonhole Covenda as only a project-based company.
2. Never imply that referrals are required.
3. Treat referrals as optional profile enhancement and evidence.
4. Keep participation open.
5. Make personalization central to both portals.
6. Do not reduce talent to one score.
7. Explain recommendations.
8. Separate compatibility from admission.
9. Make vetting requirements-based and developmental.
10. Never invent verification.
11. Use existing platforms where they already solve commodity infrastructure.
12. Build only what creates strategic value.
13. Assume AI is ubiquitous and design for defensibility rather than AI detection.
14. Treat accepted work as evidence, not merely a transaction.
15. Make evidence provenance understandable.
16. Keep humans in the loop for final high-stakes admission.
17. Avoid protected attributes and prestige proxies.
18. Treat healthcare as high-risk and privacy-sensitive.
19. Make the student experience help people improve.
20. Make the company experience help employers understand talent.

## 33. RECOMMENDED NEXT STEPS
1. Complete deep research for all 25 specialization vetting systems, five batches at a time.
2. Build a third-party assessment platform matrix using official API/integration documentation.
3. Complete Build-vs-Buy-vs-Partner decisions.
4. Design the unified evidence graph and verification levels.
5. Expand the company portal around personalized talent intelligence rather than a job board.
6. Expand the student portal around personalized career development and evidence accumulation.
7. Make referrals and endorsements optional and clearly distinguish invitations from evidence-bearing endorsements.
8. Keep compatibility and admission separate.
9. Validate Software & AI first because the technical community ecosystem may offer early distribution and partnerships.

10. Use company conversations to determine whether companies value Covenda primarily for discovery, vetting,
personalization, paid trials, or the combination.
11. Pilot before overbuilding all 25 specializations.
12. Measure which evidence types actually improve company confidence and hiring outcomes.

## 34. ONE-PARAGRAPH COVENDA DESCRIPTION
Covenda is a talent discovery and verification platform built to make the early-career hiring market more
personalized, evidence-based, and effective. Students can join and apply without needing an existing
connection, while building professional profiles around their interests, capabilities, experience, and
demonstrated work; referrals and endorsements from people who have directly observed them can add
trusted context and strengthen those profiles. Companies can use Covenda to discover and evaluate
emerging talent based on compatibility, verified evidence, structured vetting, and, when appropriate, real
paid work - not simply résumés or existing networks. Covenda's broader vision is to become the
infrastructure that connects what a person can do, what they want to do, and what a company actually
needs, while giving both sides a clearer, more personalized understanding of fit.

## 35. FINAL NORTH STAR
Covenda should replace the question 'Who do you know?' with a richer set of questions: 'What can you do?
What do you want to do? What evidence supports that? Who has actually seen you do it? How was it
verified? What are you compatible with? And what work could you meaningfully contribute to next?'

The product should make the answers to those questions increasingly clear over time.

COMPATIBILITY + DEMONSTRATED CAPABILITY + VERIFIED EVIDENCE + OWNERSHIP +
DEFENSIBLE PERFORMANCE + HUMAN VALIDATION + CONTEXT = COVENDA VERIFIED TALENT
PROFILE


\clearpage

# Appendix B: Comprehensive Batch Vetting Research Architecture

> Source appendix. Included to preserve prior Covenda material. The integrated blueprint above controls when source drafts conflict.

# Covenda  -  Comprehensive Batch Vetting Research, Architecture & Implementation Specification

## Mission

Design the complete, production-ready application, evidence, verification, assessment, defense, and admission system for every specialization in Covenda's batch catalogue.

This system is one of Covenda's most important credibility mechanisms.

The purpose of this project is NOT simply to create 25 application forms.

The purpose is to determine:

> What evidence should a student provide before Covenda can credibly say that this student belongs in a particular professional batch?

And, more importantly:

> How can Covenda determine this using the strongest existing assessment, hiring, credentialing, work-sample, and verification frameworks already available in the market - without unnecessarily rebuilding infrastructure that established companies have already spent years developing?

Covenda should not attempt to reinvent:

- Coding assessment engines
- Browser-based IDEs
- Technical test execution
- Automated code grading
- Financial modeling software
- Generic skills assessments
- Psychometric testing
- Video interview infrastructure
- Structured interview scheduling
- Candidate proctoring
- ATS functionality
- Assessment delivery infrastructure
- Identity verification
- Generic job simulations

unless research proves that an existing solution is insufficient for Covenda's specific purpose.

Instead, Covenda should study the best existing frameworks, combine the strongest elements, and own the layer that is uniquely valuable to Covenda:

> Compatibility + evidence provenance + multi-source verification + practical demonstration + ownership defense + human adjudication + batch admission + company-facing talent intelligence.

The research agent must treat this as a systems architecture and product research project, not merely a content-writing exercise.

---

# PART I  -  EXISTING COVENDA SYSTEM

Before doing any research or changing code, read and understand:

- `api/batches.js`
- `api/connectors.js`
- `docs/PROOF_CONNECTORS.md`
- `api/hardening.js`
- `api/xlsx-parse.js`
- `docs/MODEL_CARD.md`
- `docs/COMPATIBILITY_ENGINE_MASTER.md`

Understand:

1. Existing batch definitions.
2. Existing specializations.
3. Existing `REQ.*` descriptors.
4. Existing `VETTING_RAILS`.
5. Existing machine-verification connectors.
6. Existing limitations.
7. Existing human-review workflows.
8. Existing dual-rater rubrics.
9. Existing adjudication process.
10. Existing inter-rater reliability calculations.
11. Existing ownership-defense questions.
12. Existing compatibility scoring.

DO NOT rebuild any existing functionality simply because it is easier to describe a new system.

Extend the system.

Reuse existing abstractions wherever possible.

If an existing abstraction is insufficient, explain exactly why before changing it.

---

# PART II  -  THE CENTRAL DESIGN PRINCIPLE

## Covenda is not an assessment company in the traditional sense.

Covenda is a talent verification and matching platform.

Therefore:

> Covenda does not need to own every test.

Covenda needs to own the interpretation and evidence layer that sits above the tests.

The system should be thought of as:

```text
Student
|
v
Covenda Profile
|
+--> Compatibility Engine
|
+--> Existing Evidence
|      |
|      +--> GitHub
|      +--> Portfolio
|      +--> Financial Models
|      +--> Research
|      +--> Writing
|      +--> Academic Projects
|      +--> Work Experience
|
+--> Third-Party Assessment
|      |
|      +--> Coding Assessment
|      +--> Skills Assessment
|      +--> Job Simulation
|      +--> Financial Assessment
|
+--> Covenda-Specific Practical Assessment
|
+--> Ownership / Authorship Defense
|
+--> Human Review
|
v
Verified Capability Profile
|
v
Batch Admission
|
v
Company-Facing Talent Profile
```

The research must determine which parts of this stack Covenda should:

- Build
- Buy
- Integrate
- Partner
- Operate manually
- Leave entirely to the candidate's existing evidence

---

# PART III  -  DO NOT REINVENT THE WHEEL

This is a mandatory research step.

Before designing a new assessment, investigate whether an existing company or framework already solves some or all of the problem.

The research agent must NOT simply design a proprietary Covenda assessment because it is theoretically possible to build one.

For every assessment component, answer:

> Does an existing platform already do this well?

> Can Covenda integrate with it?

> Can Covenda retrieve structured results?

> Can Covenda retrieve candidate-level evidence rather than only a final score?

> Can the assessment be embedded or linked into the Covenda experience?

> Can Covenda maintain candidate identity and provenance?

> Can the provider support APIs, webhooks, or partner integrations?

> Does the provider's assessment actually measure the capability Covenda cares about?

> Is the provider's methodology appropriate for undergraduate talent?

> Does the provider remain useful in an AI-saturated environment?

> Would integrating this provider create vendor lock-in?

> Would Covenda lose strategic differentiation by relying on this provider?

---

# PART IV  -  FRAMEWORKS TO RESEARCH AND COMPARE

This research is mandatory. Do NOT assume any one provider is the answer.

The objective is to extract the best elements from each.

## A. Litmus Hiring / Practical Work-Sample Model

Research:

- How Litmus approaches practical candidate evaluation.
- How work samples differ from resumes.
- How real-world tasks are structured.
- How candidate output is evaluated.
- How practical simulations are used.
- How companies use evidence rather than self-reported claims.
- Whether API/integration capabilities exist.
- Whether Litmus can be integrated into Covenda.
- Whether Litmus is better used as a conceptual model, a technology provider, or both.

Extract the underlying principle:

> Evaluate candidates by having them perform work resembling the work they would actually perform.

Determine where this should be used in Covenda.

---

## B. HackerRank

Research:

- Coding assessments.
- Technical skill testing.
- Role-based assessments.
- Real-world/project-style evaluations.
- Anti-cheating mechanisms.
- AI-era assessment methodology.
- Candidate reports.
- API capabilities.
- Integration capabilities.

Determine:

- What HackerRank is excellent at.
- What it is weak at.
- Which Covenda batches could use it.
- Whether it is better than building internally.

---

## C. CodeSignal

Research:

- Certified assessments.
- Standardized technical scoring.
- Coding environments.
- Assessment reliability.
- Role-based technical evaluation.
- API/integration options.
- Candidate results.

Determine whether CodeSignal should be used for:

- AI/ML
- Product Engineering
- Infrastructure
- Security
- Data

Compare it against HackerRank and Codility.

---

## D. Codility

Research:

- Technical assessments.
- Tests.
- Sessions.
- Candidate invitations.
- Results APIs.
- Skills Intelligence.
- Technical reporting.

Determine whether Codility's existing infrastructure can become a Covenda technical assessment rail rather than Covenda building its own coding test engine.

---

## E. Vervoe

Research Vervoe specifically as a job-simulation model.

Investigate:

- Work simulations.
- Immersive question types.
- Technical skills.
- Finance skills.
- Excel.
- Communication.
- Soft skills.
- Role-specific simulations.
- API capabilities.
- Enterprise/partner integrations.

Determine whether Vervoe is potentially useful across multiple Covenda verticals rather than only technology.

Research whether Vervoe could provide infrastructure for:

- Finance
- Marketing
- Operations
- Professional services
- Administrative work
- Business analysis

The research should distinguish between:

> Vervoe's generic simulation capabilities

and:

> Covenda's need for industry-specific verification.

---

## F. TestGorilla

Research:

- Modular assessments.
- Skills tests.
- Custom questions.
- Coding tests.
- Personality tests.
- Candidate results.
- Anti-cheating features.
- API.
- ATS integrations.

Determine whether Covenda could use TestGorilla as a standardized lower-cost assessment rail for less specialized requirements.

For example:

- Excel
- SQL
- Communication
- Business fundamentals
- Basic data analysis

Do not use generic tests where a real work sample would be materially better.

---

## G. Mercer | Mettl

Research:

- Pre-built assessments.
- Custom assessments.
- Assessment APIs.
- Scheduling.
- Candidate workflows.
- Enterprise scale.
- Proctoring.
- Skills testing.

Determine whether Mettl could be useful for high-volume standardized assessment.

---

## H. SHL

Research:

- Occupational assessments.
- Situational judgment.
- Ability tests.
- Personality assessments.
- Job analysis.
- Validation methodology.

Determine:

- What is scientifically useful.
- What is appropriate for Covenda.
- What should NOT be incorporated.

Do not automatically add personality testing merely because it is commercially available.

---

## I. HireVue and structured interview infrastructure

Research:

- Video interviewing.
- Structured interviews.
- Interview guides.
- Interview scoring.
- Assessment integration.

Determine whether Covenda needs video interviewing infrastructure or whether a simpler native defense system is better.

---

## J. Real employer frameworks

Research how actual companies vet candidates.

For each vertical, research at least 5-10 real employers.

Examples:

### Software
- Google
- Microsoft
- Meta
- Amazon
- Stripe
- OpenAI
- Anthropic
- Palantir

### Investment Banking
- Goldman Sachs
- JPMorgan
- Morgan Stanley
- Evercore
- Lazard
- Centerview
- Moelis

### Consulting
- McKinsey
- BCG
- Bain
- Deloitte
- Accenture

### Private Equity
- Blackstone
- KKR
- Apollo
- TPG
- Carlyle

### Venture Capital
Research prominent venture firms and their analyst/associate processes.

### Healthcare
Research major health systems, payers, and digital-health companies.

Do not copy these companies' processes.

Instead, identify:

> What underlying competency are they actually trying to measure?

Example:

```text
Goldman Sachs Superday
|
v
Underlying competency
|
+--> Technical finance
+--> Communication
+--> Judgment
+--> Team interaction
+--> Motivation
```

Covenda should assess the underlying competency using the most efficient credible mechanism available.

---

# PART V  -  FRAMEWORK COMPARISON METHODOLOGY

Create a formal comparison matrix.

For every platform/framework, classify:

| Dimension | Questions |
|---|---|
| Realism | Does the candidate perform actual job-like work? |
| Validity | Is there evidence the assessment measures the intended capability? |
| Reliability | Would repeated assessment produce consistent results? |
| AI resistance | Can a frontier LLM complete it without candidate understanding? |
| Authorship | Can Covenda determine who actually did the work? |
| Scalability | Can thousands of students complete it? |
| Cost | What does it cost to operate? |
| API | Can results be programmatically retrieved? |
| Webhooks | Can Covenda receive completion events? |
| Integration | Can it connect to Covenda? |
| Embedding | Can it feel native? |
| White-label | Can the candidate experience be branded? |
| Evidence depth | Does it provide only a score or detailed evidence? |
| Student UX | Is the experience reasonable for undergraduates? |
| Company trust | Would an employer understand and trust the signal? |
| Domain fit | Is it appropriate for this batch? |
| Vendor dependence | How dangerous is lock-in? |
| Covenda differentiation | Does integration strengthen or weaken Covenda's moat? |

Do not reduce the entire decision to a single numerical score.

Provide qualitative analysis.

---

# PART VI  -  BUILD VS. BUY VS. PARTNER FRAMEWORK

Every component must be classified.

## BUILD

Build internally when:

- It is central to Covenda's differentiation.
- No mature provider exists.
- Covenda needs proprietary evidence.
- The data generated is strategically important.

Examples may include:

- Compatibility engine.
- Evidence graph.
- Batch admission logic.
- Candidate provenance.
- Defense question generation.
- Cross-source evidence synthesis.
- Company-facing talent profile.

---

## BUY / INTEGRATE

Use an existing provider when:

- The problem is already solved.
- The provider has mature infrastructure.
- Building it adds little differentiation.

Examples may include:

- Coding execution.
- Automated test grading.
- Standardized skills testing.
- Proctoring.

---

## PARTNER / EMBED

Use partnerships when:

- The provider can embed into Covenda.
- API access is available.
- Results can flow into the Covenda evidence graph.

---

## HUMAN RAIL

Use humans when:

- Machine verification is insufficient.
- Judgment is the actual competency.
- Stakes are high.

---

# PART VII  -  COVENDA'S UNIQUE LAYER

The research must explicitly define what Covenda owns.

The core hypothesis to test is:

> Covenda's moat is not "we built another coding test."

> Covenda's moat is "we aggregate, verify, contextualize, and explain evidence of student capability across multiple sources and connect that evidence to actual company needs."

For example:

```text
Student
|
+-- GitHub evidence
|
+-- CodeSignal assessment
|
+-- Covenda practical task
|
+-- Ownership defense
|
+-- Human review
|
+-- Compatibility
|
v
Covenda Verified Profile
```

The company should see:

> Why this student is relevant

> What they have actually demonstrated

> How the evidence was verified

> What they can do

> What they cannot yet demonstrate

> What type of work they are ready for

This is more valuable than simply showing:

> "Technical Score: 87."

---

# PART VIII  -  AI-ERA ASSESSMENT DESIGN

Assume every student has access to:

- ChatGPT
- Claude
- Gemini
- Cursor
- Copilot
- Other frontier AI

Therefore:

## Do not rely on:

- Generic coding questions.
- Generic essays.
- Generic take-home assignments.
- Generic multiple-choice questions.
- Resume claims.
- AI detection tools alone.

Instead, combine:

### 1. Practical task

Student performs relevant work.

### 2. Process evidence

Capture, where appropriate:

- Iterations
- Revisions
- Commits
- Time
- Decision history
- Intermediate outputs

### 3. Defense

Candidate explains:

- Why they chose an approach.
- What alternatives they considered.
- What failed.
- What they would change.

### 4. Perturbation

Change the problem.

Ask:

> "Now modify your solution under this new constraint."

This is particularly important for:

- Coding
- Finance
- Consulting
- Analytics

### 5. Ownership verification

Test whether the candidate can actually manipulate or reason about their submission.

---

# PART IX  -  AI-ASSISTED WORK VS. AI-GENERATED WORK

Do not assume AI assistance is cheating.

The modern workplace itself uses AI.

Covenda should distinguish:

### Level 1

Candidate cannot explain the work.

### Level 2

Candidate can explain the work but cannot modify it.

### Level 3

Candidate used AI but understands and can modify the work.

### Level 4

Candidate independently makes strong decisions and uses AI as a productivity tool.

The objective is to identify Level 3 and Level 4 candidates.

---

# PART X  -  UNIVERSAL COVENDA VETTING STACK

Every specialization should use the following architecture where appropriate.

## Stage 1  -  Eligibility

Verify:

- Identity
- Enrollment
- Graduation
- Availability
- Basic prerequisites

---

## Stage 2  -  Compatibility

Use the existing Covenda compatibility system.

Answers:

> Is this work appropriate for this student?

---

## Stage 3  -  Existing Evidence

Analyze:

- GitHub
- Portfolio
- Projects
- Models
- Research
- Writing
- Work history

---

## Stage 4  -  External Assessment

Where appropriate, use:

- CodeSignal
- Codility
- HackerRank
- Vervoe
- TestGorilla
- Mettl
- Other appropriate provider

---

## Stage 5  -  Covenda-Specific Practical Assessment

Only build this if:

1. No existing platform adequately measures the capability.
2. The capability is core to Covenda's differentiation.
3. The assessment generates unique evidence.

---

## Stage 6  -  Ownership Defense

Generate questions from:

- Actual submission.
- Actual repository.
- Actual financial model.
- Actual research.
- Actual decisions.

---

## Stage 7  -  Human Review

Use:

- Dual raters.
- Anchored rubrics.
- Adjudication.

---

## Stage 8  -  Admission

Human operator decides.

---

# PART XI  -  25 SPECIALIZATIONS

## BATCH 1  -  SOFTWARE & AI

1. AI & Machine Learning
2. Physical AI & Robotics
3. Infrastructure & Data
4. Product Engineering
5. Security & Reliability

## BATCH 2  -  ACCOUNTING & FINANCE

6. Investment Banking
7. Private Equity
8. Venture Capital
9. Asset & Wealth Management
10. Accounting & Audit

## BATCH 3  -  PROFESSIONAL SERVICES

11. Management Consulting
12. Strategy & Research
13. Market Intelligence
14. Legal Operations
15. Technical Writing

## BATCH 4  -  CONSUMER & RETAIL

16. Growth & Performance
17. Brand & Content
18. Merchandising & Assortment
19. Supply Chain & Operations
20. E-commerce & Marketplace

## BATCH 5  -  HEALTHCARE OPERATIONS

21. Clinical Operations
22. Health Data & Analytics
23. Payer & Revenue Cycle
24. Regulatory & Quality
25. Digital Health Product

---

# PART XII  -  SPECIALIZATION OUTPUT TEMPLATE

For every specialization, produce:

## 1. What the batch actually screens for

One clear paragraph.

---

## 2. Real-world hiring benchmark

Research:

- 5-10 employers.
- Actual job descriptions.
- Actual recruiting processes.
- Actual assessments.

Identify the underlying competencies.

---

## 3. Existing assessment ecosystem

Research platforms that already assess this capability.

Compare only relevant providers, including where applicable:

- Litmus
- HackerRank
- CodeSignal
- Codility
- Vervoe
- TestGorilla
- Mettl
- SHL
- HireVue
- Other relevant providers

---

## 4. Build / Buy / Partner / Human recommendation

Provide a clear decision.

---

## 5. Requirement map

Map to existing:

`REQ.*`

Only add new requirements if necessary.

Explain why.

---

## 6. Submission

Specify exactly what the student provides.

Possible sources:

- API
- Connected account
- Uploaded artifact
- External assessment
- Instrumented trial
- Human referral

---

## 7. Machine verification

Specify:

- What is automatically verified.
- How it is verified.
- What cannot be verified.

---

## 8. Practical assessment

Design the smallest assessment that meaningfully measures the capability.

Do not make assessments unnecessarily long.

The objective is:

> Maximum signal per unit of candidate effort.

---

## 9. Existing platform integration

If a third-party provider is recommended, specify:

- Provider.
- Assessment.
- Integration method.
- Candidate flow.
- Result flow.
- Covenda database representation.
- What Covenda stores.
- What Covenda does not store.

---

## 10. Covenda proprietary layer

Explain what Covenda adds beyond the third-party provider.

---

## 11. AI resistance

Explain how the process remains credible when AI is available.

---

## 12. Ownership defense

Create:

- 2 primary questions.
- 2 follow-up questions.
- 1 perturbation question.

All must be based on the candidate's actual submission.

---

## 13. Anchored rubric

### 4  -  Minimum acceptable

### 6  -  Strong

### 9  -  Exceptional

Use observable behaviors.

---

## 14. Failure modes caught

List explicitly.

---

## 15. Failure modes not caught

State residual uncertainty.

---

## 16. Student feedback

If unsuccessful:

- Requirement missing.
- Evidence insufficient.
- Exact improvement.
- Next action.

---

# PART XIII  -  SPECIALIZATION-SPECIFIC RESEARCH

## SOFTWARE & AI

### AI & Machine Learning

Compare:

- CodeSignal
- HackerRank
- Kaggle-style evidence
- GitHub
- ML project evaluation

Evaluate:

- Data handling
- Modeling
- Evaluation
- Reproducibility
- ML judgment

---

### Physical AI & Robotics

Research:

- Robotics simulations.
- ROS.
- Gazebo.
- Isaac Sim.
- Real-world robotics projects.

Evaluate:

- Perception.
- Controls.
- Hardware.
- Simulation.
- Sim-to-real reasoning.

---

### Infrastructure & Data

Evaluate:

- SQL
- Data modeling
- Pipelines
- Debugging
- Reliability

Use practical pipeline tasks rather than algorithmic coding alone.

---

### Product Engineering

Prioritize:

> Working inside an unfamiliar existing codebase.

Evaluate:

- Debugging.
- Feature implementation.
- Tests.
- PR quality.
- Code review.

---

### Security & Reliability

Evaluate:

- Threat modeling.
- Vulnerability identification.
- Incident response.
- Reliability.

Use realistic scenarios rather than trivia.

---

# ACCOUNTING & FINANCE

## Investment Banking

Research:

- Timed modeling tests.
- Financial statements.
- Valuation.
- M&A.
- Pitchbooks.
- Superdays.

Evaluate:

- Accounting.
- Modeling.
- Valuation.
- Transaction reasoning.
- Communication.

---

## Private Equity

Evaluate:

- LBO.
- Investment thesis.
- Diligence.
- Downside.
- Returns.

Do not confuse:

> "Can build an LBO"

with:

> "Can make an investment decision."

Test both.

---

## Venture Capital

Evaluate:

- Market judgment.
- Founder assessment.
- Product.
- Competition.
- Thesis construction.

Use ambiguous cases.

The student should make decisions with incomplete information.

---

## Asset & Wealth Management

Do not reward maximum simulated returns.

Evaluate:

- Risk.
- Suitability.
- Drawdowns.
- Diversification.
- Discipline.
- Investment process.

---

## Accounting & Audit

Evaluate:

- Reconciliation.
- Controls.
- Financial statement accuracy.
- Audit reasoning.
- Documentation.

---

# PROFESSIONAL SERVICES

## Management Consulting

Research:

- McKinsey.
- BCG.
- Bain.
- Case interview methodologies.

The assessment should replicate the actual cognitive process:

1. Clarify.
2. Structure.
3. Hypothesize.
4. Analyze.
5. Synthesize.
6. Recommend.

Use a recorded structured case.

---

## Strategy & Research

Focus on:

- Research methodology.
- Source quality.
- Synthesis.
- Citation.
- Original reasoning.

Authorship defense is essential.

---

## Market Intelligence

Evaluate:

- Market sizing.
- Competitive intelligence.
- Data interpretation.
- Source validation.

---

## Legal Operations

Do not assess legal advice.

Evaluate:

- Process.
- Contract workflows.
- Documentation.
- Issue identification.
- Operational judgment.

---

## Technical Writing

Evaluate:

- Accuracy.
- Audience awareness.
- Information architecture.
- Documentation quality.

The final artifact alone is insufficient.

Require defense of:

- Audience.
- Structure.
- Terminology.
- Tradeoffs.

---

# CONSUMER & RETAIL

## Growth & Performance

Use instrumented experiments where feasible.

Research:

- Marketing platforms.
- Analytics platforms.
- Growth simulations.

Evaluate:

- Funnel analysis.
- Experiment design.
- Attribution.
- Unit economics.

---

## Brand & Content

Do not simply evaluate the final creative.

Evaluate:

- Brief interpretation.
- Audience.
- Positioning.
- Creative reasoning.
- Iteration.

---

## Merchandising & Assortment

Evaluate:

- Pricing.
- Assortment.
- Margin.
- Inventory.
- Category strategy.

---

## Supply Chain & Operations

Evaluate:

- Forecasting.
- Inventory.
- Capacity.
- Lead times.
- Operational tradeoffs.

---

## E-commerce & Marketplace

Evaluate:

- Conversion.
- Listings.
- Marketplace dynamics.
- Unit economics.
- Seller/buyer behavior.

---

# HEALTHCARE

Healthcare is the highest-risk vertical.

Before creating any assessment:

Research:

- HIPAA.
- HHS.
- Safe Harbor.
- Expert Determination.
- PHI handling.

## PHI intake gate

The platform must make it structurally difficult for students to upload PHI.

Explicitly prohibit:

- Names.
- MRNs.
- DOBs.
- Addresses.
- SSNs.
- Account numbers.
- Health-plan information.
- Biometric identifiers.
- Full-face photographs.
- Other HIPAA identifiers.

Default to:

> Synthetic data.

Do not claim automated detection is perfect.

For real work experience:

Use:

- Supervisor referral.
- Structured reference.
- Human review.

Never ask students to upload real patient data.

---

# PART XIV  -  EVIDENCE GRAPH

Design a unified evidence model.

Every evidence item should have:

```text
Evidence ID
Candidate ID
Source
Source Type
Timestamp
Claim
Verification Level
Verification Method
Assessment
Result
Human Review
Confidence
Expiration
```

Example:

```text
Evidence:
Financial Model

Source:
Uploaded XLSX

Verification:
Workbook parser

Additional Evidence:
Defense

Human Review:
2 raters

Status:
Verified

What it proves:
Candidate can construct and explain a basic financial model.

What it does not prove:
Candidate can perform under real investment banking deadlines.
```

This is central to Covenda.

Do not simply store:

```text
student.financial_model_score = 87
```

Store:

> The evidence behind the claim.

---

# PART XV  -  CANDIDATE-FACING EXPERIENCE

The student should see:

## Investment Banking Batch

### Requirement 1
Accounting fundamentals

**Status:** Complete

### Requirement 2
Financial modeling

**Status:** Missing

**How to satisfy:**

Complete Covenda Financial Modeling Assessment.

---

### Requirement 3
Demonstrated ownership

**Status:** Pending

---

### Requirement 4
Defense

**Status:** Complete

---

The student should never see:

> "You scored 76.3 and were rejected."

Instead:

> "You demonstrated accounting and valuation ability. Your remaining gap is financial modeling. Complete the following assessment to satisfy the requirement."

---

# PART XVI  -  COMPANY-FACING EXPERIENCE

The company should not simply see:

> "Tyler  -  92% Match."

Instead:

## Candidate

**Investment Banking  -  Covenda Verified**

### Compatibility

High

### Demonstrated capability

Strong

### Evidence

- Financial model  -  verified
- Valuation analysis  -  verified
- M&A case  -  defended
- Accounting fundamentals  -  assessed

### Verification

- External assessment
- Work sample
- Ownership defense
- Human review

### Candidate strengths

- Financial modeling
- Valuation
- Analytical reasoning

### Remaining uncertainty

- Limited transaction experience

### Recommended work

Strong fit for:

- Financial modeling
- Company research
- Valuation analysis

Less validated for:

- Live transaction execution

This is far more useful than one score.

---

# PART XVII  -  INTER-RATER RELIABILITY

For every human-reviewed specialization:

Use:

- Two independent raters.
- Anchored 4/6/9 rubrics.
- Blind initial scoring where possible.
- Adjudication for large disagreements.

Measure:

`interRaterReliability`

Use Cohen's kappa where appropriate.

Do not simply claim:

> "The rubric is objective."

Measure it.

If raters frequently disagree:

1. Identify ambiguous rubric language.
2. Revise anchors.
3. Recalibrate raters.
4. Repeat measurement.

---

# PART XVIII  -  FINAL DOCUMENTS

Create:

## `docs/VETTING_MATRIX.md`

25 specializations.

Requirements.

Verification rails.

Assessment.

Defense.

Human review.

---

## `docs/ASSESSMENT_PLATFORM_MATRIX.md`

All researched third-party platforms.

---

## `docs/BUILD_VS_BUY.md`

For every component:

- Build.
- Buy.
- Integrate.
- Partner.
- Human.

---

## `docs/VETTING_RAILS.md`

Define:

- Machine rail.
- External assessment rail.
- Instrumented trial.
- Human rail.
- Hybrid rail.

---

## `docs/EVIDENCE_GRAPH.md`

Define the evidence architecture.

---

## `docs/AI_AUTHENTICITY.md`

Define:

- AI disclosure.
- AI-assisted work.
- Ownership.
- Defense.
- Perturbation.

---

## `docs/PHI_INTAKE_GATE.md`

Healthcare data safety.

---

## `docs/VETTING_RESEARCH.md`

All research sources.

---

# PART XIX  -  REQUIRED RESEARCH ORDER

Do NOT design all 25 specializations simultaneously.

Execute in this order.

## PASS 1

Software & AI

Stop and show results.

---

## PASS 2

Accounting & Finance

Stop and show results.

---

## PASS 3

Professional Services

Stop and show results.

---

## PASS 4

Consumer & Retail

Stop and show results.

---

## PASS 5

Healthcare Operations

Stop and show results.

---

# PART XX  -  REQUIRED RESEARCH QUALITY

For every major recommendation:

Prefer:

1. Official assessment provider documentation.
2. Official API documentation.
3. Official employer recruiting documentation.
4. Peer-reviewed research.
5. Academic research.
6. Reputable industry research.
7. Expert practitioner sources.

Use Reddit and forums only to understand candidate experiences, not as authoritative evidence of validity.

Every source must be linked.

Every major claim must have a citation.

Do not cite a platform's marketing page as proof that its assessment predicts job performance.

Separate:

> What the vendor claims.

from:

> What independent evidence supports.

---

# PART XXI  -  FINAL ARCHITECTURAL TEST

Before finalizing any specialization, ask:

### Question 1

Could Covenda buy or integrate this capability instead of building it?

### Question 2

Does the proposed assessment measure the actual work?

### Question 3

Could a frontier LLM complete the assessment without understanding it?

### Question 4

If yes, what defense mechanism catches that?

### Question 5

Can Covenda actually verify the student's claim?

### Question 6

If not, is the uncertainty explicitly disclosed?

### Question 7

Does the assessment generate evidence that companies will actually find useful?

### Question 8

Does this make Covenda more differentiated, or does it merely duplicate an existing vendor?

### Question 9

Is the student effort justified by the signal generated?

### Question 10

Could the same requirement be satisfied through an existing verified artifact instead?

---

# FINAL ACCEPTANCE CRITERIA

The project is complete only when:

- All 25 specializations are designed.
- Every specialization has a published requirements checklist.
- Every requirement has an evidence source.
- Every evidence source has a verification level.
- Every assessment states what it proves.
- Every assessment states what it does not prove.
- Every assessment has an AI-era authenticity strategy.
- Every human rail has anchored rubrics.
- Every human rail measures inter-rater reliability.
- Every specialization has ownership-defense questions.
- Every specialization has residual uncertainty documented.
- Existing third-party infrastructure has been evaluated before recommending proprietary development.
- Build-vs-buy decisions are explicitly documented.
- API availability is verified using official documentation.
- Third-party providers are not treated as automatically valid merely because they are established.
- Covenda's proprietary differentiation is clearly identified.
- The candidate experience remains developmental rather than punitive.
- Missing requirements produce actionable remediation paths.
- Admission remains requirements-based, not rank-based.
- Human operators retain final admission authority.
- No protected attributes or prestige proxies are used.
- Healthcare PHI protections are designed before healthcare vetting is implemented.
- `npm run check` remains green after code changes.
- Browser preview is used to validate visual changes.

---

# FINAL PRINCIPLE

The final system should follow this rule:

> **Borrow the best infrastructure.**
>
> **Borrow the best assessment methodologies.**
>
> **Borrow the best hiring frameworks.**
>
> **Do not blindly copy any one company.**
>
> **Do not rebuild commodity infrastructure.**
>
> **Own the evidence layer.**
>
> **Own the verification layer.**
>
> **Own the compatibility layer.**
>
> **Own the candidate's verified professional profile.**
>
> **Own the connection between demonstrated capability and actual company work.**

Covenda should not become:

> "Another website where students take tests."

It should become:

> **The system that turns fragmented evidence of student ability into a verified, explainable, company-readable talent profile.**

The core product output is therefore not a test score.

It is:

```text
## Compatibility
+
## Demonstrated Capability
+
## Verified Evidence
+
## Ownership
+
## Defensible Performance
+
## Human Validation
+
CONTEXT
=
## Covenda Verified Talent Profile
```

\clearpage

# Appendix C: Professional Simulation and Vertical Vetting Master Plan

> Source appendix. Included to preserve prior Covenda material. The integrated blueprint above controls when source drafts conflict.

## Covenda  -  Professional Simulation &
## Vertical Vetting Master Plan
Consolidated product, research, simulation, backend, personalization, and partnership blueprint

Purpose. This document consolidates the strategic direction discussed for Covenda: moving beyond a generic project-based talent
platform toward a verticalized professional evidence and simulation layer. The objective is to understand how real employers
evaluate early-career talent, translate those workflows into engaging simulations, and connect the resulting evidence to Covenda's
company portal, student portal, compatibility engine, vetting system, and professional profile.

Core thesis. Covenda should not ask only, "How do we test whether a student is good at finance, software, consulting, or
marketing?" It should ask: "What does an entry-level professional in this field actually do, what decisions do they make, what skills
are revealed by those decisions, and how can Covenda create a credible simulation that lets them demonstrate those abilities?"

## 1. THE STRATEGIC SHIFT
The key shift is from generic assessment to professional workflow simulation. A generic test asks isolated questions. A
professional simulation places a candidate inside a realistic context and asks them to make decisions, prioritize information,
respond to new events, and defend their reasoning.

For Investment Banking, the candidate might enter a simulated deal room, review financial information, identify an accounting
issue, build a valuation, respond to a VP request, and defend a recommendation. For Software Engineering, the candidate might
work inside an existing codebase, debug a failure, review a pull request, make a change, write tests, and explain architectural
tradeoffs.

The result is richer evidence than a generic score. Covenda can record what the candidate demonstrated, how it was verified, and
what remains uncertain.

Covenda should not become a traditional testing company. It should use existing assessment infrastructure where it is strong,
while owning the higher-value layer: professional context, evidence aggregation, verification, personalization, compatibility, and the
connection between student capability and company demand.

## 2. COVENDA ADAPTIVE PROFESSIONAL SIMULATIONS
Each specialization should have a library of vertical-specific simulations. A company can select the capabilities it values, and
Covenda can adapt the experience to company needs without rebuilding the platform.

Investment Banking  -  Live Deal Room
The candidate receives a transaction scenario with financials, industry information, buyer details, management emails, and
requests from senior bankers. New information is introduced over time. The candidate must prioritize, calculate, decide,
communicate, and defend.

The system can observe technical accuracy, prioritization, speed, judgment, reasoning, communication, and adaptability. The
output is a structured evidence record, not simply "Finance Score: 87."

Asset & Wealth Management  -  Portfolio Decision Simulation
The candidate receives a client profile, determines an appropriate risk framework, constructs an allocation, responds to a market
shock, decides whether to rebalance, and explains the decision. Evaluation should emphasize suitability, risk discipline,
diversification, drawdown awareness, and process - not simply maximum simulated returns.

Software Engineering  -  Existing-Codebase Challenge
The candidate enters an existing repository and implements a feature, diagnoses a bug, reviews code, or improves reliability. The
simulation records code changes, tests, debugging behavior, decisions, and defense. This complements rather than rebuilds
commodity coding infrastructure.

## 3. THE COVENDA VERTICAL SIMULATION FRAMEWORK
Every specialization should use the same research and design framework so Covenda can support 25 specializations without
building 25 unrelated products.

Step                         Question

1. Job function              What does someone in this role actually do?

2. Recruiting                How do leading employers evaluate junior candidates?

3. Skills                    What capabilities are genuinely being probed?

4. Existing infrastructure   What assessment or simulation vendors already solve parts of this?

5. AI limitations            Which traditional assessments are weakened by frontier AI?

6. Covenda simulation        What realistic scenario reveals the desired skills?

7. Interaction               What decisions and branching make it engaging?

8. Evidence                  What durable evidence does the candidate produce?

9. Company customization     How can the experience adapt to company priorities?

10. Compatibility            How does evidence inform fit without becoming hidden admission scoring?

## 4. FIVE BATCHES, 25 SPECIALIZATIONS
Batch                            Specializations

Software & AI                    AI/ML; Physical AI & Robotics; Infrastructure & Data; Product Engineering; Security & Reliability

Accounting & Finance             Investment Banking; Private Equity; Venture Capital; Asset & Wealth Management; Accounting & Audit

Professional Services            Management Consulting; Strategy & Research; Market Intelligence; Legal Operations; Technical Writing

Consumer & Retail                Growth & Performance; Brand & Content; Merchandising; Supply Chain; E-commerce & Marketplace

Healthcare Operations            Clinical Operations; Health Analytics; Revenue Cycle; Regulatory & Quality; Digital Health Product

Each specialization should have its own skill ontology, recruiting research, evidence rails, simulation library, human-review
requirements, and partner map. The visual experience should feel vertical-specific while the architecture remains shared.

## 5. MODEL COMPANY ANCHORS
Select representative employers as research anchors. These are research references, not implied partnerships or endorsements.

Specialization              Potential anchors                                   Simulation direction

Investment Banking          Goldman Sachs; Evercore; JPMorgan; Morgan Stanley
Deal room, model, valuation, client/VP requests

Private Equity              Blackstone; KKR; Apollo                             Investment committee, LBO, diligence, downside

Venture Capital             Sequoia; Andreessen Horowitz; Benchmark             Ambiguous startup evaluation, market sizing, founder assessment

Asset & Wealth Management BlackRock; Fidelity; Morgan Stanley Wealth Management
Client suitability, portfolio construction, risk management

Accounting & Audit          Deloitte; PwC; EY; KPMG                             Financial statements, workpapers, anomaly investigation

Product Engineering         Stripe; Linear; GitHub; Shopify                     Existing codebase, feature, code review, debugging

AI/ML                       OpenAI; Anthropic; Google DeepMind; NVIDIA          Model evaluation, data, experiments, failure analysis

Cybersecurity               CrowdStrike; Palo Alto Networks; Cloudflare         Incident response, threat triage

Management Consulting       McKinsey; BCG; Bain                                 Structured case, hypothesis, synthesis

Growth & Performance        Google; Meta; DTC brands                            Campaign planning, budget, experiment analysis

Supply Chain                Amazon; Walmart; logistics companies                Forecasting, inventory, disruption response

Healthcare Operations       Health systems; payers; digital health              Synthetic operations, workflow, compliance

Validate each anchor using current recruiting materials, job descriptions, assessment documentation, credible industry research,
and practitioner interviews. Never imply access to proprietary recruiting information.

## 6. EXISTING PLATFORMS  -  DO NOT REINVENT THE WHEEL
Capability                  Integrate/use existing                                       Covenda should own

Coding                      Code execution, test harnesses, IDEs                         Professional context, evidence, ownership defense

Technical interviews        Video/interview tools                                        Structured scenario, rubric, evidence linkage

Finance modeling            Spreadsheet/modeling tools                                   Scenario context, decisions, defense

Marketing analytics         Ad/analytics platforms                                       Simulation orchestration, decision tracking

Case interviews             Existing case methodology                                    Adaptive case engine, recorded reasoning

Cybersecurity               Cyber ranges                                                 Candidate evidence and verification

Healthcare                  Synthetic data/simulation tools                              Safety gate, evidence, human review

Strategic principle: buy or integrate commodity infrastructure; build the professional-context, evidence, verification, compatibility,
and personalization layer.

## 7. COMPANY-SIDE EXPERIENCE
The company portal should let employers define what they need without requiring them to build assessments from scratch.

Workflow: select specialization -> define skills and priorities -> choose simulation template -> customize parameters -> define
evidence thresholds -> review evidence -> request defense/interview/trial if needed -> invite to opportunity.

The dashboard should explain why a candidate is relevant. It should display evidence, verification status, limitations, and
compatibility context rather than a single opaque global score.

## 8. STUDENT-SIDE EXPERIENCE
The student portal should turn the same infrastructure into personalized professional development and opportunity discovery.

Students should see compatible paths, demonstrated skills, unverified skills, recommended simulations, opportunities where they
meet requirements, verification status, and actionable gaps.

Referral principle: a referral is an optional enhancement signal, not a mandatory gate. Students can apply without a referral.
When present, a referral can strengthen personalization and provide additional evidence, especially when the referrer directly
observed the student's work.

Example profile: Investment Banking  -  Covenda Verified. Demonstrated: financial statement analysis, three-statement modeling,
valuation, time-constrained decision-making. Evidence: verified modeling simulation, human-reviewed transaction defense,
financial modeling assessment. Remaining uncertainty: no live transaction experience. Recommended next step: complete a
live-deal simulation or supervised project.

9. COMPATIBILITY + VETTING + EVIDENCE
System                      Purpose

Compatibility               Estimates how well a student may fit a path, role, environment, or opportunity.

Vetting / Admission         Determines whether published requirements have been met; missing requirements produce actionable gaps.

Evidence                    Stores underlying proof with provenance, verification status, and limitations.

Compatibility should not secretly determine admission. A strong compatibility signal cannot manufacture evidence. The system
should always distinguish what is known, verified, inferred, and uncertain.

## 10. BACKEND ARCHITECTURE
Use a shared simulation architecture with specialization-specific configuration.

Flow:
Batch -> Specialization -> Professional Skill Framework -> Assessment Blueprint -> Simulation Scenario -> Scenario
State -> Candidate Decisions -> Evidence Events -> Automated Evaluation -> Human Evaluation -> Defense -> Evidence
Record -> Covenda Verified Profile

Suggested entities:
specialization_skill_framework: specialization_id, skill_id, skill_name, skill_category, importance,
assessment_method, evidence_type, verification_level

simulation_blueprint: simulation_id, specialization_id, industry, scenario_type, estimated_duration, difficulty,
skills_tested, required_decisions, adaptive_rules, scoring_dimensions, human_review_required

simulation_event: candidate_id, simulation_id, event_type, timestamp, decision, context, time_to_decision,
evidence_generated

evidence_record: candidate_id, skill_id, evidence_type, source, verification_level, confidence, date,
human_review, limitations

## 11. SIMULATION ENGINE REQUIREMENTS
The engine should be scenario-driven rather than hardcoded by specialization.

Required capabilities: multi-step scenarios; persistent state; timed tasks; branching; dynamic information; structured event logging;
evidence events; objective checks; human-review queues; candidate-specific defense questions; explicit evidence limitations;
versioned scenarios and rubrics; fairness/invariance tests; no protected attributes or prestige proxies.

## 12. AI-ERA AUTHENTICITY
Assume every candidate has frontier AI. Any task AI can complete alone is a weak filter. Test ownership, understanding,
adaptation, decision-making, and defense.

Mitigations include brief-specific follow-ups, recorded defense, changing scenario parameters, explaining decisions, tracing work
processes, instrumented environments, evolving scenarios, and asking candidates to diagnose or correct AI-generated outputs.

These methods reduce but do not eliminate assisted work. Covenda should record residual uncertainty rather than claim perfect
authorship verification.

## 13. VERTICAL-SPECIFIC PRINCIPLES
Software & AI: code quality, debugging, architecture, system thinking, data reasoning, security, ownership. Use existing coding
infrastructure plus realistic context and defense.

Accounting & Finance: process and judgment. IB: modeling and transactions. PE: downside and diligence. VC: judgment under
uncertainty. Wealth: suitability and risk. Audit: statement reasoning and anomaly detection.

Professional Services: structured thinking, hypothesis formation, synthesis, research quality, provenance, communication,
defensibility. Consulting simulations should resemble real cases.

Consumer & Retail: decisions under imperfect data. Growth: instrumented experiments. Brand: creative judgment. Merchandising:
assortment. Supply chain: forecasting/disruption. Ecommerce: marketplace and conversion.

Healthcare: synthetic/properly de-identified data only. Human review is essential. Evaluate operational reasoning, safety,
compliance, and process discipline.

## 14. PARTNERSHIP STRATEGY
Map four partner categories for each specialization: (1) assessment technology providers, (2) professional communities, (3)
employers, and (4) industry experts.

The outreach proposition should not simply be "Can you send us students?" A stronger message is: "We are building a professional
evidence and simulation layer that helps emerging talent demonstrate what they can actually do. We want to work with
communities and employers to make these experiences reflect real industry workflows."

A Code & Coffee-type technical community is particularly relevant for Software & AI: it can help validate simulations, reach
technical talent, identify practitioners who can review rubrics, and connect with employers. The relationship should be explored as
an industry/community partnership rather than only a referral channel.

## 15. IMPLEMENTATION ORDER
Phase 1  -  Software Engineering + Investment Banking. Build one technical and one finance simulation using the same engine.
Prove the architecture generalizes.

Phase 2  -  Software & AI. Add AI/ML, Infrastructure & Data, Security & Reliability, Physical AI/Robotics.

Phase 3  -  Finance. Add PE, VC, Asset & Wealth Management, Accounting & Audit.

Phase 4  -  Professional Services. Add Consulting, Strategy & Research, Market Intelligence, Legal Operations, Technical
Writing.

Phase 5  -  Consumer & Retail. Add Growth, Brand, Merchandising, Supply Chain, Ecommerce.

Phase 6  -  Healthcare. Build last due to safety, privacy, compliance, and human-review requirements.

## 16. MASTER CODING-AGENT PROMPT
You are extending Covenda into a verticalized professional simulation and evidence system. Do not rebuild the
existing compatibility engine, admission engine, evidence model, or connectors unless necessary. Inspect the
existing architecture first. OBJECTIVE: Build shared simulation infrastructure supporting 25 specializations
across five batches. Each specialization must define a professional skill framework, assessment blueprint,
simulation scenarios, evidence requirements, automated checks, human-review requirements, defense questions, and
company customization. NON-NEGOTIABLES: 1. Compatibility is not admission. 2. Admission uses published
requirements, not a hidden person score. 3. Missing requirements create actionable gaps. 4. AI drafts; humans
decide where required. 5. Never claim verification the system cannot perform. 6. Assume frontier AI access. 7. No
protected attributes or prohibited proxies. 8. Every evidence item has provenance and verification status. 9.
Preserve uncertainty and limitations. 10. Do not hardcode 25 separate applications. IMPLEMENT: - specialization
skill framework - simulation blueprint configuration - scenario state engine - branching/adaptive engine - event
logging - evidence-event generation - objective checks - human review queues - candidate-specific defense
generation - evidence records and verification levels - company configuration - student recommendations -
compatibility integration - admission integration - evidence display - analytics and inter-rater reliability -
scenario/rubric versioning - fairness/invariance tests COMPANY PORTAL: Let companies select a specialization,
choose skills, select a simulation template, customize parameters, define evidence thresholds, and review
evidence. Do not expose hidden global scoring weights. STUDENT PORTAL: Show recommended simulations based on
interests and compatibility. Show demonstrated skills, evidence strength, verification status, gaps, and
opportunities. Allow applications without referrals; referrals are optional evidence/personalization
enhancements. SIMULATION ENGINE: Support realistic scenarios, decisions, time pressure where justified, branching,
new information, event logging, and candidate-specific defense. Do not over-score speed unless the real job
requires it. EVIDENCE: Support verified deliverables, assessments, work history, instrumented trials, referrals,
defense responses, and human review. Every item states what it proves and cannot prove. RESEARCH: Before
implementing each specialization, research current recruiting processes and assessment practices. Identify
existing vendors and APIs. Reuse mature infrastructure. Document build-vs-buy decisions. FIRST IMPLEMENTATION:
Build Software Engineering and Investment Banking first. They must share the same engine but use radically
different workflows. DELIVER: Updated backend; migrations/schema; APIs; simulation configuration; company
dashboard; student dashboard; evidence integration; compatibility integration; admission integration; seed
simulations; tests; documentation; VERTICAL_SIMULATION_MATRIX.md; BUILD_VS_BUY.md; PARTNERSHIP_MAP.md. Before
changing code, inspect existing files and avoid duplicating systems that already solve the problem.

## 17. RESEARCH PROMPT FOR ALL 25 SPECIALIZATIONS
For each of Covenda's 25 specializations: 1. Identify 5-10 representative employers. 2. Research public junior
recruiting processes. 3. Identify interviews, work samples, assessments, technical screens, case studies, trials,
or superdays. 4. Identify the skills each step probes. 5. Separate employer claims from independent evidence. 6.
Identify assessment vendors and simulation platforms. 7. Determine what Covenda should integrate rather than
rebuild. 8. Identify where traditional assessments fail in an AI-enabled environment. 9. Design one realistic
professional simulation. 10. Define the candidate journey step-by-step. 11. Define decisions and events. 12.
Define objective checks. 13. Define human-review criteria. 14. Define candidate-specific defense questions. 15.
Define evidence generated. 16. State what evidence proves. 17. State what it cannot prove. 18. Define company
customization. 19. Define student personalization. 20. Identify potential partners and outreach targets. Do not
invent proprietary hiring processes. Use public information and clearly label assumptions. Never claim a company
is a Covenda partner without an actual partnership.

## 18. FINAL PRODUCT VISION
Covenda's opportunity is larger than project matching. Projects are one mechanism through which students demonstrate ability, but
the broader platform can become a professional evidence layer connecting what a student is interested in, what they can actually
do, what has been verified, what they still need to prove, and what a company actually needs.

The company portal becomes a personalized talent intelligence and evidence environment. The student portal becomes a
personalized professional-development and opportunity environment. The simulation engine becomes the bridge.

The strongest version of Covenda does not say: "This student has a good résumé."

It says: "This student is interested in this type of work, is compatible with this environment, has demonstrated these specific skills
through these specific pieces of evidence, has completed these professional simulations, has been verified through these rails, and
still has these identifiable gaps. Here are the opportunities where that evidence is relevant."

That is the product direction this vertical simulation strategy should support.


\clearpage

# Appendix D: Detailed Student, Company, Trial, and Marketplace Workflows

> Source appendix. Included to preserve prior Covenda material. The integrated blueprint above controls when source drafts conflict.

Student use

Step 1: How does a student get on our platform?

Word of mouth makes their own account
In this case, the student would simply sign up through the home page and personalize their own account through a specific vertical which they believe they would be good at. Something we should take into ideation is that we could display some potential companies we have and the student can press interest on the ones they want to try and work for, or something like this.

Referral
First you get referred, this can be a referral received through email or it can be just you signing up yourself. We need to build this referral system somehow, like the website needs to have a double-check system with a referral link or code.

Step 1.5: What type of students are making accounts? Which ones are valuable (batch members)? What do we do with incompetent student profiles? Despite being expressive and explicit about being a platform aimed at providing startups and companies with startup-ready talent, 1) what do we do with students who are frankly incompetent? What benefit would they service other than diluting our talent pools?

Step 2: After making an account, what should the student see and what are the next steps for that student?
One of the things that needs to be emphasized is the ability to make a highly personalized portfolio on the website. We need a unique design for a "marketplace" of students which the startups can browse through. Each profile should have a picture, an introductory video even maybe, attachments of past work and the skills from each piece of work which is viewable, points of contact for questions, and links to Githubs or Youtube channels or anything relevant. So this would be the second step for students.

Step 3: After personalizing their account, what can the student do?
The student should now have a displayable profile for the companies' marketplace. Additionally, they should be able to start browsing trial projects which companies and start working on them. I honestly don't think the trial project system should be vetted, unless you think there would be too many submissions where it's almost impossible for the company to have the time and review them all.
One thing I want to mention is that the system for the student should be more straightforward, such as an explore page (which would have companies with ads or just companies in general), a projects page, a chats page with companies they are currently working with, and then a divider and under that they have all of the projects they are currently working on.
The batch system: this is an idea which Tyler talked about where students can apply to be part of certain batches which companies can view, just sort of a cleansed version of the public marketplace. I honestly think this and the trial system are very similar and we'd have to make a clear distinction between the two. I don't know if the batch system, where the companies can select from a more filtered group of students, should be implemented until later when the product is more set out.

Step 3.5: Make it easy + desirable to refer:
To feed our flywheel product, we must implement a feature that makes it easy and worthwhile for a student to refer other students (maybe not a fee, but maybe guaranteed accelerated profile activity?)

Step 4: Selecting and completing a trial project
A student should have the option to choose whatever trial project posted through whatever company to work on. Things we have to think about: how do we properly present these trial projects? Knowing that every project is going to require something different, how are we going to make sure the website has everything which is needed in order to properly complete the project? For example, the deliverables for finance  projects could include presentations, csvs, which are easy to upload. But when it comes to tech deliverables, first of all would you even trust this platform to be able to handle those with integrity because these days people can just AI everything; that is one thing we have to consider, and two what would they be submitting and would our system have the ability to handle that? The project cards which the students read should make it very clear what they are doing, how they are going to do it, and what they submit, and how it is going to be graded. This clarity can be formed through a proper system to present and receive the results for every project, which is something we have to break down specifically when designing. That is quite literally the most important part of our website.

Step 5: Completing a trial project and communication/other things needed while doing so
For a student, the completion of a trial project SHOULD be able to be done off of the platform. Either through their own coding, their own documents, or their own physical work, etc. But during this process there should be a way for the student to communicate with the employer as if to ask specifically what they want or what they are looking for.
There are definitely more accessibility features which would be smart to implement but I can't seem to think of any off the top of my head.

Step 6: After submitting a trial project, communications, and how they would be able to see the status of their work so far

I realize we are hovering over many things here. Like we should be addressing what happens to the students' profile when they click on a project and start working on it, we should address where they can view whether they've had their project approved or not, and there should be more specificity when it comes to the stuff above and what happens on each level.
Employer use

Step 0.5: How does a company find out about our service? Why would they be interested? What verticals do we anticipate to have the most interest? (A lot of guys who used similar companies that vetted their work for interviews with SaaS companies say that SWE companies would love this? Is this necessarily true?)
Direct outreach from us
LinkedIn and general marketing
Company-company referrals (frankly the most important in establishing credibility -> partnership with cursor's talent agency would be huge)

Step 1: How does a company get onto our platform?

We want to get rid of the initial filtering part for the company because that should be too much for them to do. One, I don't think it's a good idea to start filtering the students before they see the students in the first place. So we should get rid of all of the filtering things at the start. Get onto the platform and sign up through the company tab on the website. There should be some sort of email verification system for the company.
Prompt for creating a company email verification system:
[Checklist] System Design Prompt for Collaborator
Subject: Technical Design Request: B2B Email & Company Verification System
Context & Goal
We need to design a verification system to ensure users signing up for our platform are legitimate employees of the companies they claim to represent. This will help us prevent fraud, protect B2B data, and ensure accurate onboarding. [1]
Core Requirements to Design
Domain Restrictions: The system must reject public or disposable email providers (e.g., Gmail, Yahoo, Mailinator) and only accept custom corporate domains.
Verification Flow: Users must complete a mandatory Double Opt-In (OTP or Magic Link) sent to their corporate email address before accessing the system.
Domain Matching Logic: A mechanism to map the user's email domain against our existing company database records or the company name they input during signup.
Handling "Catch-All" Servers: A strategy for dealing with corporate mail servers that accept all emails externally but drop invalid ones internally.
Deliverables Needed
User Experience (UX) Flowchart: Wireframes or step-by-step logic showing the signup, email pending, verification, and error states (e.g., if they enter a Gmail address).
Architecture Diagram: A high-level view of how the frontend, backend authentication service, and email delivery API (e.g., SendGrid, AWS SES) interact. [1]
Database Schema: Proposed updates to our user/organization tables to track verification states, timestamps, and domain mappings.

The sign up process should be as flawless and as personalized as possible. It should be easy for them to type simply what they want in a text box or something like that, and then sign up or even book a consultation with us.

Step 2: Integrating into the platform

The level of personalization for companies should be pretty high. After creating an account, they should be able to enter as many details as possible about their company to create a public company profile which students can view through clicking on posted trial projects and then the company name on the posted project card.

The company profile should require them to put:
Company name, logo, website link, their email verification status, founders (if necessary) and points of contact, location (in-person available?), team size, stage & funding (optional).
Product information. A one-line description of what the company builds, what their ideal customer type is, their industry, and their current priorities
What would a student gain from them? Why would a student join? What types of work would students do? Work environment?
Tech background needed, tech stack, departments, common tools, relevant capability areas.
Weekly hours, engagement types, remote or location expectations, compensation approach, work-authorization requirements, typical hiring timeline.
Any relevant links, product, careers, linkedin, tech blogs, founder content, company demo.
And then at the bottom they can put private company settings like authorized team members, billing contacts, recruiter permissions, notification settings, candidate-data retention, confidential materials, internal notes.

After completing or during the completion of the profile, the company should make it clear what they are trying to do. This could be browsing student talent, requesting a curated shortlist, posting an opportunity, hiring for an internship or role, inviting candidates to a paid trial, or just talking to covenda.

Step 3: Company discovers candidates

There is a browse mode which these companies can use to explore students whose privacy settings allow discovery. They should be able to filter through capability, evidence type, evidence verification state, availability, compensation, time zone, engagement preference, industry interest, location, grad year, school, etc.

Step 4: Create a talent brief/trial work

Basically, in this talent brief/trial work card, the opportunity title is displayed, the type of engagement is displayed, start date, duration, weekly hours, compensation, location, work model, etc. But that's not the super important part here. The most important part is the trial work job for any students wanting a shot at the position.

One thing to be noted is that there should be evidence of preferences for the company. They should be able to say, we prefer seeing a deployed product, a GitHub repository, a research paper, writing sample, spreadsheet model, presentation, design portfolio, etc. Any logistics should be displayed with the job view. These include any availability, time zone, meeting expectations, work authorizations, required tools ,travel, security requirements, etc.

Another thing is that the talent brief, after being created, should have some sort of feature on Covenda where it returns three to five or even more candidates which we believe would be relevant for these positions. But this shouldn't prevent other people from applying and doing the same trial work to prove themselves. One thing I just thought of is that students should receive an approval from the company before starting their trial work, just in case the company goes rogue and the student does the work for nothing.
During the trial period, the company dashboard should show:
Trial status
Participants
Questions
Deliverables
Review due dates
Payment status
Required actions
Decisions
The company may:
Answer questions
Review submissions
Request the agreed revision
Accept
Decline
Offer a role
Offer another engagement
Students should receive clear decision timelines.
Step 5: The company requests an introduction
This really can be done at any point in the process. The company should click request introduction, and this will trigger a sending of an opportunity, why the student appears relevant, compensation, time commitment, next step, optional personal message, etc. The student will then receive a message from them and can accept, ask a question, decline, or report concern about this. Once again, this can be done at any point in the process, even if it is during the browse stage or after they receive the trial work from the students.

Step 6: The company, preferably, makes a hiring decision.

There are possible outcomes of all of these:
Interview completed
Paid trial completed
Internship offered
Part-time role offered
Full-time role offered
Another project offered
No offer
Student declined
Company withdrew
Engagement completed
Covenda should ask:
Which evidence mattered?
Was the shortlist relevant?
How much time did Covenda save?
Would the company use Covenda again?
Would the company refer another startup?
Did the student perform as expected?
What was missing from the profile?
These outcomes become your future authority.
Step 7: Company referrals and repeat usage
After a successful result, companies can:
Request another shortlist
Reopen a prior Talent Brief
Invite a previous student
Refer another company
Share a private referral link
Receive a service credit
Join a recurring hiring plan
Company-to-company referrals should be rewarded only after the referred company:
Verifies its account
Creates a legitimate Talent Brief
Requests introductions
Pays for a service or hires
Do not base the company's initial growth plan on a speculative partnership with one large recruiting platform. Build direct outcome evidence first.

This is GPT's version of Covenda's recommended product model
You currently have three products mixed together:
An evidence-backed student profile network
A referral-based talent marketplace
A trial-project platform
These can eventually reinforce one another, but they should not all be equally central at launch.
The clearest V1 is:
Covenda helps startups find students through evidence-backed profiles and structured referrals. After mutual interest, the company may invite a candidate to an interview, its existing assessment process, or a short paid trial.
This preserves your revised thesis. Covenda does not claim to understand every industry, design company projects, or determine who is universally talented. The company defines what it needs and retains the final evaluation authority. Covenda verifies the source of student claims, organizes evidence, explains why a candidate matches, and facilitates the introduction.
The trial system should be an optional hiring step, not an open marketplace where unlimited students perform unpaid work.

Core product objects
Before defining the workflows, establish a consistent vocabulary.
Student Profile
The student's identity, interests, availability, preferences, and evidence.
Capability Claim
A specific thing the student says they can do.
Examples:
Build responsive React interfaces
Conduct public-source market research
Clean and analyze spreadsheet data
Test product workflows
Evaluate AI-generated outputs
Design presentation materials
Evidence Card
A structured record supporting one or more capability claims.
It contains:
Project context
Student's personal contribution
Artifact or link
Outcome
Observer or supervisor
Verification state
Date
AI-use disclosure, where relevant
Invitation
A person sent the student a referral link. This only explains how the student reached Covenda.
Endorsement
A verified person confirms a specific contribution or capability they directly observed.
Invitations and endorsements must be separate. Sending someone a link does not mean the inviter is professionally endorsing them.
Company Profile
The public information students use to understand the company.
Talent Brief
The company's description of the person it wants, the work they would perform, the evidence it would trust, the terms, and the expected outcomes.
Opportunity
An internship, part-time role, project engagement, contract opportunity, or full-time position.
Paid Trial
A limited, company-defined work engagement offered to one or a few shortlisted students after initial screening.
Introduction
A mutually approved connection between a company and a student.
Verified Outcome
An interview, completed trial, project, internship, hire, rehire, or employer-confirmed work result.

Student workflow
Step 0: Student discovers Covenda
Students may reach Covenda through:
A friend
A referral link
A professor
A laboratory
A student organization
A previous employer
A startup
Social media
Direct outreach from Covenda
A public student profile
A company opportunity
The landing page should communicate one immediate benefit:
Your résumé says where you were. Covenda shows what you actually did.
The primary student action should be:
Build your profile
A secondary action should be:
View an example
Students should immediately see:
Profiles are free
Profiles are private by default
Covenda does not guarantee opportunities
Students approve every company introduction
A Covenda profile can be shared outside the platform
Students are never charged to apply or be introduced

Step 1: Student creates an account
A student can join in two ways.
Self-signup
The student enters:
Name
Email
Password or secure login method
School
Graduation year
Area of study
They verify their email.
A school email can confirm access to that email address, but should not be treated as proof of enrollment indefinitely. Covenda can label it:
University email confirmed
Do not label it:
University verified talent
Referral signup
The student enters through a unique referral link or code.
The system records:
Referrer account
Referral source type
Date
Campaign or club
Whether the referrer is simply inviting or endorsing
Whether the referrer's identity is verified
Example:
covenda.app/join/7YK3Q

The student still creates their own account and controls their profile.
Double-check process
When the referral is meant to include an endorsement:
The student joins using the link.
The referrer receives a confirmation request.
The referrer confirms the relationship.
The referrer completes a structured endorsement.
Covenda verifies the referrer's identity through a work, university, or organization email where possible.
The endorsement is labeled according to what was actually confirmed.
The platform should never infer endorsement merely because a link was used.

Step 1.5: Profile quality and company visibility
You should not label students "competent" or "incompetent." You also should not expose every incomplete, unsupported profile to companies.
Use objective visibility requirements instead.
Student profile states
Draft
The student has created an account but has not completed the required profile information.
Profile complete
The required sections are complete.
Company-visible
The profile meets the minimum evidence and privacy requirements to appear in verified company searches.
Evidence-confirmed
At least one artifact, contribution, observer, or employment claim has been independently confirmed.
Work-verified
The student has completed a paid engagement arranged through Covenda and the company has confirmed the outcome.
Paused
The student is not currently open to opportunities.
Minimum requirements for company visibility
A profile should become company-visible only when it contains:
Verified identity and email
Complete availability information
At least one specific capability claim
At least one evidence card
At least one supporting artifact or observer
Current engagement preferences
Student consent to company discovery
No policy or integrity violations
A student who does not meet the threshold can still:
Use a private profile
Share it manually
Improve the profile
Request feedback
Add evidence later
They simply do not appear in broad company search results yet.
What happens to weak profiles
Do not reject students based on vague founder judgment.
Show specific improvement requirements:
Add an example showing how you used this skill.
Explain what part of the project you personally owned.
Add a link, file, or observer who can confirm this contribution.
Your availability has not been updated in 60 days.
This skill is currently self-reported and will not appear as confirmed evidence.
This protects marketplace quality without pretending Covenda can determine everyone's general ability.

Step 2: Student builds a personalized Proof Profile
The student should not face one enormous form. Use progressive onboarding.
Step 2A: Choose work interests
Ask:
What would you feel comfortable helping a startup with today?
Initial categories:
Software and product building
AI and data
Product testing and QA
Research and strategy
Product and growth
Design
Finance and analytical work
Operations
Writing and documentation
Other
Limit the student to approximately five primary capability areas initially. This forces clarity.
Step 2B: Set work preferences
Collect:
Industries of interest
Preferred company stage
Internship, part-time, project, or full-time interest
Weekly availability
Earliest start date
Preferred duration
Time zone
Remote, in-person, or hybrid
Compensation expectations
Work authorization only when relevant
Work the student will not perform
Whether the student is actively looking
Step 2C: Add evidence cards
For every evidence card, ask:
Project context
What was the project?
Who was it for?
Was it personal, academic, professional, research-based, or club-based?
When did it happen?
Personal contribution
What did you personally own?
What decisions did you make?
What tools did you use?
Did other people contribute?
Artifact
The student may add:
GitHub repository
Live product
Research paper
Spreadsheet
Presentation
Design file
Writing sample
Video demonstration
Published article
Data visualization
Other file or link
Outcome
Was it deployed?
Was it published?
Was it used?
How many people used it?
Was it accepted by a company?
Did it influence a decision?
Did the project receive feedback?
The student should not be forced to invent a quantitative result.
Observer
Ask:
Is there someone who directly saw you perform this work?
Possible observers:
Professor
Research supervisor
Previous manager
Founder
Club leader
Technical lead
Project teammate
Client
Other
AI use
Ask:
Was AI used?
Which tools?
How was it used?
What did the student personally verify?
What part was completed without AI?
Do not punish AI use automatically. The profile should simply make it transparent.
Step 2D: Optional introduction video
An introduction video should be optional.
A better format than a generic personality video is a project walkthrough:
Explain one thing you built, what you personally contributed, and what you would improve.
Recommended limits:
60 to 90 seconds
Captions required
Text alternative accepted
Not scored automatically
Not required for company visibility
Mandatory video can introduce accessibility and bias problems. It should supplement evidence, not replace it.
Step 2E: Profile preview
Before publishing, the student sees exactly what companies will see.
They control:
Public profile link
Verified-company visibility
Artifact visibility
Compensation visibility
Observer contact permission
Active-search status
Whether Covenda must ask before every introduction
Recommended default:
Ask before every introduction.

Step 3: Student dashboard after profile completion
The student should enter a simple dashboard, not a complicated marketplace.
Navigation
Home
Shows:
Profile status
Visibility status
Active availability
Recommended next action
New company interest
Application updates
Current engagement status
Explore
Contains two tabs:
Companies
Opportunities
Applications
Contains every application and status.
Trials and Work
Contains active paid trials, projects, or engagements.
Messages
Contains conversations only after mutual interest.
Profile
Contains profile, evidence, preferences, and visibility.
Referrals
Contains invitations, endorsement requests, referral status, and referral activity.
Settings
Contains account, privacy, notifications, and data controls.
Do not place dozens of empty analytics cards on the student homepage.

Step 3A: Explore companies
Students should only see companies that have been verified and have approved a public profile.
Each company card may show:
Logo
Company name
One-line description
Industry
Team size
Stage, when the company chooses to disclose it
Location
Work model
Current opportunity count
Main capability areas
Why students might want to work there
Verification status
Do not display companies that have not joined or approved their presence. Listing recognizable companies without a relationship could imply participation.
Student company actions
Follow
Receive updates when the company posts an opportunity.
Save
Privately bookmark the company.
Signal interest
Tell the company that the student is interested in future work.
A signal of interest should include one optional sentence:
Why are you interested, and which evidence should the company view?
Limit signals to prevent spam, perhaps five meaningful interest signals per month.
View opportunities
Open active roles, projects, or trials.

Step 3B: Explore opportunities
Each opportunity card should show:
Company
Opportunity title
Engagement type
Compensation
Weekly hours
Duration
Start date
Location
Required capabilities
Evidence the company wants to see
Application deadline
Whether there is a paid trial
Whether the opportunity may convert into a longer role
Students should be able to filter by:
Capability
Engagement type
Compensation
Time commitment
Duration
Location
Company stage
Industry
Trial requirement
Start date
Do not introduce sponsored company listings during the early product. If paid promotion is added later, label it clearly.

Step 3.5: Referral system
Separate invitation from endorsement
Invitation
I think this person should know about Covenda.
Endorsement
I directly observed this person perform a particular type of work.
Only endorsements should appear as evidence.
Student referral flow
Student opens Referrals.
Selects Invite a Student.
Enters the person's name and email, or copies a unique link.
Selects whether they are merely inviting or offering a structured endorsement.
The new student joins.
Covenda records the relationship.
If an endorsement was offered, the referrer completes the evidence form.
Referral incentives
Do not guarantee improved company ranking merely for referring people. That encourages spam and social gaming.
Better incentives include:
One detailed Covenda profile review
Early access to relevant events
Ability to nominate a peer for a specific opportunity
Recognition as a trusted connector after successful referral outcomes
Priority support, not priority hiring
Club contribution credit
Rewards should occur only after the referred student:
Completes a real profile
Adds evidence
Passes identity checks
Remains active
Behaves appropriately
Longer term, successful referral outcomes may increase the internal credibility of a sourcing channel. That should not become a public popularity score.

Step 4: Student applies for an opportunity
Do not allow a student to click a project and immediately begin performing work.
That would create:
Unlimited speculative submissions
Company review overload
Unpaid work
Intellectual-property uncertainty
Low-quality spam
AI-generated mass submissions
Poor student experience
Use a structured application process.
Application contents
The student submits:
Their existing profile
Two or three relevant evidence cards
Availability confirmation
Compensation confirmation
Project-specific responses
Optional short note
Consent to the opportunity's AI, privacy, and work rules
Avoid long cover letters.
A useful question might be:
Which piece of your existing work is most relevant, and why?
Company actions
The company can:
Save candidate
Request clarification
Request introduction
Invite to interview
Invite to paid trial
Decline
Archive
Application status
Students see:
Draft
Submitted
Viewed
Under review
Shortlisted
Introduction requested
Interview invited
Paid trial invited
Selected
Not selected
Withdrawn
Closed
Do not use ambiguous statuses such as "processing."

Step 4A: Paid trial design
A trial should be:
Offered only to shortlisted students
Paid
Limited in duration
Created and evaluated by the company
Clear about whether it produces usable company work
Limited to one to three candidates
Funded before work begins
Separate from ordinary application screening
Covenda does not determine whether the task is technically valid. Covenda enforces required information and transparent terms.
Required trial fields
Purpose
Why is the company using the trial?
Deliverable
What exactly must be submitted?
Inputs
What materials, access, or context will be provided?
Time
Estimated hours
Start date
Deadline
Meeting expectations
Payment
Fixed compensation
Payment timing
Revision policy
Cancellation policy
Evaluation
Criteria
Reviewer
Decision timeline
Whether feedback will be provided
AI policy
AI permitted
AI prohibited
AI permitted with disclosure
Required human verification
Required prompt or process documentation
Intellectual property
Who owns the result?
May the student display it?
Is a redacted portfolio version allowed?
Confidentiality
What is confidential?
What cannot be downloaded or retained?
When must materials be deleted?
No open unpaid trial marketplace
Do not allow every student to complete the same company task without compensation.
The safer model is:
Students apply using existing evidence.
Company shortlists candidates.
Company invites one to three students.
Every invited participant is paid.
Company reviews a manageable number of submissions.

Step 4B: Trial project presentation
The trial project page should contain:
Company
Purpose
Deliverable
Estimated effort
Compensation
Deadline
Required capabilities
Provided materials
Submission format
Evaluation criteria
Reviewer
AI policy
Confidentiality
Intellectual-property rules
Portfolio permissions
Revision policy
Communication rules
Number of participants
Potential next step
Submission formats by project type
Software
GitHub repository
Pull request
Commit history
Deployment link
Test results
Short walkthrough video
README
Architecture explanation
Covenda should not run arbitrary code on its own infrastructure in V1.
Research
PDF
Document
Spreadsheet
Source list
Research methodology
Presentation
Finance and analysis
Spreadsheet
CSV
Presentation
Written methodology
Assumptions
Source list
Exclude investment recommendations, client records, and material nonpublic information.
Design
Figma link
Exported assets
Design rationale
Prototype
Accessibility notes
Product QA
Test matrix
Bug list
Screenshots
Screen recording
Reproduction steps
Severity classification
AI evaluation
Labeled dataset
Rubric-based annotations
Error categories
Source evidence
Methodology
AI-use disclosure
Covenda can support file uploads and external links without needing to understand or execute every technical artifact.

Step 5: Completing a paid trial
The actual work may happen off-platform.
Students may use:
Their code editor
GitHub
Figma
Google Docs
Microsoft Office
Notion
Jupyter
Company sandbox
Other approved tools
Covenda should manage the relationship and evidence, not attempt to replace every work tool.
Trial workspace
The platform should contain:
Overview
Scope, deadline, compensation, status, and reviewer.
Materials
Approved company files and links.
Milestones
When applicable.
Questions
Structured communication.
Submission
Links, files, methodology, and disclosures.
Activity
Important events, not invasive surveillance.
Terms
Payment, confidentiality, AI policy, and IP.
Communication
Students and companies should communicate only after mutual interest or trial acceptance.
Each trial question may include:
Question
Why it matters
What the student has already checked
Whether the work is blocked
Requested response date
Attachment
The company can answer, schedule a call, or clarify the brief.
Covenda should provide:
Notifications
Response reminders
Message reporting
Blocking
Moderation
Meeting scheduling
File-sharing limits
Do not build open direct messaging between every company and every student.

Step 6: Submission and status
Student submission
The student submits:
Final deliverable
Supporting links
Methodology
AI-use disclosure
Known limitations
Questions still unresolved
Portfolio permission request, if desired
Status sequence
Trial invited
Awaiting student acceptance
Awaiting funding
Ready to begin
In progress
Submitted
Under company review
Revision requested
Resubmitted
Accepted
Not selected
Paid
Closed
Disputed
Cancelled
The platform should show:
Current status
Who must act next
Expected decision date
Payment status
Last update
Allowed next action
Example:
Submitted 2 days ago
Company review due by August 14
No action required from you
Company evaluation
The company completes a structured evaluation tied to its own criteria.
Possible decisions:
Accept and offer role
Accept and offer another project
Accept without further engagement
Request agreed revision
Do not proceed
Cancel with reason
Covenda should not publish a numerical score automatically.

Step 7: Student profile after an outcome
A completed engagement may create a new Work Record.
The company confirms:
What the student completed
Whether the deliverable was accepted
Whether the student met the deadline
Whether the student communicated appropriately
Whether the company would work with them again
Whether an artifact may be displayed
The student controls what is publicly shown.
Example Work Record
Product QA trial for a B2B software startup
Tested 18 onboarding workflows and submitted 11 reproducible bug reports
Completed on time
Deliverable accepted after one clarification
Employer confirmed contribution
Work artifact private
This is stronger than a generic rating.
Disputes
Students should be able to dispute:
Incorrect factual claims
Incorrect completion status
Nonpayment
Unauthorized public disclosure
Misrepresented feedback
Companies should be able to dispute:
Plagiarism
Misrepresented contribution
Confidentiality violations
Noncompletion
Undisclosed AI use where disclosure was required
Covenda must maintain records and a human review process.

Batch system
The batch concept should not be part of V1.
What a batch would mean
A batch is a time-bound, opt-in talent cohort organized around:
Capability area
Availability
Engagement preference
Evidence completeness
Industry interest
Example:
Fall 2026 AI and Product Builders
It is not a general ranking of students.
Difference between a batch and a trial
Batch
Trial
Group of students
Company-specific engagement
Exists before one company request
Created by one company
Used for discovery
Used for evaluation
Evidence-based admission
Paid work
May include many students
Usually one to three students
No guaranteed opportunity
Clear company decision attached

Build batches only after you have recurring employer demand in one capability category.

Company workflow
Step 0: Company discovers Covenda
Initial acquisition channels:
Founder-led outreach
Alumni introductions
VC and accelerator portfolios
Startup communities
Company referrals
Professional networks
University founder networks
Content showing strong student profiles
Student-led warm introductions
Search and social marketing
Do not assume software companies automatically want students. Software work often requires substantial context, production access, and technical review.
The first companies most likely to use Covenda are those that:
Hire off-cycle
Have limited recruiting infrastructure
Are open to emerging talent
Can articulate clear responsibilities
Value portfolios and direct evidence
Have someone capable of evaluating candidates
Can pay
Have real near-term hiring or project demand
Why a company would be interested
Covenda's company-side proposition is:
Do not review hundreds of applications. Tell us what you need and what evidence you trust. Covenda shows you a small number of students whose claims are supported by visible work and specific observers.
Potential benefits:
Smaller candidate pool
More relevant evidence
Explainable matching
Faster access to student talent
Warm introductions
Current availability
Off-cycle hiring
Better visibility into personal contributions
Optional paid trial
Access to normally fragmented campus networks
Do not promise better hires until you have outcome evidence.

Step 1: Company account creation
The company selects:
I represent a company
Minimal signup
Collect:
Work email
Name
Role
Company website
Password or secure login
Agreement to platform terms
Do not force a long filtering wizard before the company sees the product.
Company verification
Use a risk-based process.
Basic verification
Work email confirmation
Company-domain match
Website review
LinkedIn or equivalent professional identity
Company identity
Contact role
Additional verification when necessary
Business registration
Founder or authorized employee confirmation
Payment method
Manual Covenda review
Reference from an existing company
Video call
A Gmail address should not automatically disqualify a legitimate early startup, but it should trigger manual review.
Company account states
Email unverified
Verification pending
Verified company
Restricted
Suspended
Only verified companies should be able to:
View full discoverable profiles
Request introductions
Post opportunities
Invite paid trials
Contact students

Step 2: Company builds its profile
Covenda can prefill information from the company's website, but the company must confirm it.
Public company profile
Identity
Company name
Logo
Website
Verified status
Founders
Location
Team size
Stage, optional
Funding, optional
Product
One-line description
What the company builds
Customer type
Industry
Current priorities
Student experience
Why a student might join
Types of work students may perform
Learning opportunities
Expected ownership
Mentorship or supervision
Communication cadence
Work environment
Technical or functional context
Tech stack
Departments
Common tools
Relevant capability areas
Employment information
Engagement types
Typical weekly hours
Remote or location expectations
Compensation approach
Work-authorization requirements
Typical hiring timeline
Links
Product
Careers
LinkedIn
Technical blog
Founder content
Company demo
Other relevant materials
Private company settings
Authorized team members
Billing contacts
Recruiter permissions
Notification settings
Candidate-data retention
Confidential materials
Internal notes
Students should be able to distinguish between a verified company profile and an unverified or incomplete one.

Step 3: Company chooses its goal
After onboarding, ask one simple question:
What would you like to do today?
Options:
Browse student talent
Request a curated shortlist
Post an opportunity
Hire for an internship or role
Invite candidates to a paid trial
Talk with Covenda
The company can browse immediately after verification. It should not be required to complete ten filters first.
However, requesting an introduction should require enough information for the student to understand the opportunity.

Step 4: Company creates a Talent Brief
The Talent Brief replaces a generic job post.
Basic details
Opportunity title
Engagement type
Paid trial, project, internship, part-time, or full-time
Start date
Duration
Weekly hours
Compensation
Location
Work model
Responsibilities
Ask:
What will this person actually do?
Require three to five specific responsibilities.
Early outcomes
Ask:
What should this person accomplish in the first 30 days?
For a short engagement, ask what should be completed by the end.
Required capabilities
The company chooses:
Must-have
Helpful
Trainable on the job
Evidence preferences
Ask:
What evidence would make you want to talk to someone?
Options:
Deployed product
GitHub repository
Research paper
Writing sample
Spreadsheet model
Presentation
Design portfolio
Previous employer confirmation
Professor or supervisor endorsement
Club project contribution
Prior startup work
Video walkthrough
Covenda Work Record
Logistics
Availability
Time zone
Meeting expectations
Work authorization
Required tools
Travel
Security requirements
Evaluation process
Profile review
Interview
Company assessment
External assessment provider
Portfolio walkthrough
Reference call
Paid trial
No additional assessment
The company owns its evaluation criteria.

Step 5: Company discovers candidates
The company has two modes.
Browse mode
The company explores students whose privacy settings allow discovery.
Filters may include:
Capability
Evidence type
Evidence verification state
Availability
Compensation
Time zone
Engagement preference
Industry interest
Location
Graduation year
School, when relevant
Referrer type
Prior Work Record
Do not use hidden personality or intelligence scores.
Curated shortlist mode
The company submits a Talent Brief.
Covenda returns approximately three to five relevant candidates.
Each match explanation should say:
Which requirement is supported
What evidence supports it
What is only self-reported
What requirement is missing
What remains uncertain
Candidate card
The company sees:
Student headline
Availability
Desired work
Relevant capability claims
Evidence cards
Contribution
Outcome
Observer
Verification state
Limitations
Why the student appears relevant
Full contact details remain hidden until the student approves the introduction.

Step 6: Company requests an introduction
The company clicks:
Request introduction
It sends:
Opportunity
Why the student appears relevant
Compensation
Time commitment
Next step
Optional personal message
The student receives:
Atlas AI would like to speak with you about a 10-hour-per-week product role. They selected you because of your React evidence card and confirmed contribution to a student product.
The student can:
Accept
Ask a question
Decline
Report concern
Only after acceptance does direct communication open.

Step 7: Interview or assessment
The company may:
Conduct its own interview
Use its own coding challenge
Request a portfolio walkthrough
Use a third-party assessment such as Litmus
Request reference calls
Offer a paid trial
Hire directly
Covenda does not need to replace these systems.
The platform should track the status without pretending to judge the outcome.

Step 8: Company creates a paid trial
If the company chooses a trial, it completes the fields described earlier:
Purpose
Deliverable
Inputs
Hours
Payment
Criteria
Reviewer
AI policy
IP
Confidentiality
Timeline
Potential next step
Covenda reviews only for:
Required information
Clear compensation
Obvious policy violations
Student safety
Prohibited unpaid work
Restricted information
Missing decision-maker
Impossible or deceptive terms
Covenda does not certify the technical quality of the trial.

Step 9: Company manages the trial
The company dashboard shows:
Trial status
Participants
Questions
Deliverables
Review due dates
Payment status
Required actions
Decisions
The company may:
Answer questions
Review submissions
Request the agreed revision
Accept
Decline
Offer a role
Offer another engagement
Students should receive clear decision timelines.

Step 10: Company makes a hiring decision
Possible outcomes:
Interview completed
Paid trial completed
Internship offered
Part-time role offered
Full-time role offered
Another project offered
No offer
Student declined
Company withdrew
Engagement completed
Covenda should ask:
Which evidence mattered?
Was the shortlist relevant?
How much time did Covenda save?
Would the company use Covenda again?
Would the company refer another startup?
Did the student perform as expected?
What was missing from the profile?
These outcomes become your future authority.

Step 11: Company referrals and repeat usage
After a successful result, companies can:
Request another shortlist
Reopen a prior Talent Brief
Invite a previous student
Refer another company
Share a private referral link
Receive a service credit
Join a recurring hiring plan
Company-to-company referrals should be rewarded only after the referred company:
Verifies its account
Creates a legitimate Talent Brief
Requests introductions
Pays for a service or hires
Do not base the company's initial growth plan on a speculative partnership with one large recruiting platform. Build direct outcome evidence first.

Company dashboard navigation
Home
Active hiring activity
Required actions
New student responses
Saved candidates
Trial deadlines
Recent outcomes
Talent
Browse
Saved candidates
Curated shortlists
Candidate comparison
Opportunities
Drafts
Active
Closed
Applications
Trials
Draft
Invited
In progress
Under review
Completed
Messages
Mutually approved student conversations
Covenda support
Company Profile
Public profile
Team members
Verification
Visibility
Billing
Search fees
Placement fees
Trial funding
Invoices
Payment history
Settings
Permissions
Notifications
Privacy
Data retention
Integrations

Accessibility and safety features you missed
Accessibility
Keyboard navigation
Screen-reader labels
High color contrast
Captions for videos
Text alternative to video
Accessible file-upload status
Flexible form timeouts
Saved drafts
Clear error messages
Reduced-motion support
Accommodation request process
No mandatory camera use
Student safety
Verified companies only
Compensation shown before application
Report and block
Clear confidentiality terms
No request for banking information through chat
No unpaid useful trials
No production credentials in uploads
No off-platform payment pressure
Human dispute review
No public student contact information by default
Company safety
Student identity verification
Evidence-status labels
Artifact provenance
AI-use disclosure
Confidentiality acceptance
File scanning
Report and block
Contribution disputes
Company-controlled evaluation

Core database entities
Your development architecture will likely need:
users
student_profiles
student_preferences
capability_claims
evidence_items
evidence_verifications
referral_invites
endorsements
company_profiles
company_members
talent_briefs
opportunities
applications
introduction_requests
conversations
messages
paid_trials
trial_participants
trial_materials
trial_submissions
company_evaluations
work_records
outcomes
payments
reports
audit_events
Do not build every table simultaneously. This establishes the conceptual model.

What belongs in V1
Build now
Student side
Self-signup
Referral-link tracking
Identity and email verification
Capability claims
Evidence cards
Artifact links
Structured endorsements
Availability and preferences
Privacy controls
Shareable profile
Company visibility toggle
Company side
Account and domain verification
Public company profile
Talent Brief
Student discovery
Evidence-based filters
Saved candidates
Introduction requests
Student approval
Messaging
Outcome tracking
Covenda operator side
Company verification queue
Student evidence-review queue
Endorsement verification
Report handling
Introduction oversight
Outcome records
Add after initial introductions work
Opportunity postings
Applications
Candidate comparison
Curated shortlist workflow
Company billing
Search fee or placement fee
Add after employer demand is demonstrated
Paid trial workflow
Trial funding
Submission management
Company evaluation
Work Records
Company referrals
Build later
Talent batches
Automated matching
Referrer credibility models
University dashboards
Club cohort dashboards
Assessment integrations
Employer subscriptions
Public API
Advanced analytics
Recommendation models

The two most important product decisions
1. Do not create an open trial marketplace
The student should not be able to begin any company trial merely by clicking a card.
Use:
Browse -> Apply -> Shortlist -> Paid invitation -> Begin work
This protects the student and company.
2. Do not call every profile vetted
Use evidence states:
Self-reported
Artifact linked
Contribution confirmed
Observer verified
Employer confirmed
Covenda work-verified
This accurately communicates trust without overstating your authority.

Final student journey
Discovers Covenda
-> Creates account
-> Joins through self-signup or referral
-> Verifies identity
-> Chooses capabilities and preferences
-> Adds one evidence-backed project
-> Optionally requests an endorsement
-> Chooses company visibility
-> Explores verified companies and opportunities
-> Applies with relevant evidence
-> Approves company introduction
-> Interviews or accepts paid trial
-> Completes engagement
-> Receives verified Work Record

Final company journey
Discovers Covenda
-> Verifies company account
-> Builds public company profile
-> Browses evidence-backed students
-> Creates Talent Brief
-> Receives explainable shortlist
-> Requests introductions
-> Interviews or invites paid trial
-> Evaluates candidate using company criteria
-> Hires, extends, or declines
-> Confirms outcome
-> Returns for another search or refers a company

Final distinction
Component
Purpose
Proof Profile
Shows what the student claims and what supports it
Referral
Explains how the student entered the network
Endorsement
Confirms a specific observed contribution
Talent Brief
Defines what the company needs and what evidence it trusts
Opportunity
Describes the actual role or engagement
Paid Trial
Lets a company evaluate a shortlisted candidate through compensated work
Work Record
Records an employer-confirmed result
Batch
Later discovery cohort, not an assessment or trial

The product should center on one clear transaction:
A verified company asks for a type of talent, Covenda shows a small number of students with traceable evidence, and the student decides whether to accept the introduction.
Everything else should support that transaction rather than compete with it.


\clearpage

# Appendix E: Software and AI Batch Enhancement

> Source appendix. Included to preserve prior Covenda material. The integrated blueprint above controls when source drafts conflict.

# Covenda  -  Software & AI Batch System Enhancement
## Polymathic Engineering, High Agency, Technical Breadth & Evidence-Based Profiles

You are modifying the existing Covenda platform.

Your goal is NOT to create another generic coding assessment or résumé parser.

The objective is to redesign the Software & AI vertical so that Covenda can identify, represent, and showcase the types of early-career technical talent that high-performing engineering organizations increasingly value:

- High agency
- Ability to learn independently
- Technical competence
- Breadth across multiple technical domains
- Ability to actually build and ship
- Evidence of initiative
- Ability to operate without perfect instructions
- Ability to move between disciplines
- Ability to use modern AI tools effectively
- Ability to understand systems rather than only solve isolated coding problems
- Ability to collaborate and communicate technical decisions
- Evidence of repeatedly taking an idea from concept -> implementation -> deployment -> iteration

The central product insight is:

> A strong software engineer is not necessarily the person with the highest score on a standardized coding test. They may be a polymathic builder who has repeatedly demonstrated initiative, technical curiosity, and the ability to independently turn ambiguous problems into working systems.

Covenda should therefore become capable of evaluating the FULL BODY OF TECHNICAL EVIDENCE a student has accumulated.

Do not remove the existing vetting system.

Extend it.

---

# 1. CORE PRODUCT CHANGE

The current system should not treat:

- GitHub
- résumé
- coding assessment
- project
- hackathon
- internship
- open-source contribution
- research
- technical writing

as isolated profile fields.

Instead, create a unified:

## TECHNICAL EVIDENCE GRAPH

Each piece of evidence should contribute to an individual's technical profile.

The system should understand relationships between:

Student
-> Project
-> Technical Skill
-> Technical Domain
-> Role
-> Evidence
-> Verification
-> Demonstrated Agency
-> Demonstrated Ownership
-> Demonstrated Breadth
-> Demonstrated Depth

For example:

Student builds an AI application.

Evidence:
- GitHub repository
- Commit history
- Deployment
- Product demo
- Technical documentation
- API integrations
- Database design
- Model evaluation
- User testing

This should not become "AI Project: Yes."

Instead, Covenda should infer and display:

- Python
- API integration
- database design
- backend engineering
- AI/ML integration
- deployment
- product thinking
- independent execution
- technical breadth

while clearly separating:

- verified
- partially verified
- self-reported
- human-reviewed
- inferred

Do not overclaim what evidence proves.

---

# 2. POLYMATHIC ENGINEERING PROFILE

Create a new Software & AI profile framework.

The student should be able to demonstrate capability across multiple dimensions.

## A. TECHNICAL DEPTH

Examples:

- Algorithms
- Systems
- Backend
- Frontend
- Infrastructure
- Databases
- AI/ML
- Security
- Distributed systems
- Robotics
- Embedded systems

## B. TECHNICAL BREADTH

Measure demonstrated exposure across domains.

For example:

A candidate may have:

- Python
- TypeScript
- React
- PostgreSQL
- AWS
- Docker
- LLM APIs
- Computer vision

This should create a visual "technical surface area" rather than a simple skill list.

Do NOT rank students against one another.

The purpose is to show employers:

"Here is the breadth of systems this person has actually interacted with."

## C. HIGH AGENCY

Create a dedicated "Agency Evidence" category.

Potential signals:

- Started a project without being assigned one
- Built a product independently
- Organized a hackathon
- Contributed to open source
- Created a technical community
- Identified a problem and built a solution
- Deployed a product
- Acquired real users
- Iterated after user feedback
- Learned a new technical stack independently
- Built something outside formal coursework
- Repeatedly shipped projects

Do not simply award points for "started a project."

The system should ask:

What did the candidate actually do?

What decisions did they make?

What constraints did they overcome?

What changed because of their work?

---

# 3. HACKATHONS AS A DISTINCT EVIDENCE RAIL

Add Hackathons as a first-class evidence category.

Hackathons should NOT simply be treated as extracurricular activities.

They can demonstrate:

- Speed of learning
- Rapid prototyping
- Team collaboration
- Technical execution
- Product judgment
- Ability to work under ambiguity
- Ability to learn unfamiliar tools
- Ability to ship under time constraints

The platform should allow students to submit:

- Hackathon name
- Date
- Team size
- Student's role
- Project
- Technologies used
- Repository
- Demo
- Presentation
- Award / placement
- What the student personally built
- What changed during the event
- Technical challenges
- What they learned

Verification options:

1. Hackathon organizer verification
2. Public project page
3. GitHub repository
4. Demo
5. Submission URL
6. Team member confirmation
7. Candidate defense

IMPORTANT:

Winning a hackathon should NOT automatically mean the candidate is technically superior.

A non-winning project may demonstrate more technical depth.

The system must evaluate:

- Technical complexity
- Candidate ownership
- Execution
- Innovation
- Completeness
- Ability to explain decisions

Create a "Hackathon Evidence Card."

Example:

## Hackathon
Project: AI Research Assistant

Role:
Backend + AI integration

Built:
- Retrieval pipeline
- API layer
- Database
- Evaluation framework

Evidence:
GitHub + Demo + Defense

Verified:
Technical ownership: High
Project completion: Verified
Award: Not applicable

Skills demonstrated:
Python
LLM APIs
Backend
Data pipelines
Product engineering

---

# 4. OPEN SOURCE EVIDENCE

Create a first-class Open Source evidence type.

Support:

- GitHub
- GitLab
- Public repositories
- Pull requests
- Issues
- Code reviews
- Documentation contributions

Do not measure quality by raw commit count.

A candidate with 500 meaningless commits should not outrank someone with 3 meaningful contributions.

Analyze:

- PR complexity
- Issue difficulty
- Code review interaction
- Maintainer feedback
- Contribution acceptance
- Scope of change
- Longitudinal involvement

Potential verification:

- Repository
- PR URL
- Merge status
- Maintainer confirmation
- Candidate defense

---

# 5. BUILDING & SHIPPING EVIDENCE

Add "Shipped Product" as an evidence rail.

Students can submit:

- App
- Website
- SaaS
- API
- Mobile app
- AI application
- Developer tool
- Infrastructure project

Capture:

- URL
- GitHub
- Deployment platform
- Technology stack
- Users
- Usage metrics if available
- Student's role
- Timeline
- Iterations

Do not overvalue vanity metrics.

A product with 20 real users may be more meaningful than an app claiming 10,000 visitors with no evidence.

The system should evaluate:

Build
-> Deploy
-> Operate
-> Learn
-> Iterate

This is a much stronger signal of agency than "completed project."

---

# 6. AI-ERA SOFTWARE ENGINEERING

Assume candidates use:

- Cursor
- Claude
- ChatGPT
- GitHub Copilot
- AI coding agents

Do not attempt to ban AI.

Instead, assess:

- Can the candidate understand generated code?
- Can they debug it?
- Can they modify it?
- Can they explain architecture?
- Can they identify hallucinations?
- Can they evaluate tradeoffs?
- Can they improve generated code?
- Can they make decisions when the AI is wrong?

Add "AI-Assisted Engineering" as a capability.

The candidate should be allowed to disclose:

- Tools used
- What AI generated
- What they personally changed
- What they verified
- What they learned

Then conduct a brief ownership defense.

Example:

"You used an AI coding assistant to generate this component. Explain:
1. Why this architecture was chosen.
2. What you changed.
3. What could fail in production.
4. How you would redesign it at 10x scale."

The goal is not to punish AI usage.

The goal is to distinguish:

"Uses AI to avoid thinking"

from

"Uses AI to accelerate technical execution."

---

# 7. TECHNICAL POLYMATH SIMULATION

Create a new optional simulation:

## THE POLYMATH BUILDER CHALLENGE

The candidate receives an ambiguous problem.

They are given:

- No exact implementation instructions
- Limited documentation
- Several possible technical approaches
- A time constraint

They must:

1. Clarify the problem
2. Choose a technical approach
3. Learn unfamiliar technology
4. Build a prototype
5. Test it
6. Debug it
7. Explain tradeoffs
8. Adapt when requirements change

The simulation should dynamically introduce a new requirement.

Example:

Initial:
"Build an API that processes user data."

New requirement:
"Traffic increased 100x."

Then:

"Data now contains sensitive information."

Then:

"Latency must be reduced."

This tests:

- Learning velocity
- Architecture
- Adaptability
- Systems thinking
- Security awareness
- Agency

The objective is not simply whether the final code works.

Capture the process.

---

# 8. SOFTWARE BATCH PERSONALIZATION

Each company should be able to customize what type of engineer they want.

Example:

Company A:

AI startup

Priorities:
- AI/ML
- Python
- Fast prototyping
- Product engineering
- High agency

Company B:

Infrastructure company

Priorities:
- Distributed systems
- Linux
- Networking
- Reliability
- Systems thinking

Company C:

Early-stage SaaS

Priorities:
- Full-stack
- Product sense
- Shipping
- Customer feedback
- Breadth

The student profile should dynamically explain:

"This opportunity appears highly aligned because..."

Do not simply output:

Compatibility: 87%

Instead show:

Strong alignment:
- Python
- AI/ML
- rapid prototyping
- independent projects

Potential gap:
- production-scale infrastructure

Evidence:
- verified AI project
- hackathon
- GitHub
- technical defense

---

# 9. COMPANY-SPECIFIC EVIDENCE REQUESTS

Allow employers to request specific evidence.

Example:

"We are looking for students who have built and deployed AI applications."

Covenda generates:

Recommended evidence:
- deployed application
- GitHub
- technical walkthrough
- AI architecture defense

Another company:

"We need infrastructure engineers."

Recommended:

- systems project
- cloud deployment
- debugging challenge
- architecture simulation

This turns the batch system into a configurable professional evidence system.

---

# 10. SOFTWARE VERTICAL DASHBOARD

Create:

## TECHNICAL PROFILE

### Technical Breadth
Visual map of demonstrated domains.

### Technical Depth
Deepest verified capabilities.

### Agency
Independent projects, products, hackathons, open source.

### Builder History
Timeline of things actually shipped.

### AI Engineering
AI-assisted work and technical understanding.

### Collaboration
Open-source, team, hackathon evidence.

### Verification
Verified / human reviewed / self-reported.

### Current Gaps
What the student has not demonstrated yet.

### Recommended Next Evidence
The most valuable next simulation or project.

Do not display a single "engineering quality score."

The profile should feel like a professional technical portfolio plus verified evidence system.

---

# 11. BACKEND REQUIREMENTS

Add support for:

- evidence_type
- technical_domain
- skill
- skill_depth
- skill_breadth
- agency_signal
- ownership_level
- verification_level
- project_status
- deployment_status
- collaboration_signal
- hackathon_metadata
- open_source_metadata
- ai_assistance_disclosure
- defense_result

Create reusable evidence objects.

Do not duplicate logic for every evidence type.

---

# 12. FINAL IMPLEMENTATION REQUIREMENT

Before coding:

1. Inspect existing Covenda batch architecture.
2. Inspect current compatibility engine.
3. Inspect current evidence model.
4. Inspect current admission engine.
5. Inspect current connectors.
6. Extend existing systems instead of replacing them.

Build the Software & AI vertical as the reference implementation for how future verticals should work.

The end state should allow Covenda to say:

"Here is what this person says they can do."

"Here is what they have actually built."

"Here is what has been verified."

"Here is what they demonstrated in a realistic simulation."

"Here is the breadth of their technical interests."

"Here is the depth of their strongest areas."

"Here is the evidence of agency."

"Here is what remains uncertain."

"Here is why this person may be relevant to your specific engineering team."

That is the product standard.