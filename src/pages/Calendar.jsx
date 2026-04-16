import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp, useBeds, useAssignments, useHistory } from '../store/AppContext';
import {
  CROPS, getCropById, getFamilyColor, getFamilyBgColor,
  isSowableInMonth, MONTHS,
} from '../data/crops';

const ROTATION_GAP = { Brassica: 3, Potato: 3, Allium: 3, Root: 2, Legume: 2, Cucurbit: 2 };

// ── helpers ───────────────────────────────────────────────────────────────────

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CURRENT_YEAR = new Date().getFullYear();
const TODAY = new Date().toISOString().split('T')[0];

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function monthInWindow(m, start, end) {
  if (!start || !end) return false;
  return start <= end
    ? m >= start && m <= end
    : m >= start || m <= end;
}

function addWeeks(dateStr, n) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n * 7);
  return d.toISOString().split('T')[0];
}

function daysBetween(a, b) {
  return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
}

// ── Add/Edit Assignment Modal ─────────────────────────────────────────────────

function AssignmentModal({ assignment, onSave, onClose, beds, history }) {
  const isNew = !assignment;
  const [form, setForm] = useState(() => isNew ? {
    bedId: beds[0]?.id || '',
    cropId: CROPS[0].id,
    variety: '',
    sowDate: TODAY,
    transplantDate: '',
    expectedHarvestDate: '',
    status: 'planned',
    successionIntervalWeeks: '',
    season: CURRENT_YEAR,
  } : {
    bedId: assignment.bedId,
    cropId: assignment.cropId,
    variety: assignment.variety || '',
    sowDate: assignment.sowDate || TODAY,
    transplantDate: assignment.transplantDate || '',
    expectedHarvestDate: assignment.expectedHarvestDate || '',
    status: assignment.status,
    successionIntervalWeeks: assignment.successionIntervalWeeks || '',
    season: assignment.season || CURRENT_YEAR,
  });

  const selectedCrop = getCropById(form.cropId);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function handleCropChange(cropId) {
    const crop = getCropById(cropId);
    setForm(f => ({
      ...f,
      cropId,
      // Auto-fill expected harvest from sow date + degree-days guess
      expectedHarvestDate: f.sowDate && crop?.degreesDaysToHarvest
        ? addWeeks(f.sowDate, Math.round(crop.degreesDaysToHarvest / 100))
        : f.expectedHarvestDate,
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.bedId || !form.cropId || !form.sowDate) return;
    onSave({
      ...form,
      successionIntervalWeeks: form.successionIntervalWeeks
        ? parseInt(form.successionIntervalWeeks) : null,
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{isNew ? 'Add crop to bed' : 'Edit assignment'}</span>
          <button className="btn btn-ghost modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Crop *</label>
                <select className="form-control" value={form.cropId}
                  onChange={e => handleCropChange(e.target.value)}>
                  {CROPS.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.perennial ? ' (perennial)' : ''}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Bed *</label>
                <select className="form-control" value={form.bedId}
                  onChange={e => set('bedId', e.target.value)} required>
                  <option value="">— choose bed —</option>
                  {beds.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedCrop && (
              <div className="crop-hint-bar"
                style={{ background: getFamilyBgColor(selectedCrop.family), borderColor: getFamilyColor(selectedCrop.family) + '55' }}>
                <span className="family-badge"
                  style={{ background: getFamilyColor(selectedCrop.family) + '22', color: getFamilyColor(selectedCrop.family) }}>
                  {selectedCrop.familyCommon}
                </span>
                <span className="text-xs text-muted">
                  Sow: {selectedCrop.sowWindowStart ? `${MONTHS[selectedCrop.sowWindowStart - 1]}–${MONTHS[selectedCrop.sowWindowEnd - 1]}` : 'n/a'}
                  {' · '}Harvest: {selectedCrop.harvestWindowStart ? `${MONTHS[selectedCrop.harvestWindowStart - 1]}–${MONTHS[selectedCrop.harvestWindowEnd - 1]}` : 'n/a'}
                  {selectedCrop.perennial && ' · Perennial'}
                </span>
              </div>
            )}

            {/* Rotation warning */}
            {(() => {
              if (!form.bedId || !selectedCrop || selectedCrop.perennial) return null;
              const rg = selectedCrop.rotationGroup;
              const gap = ROTATION_GAP[rg];
              if (!gap) return null;
              const currentYear = CURRENT_YEAR;
              for (let y = currentYear - 1; y >= currentYear - gap; y--) {
                const clash = history.find(h =>
                  h.bedId === form.bedId &&
                  h.year === y &&
                  getCropById(h.cropId)?.rotationGroup === rg
                );
                if (clash) {
                  const bed = beds.find(b => b.id === form.bedId);
                  return (
                    <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
                      <span className="alert-icon">⚠️</span>
                      <div className="alert-body">
                        <div className="alert-title">Rotation warning</div>
                        <div className="alert-text">
                          {clash.cropName} ({rg} family) was in {bed?.name || 'this bed'} in {y}.
                          Recommended gap: {gap} years to reduce soil-borne disease risk.
                        </div>
                      </div>
                    </div>
                  );
                }
              }
              return null;
            })()}

            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Variety (optional)</label>
                <input className="form-control" value={form.variety}
                  onChange={e => set('variety', e.target.value)}
                  placeholder="e.g. Nantes, Chantenay…" />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-control" value={form.status}
                  onChange={e => set('status', e.target.value)}>
                  <option value="planned">Planned</option>
                  <option value="sown">Sown</option>
                  <option value="germinated">Germinated</option>
                  <option value="growing">Growing</option>
                </select>
              </div>
            </div>

            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Sow date *</label>
                <input className="form-control" type="date" value={form.sowDate}
                  onChange={e => set('sowDate', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Transplant date</label>
                <input className="form-control" type="date" value={form.transplantDate}
                  onChange={e => set('transplantDate', e.target.value)} />
                <p className="form-hint">Leave blank if direct sow</p>
              </div>
            </div>

            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Expected harvest</label>
                <input className="form-control" type="date" value={form.expectedHarvestDate}
                  onChange={e => set('expectedHarvestDate', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Succession every (weeks)</label>
                <input className="form-control" type="number" min="1" max="52"
                  value={form.successionIntervalWeeks}
                  onChange={e => set('successionIntervalWeeks', e.target.value)}
                  placeholder="e.g. 3" />
                <p className="form-hint">Generates reminders on dashboard</p>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{isNew ? 'Add crop' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Harvest modal ─────────────────────────────────────────────────────────────

function HarvestModal({ assignment, onConfirm, onClose }) {
  const crop = getCropById(assignment.cropId);
  const [rating, setRating] = useState(assignment.yieldRating || 0);
  const [notes, setNotes]   = useState(assignment.yieldNotes || '');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Harvest {crop?.name}</span>
          <button className="btn btn-ghost modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Yield rating</label>
            <div className="star-row">
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button" className={`star-btn${rating >= n ? ' active' : ''}`}
                  onClick={() => setRating(n)}>★</button>
              ))}
              {rating > 0 && (
                <button type="button" className="btn btn-ghost btn-sm text-muted"
                  onClick={() => setRating(0)}>clear</button>
              )}
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Notes (optional)</label>
            <textarea className="form-control" rows={3} value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="How did it do? Any variety notes, pest issues, etc." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary"
            onClick={() => onConfirm({ yieldRating: rating || null, yieldNotes: notes })}>
            Mark as harvested
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Assignment row ────────────────────────────────────────────────────────────

function AssignmentRow({ assignment, bed, onEdit, onHarvest, onDelete }) {
  const crop = getCropById(assignment.cropId);
  if (!crop) return null;

  const col = getFamilyColor(crop.family);
  const daysOld = assignment.sowDate ? daysBetween(assignment.sowDate, TODAY) : null;
  const daysToHarvest = assignment.expectedHarvestDate
    ? daysBetween(TODAY, assignment.expectedHarvestDate) : null;

  const statusColors = {
    planned:    { bg: 'var(--gray-100)',    text: 'var(--gray-600)'    },
    sown:       { bg: 'var(--blue-bg)',     text: 'var(--blue)'        },
    germinated: { bg: 'var(--green-100)',   text: 'var(--green-700)'   },
    growing:    { bg: '#d1fae5',            text: '#065f46'            },
    harvested:  { bg: '#f0fdf4',            text: 'var(--green-800)'   },
  };
  const sc = statusColors[assignment.status] || statusColors.planned;

  return (
    <tr className="assignment-row">
      <td>
        <div className="flex items-center gap-2">
          <div style={{ width: 4, height: 32, borderRadius: 9, background: col, flexShrink: 0 }} />
          <div>
            <Link to={`/crops/${crop.id}`} className="font-semibold text-sm">{crop.name}</Link>
            {assignment.variety && (
              <div className="text-xs text-muted">{assignment.variety}</div>
            )}
          </div>
        </div>
      </td>
      <td className="text-sm text-muted">{bed?.name || '—'}</td>
      <td className="text-sm">
        {assignment.sowDate ? (
          <>
            {formatDate(assignment.sowDate)}
            {daysOld != null && daysOld >= 0 && (
              <div className="text-xs text-muted">{daysOld}d ago</div>
            )}
          </>
        ) : '—'}
      </td>
      <td className="text-sm text-muted">
        {assignment.expectedHarvestDate ? (
          <>
            {formatDate(assignment.expectedHarvestDate)}
            {daysToHarvest != null && (
              <div className={`text-xs${daysToHarvest < 0 ? ' text-danger' : ' text-muted'}`}>
                {daysToHarvest < 0
                  ? `${Math.abs(daysToHarvest)}d overdue`
                  : `in ${daysToHarvest}d`}
              </div>
            )}
          </>
        ) : '—'}
      </td>
      <td>
        <span className="badge" style={{ background: sc.bg, color: sc.text }}>
          {assignment.status}
        </span>
      </td>
      <td>
        <div className="flex gap-1">
          <button className="btn btn-ghost btn-sm" onClick={() => onEdit(assignment)}>Edit</button>
          {assignment.status !== 'harvested' && (
            <button className="btn btn-ghost btn-sm text-success"
              onClick={() => onHarvest(assignment)}>Harvest</button>
          )}
          <button className="btn btn-ghost btn-sm text-danger"
            onClick={() => onDelete(assignment)}>✕</button>
        </div>
      </td>
    </tr>
  );
}

// ── Year calendar strip ────────────────────────────────────────────────────────

function YearCalendarStrip({ assignments, beds }) {
  // Show sow + harvest bars across 12 months for each active assignment
  const rows = assignments
    .filter(a => a.status !== 'harvested' && a.sowDate)
    .map(a => {
      const crop = getCropById(a.cropId);
      const bed  = beds.find(b => b.id === a.bedId);
      const sowMonth = new Date(a.sowDate + 'T12:00:00').getMonth() + 1;
      const harvestMonth = a.expectedHarvestDate
        ? new Date(a.expectedHarvestDate + 'T12:00:00').getMonth() + 1 : null;
      return { a, crop, bed, sowMonth, harvestMonth };
    });

  if (rows.length === 0) return null;

  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <div className="card-header">
        <span className="card-title">Season overview</span>
        <span className="text-xs text-muted">{CURRENT_YEAR}</span>
      </div>
      <div className="card-body" style={{ overflowX: 'auto', padding: '0.5rem 0.75rem' }}>
        <table className="cal-strip-table">
          <thead>
            <tr>
              <th className="cal-strip-label">Crop / Bed</th>
              {MONTH_LABELS.map(m => (
                <th key={m} className="cal-strip-month">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ a, crop, bed, sowMonth, harvestMonth }) => {
              if (!crop) return null;
              const col = getFamilyColor(crop.family);
              return (
                <tr key={a.id}>
                  <td className="cal-strip-label">
                    <div className="text-sm font-semibold">{crop.name}</div>
                    {bed && <div className="text-xs text-muted">{bed.name}</div>}
                  </td>
                  {MONTH_LABELS.map((_, mi) => {
                    const m = mi + 1;
                    const isSow = m === sowMonth;
                    const isGrowth = harvestMonth != null && (
                      sowMonth <= harvestMonth
                        ? m > sowMonth && m < harvestMonth
                        : m > sowMonth || m < harvestMonth
                    );
                    const isHarvest = harvestMonth != null && m === harvestMonth;
                    let bg = 'transparent';
                    let content = '';
                    if (isSow) { bg = col + 'cc'; content = '↓'; }
                    else if (isHarvest) { bg = col + 'cc'; content = '✓'; }
                    else if (isGrowth) { bg = col + '44'; }
                    return (
                      <td key={m} className="cal-strip-cell"
                        style={{ background: bg, color: isSow || isHarvest ? '#fff' : 'transparent' }}>
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="card-footer">
        <p className="text-xs text-muted">↓ sow date &nbsp;·&nbsp; shaded = in ground &nbsp;·&nbsp; ✓ expected harvest</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Calendar() {
  const { dispatch } = useApp();
  const beds        = useBeds();
  const assignments = useAssignments();
  const history     = useHistory();

  const [modal,  setModal]  = useState(null); // null | { type, assignment? }
  const [filter, setFilter] = useState({ status: 'active', bedId: '', search: '' });

  // Beds for dropdown — active beds only
  const activeBeds = useMemo(() => beds.filter(b => b.active), [beds]);

  // Filtered assignments
  const filtered = useMemo(() => {
    return assignments
      .filter(a => {
        if (filter.status === 'active' && a.status === 'harvested') return false;
        if (filter.status === 'harvested' && a.status !== 'harvested') return false;
        if (filter.bedId && a.bedId !== filter.bedId) return false;
        if (filter.search) {
          const crop = getCropById(a.cropId);
          const q = filter.search.toLowerCase();
          if (!crop?.name.toLowerCase().includes(q) && !a.variety?.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.sowDate || '').localeCompare(b.sowDate || ''));
  }, [assignments, filter]);

  function handleSave(form) {
    if (modal.type === 'add') {
      dispatch({ type: 'ADD_ASSIGNMENT', payload: form });
    } else {
      dispatch({ type: 'UPDATE_ASSIGNMENT', payload: { id: modal.assignment.id, ...form } });
    }
    setModal(null);
  }

  function handleHarvestConfirm({ yieldRating, yieldNotes }) {
    dispatch({
      type: 'HARVEST_ASSIGNMENT',
      payload: { id: modal.assignment.id, yieldRating, yieldNotes },
    });
    setModal(null);
  }

  function handleDelete(assignment) {
    if (window.confirm(`Remove ${getCropById(assignment.cropId)?.name || 'this crop'} from the plan?`)) {
      dispatch({ type: 'DELETE_ASSIGNMENT', payload: { id: assignment.id } });
    }
  }

  const activeCount    = assignments.filter(a => a.status !== 'harvested').length;
  const harvestedCount = assignments.filter(a => a.status === 'harvested').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Planting Calendar</h1>
          <p className="page-subtitle">
            {activeCount} active · {harvestedCount} harvested
          </p>
        </div>
        <button className="btn btn-primary btn-sm"
          onClick={() => {
            if (activeBeds.length === 0) {
              alert('Add at least one bed first (Plot Layout page).');
              return;
            }
            setModal({ type: 'add' });
          }}>
          + Add Crop
        </button>
      </div>

      {/* Year strip */}
      <YearCalendarStrip
        assignments={assignments.filter(a => a.status !== 'harvested')}
        beds={beds} />

      {/* Filters */}
      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="card-header">
          <span className="card-title">Crop assignments</span>
        </div>
        <div className="card-body" style={{ paddingBottom: '0.5rem' }}>
          <div className="cal-filters">
            <input className="form-control" placeholder="Search crop or variety…"
              value={filter.search}
              onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
              style={{ maxWidth: 240 }} />

            <select className="form-control" value={filter.bedId}
              onChange={e => setFilter(f => ({ ...f, bedId: e.target.value }))}
              style={{ maxWidth: 180 }}>
              <option value="">All beds</option>
              {beds.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>

            <div className="view-toggle">
              {[
                { val: 'active',    label: `Active (${activeCount})`    },
                { val: 'harvested', label: `Harvested (${harvestedCount})` },
                { val: 'all',       label: 'All'                        },
              ].map(opt => (
                <button key={opt.val}
                  className={`btn btn-sm ${filter.status === opt.val ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFilter(f => ({ ...f, status: opt.val }))}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {assignments.length === 0 ? (
          <div className="empty-state" style={{ padding: '2.5rem 1.5rem' }}>
            <div className="empty-state-icon">📅</div>
            <div className="empty-state-title">No crops planned yet</div>
            <div className="empty-state-text">
              {activeBeds.length === 0
                ? <><Link to="/plot">Add your beds</Link> first, then plan your crops here.</>
                : 'Click "+ Add Crop" to assign your first crop to a bed.'}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: '1.5rem' }}>
            <div className="empty-state-text">No crops match these filters.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="assignment-table">
              <thead>
                <tr>
                  <th>Crop</th>
                  <th>Bed</th>
                  <th>Sow date</th>
                  <th>Est. harvest</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <AssignmentRow key={a.id}
                    assignment={a}
                    bed={beds.find(b => b.id === a.bedId)}
                    onEdit={a => setModal({ type: 'edit', assignment: a })}
                    onHarvest={a => setModal({ type: 'harvest', assignment: a })}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {modal?.type === 'add' && (
        <AssignmentModal
          onSave={handleSave}
          onClose={() => setModal(null)}
          beds={activeBeds}
          history={history} />
      )}
      {modal?.type === 'edit' && (
        <AssignmentModal
          assignment={modal.assignment}
          onSave={handleSave}
          onClose={() => setModal(null)}
          beds={activeBeds}
          history={history} />
      )}
      {modal?.type === 'harvest' && (
        <HarvestModal
          assignment={modal.assignment}
          onConfirm={handleHarvestConfirm}
          onClose={() => setModal(null)} />
      )}
    </div>
  );
}
