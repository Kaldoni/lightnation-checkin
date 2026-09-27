const { test } = require('node:test');
const assert = require('node:assert/strict');
const { period, buildReport, toDocx } = require('./reports');
const children = [
  { id: 1, name: 'Ada & Grace', tag: 'A1', created_at: '2026-07-01T00:00:00Z' },
  { id: 2, name: 'Ben', tag: 'B1', created_at: '2026-08-17T00:00:00Z' },
  { id: 3, name: 'Chika', tag: 'C1', created_at: '2026-07-01T00:00:00Z' },
];
const history = [
  { child_id: 1, checked_in_at: '2026-08-01T23:30:00Z' }, // Sunday in Lagos
  { child_id: 1, checked_in_at: '2026-08-02T09:00:00Z' }, // duplicate same Sunday
  { child_id: 1, checked_in_at: '2026-08-09T09:00:00Z' },
  { child_id: 1, checked_in_at: '2026-08-16T23:30:00Z' }, // Monday in Lagos
];
const monthly = now => buildReport('monthly', '2026-08-10', children, history, '2026-07-01T00:00:00Z', new Date(now));

test('periods use Monday to Sunday and calendar months, rejecting invalid input', () => {
  assert.deepEqual(period('weekly', '2026-08-02'), { start: '2026-07-27', end: '2026-08-02' });
  assert.deepEqual(period('monthly', '2024-02-20'), { start: '2024-02-01', end: '2024-02-29' });
  for (const date of ['2026-02-30', 'bad', '2026-13-01']) assert.throws(() => period('monthly', date));
  assert.throws(() => period('daily', '2026-08-02'));
});

test('monthly totals deduplicate visits, use Lagos dates, and exclude pre-registration Sundays', () => {
  const report = monthly('2026-09-01T12:00:00Z');
  assert.equal(report.sundays.length, 5);
  assert.equal(report.totalAttendance, 2);
  assert.equal(report.totalAbsences, 10);
  assert.equal(report.uniqueAttendees, 1);
  assert.equal(report.roster.find(c => c.id === 2).absent, 2);
  assert.deepEqual(report.frequentAbsentees.map(c => c.id), [1, 3]);
  assert.equal(report.frequentAbsentees[0].absentDates.length, 3);
});

test('future Sundays are excluded and current Sunday is provisional, not a completed absence', () => {
  const report = monthly('2026-08-16T12:00:00Z');
  assert.equal(report.sundays.length, 3);
  assert.equal(report.sundays[2].provisional, true);
  assert.equal(report.frequentAbsentees.length, 0);
  assert.equal(report.roster.some(c => c.id === 2), false);
});

test('history before installation cannot create false absences', () => {
  const report = buildReport('monthly', '2026-08-01', children, [], '2026-08-16T08:00:00Z', new Date('2026-09-01T00:00:00Z'));
  assert.deepEqual(report.sundays.map(s => s.date), ['2026-08-23', '2026-08-30']);
  assert.equal(report.frequentAbsentees.length, 0);
  const empty = buildReport('monthly', '2026-06-01', children, [], '2026-08-16T08:00:00Z');
  assert.equal(empty.sundays.length, 0);
});

test('weekly attendance remains present after checkout and counts children once', () => {
  const report = buildReport('weekly', '2026-08-02', children, history.map(c => ({ ...c, checked_out_at: '2026-08-02T12:00:00Z' })), '2026-07-01T00:00:00Z', new Date('2026-09-01T00:00:00Z'));
  assert.equal(report.totalAttendance, 1);
  assert.equal(report.totalAbsences, 1);
});

test('download is a real Word package containing report tables and escaped names', async () => {
  const buffer = await toDocx(monthly('2026-09-01T12:00:00Z'));
  assert.equal(buffer.subarray(0, 2).toString(), 'PK');
  const zip = await require('jszip').loadAsync(buffer);
  assert.ok(zip.file('[Content_Types].xml'));
  const xml = await zip.file('word/document.xml').async('string');
  assert.match(xml, /Ada &amp; Grace/);
  assert.match(xml, /Absent for more than two Sundays/);
  assert.match(xml, /2026-08-30/);
});
