'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCirclePlus,
  faRotateLeft,
  faRotateRight,
  faCircleInfo,
  faUserPlus,
  faTrashCan,
  faPaperPlane,
  faSpinner,
  faCheck,
  faCalendarDay,
  faCalendarXmark,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { useToast } from '../../../lib/toast';
import { apiErrorMessage } from '../../../lib/api-errors';
import { calculateHours, resolveDayType } from '../../../lib/timesheet-calc';
import { formatHours, todayKey, toDateKey } from '../../../lib/format';
import type {
  CalendarOverride,
  CreateTimesheetInput,
  DayType,
  Project,
  Timesheet,
  Trade,
  Worker,
} from '../../../lib/types';
import { SearchableSelect, type SelectOption } from '../../../components/SearchableSelect';
import { SubmissionHistory } from '../../../components/field-input/SubmissionHistory';

// ─── แถวคนงานในฟอร์ม ────────────────────────────────────────

interface Row {
  key: string;
  workerId: string;
  tradeId: string;
  startTime: string;
  endTime: string;
}

let rowSeq = 0;
/** เวลาเริ่มต้น 08:00–18:00 เหมือน prototype */
function newRow(partial?: Partial<Omit<Row, 'key'>>): Row {
  rowSeq += 1;
  return { key: `row-${rowSeq}`, workerId: '', tradeId: '', startTime: '08:00', endTime: '18:00', ...partial };
}

interface EditingState {
  id: string;
  rejectedBy: string;
  reason: string;
}

const NO_HOURS = { st: 0, ot1: 0, ot2: 0 };

const inputClass =
  'w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary outline-none transition-shadow';
const timeInputClass =
  'w-full min-w-[7.5rem] border border-slate-300 rounded px-2 py-1 text-center text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/35';

/** ตัวเลือกใน dropdown: เฉพาะรายการ active + รายการที่เลือกอยู่แล้ว (กรณีแก้ใบเก่าที่อ้างถึงของที่ถูกปิดใช้งาน) */
function activeOptions<T extends { id: string; active: boolean }>(
  items: T[],
  selectedId: string,
  label: (item: T) => string,
): SelectOption[] {
  return items
    .filter((item) => item.active || item.id === selectedId)
    .map((item) => ({ value: item.id, label: item.active ? label(item) : `${label(item)} (inactive)` }));
}

/** ชื่อ + รหัสพนักงาน (จาก MMS) — กันเลือกผิดคนเมื่อชื่อซ้ำ และพิมพ์ค้นด้วยรหัสได้ */
const workerLabel = (w: Worker) => (w.empCode ? `${w.name} (${w.empCode})` : w.name);

