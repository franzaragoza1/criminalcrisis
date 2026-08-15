import { Fragment, useEffect, useState } from 'react';
import {
  Upload, Download, Trash2, Plus, ArrowLeft, Send, Mail, BarChart3,
  Users, CheckCircle2, AlertTriangle, Music, RefreshCw, UserPlus,
  ChevronUp, ChevronDown, Edit3, Eye, X, Pause,
} from 'lucide-react';
import { api } from '../../api';
import type { PromoContact, PromoCampaign, PromoStats, Release } from '../../types';
import { INPUT_CLS, LABEL_CLS, BTN_PRIMARY, BTN_SECONDARY } from './adminStyles';

const err = (e: unknown) => alert(e instanceof Error ? e.message : String(e));

// ─── Contacts ─────────────────────────────────────────────────────────────────

function ContactsTab() {
  const [contacts, setContacts] = useState<PromoContact[]>([]);
  const [stats, setStats] = useState<Record<string, Record<string, number>> | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', role: 'dj', country: '', company: '' });
  // Bumping this re-runs the loader; keeps fetching inside the effect where the
  // unmount guard lives, instead of scattering setState across async callbacks.
  const [reload, setReload] = useState(0);
  const refresh = () => setReload(n => n + 1);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (statusFilter) params.set('status', statusFilter);
        const qs = params.toString();
        const [list, summary] = await Promise.all([
          api.getPromoContacts(qs ? `?${qs}` : ''),
          api.getPromoContactStats(),
        ]);
        if (!alive) return;
        setContacts(list as PromoContact[]);
        setStats(summary as Record<string, Record<string, number>>);
      } catch (e) { if (alive) err(e); }
    })();
    return () => { alive = false; };
    // `query` is applied on demand via refresh(), not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, reload]);

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = (await api.importPromoContacts(fd)) as { imported: number; updated: number; invalid: string[]; total: number };
      setImportResult(`${res.imported} new · ${res.updated} updated · ${res.invalid.length} invalid of ${res.total} rows`);
      refresh();
    } catch (e) { err(e); } finally { setImporting(false); }
  };

  /** The export endpoint needs the JWT, so it can't be a plain link. */
  const handleExport = async () => {
    try {
      const res = await fetch(api.exportPromoContactsUrl(), {
        headers: { Authorization: `Bearer ${localStorage.getItem('cc_token')}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `criminalcrisis-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { err(e); }
  };

  const addContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createPromoContact(form);
      setForm({ email: '', name: '', role: 'dj', country: '', company: '' });
      setAdding(false);
      refresh();
    } catch (e2) { err(e2); }
  };

  const active = stats?.byStatus?.active ?? 0;
  const pending = stats?.byStatus?.pending ?? 0;

  const setStatus = async (c: PromoContact, status: string) => {
    try { await api.updatePromoContact(c.id, { status }); refresh(); } catch (e) { err(e); }
  };

  return (
    <div>
      {/* Pending requests come first — they're the only thing here that needs
          a decision, and they're invisible to sends until approved. */}
      {pending > 0 && (
        <button
          onClick={() => setStatusFilter('pending')}
          className={`w-full flex items-center gap-3 border-2 p-4 mb-4 text-left cursor-pointer transition-colors ${
            statusFilter === 'pending' ? 'border-[#C8302B] bg-[#FFF5F5]' : 'border-[#111] bg-white hover:bg-[#FAFAFA]'
          }`}
        >
          <UserPlus size={18} className="text-[#C8302B] shrink-0" />
          <span className="text-sm text-[#111]">
            <strong>{pending}</strong> {pending === 1 ? 'request' : 'requests'} to join waiting for review
          </span>
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-[#888]">
            {statusFilter === 'pending' ? 'showing' : 'review →'}
          </span>
        </button>
      )}

      {/* Health summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {[
          { label: 'Active', value: active, tone: 'text-[#111]' },
          { label: 'Pending', value: pending, tone: pending > 0 ? 'text-[#C8302B]' : 'text-[#888]' },
          { label: 'Unsubscribed', value: stats?.byStatus?.unsubscribed ?? 0, tone: 'text-[#888]' },
          { label: 'Bounced', value: stats?.byStatus?.bounced ?? 0, tone: 'text-[#C8302B]' },
          { label: 'Complaints', value: stats?.byStatus?.complained ?? 0, tone: 'text-[#C8302B]' },
        ].map(s => (
          <div key={s.label} className="border border-[#E0E0E0] bg-white p-4">
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#888] mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Import / export */}
      <div className="border border-[#E0E0E0] bg-white p-5 mb-6">
        <h3 className="text-sm font-bold text-[#111] mb-1">Import & backup</h3>
        <p className="text-xs text-[#888] mb-4">
          CSV with an <code className="bg-[#F0F0F0] px-1">email</code> column. Name, role, country,
          company and tags are picked up automatically if present. Existing emails are updated, never duplicated.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className={`${BTN_PRIMARY} inline-flex items-center gap-2 ${importing ? 'opacity-40 pointer-events-none' : ''}`}>
            <Upload size={14} /> {importing ? 'Importing…' : 'Import CSV'}
            <input type="file" accept=".csv,text/csv" className="hidden"
                   onChange={e => { const f = e.target.files?.[0]; if (f) void handleImport(f); e.target.value = ''; }} />
          </label>
          <button onClick={() => void handleExport()} className={`${BTN_SECONDARY} inline-flex items-center gap-2`}>
            <Download size={14} /> Export CSV
          </button>
          {importResult && <span className="text-xs text-[#111]">{importResult}</span>}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') refresh(); }}
          placeholder="Search email, name or company…"
          className={`${INPUT_CLS} max-w-xs`}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${INPUT_CLS} max-w-[180px]`}>
          <option value="">All statuses</option>
          <option value="pending">Pending requests</option>
          <option value="active">Active</option>
          <option value="rejected">Rejected</option>
          <option value="unsubscribed">Unsubscribed</option>
          <option value="bounced">Bounced</option>
          <option value="complained">Complained</option>
        </select>
        <button onClick={refresh} className={`${BTN_SECONDARY} inline-flex items-center gap-2`}>
          <RefreshCw size={13} /> Apply
        </button>
        <button onClick={() => setAdding(!adding)} className={`${BTN_PRIMARY} inline-flex items-center gap-2 ml-auto`}>
          <Plus size={14} /> Add contact
        </button>
      </div>

      {adding && (
        <form onSubmit={addContact} className="border border-[#E0E0E0] bg-white p-5 mb-4 grid md:grid-cols-3 gap-4">
          <div>
            <label className={LABEL_CLS}>Email *</label>
            <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={INPUT_CLS} />
          </div>
          <div>
            <label className={LABEL_CLS}>Name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={INPUT_CLS} />
          </div>
          <div>
            <label className={LABEL_CLS}>Role</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className={INPUT_CLS}>
              <option value="dj">DJ</option><option value="radio">Radio</option>
              <option value="press">Press</option><option value="blog">Blog</option>
              <option value="club">Club / Promoter</option><option value="label">Label</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLS}>Company / Station</label>
            <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className={INPUT_CLS} />
          </div>
          <div>
            <label className={LABEL_CLS}>Country</label>
            <input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className={INPUT_CLS} />
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className={BTN_PRIMARY}>Save</button>
            <button type="button" onClick={() => setAdding(false)} className={BTN_SECONDARY}>Cancel</button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="border border-[#E0E0E0] bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E0E0E0] text-left">
              {['Email', 'Name', 'Role', 'Company', 'Country', 'Status', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#888]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contacts.map(c => (
              <Fragment key={c.id}>
                <tr className={`border-b border-[#F0F0F0] last:border-0 hover:bg-[#FAFAFA] ${c.notes && c.status === 'pending' ? 'border-b-0' : ''}`}>
                  <td className="px-4 py-2.5 text-[#111]">{c.email}</td>
                  <td className="px-4 py-2.5 text-[#555]">{c.name || '—'}</td>
                  <td className="px-4 py-2.5 text-[#555] uppercase text-xs">{c.role}</td>
                  <td className="px-4 py-2.5 text-[#555]">{c.company || '—'}</td>
                  <td className="px-4 py-2.5 text-[#555]">{c.country || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 ${
                      c.status === 'active' ? 'bg-[#111] text-white'
                        : c.status === 'pending' ? 'bg-[#C8302B] text-white'
                        : c.status === 'unsubscribed' || c.status === 'rejected' ? 'bg-[#E8E8E8] text-[#666]'
                        : 'bg-[#C8302B] text-white'
                    }`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      {c.status === 'pending' && (
                        <>
                          <button
                            onClick={() => void setStatus(c, 'active')}
                            title="Approve — they'll be included in future sends"
                            className="flex items-center gap-1 bg-[#111] text-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide hover:bg-[#C8302B] transition-colors cursor-pointer"
                          ><CheckCircle2 size={12} /> Approve</button>
                          <button
                            onClick={() => void setStatus(c, 'rejected')}
                            title="Reject — kept on file, never emailed"
                            className="border border-[#E0E0E0] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#666] hover:border-[#111] transition-colors cursor-pointer"
                          >Reject</button>
                        </>
                      )}
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete ${c.email}?`)) return;
                          try { await api.deletePromoContact(c.id); refresh(); } catch (e) { err(e); }
                        }}
                        className="text-[#BBB] hover:text-[#C8302B] transition-colors cursor-pointer"
                      ><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
                {/* What they wrote is the whole basis for the decision, so it
                    sits inline rather than behind a click. */}
                {c.notes && c.status === 'pending' && (
                  <tr className="border-b border-[#F0F0F0] last:border-0">
                    <td colSpan={7} className="px-4 pb-3 pt-0">
                      <p className="text-xs text-[#555] leading-relaxed whitespace-pre-wrap bg-[#FAFAFA] border-l-2 border-[#C8302B] pl-3 py-2">
                        {c.notes}
                      </p>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {contacts.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[#888]">
                No contacts yet — import your CSV to get started.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Campaign detail ──────────────────────────────────────────────────────────

function CampaignDetail({ campaign, onBack }: { campaign: PromoCampaign; onBack: () => void }) {
  const [stats, setStats] = useState<PromoStats | null>(null);
  const [view, setView] = useState<'setup' | 'stats'>('setup');
  const [testEmail, setTestEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [trackForm, setTrackForm] = useState({ title: '', artist_name: '' });
  const [roles, setRoles] = useState<string[]>([]);
  const [details, setDetails] = useState({
    title: campaign.title,
    subject: campaign.subject ?? '',
    body_intro: campaign.body_intro ?? '',
    release_date: campaign.release_date ?? '',
    download_enabled: campaign.download_enabled !== 0,
    require_feedback: campaign.require_feedback !== 0,
  });
  const [savedDetails, setSavedDetails] = useState(false);
  const [reload, setReload] = useState(0);
  const refresh = () => setReload(n => n + 1);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const s = await api.getPromoStats(campaign.id);
        if (alive) setStats(s as PromoStats);
      } catch (e) { if (alive) err(e); }
    })();
    return () => { alive = false; };
  }, [campaign.id, reload]);

  const addTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    const formEl = e.target as HTMLFormElement;
    const master = (formEl.elements.namedItem('master') as HTMLInputElement).files?.[0];
    const mp3 = (formEl.elements.namedItem('mp3') as HTMLInputElement).files?.[0];
    if (!master) { alert('Choose the master audio file'); return; }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('master', master);
      if (mp3) fd.append('mp3', mp3);
      fd.append('title', trackForm.title || master.name.replace(/\.[^.]+$/, ''));
      fd.append('artist_name', trackForm.artist_name);
      await api.addPromoTrack(campaign.id, fd);
      setTrackForm({ title: '', artist_name: '' });
      formEl.reset();
      refresh();
    } catch (e2) { err(e2); } finally { setBusy(false); }
  };

  /**
   * Opened via window.open before the await so the browser still counts it as a
   * user gesture — doing it after the fetch resolves gets it blocked as a popup.
   */
  const preview = async () => {
    const tab = window.open('', '_blank');
    setBusy(true);
    try {
      const { url } = await api.getPromoPreviewUrl(campaign.id);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (e) { tab?.close(); err(e); } finally { setBusy(false); }
  };

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    const formEl = e.target as HTMLFormElement;
    const artwork = (formEl.elements.namedItem('artwork') as HTMLInputElement)?.files?.[0];

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('title', details.title);
      fd.append('subject', details.subject);
      fd.append('body_intro', details.body_intro);
      fd.append('release_date', details.release_date);
      fd.append('download_enabled', details.download_enabled ? '1' : '0');
      fd.append('require_feedback', details.require_feedback ? '1' : '0');
      if (artwork) fd.append('artwork', artwork);
      await api.updatePromoCampaign(campaign.id, fd);
      setSavedDetails(true);
      setTimeout(() => setSavedDetails(false), 2500);
      refresh();
    } catch (e2) { err(e2); } finally { setBusy(false); }
  };

  /** Sends the whole reordered list, so positions are normalised every time. */
  const move = async (index: number, delta: number) => {
    const list = stats?.perTrack ?? [];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;

    const ids = list.map(t => t.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];

    setBusy(true);
    try {
      await api.reorderPromoTracks(campaign.id, ids);
      refresh();
    } catch (e) { err(e); } finally { setBusy(false); }
  };

  const addRecipients = async () => {
    setBusy(true);
    try {
      const res = (await api.addPromoRecipients(campaign.id, roles.length ? { roles } : {})) as { added: number; matched: number };
      alert(`${res.added} recipients queued (${res.matched} matched).`);
      refresh();
    } catch (e) { err(e); } finally { setBusy(false); }
  };

  const send = async () => {
    if (!confirm('Start sending this campaign? Emails go out in daily batches.')) return;
    setBusy(true);
    try {
      const res = (await api.sendPromoCampaign(campaign.id)) as { sent: number; failed: number; queuedTotal: number; dailyCap: number };
      alert(`Sending started.\n\nSent now: ${res.sent}\nFailed: ${res.failed}\nStill queued: ${res.queuedTotal}\n\nThe rest goes out automatically at ${res.dailyCap}/day.`);
      refresh();
    } catch (e) { err(e); } finally { setBusy(false); }
  };

  const pause = async () => {
    setBusy(true);
    try { await api.pausePromoCampaign(campaign.id); refresh(); }
    catch (e) { err(e); } finally { setBusy(false); }
  };

  const resume = async () => {
    setBusy(true);
    try { await api.resumePromoCampaign(campaign.id); refresh(); }
    catch (e) { err(e); } finally { setBusy(false); }
  };

  const sendTest = async () => {
    if (!testEmail) return;
    setBusy(true);
    try {
      await api.testPromoCampaign(campaign.id, testEmail);
      alert(`Test sent to ${testEmail}. Check it in Gmail, Outlook and on mail-tester.com before the real send.`);
    } catch (e) { err(e); } finally { setBusy(false); }
  };

  const t = stats?.totals;
  // From stats so pause/resume reflects immediately, not the stale list prop
  const status = stats?.campaign?.status ?? campaign.status;

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-[#888] hover:text-[#111] mb-4 cursor-pointer transition-colors">
        <ArrowLeft size={14} /> All campaigns
      </button>

      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          {/* From stats, not the prop, so a rename shows immediately after saving */}
          <h2 className="text-xl font-bold text-[#111]">{stats?.campaign?.title ?? campaign.title}</h2>
          <p className="text-xs text-[#888] mt-1">
            /promo/{campaign.slug} · <span className="uppercase font-semibold">{stats?.campaign?.status ?? campaign.status}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void preview()}
            disabled={busy}
            title="Opens the landing page exactly as a recipient sees it"
            className={`${BTN_SECONDARY} inline-flex items-center gap-2 !py-2 !text-xs`}
          >
            <Eye size={14} /> Preview
          </button>
          {(['setup', 'stats'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors cursor-pointer ${
                view === v ? 'bg-[#111] text-white' : 'border border-[#E0E0E0] text-[#666] hover:border-[#111]'}`}>
              {v === 'setup' ? 'Setup' : 'Results'}
            </button>
          ))}
        </div>
      </div>

      {view === 'setup' ? (
        <div className="space-y-6">
          {/* Campaign details */}
          <form onSubmit={saveDetails} className="border border-[#E0E0E0] bg-white p-5 space-y-4">
            <h3 className="text-sm font-bold text-[#111] flex items-center gap-2"><Edit3 size={14} /> Campaign</h3>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLS}>Title</label>
                <input required value={details.title}
                       onChange={e => setDetails({ ...details, title: e.target.value })}
                       className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Email subject</label>
                <input value={details.subject}
                       onChange={e => setDetails({ ...details, subject: e.target.value })}
                       placeholder="Defaults to the title" className={INPUT_CLS} />
              </div>
            </div>

            <div>
              <label className={LABEL_CLS}>Intro / press note</label>
              <textarea rows={4} value={details.body_intro}
                        onChange={e => setDetails({ ...details, body_intro: e.target.value })}
                        className={INPUT_CLS}
                        placeholder="Shown in both the email and the landing page. Blank lines separate paragraphs." />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLS}>Release date</label>
                <input value={details.release_date}
                       onChange={e => setDetails({ ...details, release_date: e.target.value })}
                       placeholder="e.g. 12 September 2026" className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Replace artwork</label>
                <input name="artwork" type="file" accept="image/*" className="text-sm text-[#888]" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-[#555]">
                <input type="checkbox" checked={details.download_enabled}
                       onChange={e => setDetails({ ...details, download_enabled: e.target.checked })} />
                Allow downloads
              </label>
              <label className="flex items-center gap-2 text-sm text-[#555]">
                <input type="checkbox" checked={details.require_feedback}
                       disabled={!details.download_enabled}
                       onChange={e => setDetails({ ...details, require_feedback: e.target.checked })} />
                Require a star rating <em>and</em> a comment before downloading
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button type="submit" disabled={busy} className={BTN_PRIMARY}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
              {savedDetails && (
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#C8302B]">
                  <CheckCircle2 size={13} /> Saved
                </span>
              )}
              {/* The slug is deliberately frozen: renaming a sent campaign would
                  break every personal link already in someone's inbox. */}
              <span className="text-xs text-[#888]">
                Each recipient gets <code className="bg-[#F0F0F0] px-1">/promo/{campaign.slug}?k=…</code> with
                their own key — use Preview to see it. The link survives a rename.
              </span>
            </div>
          </form>

          {/* Tracks */}
          <div className="border border-[#E0E0E0] bg-white p-5">
            <h3 className="text-sm font-bold text-[#111] mb-1 flex items-center gap-2"><Music size={14} /> Tracks</h3>
            <p className="text-xs text-[#888] mb-4 max-w-2xl leading-relaxed">
              Upload the master once — the 128kbps stream and the 320 download are derived from it.
              <strong className="text-[#C8302B]"> Max 100MB per file</strong>, so prefer
              <strong className="text-[#111]"> FLAC</strong> over WAV: lossless, half the size, read
              by Rekordbox, Serato and Traktor. Use the arrows to reorder.
            </p>

            {stats?.perTrack.map((tr, i) => (
              <div key={tr.id} className="flex items-center gap-2 sm:gap-3 py-2 border-b border-[#F0F0F0] last:border-0">
                <span className="font-mono text-xs text-[#BBB] w-6 shrink-0">{String(i + 1).padStart(2, '0')}</span>

                {/* Arrows rather than drag-and-drop: no scroll-vs-drag fight on
                    touch, and it stays keyboard-reachable. */}
                <div className="flex flex-col shrink-0">
                  <button
                    onClick={() => void move(i, -1)}
                    disabled={i === 0 || busy}
                    aria-label={`Move "${tr.title}" up`}
                    className="text-[#BBB] hover:text-[#111] disabled:opacity-25 disabled:hover:text-[#BBB] cursor-pointer disabled:cursor-not-allowed transition-colors leading-none"
                  ><ChevronUp size={14} /></button>
                  <button
                    onClick={() => void move(i, 1)}
                    disabled={i === (stats?.perTrack.length ?? 0) - 1 || busy}
                    aria-label={`Move "${tr.title}" down`}
                    className="text-[#BBB] hover:text-[#111] disabled:opacity-25 disabled:hover:text-[#BBB] cursor-pointer disabled:cursor-not-allowed transition-colors leading-none"
                  ><ChevronDown size={14} /></button>
                </div>

                <span className="flex-1 min-w-0 text-sm text-[#111] truncate">{tr.title}</span>
                <span className="text-xs text-[#888] shrink-0 hidden sm:block">{tr.plays} plays · {tr.downloads} dl</span>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete "${tr.title}"?`)) return;
                    try { await api.deletePromoTrack(tr.id); refresh(); } catch (e) { err(e); }
                  }}
                  className="text-[#BBB] hover:text-[#C8302B] cursor-pointer transition-colors shrink-0"
                ><Trash2 size={14} /></button>
              </div>
            ))}

            <form onSubmit={addTrack} className="grid md:grid-cols-2 gap-4 mt-5 pt-5 border-t border-[#E0E0E0]">
              <div>
                <label className={LABEL_CLS}>Title</label>
                <input value={trackForm.title} onChange={e => setTrackForm({ ...trackForm, title: e.target.value })}
                       placeholder="Defaults to the filename" className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Artist</label>
                <input value={trackForm.artist_name} onChange={e => setTrackForm({ ...trackForm, artist_name: e.target.value })} className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Master — WAV / AIFF *</label>
                <input name="master" type="file" accept="audio/*,.wav,.aiff,.aif,.flac" className="text-sm text-[#888]" />
              </div>
              <div>
                <label className={LABEL_CLS}>Your own MP3 320 (optional)</label>
                <input name="mp3" type="file" accept="audio/mpeg,.mp3" className="text-sm text-[#888]" />
              </div>
              <div className="md:col-span-2">
                <button type="submit" disabled={busy} className={`${BTN_PRIMARY} inline-flex items-center gap-2`}>
                  <Plus size={14} /> {busy ? 'Uploading…' : 'Add track'}
                </button>
              </div>
            </form>
          </div>

          {/* Recipients */}
          <div className="border border-[#E0E0E0] bg-white p-5">
            <h3 className="text-sm font-bold text-[#111] mb-1 flex items-center gap-2"><Users size={14} /> Recipients</h3>
            <p className="text-xs text-[#888] mb-4">
              {t ? `${t.recipients} queued or sent` : 'Loading…'}. Leave roles unticked to include every active contact.
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {['dj', 'radio', 'press', 'blog', 'club', 'label'].map(r => (
                <button key={r} type="button"
                  onClick={() => setRoles(roles.includes(r) ? roles.filter(x => x !== r) : [...roles, r])}
                  className={`px-3 py-1.5 text-xs uppercase tracking-wide transition-colors cursor-pointer ${
                    roles.includes(r) ? 'bg-[#111] text-white' : 'border border-[#E0E0E0] text-[#666] hover:border-[#111]'}`}>
                  {r}
                </button>
              ))}
            </div>
            <button onClick={() => void addRecipients()} disabled={busy} className={BTN_SECONDARY}>
              Add recipients
            </button>
            <p className="text-xs text-[#888] mt-3">
              Added but not sent yet? Open <strong className="text-[#111]">Results</strong> to review the
              list and drop anyone you'd rather skip — they stay on your contacts and still get
              future promos.
            </p>
          </div>

          {/* Send */}
          <div className="border-2 border-[#111] bg-white p-5">
            <h3 className="text-sm font-bold text-[#111] mb-1 flex items-center gap-2"><Send size={14} /> Send</h3>
            <p className="text-xs text-[#888] mb-4">
              Always send a test to yourself first and check it on mail-tester.com. Aim for 9/10 or better
              before touching the real list.
            </p>
            <div className="flex flex-wrap items-end gap-3 mb-5">
              <div className="flex-1 min-w-[220px]">
                <label className={LABEL_CLS}>Test address</label>
                <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
                       placeholder="you@gmail.com" className={INPUT_CLS} />
              </div>
              <button onClick={() => void sendTest()} disabled={busy || !testEmail} className={`${BTN_SECONDARY} inline-flex items-center gap-2`}>
                <Mail size={14} /> Send test
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {status === 'sending' ? (
                <button onClick={() => void pause()} disabled={busy}
                        className={`${BTN_PRIMARY} inline-flex items-center gap-2 !bg-[#C8302B] hover:!bg-[#111]`}>
                  <Pause size={14} /> Pause sending
                </button>
              ) : status === 'paused' ? (
                <button onClick={() => void resume()} disabled={busy}
                        className={`${BTN_PRIMARY} inline-flex items-center gap-2`}>
                  <Send size={14} /> Resume sending
                </button>
              ) : (
                <button onClick={() => void send()} disabled={busy || status === 'sent'}
                        className={`${BTN_PRIMARY} inline-flex items-center gap-2`}>
                  <Send size={14} /> {status === 'sent' ? 'Already sent' : 'Start sending'}
                </button>
              )}

              {status === 'paused' && (
                <span className="text-xs text-[#C8302B]">
                  Paused — {t?.queued ?? 0} still queued. Nothing goes out until you resume.
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Funnel */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: 'Recipients', value: t?.recipients ?? 0 },
              { label: 'Sent', value: t?.sent ?? 0 },
              { label: 'Delivered', value: t?.delivered ?? 0 },
              { label: 'Opened page', value: t?.visited ?? 0 },
              { label: 'Played', value: t?.played ?? 0 },
              { label: 'Downloaded', value: t?.downloaded ?? 0 },
            ].map(s => (
              <div key={s.label} className="border border-[#E0E0E0] bg-white p-4">
                <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[#888] mb-1">{s.label}</p>
                <p className="text-2xl font-bold text-[#111]">{s.value}</p>
              </div>
            ))}
          </div>

          {(t?.bounced || t?.failed) ? (
            <div className="border border-[#C8302B] bg-[#FFF5F5] p-4 flex items-start gap-3">
              <AlertTriangle size={16} className="text-[#C8302B] mt-0.5 shrink-0" />
              <p className="text-xs text-[#111]">
                {t.bounced} bounced, {t.failed} failed. Bounced addresses are suppressed automatically —
                leaving them in would damage your sending reputation.
              </p>
            </div>
          ) : null}

          {/* Favourite track — the clearest signal for picking the lead single */}
          {stats && stats.favourites.some(f => f.votes > 0) && (
            <div className="border border-[#E0E0E0] bg-white p-5">
              <h3 className="text-sm font-bold text-[#111] mb-4">Favourite track</h3>
              {(() => {
                const top = Math.max(...stats.favourites.map(f => f.votes), 1);
                return stats.favourites.map(f => (
                  <div key={f.id} className="flex items-center gap-3 py-1.5">
                    <span className="text-sm text-[#111] w-48 truncate shrink-0">{f.title}</span>
                    <div className="flex-1 bg-[#F0F0F0] h-4">
                      <div className="h-full bg-[#C8302B]" style={{ width: `${(f.votes / top) * 100}%` }} />
                    </div>
                    <span className="font-mono text-xs text-[#666] w-10 text-right shrink-0">{f.votes}</span>
                  </div>
                ));
              })()}
            </div>
          )}

          {/* Feedback */}
          {stats && stats.feedback.length > 0 && (
            <div className="border border-[#E0E0E0] bg-white p-5">
              <h3 className="text-sm font-bold text-[#111] mb-4">Feedback ({stats.feedback.length})</h3>
              <div className="space-y-4">
                {stats.feedback.map((f, i) => (
                  <div key={i} className="border-b border-[#F0F0F0] last:border-0 pb-4 last:pb-0">
                    {/* Name and email both, always. Showing one or the other made
                        feedback look anonymous whenever a name was present. */}
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-1">
                      {f.name && <span className="text-sm font-semibold text-[#111]">{f.name}</span>}
                      <a href={`mailto:${f.email}`} className="text-xs text-[#666] hover:text-[#C8302B] transition-colors">
                        {f.email}
                      </a>
                      {f.company && <span className="text-xs text-[#888]">· {f.company}</span>}
                      {f.country && <span className="text-xs text-[#888]">· {f.country}</span>}
                      {f.source === 'test' && (
                        <span className="text-[9px] font-semibold uppercase tracking-wide bg-[#F0F0F0] px-1.5 py-0.5 text-[#999]">test</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      {f.rating != null && (
                        <span className="text-xs font-mono text-[#C8302B]">
                          {'★'.repeat(f.rating)}<span className="text-[#DDD]">{'★'.repeat(5 - f.rating)}</span>
                        </span>
                      )}
                      {f.favourite_track_title && (
                        <span className="text-[10px] uppercase tracking-wide text-[#888]">
                          fave: <span className="text-[#111]">{f.favourite_track_title}</span>
                        </span>
                      )}
                      {f.track_title && <span className="text-[10px] uppercase tracking-wide bg-[#F0F0F0] px-2 py-0.5 text-[#666]">{f.track_title}</span>}
                    </div>
                    {f.comment && <p className="text-sm text-[#444] leading-relaxed">{f.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per recipient */}
          <div className="border border-[#E0E0E0] bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E0E0E0] text-left">
                  {['Contact', 'Status', 'Visited', 'Plays', 'Downloads', 'Feedback', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#888]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats?.recipients.map(r => (
                  <tr key={r.id} className="border-b border-[#F0F0F0] last:border-0 hover:bg-[#FAFAFA]">
                    <td className="px-4 py-2.5">
                      <span className="text-[#111] flex items-center gap-1.5">
                        {r.name || r.email}
                        {r.source === 'test' && (
                          <span className="text-[9px] font-semibold uppercase tracking-wide bg-[#F0F0F0] px-1.5 py-0.5 text-[#999]">test</span>
                        )}
                      </span>
                      {r.name && <span className="text-xs text-[#888] block">{r.email}</span>}
                      {r.company && <span className="text-xs text-[#888] block">{r.company}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs uppercase text-[#666]">{r.send_status}</td>
                    <td className="px-4 py-2.5">{r.first_visit_at ? <CheckCircle2 size={14} className="text-[#111]" /> : <span className="text-[#DDD]">—</span>}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.plays}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.downloads}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.feedback_count}</td>
                    <td className="px-4 py-2.5 text-right">
                      {/* Only while queued — once it's sent there's nothing to cancel */}
                      {r.send_status === 'queued' && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Remove ${r.name || r.email} from this campaign?\n\nThey stay on your contact list and will get future promos.`)) return;
                            try { await api.removePromoRecipient(campaign.id, r.id); refresh(); } catch (e) { err(e); }
                          }}
                          title="Remove from this campaign"
                          className="text-[#BBB] hover:text-[#C8302B] transition-colors cursor-pointer"
                        ><X size={14} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Campaigns list ───────────────────────────────────────────────────────────

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<PromoCampaign[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [selected, setSelected] = useState<PromoCampaign | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: '', subject: '', body_intro: '', release_date: '', release_id: '',
    download_enabled: true, require_feedback: true,
  });
  const [reload, setReload] = useState(0);
  const refresh = () => setReload(n => n + 1);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [list, rels] = await Promise.all([api.getPromoCampaigns(), api.getReleases()]);
        if (!alive) return;
        setCampaigns(list as PromoCampaign[]);
        setReleases(rels as Release[]);
      } catch (e) { if (alive) err(e); }
    })();
    return () => { alive = false; };
  }, [reload]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const formEl = e.target as HTMLFormElement;
    const artwork = (formEl.elements.namedItem('artwork') as HTMLInputElement).files?.[0];
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('subject', form.subject);
      fd.append('body_intro', form.body_intro);
      fd.append('release_date', form.release_date);
      if (form.release_id) fd.append('release_id', form.release_id);
      fd.append('download_enabled', form.download_enabled ? '1' : '0');
      fd.append('require_feedback', form.require_feedback ? '1' : '0');
      if (artwork) fd.append('artwork', artwork);
      await api.createPromoCampaign(fd);
      setForm({
        title: '', subject: '', body_intro: '', release_date: '', release_id: '',
        download_enabled: true, require_feedback: true,
      });
      setCreating(false);
      refresh();
    } catch (e2) { err(e2); }
  };

  if (selected) {
    return <CampaignDetail campaign={selected} onBack={() => { setSelected(null); refresh(); }} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[#111]">Campaigns</h2>
        <button onClick={() => setCreating(!creating)} className={`${BTN_PRIMARY} inline-flex items-center gap-2`}>
          <Plus size={14} /> New campaign
        </button>
      </div>

      {creating && (
        <form onSubmit={create} className="border border-[#E0E0E0] bg-white p-5 mb-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Title *</label>
              <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Email subject</label>
              <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                     placeholder="Defaults to the title" className={INPUT_CLS} />
            </div>
          </div>
          <div>
            <label className={LABEL_CLS}>Intro / press note</label>
            <textarea rows={4} value={form.body_intro} onChange={e => setForm({ ...form, body_intro: e.target.value })}
                      className={INPUT_CLS} placeholder="Shown in both the email and the landing page. Blank lines separate paragraphs." />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className={LABEL_CLS}>Release date</label>
              <input value={form.release_date} onChange={e => setForm({ ...form, release_date: e.target.value })}
                     placeholder="e.g. 12 September 2026" className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Linked release</label>
              <select value={form.release_id} onChange={e => setForm({ ...form, release_id: e.target.value })} className={INPUT_CLS}>
                <option value="">None</option>
                {releases.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>Artwork</label>
              <input name="artwork" type="file" accept="image/*" className="text-sm text-[#888]" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-[#555]">
              <input type="checkbox" checked={form.download_enabled}
                     onChange={e => setForm({ ...form, download_enabled: e.target.checked })} />
              Allow downloads
            </label>
            <label className="flex items-center gap-2 text-sm text-[#555]">
              <input type="checkbox" checked={form.require_feedback}
                     disabled={!form.download_enabled}
                     onChange={e => setForm({ ...form, require_feedback: e.target.checked })} />
              Require a star rating <em>and</em> a comment before downloading
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className={BTN_PRIMARY}>Create</button>
            <button type="button" onClick={() => setCreating(false)} className={BTN_SECONDARY}>Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {campaigns.map(c => (
          <div key={c.id} className="border border-[#E0E0E0] bg-white p-4 flex items-center gap-4 hover:border-[#111] transition-colors">
            {c.artwork_url
              ? <img src={c.artwork_url} alt="" className="w-12 h-12 object-cover shrink-0" />
              : <div className="w-12 h-12 bg-[#F0F0F0] shrink-0" />}
            <button onClick={() => setSelected(c)} className="flex-1 text-left cursor-pointer">
              <p className="text-sm font-semibold text-[#111]">{c.title}</p>
              <p className="text-xs text-[#888]">
                {c.track_count ?? 0} tracks · {c.recipient_count ?? 0} recipients
                {(c.queued_count ?? 0) > 0 && ` · ${c.queued_count} still queued`}
              </p>
            </button>
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 ${
              c.status === 'sent' ? 'bg-[#111] text-white'
                : c.status === 'sending' ? 'bg-[#C8302B] text-white'
                : 'bg-[#F0F0F0] text-[#666]'}`}>{c.status}</span>
            <button
              onClick={async () => {
                if (!confirm(`Delete "${c.title}" and all its audio?`)) return;
                try { await api.deletePromoCampaign(c.id); refresh(); } catch (e) { err(e); }
              }}
              className="text-[#BBB] hover:text-[#C8302B] cursor-pointer transition-colors"
            ><Trash2 size={14} /></button>
          </div>
        ))}
        {campaigns.length === 0 && !creating && (
          <div className="border border-[#E0E0E0] bg-white p-10 text-center text-sm text-[#888]">
            No campaigns yet. Create one, add tracks, then pick who receives it.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function PromoAdmin() {
  const [tab, setTab] = useState<'campaigns' | 'contacts'>('campaigns');

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 border-b border-[#E0E0E0]">
        {([
          { id: 'campaigns', label: 'Campaigns', icon: <BarChart3 size={14} /> },
          { id: 'contacts', label: 'Contacts', icon: <Users size={14} /> },
        ] as const).map(item => (
          <button key={item.id} onClick={() => setTab(item.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition-colors cursor-pointer ${
              tab === item.id ? 'border-[#111] text-[#111]' : 'border-transparent text-[#888] hover:text-[#111]'}`}>
            {item.icon} {item.label}
          </button>
        ))}
      </div>

      {tab === 'campaigns' ? <CampaignsTab /> : <ContactsTab />}
    </div>
  );
}
