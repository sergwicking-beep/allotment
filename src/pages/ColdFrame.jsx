import React, { useState, useMemo } from 'react';
import { useApp, useColdFrameEntries } from '../store/AppContext';
import { CROPS, getCropById, getFamilyColor, getFamilyBgColor } from '../data/crops';

const TODAY = new Date().toISOString().split('T')[0];

const STAGES = [
  { value: 'just_sown',       label: 'Just sown',         cls: 'stage-just-sown'       },
  { value: 'germinated',      label: 'Germinated',        cls: 'stage-germinated'      },
  { value: 'growing_on',      label: 'Growing on',        cls: 'stage-growing-on'      },
  { value: 'ready_to_harden', label: 'Ready to harden',   cls: 'stage-ready-to-harden' },
  { value: 'hardening_off',   label: 'Hardening off',     cls: 'stage-hardening-off'   },
];

function stageInfo(value) { return STAGES.find(s => s.value === value) || STAGES[0]; }

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.round((Date.now() - new Date(dateStr + 'T12:00:00').getTime()) / 86400000);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  });
}

// ── Add/Edit modal ────────────────────────────────────────────────────────────

function EntryModal({ entry, onSave, onClose }) {
  const isNew = !entry;
  const coldFrameCrops = CROPS.filter(c => c.weeksInColdFrame || c.propagation === 'cold_frame' || c.propagation === 'both');

  const [form, setForm] = useState(() => isNew ? {
    cropId: coldFrameCrops[0]?.id || CROPS[0].id,
    variety: '',
    sowDate: TODAY,
    stage: 'just_sown',
    notes: '',
  } : {
    cropId: entry.cropId,
    variety: entry.variety || '',
    sowDate: entry.sowDate || TODAY,
    stage: entry.stage || 'just_sown',
    notes: entry.notes || '',
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  const selectedCrop = getCropById(form.cropId);

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.cropId || !form.sowDate) return;
    onSave(form);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{isNew ? 'Add to cold frame' : 'Edit entry'}</span>
          <button className="btn btn-ghost modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Crop *</label>
                <select className="form-control" value={form.cropId}
                  onChange={e => set('cropId', e.target.value)}>
                  {CROPS.filter(c => !c.perennial).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Variety (optional)</label>
                <input className="form-control" value={form.variety}
                  onChange={e => set('variety', e.target.value)}
                  placeholder="e.g. Nantes, Chantenay…" />
              </div>
            </div>

            {selectedCrop?.coldFrameNotes && (
              <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
                <span className="alert-icon">💡</span>
                <div className="alert-body">
                  <div className="alert-title">Cold frame tips for {selectedCrop.name}</div>
                  <div className="alert-text">{selectedCrop.coldFrameNotes}</div>
                </div>
              </div>
            )}

            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Sow date *</label>
                <input className="form-control" type="date" value={form.sowDate}
                  onChange={e => set('sowDate', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Current stage</label>
                <select className="form-control" value={form.stage}
                  onChange={e => set('stage', e.target.value)}>
                  {STAGES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Notes</label>
              <textarea className="form-control" rows={2} value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Pot size, thinning done, any issues…" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{isNew ? 'Add' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Entry card ────────────────────────────────────────────────────────────────

function EntryCard({ entry, onEdit, onDelete, onAdvanceStage, onTransplanted }) {
  const crop    = getCropById(entry.cropId);
  const si      = stageInfo(entry.stage);
  const daysOld = entry.sowDate ? daysSince(entry.sowDate) : null;
  const weeksTarget = crop?.weeksInColdFrame || 6;
  const expectedTransplant = entry.sowDate ? addDays(entry.sowDate, weeksTarget * 7) : null;
  const daysToTransplant = expectedTransplant
    ? Math.round((new Date(expectedTransplant + 'T12:00:00') - Date.now()) / 86400000) : null;

  const currentStageIdx = STAGES.findIndex(s => s.value === entry.stage);
  const nextStage = STAGES[currentStageIdx + 1];

  // Care hints by stage
  const careHints = {
    just_sown: 'Keep moist and lid on. Check daily for germination.',
    germinated: 'Ventilate on days above 10°C. Thin crowded seedlings.',
    growing_on: 'Pot on if roots reach the bottom. Water regularly.',
    ready_to_harden: 'Start hardening off: prop lid open for a few hours each day.',
    hardening_off: 'Increase ventilation daily over 7–14 days. Bring inside if frost forecast.',
  };

  const col = crop ? getFamilyColor(crop.family) : '#6b7280';
  const bg  = crop ? getFamilyBgColor(crop.family) : '#f3f4f6';

  return (
    <div className="cf-card card">
      <div className="cf-card-header" style={{ borderLeft: `4px solid ${col}` }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{crop?.name || entry.cropId}</span>
            {entry.variety && <span className="text-sm text-muted">– {entry.variety}</span>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`badge ${si.cls}`}>{si.label}</span>
            {daysOld != null && (
              <span className="text-xs text-muted">{daysOld}d old · sown {formatDate(entry.sowDate)}</span>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <button className="btn btn-ghost btn-sm" onClick={() => onEdit(entry)}>Edit</button>
          <button className="btn btn-ghost btn-sm text-danger" onClick={() => onDelete(entry)}>✕</button>
        </div>
      </div>

      <div className="cf-card-body">
        {/* Progress bar */}
        <div className="cf-progress">
          {STAGES.map((s, i) => (
            <div key={s.value}
              className={`cf-progress-step ${
                i < currentStageIdx ? 'done' :
                i === currentStageIdx ? 'current' : 'future'
              }`}>
              <div className="cf-progress-dot" style={{ background: i <= currentStageIdx ? col : undefined }} />
              <span className="cf-progress-label">{s.label.split(' ')[0]}</span>
            </div>
          ))}
        </div>

        {/* Timeline */}
        {expectedTransplant && (
          <div className="cf-timeline">
            <span className="text-xs text-muted">
              Expected transplant: <strong>{formatDate(expectedTransplant)}</strong>
              {daysToTransplant != null && (
                daysToTransplant < 0
                  ? <span className="text-danger"> ({Math.abs(daysToTransplant)}d overdue)</span>
                  : daysToTransplant === 0
                    ? <span className="text-success"> (today!)</span>
                    : <span> (in {daysToTransplant}d)</span>
              )}
            </span>
          </div>
        )}

        {/* Care hint */}
        {careHints[entry.stage] && (
          <p className="text-xs text-muted cf-care-hint">
            💡 {careHints[entry.stage]}
          </p>
        )}

        {/* Crop cold frame notes */}
        {crop?.coldFrameNotes && entry.stage === 'hardening_off' && (
          <p className="text-xs cf-care-hint" style={{ color: 'var(--green-800)' }}>
            {crop.coldFrameNotes}
          </p>
        )}

        {entry.notes && (
          <p className="text-xs text-muted" style={{ marginTop: '0.35rem', fontStyle: 'italic' }}>
            {entry.notes}
          </p>
        )}
      </div>

      <div className="cf-card-footer">
        {nextStage ? (
          <button className="btn btn-secondary btn-sm" onClick={() => onAdvanceStage(entry, nextStage.value)}>
            Advance to: {nextStage.label} →
          </button>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={() => onTransplanted(entry)}>
            Mark as transplanted ✓
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ColdFrame() {
  const { dispatch } = useApp();
  const entries = useColdFrameEntries();
  const [modal, setModal] = useState(null);

  function handleSave(form) {
    if (modal.type === 'add') {
      dispatch({ type: 'ADD_COLD_FRAME_ENTRY', payload: form });
    } else {
      dispatch({ type: 'UPDATE_COLD_FRAME_ENTRY', payload: { id: modal.entry.id, ...form } });
    }
    setModal(null);
  }

  function handleDelete(entry) {
    const crop = getCropById(entry.cropId);
    if (window.confirm(`Remove ${crop?.name || 'this entry'} from cold frame?`)) {
      dispatch({ type: 'DELETE_COLD_FRAME_ENTRY', payload: { id: entry.id } });
    }
  }

  function handleAdvanceStage(entry, newStage) {
    dispatch({ type: 'UPDATE_COLD_FRAME_ENTRY', payload: { id: entry.id, stage: newStage } });
  }

  function handleTransplanted(entry) {
    if (window.confirm('Mark as transplanted and remove from cold frame?')) {
      dispatch({ type: 'DELETE_COLD_FRAME_ENTRY', payload: { id: entry.id } });
    }
  }

  // Sort: most urgent first (harden-off > growing > germinated > just_sown)
  const stageOrder = { hardening_off: 0, ready_to_harden: 1, growing_on: 2, germinated: 3, just_sown: 4 };
  const sorted = [...entries].sort((a, b) =>
    (stageOrder[a.stage] ?? 5) - (stageOrder[b.stage] ?? 5)
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cold Frame</h1>
          <p className="page-subtitle">
            {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'} at home
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'add' })}>
          + Add Entry
        </button>
      </div>

      {/* General guidance card */}
      <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
        <span className="alert-icon">🏡</span>
        <div className="alert-body">
          <div className="alert-title">Cold frame care</div>
          <div className="alert-text">
            Ventilate on days above 10°C to prevent damping off.
            Close the lid before nightfall if frost is forecast.
            Water in the morning so plants dry before dark.
          </div>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state card" style={{ padding: '3rem' }}>
          <div className="empty-state-icon">🏡</div>
          <div className="empty-state-title">No cold frame entries</div>
          <div className="empty-state-text">
            Log what you're currently growing at home to track progress and get transplant timing.
          </div>
          <button className="btn btn-primary" style={{ marginTop: '1rem' }}
            onClick={() => setModal({ type: 'add' })}>
            + Add First Entry
          </button>
        </div>
      ) : (
        <div className="cf-grid">
          {sorted.map(entry => (
            <EntryCard key={entry.id} entry={entry}
              onEdit={e => setModal({ type: 'edit', entry: e })}
              onDelete={handleDelete}
              onAdvanceStage={handleAdvanceStage}
              onTransplanted={handleTransplanted} />
          ))}
        </div>
      )}

      {modal?.type === 'add' && (
        <EntryModal onSave={handleSave} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'edit' && (
        <EntryModal entry={modal.entry} onSave={handleSave} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
