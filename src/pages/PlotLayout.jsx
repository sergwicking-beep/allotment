import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useApp, useBeds, useActiveAssignments, useHistory } from '../store/AppContext';
import { CROPS, getCropById, getFamilyColor, getFamilyBgColor, MONTHS } from '../data/crops';

// ── constants ─────────────────────────────────────────────────────────────────
const BED_COLORS = [
  '#52b788','#74c69d','#40916c','#2d6a4f',
  '#95d5b2','#b7e4c7',
  '#74b9ff','#a29bfe','#fd79a8','#fdcb6e','#e17055','#55efc4',
];
function pickColor(idx) { return BED_COLORS[idx % BED_COLORS.length]; }

const GRID_COLS = 24;
const GRID_ROWS = 20;
const CELL_PX   = 56;

const ROTATION_GAP = { Brassica: 3, Potato: 3, Allium: 3, Root: 2, Legume: 2, Cucurbit: 2 };
const TODAY = new Date().toISOString().split('T')[0];
const CURRENT_YEAR = new Date().getFullYear();

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function addWeeks(dateStr, n) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n * 7);
  return d.toISOString().split('T')[0];
}

// Spread new beds across the grid instead of stacking at (1,1)
function defaultBedData(count) {
  const col = ((count % 4) * 3) + 1;
  const row = (Math.floor(count / 4) * 3) + 1;
  return {
    name:        `Bed ${count < 26 ? String.fromCharCode(65 + count) : count + 1}`,
    widthCells:  2,
    lengthCells: 4,
    widthM:      1.2,
    lengthM:     2.4,
    active:      true,
    notes:       '',
    color:       pickColor(count),
    gridX:       clamp(col, 1, GRID_COLS - 1),
    gridY:       clamp(row, 1, GRID_ROWS - 3),
  };
}

