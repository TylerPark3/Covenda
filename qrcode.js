// Dependency-free QR Code generator (byte mode, ECC level M, versions 1–10).
//
// Written for Covenda's per-partner join QR codes: each partner's referral link is a different
// URL, so the code must be generated at view time — this runs in the browser (ES module used by
// join-qr.html) and in Node (verified against a `segno` reference in tests/qrcode.test.js).
//
// Correctness is PROVEN, not assumed: tests/qrcode.test.js asserts this encoder's output matrix
// is byte-identical to segno's across versions 1–10 at a fixed mask, plus mask auto-selection.
//
// Scope: byte mode + ECC M covers any realistic URL (v10 ≈ 213 bytes). Longer input throws.

// ---- Galois field GF(256), primitive polynomial 0x11d --------------------------------------
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function initGf() {
  let x = 1;
  for (let i = 0; i < 255; i += 1) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
})();
const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

// Reed–Solomon: generator polynomial of degree `n`, then remainder of data·x^n mod generator.
// Built as (x - α^0)(x - α^1)…(x - α^(n-1)). The accumulator below indexes by ASCENDING degree,
// so it is reversed on return — rsEncode's synthetic division wants DESCENDING order with the
// leading 1 first (gen[0] === 1), matching the classic polynomial-long-division formulation.
function rsGenerator(n) {
  let g = [1];
  for (let i = 0; i < n; i += 1) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j += 1) {
      next[j] ^= gfMul(g[j], EXP[i]);
      next[j + 1] ^= g[j];
    }
    g = next;
  }
  return g.reverse();
}
function rsEncode(data, n) {
  const gen = rsGenerator(n);
  const res = new Array(n).fill(0);
  for (const d of data) {
    const factor = d ^ res[0];
    res.shift(); res.push(0);
    for (let j = 0; j < n; j += 1) res[j] ^= gfMul(gen[j + 1] || 0, factor);
  }
  return res;
}

// ---- Version tables (ECC level M) ----------------------------------------------------------
// version -> { ec: ecCodewordsPerBlock, groups: [[numBlocks, dataPerBlock], ...] }
const ECC_M = {
  1: { ec: 10, groups: [[1, 16]] },
  2: { ec: 16, groups: [[1, 28]] },
  3: { ec: 26, groups: [[1, 44]] },
  4: { ec: 18, groups: [[2, 32]] },
  5: { ec: 24, groups: [[2, 43]] },
  6: { ec: 16, groups: [[4, 27]] },
  7: { ec: 18, groups: [[4, 31]] },
  8: { ec: 22, groups: [[2, 38], [2, 39]] },
  9: { ec: 22, groups: [[3, 36], [2, 37]] },
  10: { ec: 26, groups: [[4, 43], [1, 44]] },
};
const dataCodewords = v => ECC_M[v].groups.reduce((s, [n, d]) => s + n * d, 0);

// Alignment pattern centre coordinates per version (empty for v1).
const ALIGN = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};
// 18-bit version information (v7+), MSB first.
const VERSION_INFO = {
  7: 0x07C94, 8: 0x085BC, 9: 0x09A99, 10: 0x0A4D3,
};

function charCountBits(version) { return version <= 9 ? 8 : 16; }

// Smallest version 1..10 whose byte capacity holds `len` bytes.
function pickVersion(len) {
  for (let v = 1; v <= 10; v += 1) {
    const cap = Math.floor((dataCodewords(v) * 8 - 4 - charCountBits(v)) / 8);
    if (len <= cap) return v;
  }
  throw new Error('That link is too long for a QR code (max ~213 characters).');
}

// ---- Bitstream -> full (interleaved) codeword sequence --------------------------------------
function encodeData(bytes, version) {
  const bits = [];
  const push = (val, n) => { for (let i = n - 1; i >= 0; i -= 1) bits.push((val >> i) & 1); };
  push(0b0100, 4);                       // byte mode
  push(bytes.length, charCountBits(version));
  for (const b of bytes) push(b, 8);
  const total = dataCodewords(version) * 8;
  for (let i = 0; i < 4 && bits.length < total; i += 1) bits.push(0); // terminator
  while (bits.length % 8) bits.push(0);
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) codewords.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  const pad = [0xEC, 0x11];
  for (let i = 0; codewords.length < dataCodewords(version); i += 1) codewords.push(pad[i % 2]);

  // Split into blocks, compute EC per block, then interleave data then EC (spec order).
  const { ec, groups } = ECC_M[version];
  const dataBlocks = []; const ecBlocks = [];
  let ptr = 0;
  for (const [n, d] of groups) {
    for (let b = 0; b < n; b += 1) {
      const block = codewords.slice(ptr, ptr + d); ptr += d;
      dataBlocks.push(block);
      ecBlocks.push(rsEncode(block, ec));
    }
  }
  const result = [];
  const maxData = Math.max(...dataBlocks.map(b => b.length));
  for (let i = 0; i < maxData; i += 1) for (const b of dataBlocks) if (i < b.length) result.push(b[i]);
  for (let i = 0; i < ec; i += 1) for (const b of ecBlocks) result.push(b[i]);
  return result;
}

