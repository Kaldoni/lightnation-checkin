const { Document, Packer, Paragraph, Table, TableRow, TableCell, HeadingLevel } = require('docx');
const day = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
const shift = (date, days) => new Date(Date.parse(date + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10);

function period(type, date) {
  if (!['weekly', 'monthly'].includes(type) || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || +date.slice(0, 4) < 1900) {
    throw new Error('Choose weekly or monthly and a valid date (YYYY-MM-DD).');
  }
  if (type === 'weekly') {
    const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
    const start = shift(date, -((weekday + 6) % 7));
    return { start, end: shift(start, 6) };
  }
  const start = date.slice(0, 7) + '-01';
  const next = new Date(start + 'T12:00:00Z');
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { start, end: shift(next.toISOString().slice(0, 10), -1) };
}

function buildReport(type, date, children, attendance, startedAt, now = new Date()) {
  const { start, end } = period(type, date);
  const today = day(now);
  // The installation day may have incomplete history, so coverage starts the next day.
  const coverageStart = shift(day(startedAt), 1);
  const dates = [];
  for (let d = start; d <= end && d <= today; d = shift(d, 1)) {
    if (d >= coverageStart && new Date(d + 'T12:00:00Z').getUTCDay() === 0) dates.push(d);
  }
  const present = new Set(attendance.map(row => `${row.child_id}:${day(row.checked_in_at)}`));
  const roster = children.map(child => {
    const eligible = dates.filter(d => d >= day(child.created_at));
    const absentDates = eligible.filter(d => !present.has(`${child.id}:${d}`));
    return { id: child.id, name: child.name, tag: child.tag, attended: eligible.length - absentDates.length, absent: absentDates.length, absentDates };
  }).filter(child => child.attended + child.absent > 0).sort((a, b) => a.name.localeCompare(b.name));
  const sundays = dates.map(date => {
    const eligible = children.filter(child => day(child.created_at) <= date);
    const attended = eligible.filter(child => present.has(`${child.id}:${date}`)).length;
    return { date, registered: eligible.length, attended, absent: eligible.length - attended, provisional: date === today };
  });
  return { type, start, end, coverageStart, generatedAt: now.toISOString(), sundays, roster,
    totalAttendance: sundays.reduce((sum, s) => sum + s.attended, 0),
    totalAbsences: sundays.reduce((sum, s) => sum + s.absent, 0),
    uniqueAttendees: roster.filter(c => c.attended > 0).length,
    frequentAbsentees: type === 'monthly' ? roster.filter(c => c.absentDates.filter(d => d < today).length > 2).map(c => ({ ...c, absentDates: c.absentDates.filter(d => d < today) })) : [],
    note: 'Sunday attendance in Africa/Lagos time. Weeks run Monday–Sunday. Totals count child-Sundays; repeat check-ins count once. Only Sundays on or after registration and full days of recorded history are included. Today is provisional; future Sundays are excluded. The more-than-two-Sundays list uses completed Sundays only. Deleted children are not included.' };
}

async function toDocx(report) {
  const paragraph = text => new Paragraph(String(text));
  const table = rows => new Table({ rows: rows.map(row => new TableRow({ children: row.map(text => new TableCell({ children: [paragraph(text)] })) })) });
  const blocks = [new Paragraph({ text: `LightNation ${report.type} attendance report`, heading: HeadingLevel.TITLE }),
    paragraph(`${report.start} to ${report.end}`), paragraph(`Generated: ${report.generatedAt}`),
    paragraph(`Reliable history from: ${report.coverageStart}`), paragraph(report.note),
    paragraph(`Attendance: ${report.totalAttendance} | Absences: ${report.totalAbsences} | Unique children attending: ${report.uniqueAttendees}`),
    table([['Sunday', 'Registered', 'Attended', 'Absent'], ...report.sundays.map(s => [s.date + (s.provisional ? ' (provisional)' : ''), s.registered, s.attended, s.absent])]),
    new Paragraph({ text: 'Children attendance', heading: HeadingLevel.HEADING_1 }),
    table([['Name', 'Tag', 'Sundays attended', 'Sundays absent'], ...report.roster.map(c => [c.name, c.tag, c.attended, c.absent])])];
  if (!report.sundays.length) blocks.push(paragraph('No reportable Sundays in this period.'));
  if (report.type === 'monthly') blocks.push(new Paragraph({ text: 'Absent for more than two Sundays', heading: HeadingLevel.HEADING_1 }),
    ...(report.frequentAbsentees.length ? [table([['Name', 'Tag', 'Absences', 'Dates'], ...report.frequentAbsentees.map(c => [c.name, c.tag, c.absentDates.length, c.absentDates.join(', ')])])] : [paragraph('No children meet this threshold.') ]));
  return Packer.toBuffer(new Document({ sections: [{ children: blocks }] }));
}

async function allRows(query) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await query().range(offset, offset + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

function registerReports(app, supabase, sendDatabaseError) {
  app.get('/api/reports', async (req, res) => {
    const { type, date, format } = req.query;
    let range;
    try { range = period(type, date); if (format && format !== 'docx') throw new Error('Unsupported report format.'); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    try {
      const { data: settings, error } = await supabase.from('reporting_settings').select('started_at').eq('id', 1).single();
      if (error || !settings) return res.status(503).json({ error: 'Attendance reporting is not configured. Run backend/reporting-migration.sql in Supabase.' });
      const [children, attendance] = await Promise.all([
        allRows(() => supabase.from('children').select('id,name,tag,created_at').order('id')),
        allRows(() => supabase.from('attendance').select('id,child_id,checked_in_at').gte('checked_in_at', range.start + 'T00:00:00+01:00').lt('checked_in_at', shift(range.end, 1) + 'T00:00:00+01:00').order('id'))
      ]);
      const report = buildReport(type, date, children, attendance, settings.started_at);
      if (format === 'docx') {
        res.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.set('Content-Disposition', `attachment; filename="lightnation-${type}-${report.start}.docx"`);
        return res.send(await toDocx(report));
      }
      return res.json(report);
    } catch (error) { return sendDatabaseError(res, error); }
  });
}
module.exports = { period, buildReport, toDocx, registerReports };
