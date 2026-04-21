import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp, useBeds } from '../store/AppContext';
import { CROPS, getCropById, getFamilyColor } from '../data/crops';

// ── constants ──────────────────────────────────────────────────────────────────

const CURRENT_YEAR  = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const MONTH_W       = 72;
const LABEL_W       = 150;
const ROW_H         = 64;

// ── date helpers ───────────────────────────────────────────────────────────────

function addWeeks(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n * 7);
  return d.toISOString().split('T')[0];
}

function getNextSowDate(crop) {
  if (!crop.sowWindowStart) return null;
  if (CURRENT_MONTH >= crop.sowWindowStart && CURRENT_MONTH <= crop.sowWindowEnd)
    return `${CURRENT_YEAR}-${String(CURRENT_MONTH).padStart(2, '0')}-01`;
  if (CURRENT_MONTH < crop.sowWindowStart)
    return `${CURRENT_YEAR}-${String(crop.sowWindowStart).padStart(2, '0')}-01`;
  return `${CURRENT_YEAR + 1}-${String(crop.sowWindowStart).padStart(2, '0')}-01`;
}

// ── plan generation ───────────────────────────────────────────────────────────

function generatePlan(cropIds, beds) {
  const activeBeds = beds.filter(b => b.active);
  const items = [];

  cropIds.forEach((cropId, idx) => {
    const crop = getCropById(cropId);
    if (!crop || crop.perennial) return;

    const bed     = activeBeds.length ? activeBeds[idx % activeBeds.length] : null;
    const sowDate = getNextSowDate(crop);
    if (!sowDate) return;

    const isIndoor = crop.propagation === 'cold_frame' ||
      (crop.propagation === 'both' && crop.weeksInColdFrame);

    if (isIndoor && crop.weeksInColdFrame) {
      items.push({
        cropId, type: 'start_indoors', date: sowDate, bed: null,
        label: `Start ${crop.name} indoors`,
        detail: crop.coldFrameNotes?.split('.')[0] || 'Sow in pots or modules indoors.',
      });
      const plantDate = addWeeks(sowDate, crop.weeksInColdFrame);
      items.push({
        cropId, type: 'plant_out', date: plantDate, bed,
        label: `Plant out ${crop.name}`,
        detail: `Move to ${bed?.name || 'a bed'} once established.`,
      });
    } else {
      items.push({
        cropId, type: 'sow_direct', date: sowDate, bed,
        label: crop.flower ? `Plant ${crop.name}` : `Sow ${crop.name}`,
        detail: crop.propagationNotes?.split('.')[0] || '',
      });
    }

    if (crop.harvestWindowStart) {
      const sowYear  = parseInt(sowDate.split('-')[0]);
      const sowMonth = parseInt(sowDate.split('-')[1]);
      const h        = crop.harvestWindowStart;
      const harvestYear = h >= sowMonth ? sowYear : sowYear + 1;
      const harvestDate = `${harvestYear}-${String(h).padStart(2, '0')}-01`;
      items.push({
        cropId,
        type: crop.flower ? 'flowers' : 'harvest',
        date: harvestDate,
        bed,
        label: crop.flower ? `${crop.name} in flower` : `Harvest ${crop.name}`,
        detail: bed ? `From ${bed.name}.` : '',
      });
    }
  });

  return items.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Crop picker ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'all',    label: 'All'     },
  { key: 'veg',    label: 'Veg'     },
  { key: 'fruit',  label: 'Fruit'   },
  { key: 'flower', label: 'Flowers' },
];

function cropCategory(crop) {
  if (crop.flower) return 'flower';
  if (crop.perennial && crop.bush) return 'fruit';
  return 'veg';
}