// ── BedModal (name / colour / real-world dims / notes) ────────────────────────
function BedModal({ bed, onSave, onClose, bedCount }) {
  const isNew = !bed;
  const [form, setForm] = useState(() => isNew ? defaultBedData(bedCount) : {
    name:        bed.name,
    widthCells:  bed.widthCells  ?? 2,
    lengthCells: bed.lengthCells ?? 4,
    widthM:      bed.widthM      ?? 1.2,
    lengthM:     bed.lengthM     ?? 2.4,
    active:      bed.active      ?? true,
    notes:       bed.notes       ?? '',
    color:       bed.color       ?? pickColor(bedCount),
    gridX:       bed.gridX       ?? 1,
    gridY:       bed.gridY       ?? 1,
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{isNew ? 'Add Bed' : `Edit "${bed.name}"`}</span>
          <button className="btn btn-ghost modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">

            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Bed name *</label>
                <input className="form-control" value={form.name}
                  onChange={e => set('name', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Colour</label>
                <div className="color-swatches">
                  {BED_COLORS.map(c => (
                    <button key={c} type="button"
                      className={`color-swatch${form.color === c ? ' selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => set('color', c)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Width (m)</label>
                <input className="form-control" type="number" min="0.5" max="20" step="0.1"
                  value={form.widthM}
                  onChange={e => set('widthM', parseFloat(e.target.value) || 1.2)} />
              </div>
              <div className="form-group">
                <label className="form-label">Length (m)</label>
                <input className="form-control" type="number" min="0.5" max="50" step="0.1"
                  value={form.lengthM}
                  onChange={e => set('lengthM', parseFloat(e.target.value) || 2.4)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-control" rows={2} value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="e.g. raised bed, south-facing, heavy clay…" />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="flex items-center gap-2" style={{ cursor: 'pointer', fontSize: '0.875rem' }}>
                <input type="checkbox" checked={form.active}
                  onChange={e => set('active', e.target.checked)} />
                Active (visible in planting calendar and rotation tracker)
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{isNew ? 'Add Bed' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── DeleteModal ───────────────────────────────────────────────────────────────
function DeleteModal({ bed, onConfirm, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '380px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Delete "{bed.name}"?</span>
          <button className="btn btn-ghost modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="text-sm" style={{ color: 'var(--gray-600)' }}>
            This removes the bed and all its active crop assignments.
            Harvested history entries are kept for rotation tracking.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Delete bed</button>
        </div>
      </div>
    </div>
  );
}

// ── AssignmentModal ───────────────────────────────────────────────────────────
function AssignmentModal({ assignment, bedId, beds, history, onSave, onHarvest, onClose }) {
  const isNew = !assignment;
  const [form, setForm] = useState(() => isNew ? {
    bedId: bedId || beds[0]?.id || '',
    cropId: CROPS[0].id,
    variety: '',
    sowDate: TODAY,
    transplantDate: '',
    expectedHarvestDate: '',
    status: 'sown',
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
      <div className="modal" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{isNew ? 'Add crop to bed' : 'Edit planting'}</span>
          <button className="btn btn-ghost modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Crop *</label>
              <select className="form-control" value={form.cropId}
                onChange={e => handleCropChange(e.target.value)}>
                {CROPS.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.perennial ? ' (perennial)' : ''}</option>
                ))}
              </select>
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
              for (let y = CURRENT_YEAR - 1; y >= CURRENT_YEAR - gap; y--) {
                const clash = history.find(h =>
                  h.bedId === form.bedId && h.year === y &&
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
                          Recommended gap: {gap} years.
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
                <label className="form-label">Sow / plant date *</label>
                <input className="form-control" type="date" value={form.sowDate}
                  onChange={e => set('sowDate', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Expected harvest / flower</label>
                <input className="form-control" type="date" value={form.expectedHarvestDate}
                  onChange={e => set('expectedHarvestDate', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            {!isNew && onHarvest && (
              <button type="button" className="btn btn-secondary"
                style={{ marginRight: 'auto', color: '#d97706', borderColor: '#d97706' }}
                onClick={onHarvest}>
                Mark harvested
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{isNew ? 'Add' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── BedDetailModal ────────────────────────────────────────────────────────────
const STATUS_LABELS = { planned: 'Planned', sown: 'Sown', germinated: 'Germinated', growing: 'Growing' };
const STATUS_COLORS = { planned: '#6b7280', sown: '#0891b2', germinated: '#059669', growing: '#16a34a' };

function getTask(assignment) {
  const crop = getCropById(assignment.cropId);
  const today = new Date();
  const sowDate = assignment.sowDate ? new Date(assignment.sowDate + 'T12:00:00') : null;
  const harvestDate = assignment.expectedHarvestDate ? new Date(assignment.expectedHarvestDate + 'T12:00:00') : null;
  const daysToHarvest = harvestDate ? Math.round((harvestDate - today) / 86400000) : null;

  switch (assignment.status) {
    case 'planned': {
      if (!sowDate) return 'Prepare bed';
      const daysUntil = Math.round((sowDate - today) / 86400000);
      if (daysUntil <= 0) return 'Ready to sow';
      if (daysUntil <= 7) return `Sow in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;
      return 'Prepare bed';
    }
    case 'sown':
      return `Check for germination${crop?.daysToGermination ? ` (~${crop.daysToGermination} days)` : ''}`;
    case 'germinated':
      return crop?.spacingCm ? `Thin to ${crop.spacingCm} cm spacing` : 'Thin seedlings';
    case 'growing':
      if (daysToHarvest !== null && daysToHarvest >= 0 && daysToHarvest <= 21)
        return `Harvest in ~${daysToHarvest} day${daysToHarvest === 1 ? '' : 's'}`;
      return 'Water regularly, watch for pests';
    default:
      return null;
  }
}

function BedDetailModal({ bed, assignments, onAddCrop, onEditBed, onEditAssignment, onDeleteAssignment, onClose }) {
  const bedAssignments = assignments.filter(a => a.bedId === bed.id);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottom: `3px solid ${bed.color || '#52b788'}` }}>
          <span className="modal-title">{bed.name}</span>
          <div className="flex gap-1 items-center">
            <button className="btn btn-ghost btn-sm" onClick={onEditBed}>Edit bed</button>
            <button className="btn btn-ghost modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-body" style={{ padding: '1rem' }}>
          <p className="text-xs text-muted" style={{ marginBottom: '0.75rem' }}>
            {bed.widthM} × {bed.lengthM} m{bed.notes ? ` · ${bed.notes}` : ''}
          </p>

          {bedAssignments.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--gray-500)', fontSize: '0.875rem', fontStyle: 'italic' }}>
              Nothing planted here yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {bedAssignments.map(a => {
                const crop = getCropById(a.cropId);
                const col  = crop ? getFamilyColor(crop.family) : '#6b7280';
                const task = getTask(a);
                return (
                  <div key={a.id} style={{
                    background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderLeft: `4px solid ${col}`,
                    borderRadius: '6px',
                    padding: '0.6rem 0.75rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <Link
                          to={`/crops/${a.cropId}`}
                          style={{ fontWeight: 600, fontSize: '0.875rem', color: 'inherit', textDecoration: 'underline', textDecorationColor: col + '66', textUnderlineOffset: '2px' }}
                        >
                          {crop?.name || a.cropId}
                        </Link>
                        {a.variety && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{a.variety}</span>
                        )}
                        <span style={{
                          fontSize: '0.68rem',
                          background: (STATUS_COLORS[a.status] || '#6b7280') + '22',
                          color: STATUS_COLORS[a.status] || '#6b7280',
                          borderRadius: '9999px',
                          padding: '1px 7px',
                          fontWeight: 600,
                        }}>
                          {STATUS_LABELS[a.status] || a.status}
                        </span>
                      </div>
                      {a.sowDate && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)', marginTop: '0.15rem' }}>
                          Planted {new Date(a.sowDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          {a.expectedHarvestDate && ` · Ready ~${new Date(a.expectedHarvestDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                        </div>
                      )}
                      {task && (
                        <div style={{ fontSize: '0.72rem', color: '#d97706', marginTop: '0.2rem', fontWeight: 500 }}>
                          → {task}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                        onClick={() => onEditAssignment(a)}
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--gray-400)', padding: '2px 6px' }}
                        onClick={() => onDeleteAssignment(a.id)}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={onAddCrop}>+ Add crop</button>
        </div>
      </div>
    </div>
  );
}

// ── DraggableGrid ─────────────────────────────────────────────────────────────
function DraggableGrid({ beds, onUpdate, onBedClick }) {
  const gridRef    = useRef(null);
  const dragRef    = useRef(null);
  const previewRef = useRef(null);

  const [isDragging,   setIsDragging]   = useState(false);
  const [previewState, setPreviewState] = useState(null);

  function getCell(clientX, clientY) {
    const el = gridRef.current;
    if (!el) return { col: 1, row: 1 };
    const rect = el.getBoundingClientRect();
    const cellW = rect.width  / GRID_COLS;
    const cellH = rect.height / GRID_ROWS;
    return {
      col: clamp(Math.floor((clientX - rect.left) / cellW) + 1, 1, GRID_COLS),
      row: clamp(Math.floor((clientY - rect.top)  / cellH) + 1, 1, GRID_ROWS),
    };
  }

  function startDrag(e, bed, type) {
    e.preventDefault();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    const { col, row } = getCell(cx, cy);
    const bx = clamp(bed.gridX       ?? 1, 1, GRID_COLS);
    const by = clamp(bed.gridY       ?? 1, 1, GRID_ROWS);
    const bw = clamp(bed.widthCells  ?? 2, 1, GRID_COLS);
    const bh = clamp(bed.lengthCells ?? 4, 1, GRID_ROWS);

    const p = { bedId: bed.id, gridX: bx, gridY: by, widthCells: bw, lengthCells: bh };
    dragRef.current = {
      bed, type,
      offsetCellX: col - bx,
      offsetCellY: row - by,
      origGridX: bx, origGridY: by,
      origW: bw, origH: bh,
      startCX: cx, startCY: cy,
      moved: false,
    };
    previewRef.current = p;
    setPreviewState(p);
    setIsDragging(true);
  }

  useEffect(() => {
    if (!isDragging) return;

    function handleMove(e) {
      const d = dragRef.current;
      if (!d) return;
      if (e.cancelable) e.preventDefault();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;

      if (Math.abs(cx - d.startCX) > 4 || Math.abs(cy - d.startCY) > 4) d.moved = true;
      if (!d.moved) return;

      const { col, row } = getCell(cx, cy);
      let p;

      if (d.type === 'move') {
        p = {
          bedId:       d.bed.id,
          gridX:       clamp(col - d.offsetCellX, 1, GRID_COLS - d.origW  + 1),
          gridY:       clamp(row - d.offsetCellY, 1, GRID_ROWS - d.origH  + 1),
          widthCells:  d.origW,
          lengthCells: d.origH,
        };
      } else {
        p = {
          bedId:       d.bed.id,
          gridX:       d.origGridX,
          gridY:       d.origGridY,
          widthCells:  clamp(col - d.origGridX + 1, 1, GRID_COLS - d.origGridX + 1),
          lengthCells: clamp(row - d.origGridY + 1, 1, GRID_ROWS - d.origGridY + 1),
        };
      }

      previewRef.current = p;
      setPreviewState(p);
    }

    function handleUp() {
      const d = dragRef.current;
      const p = previewRef.current;
      if (d && d.moved && p) {
        onUpdate(d.bed.id, {
          gridX:       p.gridX,
          gridY:       p.gridY,
          widthCells:  p.widthCells,
          lengthCells: p.lengthCells,
        });
      } else if (d && !d.moved) {
        onBedClick(d.bed);
      }
      dragRef.current    = null;
      previewRef.current = null;
      setPreviewState(null);
      setIsDragging(false);
    }

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup',   handleUp);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend',  handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup',   handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend',  handleUp);
    };
  }, [isDragging, onUpdate, onBedClick]);

  const renderedBeds = beds.map(bed => {
    const p = previewState;
    if (p && p.bedId === bed.id) {
      return { ...bed, gridX: p.gridX, gridY: p.gridY, widthCells: p.widthCells, lengthCells: p.lengthCells };
    }
    return bed;
  });

  return (
    <div className="plot-grid-scroll">
      <div
        ref={gridRef}
        className="plot-grid"
        style={{
          gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL_PX}px)`,
          gridTemplateRows:    `repeat(${GRID_ROWS}, ${CELL_PX}px)`,
          width:  `${GRID_COLS * CELL_PX}px`,
          height: `${GRID_ROWS * CELL_PX}px`,
          userSelect: 'none',
          cursor: isDragging ? 'grabbing' : 'default',
        }}
      >
        {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, i) => (
          <div key={i} className="plot-cell" />
        ))}

        {renderedBeds.map(bed => {
          const isActive = previewState?.bedId === bed.id;
          const col  = clamp(bed.gridX       ?? 1, 1, GRID_COLS);
          const row  = clamp(bed.gridY       ?? 1, 1, GRID_ROWS);
          const span = clamp(bed.widthCells  ?? 2, 1, GRID_COLS - col + 1);
          const rows = clamp(bed.lengthCells ?? 4, 1, GRID_ROWS - row + 1);

          return (
            <div
              key={bed.id}
              className={`plot-bed${bed.active ? '' : ' inactive'}${isActive ? ' is-dragging' : ''}`}
              style={{
                gridColumn: `${col} / span ${span}`,
                gridRow:    `${row} / span ${rows}`,
                background: bed.color || '#52b788',
                opacity:    bed.active ? 1 : 0.5,
                cursor:     isActive && isDragging ? 'grabbing' : 'grab',
                position:   'relative',
                touchAction: 'none',
              }}
              onMouseDown={e => {
                if (e.target.classList.contains('plot-resize-handle')) return;
                startDrag(e, bed, 'move');
              }}
              onTouchStart={e => {
                if (e.target.classList.contains('plot-resize-handle')) return;
                startDrag(e, bed, 'move');
              }}
            >
              <span className="plot-bed-name">{bed.name}</span>
              <span className="plot-bed-dims">{bed.widthM}×{bed.lengthM}m</span>

              <div
                className="plot-resize-handle"
                title="Drag to resize"
                onMouseDown={e => { e.stopPropagation(); startDrag(e, bed, 'resize'); }}
                onTouchStart={e => { e.stopPropagation(); startDrag(e, bed, 'resize'); }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── BedCard (list view) ───────────────────────────────────────────────────────
function BedCard({ bed, assignments, onEdit, onDelete }) {
  const activeCrops = assignments.filter(a => a.bedId === bed.id);
  const area = (bed.widthM * bed.lengthM).toFixed(1);

  return (
    <div className="bed-card card">
      <div className="bed-card-stripe" style={{ background: bed.color || '#52b788' }} />
      <div className="bed-card-content">
        <div className="flex items-center justify-between gap-2" style={{ flexWrap: 'wrap' }}>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{bed.name}</span>
            {!bed.active && (
              <span className="badge" style={{ background: 'var(--gray-100)', color: 'var(--gray-500)' }}>
                Inactive
              </span>
            )}
          </div>
          <div className="flex gap-1">
            <button className="btn btn-ghost btn-sm" onClick={() => onEdit(bed)}>Edit</button>
            <button className="btn btn-ghost btn-sm text-danger" onClick={() => onDelete(bed)}>Delete</button>
          </div>
        </div>

        <p className="text-xs text-muted" style={{ marginTop: '0.2rem' }}>
          {bed.widthM} × {bed.lengthM} m · {area} m²
        </p>

        {activeCrops.length > 0 ? (
          <div className="bed-card-crops">
            {activeCrops.slice(0, 5).map(a => {
              const crop = getCropById(a.cropId);
              const col  = crop ? getFamilyColor(crop.family) : '#6b7280';
              return (
                <span key={a.id} className="badge"
                  style={{ background: col + '22', color: col, border: `1px solid ${col}44` }}>
                  {crop?.name || a.cropId}
                </span>
              );
            })}
            {activeCrops.length > 5 && (
              <span className="text-xs text-muted">+{activeCrops.length - 5} more</span>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted" style={{ marginTop: '0.35rem', fontStyle: 'italic' }}>
            No crops assigned
          </p>
        )}

        {bed.notes && (
          <p className="text-xs text-muted" style={{ marginTop: '0.3rem' }}>{bed.notes}</p>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PlotLayout() {
  const { dispatch } = useApp();
  const beds         = useBeds();
  const assignments  = useActiveAssignments();
  const history      = useHistory();

  const [modal, setModal] = useState(null);
  const [view,  setView]  = useState('grid');

  function handleSaveBed(form) {
    if (modal.type === 'add') {
      dispatch({ type: 'ADD_BED', payload: form });
    } else {
      dispatch({ type: 'UPDATE_BED', payload: { id: modal.bed.id, ...form } });
    }
    setModal(null);
  }

  function handleDeleteBed() {
    dispatch({ type: 'DELETE_BED', payload: { id: modal.bed.id } });
    setModal(null);
  }

  function handleSaveAssignment(form) {
    if (modal.assignmentId) {
      dispatch({ type: 'UPDATE_ASSIGNMENT', payload: { id: modal.assignmentId, ...form } });
    } else {
      dispatch({ type: 'ADD_ASSIGNMENT', payload: form });
    }
    const bed = beds.find(b => b.id === (form.bedId || modal.bedId));
    setModal(bed ? { type: 'bed-detail', bed } : null);
  }

  function handleHarvestAssignment() {
    dispatch({ type: 'HARVEST_ASSIGNMENT', payload: { id: modal.assignmentId } });
    const bed = modal.fromBed;
    setModal(bed ? { type: 'bed-detail', bed } : null);
  }

  function handleDeleteAssignment(assignmentId) {
    dispatch({ type: 'DELETE_ASSIGNMENT', payload: { id: assignmentId } });
  }

  const handleGridUpdate = useCallback((bedId, changes) => {
    dispatch({ type: 'UPDATE_BED', payload: { id: bedId, ...changes } });
  }, [dispatch]);

  const activeBeds = beds.filter(b => b.active);
  const totalArea  = activeBeds.reduce((s, b) => s + b.widthM * b.lengthM, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Plot Layout</h1>
          <p className="page-subtitle">
            {activeBeds.length} active bed{activeBeds.length !== 1 ? 's' : ''} ·{' '}
            {totalArea.toFixed(1)} m² total
          </p>
        </div>
        <div className="flex gap-2">
          <div className="view-toggle">
            <button className={`btn btn-sm ${view === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setView('grid')}>Map</button>
            <button className={`btn btn-sm ${view === 'list' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setView('list')}>List</button>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'add' })}>
            + Add Bed
          </button>
        </div>
      </div>

      {/* Map view */}
      {view === 'grid' && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">
            <span className="card-title">Plot map</span>
            <span className="text-xs text-muted">Click bed to see what's growing · drag to move · drag ↘ to resize</span>
          </div>
          <div className="card-body" style={{ padding: '0.75rem', overflowX: 'auto' }}>
            {beds.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">⬜</div>
                <div className="empty-state-title">No beds yet</div>
                <div className="empty-state-text">Click "+ Add Bed" to place your first bed.</div>
              </div>
            ) : (
              <DraggableGrid
                beds={beds}
                onUpdate={handleGridUpdate}
                onBedClick={b => setModal({ type: 'bed-detail', bed: b })}
              />
            )}
          </div>
          {beds.length > 0 && (
            <div className="card-footer">
              <p className="text-xs text-muted">
                Each cell ≈ 0.5 m. Click a bed to view plantings — drag to reposition — drag ↘ handle to resize.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Bed cards */}
      {beds.length === 0 && view === 'list' ? (
        <div className="empty-state card" style={{ padding: '3rem' }}>
          <div className="empty-state-icon">⬜</div>
          <div className="empty-state-title">No beds yet</div>
          <div className="empty-state-text">Add your first bed to get started.</div>
          <button className="btn btn-primary" style={{ marginTop: '1rem' }}
            onClick={() => setModal({ type: 'add' })}>
            + Add Bed
          </button>
        </div>
      ) : (
        <div className="bed-card-grid">
          {beds.map(bed => (
            <BedCard key={bed.id} bed={bed} assignments={assignments}
              onEdit={b => setModal({ type: 'edit', bed: b })}
              onDelete={b => setModal({ type: 'delete', bed: b })} />
          ))}
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'add' && (
        <BedModal onSave={handleSaveBed} onClose={() => setModal(null)} bedCount={beds.length} />
      )}
      {modal?.type === 'edit' && (
        <BedModal bed={modal.bed} onSave={handleSaveBed} onClose={() => setModal(null)} bedCount={beds.length} />
      )}
      {modal?.type === 'delete' && (
        <DeleteModal bed={modal.bed} onConfirm={handleDeleteBed} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'bed-detail' && (
        <BedDetailModal
          bed={modal.bed}
          assignments={assignments}
          onAddCrop={() => setModal({ type: 'add-assignment', bedId: modal.bed.id, fromBed: modal.bed })}
          onEditBed={() => setModal({ type: 'edit', bed: modal.bed })}
          onEditAssignment={a => setModal({ type: 'edit-assignment', assignment: a, assignmentId: a.id, bedId: a.bedId, fromBed: modal.bed })}
          onDeleteAssignment={handleDeleteAssignment}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'add-assignment' && (
        <AssignmentModal
          bedId={modal.bedId}
          beds={beds}
          history={history}
          onSave={handleSaveAssignment}
          onClose={() => setModal({ type: 'bed-detail', bed: modal.fromBed })}
        />
      )}
      {modal?.type === 'edit-assignment' && (
        <AssignmentModal
          assignment={modal.assignment}
          bedId={modal.bedId}
          beds={beds}
          history={history}
          onSave={handleSaveAssignment}
          onHarvest={handleHarvestAssignment}
          onClose={() => setModal({ type: 'bed-detail', bed: modal.fromBed })}
        />
      )}
    </div>
  );
}
