import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp, useBeds } from '../store/AppContext';
import { CROPS, getCropById, getFamilyColor, getFamilyBgColor } from '../data/crops';

// ── helpers ───────────────────────────────────────────────────────────────────

const TODAY         = new Date().toISOString().split('T')[0];
const CURRENT_YEAR  = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

function addWeeks(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n * 7);
  return d.toISOString().split('T')[0];
}

function formatPlanDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDate();
  const prefix = day <= 10 ? 'Early' : day <= 20 ? 'Mid' : 'Late';
  return `${prefix} ${d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
}

function getNextSowDate(crop) {
  if (!crop.sowWindowStart) return null;
  // Currently inside the window → sow now
  if (CURRENT_MONTH >= crop.sowWindowStart && CURRENT_MONTH <= crop.sowWindowEnd) {
    return `${CURRENT_YEAR}-${String(CURRENT_MONTH).padStart(2, '0')}-01`;
  }
  // Window not yet started this year
  if (CURRENT_MONTH < crop.sowWindowStart) {
    return `${CURRENT_YEAR}-${String(crop.sowWindowStart).padStart(2, '0')}-01`;
  }
  // Window has passed — plan for next year
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
      const sowYear   = parseInt(sowDate.split('-')[0]);
      const sowMonth  = parseInt(sowDate.split('-')[1]);
      const h         = crop.harvestWindowStart;
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
      {/* Filter bar */}
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

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: '0.5rem',
      }}>
        {filtered.map(crop => {
          const sel = selected.includes(crop.id);
          const col = getFamilyColor(crop.family);
          return (
            <button key={crop.id} onClick={() => onToggle(crop.id)} style={{
              border: `2px solid ${sel ? col : '#e5e7eb'}`,
              borderRadius: '8px',
              padding: '0.625rem 0.5rem',
              background: sel ? col + '15' : '#fff',
              cursor: 'pointer',
              textAlign: 'left',
              position: 'relative',
              transition: 'all 100ms',
            }}>
              {sel && (
                <span style={{
                  position: 'absolute', top: '4px', right: '6px',
                  fontSize: '0.65rem', color: col, fontWeight: 700,
                }}>✓</span>
              )}
              <div style={{ fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.2, color: '#111827' }}>
                {crop.name}
              </div>
              <div style={{
                fontSize: '0.62rem', marginTop: '3px',
                background: col + '20', color: col,
                borderRadius: '9999px', padding: '1px 6px',
                display: 'inline-block',
              }}>
                {crop.familyCommon}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Plan view ─────────────────────────────────────────────────────────────────

const TYPE_ICONS = {
  start_indoors: '🏡',
  plant_out:     '🌿',
  sow_direct:    '🌱',
  harvest:       '🧺',
  flowers:       '🌸',
};
const TYPE_LABELS = {
  start_indoors: 'Start indoors',
  plant_out:     'Plant out',
  sow_direct:    'Sow',
  harvest:       'Harvest',
  flowers:       'Flowers',
};

function PlanView({ plan, beds, onAccept, onBack }) {
  const noBeds = beds.filter(b => b.active).length === 0;

  // Group by month
  const grouped = useMemo(() => {
    const map = new Map();
    plan.forEach(item => {
      const d     = new Date(item.date + 'T12:00:00');
      const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      if (!map.has(key)) map.set(key, { key, label, items: [] });
      map.get(key).items.push(item);
    });
    return [...map.values()];
  }, [plan]);

  return (
    <div>
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

      {grouped.map(group => (
        <div key={group.key} style={{ marginBottom: '1.25rem' }}>
          <h3 style={{
            fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-400)',
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem',
          }}>
            {group.label}
          </h3>
          <div className="card" style={{ overflow: 'hidden' }}>
            {group.items.map((item, i) => {
              const crop = getCropById(item.cropId);
              const col  = crop ? getFamilyColor(crop.family) : '#6b7280';
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                  padding: '0.7rem 1rem',
                  borderBottom: i < group.items.length - 1 ? '1px solid var(--gray-100)' : 'none',
                }}>
                  <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: '2px' }}>
                    {TYPE_ICONS[item.type]}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.label}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)', marginTop: '0.1rem' }}>
                      {item.bed ? `${item.bed.name} · ` : ''}{formatPlanDate(item.date)}
                    </div>
                    {item.detail && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: '0.1rem', fontStyle: 'italic' }}>
                        {item.detail.endsWith('.') ? item.detail : item.detail + '.'}
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: '0.65rem', background: col + '18', color: col,
                    borderRadius: '9999px', padding: '2px 8px',
                    flexShrink: 0, alignSelf: 'center', whiteSpace: 'nowrap',
                  }}>
                    {TYPE_LABELS[item.type]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: '0.75rem', paddingBottom: '5rem' }}>
        <button className="btn btn-secondary" onClick={onBack}>← Change crops</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={onAccept}
          disabled={noBeds}>
          Add to my plan →
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Plan() {
  const { dispatch } = useApp();
  const beds         = useBeds();
  const navigate     = useNavigate();

  const [phase,    setPhase]    = useState('pick');
  const [selected, setSelected] = useState([]);

  const plan = useMemo(
    () => phase === 'review' ? generatePlan(selected, beds) : [],
    [phase, selected, beds]
  );

  function toggleCrop(cropId) {
    setSelected(s => s.includes(cropId) ? s.filter(id => id !== cropId) : [...s, cropId]);
  }

  function handleAccept() {
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
          bedId:                item.bed?.id || '',
          cropId:               item.cropId,
          variety:              '',
          sowDate:              item.date,
          transplantDate:       item.type === 'plant_out' ? item.date : null,
          expectedHarvestDate:  harvestItem?.date || null,
          status:               'planned',
          season:               CURRENT_YEAR,
        }});
      }
    });
    navigate('/');
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {phase === 'pick' ? 'Plan your season' : 'Your plan'}
          </h1>
          <p className="page-subtitle">
            {phase === 'pick'
              ? 'Pick what you want to grow'
              : `${selected.length} crop${selected.length !== 1 ? 's' : ''} · ${plan.length} tasks generated`}
          </p>
        </div>
      </div>

      {phase === 'pick' && (
        <>
          <CropPicker selected={selected} onToggle={toggleCrop} />

          {/* Sticky bottom bar when crops are selected */}
          {selected.length > 0 && (
            <div style={{
              position: 'sticky', bottom: '4rem', zIndex: 20,
              background: '#fff', borderTop: '1px solid var(--gray-200)',
              padding: '0.75rem 0', marginTop: '1.5rem',
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: '0.75rem',
            }}>
              <span className="text-sm text-muted">
                {selected.length} crop{selected.length !== 1 ? 's' : ''} selected
              </span>
              <button className="btn btn-primary" onClick={() => setPhase('review')}>
                Generate plan →
              </button>
            </div>
          )}
        </>
      )}

      {phase === 'review' && (
        <PlanView
          plan={plan}
          beds={beds}
          onAccept={handleAccept}
          onBack={() => setPhase('pick')}
        />
      )}
    </div>
  );
}
