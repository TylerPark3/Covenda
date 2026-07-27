import test from 'node:test';
import assert from 'node:assert/strict';

await import('../industry-taxonomy.js');

const taxonomy = globalThis.CovendaIndustryTaxonomy;

test('startup taxonomy stays broad at the first click and deep at the second', () => {
  assert.equal(taxonomy.groups.length, 6);
  assert.deepEqual(taxonomy.groups.map(group => group.label), [
    'Technology',
    'Finance',
    'Health',
    'Consumer',
    'Business',
    'Climate & industry',
  ]);
  assert.ok(taxonomy.groups.every(group => group.sectors.length >= 8));
  assert.equal(new Set(taxonomy.groups.flatMap(group => group.sectors)).size, taxonomy.groups.flatMap(group => group.sectors).length);
});

test('taxonomy keeps the five existing work contracts and maps legacy profiles forward', () => {
  assert.deepEqual(taxonomy.workTypes.map(item => item.value), [
    'Research',
    'Data & spreadsheets',
    'Operations',
    'QA & testing',
    'Writing & documentation',
  ]);
  assert.equal(taxonomy.legacyGroups['Software & AI'], 'Technology');
  assert.equal(taxonomy.legacyGroups['Accounting & finance'], 'Finance');
  assert.equal(taxonomy.legacyGroups['Not sure yet — show me everything'], taxonomy.openChoice);
});