// ---- Matrix construction -------------------------------------------------------------------
function makeMatrix(version, codewords, forcedMask) {
  const size = version * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(null));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false)); // function/reserved

  const setFn = (r, c, val) => { if (r >= 0 && r < size && c >= 0 && c < size) { m[r][c] = val; fn[r][c] = true; } };

  // Finder patterns + separators at the three corners.
  const finder = (r0, c0) => {
    for (let dr = -1; dr <= 7; dr += 1) for (let dc = -1; dc <= 7; dc += 1) {
      const r = r0 + dr; const c = c0 + dc;
      if (r < 0 || r >= size || c < 0 || c >= size) continue;
      const inRing = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6
        && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
      setFn(r, c, inRing ? 1 : 0);
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

  // Timing patterns.
  for (let i = 8; i < size - 8; i += 1) { setFn(6, i, i % 2 === 0 ? 1 : 0); setFn(i, 6, i % 2 === 0 ? 1 : 0); }

  // Alignment patterns. Only the three centres colliding with the FINDERS are skipped —
  // (first,first), (first,last), (last,first). Centres that merely cross the timing row/column
  // ARE drawn (they first appear at v7, e.g. centre (6,22)); testing `fn` here instead would
  // wrongly drop them, because timing has already marked those modules.
  const centres = ALIGN[version];
  const first = centres[0];
  const last = centres[centres.length - 1];
  for (const r of centres) for (const c of centres) {
    const finderCollision = (r === first && c === first) || (r === first && c === last) || (r === last && c === first);
    if (finderCollision) continue;
    for (let dr = -2; dr <= 2; dr += 1) for (let dc = -2; dc <= 2; dc += 1) {
      const ring = Math.max(Math.abs(dr), Math.abs(dc));
      setFn(r + dr, c + dc, ring === 1 ? 0 : 1);
    }
  }

  // Dark module + reserve format-info areas.
  setFn(size - 8, 8, 1);
  const reserveFormat = () => {
    for (let i = 0; i <= 8; i += 1) { if (!fn[8][i]) { fn[8][i] = true; m[8][i] = 0; } if (!fn[i][8]) { fn[i][8] = true; m[i][8] = 0; } }
    for (let i = 0; i < 8; i += 1) { if (!fn[8][size - 1 - i]) { fn[8][size - 1 - i] = true; m[8][size - 1 - i] = 0; } if (!fn[size - 1 - i][8]) { fn[size - 1 - i][8] = true; m[size - 1 - i][8] = 0; } }
  };
  reserveFormat();

  // Reserve version-info areas (v7+).
  if (version >= 7) {
    for (let i = 0; i < 6; i += 1) for (let j = 0; j < 3; j += 1) {
      fn[i][size - 11 + j] = true; m[i][size - 11 + j] = 0;
      fn[size - 11 + j][i] = true; m[size - 11 + j][i] = 0;
    }
  }

  // Data placement in the standard upward/downward zigzag, skipping function modules.
  const bits = [];
  for (const cw of codewords) for (let i = 7; i >= 0; i -= 1) bits.push((cw >> i) & 1);
  let bi = 0; let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1; // skip the vertical timing column
    for (let i = 0; i < size; i += 1) {
      const row = upward ? size - 1 - i : i;
      for (let k = 0; k < 2; k += 1) {
        const c = col - k;
        if (fn[row][c]) continue;
        m[row][c] = bi < bits.length ? bits[bi] : 0; bi += 1;
      }
    }
    upward = !upward;
  }

  // Mask, format info, and (v7+) version info. Choose the lowest-penalty mask unless forced.
  const maskFns = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];

  const applied = (maskIdx) => {
    const g = m.map(row => row.slice());
    for (let r = 0; r < size; r += 1) for (let c = 0; c < size; c += 1) {
      if (!fn[r][c] && maskFns[maskIdx](r, c)) g[r][c] ^= 1;
    }
    writeFormat(g, size, maskIdx);
    if (version >= 7) writeVersion(g, size, version);
    return g;
  };

  let best; let bestMask = 0;
  if (forcedMask != null) { best = applied(forcedMask); bestMask = forcedMask; }
  else {
    let bestPenalty = Infinity;
    for (let mask = 0; mask < 8; mask += 1) {
      const g = applied(mask);
      const p = penalty(g, size);
      if (p < bestPenalty) { bestPenalty = p; best = g; bestMask = mask; }
    }
  }
  return { matrix: best, size, version, mask: bestMask };
}

