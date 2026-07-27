-- A club's public presence.
--
-- Registration captured a name, a school and a contact email — none of which anyone can
-- check. A website or an Instagram account is the cheapest real evidence a club exists, and
-- it is what an operator would look for first anyway.
--
-- Two columns rather than one, because for student clubs the social account is very often
-- the ONLY presence; treating it as a fallback for a "real" website would have the field
-- read as second-class when it is usually the primary one.
--
-- Idempotent: safe to re-run.

alter table public.clubs
  add column if not exists website_url text,
  add column if not exists social_url text;

notify pgrst, 'reload schema';
