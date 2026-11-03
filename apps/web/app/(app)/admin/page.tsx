'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleInfo,
  faFileCsv,
  faPlus,
  faRotate,
  faSpinner,
  faTriangleExclamation,
  faUserShield,
} from '@fortawesome/free-solid-svg-icons';
import { api } from '../../../lib/api';
import { useToast } from '../../../lib/toast';
import { apiErrorMessage } from '../../../lib/api-errors';
import { toDateKey, todayKey, toNumber } from '../../../lib/format';
import type { CalendarOverride, MmsSyncStatus, MmsSyncSummary, Project, Trade, Worker } from '../../../lib/types';
import { SearchableSelect } from '../../../components/SearchableSelect';
import {
  AddForm,
  SearchBar,
  StatusText,
  TableCard,
  ToggleButton,
  fieldClass,
  matches,
  primaryBtn,
} from '../../../components/admin/shared';

type Tab = 'trades' | 'workers' | 'projects' | 'calendar' | 'users';

const TABS: { key: Tab; label: string }[] = [
  { key: 'trades', label: 'Trades' },
  { key: 'workers', label: 'Workers' },
  { key: 'projects', label: 'Projects' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'users', label: 'Users' },
];

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

function downloadCsv(filename: string, rows: string[][]) {
  const csv = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n'); // BOM: Excel อ่านภาษาไทยได้
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('trades');

  const [trades, setTrades] = useState<Trade[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [calendar, setCalendar] = useState<CalendarOverride[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mms, setMms] = useState<MmsSyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  // ─── ฟอร์มของแต่ละแท็บ ───
  const [tradeForm, setTradeForm] = useState({ name: '', rate: '' });
  const [workerForm, setWorkerForm] = useState({ name: '', tradeId: '' });
  const [projectForm, setProjectForm] = useState({ code: '', name: '' });
  const [calForm, setCalForm] = useState<{ date: string; type: 'WEEKEND' | 'HOLIDAY'; label: string }>({
    date: '',
    type: 'HOLIDAY',
    label: '',
  });

  const loaders = useMemo(
    () => ({
      trades: async () => setTrades((await api.get<Trade[]>('/trades')).data),
      workers: async () => setWorkers((await api.get<Worker[]>('/workers')).data),
      projects: async () => setProjects((await api.get<Project[]>('/projects')).data),
      calendar: async () => setCalendar((await api.get<CalendarOverride[]>('/calendar-overrides')).data),
      // ไม่ให้หน้า Admin ล้มถ้า API ยังไม่มี endpoint นี้ — ถือว่าไม่ได้เชื่อม MMS
      mms: async () => setMms(await api.get<MmsSyncStatus>('/mms-sync/status').then((r) => r.data, () => null)),
    }),
    [],
  );

  const loadAll = useCallback(async () => {
    try {
      await Promise.all([loaders.trades(), loaders.workers(), loaders.projects(), loaders.calendar(), loaders.mms()]);
      setLoadState('ready');
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not load master data.'));
      setLoadState('error');
    }
  }, [loaders]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  function switchTab(t: Tab) {
    setTab(t);
    setSearch('');
    setShowInactive(false);
  }

  /** บันทึก แล้วโหลดรายการของแท็บนั้นใหม่ */
  async function run(action: () => Promise<unknown>, success: string, reload: () => Promise<void>, onDone?: () => void) {
    setSaving(true);
    try {
      await action();
      toast(success);
      onDone?.();
      await reload();
    } catch (err) {
      toast(apiErrorMessage(err), true);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(path: string, id: string, active: boolean, reload: () => Promise<void>) {
    setBusyId(id);
    try {
      await api.patch(`/${path}/${id}/active`, { active: !active });
      await reload();
    } catch (err) {
      toast(`Update failed: ${apiErrorMessage(err)}`, true);
    } finally {
      setBusyId(null);
    }
  }

  // ─── MMS Sync ───
  /** เชื่อม MMS แล้ว = Trade / Worker / Project มาจาก MMS เท่านั้น (เพิ่ม / ปิดเองในหน้านี้ไม่ได้ เพราะ sync รอบถัดไปจะทับ) */
  const mmsManaged = Boolean(mms?.configured);

  async function syncNow() {
    setSyncing(true);
    try {
      const { data } = await api.post<MmsSyncSummary>('/mms-sync/run');
      const changed = (c: MmsSyncSummary['workers']) => c.created + c.updated + c.deactivated;
      toast(
        `Synced from MMS — workers ${changed(data.workers)}, trades ${changed(data.trades)}, projects ${changed(data.projects)} changed.`,
      );
      await Promise.all([loaders.trades(), loaders.workers(), loaders.projects()]);
    } catch (err) {
      toast(`Sync failed: ${apiErrorMessage(err)}`, true);
    } finally {
      setSyncing(false);
      await loaders.mms();
    }
  }

  // ─── Trades ───
  function addTrade() {
    const name = tradeForm.name.trim();
    if (!name) return toast('Please enter a trade name.', true);
    if (tradeForm.rate && !/^\d+(\.\d{1,2})?$/.test(tradeForm.rate.trim())) {
      return toast('Suggested rate must be a number with at most 2 decimal places.', true);
    }
    void run(
      () => api.post('/trades', { name, ...(tradeForm.rate ? { suggestedRate: Number(tradeForm.rate) } : {}) }),
      'Trade added.',
      loaders.trades,
      () => setTradeForm({ name: '', rate: '' }),
    );
  }

  // ─── Workers ───
  function addWorker() {
    const name = workerForm.name.trim();
    if (!name) return toast('Please enter a worker name.', true);
    if (workers.some((w) => w.name.trim().toLowerCase() === name.toLowerCase())) {
      // ชื่อซ้ำทำให้ Foreman เลือกผิดคนได้ — ไม่บล็อก (อาจชื่อซ้ำกันจริง) แต่เตือนไว้
      toast(`Note: a worker named "${name}" already exists. Added anyway.`);
    }
    void run(
      () => api.post('/workers', { name, ...(workerForm.tradeId ? { defaultTradeId: workerForm.tradeId } : {}) }),
      'Worker added.',
      loaders.workers,
      () => setWorkerForm({ name: '', tradeId: '' }),
    );
  }

  // ─── Projects ───
  function addProject() {
    // ตัดช่องว่าง + ตัวพิมพ์ใหญ่ เหมือน prototype — กัน "on/037" กับ "ON/037" กลายเป็น 2 โครงการ
    const code = projectForm.code.trim().toUpperCase();
    const name = projectForm.name.trim();
    if (!code || !name) return toast('Please enter both a project code and name.', true);
    if (projects.some((p) => p.code.toUpperCase() === code)) return toast(`Project code "${code}" already exists.`, true);
    void run(
      () => api.post('/projects', { code, name }),
      'Project added.',
      loaders.projects,
      () => setProjectForm({ code: '', name: '' }),
    );
  }

  // ─── Calendar ───
  function addOverride() {
    if (!calForm.date) return toast('Please choose a date.', true);
    const exists = calendar.some((c) => toDateKey(c.date) === calForm.date);
    void run(
      () =>
        api.post('/calendar-overrides', {
          date: calForm.date,
          type: calForm.type,
          ...(calForm.label.trim() ? { label: calForm.label.trim() } : {}),
        }),
      exists ? 'Calendar override updated.' : 'Calendar override added.',
      loaders.calendar,
      () => setCalForm((f) => ({ ...f, date: '', label: '' })),
    );
  }

  async function removeOverride(dateKey: string) {
    setBusyId(dateKey);
    try {
      await api.delete(`/calendar-overrides/${dateKey}`);
      toast('Override removed.');
      await loaders.calendar();
    } catch (err) {
      toast(`Remove failed: ${apiErrorMessage(err)}`, true);
    } finally {
      setBusyId(null);
    }
  }

  // ─── รายการที่แสดง ───
  const tradeById = useMemo(() => new Map(trades.map((t) => [t.id, t])), [trades]);
  const visibleTrades = trades.filter((t) => (showInactive || t.active) && matches(search, t.name));
  const visibleWorkers = workers.filter(
    (w) => (showInactive || w.active) && matches(search, w.name, w.empCode, w.defaultTrade?.name),
  );
  const visibleProjects = projects.filter((p) => (showInactive || p.active) && matches(search, p.code, p.name));
  const today = todayKey();
  const calendarRows = [...calendar]
    .map((c) => ({ ...c, key: toDateKey(c.date) }))
    .filter((c) => showInactive || c.key >= today) // ซ่อนวันที่ผ่านไปแล้วเป็นค่าเริ่มต้น
    .sort((a, b) => a.key.localeCompare(b.key));
  const pastCount = calendar.filter((c) => toDateKey(c.date) < today).length;

  const activeTradeOptions = trades.filter((t) => t.active).map((t) => ({ value: t.id, label: t.name }));

  if (loadState === 'loading') {
    return (
      <section className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 py-16 text-center text-slate-400">
          <FontAwesomeIcon icon={faSpinner} spin className="text-2xl mb-3" />
          <p>Loading master data...</p>
        </div>
      </section>
    );
  }

  if (loadState === 'error') {
    return (
      <section className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-red-200 py-12 px-6 text-center">
          <FontAwesomeIcon icon={faTriangleExclamation} className="text-3xl text-danger mb-3" />
          <p className="font-medium text-slate-800">{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setLoadState('loading');
              void loadAll();
            }}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-blue-800 transition-colors"
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h3 className="font-semibold text-slate-800 text-lg mb-1">Master Data</h3>
        <p className="text-sm text-slate-500">
          Manage trades, workers, projects and calendar overrides used across the app.
        </p>
      </div>

      <div className="flex gap-2 mb-4 border-b border-slate-200 flex-wrap" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => switchTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Nothing here is ever deleted — deactivate instead, so past timesheets still display correctly. Worker pay rates
        are managed under Worker Contracts (Accounting).
      </p>

      {mms?.configured && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p className="font-medium text-slate-800">Trades, workers and projects come from MMS</p>
            <p className="text-slate-500">
              {mms.intervalMinutes ? `Synced automatically every ${mms.intervalMinutes} min. ` : ''}
              Last sync: <MmsLastRun status={mms} />
            </p>
          </div>
          <button
            type="button"
            onClick={() => void syncNow()}
            disabled={syncing || mms.running}
            className={primaryBtn}
          >
            <FontAwesomeIcon icon={faRotate} spin={syncing} className="mr-1" />
            {syncing ? 'Syncing...' : 'Sync from MMS'}
          </button>
        </div>
      )}

      {/* ─── Trades ─── */}
      {tab === 'trades' && (
        <div role="tabpanel">
          <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm mb-4 border border-blue-100 flex gap-2">
            <FontAwesomeIcon icon={faCircleInfo} className="mt-0.5" />
            <p>
              Trades are the positions available to assign. Actual pay comes from each worker&apos;s contract under{' '}
              <strong>Worker Contracts</strong> — the rate here is only a suggested default when Accounting adds a
              contract.
            </p>
          </div>
          {!mmsManaged && (
            <AddForm onSubmit={addTrade}>
              <div className="flex-1 min-w-[12rem]">
                <label htmlFor="new-trade-name" className="block text-xs font-medium text-slate-600 mb-1">
                  Trade Name
                </label>
                <input
                  id="new-trade-name"
                  value={tradeForm.name}
                  onChange={(e) => setTradeForm((f) => ({ ...f, name: e.target.value }))}
                  className={fieldClass}
                />
              </div>
              <div className="w-40">
                <label htmlFor="new-trade-rate" className="block text-xs font-medium text-slate-600 mb-1">
                  Suggested Rate (฿) <span className="text-slate-400">optional</span>
                </label>
                <input
                  id="new-trade-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={tradeForm.rate}
                  onChange={(e) => setTradeForm((f) => ({ ...f, rate: e.target.value }))}
                  className={fieldClass}
                />
              </div>
              <button type="submit" disabled={saving} className={primaryBtn}>
                <FontAwesomeIcon icon={saving ? faSpinner : faPlus} spin={saving} className="mr-1" />
                Add Trade
              </button>
            </AddForm>
          )}
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search trades"
            inactiveCount={trades.filter((t) => !t.active).length}
            showInactive={showInactive}
            onShowInactive={setShowInactive}
          />
          <TableCard
            empty={visibleTrades.length === 0 ? 'No trades found.' : null}
            head={
              <tr>
                <th className="px-6 py-3">Trade</th>
                <th className="px-6 py-3">Suggested Rate</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-center">Action</th>
              </tr>
            }
          >
            {visibleTrades.map((t) => {
              const rate = toNumber(t.suggestedRate);
              return (
                <tr key={t.id} className={t.active ? undefined : 'text-slate-400'}>
                  <td className="px-6 py-3 font-medium">{t.name}</td>
                  <td className="px-6 py-3">
                    {rate != null ? `฿${rate.toFixed(2)}/hr` : <span className="text-slate-400">Not set</span>}
                  </td>
                  <td className="px-6 py-3">
                    <StatusText active={t.active} />
                  </td>
                  <td className="px-6 py-3 text-center">
                    {mmsManaged ? (
                      <span className="text-xs text-slate-400">From MMS</span>
                    ) : (
                      <ToggleButton
                        active={t.active}
                        busy={busyId === t.id}
                        onClick={() => void toggle('trades', t.id, t.active, loaders.trades)}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </TableCard>
        </div>
      )}

      {/* ─── Workers ─── */}
      {tab === 'workers' && (
        <div role="tabpanel">
          {!mmsManaged && (
            <AddForm onSubmit={addWorker}>
              <div className="flex-1 min-w-[12rem]">
                <label htmlFor="new-worker-name" className="block text-xs font-medium text-slate-600 mb-1">
                  Worker Name
                </label>
                <input
                  id="new-worker-name"
                  value={workerForm.name}
                  onChange={(e) => setWorkerForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Somchai Jaidee"
                  className={fieldClass}
                />
              </div>
              <div className="w-56">
                <label htmlFor="new-worker-trade" className="block text-xs font-medium text-slate-600 mb-1">
                  Default Trade <span className="text-slate-400">optional</span>
                </label>
                <SearchableSelect
                  compact
                  instanceId="new-worker-trade"
                  inputId="new-worker-trade"
                  options={activeTradeOptions}
                  value={workerForm.tradeId}
                  onChange={(v) => setWorkerForm((f) => ({ ...f, tradeId: v }))}
                  placeholder="Select Trade..."
                />
              </div>
              <button type="submit" disabled={saving} className={primaryBtn}>
                <FontAwesomeIcon icon={saving ? faSpinner : faPlus} spin={saving} className="mr-1" />
                Add Worker
              </button>
            </AddForm>
          )}
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search name, code or trade"
            inactiveCount={workers.filter((w) => !w.active).length}
            showInactive={showInactive}
            onShowInactive={setShowInactive}
            extra={
              <button
                type="button"
                onClick={() =>
                  downloadCsv(`workers_${today}.csv`, [
                    ['Worker Name', 'Default Trade', 'Status'],
                    ...workers.map((w) => [
                      w.name,
                      (w.defaultTradeId && tradeById.get(w.defaultTradeId)?.name) || '',
                      w.active ? 'Active' : 'Inactive',
                    ]),
                  ])
                }
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors"
              >
                <FontAwesomeIcon icon={faFileCsv} className="mr-1 text-success" />
                Export CSV
              </button>
            }
          />
          <TableCard
            empty={visibleWorkers.length === 0 ? 'No workers found.' : null}
            head={
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Default Trade</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-center">Action</th>
              </tr>
            }
          >
            {visibleWorkers.map((w) => (
              <tr key={w.id} className={w.active ? undefined : 'text-slate-400'}>
                <td className="px-6 py-3 font-medium">
                  {w.name}
                  {w.empCode && <span className="ml-2 text-xs font-normal text-slate-400">{w.empCode}</span>}
                </td>
                <td className="px-6 py-3">
                  {(w.defaultTradeId && tradeById.get(w.defaultTradeId)?.name) || (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-6 py-3">
                  <StatusText active={w.active} />
                </td>
                <td className="px-6 py-3 text-center">
                  {mmsManaged ? (
                    <span className="text-xs text-slate-400">From MMS</span>
                  ) : (
                    <ToggleButton
                      active={w.active}
                      busy={busyId === w.id}
                      onClick={() => void toggle('workers', w.id, w.active, loaders.workers)}
                    />
                  )}
                </td>
              </tr>
            ))}
          </TableCard>
        </div>
      )}

      {/* ─── Projects ─── */}
      {tab === 'projects' && (
        <div role="tabpanel">
          {!mmsManaged && (
            <AddForm onSubmit={addProject}>
              <div className="w-44">
                <label htmlFor="new-project-code" className="block text-xs font-medium text-slate-600 mb-1">
                  Code
                </label>
                <input
                  id="new-project-code"
                  value={projectForm.code}
                  onChange={(e) => setProjectForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="ON/037-01/2026"
                  className={`${fieldClass} uppercase`}
                />
              </div>
              <div className="flex-1 min-w-[12rem]">
                <label htmlFor="new-project-name" className="block text-xs font-medium text-slate-600 mb-1">
                  Project Name
                </label>
                <input
                  id="new-project-name"
                  value={projectForm.name}
                  onChange={(e) => setProjectForm((f) => ({ ...f, name: e.target.value }))}
                  className={fieldClass}
                />
              </div>
              <button type="submit" disabled={saving} className={primaryBtn}>
                <FontAwesomeIcon icon={saving ? faSpinner : faPlus} spin={saving} className="mr-1" />
                Add Project
              </button>
            </AddForm>
          )}
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search code or name"
            inactiveCount={projects.filter((p) => !p.active).length}
            showInactive={showInactive}
            onShowInactive={setShowInactive}
          />
          <TableCard
            empty={visibleProjects.length === 0 ? 'No projects found.' : null}
            head={
              <tr>
                <th className="px-6 py-3">Code</th>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-center">Action</th>
              </tr>
            }
          >
            {visibleProjects.map((p) => (
              <tr key={p.id} className={p.active ? undefined : 'text-slate-400'}>
                <td className="px-6 py-3 font-mono text-xs">{p.code}</td>
                <td className="px-6 py-3 font-medium">{p.name}</td>
                <td className="px-6 py-3">
                  <StatusText active={p.active} />
                </td>
                <td className="px-6 py-3 text-center">
                  {mmsManaged ? (
                    <span className="text-xs text-slate-400">From MMS</span>
                  ) : (
                    <ToggleButton
                      active={p.active}
                      busy={busyId === p.id}
                      onClick={() => void toggle('projects', p.id, p.active, loaders.projects)}
                    />
                  )}
                </td>
              </tr>
            ))}
          </TableCard>
        </div>
      )}

      {/* ─── Calendar ─── */}
      {tab === 'calendar' && (
        <div role="tabpanel">
          <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm mb-4 border border-blue-100 flex gap-2">
            <FontAwesomeIcon icon={faCircleInfo} className="mt-0.5" />
            <p>
              Saturdays and Sundays are weekends automatically. Add company holidays that fall on weekdays here — all
              hours on these dates count as OT2. Changes apply to timesheets submitted afterwards; already-submitted
              timesheets keep their day type unless they are rejected and resubmitted.
            </p>
          </div>
          <AddForm onSubmit={addOverride}>
            <div>
              <label htmlFor="new-cal-date" className="block text-xs font-medium text-slate-600 mb-1">
                Date
              </label>
              <input
                id="new-cal-date"
                type="date"
                value={calForm.date}
                onChange={(e) => setCalForm((f) => ({ ...f, date: e.target.value }))}
                className={fieldClass}
              />
            </div>
            <div className="w-36">
              <label htmlFor="new-cal-type" className="block text-xs font-medium text-slate-600 mb-1">
                Type
              </label>
              <select
                id="new-cal-type"
                value={calForm.type}
                onChange={(e) => setCalForm((f) => ({ ...f, type: e.target.value as 'WEEKEND' | 'HOLIDAY' }))}
                className={fieldClass}
              >
                <option value="HOLIDAY">Holiday</option>
                <option value="WEEKEND">Weekend</option>
              </select>
            </div>
            <div className="flex-1 min-w-[12rem]">
              <label htmlFor="new-cal-label" className="block text-xs font-medium text-slate-600 mb-1">
                Label <span className="text-slate-400">optional</span>
              </label>
              <input
                id="new-cal-label"
                value={calForm.label}
                onChange={(e) => setCalForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. HM King's Birthday"
                className={fieldClass}
              />
            </div>
            <button type="submit" disabled={saving} className={primaryBtn}>
              <FontAwesomeIcon icon={saving ? faSpinner : faPlus} spin={saving} className="mr-1" />
              Add Override
            </button>
          </AddForm>
          {pastCount > 0 && (
            <div className="flex justify-end mb-2">
              <label className="text-sm text-slate-600 flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                Show past dates ({pastCount})
              </label>
            </div>
          )}
          <TableCard
            empty={calendarRows.length === 0 ? 'No upcoming holidays set.' : null}
            head={
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Day</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Label</th>
                <th className="px-6 py-3 text-center">Action</th>
              </tr>
            }
          >
            {calendarRows.map((c) => (
              <tr key={c.key} className={c.key < today ? 'text-slate-400' : undefined}>
                <td className="px-6 py-3 font-mono text-xs">{c.key}</td>
                <td className="px-6 py-3 text-slate-500">
                  {new Date(`${c.key}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}
                </td>
                <td className="px-6 py-3">{c.type === 'HOLIDAY' ? 'Holiday' : 'Weekend'}</td>
                <td className="px-6 py-3 text-slate-500">{c.label || '—'}</td>
                <td className="px-6 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => void removeOverride(c.key)}
                    disabled={busyId === c.key}
                    className="text-xs text-danger hover:underline disabled:opacity-50"
                  >
                    {busyId === c.key ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Remove'}
                  </button>
                </td>
              </tr>
            ))}
          </TableCard>
        </div>
      )}

      {/* ─── Users ─── */}
      {tab === 'users' && (
        <div role="tabpanel" className="bg-white rounded-xl border border-slate-200 py-12 px-6 text-center">
          <FontAwesomeIcon icon={faUserShield} className="text-4xl text-slate-300 mb-3" />
          <p className="font-medium text-slate-700">User management isn&apos;t available yet.</p>
          <p className="text-sm text-slate-500 mt-1 max-w-xl mx-auto">
            The API doesn&apos;t have user endpoints yet, so logins, roles and password resets are still set up with the
            seed script. This tab will list users and let you assign roles, deactivate accounts and reset passwords once
            that backend module is added.
          </p>
        </div>
      )}
    </section>
  );
}

function MmsLastRun({ status }: { status: MmsSyncStatus }) {
  const run = status.lastRun;
  if (!run) return <span>never</span>;
  const when = new Date(run.finishedAt ?? run.startedAt).toLocaleString();
  if (run.ok === null) return <span>running since {when}</span>;
  if (!run.ok) return <span className="text-danger">failed at {when} — {run.error}</span>;
  const missing = run.summary?.workersWithoutPosition ?? 0;
  return (
    <span>
      {when}
      {missing > 0 && (
        <span className="text-amber-700"> · {missing} worker(s) have no position in MMS</span>
      )}
    </span>
  );
}
