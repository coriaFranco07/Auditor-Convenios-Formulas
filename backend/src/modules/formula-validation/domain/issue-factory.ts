import { randomUUID } from 'node:crypto';
import {
  AiIssueExplanation,
  DependencyNodeDetail,
  ReplacementSuggestion,
  ValidationIssue,
  ValidationSeverity,
} from '../types/validation.types';
import { CellLocation, EntityType } from '../types/workbook.types';

export interface IssueInput {
  code: string;
  severity: ValidationSeverity;
  category: string;
  title: string;
  message: string;
  explanation: string;
  recommendation?: string;
  location?: CellLocation;
  entityType?: EntityType;
  entityId?: number | string;
  entityName?: string;
  formula?: string;
  invalidFragment?: string;
  referenceType?: 'N' | 'I' | 'A' | 'R' | 'U' | 'L';
  referenceId?: number;
  dependencyPath?: string[];
  dependencyDetails?: DependencyNodeDetail[];
  aiExplanation?: AiIssueExplanation;
  replacementSuggestions?: ReplacementSuggestion[];
  relatedLocations?: CellLocation[];
  blocksImport?: boolean;
}

export const createIssue = (input: IssueInput): ValidationIssue => ({
  id: randomUUID(),
  code: input.code,
  severity: input.severity,
  category: input.category,
  title: input.title,
  message: input.message,
  explanation: input.explanation,
  recommendation: input.recommendation,
  sheet: input.location?.sheet,
  row: input.location?.row,
  column: input.location?.column,
  cell: input.location?.cell,
  entityType: input.entityType,
  entityId: input.entityId,
  entityName: input.entityName,
  formula: input.formula,
  invalidFragment: input.invalidFragment,
  referenceType: input.referenceType,
  referenceId: input.referenceId,
  dependencyPath: input.dependencyPath,
  dependencyDetails: input.dependencyDetails,
  aiExplanation: input.aiExplanation,
  replacementSuggestions: input.replacementSuggestions,
  relatedLocations: input.relatedLocations,
  blocksImport: input.blocksImport ?? input.severity === 'CRITICAL',
});
