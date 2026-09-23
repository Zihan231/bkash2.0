'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { COLLEGES } from '@/lib/social-campaign';
import { clearSubmissions, deleteSubmission, listSubmissions, type SocialSubmission } from '@/lib/social-store';
import { addSampleSubmissions } from '@/lib/social-sample';
import { downloadBlob, downloadCsv, downloadZip, formatDateTime, screenshotFileName } from '@/lib/social-export';

// Demo login only: credentials are checked in the browser, so this is not real security.
const DEMO_USERNAME = 'admin';
const DEMO_PASSWORD = 'bkash123';
const SESSION_KEY = 'social-admin-session';
const PAGE_SIZE = 20;

type Toast = { type: 'success' | 'error'; message: string } | null;
type ConfirmAction = { kind: 'one'; submission: SocialSubmission } | { kind: 'all' } | null;

function readSession() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSession(on: boolean) {
  try {
    if (on) sessionStorage.setItem(SESSION_KEY, '1');
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage unavailable: the login simply won't survive a reload.
  }
}

function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString();
}

function LoginCard({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (username.trim() === DEMO_USERNAME && password === DEMO_PASSWORD) {
      writeSession(true);
      onLogin();
    } else {
      setError('Invalid username or password.');
    }
  };

  return (
    <div className="social-admin social-admin-login">
      <div className="card">
        <img className="social-admin-login-logo" src="/logos/bkash.svg" alt="bKash" />
        <h1 className="card-title">Admin Login</h1>
        <p className="card-sub">Sign in to view social campaign submissions.</p>
        {error && <div className="err center" role="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="admin-username">Username</label>
            <input id="admin-username" type="text" autoComplete="username" value={username} onChange={(e) => { setUsername(e.target.value); setError(''); }} autoFocus required />
          </div>
          <div className="field">
            <label htmlFor="admin-password">Password</label>
            <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} required />
          </div>
          <button type="submit" className="btn-primary">Sign In</button>
        </form>
        <p className="social-admin-hint">Demo login: <strong>{DEMO_USERNAME}</strong> / <strong>{DEMO_PASSWORD}</strong></p>
      </div>
    </div>
  );
}

