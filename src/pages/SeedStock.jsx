import React, { useState, useMemo } from 'react';
import { useApp, useSeedStock } from '../store/AppContext';
import { CROPS, getCropById, getFamilyColor, getFamilyBgColor } from '../data/crops';

const CURRENT_YEAR = new Date().getFullYear();
const QUANTITIES = ['full', 'half', 'low'];

function QuantityLabel({ quantity }) {
  const map = {
    full: { label: 'Full',  bg: 'var(--green-100)', color: 'var(--green-800)' },
    half: { label: 'Half',  bg: 'var(--amber-bg)',  color: '#92400e'          },
    low:  { label: 'Low',   bg: 'var(--red-bg)',    color: '#991b1b'           },
  };
  const s = map[quantity] || map.full;
  return (
    <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
  );
}

// ── Add/Edit modal ────────────────────────────────────────────────────────────

function SeedModal({ seed, onSave, onClose }) {
  const isNew = !seed;
  const [form, setForm] = useState(() => isNew ? {
    cropId: CROPS[0].id,
    variety: '',
    quantity: 'full',
    expiryYear: CURRENT_YEAR + 2,
    notes: '',
  } : {
    cropId: seed.cropId,
    variety: seed.variety || '',
    quantity: seed.quantity || 'full',
    expiryYear: seed.expiryYear || CURRENT_YEAR + 2,
    notes: seed.notes || '',
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.cropId) return;
    onSave(form);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{isNew ? 'Add seed packet' : 'Edit seed packet'}</span>
          <button className="btn btn-ghost modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Crop *</label>
                <select className="form-control" value={form.cropId}
                  onChange={e => set('cropId', e.target.value)}>
                  {CROPS.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Variety (optional)</label>
                <input className="form-control" value={form.variety}
                  onChange={e => set('variety', e.target.value)}
                  placeholder="e.g. Nantes, Defender…" />
              </div>
            </div>

            <div className="form-row form-row-3">
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <select className="form-control" value={form.quantity}
                  onChange={e => set('quantity', e.target.value)}>
                  {QUANTITIES.map(q => (
                    <option key={q} value={q}>{q.charAt(0).toUpperCase() + q.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Expiry year</label>
                <input className="form-control" type="number"
                  min={CURRENT_YEAR - 2} max={CURRENT_YEAR + 10}
                  value={form.expiryYear}
                  onChange={e => set('expiryYear', parseInt(e.target.value) || CURRENT_YEAR + 2)} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Notes</label>
              <input className="form-control" value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Source, bought date, etc." />
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SeedStock() {
  const { dispatch } = useApp();
  const seedStock = useSeedStock();
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState({ search: '', quantity: '', status: 'all' });

  // Group by crop family for display
  const filtered = useMemo(() => {
    return seedStock.filter(s => {
      const crop = getCropById(s.cropId);
      if (filter.search) {
        const q = filter.search.toLowerCase();
        if (!crop?.name.toLowerCase().includes(q) && !s.variety?.toLowerCase().includes(q)) return false;
      }
      if (filter.quantity && s.quantity !== filter.quantity) return false;
      if (filter.status === 'expired' && s.expiryYear > CURRENT_YEAR) return false;
      if (filter.status === 'expiring' && (s.expiryYear !== CURRENT_YEAR + 1)) return false;
      if (filter.status === 'ok' && s.expiryYear <= CURRENT_YEAR) return false;
      return true;
    }).sort((a, b) => {
      const ca = getCropById(a.cropId)?.name || '';
      const cb = getCropById(b.cropId)?.name || '';
      return ca.localeCompare(cb);
    });
  }, [seedStock, filter]);

  function handleSave(form) {
    if (modal.type === 'add') {
      dispatch({ type: 'ADD_SEED', payload: form });
    } else {
      dispatch({ type: 'UPDATE_SEED', payload: { id: modal.seed.id, ...form } });
    }
    setModal(null);
  }

  function handleDelete(seed) {
    const crop = getCropById(seed.cropId);
    if (window.confirm(`Remove ${crop?.name || 'this packet'}${seed.variety ? ` (${seed.variety})` : ''} from seed stock?`)) {
      dispatch({ type: 'DELETE_SEED', payload: { id: seed.id } });
    }
  }

  const expiredCount  = seedStock.filter(s => s.expiryYear <= CURRENT_YEAR).length;
  const expiringCount = seedStock.filter(s => s.expiryYear === CURRENT_YEAR + 1).length;
  const lowCount      = seedStock.filter(s => s.quantity === 'low').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Seed Stock</h1>
          <p className="page-subtitle">
            {seedStock.length} packet{seedStock.length !== 1 ? 's' : ''}
            {expiredCount > 0 && ` · ${expiredCount} expired`}
            {expiringCount > 0 && ` · ${expiringCount} expiring soon`}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'add' })}>
          + Add Packet
        </button>
      </div>

      {/* Warnings */}
      {expiredCount > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: '0.75rem' }}>
          <span className="alert-icon">⏰</span>
          <div className="alert-body">
            <div className="alert-title">{expiredCount} expired packet{expiredCount > 1 ? 's' : ''}</div>
            <div className="alert-text">Test germination on a damp tissue before sowing or replace.</div>
          </div>
        </div>
      )}
      {lowCount > 0 && (
        <div className="alert alert-info" style={{ marginBottom: '0.75rem' }}>
          <span className="alert-icon">📦</span>
          <div className="alert-body">
            <div className="alert-title">{lowCount} packet{lowCount > 1 ? 's' : ''} running low</div>
            <div className="alert-text">Consider ordering replacements before the sowing season.</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="card-body" style={{ paddingBottom: '0.5rem' }}>
          <div className="cal-filters">
            <input className="form-control" placeholder="Search crop or variety…"
              value={filter.search}
              onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
              style={{ maxWidth: 220 }} />

            <select className="form-control" value={filter.quantity}
              onChange={e => setFilter(f => ({ ...f, quantity: e.target.value }))}
              style={{ maxWidth: 140 }}>
              <option value="">All quantities</option>
              {QUANTITIES.map(q => (
                <option key={q} value={q}>{q.charAt(0).toUpperCase() + q.slice(1)}</option>
              ))}
            </select>

            <div className="view-toggle">
              {[
                { val: 'all',       label: `All (${seedStock.length})` },
                { val: 'expired',   label: `Expired (${expiredCount})` },
                { val: 'expiring',  label: `Expiring soon (${expiringCount})` },
                { val: 'ok',        label: 'OK' },
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

        {seedStock.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem 1.5rem' }}>
            <div className="empty-state-icon">🌰</div>
            <div className="empty-state-title">No seeds logged</div>
            <div className="empty-state-text">
              Track your seed packets so the app can warn you when you've planned a crop you don't have seeds for.
            </div>
            <button className="btn btn-primary" style={{ marginTop: '1rem' }}
              onClick={() => setModal({ type: 'add' })}>
              + Add First Packet
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: '1.5rem' }}>
            <div className="empty-state-text">No packets match these filters.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="assignment-table">
              <thead>
                <tr>
                  <th>Crop</th>
                  <th>Variety</th>
                  <th>Quantity</th>
                  <th>Expiry</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(seed => {
                  const crop = getCropById(seed.cropId);
                  const col  = crop ? getFamilyColor(crop.family) : '#6b7280';
                  const expired  = seed.expiryYear <= CURRENT_YEAR;
                  const expiring = seed.expiryYear === CURRENT_YEAR + 1;
                  return (
                    <tr key={seed.id} className="assignment-row">
                      <td>
                        <div className="flex items-center gap-2">
                          <div style={{ width: 4, height: 28, borderRadius: 9, background: col, flexShrink: 0 }} />
                          <span className="font-semibold text-sm">{crop?.name || seed.cropId}</span>
                        </div>
                      </td>
                      <td className="text-sm text-muted">{seed.variety || '—'}</td>
                      <td><QuantityLabel quantity={seed.quantity} /></td>
                      <td>
                        <span className={`text-sm${expired ? ' text-danger font-semibold' : expiring ? ' font-semibold' : ''}`}
                          style={expiring && !expired ? { color: '#92400e' } : {}}>
                          {seed.expiryYear}
                          {expired && ' ⚠'}
                          {expiring && !expired && ' ⏰'}
                        </span>
                      </td>
                      <td className="text-xs text-muted">{seed.notes || '—'}</td>
                      <td>
                        <div className="flex gap-1">
                          <button className="btn btn-ghost btn-sm"
                            onClick={() => setModal({ type: 'edit', seed })}>Edit</button>
                          <button className="btn btn-ghost btn-sm text-danger"
                            onClick={() => handleDelete(seed)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal?.type === 'add' && (
        <SeedModal onSave={handleSave} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'edit' && (
        <SeedModal seed={modal.seed} onSave={handleSave} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
