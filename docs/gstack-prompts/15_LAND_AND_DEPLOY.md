# LAND AND DEPLOY

> Source: Covenda GStack Prompt Pack. Paste into the matching GStack skill.

Merge and deploy the approved Covenda pull request.

Before merge:

- confirm required reviews passed;
- confirm CI is green;
- confirm migrations are ordered and reversible where possible;
- confirm production secrets and Supabase environment variables exist;
- confirm feature flags;
- confirm backup or recovery plan for destructive changes.

After deploy:

- verify the production URL;
- verify all affected roles;
- verify RLS with authorized and unauthorized accounts;
- verify audit events;
- verify error monitoring;
- verify no illustrative data is presented as real;
- verify no user data became unintentionally public.

Stop and report rather than forcing deployment if any launch blocker appears.



---