export default function SocialAdmin() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [submissions, setSubmissions] = useState<SocialSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [college, setCollege] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SocialSubmission | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState<Toast>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => setAuthed(readSession()), []);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    try {
      setSubmissions(await listSubmissions());
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load submissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    load();
    // Pick up submissions made in another tab when the admin comes back to this one.
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [authed, load]);

  useEffect(() => {
    const urls: Record<string, string> = {};
    submissions.forEach((s) => { urls[s.id] = URL.createObjectURL(s.screenshot); });
    setThumbs(urls);
    return () => Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
  }, [submissions]);

  useEffect(() => {
    if (!selected && !confirm) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setSelected(null);
      setConfirm(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, confirm]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    return submissions.filter((s) => {
      if (college && s.college !== college) return false;
      if (!q) return true;
      if (s.name.toLowerCase().includes(q)) return true;
      return Boolean(qDigits) && [s.contactNumber, s.bkashNumber, s.friendBkashNumber].some((n) => n.includes(qDigits));
    });
  }, [submissions, search, college]);

  useEffect(() => setPage(1), [search, college]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const stats = useMemo(() => ({
    total: submissions.length,
    today: submissions.filter((s) => isToday(s.createdAt)).length,
    colleges: new Set(submissions.map((s) => s.college)).size,
    contacts: new Set(submissions.map((s) => s.contactNumber)).size,
  }), [submissions]);

  const collegeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    submissions.forEach((s) => counts.set(s.college, (counts.get(s.college) ?? 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [submissions]);

  const withBusy = async (label: string, action: () => Promise<void>, success?: string) => {
    if (busy) return;
    setBusy(label);
    try {
      await action();
      if (success) showToast('success', success);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setBusy('');
    }
  };

  const handleExportCsv = () => {
    if (!filtered.length) return;
    downloadCsv(filtered);
    showToast('success', `Exported ${filtered.length} submission${filtered.length === 1 ? '' : 's'} to CSV.`);
  };

  const handleExportZip = () => {
    if (!filtered.length) return;
    withBusy('zip', () => downloadZip(filtered), 'ZIP download started.');
  };

  const handleConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === 'one') {
      const { submission } = confirm;
      withBusy('delete', async () => {
        await deleteSubmission(submission.id);
        setConfirm(null);
        if (selected?.id === submission.id) setSelected(null);
        await load();
      }, 'Submission deleted.');
    } else {
      withBusy('delete', async () => {
        await clearSubmissions();
        setConfirm(null);
        setSelected(null);
        await load();
      }, 'All submissions deleted.');
    }
  };

  const logout = () => {
    writeSession(false);
    setAuthed(false);
  };

  if (authed === null) return <div className="social-admin admin-auth-loading" />;
  if (!authed) return <LoginCard onLogin={() => { setLoading(true); setAuthed(true); }} />;

  return (
    <div className="social-admin admin-shell">
      {toast && (
        <div className={`admin-toast ${toast.type === 'success' ? 'admin-toast-success' : ''}`} role="status">{toast.message}</div>
      )}

      {sidebarOpen && <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-logo">
          <img src="/logos/bkash.svg" alt="" className="social-admin-sidebar-logo" />
          <span className="admin-logo-text">Admin</span>
        </div>
        <nav className="admin-sidebar-nav">
          <button type="button" className="admin-nav-item active" onClick={() => setSidebarOpen(false)}>
            <span className="admin-nav-label">Submissions</span>
          </button>
          <a className="admin-nav-item" href="/social/" target="_blank" rel="noreferrer">
            <span className="admin-nav-label">Open campaign form ↗</span>
          </a>
        </nav>
        <div className="admin-sidebar-footer">
          <span className="admin-sidebar-user">Signed in as {DEMO_USERNAME}</span>
          <button type="button" className="admin-sidebar-logout" onClick={logout}>Logout</button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-content-topbar">
          <div className="admin-content-topbar-left">
            <button type="button" className="admin-hamburger" onClick={() => setSidebarOpen(true)}>Menu</button>
            <h1 className="admin-section-title">Submissions</h1>
          </div>
          <div className="admin-content-actions">
            <button type="button" className="btn-secondary admin-btn-inline" onClick={() => load()}>Refresh</button>
            <button type="button" className="btn-secondary admin-btn-inline" onClick={handleExportCsv} disabled={!filtered.length}>
              Export CSV ({filtered.length})
            </button>
            <button type="button" className="btn-primary admin-btn-inline" onClick={handleExportZip} disabled={!filtered.length || Boolean(busy)}>
              {busy === 'zip' ? 'Preparing ZIP…' : 'Download all (CSV + screenshots)'}
            </button>
          </div>
        </div>

        <p className="admin-info-banner social-admin-banner">
          Prototype: submissions are stored in this browser only. Submissions made on another device or browser won&apos;t appear here.
        </p>

        <div className="admin-stats-grid">
          <div className="admin-stat-card"><div className="admin-stat-num">{stats.total}</div><div className="admin-stat-label">Total submissions</div></div>
          <div className="admin-stat-card"><div className="admin-stat-num success">{stats.today}</div><div className="admin-stat-label">Submitted today</div></div>
          <div className="admin-stat-card"><div className="admin-stat-num info">{stats.contacts}</div><div className="admin-stat-label">Unique contact numbers</div></div>
          <div className="admin-stat-card"><div className="admin-stat-num warn">{stats.colleges}</div><div className="admin-stat-label">Colleges represented</div></div>
        </div>

        {collegeCounts.length > 0 && (
          <section className="admin-panel social-admin-colleges" aria-labelledby="college-breakdown-title">
            <div className="admin-panel-head"><h2 className="admin-panel-title" id="college-breakdown-title">Submissions by college</h2></div>
            {collegeCounts.map(([name, count]) => (
              <div className="admin-bar-row" key={name}>
                <span className="admin-bar-label" title={name}>{name}</span>
                <span className="admin-bar-track"><span className="admin-bar-fill" style={{ width: `${(count / collegeCounts[0][1]) * 100}%` }} /></span>
                <span className="admin-bar-count">{count}</span>
              </div>
            ))}
          </section>
        )}

        <div className="social-admin-toolbar">
          <input
            className="admin-input social-admin-search"
            type="search"
            placeholder="Search name or phone number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search submissions"
          />
          <select className="admin-select social-admin-college" value={college} onChange={(e) => setCollege(e.target.value)} aria-label="Filter by college">
            <option value="">All colleges</option>
            {COLLEGES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="social-admin-count">
            {filtered.length === submissions.length ? `${submissions.length} total` : `${filtered.length} of ${submissions.length}`}
          </span>
        </div>

        {loadError ? (
          <div className="admin-empty">{loadError}</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Screenshot</th>
                  <th>Name</th>
                  <th>College</th>
                  <th>Contact</th>
                  <th>bKash</th>
                  <th>Friend&apos;s bKash</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="admin-empty-cell" colSpan={9}>Loading submissions…</td></tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td className="admin-empty-cell" colSpan={9}>
                      {submissions.length === 0 ? (
                        <>
                          No submissions yet. Submit the <a href="/social/" target="_blank" rel="noreferrer">campaign form</a> in this browser,
                          {' '}or{' '}
                          <button type="button" className="social-admin-link" onClick={() => withBusy('sample', async () => { await addSampleSubmissions(); await load(); }, 'Sample submissions added.')} disabled={Boolean(busy)}>
                            {busy === 'sample' ? 'adding sample data…' : 'add sample data'}
                          </button>.
                        </>
                      ) : 'No submissions match your filters.'}
                    </td>
                  </tr>
                ) : pageRows.map((s, i) => {
                  const index = (currentPage - 1) * PAGE_SIZE + i;
                  return (
                    <tr key={s.id}>
                      <td>{index + 1}</td>
                      <td>
                        <div className="admin-thumb-cell">
                          {thumbs[s.id] && (
                            <button type="button" className="social-admin-thumb-btn" onClick={() => setSelected(s)} aria-label={`View ${s.name}'s submission`}>
                              <img className="admin-thumb" src={thumbs[s.id]} alt="" />
                            </button>
                          )}
                          <button type="button" className="admin-dl-btn" title="Download screenshot" aria-label={`Download ${s.name}'s screenshot`} onClick={() => downloadBlob(s.screenshot, screenshotFileName(s))}>↓</button>
                        </div>
                      </td>
                      <td className="social-admin-name">{s.name}</td>
                      <td className="social-admin-college-cell" title={s.college}>{s.college}</td>
                      <td>{s.contactNumber}</td>
                      <td>{s.bkashNumber}</td>
                      <td>{s.friendBkashNumber}</td>
                      <td>{formatDateTime(s.createdAt)}</td>
                      <td>
                        <div className="admin-row-actions">
                          <button type="button" className="btn-secondary admin-btn-sm" onClick={() => setSelected(s)}>View</button>
                          <button type="button" className="admin-delete-btn" onClick={() => setConfirm({ kind: 'one', submission: s })}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 && (
          <div className="admin-pagination">
            <button type="button" className="btn-secondary admin-btn-sm" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}>Previous</button>
            <span className="admin-page-info">Page {currentPage} of {pageCount}</span>
            <button type="button" className="btn-secondary admin-btn-sm" onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount}>Next</button>
          </div>
        )}

        {submissions.length > 0 && (
          <div className="social-admin-footer-actions">
            <button type="button" className="btn-secondary admin-btn-sm" onClick={() => withBusy('sample', async () => { await addSampleSubmissions(); await load(); }, 'Sample submissions added.')} disabled={Boolean(busy)}>
              {busy === 'sample' ? 'Adding…' : 'Add sample data'}
            </button>
            <button type="button" className="btn-secondary admin-btn-sm admin-btn-danger" onClick={() => setConfirm({ kind: 'all' })}>Delete all submissions</button>
          </div>
        )}
      </main>

      {selected && (
        <div className="admin-modal-overlay" onClick={() => setSelected(null)}>
          <div className="admin-modal admin-modal-wide social-admin-detail" role="dialog" aria-modal="true" aria-labelledby="detail-title" onClick={(e) => e.stopPropagation()}>
            <h2 className="card-title" id="detail-title">{selected.name}</h2>
            <p className="card-sub">Submitted {formatDateTime(selected.createdAt)}</p>
            <div className="social-admin-detail-body">
              <dl className="social-admin-dl">
                <dt>College</dt><dd>{selected.college}</dd>
                <dt>Contact number</dt><dd>{selected.contactNumber}</dd>
                <dt>bKash number</dt><dd>{selected.bkashNumber}</dd>
                <dt>Friend&apos;s bKash number</dt><dd>{selected.friendBkashNumber}</dd>
                <dt>Screenshot file</dt><dd>{selected.screenshotName}</dd>
                <dt>Submission ID</dt><dd className="social-admin-mono">{selected.id}</dd>
              </dl>
              {thumbs[selected.id] && (
                <a className="social-admin-detail-img" href={thumbs[selected.id]} target="_blank" rel="noreferrer" title="Open full size">
                  <img src={thumbs[selected.id]} alt={`Screenshot submitted by ${selected.name}`} />
                </a>
              )}
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="admin-delete-btn" onClick={() => setConfirm({ kind: 'one', submission: selected })}>Delete</button>
              <button type="button" className="btn-secondary" onClick={() => setSelected(null)}>Close</button>
              <button type="button" className="btn-primary admin-btn-inline" onClick={() => downloadBlob(selected.screenshot, screenshotFileName(selected))}>Download screenshot</button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="admin-modal-overlay social-admin-confirm-overlay" onClick={() => setConfirm(null)}>
          <div className="admin-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}>
            <h2 className="card-title" id="confirm-title">{confirm.kind === 'all' ? 'Delete all submissions?' : 'Delete submission?'}</h2>
            <p className="admin-confirm-text">
              {confirm.kind === 'all'
                ? `This permanently removes all ${submissions.length} submissions and their screenshots from this browser.`
                : `This permanently removes ${confirm.submission.name}'s submission and screenshot.`}
              {' '}Export first if you need a copy.
            </p>
            <div className="admin-modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setConfirm(null)}>Cancel</button>
              <button type="button" className="admin-btn-solid-danger" onClick={handleConfirm} disabled={busy === 'delete'}>
                {busy === 'delete' ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
