-- Skill-inference: store a student's evidence-based skill signals (GitHub analysis, and later
-- artifact assessments) on their profile. JSONB keyed by source, e.g. { "github": [ { repo,
-- url, skills:[{skill,score,evidence,source,confidence}], flags, needsReview, analyzedAt } ] }.
-- Per-skill only by construction — there is deliberately no overall person-score column.
-- The analyze-github endpoint persists here best-effort; until this runs, analysis still
-- returns for display (persistence is skipped gracefully).

alter table if exists public.member_profiles
  add column if not exists skill_signals jsonb not null default '{}'::jsonb;
