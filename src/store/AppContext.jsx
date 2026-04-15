import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { getCropById } from '../data/crops';

const AppContext = createContext(null);

const STORAGE_KEY = 'allotment_v1';

const initialState = {
  beds: [],
  assignments: [],
  coldFrameEntries: [],
  seedStock: [],
  history: [],
  settings: {
    claudeApiKey: '',
    claudeModel: 'claude-sonnet-4-6',
  },
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const saved = JSON.parse(raw);
    return { ...initialState, ...saved };
  } catch {
    return initialState;
  }
}

function reducer(state, action) {
  switch (action.type) {

    // ── Beds ──────────────────────────────────────────────────────────────────
    case 'ADD_BED': {
      const bed = {
        id: uid(),
        name: 'New Bed',
        widthM: 1.2,
        lengthM: 3,
        active: true,
        notes: '',
        color: null,
        gridX: 1,
        gridY: 1,
        createdAt: new Date().toISOString(),
        ...action.payload,
      };
      return { ...state, beds: [...state.beds, bed] };
    }
    case 'UPDATE_BED': {
      return {
        ...state,
        beds: state.beds.map(b => b.id === action.payload.id ? { ...b, ...action.payload } : b),
      };
    }
    case 'DELETE_BED': {
      return {
        ...state,
        beds: state.beds.filter(b => b.id !== action.payload.id),
        assignments: state.assignments.filter(a => a.bedId !== action.payload.id),
      };
    }

    // ── Assignments ───────────────────────────────────────────────────────────
    case 'ADD_ASSIGNMENT': {
      const a = {
        id: uid(),
        bedId: '',
        cropId: '',
        variety: '',
        sowDate: '',
        transplantDate: null,
        expectedHarvestDate: null,
        status: 'planned',
        successionIntervalWeeks: null,
        yieldRating: null,
        yieldNotes: '',
        season: new Date().getFullYear(),
        createdAt: new Date().toISOString(),
        ...action.payload,
      };
      return { ...state, assignments: [...state.assignments, a] };
    }
    case 'UPDATE_ASSIGNMENT': {
      return {
        ...state,
        assignments: state.assignments.map(a =>
          a.id === action.payload.id ? { ...a, ...action.payload } : a
        ),
      };
    }
    case 'DELETE_ASSIGNMENT': {
      return {
        ...state,
        assignments: state.assignments.filter(a => a.id !== action.payload.id),
      };
    }
    case 'HARVEST_ASSIGNMENT': {
      const assignment = state.assignments.find(a => a.id === action.payload.id);
      if (!assignment) return state;
      const crop = getCropById(assignment.cropId);
      const historyEntry = {
        id: uid(),
        year: assignment.season,
        bedId: assignment.bedId,
        cropId: assignment.cropId,
        cropName: crop ? crop.name : assignment.cropId,
        family: crop ? crop.family : '',
        harvestedAt: new Date().toISOString(),
      };
      return {
        ...state,
        assignments: state.assignments.map(a =>
          a.id === action.payload.id
            ? { ...a, status: 'harvested', yieldRating: action.payload.yieldRating ?? a.yieldRating, yieldNotes: action.payload.yieldNotes ?? a.yieldNotes }
            : a
        ),
        history: [...state.history, historyEntry],
      };
    }

    // ── Cold Frame ────────────────────────────────────────────────────────────
    case 'ADD_COLD_FRAME_ENTRY': {
      const entry = {
        id: uid(),
        cropId: '',
        variety: '',
        sowDate: '',
        stage: 'just_sown',
        notes: '',
        createdAt: new Date().toISOString(),
        ...action.payload,
      };
      return { ...state, coldFrameEntries: [...state.coldFrameEntries, entry] };
    }
    case 'UPDATE_COLD_FRAME_ENTRY': {
      return {
        ...state,
        coldFrameEntries: state.coldFrameEntries.map(e =>
          e.id === action.payload.id ? { ...e, ...action.payload } : e
        ),
      };
    }
    case 'DELETE_COLD_FRAME_ENTRY': {
      return {
        ...state,
        coldFrameEntries: state.coldFrameEntries.filter(e => e.id !== action.payload.id),
      };
    }

    // ── Seed Stock ────────────────────────────────────────────────────────────
    case 'ADD_SEED': {
      const seed = {
        id: uid(),
        cropId: '',
        variety: '',
        quantity: 'full',
        expiryYear: new Date().getFullYear() + 2,
        notes: '',
        ...action.payload,
      };
      return { ...state, seedStock: [...state.seedStock, seed] };
    }
    case 'UPDATE_SEED': {
      return {
        ...state,
        seedStock: state.seedStock.map(s =>
          s.id === action.payload.id ? { ...s, ...action.payload } : s
        ),
      };
    }
    case 'DELETE_SEED': {
      return {
        ...state,
        seedStock: state.seedStock.filter(s => s.id !== action.payload.id),
      };
    }

    // ── Settings ──────────────────────────────────────────────────────────────
    case 'UPDATE_SETTINGS': {
      return { ...state, settings: { ...state.settings, ...action.payload } };
    }

    // ── Data import ───────────────────────────────────────────────────────────
    case 'IMPORT_DATA': {
      return { ...initialState, ...action.payload };
    }

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

// ── Selector helpers ──────────────────────────────────────────────────────────

export function useBeds() {
  const { state } = useApp();
  return state.beds;
}

export function useAssignments() {
  const { state } = useApp();
  return state.assignments;
}

export function useActiveAssignments() {
  const { state } = useApp();
  return state.assignments.filter(a => a.status !== 'harvested');
}

export function useBedAssignments(bedId) {
  const { state } = useApp();
  return state.assignments.filter(a => a.bedId === bedId && a.status !== 'harvested');
}

export function useColdFrameEntries() {
  const { state } = useApp();
  return state.coldFrameEntries;
}

export function useSeedStock() {
  const { state } = useApp();
  return state.seedStock;
}

export function useHistory() {
  const { state } = useApp();
  return state.history;
}

export function useSettings() {
  const { state } = useApp();
  return state.settings;
}

// Returns whether a given family was grown in a bed in a given year
export function wasGrownInBed(history, bedId, family, year) {
  return history.some(h => h.bedId === bedId && h.family === family && h.year === year);
}

// Returns seed stock entry for a crop (first match)
export function seedStockForCrop(seedStock, cropId) {
  return seedStock.filter(s => s.cropId === cropId);
}

export function exportData(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `allotment-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
