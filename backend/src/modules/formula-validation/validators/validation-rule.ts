import { ValidationIssue } from '../types/validation.types';
import { WorkbookContext } from '../types/workbook.types';

export interface ValidationRule {
  validate(context: WorkbookContext): ValidationIssue[];
}