// 15-bit format information: (ecBits<<3 | mask), BCH(15,5), XOR 0x5412. ECC M ecBits = 0b00.
function formatBits(mask) {
  const data = (0b00 << 3) | mask;
  let rem = data << 10;
  for (let i = 14; i >= 10; i -= 1) if ((rem >> i) & 1) rem ^= 0b10100110111 << (i - 10);
  return ((data << 10) | rem) ^ 0b101010000010010;
}
function writeFormat(g, size, mask) {
  const bits = formatBits(mask);
  const bit = i => (bits >> i) & 1;
  // Copy 1: bits 0–5 run DOWN column 8; bits 9–14 run LEFT along row 8 (g is [row][col]).
  for (let i = 0; i <= 5; i += 1) g[i][8] = bit(i);
  g[7][8] = bit(6); g[8][8] = bit(7); g[8][7] = bit(8);
  for (let i = 9; i <= 14; i += 1) g[8][14 - i] = bit(i);
  // Copy 2: bits 0–7 run LEFT along row 8 from the right edge; bits 8–14 run UP column 8.
  for (let i = 0; i <= 7; i += 1) g[8][size - 1 - i] = bit(i);
  for (let i = 8; i <= 14; i += 1) g[size - 15 + i][8] = bit(i);
}
function writeVersion(g, size, version) {
  const bits = VERSION_INFO[version];
  for (let i = 0; i < 18; i += 1) {
    const b = (bits >> i) & 1;
    const r = Math.floor(i / 3); const c = i % 3;
    g[r][size - 11 + c] = b;
    g[size - 11 + c][r] = b;
  }
}

// ---- Mask penalty (ISO/IEC 18004 rules 1–4) ------------------------------------------------
function penalty(g, size) {
  let p = 0;
  // Rule 1: runs of 5+ same-colour in rows and columns.
  for (let r = 0; r < size; r += 1) {
    let runC = 1, runR = 1;
    for (let c = 1; c < size; c += 1) {
      if (g[r][c] === g[r][c - 1]) { runC += 1; if (runC === 5) p += 3; else if (runC > 5) p += 1; } else runC = 1;
      if (g[c][r] === g[c - 1][r]) { runR += 1; if (runR === 5) p += 3; else if (runR > 5) p += 1; } else runR = 1;
    }
  }
  // Rule 2: 2x2 blocks of the same colour.
  for (let r = 0; r < size - 1; r += 1) for (let c = 0; c < size - 1; c += 1) {
    const v = g[r][c];
    if (v === g[r][c + 1] && v === g[r + 1][c] && v === g[r + 1][c + 1]) p += 3;
  }
  // Rule 3: finder-like 1:1:3:1:1 patterns (with 4 light modules) in rows and columns.
  const pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const match = (arr, i, pat) => pat.every((v, k) => arr[i + k] === v);
  for (let r = 0; r < size; r += 1) {
    const row = g[r]; const col = g.map(x => x[r]);
    for (let i = 0; i + 11 <= size; i += 1) {
      if (match(row, i, pat1) || match(row, i, pat2)) p += 40;
      if (match(col, i, pat1) || match(col, i, pat2)) p += 40;
    }
  }
  // Rule 4: proportion of dark modules.
  let dark = 0;
  for (let r = 0; r < size; r += 1) for (let c = 0; c < size; c += 1) dark += g[r][c];
  const ratio = (dark * 100) / (size * size);
  p += Math.floor(Math.abs(ratio - 50) / 5) * 10;
  return p;
}

// ---- Public API ----------------------------------------------------------------------------
function toBytes(text) {
  // UTF-8 encode; TextEncoder in browsers/Node, Buffer fallback.
  if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(text));
  return Array.from(Buffer.from(text, 'utf8'));
}

// Exposed for tests: the Reed–Solomon step is cross-checked against an independent
// implementation, because a silent bug here yields codes that look right but never scan.
export const rsEncodeForTest = rsEncode;

// Returns { matrix: number[][] (0/1), size, version, mask }.
export function makeQrMatrix(text, { mask = null } = {}) {
  const bytes = toBytes(String(text));
  const version = pickVersion(bytes.length);
  const codewords = encodeData(bytes, version);
  return makeMatrix(version, codewords, mask);
}

// Render an SVG string. `scale` = module size in px; `border` = quiet-zone modules (>=4).
export function makeQrSvg(text, { scale = 8, border = 4, dark = '#1a1a17', light = '#ffffff', mask = null } = {}) {
  const { matrix, size } = makeQrMatrix(text, { mask });
  const dim = (size + border * 2) * scale;
  let path = '';
  for (let r = 0; r < size; r += 1) for (let c = 0; c < size; c += 1) {
    if (matrix[r][c]) path += `M${(c + border) * scale} ${(r + border) * scale}h${scale}v${scale}h-${scale}z`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" shape-rendering="crispEdges">`
    + `<rect width="${dim}" height="${dim}" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
}
