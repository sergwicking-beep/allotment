import React, { useState, useMemo } from 'react';
import { useApp, useColdFrameEntries } from '../store/AppContext';
import { CROPS, getCropById, getFamilyColor, getFamilyBgColor } from '../data/crops';

const TODAY = new Date().toISOString().split('T')[0];

// Active stages (progress chain)
const STAGES = [
  { value: 'just_sown',  label: 'Sown',       cls: 'stage-just-sown'  },
  { value: 'germinated', label: 'Germinated',  cls: 'stage-germinated' },
];

function stageInfo(value) {
  if (value === 'failed_to_germinate')
    return { value, label: "Didn't germinate", cls: 'stage-failed' };
  // Map old stages from previous data to germinated
  if (['growing_on', 'ready_to_harden', 'hardening_off'].includes(value))
    return STAGES[1];
  return STAGES.find(s => s.value === value) || STAGES[0];
}

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

  const [form, setForm] = useState(() => isNew ? {
    cropId: CROPS.filter(c => !c.perennial)[0]?.id || CROPS[0].id,
    variety: '',
    sowDate: TODAY,
    stage: 'just_sown',
    notes: '',
  } : {
    cropId: entry.cropId,
    variety: entry.variety || '',
    sowDate: entry.sowDate || TODAY,
    stage: ['growing_on','ready_to_harden','hardening_off'].includes(entry.stage) ? 'germinated' : (entry.stage || 'just_sown'),
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
          <span className="modal-title">{isNew ? 'Add to propagation' : 'Edit entry'}</span>
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
                  placeholder="e.g. Nantes, Moneymaker…" />
              </div>
            </div>

            {selectedCrop?.coldFrameNotes && (
              <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
                <span className="alert-icon">💡</span>
                <div className="alert-body">
                  <div className="alert-title">Tips for {selectedCrop.name}</div>
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

function EntryCard({ entry, onEdit, onDelete, onGerminated, onPlantOut, onMarkFailed }) {
  const crop    = getCropById(entry.cropId);
  const si      = stageInfo(entry.stage);
  const daysOld = entry.sowDate ? daysSince(entry.sowDate) : null;
  const isFailed = entry.stage === 'failed_to_germinate';

  const weeksTarget = crop?.weeksInColdFrame || 6;
  const expectedPlantOut = entry.sowDate ? addDays(entry.sowDate, weeksTarget * 7) : null;
  const daysToPlantOut = expectedPlantOut
    ? Math.round((new Date(expectedPlantOut + 'T12:00:00') - Date.now()) / 86400000) : null;

  const careHints = {
    just_sown:  'Keep moist and check daily for germination.',
    germinated: 'Thin if crowded. Water in the morning. Keep warm.',
  };

  const col = crop ? getFamilyColor(crop.family) : '#6b7280';

  return (
    <div className="cf-card card" style={isFailed ? { opacity: 0.7, borderColor: '#fca5a5' } : {}}>
      <div className="cf-card-header" style={{ borderLeft: `4px solid ${isFailed ? '#ef4444' : col}` }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{crop?.name || entry.cropId}</span>
            {entry.variety && <span className="text-sm text-muted">– {entry.variety}</span>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`badge ${si.cls}`}
              style={isFailed ? { background: '#fee2e2', color: '#b91c1c' } : {}}>
              {si.label}
            </span>
            {daysOld != null && (
              <span className="text-xs text-muted">{daysOld}d old · sown {formatDate(entry.sowDate)}</span>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          {!isFailed && <button className="btn btn-ghost btn-sm" onClick={() => onEdit(entry)}>Edit</button>}
          <button className="btn btn-ghost btn-sm text-danger" onClick={() => onDelete(entry)}>✕</button>
        </div>
      </div>

      <div className="cf-card-body">
        {/* Progress bar (only for active stages) */}
        {!isFailed && (
          <div className="cf-progress">
            {STAGES.map((s, i) => {
              const currentIdx = STAGES.findIndex(st => st.value === entry.stage);
              return (
                <div key={s.value}
                  className={`cf-progress-step ${
                    i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'future'
                  }`}>
                  <div className="cf-progress-dot" style={{ background: i <= currentIdx ? col : undefined }} />
                  <span className="cf-progress-label">{s.label}</span>
                </div>
              );
            })}
            {/* Plant out as final step */}
            <div className="cf-progress-step future">
              <div className="cf-progress-dot" />
              <span className="cf-progress-label">Plant out</span>
            </div>
          </div>
        )}

        {/* Timeline */}
        {!isFailed && expectedPlantOut && (
          <div className="cf-timeline">
            <span className="text-xs text-muted">
              Expected plant out: <strong>{formatDate(expectedPlantOut)}</strong>
              {daysToPlantOut != null && (
                daysToPlantOut < 0
                  ? <span className="text-danger"> ({Math.abs(daysToPlantOut)}d overdue)</span>
                  : daysToPlantOut === 0
                    ? <span className="text-success"> (today!)</span>
                    : <span> (in {daysToPlantOut}d)</span>
              )}
            </span>
          </div>
        )}

        {/* Care hint */}
        {!isFailed && careHints[entry.stage] && (
          <p className="text-xs text-muted cf-care-hint">
            💡 {careHints[entry.stage]}
          </p>
        )}

        {isFailed && (
          <p className="text-xs cf-care-hint" style={{ color: '#b91c1c' }}>
            Try re-sowing with fresh seed. Check soil temperature and moisture levels.
          </p>
        )}

        {entry.notes && (
          <p className="text-xs text-muted" style={{ marginTop: '0.35rem', fontStyle: 'italic' }}>
            {entry.notes}
          </p>
        )}
      </div>

      <div className="cf-card-footer" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {isFailed ? (
          <button className="btn btn-secondary btn-sm text-danger" onClick={() => onDelete(entry)}>
            Remove
          </button>
        ) : entry.stage === 'just_sown' ? (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => onGerminated(entry)}>
              Germinated →
            </button>
            <button className="btn btn-ghost btn-sm" style={{ color: '#b91c1c' }}
              onClick={() => onMarkFailed(entry)}>
              Didn't germinate
            </button>
          </>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={() => onPlantOut(entry)}>
            Plant out →
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
    if (window.confirm(`Remove ${crop?.name || 'this entry'}?`)) {
      dispatch({ type: 'DELETE_COLD_FRAME_ENTRY', payload: { id: entry.id } });
    }
  }

  function handleGerminated(entry) {
    dispatch({ type: 'UPDATE_COLD_FRAME_ENTRY', payload: { id: entry.id, stage: 'germinated' } });
  }

  function handleMarkFailed(entry) {
    dispatch({ type: 'UPDATE_COLD_FRAME_ENTRY', payload: { id: entry.id, stage: 'failed_to_germinate' } });
  }

  function handlePlantOut(entry) {
    if (window.confirm('Mark as planted out and remove from propagation?')) {
      dispatch({ type: 'DELETE_COLD_FRAME_ENTRY', payload: { id: entry.id } });
    }
  }

  // Sort: germinated first, sown next, failed at the bottom
  const stageOrder = { germinated: 0, just_sown: 1, growing_on: 1, ready_to_harden: 1, hardening_off: 1, failed_to_germinate: 2 };
  const sorted = [...entries].sort((a, b) =>
    (stageOrder[a.stage] ?? 1) - (stageOrder[b.stage] ?? 1)
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Propagation</h1>
          <p className="page-subtitle">
            {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'} started
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'add' })}>
          + Add Entry
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state card" style={{ padding: '3rem' }}>
          <div className="empty-state-icon">🌱</div>
          <div className="empty-state-title">Nothing on the go</div>
          <div className="empty-state-text">
            Log what you're currently sowing indoors to track germination and plant-out timing.
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
              onGerminated={handleGerminated}
              onMarkFailed={handleMarkFailed}
              onPlantOut={handlePlantOut} />
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
