'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleInfo,
  faMagnifyingGlass,
  faPlus,
  faSpinner,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { api } from '../../../lib/api';
import { useToast } from '../../../lib/toast';
import { apiErrorMessage } from '../../../lib/api-errors';
import { formatHours, toDateKey, toNumber } from '../../../lib/format';
import { buildRateResolver } from '../../../lib/rates';
import type { ContractOverlapError, Timesheet, Trade, Worker, WorkerContract } from '../../../lib/types';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { Modal } from '../../../components/Modal';

interface MissingRate {
  key: string;
  workerId: string;
  workerName: string;
  tradeId: string;
  tradeName: string;
  entryCount: number;
  hours: number;
  firstDate: string;
  lastDate: string;
}

interface ContractForm {
  workerId: string;
  tradeId: string;
  startDate: string;
  endDate: string;
  hourlyRate: string;
}

const EMPTY_FORM: ContractForm = { workerId: '', tradeId: '', startDate: '', endDate: '', hourlyRate: '' };

const fieldClass =
  'w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/35 bg-white';

const money2 = (v: string | number | null) => {
  const n = toNumber(v as string);
  return n == null ? '—' : `฿${n.toFixed(2)}/hr`;
};

export default function WorkerContractsPage() {
  const toast = useToast();
  const startDateRef = useRef<HTMLInputElement>(null);

  const [contracts, setContracts] = useState<WorkerContract[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');

  const [form, setForm] = useState<ContractForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [overlap, setOverlap] = useState<ContractOverlapError | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const loadContracts = useCallback(async () => {
    const res = await api.get<WorkerContract[]>('/worker-contracts');
    setContracts(res.data);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [, w, t, ts] = await Promise.all([
        loadContracts(),
        api.get<Worker[]>('/workers'),
        api.get<Trade[]>('/trades'),
        api.get<Timesheet[]>('/timesheets'),
      ]);
      setWorkers(w.data);
      setTrades(t.data);
      setTimesheets(ts.data);
      setLoadState('ready');
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not load worker contracts.'));
      setLoadState('error');
    }
  }, [loadContracts]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // ─── Needs a Pay Rate: ชั่วโมงที่ PM อนุมัติแล้ว แต่ไม่มีสัญญาครอบคลุมวันที่ทำงาน ───
  const missing = useMemo<MissingRate[]>(() => {
    const resolve = buildRateResolver(contracts);
    const groups = new Map<string, MissingRate>();
    for (const ts of timesheets) {
      if (ts.status !== 'APPROVED') continue;
      const date = toDateKey(ts.date);
      for (const e of ts.entries) {
        if (resolve(e.workerId, e.tradeId, date) != null) continue;
        const key = `${e.workerId}|${e.tradeId}`;
        if (!groups.has(key)) {
          groups.set(key, {
            key,
            workerId: e.workerId,
            workerName: e.worker.name,
            tradeId: e.tradeId,
            tradeName: e.trade.name,
            entryCount: 0,
            hours: 0,
            firstDate: date,
            lastDate: date,
          });
        }
        const g = groups.get(key)!;
        g.entryCount += 1;
        g.hours += e.st + e.ot1 + e.ot2;
        if (date < g.firstDate) g.firstDate = date;
        if (date > g.lastDate) g.lastDate = date;
      }
    }
    return [...groups.values()].sort(
      (a, b) => a.workerName.localeCompare(b.workerName) || a.tradeName.localeCompare(b.tradeName),
    );
  }, [contracts, timesheets]);

  // ─── ตัวเลือกในฟอร์ม (เฉพาะรายการที่ใช้งานอยู่) ───
  const workerOptions = useMemo(
    () => workers.filter((w) => w.active).map((w) => ({ value: w.id, label: w.name })),
    [workers],
  );
  const tradeOptions = useMemo(
    () => trades.filter((t) => t.active).map((t) => ({ value: t.id, label: t.name })),
    [trades],
  );

  /** เลือกตำแหน่งแล้วเติมอัตราแนะนำของตำแหน่งนั้น ถ้ายังไม่ได้กรอกอัตรา (เหมือน prototype) */
  function selectTrade(tradeId: string) {
    setForm((f) => {
      const suggested = toNumber(trades.find((t) => t.id === tradeId)?.suggestedRate ?? null);
      return { ...f, tradeId, hourlyRate: f.hourlyRate || (suggested != null ? suggested.toFixed(2) : '') };
    });
  }

  /** ปุ่ม Add Rate — กรอกคนงาน ตำแหน่ง และวันเริ่มเป็นวันแรกที่ยังไม่มีราคาให้ล่วงหน้า */
  function prefillFromMissing(m: MissingRate) {
    const suggested = toNumber(trades.find((t) => t.id === m.tradeId)?.suggestedRate ?? null);
    setForm({
      workerId: m.workerId,
      tradeId: m.tradeId,
      startDate: m.firstDate,
      endDate: '',
      hourlyRate: suggested != null ? suggested.toFixed(2) : '',
    });
    startDateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    startDateRef.current?.focus();
  }

  // ─── บันทึกสัญญา ───
  function validate(): string | null {
    if (!form.workerId || !form.tradeId || !form.startDate || form.hourlyRate === '') {
      return 'Please fill in Worker, Position, Start Date and Hourly Rate.';
    }
    if (form.endDate && form.endDate < form.startDate) return 'End Date must be on or after Start Date.';
    const rate = Number(form.hourlyRate);
    if (!Number.isFinite(rate) || rate < 0) return 'Hourly Rate must be a number of 0 or more.';
    // ฐานข้อมูลเก็บทศนิยม 2 ตำแหน่ง — กันการปัดเศษเงียบๆ
    if (!/^\d+(\.\d{1,2})?$/.test(form.hourlyRate.trim())) return 'Hourly Rate can have at most 2 decimal places.';
    return null;
  }

  async function saveContract(allowOverlap: boolean) {
    const problem = validate();
    if (problem) return toast(problem, true);

    setSaving(true);
    try {
      await api.post('/worker-contracts', {
        workerId: form.workerId,
        tradeId: form.tradeId,
        startDate: form.startDate,
        ...(form.endDate ? { endDate: form.endDate } : {}),
        hourlyRate: Number(form.hourlyRate),
        ...(allowOverlap ? { allowOverlap: true } : {}),
      });
      toast('Contract added.');
      setOverlap(null);
      setForm(EMPTY_FORM);
      await loadContracts();
    } catch (err) {
      // 409 = ช่วงวันที่ทับสัญญาเดิม → ถามยืนยันก่อนบันทึกซ้ำ (เหมือน confirm() ใน prototype)
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setOverlap(err.response.data as ContractOverlapError);
      } else {
        toast(`Failed to add contract: ${apiErrorMessage(err)}`, true);
        setOverlap(null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c: WorkerContract) {
    setTogglingId(c.id);
    try {
      await api.patch(`/worker-contracts/${c.id}/active`, { active: !c.active });
      toast(c.active ? 'Contract deactivated.' : 'Contract reactivated.');
      await loadContracts();
    } catch (err) {
      toast(`Update failed: ${apiErrorMessage(err)}`, true);
    } finally {
      setTogglingId(null);
    }
  }

  // ─── ตารางสัญญา ───
  const visibleContracts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts.filter(
      (c) =>
        (showInactive || c.active) &&
        (!q || c.worker.name.toLowerCase().includes(q) || c.trade.name.toLowerCase().includes(q)),
    );
  }, [contracts, search, showInactive]);

  const inactiveCount = contracts.filter((c) => !c.active).length;

  if (loadState === 'loading') {
    return (
      <section className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 py-16 text-center text-slate-400">
          <FontAwesomeIcon icon={faSpinner} spin className="text-2xl mb-3" />
          <p>Loading worker contracts...</p>
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
        <h3 className="font-semibold text-slate-800 text-lg mb-1">Worker Contracts</h3>
        <p className="text-sm text-slate-500">
          Pay is determined by the contract covering each worker&apos;s position on the date the work was performed.
        </p>
      </div>

      <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm mb-6 border border-blue-100 flex gap-2">
        <FontAwesomeIcon icon={faCircleInfo} className="mt-0.5" />
        <p>
          When payroll is calculated for a worker + position + date, the system finds the contract whose start/end date
          covers that date and uses its rate. Leave End Date blank for an open-ended contract that&apos;s still in effect.
          Foremen never need a contract on file to submit or get hours approved — it only needs to exist by the time you
          generate a payroll report.
        </p>
      </div>

      {/* ─── Needs a Pay Rate ─── */}
      <div className="mb-6">
        <h4 className="font-semibold text-slate-800 mb-2">
          <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-500 mr-1" />
          Needs a Pay Rate{' '}
          {missing.length > 0 && <span className="text-sm font-normal text-slate-400">({missing.length})</span>}
        </h4>
        <p className="text-sm text-slate-500 mb-2">
          Workers with <strong>approved</strong> hours that have no contract covering the date they worked — add a rate
          below so payroll can price them.
        </p>
        {missing.length === 0 ? (
          <div className="text-sm text-slate-400 italic bg-white border border-slate-200 rounded-xl px-4 py-3">
            All approved hours are priced — nothing pending.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[720px]">
                <thead className="text-xs text-slate-600 bg-amber-50 uppercase border-b border-amber-200">
                  <tr>
                    <th className="px-6 py-3">Worker</th>
                    <th className="px-6 py-3">Position</th>
                    <th className="px-6 py-3 text-center">Approved Entries</th>
                    <th className="px-6 py-3 text-center">Unpriced Hours</th>
                    <th className="px-6 py-3">Date Range</th>
                    <th className="px-6 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {missing.map((m) => (
                    <tr key={m.key}>
                      <td className="px-6 py-3 font-medium">{m.workerName}</td>
                      <td className="px-6 py-3">{m.tradeName}</td>
                      <td className="px-6 py-3 text-center">{m.entryCount}</td>
                      <td className="px-6 py-3 text-center">{formatHours(m.hours)}</td>
                      <td className="px-6 py-3 font-mono text-xs whitespace-nowrap">
                        {m.firstDate === m.lastDate ? m.firstDate : `${m.firstDate} to ${m.lastDate}`}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => prefillFromMissing(m)}
                          className="text-xs text-primary hover:underline font-medium"
                        >
                          Add Rate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ─── ฟอร์มเพิ่มสัญญา ─── */}
      <form
        className="bg-white p-4 rounded-xl border border-slate-200 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          void saveContract(false);
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1.4fr_1fr_1fr_0.9fr_auto] gap-3 items-end">
          <div>
            <label htmlFor="ct-worker" className="block text-xs font-medium text-slate-600 mb-1">
              Worker
            </label>
            <SearchableSelect
              compact
              instanceId="ct-worker"
              inputId="ct-worker"
              options={workerOptions}
              value={form.workerId}
              onChange={(v) => setForm((f) => ({ ...f, workerId: v }))}
              placeholder="Select Worker..."
            />
          </div>
          <div>
            <label htmlFor="ct-trade" className="block text-xs font-medium text-slate-600 mb-1">
              Position
            </label>
            <SearchableSelect
              compact
              instanceId="ct-trade"
              inputId="ct-trade"
              options={tradeOptions}
              value={form.tradeId}
              onChange={selectTrade}
              placeholder="Select Position..."
            />
          </div>
          <div>
            <label htmlFor="ct-start" className="block text-xs font-medium text-slate-600 mb-1">
              Start Date
            </label>
            <input
              ref={startDateRef}
              id="ct-start"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="ct-end" className="block text-xs font-medium text-slate-600 mb-1">
              End Date <span className="text-slate-400">(optional)</span>
            </label>
            <input
              id="ct-end"
              type="date"
              value={form.endDate}
              min={form.startDate || undefined}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="ct-rate" className="block text-xs font-medium text-slate-600 mb-1">
              Hourly Rate (฿)
            </label>
            <input
              id="ct-rate"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.hourlyRate}
              onChange={(e) => setForm((f) => ({ ...f, hourlyRate: e.target.value }))}
              className={fieldClass}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-70 disabled:cursor-wait whitespace-nowrap"
          >
            <FontAwesomeIcon icon={saving ? faSpinner : faPlus} spin={saving} className="mr-1" />
            Add Contract
          </button>
        </div>
      </form>

      {/* ─── รายการสัญญา ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div className="relative w-full sm:w-72">
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search worker or position"
            aria-label="Search contracts"
            className={`${fieldClass} pl-9`}
          />
        </div>
        {inactiveCount > 0 && (
          <label className="text-sm text-slate-600 flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Show inactive ({inactiveCount})
          </label>
        )}
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[800px]">
            <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Worker</th>
                <th className="px-6 py-3">Position</th>
                <th className="px-6 py-3">Start Date</th>
                <th className="px-6 py-3">End Date</th>
                <th className="px-6 py-3 text-right">Hourly Rate</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleContracts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    {contracts.length === 0 ? 'No contracts yet — add one above.' : 'No contracts match your search.'}
                  </td>
                </tr>
              )}
              {visibleContracts.map((c) => (
                <tr key={c.id} className={c.active ? undefined : 'text-slate-400'}>
                  <td className="px-6 py-3 font-medium">{c.worker.name}</td>
                  <td className="px-6 py-3">{c.trade.name}</td>
                  <td className="px-6 py-3 font-mono text-xs">{toDateKey(c.startDate)}</td>
                  <td className="px-6 py-3 font-mono text-xs">
                    {c.endDate ? toDateKey(c.endDate) : <span className="font-sans text-slate-400">Open-ended</span>}
                  </td>
                  <td className="px-6 py-3 text-right whitespace-nowrap">{money2(c.hourlyRate)}</td>
                  <td className="px-6 py-3">
                    {c.active ? (
                      <span className="text-success text-xs">Active</span>
                    ) : (
                      <span className="text-slate-400 text-xs">Inactive</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => void toggleActive(c)}
                      disabled={togglingId === c.id}
                      className="text-xs text-secondary hover:underline disabled:opacity-50"
                    >
                      {togglingId === c.id ? (
                        <FontAwesomeIcon icon={faSpinner} spin />
                      ) : c.active ? (
                        'Deactivate'
                      ) : (
                        'Reactivate'
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── ยืนยันเมื่อช่วงวันที่ทับสัญญาเดิม ─── */}
      {overlap && (
        <Modal
          title="Overlapping contract"
          busy={saving}
          onClose={() => setOverlap(null)}
          footer={
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOverlap(null)}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveContract(true)}
                disabled={saving}
                className="px-5 py-2 text-sm font-medium text-white bg-primary hover:bg-blue-800 rounded-lg shadow-sm disabled:opacity-70 disabled:cursor-wait"
              >
                {saving && <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />}
                Add it anyway
              </button>
            </div>
          }
        >
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              This overlaps {overlap.overlaps.length} existing contract(s) for{' '}
              <strong>{workers.find((w) => w.id === form.workerId)?.name}</strong> as{' '}
              <strong>{trades.find((t) => t.id === form.tradeId)?.name}</strong>:
            </p>
            <ul className="bg-slate-50 border border-slate-200 rounded-lg divide-y divide-slate-200">
              {overlap.overlaps.map((o) => (
                <li key={o.id} className="px-4 py-2 flex justify-between gap-4 font-mono text-xs">
                  <span>
                    {toDateKey(o.startDate)} to {o.endDate ? toDateKey(o.endDate) : 'open-ended'}
                  </span>
                  <span>{money2(o.hourlyRate)}</span>
                </li>
              ))}
            </ul>
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <FontAwesomeIcon icon={faTriangleExclamation} className="mr-1" />
              For any date both cover, the contract with the later Start Date wins. That is what you want for a pay
              change (the new rate applies from its Start Date onward). If the old contract was entered by mistake,
              cancel and deactivate it instead.
            </p>
          </div>
        </Modal>
      )}
    </section>
  );
}
