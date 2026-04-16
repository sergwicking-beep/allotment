import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CROPS, MONTHS, MONTH_NAMES,
  getAllFamilies, getFamilyColor, getFamilyBgColor, isSowableInMonth, getTransplantWindow,
} from '../data/crops';

function MonthBar({ start, end, altStart, altEnd, color }) {
  return (
    <div style={{ display: 'flex', gap: 2, height: 8 }}>
      {MONTHS.map((m, i) => {
        const mo = i + 1;
        const active =
          (start && end && (start <= end ? mo >= start && mo <= end : mo >= start || mo <= end)) ||
          (altStart && altEnd && (altStart <= altEnd ? mo >= altStart && mo <= altEnd : mo >= altStart || mo <= altEnd));
        return (
          <div
            key={m}
            title={MONTH_NAMES[i]}
            style={{
              flex: 1,
              borderRadius: 9999,
              background: active ? color : '#e5e7eb',
              opacity: active ? 1 : 0.4,
            }}
          />
        );
      })}
    </div>
  );
}

function PropBadge({ method }) {
  const map = { direct: '🌱 Direct', cold_frame: '🏡 Cold frame', both: '🌱🏡 Both' };
  return (
    <span style={{ fontSize: '0.7rem', background: '#f3f4f6', color: '#374151', borderRadius: 9999, padding: '2px 8px' }}>
      {map[method] || method}
    </span>
  );
}

const INDOOR_COLOR   = '#0891b2'; // teal for indoor/cold-frame sowing
const TRANSPLANT_COLOR = '#059669'; // green for planting out