export default function FieldInputPage() {
  const { user } = useAuth();
  const toast = useToast();
  const formTopRef = useRef<HTMLDivElement>(null);
  const isAdmin = user?.role === 'ADMIN';

  // ─── ข้อมูลหลักจาก API ───
  const [projects, setProjects] = useState<Project[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [overrides, setOverrides] = useState<CalendarOverride[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');

  // ─── สถานะฟอร์ม ───
  const [projectId, setProjectId] = useState('');
  const [jobCode, setJobCode] = useState('');
  // หน้านี้ถูก render หลังเช็ค login เสร็จเท่านั้น (ฝั่ง browser) วันที่จึงเป็นของเครื่องผู้ใช้
  const [date, setDate] = useState(todayKey);
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Row[]>(() => [newRow()]);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'done'>('idle');

  const loadAll = useCallback(async () => {
    try {
      const [p, w, t, c, ts] = await Promise.all([
        api.get<Project[]>('/projects'),
        api.get<Worker[]>('/workers'),
        api.get<Trade[]>('/trades'),
        api.get<CalendarOverride[]>('/calendar-overrides'),
        api.get<Timesheet[]>('/timesheets'),
      ]);
      setProjects(p.data);
      setWorkers(w.data);
      setTrades(t.data);
      setOverrides(c.data);
      setTimesheets(ts.data);
      setLoadState('ready');
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not load data.'));
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  function retryLoad() {
    setLoadState('loading');
    void loadAll();
  }

  // ─── ค่าที่คำนวณจากฟอร์ม ───
  const workerById = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers]);
  const tradeById = useMemo(() => new Map(trades.map((t) => [t.id, t])), [trades]);

  const dayType: DayType | null = date ? resolveDayType(date, overrides) : null;
  const holidayLabel = date ? overrides.find((o) => toDateKey(o.date) === date)?.label : null;

  const rowHours = rows.map((r) => (dayType ? calculateHours(r.startTime, r.endTime, dayType) : NO_HOURS));
  const totals = rowHours.reduce(
    (acc, h) => ({ st: acc.st + h.st, ot1: acc.ot1 + h.ot1, ot2: acc.ot2 + h.ot2 }),
    NO_HOURS,
  );

  const projectOptions = useMemo(
    () => activeOptions(projects, projectId, (p) => `${p.code} - ${p.name}`),
    [projects, projectId],
  );

  // ─── การแก้ไขแถว ───
  function updateRow(key: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  /** เลือกคนงานแล้วเติมตำแหน่งเริ่มต้นของคนนั้นให้อัตโนมัติ (ถ้าตำแหน่งนั้นยังใช้งานอยู่) */
  function handleWorkerChange(key: string, workerId: string) {
    const defaultTradeId = workerById.get(workerId)?.defaultTradeId;
    const patch: Partial<Row> = { workerId };
    if (defaultTradeId && tradeById.get(defaultTradeId)?.active) patch.tradeId = defaultTradeId;
    updateRow(key, patch);
  }

  function addRow() {
    setRows((rs) => [...rs, newRow()]);
  }

  function removeRow(key: string) {
    setRows((rs) => rs.filter((r) => r.key !== key));
  }

  function resetForm() {
    setEditing(null);
    setProjectId('');
    setJobCode('');
    setNotes('');
    setRows([newRow()]);
  }

  /** Edit & Resubmit — โหลดใบที่ถูก Reject กลับเข้าฟอร์ม แล้วตอนส่งจะอัปเดตใบเดิม ไม่สร้างใบใหม่ */
  function startEdit(ts: Timesheet) {
    setEditing({
      id: ts.id,
      rejectedBy: ts.reviewedBy?.name ?? 'PM',
      reason: ts.rejectReason || 'No reason given.',
    });
    setProjectId(ts.projectId);
    setJobCode(ts.jobCode ?? '');
    setDate(toDateKey(ts.date));
    setNotes(ts.notes ?? '');
    setRows(
      ts.entries.length > 0
        ? ts.entries.map((e) =>
            newRow({ workerId: e.workerId, tradeId: e.tradeId, startTime: e.startTime, endTime: e.endTime }),
          )
        : [newRow()],
    );
    formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ─── ส่งข้อมูล ───
  async function handleSubmit() {
    if (!projectId || !date) {
      toast('Please select Project and Date.', true);
      return;
    }

    // แถวที่ยังไม่ได้เลือกคนงานถือว่าว่าง ข้ามไป (เหมือน prototype)
    const assigned = rows.map((r, i) => ({ row: r, hours: rowHours[i] })).filter((x) => x.row.workerId);

    if (assigned.some((x) => !x.row.tradeId)) {
      toast('Please ensure a Position/Trade is selected for every assigned worker.', true);
      return;
    }
    if (assigned.length === 0) {
      toast('Please add at least one worker with valid hours.', true);
      return;
    }
    // prototype ตัดแถวที่ได้ 0 ชม. ทิ้งเงียบๆ — ที่นี่แจ้งชื่อคนงานแทน กันชั่วโมงหายโดยไม่รู้ตัว
    const zeroHours = assigned.find((x) => x.hours.st + x.hours.ot1 + x.hours.ot2 === 0);
    if (zeroHours) {
      const name = workerById.get(zeroHours.row.workerId)?.name ?? 'a worker';
      toast(`End time must be after start time for ${name}.`, true);
      return;
    }

    const payload: CreateTimesheetInput = {
      projectId,
      date,
      jobCode: jobCode.trim() || undefined,
      notes: notes.trim() || undefined,
      entries: assigned.map(({ row }) => ({
        workerId: row.workerId,
        tradeId: row.tradeId,
        startTime: row.startTime,
        endTime: row.endTime,
      })),
    };

    const wasEditing = editing;
    setSubmitState('submitting');
    try {
      if (wasEditing) await api.patch(`/timesheets/${wasEditing.id}/resubmit`, payload);
      else await api.post('/timesheets', payload);

      resetForm();
      setSubmitState('done');
      toast(wasEditing ? 'Timesheet resubmitted to PM.' : 'Timesheet submitted to PM.');
      setTimeout(() => setSubmitState('idle'), 2000);

      const res = await api.get<Timesheet[]>('/timesheets');
      setTimesheets(res.data);
    } catch (err) {
      toast(`Submit failed: ${apiErrorMessage(err, 'Please try again.')}`, true);
      setSubmitState('idle');
    }
  }

  // ─── แสดงผล ───
  if (loadState === 'loading') {
    return (
      <section className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 py-16 text-center text-slate-400">
          <FontAwesomeIcon icon={faSpinner} spin className="text-2xl mb-3" />
          <p>Loading projects and workers...</p>
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
            onClick={retryLoad}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-blue-800 transition-colors"
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  const submitLabel =
    submitState === 'submitting' ? (
      <>
        <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
        Submitting...
      </>
    ) : submitState === 'done' ? (
      <>
        <FontAwesomeIcon icon={faCheck} className="mr-2" />
        Submitted
      </>
    ) : editing ? (
      <>
        <FontAwesomeIcon icon={faRotateRight} className="mr-2" />
        Resubmit to PM
      </>
    ) : (
      <>
        <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
        Submit to PM
      </>
    );

  return (
    <section className="max-w-6xl mx-auto">
      <div ref={formTopRef} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6 scroll-mt-4">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center gap-4">
          <h3 className="font-semibold text-slate-800">
            <FontAwesomeIcon icon={editing ? faRotateLeft : faCirclePlus} className="text-secondary mr-2" />
            {editing ? 'Edit Rejected Log' : 'New Daily Log'}
          </h3>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium whitespace-nowrap">
            Status: Draft
          </span>
        </div>

        {editing && (
          <div className="mx-6 mt-4 bg-red-50 text-red-800 p-3 rounded-lg text-sm border border-red-200 flex gap-2">
            <FontAwesomeIcon icon={faRotateLeft} className="mt-0.5" />
            <div>
              <strong>Editing a rejected submission.</strong> Rejected by{' '}
              <span className="font-medium">{editing.rejectedBy}</span>: <span className="italic">{editing.reason}</span>
              <br />
              <span className="text-xs text-red-600">
                Fix what&apos;s needed below and click Resubmit to PM — this updates the same entry rather than creating a
                new one.
              </span>
            </div>
          </div>
        )}

        <div className="p-6">
          {/* กด Enter ในช่องข้อความต้องไม่ส่งฟอร์มโดยไม่ตั้งใจ — ส่งได้ทางปุ่ม Submit เท่านั้น (เหมือน prototype) */}
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            {/* ─── โครงการและวันที่ ─── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <span className="block text-sm font-medium text-slate-700 mb-1">Submitted By (Foreman)</span>
                <div className="w-full border border-slate-200 bg-slate-50 rounded-lg px-4 py-2 text-slate-700 truncate">
                  {user?.name ?? '--'}
                </div>
              </div>
              <div>
                <label htmlFor="input-project" className="block text-sm font-medium text-slate-700 mb-1">
                  Project
                </label>
                <SearchableSelect
                  instanceId="input-project"
                  inputId="input-project"
                  options={projectOptions}
                  value={projectId}
                  onChange={setProjectId}
                  placeholder="Select Project..."
                />
              </div>
              <div>
                <label htmlFor="input-job-code" className="block text-sm font-medium text-slate-700 mb-1">
                  Job No. <span className="text-slate-400 font-normal">— optional</span>
                </label>
                <input
                  id="input-job-code"
                  type="text"
                  value={jobCode}
                  onChange={(e) => setJobCode(e.target.value)}
                  placeholder="e.g. JC-A101"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="input-date" className="block text-sm font-medium text-slate-700 mb-1">
                  Date
                </label>
                <input
                  id="input-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className={inputClass}
                />
                {dayType === 'STANDARD' && (
                  <p className="text-xs mt-1 text-blue-600">
                    <FontAwesomeIcon icon={faCalendarDay} className="text-blue-500 mr-1" />
                    Standard Working Day (ST &amp; OT1 Apply)
                  </p>
                )}
                {dayType && dayType !== 'STANDARD' && (
                  <p className="text-xs mt-1 font-medium text-red-600 bg-red-50 px-2 py-1 rounded inline-block border border-red-200">
                    <FontAwesomeIcon icon={faCalendarXmark} className="text-red-500 mr-1" />
                    {dayType === 'WEEKEND' ? 'Weekend' : 'Holiday'}
                    {holidayLabel ? ` — ${holidayLabel}` : ''} (All hours auto-calculated as OT2)
                  </p>
                )}
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* ─── ชั่วโมงทำงานของคนงาน ─── */}
            <div>
              <div className="flex flex-wrap justify-between items-end gap-3 mb-4">
                <h4 className="font-medium text-slate-800">Manpower Hours</h4>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                    <FontAwesomeIcon icon={faCircleInfo} className="text-blue-500 mr-1" />
                    1-hour unpaid lunch auto-deducted for shifts &gt; 5h
                  </div>
                  <button
                    type="button"
                    onClick={addRow}
                    className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-slate-300"
                  >
                    <FontAwesomeIcon icon={faUserPlus} className="mr-1" />
                    Add Worker
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm text-left min-w-[900px]">
                  <thead className="text-xs text-slate-600 bg-slate-50 uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 w-1/4">Worker Name</th>
                      <th className="px-4 py-3 w-1/5">Position / Trade</th>
                      <th className="px-4 py-3 text-center">Start Time</th>
                      <th className="px-4 py-3 text-center">End Time</th>
                      <th className="px-4 py-3 text-center bg-slate-100 border-l border-slate-200" title="Calculated Standard Hours">
                        ST
                        <br />
                        <span className="text-[10px] text-slate-400 font-normal">(Auto)</span>
                      </th>
                      <th className="px-4 py-3 text-center bg-slate-100" title="Calculated Overtime 1.5x">
                        OT1
                        <br />
                        <span className="text-[10px] text-slate-400 font-normal">(Auto)</span>
                      </th>
                      <th className="px-4 py-3 text-center bg-slate-100 border-r border-slate-200" title="Calculated Overtime 2.0x">
                        OT2
                        <br />
                        <span className="text-[10px] text-slate-400 font-normal">(Auto)</span>
                      </th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                          No workers yet — click Add Worker.
                        </td>
                      </tr>
                    )}
                    {rows.map((row, i) => {
                      const h = rowHours[i];
                      return (
                        <tr key={row.key} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2">
                            <SearchableSelect
                              compact
                              instanceId={`${row.key}-worker`}
                              ariaLabel={`Worker, row ${i + 1}`}
                              options={activeOptions(workers, row.workerId, workerLabel)}
                              value={row.workerId}
                              onChange={(v) => handleWorkerChange(row.key, v)}
                              placeholder="Select Worker..."
                            />
                          </td>
                          <td className="px-4 py-2">
                            <SearchableSelect
                              compact
                              instanceId={`${row.key}-trade`}
                              ariaLabel={`Position, row ${i + 1}`}
                              options={activeOptions(trades, row.tradeId, (t) => t.name)}
                              value={row.tradeId}
                              onChange={(v) => updateRow(row.key, { tradeId: v })}
                              placeholder="Select Position..."
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="time"
                              aria-label={`Start time, row ${i + 1}`}
                              value={row.startTime}
                              onChange={(e) => updateRow(row.key, { startTime: e.target.value })}
                              className={timeInputClass}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="time"
                              aria-label={`End time, row ${i + 1}`}
                              value={row.endTime}
                              onChange={(e) => updateRow(row.key, { endTime: e.target.value })}
                              className={timeInputClass}
                            />
                          </td>
                          <td className="px-4 py-2 text-center bg-slate-50/50 border-l border-slate-100">
                            <span className="font-medium text-slate-700">{formatHours(h.st)}</span>
                          </td>
                          <td className="px-4 py-2 text-center bg-slate-50/50">
                            <span className={`font-medium ${h.ot1 > 0 ? 'text-accent' : 'text-slate-400'}`}>
                              {formatHours(h.ot1)}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center bg-slate-50/50 border-r border-slate-100">
                            <span className={`font-medium ${h.ot2 > 0 ? 'text-danger' : 'text-slate-400'}`}>
                              {formatHours(h.ot2)}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeRow(row.key)}
                              title="Remove row"
                              aria-label={`Remove row ${i + 1}`}
                              className="text-slate-400 hover:text-danger transition-colors p-1"
                            >
                              <FontAwesomeIcon icon={faTrashCan} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200 font-medium">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-right text-slate-600 border-r border-slate-200">
                        Calculated Daily Totals:
                      </td>
                      <td className="px-4 py-3 text-center text-slate-800 bg-slate-100">{formatHours(totals.st)}</td>
                      <td className="px-4 py-3 text-center text-slate-800 bg-slate-100">{formatHours(totals.ot1)}</td>
                      <td className="px-4 py-3 text-center text-slate-800 bg-slate-100 border-r border-slate-200">
                        {formatHours(totals.ot2)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div>
              <label htmlFor="input-notes" className="block text-sm font-medium text-slate-700 mb-1">
                Supervisor Notes (Weather, Delays, etc.)
              </label>
              <textarea
                id="input-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g., Rain delay from 13:00 to 14:00. Client rep signed off on paper log."
                className={`${inputClass} resize-none`}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={resetForm}
                disabled={submitState === 'submitting'}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {editing ? 'Cancel Edit' : 'Clear'}
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitState !== 'idle'}
                className={`px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm disabled:cursor-wait ${
                  submitState === 'done' ? 'bg-success' : 'bg-primary hover:bg-blue-800'
                }`}
              >
                {submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>

      <SubmissionHistory
        title={isAdmin ? 'Recent Submissions (All Foremen)' : 'My Recent Submissions'}
        timesheets={timesheets}
        currentUserId={user?.id ?? ''}
        onEdit={startEdit}
        editingId={editing?.id ?? null}
      />
    </section>
  );
}
