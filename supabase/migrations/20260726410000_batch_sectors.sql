-- §13 slice 6: batches move from SKILL level to SECTOR level, five per vertical.
--
-- "Financial modelling" is how a curriculum splits finance; a fund recruits for private
-- equity. Same in engineering: a robotics team hires for physical AI, not for "full-stack".
-- Sector is also what a club maps onto — a consulting group feeds management consulting.
--
-- Superseded slugs are ARCHIVED rather than deleted, so any application already attached
-- to one keeps its foreign key and its history.
--
-- Idempotent; safe to re-run.

update public.batches set status = 'archived' where slug in ('ml-engineering','full-stack','data-engineering','qa-reliability','financial-modelling','equity-research','accounting-operations','health-data','merchandising-analytics','research-strategy');

insert into public.batches (slug, name, discipline, tier, status, capacity, access_credits, description, admission_version)
values
  ('ai-ml', 'AI & machine learning', 'Software & AI', 'elite', 'open', 24, 25,
   'Training runs, evaluation harnesses and inference code, read from the account that owns them so the commit timeline shows how the work accumulated.', 'batch-admission-1.0.0'),
  ('physical-ai', 'Physical AI & robotics', 'Software & AI', 'elite', 'open', 20, 25,
   'Robotics and control code with its history, plus a walkthrough of something that worked in simulation and failed on hardware.', 'batch-admission-1.0.0'),
  ('infrastructure-data', 'Infrastructure & data', 'Software & AI', 'open', 'open', 20, 15,
   'Pipeline and transformation code with its commit history, plus a walkthrough of a failure you had to trace.', 'batch-admission-1.0.0'),
  ('product-engineering', 'Product engineering', 'Software & AI', 'elite', 'open', 24, 25,
   'Application code judged on structure and testing habits rather than line count, with ownership verified through a connected account.', 'batch-admission-1.0.0'),
  ('security-reliability', 'Security & reliability', 'Software & AI', 'open', 'open', 18, 15,
   'Test suites, incident write-ups and issue histories, read from the account that owns them.', 'batch-admission-1.0.0'),
  ('investment-banking', 'Investment banking', 'Accounting & finance', 'elite', 'open', 24, 25,
   'The workbook itself is read — formula integrity and structure against a published rubric. A model of pasted values scores low by construction.', 'batch-admission-1.0.0'),
  ('private-equity', 'Private equity', 'Accounting & finance', 'elite', 'open', 20, 25,
   'An LBO or diligence model parsed for structure and circularity handling, plus a live defence of the assumptions driving returns.', 'batch-admission-1.0.0'),
  ('venture-capital', 'Venture capital', 'Accounting & finance', 'elite', 'open', 20, 25,
   'A written investment memo plus an unscripted defence — in early-stage work the reasoning is the whole artifact.', 'batch-admission-1.0.0'),
  ('asset-wealth-management', 'Asset & wealth management', 'Accounting & finance', 'open', 'open', 20, 15,
   'A portfolio or research note with its assumptions stated, and where a paper-trading account is connected, a timestamped order trail read for risk discipline — never for P&L.', 'batch-admission-1.0.0'),
  ('accounting-audit', 'Accounting & audit', 'Accounting & finance', 'open', 'open', 24, 15,
   'A worked reconciliation or close checklist parsed for structure, plus a walkthrough of how you found an error.', 'batch-admission-1.0.0'),
  ('clinical-operations', 'Clinical operations', 'Healthcare operations', 'elite', 'open', 16, 25,
   'A de-identified process artifact, a walkthrough scored by two raters, and a named supervisor answering cross-checked questions.', 'batch-admission-1.0.0'),
  ('health-analytics', 'Health data & analytics', 'Healthcare operations', 'open', 'open', 16, 15,
   'An analysis you can walk through end to end, plus a referral from whoever reviewed it.', 'batch-admission-1.0.0'),
  ('revenue-cycle', 'Payer & revenue cycle', 'Healthcare operations', 'open', 'open', 14, 15,
   'A de-identified claims or denials analysis, plus a walkthrough of what you changed and what it recovered.', 'batch-admission-1.0.0'),
  ('regulatory-quality', 'Regulatory & quality', 'Healthcare operations', 'elite', 'open', 14, 25,
   'A quality or compliance artifact plus a structured referral from the supervisor who signed off on it.', 'batch-admission-1.0.0'),
  ('digital-health-product', 'Digital health product', 'Healthcare operations', 'open', 'open', 14, 15,
   'A product artifact — spec, flow, or research synthesis — with a walkthrough of the constraint that shaped it.', 'batch-admission-1.0.0'),
  ('growth-performance', 'Growth & performance', 'Consumer & retail', 'open', 'open', 24, 15,
   'A bounded, budgeted exercise inside Covenda-provisioned tooling, where the platform recorded the outcome.', 'batch-admission-1.0.0'),
  ('brand-content', 'Brand & content', 'Consumer & retail', 'open', 'open', 20, 15,
   'A campaign or content artifact plus an unscripted defence of the choices — which is the part a model cannot sit for.', 'batch-admission-1.0.0'),
  ('merchandising', 'Merchandising & assortment', 'Consumer & retail', 'open', 'open', 20, 15,
   'A worked analysis with its assumptions stated, plus a recorded walkthrough.', 'batch-admission-1.0.0'),
  ('supply-chain', 'Supply chain & operations', 'Consumer & retail', 'open', 'open', 18, 15,
   'A forecast or inventory analysis, plus a walkthrough of where your model was wrong and why.', 'batch-admission-1.0.0'),
  ('ecommerce-marketplace', 'E-commerce & marketplace', 'Consumer & retail', 'open', 'open', 18, 15,
   'An instrumented exercise or a worked funnel analysis, defended on record.', 'batch-admission-1.0.0'),
  ('management-consulting', 'Management consulting', 'Professional services', 'elite', 'open', 24, 25,
   'A written case or recommendation plus an unscripted defence of how you framed the problem.', 'batch-admission-1.0.0'),
  ('strategy-research', 'Strategy & research', 'Professional services', 'open', 'open', 24, 15,
   'A research sample plus an unscripted defence on sources, method and the choices you made.', 'batch-admission-1.0.0'),
  ('market-intelligence', 'Market intelligence', 'Professional services', 'open', 'open', 18, 15,
   'A landscape or competitive analysis with sources cited, defended on record.', 'batch-admission-1.0.0'),
  ('legal-operations', 'Legal operations', 'Professional services', 'open', 'open', 16, 15,
   'A process or contract-review artifact plus a referral from whoever checked it.', 'batch-admission-1.0.0'),
  ('technical-writing', 'Technical writing', 'Professional services', 'open', 'open', 20, 15,
   'A documentation sample and a walkthrough of what you had to learn to write it.', 'batch-admission-1.0.0')
on conflict (slug) do nothing;

notify pgrst, 'reload schema';
