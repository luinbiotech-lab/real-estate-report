import type { PropertyNextAction } from './propertyNextActionService';
import type { PropertyReadinessAssessment, ReadinessStage, ReadinessState } from './propertyReadinessService';
import type { Property } from '../types';

export type ReadinessWorklogStatus = 'open' | 'improved' | 'completed';

export interface ReadinessWorklogEntry {
  id: string;
  propertyId: string;
  propertyName: string;
  stageId: ReadinessStage['id'];
  stageLabel: string;
  initialState: Exclude<ReadinessState, 'ready'>;
  initialDetail: string;
  openedAt: string;
  lastObservedState: ReadinessState;
  lastObservedDetail: string;
  status: ReadinessWorklogStatus;
  progressedAt?: string;
}

const STORAGE_KEY = 'daon:property-readiness-worklog:v1';
const stateRank: Record<ReadinessState, number> = { missing: 0, partial: 1, ready: 2 };

function read(): ReadinessWorklogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as ReadinessWorklogEntry[] : [];
  } catch {
    return [];
  }
}

function write(rows: ReadinessWorklogEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, 200)));
}

function currentStage(rows: Array<{ property: Property; readiness: PropertyReadinessAssessment }>, entry: ReadinessWorklogEntry) {
  return rows.find((row) => row.property.id === entry.propertyId)?.readiness.stages.find((stage) => stage.id === entry.stageId);
}

export const propertyReadinessWorklogService = {
  recordOpened(action: PropertyNextAction) {
    const rows = read();
    const existing = rows.find((entry) => entry.id === action.id && entry.status === 'open');
    if (existing) return existing;
    const entry: ReadinessWorklogEntry = {
      id: action.id,
      propertyId: action.propertyId,
      propertyName: action.propertyName,
      stageId: action.stageId,
      stageLabel: action.stageLabel,
      initialState: action.state,
      initialDetail: action.detail,
      openedAt: new Date().toISOString(),
      lastObservedState: action.state,
      lastObservedDetail: action.detail,
      status: 'open',
    };
    write([entry, ...rows.filter((row) => row.id !== action.id || row.status !== 'open')]);
    return entry;
  },

  reconcile(rows: Array<{ property: Property; readiness: PropertyReadinessAssessment }>) {
    const now = new Date().toISOString();
    const reconciled = read().map((entry) => {
      const stage = currentStage(rows, entry);
      if (!stage) return entry;
      const improved = stateRank[stage.state] > stateRank[entry.initialState];
      const status: ReadinessWorklogStatus = stage.state === 'ready' ? 'completed' : improved ? 'improved' : 'open';
      return {
        ...entry,
        propertyName: rows.find((row) => row.property.id === entry.propertyId)?.property.name ?? entry.propertyName,
        lastObservedState: stage.state,
        lastObservedDetail: stage.detail,
        status,
        progressedAt: status !== 'open' ? entry.progressedAt ?? now : undefined,
      };
    });
    write(reconciled);
    return reconciled;
  },

  listRecentProgress(limit = 8) {
    return read()
      .filter((entry) => entry.status !== 'open')
      .sort((a, b) => (b.progressedAt ?? '').localeCompare(a.progressedAt ?? ''))
      .slice(0, limit);
  },

  listOpen() {
    return read().filter((entry) => entry.status === 'open').sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  },
};