function CropCard({ crop }) {
  const navigate = useNavigate();
  const color = getFamilyColor(crop.family);
  const bg    = getFamilyBgColor(crop.family);
  const currentMonth = new Date().getMonth() + 1;
  const nowSowable   = isSowableInMonth(crop, currentMonth);
  const transplant   = getTransplantWindow(crop);

  // Is this crop sowable indoors this month?
  const sowsIndoors = crop.propagation === 'cold_frame' || (crop.propagation === 'both' && crop.weeksInColdFrame);
  // Is the transplant window now?
  const transplantNow = transplant && (
    transplant.start <= transplant.end
      ? currentMonth >= transplant.start && currentMonth <= transplant.end
      : currentMonth >= transplant.start || currentMonth <= transplant.end
  );

  const labelW = 56; // px label column width

  return (
    <div
      onClick={() => navigate(`/crops/${crop.id}`)}
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderTop: `3px solid ${color}`,
        borderRadius: 8,
        padding: '0.9rem',
        cursor: 'pointer',
        transition: 'box-shadow 150ms',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.1)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Name row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>{crop.name}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end', flexShrink: 0 }}>
          {nowSowable && !crop.perennial && (
            <span style={{ fontSize: '0.63rem', background: sowsIndoors ? '#ecfeff' : '#d1fae5', color: sowsIndoors ? '#0e7490' : '#065f46', borderRadius: 9999, padding: '2px 7px', whiteSpace: 'nowrap', fontWeight: 600 }}>
              {sowsIndoors ? '🏡 Sow indoors ✓' : '🌱 Sow outdoors ✓'}
            </span>
          )}
          {transplantNow && (
            <span style={{ fontSize: '0.63rem', background: '#d1fae5', color: '#065f46', borderRadius: 9999, padding: '2px 7px', whiteSpace: 'nowrap', fontWeight: 600 }}>
              🌿 Plant out now ✓
            </span>
          )}
        </div>
      </div>

      {/* Family */}
      <span style={{ display: 'inline-block', background: bg, color, borderRadius: 9999, fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', alignSelf: 'flex-start' }}>
        {crop.family}
      </span>

      {/* Perennial notice OR month bars */}
      {crop.perennial ? (
        <p style={{ fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic' }}>🌿 Perennial — year-round bed occupant</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>

          {/* Sow indoors row (cold_frame or both crops) */}
          {sowsIndoors && crop.sowWindowStart && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem', color: '#6b7280' }}>
              <span style={{ width: labelW, flexShrink: 0, color: INDOOR_COLOR, fontWeight: 600 }}>🏡 Indoors</span>
              <div style={{ flex: 1 }}>
                <MonthBar start={crop.sowWindowStart} end={crop.sowWindowEnd} color={INDOOR_COLOR} />
              </div>
            </div>
          )}

          {/* Transplant row */}
          {transplant && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem', color: '#6b7280' }}>
              <span style={{ width: labelW, flexShrink: 0, color: TRANSPLANT_COLOR, fontWeight: 600 }}>🌿 Plant out</span>
              <div style={{ flex: 1 }}>
                <MonthBar start={transplant.start} end={transplant.end} color={TRANSPLANT_COLOR} />
              </div>
            </div>
          )}

          {/* Direct sow outdoors row */}
          {(crop.propagation === 'direct' || crop.propagation === 'both') && crop.sowWindowStart && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem', color: '#6b7280' }}>
              <span style={{ width: labelW, flexShrink: 0, color: color, fontWeight: 600 }}>🌱 Direct</span>
              <div style={{ flex: 1 }}>
                <MonthBar
                  start={crop.sowWindowStart} end={crop.sowWindowEnd}
                  altStart={crop.alternateSowStart} altEnd={crop.alternateSowEnd}
                  color={color}
                />
              </div>
            </div>
          )}

          {/* Harvest row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem', color: '#6b7280' }}>
            <span style={{ width: labelW, flexShrink: 0 }}>Harvest</span>
            <div style={{ flex: 1 }}>
              <MonthBar start={crop.harvestWindowStart} end={crop.harvestWindowEnd} color="#d97706" />
            </div>
          </div>
        </div>
      )}

      {/* Footer badges */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 'auto' }}>
        <PropBadge method={crop.propagation} />
        {crop.spacingCm && (
          <span style={{ fontSize: '0.7rem', background: '#f3f4f6', color: '#374151', borderRadius: 9999, padding: '2px 8px' }}>
            {crop.spacingCm} cm
          </span>
        )}
      </div>
    </div>
  );
}

export default function CropBrowser() {
  const [search, setSearch]       = useState('');
  const [familyF, setFamilyF]     = useState('');
  const [monthF, setMonthF]       = useState('');
  const [propF, setPropF]         = useState('');

  const families = getAllFamilies();
  const currentMonth = new Date().getMonth() + 1;

  const filtered = useMemo(() => CROPS.filter(crop => {
    if (search && !crop.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (familyF && crop.family !== familyF) return false;
    if (monthF && !isSowableInMonth(crop, parseInt(monthF))) return false;
    if (propF && crop.propagation !== propF) return false;
    return true;
  }), [search, familyF, monthF, propF]);

  const hasFilters = search || familyF || monthF || propF;
  const clear = () => { setSearch(''); setFamilyF(''); setMonthF(''); setPropF(''); };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Crop Browser</h1>
          <p className="page-subtitle">{filtered.length} of {CROPS.length} crops</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card" style={{ padding: '0.875rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <input
            className="form-control"
            style={{ flex: '1 1 160px', minWidth: 0 }}
            placeholder="🔍  Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="form-control" style={{ flex: '0 1 auto' }} value={monthF} onChange={e => setMonthF(e.target.value)}>
            <option value="">All months</option>
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}{i + 1 === currentMonth ? ' ← now' : ''}
              </option>
            ))}
          </select>
          <select className="form-control" style={{ flex: '0 1 auto' }} value={familyF} onChange={e => setFamilyF(e.target.value)}>
            <option value="">All families</option>
            {families.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select className="form-control" style={{ flex: '0 1 auto' }} value={propF} onChange={e => setPropF(e.target.value)}>
            <option value="">Any method</option>
            <option value="direct">Direct sow</option>
            <option value="cold_frame">Cold frame</option>
            <option value="both">Both</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            style={monthF === String(currentMonth) ? { background: '#d1fae5', borderColor: '#6ee7b7', color: '#065f46' } : {}}
            onClick={() => monthF === String(currentMonth) ? setMonthF('') : setMonthF(String(currentMonth))}
          >
            🌱 Sow this month ({MONTH_NAMES[currentMonth - 1]})
          </button>
          {hasFilters && (
            <button className="btn btn-ghost btn-sm" onClick={clear}>✕ Clear filters</button>
          )}
        </div>
      </div>

      {/* Family legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
        {families.map(f => (
          <button
            key={f}
            onClick={() => setFamilyF(familyF === f ? '' : f)}
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: 9999,
              border: 'none',
              cursor: 'pointer',
              background: familyF === f ? getFamilyColor(f) : getFamilyBgColor(f),
              color: familyF === f ? '#fff' : getFamilyColor(f),
              transition: 'all 150ms',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">No crops match</div>
          <button className="btn btn-ghost" onClick={clear}>Clear filters</button>
        </div>
      ) : (
        <div className="grid-3">
          {filtered.map(crop => <CropCard key={crop.id} crop={crop} />)}
        </div>
      )}
    </div>
  );
}
