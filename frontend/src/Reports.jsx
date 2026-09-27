import { useState } from 'react';
import { request } from './api';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const control = { padding: '10px 14px', border: '1px solid #d8cebf', borderRadius: 8, font: 'inherit' };
const button = { ...control, background: '#1A2744', color: '#fff', cursor: 'pointer' };

function ReportTable({ headings, rows }) {
  return <div style={{ overflowX: 'auto', marginTop: 12 }}><table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
    <thead><tr>{headings.map(h => <th key={h} scope="col" style={{ padding: 12, background: '#F5E6D0' }}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} style={{ padding: 12, borderBottom: '1px solid #eee' }}>{cell}</td>)}</tr>)}</tbody>
  </table></div>;
}

export default function Reports() {
  const [type, setType] = useState('weekly');
  const [date, setDate] = useState(today);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  async function generate(event) {
    event.preventDefault();
    setBusy(true); setError(''); setReport(null);
    try { setReport(await request(`/reports?${new URLSearchParams({ type, date })}`)); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }

  async function download() {
    setDownloading(true); setError('');
    try {
      const blob = await request(`/reports?${new URLSearchParams({ type: report.type, date: report.start, format: 'docx' })}`, { responseType: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `lightnation-${report.type}-${report.start}.docx`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setError(error.message); }
    finally { setDownloading(false); }
  }

  return <section style={{ background: '#fff', padding: 24, borderRadius: 16 }}>
    <h2 style={{ marginTop: 0, color: '#1A2744' }}>Attendance reports</h2>
    <p>View a weekly or monthly Sunday attendance report and download it as a Word document.</p>
    <form onSubmit={generate} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
      <label>Report type<br /><select style={control} value={type} disabled={busy || downloading} onChange={e => { setType(e.target.value); setReport(null); }}><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
      <label>{type === 'monthly' ? 'Month' : 'Choose a date in the week'}<br /><input required style={control} type={type === 'monthly' ? 'month' : 'date'} value={type === 'monthly' ? date.slice(0, 7) : date} disabled={busy || downloading} onChange={e => { setDate(type === 'monthly' && e.target.value ? e.target.value + '-01' : e.target.value); setReport(null); }} /></label>
      <button style={button} disabled={busy || downloading}>{busy ? 'Loading…' : 'View report'}</button>
    </form>
    {error && <p role="alert" style={{ color: '#a12b36' }}>{error}</p>}
    {report && <div aria-live="polite">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 24 }}>
        <h3>{report.start} to {report.end}</h3>
        <button style={button} disabled={downloading} onClick={download}>{downloading ? 'Downloading…' : 'Download .docx'}</button>
      </div>
      <p>Reliable history from {report.coverageStart}. {report.start < report.coverageStart && <strong>This period includes dates without reliable history; those dates are excluded.</strong>}</p>
      <p style={{ fontSize: 13, color: '#666' }}>{report.note}</p>
      {!report.sundays.length ? <p>No reportable Sundays in this period.</p> : <>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{[
          ['Attendance (child-Sundays)', report.totalAttendance], ['Absences (child-Sundays)', report.totalAbsences], ['Unique children attending', report.uniqueAttendees]
        ].map(([label, count]) => <div key={label} style={{ padding: 16, background: '#FDF6EC', borderRadius: 10, flex: '1 1 180px' }}><strong style={{ fontSize: 26 }}>{count}</strong><div>{label}</div></div>)}</div>
        <ReportTable headings={['Sunday', 'Registered', 'Attended', 'Absent']} rows={report.sundays.map(s => [s.date + (s.provisional ? ' (provisional)' : ''), s.registered, s.attended, s.absent])} />
        {report.type === 'monthly' && <><h3>Absent for more than two Sundays</h3><p>Children who missed at least three completed Sundays this month.</p>{report.frequentAbsentees.length ? <ReportTable headings={['Child', 'Tag', 'Sundays absent', 'Absent dates']} rows={report.frequentAbsentees.map(c => [c.name, c.tag, c.absentDates.length, c.absentDates.join(', ')])} /> : <p>No children meet this threshold.</p>}</>}
        <h3>Children attendance</h3>
        <ReportTable headings={['Child', 'Tag', 'Sundays attended', 'Sundays absent']} rows={report.roster.map(c => [c.name, c.tag, c.attended, c.absent])} />
      </>}
    </div>}
  </section>;
}
