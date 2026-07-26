-- §13 slice 5: batches split by SPECIALISATION.
--
-- One batch per vertical was too coarse to hire against — nobody recruits for Software,
-- they recruit for ML engineering or QA. Vetting stays a property of the vertical (the rails
-- are identical across its specialisations); the batch is what the work actually is.
--
-- The 5 vertical-level rows seeded by 20260726380000 are retired rather than deleted, so any
-- application already attached to one keeps its foreign key.
--
-- Idempotent; safe to re-run.

update public.batches set status = 'archived'
 where slug in ('software-ai','accounting-finance','healthcare-operations','consumer-retail','professional-services');

insert into public.batches (slug, name, discipline, tier, status, capacity, access_credits, description, admission_version)
values
  ('ml-engineering', 'ML engineering', 'Software & AI', 'elite', 'open', 24, 25,
   'Training runs, evaluation harnesses and inference code — read from the account that owns them, with the commit timeline showing how the work accumulated.',
   'batch-admission-1.0.0'),
  ('full-stack', 'Full-stack engineering', 'Software & AI', 'elite', 'open', 24, 25,
   'Application code, reviewed for structure and testing habits rather than line count, with ownership verified through a connected account.',
   'batch-admission-1.0.0'),
  ('data-engineering', 'Data engineering', 'Software & AI', 'open', 'open', 20, 15,
   'Pipeline and transformation code with its commit history, plus a walkthrough of a failure you had to debug.',
   'batch-admission-1.0.0'),
  ('qa-reliability', 'QA & reliability', 'Software & AI', 'open', 'open', 20, 15,
   'Test suites and issue histories, read from the account that owns them.',
   'batch-admission-1.0.0'),
  ('financial-modelling', 'Financial modelling', 'Accounting & finance', 'elite', 'open', 24, 25,
   'The workbook itself is read — formula integrity and DCF structure. A model of pasted values scores low by construction.',
   'batch-admission-1.0.0'),
  ('equity-research', 'Equity research', 'Accounting & finance', 'elite', 'open', 20, 25,
   'A written thesis plus a live defence scored by two raters against anchored exemplars.',
   'batch-admission-1.0.0'),
  ('accounting-operations', 'Accounting operations', 'Accounting & finance', 'open', 'open', 24, 15,
   'A worked reconciliation or close checklist, parsed for structure, plus a walkthrough of how you found an error.',
   'batch-admission-1.0.0'),
  ('clinical-operations', 'Clinical operations', 'Healthcare operations', 'elite', 'open', 16, 25,
   'A de-identified process artifact, a walkthrough scored by two raters, and a named supervisor answering cross-checked questions.',
   'batch-admission-1.0.0'),
  ('health-data', 'Health data & reporting', 'Healthcare operations', 'open', 'open', 16, 15,
   'An analysis you can walk through end to end, plus a referral from whoever reviewed it.',
   'batch-admission-1.0.0'),
  ('growth-performance', 'Growth & performance', 'Consumer & retail', 'open', 'open', 24, 15,
   'A bounded, budgeted exercise inside Covenda-provisioned tooling, where the platform recorded the outcome.',
   'batch-admission-1.0.0'),
  ('merchandising-analytics', 'Merchandising & analytics', 'Consumer & retail', 'open', 'open', 20, 15,
   'A worked analysis with its assumptions stated, plus a recorded walkthrough.',
   'batch-admission-1.0.0'),
  ('research-strategy', 'Research & strategy', 'Professional services', 'open', 'open', 24, 15,
   'A research sample plus an unscripted defence on sources, method and the choices you made.',
   'batch-admission-1.0.0'),
  ('technical-writing', 'Technical writing', 'Professional services', 'open', 'open', 20, 15,
   'A documentation sample and a walkthrough of what you had to learn to write it.',
   'batch-admission-1.0.0')
on conflict (slug) do nothing;

notify pgrst, 'reload schema';
