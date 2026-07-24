import { createClient } from '@supabase/supabase-js';

import { supabaseConfiguration } from './submissions.js';

// Student of the Week — PUBLIC read endpoint. Returns ONLY a strict whitelist of
// public-safe fields for the ONE student who both (a) explicitly opted in
// (spotlight_consent) and (b) was featured by the operator (featured_at). No contact
// info, ever — networking routes through Covenda. Empty object when none is set, so the
// homepage section hides cleanly. Service-role read; this whitelist IS the gatekeeper.

function tierFromClaims(claims) {
  const tiers = new Set((claims || []).map(c => c.verification_tier));
  if (tiers.has('trial')) return 'gold';
  if (tiers.has('referral')) return 'silver';
  if (tiers.has('artifact')) return 'bronze';
  return null;
}

export async function loadFeaturedStudent(supabase) {
  const { data: profile } = await supabase
    .from('member_profiles')
    .select('user_id, display_name, headline, school_name, graduation_year, avatar_url, identity_verified, skills, verticals, work_types, spotlight_consent, featured_at')
    .eq('role', 'student')
    .eq('spotlight_consent', true)
    .not('featured_at', 'is', null)
    .order('featured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!profile) return null;

  let claims = [];
  try {
    const { data } = await supabase.from('skill_claim').select('verification_tier').eq('student_user_id', profile.user_id).limit(200);
    claims = Array.isArray(data) ? data : [];
  } catch { claims = []; }

  let projects = [];
  try {
    const { data } = await supabase
      .from('member_projects')
      .select('title, verticals, status, completed_at, conversion_outcome')
      .eq('assigned_student_user_id', profile.user_id)
      .eq('status', 'complete')
      .order('completed_at', { ascending: false })
      .limit(2);
    projects = Array.isArray(data) ? data : [];
  } catch { projects = []; }

  const completedCount = projects.length; // capped view; count query below refines when possible
  let verifiedCount = completedCount;
  try {
    const { count } = await supabase.from('member_projects').select('id', { count: 'exact', head: true }).eq('assigned_student_user_id', profile.user_id).eq('status', 'complete');
    if (Number.isFinite(count)) verifiedCount = count;
  } catch { /* keep capped view */ }

  // STRICT WHITELIST — nothing else leaves this endpoint. No email, no user id, no PII
  // beyond the consented public profile fields.
  return {
    name: profile.display_name || 'Covenda student',
    headline: profile.headline || '',
    school: profile.school_name || '',
    graduationYear: profile.graduation_year || null,
    avatarUrl: profile.avatar_url || '',
    identityVerified: profile.identity_verified === true,
    skills: (profile.skills || []).slice(0, 8),
    verticals: (profile.verticals || []).slice(0, 4),
    workTypes: (profile.work_types || []).slice(0, 4),
    evidenceTier: tierFromClaims(claims),
    verifiedRecords: verifiedCount,
    projects: projects.map(p => ({
      title: p.title,
      vertical: (p.verticals || [])[0] || '',
      shipped: true, // status complete = reviewer accepted
      outcome: p.conversion_outcome && p.conversion_outcome !== 'none' ? p.conversion_outcome : null,
    })),
  };
}

export default async function handler(req, res, dependencies = {}) {
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false }); }
  try {
    const env = dependencies.env || process.env;
    const configuration = supabaseConfiguration(env);
    const createSupabaseClient = dependencies.createSupabaseClient || createClient;
    const supabase = createSupabaseClient(configuration.url, configuration.secret, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const featured = await loadFeaturedStudent(supabase);
    return res.status(200).json({ ok: true, featured: featured || null });
  } catch {
    // Never break the homepage over this — an empty payload just hides the section.
    return res.status(200).json({ ok: true, featured: null });
  }
}
