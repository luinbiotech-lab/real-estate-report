import type { Property } from '../types';
import type { PropertyReadinessAssessment, ReadinessStage, ReadinessState } from './propertyReadinessService';

export interface PropertyNextAction {
  id: string;
  propertyId: string;
  propertyName: string;
  stageId: ReadinessStage['id'];
  stageLabel: string;
  state: Exclude<ReadinessState, 'ready'>;
  detail: string;
  path: string;
  workflowOrder: number;
}

const STAGE_ORDER: Record<ReadinessStage['id'], number> = {
  core: 1,
  documents: 2,
  provenance: 3,
  verification: 4,
  media: 5,
  report: 6,
  digital_twin: 7,
};

function actionPath(propertyId: string, stage: ReadinessStage) {
  if (stage.id === 'core') return `/property/${propertyId}/edit`;
  return `/property/${propertyId}/data-room${stage.pathSuffix || ''}`;
}

export function derivePropertyNextActions(rows: Array<{ property: Property; readiness: PropertyReadinessAssessment }>): PropertyNextAction[] {
  return rows.flatMap(({ property, readiness }) => readiness.stages
    .filter((stage): stage is ReadinessStage & { state: 'missing' | 'partial' } => stage.state !== 'ready')
    .map((stage) => ({
      id: `${property.id}:${stage.id}`,
      propertyId: property.id,
      propertyName: property.name,
      stageId: stage.id,
      stageLabel: stage.label,
      state: stage.state,
      detail: stage.detail,
      path: actionPath(property.id, stage),
      workflowOrder: STAGE_ORDER[stage.id],
    })))
    .sort((left, right) => {
      const stateOrder = (left.state === 'missing' ? 0 : 1) - (right.state === 'missing' ? 0 : 1);
      if (stateOrder !== 0) return stateOrder;
      const workflowOrder = left.workflowOrder - right.workflowOrder;
      if (workflowOrder !== 0) return workflowOrder;
      return left.propertyName.localeCompare(right.propertyName, 'ko');
    });
}
