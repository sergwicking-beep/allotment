import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getCropById, getFamilyColor, getFamilyBgColor,
  MONTHS, MONTH_NAMES, isSowableInMonth,
} from '../data/crops';
import { useApp } from '../store/AppContext';

function MonthBar({ start, end, altStart, altEnd, color, height = 16 }) {
  return (
    <div style={{ display: 'flex', gap: 3, height }}>
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
              borderRadius: 4,
              background: active ? color : '#e5e7eb',
              opacity: active ? 1 : 0.35,
            }}
          />
        );
      })}
    </div>
  );
}

function MonthLabels() {
  return (
    <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
      {MONTHS.map(m => (
        <div key={m} style={{ flex: 1, fontSize: '0.58rem', color: '#9ca3af', textAlign: 'center' }}>{m}</div>
      ))}
    </div>
  );
}

function Stat({ label, value, unit }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.6rem 0.75rem', textAlign: 'center' }}>
      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#111827' }}>
        {value}
        {unit && <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 400, marginLeft: 2 }}>{unit}</span>}
      </div>
      <div style={{ fontSize: '0.65rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Stars({ n }) {
  return (
    <span style={{ color: '#f59e0b', fontSize: '1.1rem' }}>
      {'★'.repeat(n)}{'☆'.repeat(5 - n)}
    </span>
  );
}

export default function CropDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useApp();
  const crop = getCropById(id);

  if (!crop) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">❓</div>
        <div className="empty-state-title">Crop not found</div>
        <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => navigate('/crops')}>
          ← Back to crops
        </button>
      </div>
    );
  }

  const color = getFamilyColor(crop.family);
  const bg    = getFamilyBgColor(crop.family);
  const nowSowable = isSowableInMonth(crop, new Date().getMonth() + 1);
  const harvestedWithNotes = state.assignments.filter(a => a.cropId === crop.id && a.status === 'harvested' && a.yieldRating);
  const seeds = state.seedStock.filter(s => s.cropId === crop.id);

  const propLabel = { direct: 'Direct sow only', cold_frame: 'Under cover / cold frame', both: 'Direct sow or under cover' };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/crops')} style={{ marginBottom: '1rem' }}>
        ← Back to crop browser
      </button>

      {/* ── Hero ─────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1rem', borderTop: `4px solid ${color}` }}>
        <div className="card-body">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#111827', marginBottom: 8 }}>{crop.name}</h1>
              <span style={{ display: 'inline-block', background: bg, color, borderRadius: 9999, fontSize: '0.78rem', fontWeight: 600, padding: '3px 12px' }}>
                {crop.family} — {crop.familyCommon}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {crop.perennial && (
                <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: 9999, fontSize: '0.75rem', fontWeight: 600, padding: '4px 12px' }}>🌿 Perennial</span>
              )}
              {crop.bush && (
                <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 9999, fontSize: '0.75rem', fontWeight: 600, padding: '4px 12px' }}>Bush crop</span>
              )}
              {!crop.perennial && nowSowable && (
                <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: 9999, fontSize: '0.75rem', fontWeight: 600, padding: '4px 12px' }}>✅ Sow now</span>
              )}
            </div>
          </div>

          {crop.description && (
            <p style={{ marginTop: '0.75rem', color: '#4b5563', lineHeight: 1.65 }}>{crop.description}</p>
          )}

          {/* Rotation group */}
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              Rotation group: <strong style={{ color: '#374151' }}>{crop.rotationGroup}</strong>
            </span>
            {seeds.map(s => (
              <span key={s.id} style={{ fontSize: '0.75rem', background: '#eff6ff', color: '#1d4ed8', borderRadius: 9999, padding: '2px 10px', fontWeight: 600 }}>
                🌱 Seeds in stock{s.variety ? ` (${s.variety})` : ''} — {s.quantity}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats grid ───────────────────────────────── */}
      {!crop.perennial && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
          <Stat label="Germination" value={crop.daysToGermination} unit="days" />
          <Stat label="Spacing" value={crop.spacingCm} unit="cm" />
          <Stat label="Sow depth" value={crop.depthCm} unit="cm" />
          <Stat label="Min soil °C" value={crop.minSoilTempC} unit="°C" />
          <Stat label="Degree days" value={crop.degreesDaysToHarvest} unit="°d" />
          {crop.weeksInColdFrame && <Stat label="Weeks in frame" value={crop.weeksInColdFrame} unit="wks" />}
        </div>
      )}

      {/* ── Calendar ─────────────────────────────────── */}
      {!crop.perennial && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header"><span className="card-title">📅 Growing calendar</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Sow window
              </div>
              <MonthBar start={crop.sowWindowStart} end={crop.sowWindowEnd} altStart={crop.alternateSowStart} altEnd={crop.alternateSowEnd} color={color} />
              <MonthLabels />
              {crop.alternateSowStart && (
                <p style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 4 }}>
                  Primary: {MONTH_NAMES[crop.sowWindowStart - 1]}–{MONTH_NAMES[crop.sowWindowEnd - 1]}
                  {' · '}Alternate sowing: {MONTH_NAMES[crop.alternateSowStart - 1]}–{MONTH_NAMES[crop.alternateSowEnd - 1]}
                </p>
              )}
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Harvest window
              </div>
              <MonthBar start={crop.harvestWindowStart} end={crop.harvestWindowEnd} color="#d97706" />
              <MonthLabels />
            </div>
          </div>
        </div>
      )}

      {/* ── Propagation ──────────────────────────────── */}
      {crop.propagationNotes && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">
            <span className="card-title">🌱 Propagation</span>
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{propLabel[crop.propagation]}</span>
          </div>
          <div className="card-body">
            <p style={{ color: '#374151', lineHeight: 1.7 }}>{crop.propagationNotes}</p>
          </div>
        </div>
      )}

      {/* ── Cold frame ───────────────────────────────── */}
      {crop.coldFrameNotes && (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: '3px solid #0891b2' }}>
          <div className="card-header"><span className="card-title">🏡 Cold frame guidance</span></div>
          <div className="card-body">
            <p style={{ color: '#374151', lineHeight: 1.7 }}>{crop.coldFrameNotes}</p>
          </div>
        </div>
      )}

      {/* ── Yield history ────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header"><span className="card-title">⭐ Your yield history</span></div>
        <div className="card-body">
          {harvestedWithNotes.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No harvests recorded yet. Mark crops as harvested in the Calendar to build your history.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {harvestedWithNotes.map(a => (
                <div key={a.id} style={{ paddingBottom: '0.75rem', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Stars n={a.yieldRating} />
                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                      {a.season}{a.variety ? ` · ${a.variety}` : ''}
                    </span>
                  </div>
                  {a.yieldNotes && <p style={{ fontSize: '0.875rem', color: '#374151' }}>{a.yieldNotes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Actions ──────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingBottom: '1rem' }}>
        <Link to="/calendar" className="btn btn-primary">📅 Add to planting plan</Link>
        {crop.coldFrameNotes && <Link to="/cold-frame" className="btn btn-secondary">🏡 Log in cold frame</Link>}
        <Link to="/seeds" className="btn btn-secondary">🌱 Add to seed stock</Link>
      </div>
    </div>
  );
}
