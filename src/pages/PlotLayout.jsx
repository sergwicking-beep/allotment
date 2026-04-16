import React, { useState } from 'react';
import { useApp, useBeds, useActiveAssignments } from '../store/AppContext';
import { getCropById, getFamilyColor } from '../data/crops';

// ── colour palette for beds ───────────────────────────────────────────────────
const BED_COLORS = [
  '#52b788','#74c69d','#40916c','#2d6a4f',
  '#95d5b2','#b7e4c7',
  '#74b9ff','#a29bfe','#fd79a8','#fdcb6e','#e17055','#55efc4',
];

function pickColor(idx) { return BED_COLORS[idx % BED_COLORS.length]; }

// ── grid constants ────────────────────────────────────────────────────────────
const GRID_COLS = 12;
const GRID_ROWS = 10;
const CELL_PX   = 52;

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function defaultBedData(count) {
  return {
    name: `Bed ${count < 26 ? String.fromCharCode(65 + count) : count + 1}`,
    widthCells:  2,
    lengthCells: 4,
    widthM:  1.2,
    lengthM: 2.4,
    active: true,
    notes: '',
    color: pickColor(count),
    gridX: 1,
    gridY: 1,
  };
}

// ── BedModal ──────────────────────────────────────────────────────────────────
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

            <p className="form-hint" style={{ marginBottom: '0.75rem' }}>
              Grid position controls where the bed appears on the plot map.
            </p>

            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Map column (1–{GRID_COLS})</label>
                <input className="form-control" type="number" min="1" max={GRID_COLS} value={form.gridX}
                  onChange={e => set('gridX', clamp(parseInt(e.target.value) || 1, 1, GRID_COLS))} />
              </div>
              <div className="form-group">
                <label className="form-label">Map row (1–{GRID_ROWS})</label>
                <input className="form-control" type="number" min="1" max={GRID_ROWS} value={form.gridY}
                  onChange={e => set('gridY', clamp(parseInt(e.target.value) || 1, 1, GRID_ROWS))} />
              </div>
            </div>

            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Map width (cells)</label>
                <input className="form-control" type="number" min="1" max={GRID_COLS} value={form.widthCells}
                  onChange={e => set('widthCells', clamp(parseInt(e.target.value) || 2, 1, GRID_COLS))} />
              </div>
              <div className="form-group">
                <label className="form-label">Map height (cells)</label>
                <input className="form-control" type="number" min="1" max={GRID_ROWS} value={form.lengthCells}
                  onChange={e => set('lengthCells', clamp(parseInt(e.target.value) || 4, 1, GRID_ROWS))} />
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

// ── PlotGrid visual ───────────────────────────────────────────────────────────
function PlotGrid({ beds, onBedClick }) {
  return (
    <div className="plot-grid-scroll">
      <div className="plot-grid"
        style={{
          gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL_PX}px)`,
          gridTemplateRows:    `repeat(${GRID_ROWS}, ${CELL_PX}px)`,
          width:  `${GRID_COLS * CELL_PX}px`,
          height: `${GRID_ROWS * CELL_PX}px`,
        }}
      >
        {/* Background grid cells */}
        {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, i) => (
          <div key={i} className="plot-cell" />
        ))}

        {/* Beds */}
        {beds.map(bed => {
          const col  = clamp(bed.gridX       ?? 1, 1, GRID_COLS);
          const row  = clamp(bed.gridY       ?? 1, 1, GRID_ROWS);
          const span = clamp(bed.widthCells  ?? 2, 1, GRID_COLS - col + 1);
          const rows = clamp(bed.lengthCells ?? 4, 1, GRID_ROWS - row + 1);
          return (
            <button key={bed.id}
              type="button"
              className={`plot-bed${bed.active ? '' : ' inactive'}`}
              style={{
                gridColumn: `${col} / span ${span}`,
                gridRow:    `${row} / span ${rows}`,
                background: bed.color || '#52b788',
                opacity: bed.active ? 1 : 0.5,
              }}
              onClick={() => onBedClick(bed)}
              title={`${bed.name} · ${bed.widthM} × ${bed.lengthM} m — click to edit`}
            >
              <span className="plot-bed-name">{bed.name}</span>
              <span className="plot-bed-dims">{bed.widthM}×{bed.lengthM}m</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── BedCard (list) ────────────────────────────────────────────────────────────
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
              <span className="badge"
                style={{ background: 'var(--gray-100)', color: 'var(--gray-500)' }}>
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
                  style={{
                    background: col + '22',
                    color: col,
                    border: `1px solid ${col}44`,
                  }}>
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
  const beds        = useBeds();
  const assignments = useActiveAssignments();

  const [modal, setModal] = useState(null); // null | { type, bed? }
  const [view,  setView]  = useState('grid');

  function handleSave(form) {
    if (modal.type === 'add') {
      dispatch({ type: 'ADD_BED', payload: form });
    } else {
      dispatch({ type: 'UPDATE_BED', payload: { id: modal.bed.id, ...form } });
    }
    setModal(null);
  }

  function handleDelete() {
    dispatch({ type: 'DELETE_BED', payload: { id: modal.bed.id } });
    setModal(null);
  }

  const activeBeds = beds.filter(b => b.active);
  const totalArea  = activeBeds.reduce((s, b) => s + b.widthM * b.lengthM, 0);

  return (
    <div>
      {/* Header */}
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
            <button
              className={`btn btn-sm ${view === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setView('grid')}>
              Map
            </button>
            <button
              className={`btn btn-sm ${view === 'list' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setView('list')}>
              List
            </button>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'add' })}>
            + Add Bed
          </button>
        </div>
      </div>

      {/* Grid/Map view */}
      {view === 'grid' && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">
            <span className="card-title">Plot map</span>
            <span className="text-xs text-muted">Click any bed to edit it</span>
          </div>
          <div className="card-body" style={{ padding: '0.75rem', overflowX: 'auto' }}>
            {beds.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">⬜</div>
                <div className="empty-state-title">No beds yet</div>
                <div className="empty-state-text">
                  Click "Add Bed" to place your first bed on the plot map.
                </div>
              </div>
            ) : (
              <PlotGrid beds={beds} onBedClick={b => setModal({ type: 'edit', bed: b })} />
            )}
          </div>
          {beds.length > 0 && (
            <div className="card-footer">
              <p className="text-xs text-muted">
                Each grid cell ≈ 0.5 m. Use Map column/row and width/height in the bed settings to position beds.
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
        <BedModal onSave={handleSave} onClose={() => setModal(null)} bedCount={beds.length} />
      )}
      {modal?.type === 'edit' && (
        <BedModal bed={modal.bed} onSave={handleSave} onClose={() => setModal(null)} bedCount={beds.length} />
      )}
      {modal?.type === 'delete' && (
        <DeleteModal bed={modal.bed} onConfirm={handleDelete} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
