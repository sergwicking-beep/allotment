import React, { useMemo, useState } from 'react';
import { useApp, useBeds, useHistory, useActiveAssignments } from '../store/AppContext';
import { getCropById, getFamilyColor, getFamilyBgColor } from '../data/crops';

// Rotation groups and recommended gap (years)
const ROTATION_RULES = {
  Brassica: { gap: 3, reason: 'Clubroot and brassica cyst nematode persist in soil for years.' },
  Potato:   { gap: 3, reason: 'Blight spores overwinter in soil; eelworm builds up quickly.' },
  Allium:   { gap: 3, reason: 'White rot fungus can persist in soil for 20+ years.' },
  Root:     { gap: 2, reason: 'Root-knot nematodes and canker build up in soil.' },
  Legume:   { gap: 2, reason: 'Soil-borne diseases (chocolate spot, fusarium) persist.' },
  Cucurbit: { gap: 2, reason: 'Cucumber mosaic virus and root rots.' },
  Perennial:{ gap: 99, reason: 'Perennial crops — do not rotate.' },
};

function getRotationGroup(cropId) {
  const crop = getCropById(cropId);
  return crop?.rotationGroup || 'Other';
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS_TO_SHOW = 4;

export default function Rotation() {
  const beds            = useBeds();
  const history         = useHistory();
  const activeAssignments = useActiveAssignments();
  const [selectedBed, setSelectedBed] = useState(null);

  // Build a lookup: bedId → year → [{ cropId, cropName, family, rotationGroup }]
  const bedYearMap = useMemo(() => {
    const map = {};

    // Historical entries (harvested)
    history.forEach(h => {
      if (!map[h.bedId]) map[h.bedId] = {};
      if (!map[h.bedId][h.year]) map[h.bedId][h.year] = [];
      map[h.bedId][h.year].push({
        cropId: h.cropId, cropName: h.cropName,
        family: h.family,
        rotationGroup: getRotationGroup(h.cropId),
        source: 'history',
      });
    });

    // Active assignments for current year
    activeAssignments.forEach(a => {
      const crop = getCropById(a.cropId);
      if (!crop) return;
      const year = a.season || CURRENT_YEAR;
      if (!map[a.bedId]) map[a.bedId] = {};
      if (!map[a.bedId][year]) map[a.bedId][year] = [];
      map[a.bedId][year].push({
        cropId: a.cropId, cropName: crop.name,
        family: crop.family,
        rotationGroup: crop.rotationGroup || 'Other',
        source: 'active',
      });
    });

    return map;
  }, [history, activeAssignments]);

  // Detect rotation warnings for active assignments
  const warnings = useMemo(() => {
    const ws = [];
    activeAssignments.forEach(a => {
      const crop = getCropById(a.cropId);
      if (!crop || crop.perennial) return;
      const rg = crop.rotationGroup || 'Other';
      const rule = ROTATION_RULES[rg];
      if (!rule || rule.gap >= 99) return;
      const currentYear = a.season || CURRENT_YEAR;
      const bedHistory = bedYearMap[a.bedId] || {};
      for (let y = currentYear - 1; y >= currentYear - rule.gap; y--) {
        const entries = bedHistory[y] || [];
        const clash = entries.find(e => e.rotationGroup === rg && e.source === 'history');
        if (clash) {
          const bed = beds.find(b => b.id === a.bedId);
          ws.push({
            id: a.id,
            cropName: crop.name,
            bedName: bed?.name || 'Unknown bed',
            rotationGroup: rg,
            clashYear: y,
            clashCrop: clash.cropName,
            requiredGap: rule.gap,
            reason: rule.reason,
          });
          break; // one warning per assignment is enough
        }
      }
    });
    return ws;
  }, [activeAssignments, bedYearMap, beds]);

  const years = Array.from({ length: YEARS_TO_SHOW }, (_, i) => CURRENT_YEAR - YEARS_TO_SHOW + 1 + i + 1);
  // e.g. [2023, 2024, 2025, 2026]
  const activeBeds = beds.filter(b => b.active);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Crop Rotation</h1>
          <p className="page-subtitle">
            {warnings.length > 0
              ? `${warnings.length} rotation warning${warnings.length > 1 ? 's' : ''}`
              : 'No rotation conflicts detected'}
          </p>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
          {warnings.map(w => (
            <div key={w.id} className="alert alert-warning">
              <span className="alert-icon">⚠️</span>
              <div className="alert-body">
                <div className="alert-title">
                  {w.cropName} in {w.bedName} — {w.rotationGroup} family conflict
                </div>
                <div className="alert-text">
                  {w.clashCrop} ({w.rotationGroup} family) was grown here in {w.clashYear}.
                  Recommended gap: {w.requiredGap} years. {w.reason}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rotation matrix */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Bed history by year</span>
          <span className="text-xs text-muted">
            {CURRENT_YEAR - YEARS_TO_SHOW + 1}–{CURRENT_YEAR}
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {activeBeds.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div className="empty-state-icon">🔄</div>
              <div className="empty-state-title">No beds yet</div>
              <div className="empty-state-text">Add beds and harvest crops to build a rotation history.</div>
            </div>
          ) : (
            <table className="rotation-table">
              <thead>
                <tr>
                  <th className="rot-bed-col">Bed</th>
                  {years.map(y => (
                    <th key={y} className={y === CURRENT_YEAR ? 'rot-year-col current' : 'rot-year-col'}>
                      {y}{y === CURRENT_YEAR ? ' ★' : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeBeds.map(bed => {
                  const bedData = bedYearMap[bed.id] || {};
                  return (
                    <tr key={bed.id} className="rot-row">
                      <td className="rot-bed-name">
                        <span className="rot-bed-dot" style={{ background: bed.color || '#52b788' }} />
                        {bed.name}
                      </td>
                      {years.map(y => {
                        const entries = bedData[y] || [];
                        if (entries.length === 0) {
                          return (
                            <td key={y} className="rot-cell empty">
                              <span className="text-xs text-muted">—</span>
                            </td>
                          );
                        }
                        return (
                          <td key={y} className="rot-cell">
                            <div className="rot-crops">
                              {entries.map((e, i) => {
                                const col = getFamilyColor(e.family);
                                return (
                                  <span key={i} className="rot-chip"
                                    style={{
                                      background: col + '22',
                                      color: col,
                                      border: `1px solid ${col}55`,
                                    }}>
                                    {e.cropName}
                                    {e.source === 'active' && ' ✦'}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="card-footer">
          <p className="text-xs text-muted">✦ currently in ground &nbsp;·&nbsp; History builds as you mark crops as harvested in the Planting Calendar.</p>
        </div>
      </div>

      {/* Rotation guide */}
      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="card-header">
          <span className="card-title">Rotation guide</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="rotation-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.6rem 1rem' }}>Group</th>
                <th style={{ textAlign: 'center', padding: '0.6rem 1rem' }}>Min. gap</th>
                <th style={{ padding: '0.6rem 1rem' }}>Why</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(ROTATION_RULES).filter(([g]) => g !== 'Perennial').map(([group, rule]) => (
                <tr key={group} className="rot-row">
                  <td style={{ padding: '0.6rem 1rem', fontWeight: 600, fontSize: '0.875rem' }}>
                    {group}
                  </td>
                  <td style={{ padding: '0.6rem 1rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                    {rule.gap} year{rule.gap !== 1 ? 's' : ''}
                  </td>
                  <td style={{ padding: '0.6rem 1rem', fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                    {rule.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
