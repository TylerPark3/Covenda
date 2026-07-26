-- §4c messaging upgrade: file attachments + pinned messages on project threads.
-- Attachments reuse the same {name, blobUrl, contentType, sizeBytes} shape as project files
-- (stored private in Vercel Blob). Pinning lets a participant keep a scope note / milestone at
-- the top of the thread. Body may now be empty WHEN there is at least one attachment (an
-- attachment-only message) — the API enforces "body or attachment present". Idempotent.

alter table public.project_messages
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists pinned boolean not null default false,
  add column if not exists pinned_at timestamptz;

-- Relax the body-length constraint from "1..4000" to "0..4000" so attachment-only messages are
-- allowed; the not-empty-unless-attachment rule lives in the API (sendProjectMessage).
alter table public.project_messages
  drop constraint if exists project_messages_body_length,
  add constraint project_messages_body_length check (char_length(body) <= 4000);

-- Fast lookup of a thread's pinned messages.
create index if not exists project_messages_pinned_idx
  on public.project_messages (project_id) where pinned;

-- The original table granted only select+insert (append-only). Pinning is the first UPDATE
-- path, so grant it to the service role (still no delete — history is never destroyed).
grant update on table public.project_messages to service_role;

notify pgrst, 'reload schema';
