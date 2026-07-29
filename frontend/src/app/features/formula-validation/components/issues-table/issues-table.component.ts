import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { IssueDetailDialogComponent } from '../../dialogs/issue-detail-dialog.component';
import { ValidationIssue } from '../../models/validation.models';

interface IssueSectionDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
}

interface IssueSection extends IssueSectionDefinition {
  issues: ValidationIssue[];
}

@Component({
  selector: 'app-issues-table',
  templateUrl: './issues-table.component.html',
  styleUrls: ['./issues-table.component.scss']
})
export class IssuesTableComponent implements OnChanges {
  @Input() issues: ValidationIssue[] = [];
  @Input() validationId?: string;

  private readonly dialog = inject(MatDialog);

  readonly sectionDefinitions: IssueSectionDefinition[] = [
    {
      id: 'excel',
      title: 'Errores del Excel',
      description: 'Problemas de estructura, hojas, columnas, encabezados o formato del archivo.',
      icon: 'table_chart'
    },
    {
      id: 'formulas',
      title: 'Errores de formulas',
      description: 'Sintaxis, condiciones, tipos, orden de calculo o dependencias circulares.',
      icon: 'functions'
    },
    {
      id: 'functional',
      title: 'Auditoria funcional del PDF',
      description: 'Controles de unidad, totaliza, secuencia, pre/post formula, auxiliares y acumuladores segun el manual.',
      icon: 'rule_folder'
    },
    {
      id: 'references',
      title: 'Referencias no encontradas',
      description: 'Conceptos, auxiliares o variables que una formula usa pero no existen en las tablas.',
      icon: 'link_off'
    },
    {
      id: 'data',
      title: 'Errores de carga de datos',
      description: 'Filas incompletas, identificadores invalidos, nombres faltantes o datos mal cargados.',
      icon: 'edit_note'
    },
    {
      id: 'support',
      title: 'Controles de soporte',
      description: 'Problemas propios de calculos de soporte, acumulaciones y operaciones relacionadas.',
      icon: 'account_tree'
    },
    {
      id: 'duplicates',
      title: 'Duplicados y conflictos',
      description: 'Registros repetidos, duplicados iguales o definiciones contradictorias.',
      icon: 'content_copy'
    },
    {
      id: 'other',
      title: 'Otros controles',
      description: 'Hallazgos que no entran en las zonas anteriores.',
      icon: 'rule'
    }
  ];

