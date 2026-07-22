import { Component, Input } from '@angular/core';
import { ValidationIssue } from '../../models/validation.models';
import { formulaTypeLabel, readableFormula, referenceMeaning } from '../../utils/formula-readable.util';

interface FormulaOption {
  issue: ValidationIssue;
  formula: string;
  label: string;
}

interface ReferenceInfo {
  raw: string;
  type: string;
  id: string;
  meaning: string;
}

@Component({
  selector: 'app-formula-translator',
  templateUrl: './formula-translator.component.html',
  styleUrls: ['./formula-translator.component.scss']
})
export class FormulaTranslatorComponent {
  @Input() issues: ValidationIssue[] = [];
  selectedIndex = 0;

  get formulaOptions(): FormulaOption[] {
    const seen = new Set<string>();
    return this.issues
      .reduce<FormulaOption[]>((options, issue) => {
        if (!issue.formula) {
          return options;
        }
        options.push({
          issue,
          formula: issue.formula,
          label: [this.entityTypeLabel(issue.entityType), issue.entityId, issue.entityName].filter(Boolean).join(' ') || issue.title
        });
        return options;
      }, [])
      .filter((option) => {
        const key = `${option.label}|${option.formula}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .slice(0, 20);
  }

  get selected(): FormulaOption | undefined {
    return this.formulaOptions[this.selectedIndex] ?? this.formulaOptions[0];
  }

  select(index: number): void {
    this.selectedIndex = index;
  }

  locationText(issue: ValidationIssue): string {
    const parts = [issue.sheet, issue.cell, issue.row ? `fila ${issue.row}` : undefined].filter(Boolean);
    return parts.length ? parts.join(' - ') : 'Workbook';
  }

  entityTypeLabel(entityType?: string): string {
    const labels: Record<string, string> = {
      CONCEPT: 'Concepto',
      AUXILIARY: 'Auxiliar',
      ACCUMULATOR: 'Acumulador',
      LEG_VARIABLE: 'Variable de legajo',
      CONVENTION: 'Convenio',
      WORKBOOK: 'Archivo'
    };
    return entityType ? labels[entityType] ?? entityType : '';
  }

  formulaTypeLabel(formula: string): string {
    return formulaTypeLabel(formula);
  }

  conciseLabel(option: FormulaOption): string {
    return option.label.replace(/\s+/g, ' ').trim();
  }

  readableFormula(formula: string, issue?: ValidationIssue): string {
    return readableFormula(formula, issue?.dependencyDetails);
  }

  referencesFor(option: FormulaOption): ReferenceInfo[] {
    const matches = [...option.formula.matchAll(/\b([NIARUL])\[(\d+)\]/g)];
    const unique = new Map<string, ReferenceInfo>();
    matches.forEach((match) => {
      const type = match[1];
      const id = match[2];
      const raw = `${type}[${id}]`;
      unique.set(raw, {
        raw,
        type,
        id,
        meaning: referenceMeaning(type, id, option.issue.dependencyDetails)
      });
    });
    return [...unique.values()];
  }
}
