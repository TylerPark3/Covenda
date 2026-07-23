// §9 public cohort page. Reads ?ref=REF-XXXXXX, asks /api/cohort for the aggregate (PII-free)
// funnel, and renders it. All copy is honest: every count is real, higher rungs are earned. No
// individual student is ever shown here — the endpoint only returns numbers.
(function () {
  'use strict';
  const $ = (sel) => document.querySelector(sel);

  function readCode() {
    let params;
    try { params = new URLSearchParams(location.search); } catch { return ''; }
    const raw = (params.get('ref') || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40);
    return raw;
  }
  function readVia() {
    let params;
    try { params = new URLSearchParams(location.search); } catch { return ''; }
    // A partner's own public label from their shareable link — sanitized, rendered via textContent only.
    return (params.get('via') || '').replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  function statCard(rung) {
    const card = document.createElement('div');
    card.className = 'cohort-stat' + (rung.count > 0 ? ' is-active' : '');
    const count = document.createElement('span');
    count.className = 'cohort-stat-count';
    count.textContent = String(rung.count);
    const label = document.createElement('span');
    label.className = 'cohort-stat-label';
    label.textContent = rung.label;
    const note = document.createElement('small');
    note.className = 'cohort-stat-note';
    note.textContent = rung.note || '';
    card.append(count, label, note);
    return card;
  }

  function renderBars(root, industries) {
    root.replaceChildren();
    const total = industries.reduce((sum, item) => sum + item.count, 0) || 1;
    industries.forEach((item) => {
      const pct = Math.round((item.count / total) * 100);
      const li = document.createElement('li');
      li.className = 'cohort-bar';
      const head = document.createElement('div');
      head.className = 'cohort-bar-head';
      const name = document.createElement('span');
      name.textContent = item.label;
      const value = document.createElement('span');
      value.className = 'cohort-bar-value';
      value.textContent = item.count + ' · ' + pct + '%';
      head.append(name, value);
      const track = document.createElement('div');
      track.className = 'cohort-bar-track';
      const fill = document.createElement('i');
      fill.style.width = Math.max(pct, 6) + '%';
      track.append(fill);
      li.append(head, track);
      root.append(li);
    });
  }

  function render(cohort, via) {
    const org = cohort.orgName || via || '';
    $('#cohortOrg').textContent = org ? org + ' · Covenda cohort' : 'A Covenda cohort';
    if (org) $('#cohortEyebrow').textContent = 'Partner cohort';

    if (cohort.isEmpty) {
      $('#cohortSub').textContent = org
        ? 'This is where ' + org + '’s Covenda students will appear as they build proof.'
        : 'This cohort doesn’t have any students traced to it yet.';
      $('#cohortEmptyState').hidden = false;
      $('#cohortPanel').hidden = true;
      return;
    }

    const total = Math.max(cohort.endorsedCount, cohort.appliedCount);
    $('#cohortSub').textContent = total === 1
      ? '1 student, from endorsement to real, reviewed work.'
      : total + ' students, from endorsement to real, reviewed work.';

    const funnel = $('#cohortFunnel');
    funnel.replaceChildren();
    (cohort.funnel || []).forEach((rung) => funnel.append(statCard(rung)));

    if ((cohort.industries || []).length) {
      renderBars($('#cohortBars'), cohort.industries);
      $('#cohortBreakdown').hidden = false;
    }
    $('#cohortPanel').hidden = false;
  }

  function fail(message) {
    $('#cohortSub').textContent = message;
    $('#cohortEmptyState').hidden = false;
    $('#cohortPanel').hidden = true;
  }

  async function load() {
    const code = readCode();
    const via = readVia();
    if (!code) { fail('This link is missing its cohort code. Ask your partner for their full Covenda cohort link.'); return; }
    try {
      const res = await fetch('/api/cohort?ref=' + encodeURIComponent(code));
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.cohort) throw new Error(data.error || 'Could not load this cohort.');
      render(data.cohort, via);
    } catch (error) {
      fail('This cohort could not be loaded right now. Please try again shortly.');
    }
  }

  load();
})();