  filteredIssues: ValidationIssue[] = [];
  sections: IssueSection[] = this.emptySections();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['issues']) {
      this.filteredIssues = this.issues;
      this.sections = this.groupIssues(this.filteredIssues);
    }
  }

  openDetail(issue: ValidationIssue): void {
    this.dialog.open(IssueDetailDialogComponent, {
      width: '760px',
      maxWidth: '94vw',
      data: {
        issue,
        validationId: this.validationId
      }
    });
  }

  entityLabel(issue: ValidationIssue): string {
    return [this.entityTypeLabel(issue.entityType), issue.entityId, issue.entityName].filter(Boolean).join(' ');
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

  get visibleSections(): IssueSection[] {
    return this.sections.filter((section) => section.issues.length > 0);
  }

  trackSection = (_index: number, section: IssueSection): string => section.id;

  trackIssue = (_index: number, issue: ValidationIssue): string => issue.id;

  sectionTotal(sectionId: string): number {
    return this.sections.find((section) => section.id === sectionId)?.issues.length ?? 0;
  }

  columnLabel(issue: ValidationIssue): string {
    return issue.column || this.columnFromCell(issue.cell) || '-';
  }

  locationBreadcrumb(issue: ValidationIssue): string {
    return [
      issue.sheet || 'Tabla no informada',
      `Columna ${this.columnLabel(issue)}`,
      issue.row ? `Fila ${issue.row}` : undefined
    ]
      .filter(Boolean)
      .join(' > ');
  }

  isDuplicateIssue(issue: ValidationIssue): boolean {
    return issue.code === 'DUPLICATE_IDENTICAL' || issue.code === 'DUPLICATE_CONFLICT' || issue.category === 'DUPLICATES';
  }

  duplicateRowsLabel(issue: ValidationIssue): string {
    const rows = (issue.relatedLocations ?? [])
      .map((location) => location.row)
      .filter((row): row is number => typeof row === 'number');
    const uniqueRows = [...new Set(rows)];
    if (uniqueRows.length === 0 && issue.row) {
      uniqueRows.push(issue.row);
    }
    return uniqueRows.join(', ');
  }

  duplicateCountLabel(issue: ValidationIssue): string {
    const count = (issue.relatedLocations?.length ?? 0) || (issue.row ? 1 : 0);
    return `${count} ${count === 1 ? 'registro' : 'registros'}`;
  }

  private emptySections(): IssueSection[] {
    return this.sectionDefinitions.map((definition) => ({ ...definition, issues: [] }));
  }

  private groupIssues(issues: ValidationIssue[]): IssueSection[] {
    const grouped = new Map(this.sectionDefinitions.map((definition) => [definition.id, [] as ValidationIssue[]]));
    issues.forEach((issue) => {
      const sectionId = this.resolveSection(issue);
      grouped.get(sectionId)?.push(issue);
    });
    return this.sectionDefinitions.map((definition) => ({
      ...definition,
      issues: grouped.get(definition.id) ?? []
    }));
  }

  private resolveSection(issue: ValidationIssue): string {
    const code = issue.code;
    const category = issue.category;

    if (code === 'DUPLICATE_IDENTICAL' || code === 'DUPLICATE_CONFLICT' || category === 'DUPLICATES') {
      return 'duplicates';
    }

    if (
      code === 'MISSING_AUXILIARY_REFERENCE' ||
      code === 'MISSING_CONCEPT_REFERENCE' ||
      code === 'MISSING_LEG_VARIABLE_REFERENCE' ||
      category === 'REFERENCES'
    ) {
      return 'references';
    }

    if (
      category === 'FUNCTIONAL_AUDIT' ||
      code === 'FORMULA_TEXT_IN_CALCULATION_COLUMN' ||
      code === 'CALCULATION_ORDER_REVIEW' ||
      code === 'UNIT_USES_AMOUNT_REFERENCE' ||
      code === 'CONDITION_USES_RESULT_REFERENCE' ||
      code === 'TOTALIZES_VALUE_INVALID' ||
      code === 'PRE_POST_WITHOUT_MAIN_FORMULA' ||
      code === 'AUXILIARY_VALUE_MISSING' ||
      code === 'AUXILIARY_VALUE_HAS_FORMULA' ||
      code === 'AUXILIARY_ACCUMULATOR_HAS_FORMULA' ||
      code === 'AUXILIARY_FORMULA_HAS_ACCUMULATOR_COMPONENTS' ||
      code === 'ACCUMULATOR_CONCEPT_NAME_MISMATCH' ||
      code === 'ACCUMULATOR_CONTRADICTORY_OPERATION'
    ) {
      return 'functional';
    }

    if (
      category.startsWith('FORMULA') ||
      category === 'FORMULA_TYPE' ||
      code === 'INVALID_FORMULA_SYNTAX' ||
      code === 'INVALID_CONDITION_TYPE' ||
      code === 'INVALID_FORMULA_TYPE' ||
      code === 'FORMULA_TYPE_MISMATCH' ||
      code === 'INCOMPLETE_CONDITIONAL_FORMULA' ||
      code === 'FORMULA_SCOPE_MISMATCH' ||
      code === 'CIRCULAR_DEPENDENCY' ||
      code === 'SELF_REFERENCE'
    ) {
      return 'formulas';
    }

    if (
      category === 'AUXILIARIES' ||
      category === 'ACCUMULATORS' ||
      issue.entityType === 'AUXILIARY' ||
      issue.entityType === 'ACCUMULATOR' ||
      code === 'INVALID_AUXILIARY_ROW' ||
      code === 'INVALID_ACCUMULATOR_ROW' ||
      code === 'MISSING_ACCUMULATOR_ID'
    ) {
      return 'support';
    }

    if (
      category === 'WORKBOOK_STRUCTURE' ||
      category === 'CATALOGS' ||
      code === 'INVALID_WORKBOOK' ||
      code === 'MISSING_REQUIRED_SHEET' ||
      code === 'MISSING_REQUIRED_COLUMN' ||
      code === 'DUPLICATE_HEADER' ||
      code === 'UNKNOWN_COLUMN' ||
      code === 'SCHEMA_DRIFT'
    ) {
      return 'excel';
    }

    if (
      code === 'INVALID_ROW' ||
      code === 'INVALID_IDENTIFIER' ||
      code === 'MISSING_NAME' ||
      code === 'INVALID_DATA_TYPE'
    ) {
      return 'data';
    }

    return 'other';
  }

  private columnFromCell(cell?: string): string {
    const match = /^([A-Z]+)/i.exec(cell ?? '');
    return match?.[1]?.toUpperCase() ?? '';
  }
}
