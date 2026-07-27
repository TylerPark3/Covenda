// The material an exercise says it supplies.
//
// ── THE PROBLEM ───────────────────────────────────────────────────────────────────────
// Every exercise card said "we supply everything" and supplied nothing. `exercise.supplied`
// was a sentence describing a file — "a pipeline that drops about 3% of rows", "two sheets
// that should agree and do not" — and no such file existed. A student pressed the button and
// had nothing to work on, which makes the whole assessment a claim rather than a task.
//
// ── DETERMINISM IS THE WHOLE DESIGN ───────────────────────────────────────────────────
// Every applicant to a batch must receive the SAME file, or their submissions are not
// comparable and a rater is grading noise. So there is no Math.random here: a small seeded
// PRNG derives everything from the slug. The same slug always produces byte-identical output,
// which also means a rater can regenerate what the student saw months later.
//
// ── AND THE DEFECTS ARE REAL ──────────────────────────────────────────────────────────
// The bug in each file is genuinely present and genuinely findable. A synthetic file with a
// cosmetic flaw tests nothing; the leak in the training script really does leak, the two
// ledgers really do differ by the stated amounts, and the funnel's obvious drop really is a
// red herring with the real loss elsewhere.

export const EXERCISE_FILES_VERSION = 'exercise-files-1.0.0';

// Mulberry32. Small, fast, and deterministic — the point is reproducibility, not crypto.
function seeded(slug) {
  let h = 1779033703 ^ slug.length;
  for (let i = 0; i < slug.length; i++) {
    h = Math.imul(h ^ slug.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];
const between = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const csv = rows => rows.map(r => r.map(c => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c))).join(',')).join('\n');

// ── Builders ──────────────────────────────────────────────────────────────────────────
// Each returns { name, type, body }. Named by what a rater would look for.