function CropPicker({ selected, onToggle }) {
  const [cat, setCat]       = useState('veg');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => CROPS.filter(c => {
    if (cat !== 'all' && cropCategory(c) !== cat) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [cat, search]);

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="form-control"
          style={{ flex: '1 1 140px', minWidth: 0 }}
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
          {CATEGORIES.map(c => (
            <button key={c.key}
              className={`btn btn-sm ${cat === c.key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setCat(c.key)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem' }}>
        {filtered.map(crop => {
          const sel = selected.includes(crop.id);
          const col = getFamilyColor(crop.family);
          return (
            <button key={crop.id} onClick={() => onToggle(crop.id)} style={{
              border: `2px solid ${sel ? col : '#e5e7eb'}`,
              borderRadius: '8px', padding: '0.625rem 0.5rem',
              background: sel ? col + '15' : '#fff',
              cursor: 'pointer', textAlign: 'left',
              position: 'relative', transition: 'all 100ms',
            }}>
              {sel && (
                <span style={{ position: 'absolute', top: '4px', right: '6px', fontSize: '0.65rem', color: col, fontWeight: 700 }}>✓</span>
              )}
              <div style={{ fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.2, color: '#111827' }}>{crop.name}</div>
              <div style={{ fontSize: '0.62rem', marginTop: '3px', background: col + '20', color: col, borderRadius: '9999px', padding: '1px 6px', display: 'inline-block' }}>
                {crop.familyCommon}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Gantt helpers ─────────────────────────────────────────────────────────────

const TYPE_ICONS = {
  start_indoors: '🏡',
  plant_out:     '🌿',
  sow_direct:    '🌱',
  harvest:       '🧺',
  flowers:       '🌸',
};

// Linear scale: higher = further along
const PROGRESS_ORDER = {
  planned: 0, sowing_indoor: 1, germinated_indoor: 2,
  sown: 3, germinated: 4, growing: 5, harvested: 6,
};
// Minimum progress level for a task marker to show as "done"
const TASK_THRESHOLD = {
  start_indoors: 1, sow_direct: 3, plant_out: 3, harvest: 6, flowers: 6,
};

function isTaskDone(type, progress) {
  if (!progress || progress === 'failed') return false;
  return (PROGRESS_ORDER[progress] ?? 0) >= (TASK_THRESHOLD[type] ?? 99);
}

const PROGRESS_LABELS = {
  planned:           'Planned',
  sowing_indoor:     'Sowing indoors',
  germinated_indoor: 'Germinated indoors',
  sown:              'Sown',
  germinated:        'Germinated',
  growing:           'Growing',
  harvested:         'Harvested ✓',
  failed:            "Didn't germinate",
};

const PROGRESS_COLORS = {
  planned: '#9ca3af', sowing_indoor: '#3b82f6', germinated_indoor: '#84cc16',
  sown: '#3b82f6', germinated: '#84cc16', growing: '#16a34a',
  harvested: '#15803d', failed: '#ef4444',
};

// Growing-bar fill opacity based on progress
const BAR_FILL = {
  planned: '18', sowing_indoor: '18', germinated_indoor: '20',
  sown: '30', germinated: '45', growing: '60', harvested: '80',
};

function generateMonths(minDate, maxDate) {
  let [y, m] = minDate.split('-').map(Number);
  const [ey, em] = maxDate.split('-').map(Number);
  m--; if (m < 1) { m = 12; y--; }
  const endY = em < 12 ? ey : ey + 1;
  const endM = em < 12 ? em + 1 : 1;
  const nowY = new Date().getFullYear();
  const nowM = new Date().getMonth() + 1;
  const months = [];
  while (y < endY || (y === endY && m <= endM)) {
    const d = new Date(y, m - 1, 1);
    months.push({
      key: `${y}-${String(m).padStart(2, '0')}`,
      year: y, month: m,
      label: d.toLocaleDateString('en-GB', { month: 'short' }),
      showYear: m === 1 || months.length === 0,
      isCurrent: y === nowY && m === nowM,
    });
    m++; if (m > 12) { m = 1; y++; }
  }
  return months;
}

// ── Row builders ──────────────────────────────────────────────────────────────

function buildReviewRows(plan, assignments, coldFrameEntries) {
  const cropIds = [...new Set(plan.map(i => i.cropId))];
  return cropIds.map(cropId => {
    const crop      = getCropById(cropId);
    const color     = crop ? getFamilyColor(crop.family) : '#6b7280';
    const cropItems = plan.filter(i => i.cropId === cropId);
    const indoor    = cropItems.find(i => i.type === 'start_indoors');
    const plantOut  = cropItems.find(i => i.type === 'plant_out');
    const sowDirect = cropItems.find(i => i.type === 'sow_direct');
    const harvest   = cropItems.find(i => i.type === 'harvest' || i.type === 'flowers');
    const bed       = (plantOut || sowDirect)?.bed;

    const liveA = assignments.find(a => a.cropId === cropId && a.status !== 'harvested')
               || assignments.find(a => a.cropId === cropId);
    const liveF = coldFrameEntries.find(e => e.cropId === cropId);
    let progress = null;
    if (liveA?.status === 'harvested')          progress = 'harvested';
    else if (liveA)                             progress = liveA.status;
    else if (liveF?.stage === 'failed_to_germinate') progress = 'failed';
    else if (liveF?.stage === 'germinated')     progress = 'germinated_indoor';
    else if (liveF)                             progress = 'sowing_indoor';

    return {
      rowId: cropId, cropId, color,
      label:      crop?.name || cropId,
      sublabel:   bed?.name  || null,
      progress,
      indoorDate: indoor?.date    || null,
      plantDate:  plantOut?.date  || null,
      growStart:  (plantOut || sowDirect)?.date || null,
      growEnd:    harvest?.date   || null,
      markers:    cropItems.map(i => ({ type: i.type, date: i.date, label: i.label })),
    };
  });
}

function buildLiveRows(assignments, coldFrameEntries, beds) {
  const rows   = [];
  const active = assignments.filter(a => a.status !== 'harvested');

  active.forEach(a => {
    if (!a.sowDate) return;
    const crop  = getCropById(a.cropId);
    const color = crop ? getFamilyColor(crop.family) : '#6b7280';
    const bed   = beds.find(b => b.id === a.bedId);
    const markers = [];
    let indoorDate = null, plantDate = null, growStart = null, growEnd = null;

    if (a.transplantDate) {
      indoorDate = a.sowDate; plantDate = a.transplantDate; growStart = a.transplantDate;
      markers.push({ type: 'start_indoors', date: a.sowDate,        label: `Start ${crop?.name || ''} indoors` });
      markers.push({ type: 'plant_out',     date: a.transplantDate, label: `Plant out ${crop?.name || ''}` });
    } else {
      growStart = a.sowDate;
      markers.push({ type: 'sow_direct', date: a.sowDate, label: `Sow ${crop?.name || ''}` });
    }
    if (a.expectedHarvestDate) {
      growEnd = a.expectedHarvestDate;
      markers.push({ type: crop?.flower ? 'flowers' : 'harvest', date: a.expectedHarvestDate, label: `Harvest ${crop?.name || ''}` });
    }

    rows.push({
      rowId: a.id, cropId: a.cropId, color,
      label:      crop?.name || a.cropId,
      sublabel:   bed?.name  || null,
      progress:   a.status,
      indoorDate, plantDate, growStart, growEnd, markers,
    });
  });

  // Cold-frame entries with no corresponding outdoor assignment
  coldFrameEntries
    .filter(e => e.sowDate && e.stage !== 'failed_to_germinate')
    .filter(e => !active.some(a => a.cropId === e.cropId))
    .forEach(e => {
      const crop  = getCropById(e.cropId);
      const color = crop ? getFamilyColor(crop.family) : '#6b7280';
      rows.push({
        rowId:      `cf-${e.id}`,
        cropId:     e.cropId,
        color,
        label:      crop?.name || e.cropId,
        sublabel:   'Indoors',
        progress:   e.stage === 'germinated' ? 'germinated_indoor' : 'sowing_indoor',
        indoorDate: e.sowDate, plantDate: null, growStart: null, growEnd: null,
        markers:    [{ type: 'start_indoors', date: e.sowDate, label: `${crop?.name || ''} started indoors` }],
      });
    });

  return rows;
}

// ── GanttChart ────────────────────────────────────────────────────────────────

function GanttChart({ rows, months, onRowClick }) {
  const nowY = new Date().getFullYear();
  const nowM = new Date().getMonth() + 1;

  function dateToX(dateStr) {
    if (!dateStr) return -1;
    const [y, m] = dateStr.split('-').map(Number);
    const idx = months.findIndex(mo => mo.year === y && mo.month === m);
    return idx >= 0 ? idx * MONTH_W + MONTH_W / 2 : -1;
  }

  const todayIdx = months.findIndex(m => m.year === nowY && m.month === nowM);
  const todayX   = todayIdx >= 0 ? todayIdx * MONTH_W + MONTH_W / 2 : -1;
  const totalW   = months.length * MONTH_W;

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ minWidth: LABEL_W + totalW }}>

        {/* Month header */}
        <div style={{
          display: 'flex', borderBottom: '2px solid var(--gray-100)',
          position: 'sticky', top: 0, background: '#fff', zIndex: 5,
        }}>
          <div style={{
            width: LABEL_W, flexShrink: 0,
            position: 'sticky', left: 0, zIndex: 6, background: '#fff',
            borderRight: '1px solid var(--gray-100)',
            padding: '0.4rem 0.75rem',
            fontSize: '0.65rem', color: 'var(--gray-400)', fontWeight: 600,
            display: 'flex', alignItems: 'flex-end',
          }}>
            Crop
          </div>
          <div style={{ display: 'flex', flex: 1 }}>
            {months.map((mo, i) => (
              <div key={mo.key} style={{
                width: MONTH_W, flexShrink: 0, textAlign: 'center',
                padding: '0.2rem 0 0.3rem',
                borderLeft: i > 0 ? '1px solid var(--gray-100)' : 'none',
                background: mo.isCurrent ? '#f0fdf4' : 'transparent',
              }}>
                {mo.showYear && (
                  <div style={{ fontSize: '0.5rem', color: 'var(--gray-300)', lineHeight: 1.2 }}>{mo.year}</div>
                )}
                <div style={{ fontSize: '0.65rem', fontWeight: mo.isCurrent ? 700 : 400, color: mo.isCurrent ? '#16a34a' : 'var(--gray-400)' }}>
                  {mo.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        {rows.map((row, ri) => {
          const col = row.color;
          return (
            <div key={row.rowId}
              onClick={() => onRowClick?.(row)}
              style={{
                display: 'flex', height: ROW_H,
                borderBottom: ri < rows.length - 1 ? '1px solid var(--gray-100)' : 'none',
                cursor: onRowClick ? 'pointer' : 'default',
              }}>

              {/* Label */}
              <div style={{
                width: LABEL_W, flexShrink: 0,
                position: 'sticky', left: 0, zIndex: 2, background: '#fff',
                borderRight: '1px solid var(--gray-100)',
                display: 'flex', alignItems: 'center', padding: '0.35rem 0.75rem',
              }}>
                <div style={{ minWidth: 0, width: '100%' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.8rem', color: col, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.label}
                  </div>
                  {row.sublabel && (
                    <div style={{ fontSize: '0.6rem', color: 'var(--gray-400)', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.sublabel}
                    </div>
                  )}
                  {row.progress && (
                    <div style={{ fontSize: '0.58rem', marginTop: '1px', fontWeight: 600, color: PROGRESS_COLORS[row.progress] || '#6b7280' }}>
                      {PROGRESS_LABELS[row.progress] || ''}
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div style={{ position: 'relative', flex: 1, height: ROW_H }}>

                {/* Column tints + grid lines */}
                {months.map((mo, i) => (
                  <React.Fragment key={mo.key}>
                    {mo.isCurrent && (
                      <div style={{ position: 'absolute', left: i * MONTH_W, top: 0, bottom: 0, width: MONTH_W, background: '#f0fdf4' }} />
                    )}
                    {i > 0 && (
                      <div style={{ position: 'absolute', left: i * MONTH_W, top: 0, bottom: 0, width: 1, background: 'var(--gray-100)' }} />
                    )}
                  </React.Fragment>
                ))}

                {/* Today line */}
                {todayX >= 0 && (
                  <div style={{ position: 'absolute', left: todayX, top: 6, bottom: 6, width: 2, background: '#16a34a', borderRadius: 1, opacity: 0.45, zIndex: 1 }} />
                )}

                {/* Indoor / propagation bar (dashed) */}
                {row.indoorDate && row.plantDate && (() => {
                  const x1 = dateToX(row.indoorDate);
                  const x2 = dateToX(row.plantDate);
                  if (x1 < 0 || x2 < 0 || x2 <= x1) return null;
                  const H = 6, Y = ROW_H / 2 - H / 2 - 2;
                  return (
                    <div style={{
                      position: 'absolute', left: x1, top: Y,
                      width: x2 - x1, height: H, zIndex: 1, borderRadius: 3,
                      backgroundImage: `repeating-linear-gradient(90deg,${col}55 0,${col}55 5px,transparent 5px,transparent 10px)`,
                      border: `1px solid ${col}44`, boxSizing: 'border-box',
                    }} />
                  );
                })()}

                {/* Growing bar (solid) */}
                {row.growStart && row.growEnd && (() => {
                  const x1 = dateToX(row.growStart);
                  const x2 = dateToX(row.growEnd);
                  if (x1 < 0 || x2 < 0 || x2 <= x1) return null;
                  const H = 10, Y = ROW_H / 2 - H / 2;
                  const fill   = BAR_FILL[row.progress] || '18';
                  const border = row.progress === 'harvested' ? 'bb' : '55';
                  return (
                    <div style={{
                      position: 'absolute', left: x1, top: Y,
                      width: x2 - x1, height: H, zIndex: 1,
                      borderRadius: 5,
                      background: `${col}${fill}`,
                      border: `1.5px solid ${col}${border}`,
                      boxSizing: 'border-box',
                    }} />
                  );
                })()}

                {/* Task markers */}
                {row.markers.map((mk, mki) => {
                  const x    = dateToX(mk.date);
                  if (x < 0) return null;
                  const done = isTaskDone(mk.type, row.progress);
                  const R    = 11;
                  return (
                    <div key={mki} title={mk.label} style={{
                      position: 'absolute',
                      left: x - R, top: ROW_H / 2 - R,
                      width: R * 2, height: R * 2, zIndex: 3,
                      borderRadius: '50%',
                      background: done ? col : '#fff',
                      border: `2px solid ${col}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: done ? '0.6rem' : '0.72rem',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                      cursor: onRowClick ? 'pointer' : 'default', userSelect: 'none',
                    }}>
                      {done ? '✓' : TYPE_ICONS[mk.type]}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Assignment Drawer ─────────────────────────────────────────────────────────

const STATUS_FLOW = ['planned', 'sown', 'germinated', 'growing', 'harvested'];

const CF_STAGES = [
  { key: 'just_sown',       label: 'Just sown'       },
  { key: 'germinated',      label: 'Germinated'       },
  { key: 'growing_on',      label: 'Growing on'       },
  { key: 'ready_to_harden', label: 'Ready to harden'  },
  { key: 'hardening_off',   label: 'Hardening off'    },
];

function AssignmentDrawer({ row, assignments, coldFrameEntries, beds, dispatch, onClose }) {
  const crop  = getCropById(row.cropId);
  const color = row.color;

  const isCf       = String(row.rowId).startsWith('cf-');
  const assignment = isCf ? null : assignments.find(a => a.id === row.rowId);
  const cfEntry    = isCf ? coldFrameEntries.find(e => e.id === row.rowId.slice(3)) : null;

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 40,
        background: 'rgba(0,0,0,0.28)',
      }} />

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: '#fff', borderRadius: '16px 16px 0 0',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.18)',
        padding: '0.75rem 1.25rem 2.5rem',
        maxHeight: '75vh', overflowY: 'auto',
      }}>
        <div style={{ width: 40, height: 4, background: '#e5e7eb', borderRadius: 2, margin: '0 auto 1rem' }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#111827' }}>{row.label}</span>
              {crop && (
                <span style={{ fontSize: '0.65rem', background: color + '20', color, borderRadius: 9999, padding: '1px 8px', fontWeight: 600 }}>
                  {crop.familyCommon}
                </span>
              )}
            </div>
            {row.sublabel && (
              <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{row.sublabel}</div>
            )}
          </div>
          <button onClick={onClose} style={{
            border: 'none', background: '#f3f4f6', borderRadius: '50%',
            width: 32, height: 32, cursor: 'pointer', fontSize: '1.1rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#6b7280', flexShrink: 0,
          }}>×</button>
        </div>

        {/* Outdoor assignment */}
        {assignment && (
          <>
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Status
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {STATUS_FLOW.map(s => {
                  const active = assignment.status === s;
                  const col    = PROGRESS_COLORS[s] || '#9ca3af';
                  return (
                    <button key={s}
                      onClick={() => dispatch({ type: 'UPDATE_ASSIGNMENT', payload: { id: assignment.id, status: s } })}
                      style={{
                        padding: '0.3rem 0.75rem', borderRadius: 20,
                        border: `1.5px solid ${active ? col : '#e5e7eb'}`,
                        background: active ? col + '25' : '#fff',
                        color: active ? col : '#6b7280',
                        fontWeight: active ? 700 : 400,
                        fontSize: '0.78rem', cursor: 'pointer',
                        transition: 'all 100ms',
                      }}>
                      {PROGRESS_LABELS[s] || s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Bed
              </div>
              <select
                className="form-control"
                value={assignment.bedId || ''}
                onChange={e => dispatch({ type: 'UPDATE_ASSIGNMENT', payload: { id: assignment.id, bedId: e.target.value } })}
                style={{ fontSize: '0.85rem' }}
              >
                <option value="">No bed assigned</option>
                {beds.filter(b => b.active).map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {(assignment.sowDate || assignment.expectedHarvestDate) && (
              <div style={{ fontSize: '0.78rem', color: '#9ca3af', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                {assignment.sowDate && (
                  <span>🌱 Sow: <strong style={{ color: '#374151' }}>{assignment.sowDate}</strong></span>
                )}
                {assignment.expectedHarvestDate && (
                  <span>🧺 Harvest: <strong style={{ color: '#374151' }}>{assignment.expectedHarvestDate}</strong></span>
                )}
              </div>
            )}
          </>
        )}

        {/* Cold-frame entry */}
        {cfEntry && (
          <>
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Stage
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {CF_STAGES.map(s => {
                  const active = cfEntry.stage === s.key;
                  const col    = '#3b82f6';
                  return (
                    <button key={s.key}
                      onClick={() => dispatch({ type: 'UPDATE_COLD_FRAME_ENTRY', payload: { id: cfEntry.id, stage: s.key } })}
                      style={{
                        padding: '0.3rem 0.75rem', borderRadius: 20,
                        border: `1.5px solid ${active ? col : '#e5e7eb'}`,
                        background: active ? col + '20' : '#fff',
                        color: active ? col : '#6b7280',
                        fontWeight: active ? 700 : 400,
                        fontSize: '0.78rem', cursor: 'pointer',
                        transition: 'all 100ms',
                      }}>
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {cfEntry.sowDate && (
              <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                🏡 Started indoors: <strong style={{ color: '#374151' }}>{cfEntry.sowDate}</strong>
              </div>
            )}
          </>
        )}

        {!assignment && !cfEntry && (
          <p className="text-sm text-muted" style={{ margin: 0 }}>No details available.</p>
        )}
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Plan() {
  const { state, dispatch } = useApp();
  const beds                = useBeds();
  const { assignments, coldFrameEntries } = state;

  const planDraft = state.planDraft || { phase: null, selected: [] };

  const hasLiveData = useMemo(
    () => assignments.some(a => a.status !== 'harvested') || coldFrameEntries.length > 0,
    [assignments, coldFrameEntries]
  );

  const [phase, setPhase] = useState(() => {
    const saved = planDraft.phase;
    if (!saved) return hasLiveData ? 'live' : 'pick';
    if (saved === 'review' && (!planDraft.selected || planDraft.selected.length === 0)) return 'pick';
    return saved;
  });
  const [selected, setSelected] = useState(() => planDraft.selected || []);
  const [selectedRow, setSelectedRow] = useState(null);

  useEffect(() => {
    dispatch({ type: 'UPDATE_PLAN_DRAFT', payload: { phase, selected } });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selected]);

  const plan = useMemo(
    () => phase === 'review' ? generatePlan(selected, beds) : [],
    [phase, selected, beds]
  );

  const liveRows = useMemo(
    () => buildLiveRows(assignments.filter(a => a.status !== 'harvested'), coldFrameEntries, beds),
    [assignments, coldFrameEntries, beds]
  );

  const reviewRows = useMemo(
    () => phase === 'review' ? buildReviewRows(plan, assignments, coldFrameEntries) : [],
    [phase, plan, assignments, coldFrameEntries]
  );

  const months = useMemo(() => {
    if (phase === 'live') {
      const dates = liveRows.flatMap(r => r.markers.map(m => m.date)).filter(Boolean).sort();
      return dates.length ? generateMonths(dates[0], dates[dates.length - 1]) : [];
    }
    if (phase === 'review' && plan.length) {
      const dates = plan.map(i => i.date).sort();
      return generateMonths(dates[0], dates[dates.length - 1]);
    }
    return [];
  }, [phase, liveRows, plan]);

  function toggleCrop(cropId) {
    setSelected(s => s.includes(cropId) ? s.filter(id => id !== cropId) : [...s, cropId]);
  }

  const noBeds = beds.filter(b => b.active).length === 0;

  function handleAccept() {
    if (noBeds) return;
    plan.forEach(item => {
      if (item.type === 'start_indoors') {
        dispatch({ type: 'ADD_COLD_FRAME_ENTRY', payload: {
          cropId: item.cropId, sowDate: item.date, stage: 'just_sown', notes: '',
        }});
      }
      if (item.type === 'plant_out' || item.type === 'sow_direct') {
        const harvestItem = plan.find(p => p.cropId === item.cropId &&
          (p.type === 'harvest' || p.type === 'flowers'));
        dispatch({ type: 'ADD_ASSIGNMENT', payload: {
          bedId:               item.bed?.id || '',
          cropId:              item.cropId,
          variety:             '',
          sowDate:             item.date,
          transplantDate:      item.type === 'plant_out' ? item.date : null,
          expectedHarvestDate: harvestItem?.date || null,
          status:              'planned',
          season:              CURRENT_YEAR,
        }});
      }
    });
    setSelected([]);
    setPhase('live');
  }

  const activeCount = assignments.filter(a => a.status !== 'harvested').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {phase === 'live' ? 'My plan' : phase === 'pick' ? 'Plan your season' : 'Preview plan'}
          </h1>
          <p className="page-subtitle">
            {phase === 'live'
              ? `${liveRows.length} crop${liveRows.length !== 1 ? 's' : ''} tracked`
              : phase === 'pick'
                ? 'Pick what you want to grow'
                : `${selected.length} crop${selected.length !== 1 ? 's' : ''} · ${plan.length} tasks`}
          </p>
        </div>
        {phase === 'live' && (
          <button className="btn btn-primary btn-sm" onClick={() => setPhase('pick')}>+ Add crops</button>
        )}
      </div>

      {/* ── Pick phase ── */}
      {phase === 'pick' && (
        <>
          {hasLiveData && (
            <button className="btn btn-secondary btn-sm" style={{ marginBottom: '1rem' }}
              onClick={() => setPhase('live')}>
              ← Back to my plan
            </button>
          )}
          <CropPicker selected={selected} onToggle={toggleCrop} />
          {selected.length > 0 && (
            <div style={{
              position: 'sticky', bottom: '4rem', zIndex: 20,
              background: '#fff', borderTop: '1px solid var(--gray-200)',
              padding: '0.75rem 0', marginTop: '1.5rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
            }}>
              <span className="text-sm text-muted">{selected.length} crop{selected.length !== 1 ? 's' : ''} selected</span>
              <button className="btn btn-primary" onClick={() => setPhase('review')}>Generate plan →</button>
            </div>
          )}
        </>
      )}

      {/* ── Review phase ── */}
      {phase === 'review' && (
        <>
          {noBeds && (
            <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
              <span className="alert-icon">⚠️</span>
              <div className="alert-body">
                <div className="alert-title">No beds set up yet</div>
                <div className="alert-text">
                  <Link to="/plot" style={{ color: 'inherit', textDecoration: 'underline' }}>Add beds on the Plot page</Link>{' '}
                  first so the plan can assign crops to specific beds.
                </div>
              </div>
            </div>
          )}
          {months.length > 0 && (
            <div className="card" style={{ overflow: 'hidden', marginBottom: '1rem' }}>
              <GanttChart rows={reviewRows} months={months} />
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', paddingBottom: '5rem' }}>
            <button className="btn btn-secondary" onClick={() => setPhase('pick')}>← Change crops</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAccept} disabled={noBeds}>
              Add to my plan →
            </button>
          </div>
        </>
      )}

      {/* ── Live phase ── */}
      {phase === 'live' && (
        <>
          {liveRows.length > 0 && months.length > 0 ? (
            <>
              <p className="text-sm text-muted" style={{ marginBottom: '0.5rem' }}>
                Tap a row to update status or change bed.
              </p>
              <div className="card" style={{ overflow: 'hidden', marginBottom: '1rem' }}>
                <GanttChart rows={liveRows} months={months} onRowClick={setSelectedRow} />
              </div>
            </>
          ) : (
            <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
              <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌱</p>
              <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No crops in your plan yet</p>
              <p className="text-sm text-muted" style={{ marginBottom: '1rem' }}>Pick crops to generate a season plan.</p>
              <button className="btn btn-primary" onClick={() => setPhase('pick')}>Pick crops to grow</button>
            </div>
          )}
          <div style={{ paddingBottom: '5rem' }} />
        </>
      )}

      {selectedRow && phase === 'live' && (
        <AssignmentDrawer
          row={selectedRow}
          assignments={assignments}
          coldFrameEntries={coldFrameEntries}
          beds={beds}
          dispatch={dispatch}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </div>
  );
}