const BUILDERS = {
  // The split leaks: `scale` is fit on the whole frame before the split, so validation sees
  // statistics from the training rows and reports ~98%.
  'ai-ml': () => ({
    name: 'train.py', type: 'text/x-python',
    body: `# Reported validation accuracy: 0.981
# Reported test accuracy on new data: 0.62
# Nobody has been able to explain the gap.

import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression

df = pd.read_csv("churn.csv")
y = df.pop("churned")

scaler = StandardScaler()
X = scaler.fit_transform(df)

X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.25, random_state=7)

model = LogisticRegression(max_iter=500)
model.fit(X_train, y_train)
print("validation accuracy:", model.score(X_val, y_val))
`,
  }),

  // Two ledgers, six real discrepancies: a transposition, a duplicate, a sign flip, a timing
  // difference, a rounding chain, and one genuinely missing row.
  'accounting-audit': slug => {
    const rnd = seeded(slug);
    const a = [['entry_id', 'date', 'description', 'amount']];
    const b = [['entry_id', 'date', 'description', 'amount']];
    const descs = ['Supplier invoice', 'Card settlement', 'Payroll run', 'Refund', 'Freight', 'Subscription', 'Bank fee'];
    for (let i = 1; i <= 40; i++) {
      const id = `E${String(1000 + i)}`;
      const d = `2026-0${between(rnd, 1, 6)}-${String(between(rnd, 10, 28)).padStart(2, '0')}`;
      const amt = (between(rnd, 500, 90000) / 100).toFixed(2);
      const desc = pick(rnd, descs);
      a.push([id, d, desc, amt]);
      if (i === 7) b.push([id, d, desc, String(amt).replace(/(\d)(\d)\./, '$2$1.')]); // transposed
      else if (i === 13) { b.push([id, d, desc, amt]); b.push([id, d, desc, amt]); }  // duplicated
      else if (i === 19) b.push([id, d, desc, (-amt).toFixed(2)]);                    // sign flipped
      else if (i === 26) b.push([id, `2026-07-02`, desc, amt]);                       // timing difference
      else if (i === 31) b.push([id, d, desc, (Number(amt) + 0.03).toFixed(2)]);      // rounding chain
      else if (i === 37) { /* missing from ledger B entirely */ }
      else b.push([id, d, desc, amt]);
    }
    return { name: 'ledgers.csv', type: 'text/csv', body: `# LEDGER A\n${csv(a)}\n\n# LEDGER B\n${csv(b)}\n` };
  },

  // The obvious drop is checkout. The real loss is mobile users failing at address validation
  // one step earlier, which the aggregate hides because desktop is healthy.
  'growth-performance': slug => {
    const rnd = seeded(slug);
    const rows = [['date', 'device', 'step', 'users']];
    const steps = ['landing', 'product', 'cart', 'address', 'payment', 'confirmed'];
    for (let d = 1; d <= 14; d++) {
      for (const device of ['desktop', 'mobile']) {
        let n = device === 'desktop' ? between(rnd, 900, 1100) : between(rnd, 1700, 2100);
        for (const step of steps) {
          rows.push([`2026-06-${String(d).padStart(2, '0')}`, device, step, n]);
          const keep = step === 'address' && device === 'mobile' ? 0.41
            : step === 'cart' ? 0.63
            : step === 'payment' ? 0.88 : 0.79;
          n = Math.round(n * keep);
        }
      }
    }
    return { name: 'funnel.csv', type: 'text/csv', body: csv(rows) + '\n' };
  },

  // Missingness is not random: the sickest patients are the ones with no follow-up recorded,
  // so any complete-case analysis reports better outcomes than reality.
  'health-analytics': slug => {
    const rnd = seeded(slug);
    const rows = [['patient_id', 'age_band', 'severity', 'los_days', 'followup_days', 'readmitted_30d']];
    for (let i = 1; i <= 300; i++) {
      const severity = between(rnd, 1, 5);
      const los = severity * between(rnd, 1, 3);
      const dropped = severity >= 4 && rnd() < 0.72;   // the sickest are the ones missing
      rows.push([
        `P${String(10000 + i)}`, pick(rnd, ['18-34', '35-49', '50-64', '65-79', '80+']),
        severity, los, dropped ? '' : between(rnd, 3, 45),
        dropped ? '' : (rnd() < 0.08 + severity * 0.04 ? 1 : 0),
      ]);
    }
    return { name: 'encounters.csv', type: 'text/csv', body: csv(rows) + '\n' };
  },

  // One reason code covers three distinct causes: eligibility, a coding mismatch, and a payer
  // rule change that started on a specific date.
  'revenue-cycle': slug => {
    const rnd = seeded(slug);
    const rows = [['claim_id', 'submitted', 'payer', 'cpt', 'denial_code', 'denial_text', 'amount']];
    for (let i = 1; i <= 220; i++) {
      const day = between(rnd, 1, 28);
      const submitted = `2026-05-${String(day).padStart(2, '0')}`;
      const payer = pick(rnd, ['Northlake', 'Corval', 'Ridgeway', 'Ambit']);
      const cpt = pick(rnd, ['99213', '99214', '20610', '93000', '71046']);
      const late = day >= 18 && payer === 'Corval';
      rows.push([`C${String(50000 + i)}`, submitted, payer, cpt, 'CO-97',
        late ? 'Bundled per payer policy' : rnd() < 0.5 ? 'Not eligible on date of service' : 'Procedure inconsistent with modifier',
        (between(rnd, 4000, 180000) / 100).toFixed(2)]);
    }
    return { name: 'denials.csv', type: 'text/csv', body: csv(rows) + '\n' };
  },

  // Demand has a structural break at week 27. Any model fitted on the full history is wrong
  // in a direction that costs money, and the exercise asks what being wrong costs.
  'supply-chain': slug => {
    const rnd = seeded(slug);
    const rows = [['week', 'sku', 'units', 'stockouts']];
    for (let w = 1; w <= 52; w++) {
      for (const sku of ['SKU-A', 'SKU-B', 'SKU-C']) {
        const base = sku === 'SKU-A' ? 400 : sku === 'SKU-B' ? 180 : 95;
        const shifted = w >= 27 && sku === 'SKU-A' ? 0.55 : 1;
        rows.push([w, sku, Math.round(base * shifted * (0.85 + rnd() * 0.3)), w >= 27 && sku === 'SKU-C' ? between(rnd, 0, 4) : 0]);
      }
    }
    return { name: 'demand.csv', type: 'text/csv', body: csv(rows) + '\n' };
  },

  // Demand looks healthy. Supply is concentrated in three sellers who are close to capacity,
  // so growth on the demand side makes the experience worse, not better.
  'ecommerce-marketplace': slug => {
    const rnd = seeded(slug);
    const rows = [['week', 'buyers_active', 'searches', 'sellers_active', 'listings', 'orders', 'unfilled_searches']];
    for (let w = 1; w <= 26; w++) {
      const buyers = 1200 + w * 140;
      const sellers = 90 + Math.round(w * 1.2);
      rows.push([w, buyers, buyers * 4, sellers, sellers * between(rnd, 6, 9),
        Math.min(buyers * 0.22, sellers * 26), Math.max(0, buyers * 4 - sellers * 190)]);
    }
    return { name: 'marketplace.csv', type: 'text/csv', body: csv(rows) + '\n' };
  },

  // Ten positions with vols and a correlation matrix. Sizing naively to equal weight breaches
  // the drawdown rule because three of them are effectively the same bet.
  'asset-wealth-management': slug => {
    const rnd = seeded(slug);
    const names = ['ARC', 'BLT', 'CDR', 'DVN', 'ELM', 'FRS', 'GLD', 'HRB', 'IVY', 'JNP'];
    const vol = names.map(() => (between(rnd, 900, 4200) / 100));
    const rows = [['ticker', 'annual_vol_pct', 'expected_return_pct']];
    names.forEach((n, i) => rows.push([n, vol[i].toFixed(1), (between(rnd, 200, 1400) / 100).toFixed(1)]));
    const corr = [['', ...names]];
    names.forEach((n, i) => corr.push([n, ...names.map((_, j) => {
      if (i === j) return '1.00';
      const clustered = [0, 3, 6].includes(i) && [0, 3, 6].includes(j);   // the same bet, three times
      return (clustered ? 0.87 + rnd() * 0.06 : 0.05 + rnd() * 0.35).toFixed(2);
    })]));
    return { name: 'portfolio.csv', type: 'text/csv',
      body: `# Maximum tolerated drawdown: 12%\n# POSITIONS\n${csv(rows)}\n\n# CORRELATIONS\n${csv(corr)}\n` };
  },

  // Runs clean, drops rows silently: an inner join on a key with nulls, plus a date parse that
  // returns NaT for one format and is then filtered away.
  'infrastructure-data': () => ({
    name: 'pipeline.py', type: 'text/x-python',
    body: `# Runs without error. Source has 41,882 rows; the output has 40,610.
# Nobody has been able to account for the difference.

import pandas as pd

events = pd.read_csv("events.csv")
users = pd.read_csv("users.csv")

events["ts"] = pd.to_datetime(events["ts"], format="%Y-%m-%d %H:%M:%S", errors="coerce")
events = events[events["ts"].notna()]

joined = events.merge(users, on="user_id", how="inner")
joined = joined[joined["amount"] > 0]

joined.to_parquet("out.parquet")
print("wrote", len(joined), "rows")
`,
  }),

  // Holds setpoint in simulation, oscillates on hardware: the derivative term is computed on
  // an unfiltered signal and the real encoder is noisy.
  'physical-ai': () => ({
    name: 'controller.py', type: 'text/x-python',
    body: `# Holds setpoint perfectly in simulation.
# On the rig it oscillates at roughly 6 Hz and gets worse as the gain rises.

KP, KI, KD = 2.4, 0.15, 0.9
DT = 0.005          # 200 Hz loop

integral = 0.0
last_error = 0.0

def step(setpoint, measured):
    global integral, last_error
    error = setpoint - measured
    integral += error * DT
    derivative = (error - last_error) / DT
    last_error = error
    return KP * error + KI * integral + KD * derivative

# Simulation feeds step() a clean value.
# The rig feeds it a raw encoder read, +/- 2 counts of noise, no filter anywhere.
`,
  }),
};

// Where the material genuinely IS a written brief — a consulting prompt, a design brief, a
// control description — the file is that brief, written out properly rather than pretended.
function briefFile(slug, exercise) {
  return {
    name: `${slug}-brief.md`, type: 'text/markdown',
    body: `# ${exercise.title}\n\n**Time:** ${exercise.minutes} minutes\n\n## What you have been given\n\n${exercise.supplied}\n\n## What to do\n\n${exercise.task}\n\n---\n\nEverything in this brief is synthetic. No real company, customer, patient or record appears anywhere in it.\n`,
  };
}

export function fileFor(slug, exercise) {
  if (!exercise) return null;
  const builder = BUILDERS[slug];
  const file = builder ? builder(slug) : briefFile(slug, exercise);
  return { ...file, slug, generated: 'deterministic', version: EXERCISE_FILES_VERSION };
}

export function hasGeneratedData(slug) {
  return Boolean(BUILDERS[slug]);
}

export const SUPPLIED_SLUGS = Object.keys(BUILDERS);
