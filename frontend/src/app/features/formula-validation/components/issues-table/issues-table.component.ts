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
  issues: IssueTableRow[];
}

interface IssueTableRow {
  id: string;
  issue: ValidationIssue;
  issues: ValidationIssue[];
  columns: string[];
  columnLabel: string;
  message: string;
  recommendation?: string;
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
      description: 'Controles de unidad, totaliza, pre/post formula y auxiliares segun el manual.',
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
      description: 'Problemas propios de calculos auxiliares usados por las formulas.',
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
      this.sections = this.groupIssues(this.mergeEquivalentIssues(this.filteredIssues));
    }
  }

  openDetail(row: IssueTableRow): void {
    this.dialog.open(IssueDetailDialogComponent, {
      width: '760px',
      maxWidth: '94vw',
      data: {
        issue: this.detailIssue(row),
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

  trackIssue = (_index: number, row: IssueTableRow): string => row.id;

  locationBreadcrumb(row: IssueTableRow): string {
    return [
      row.issue.sheet || 'Tabla no informada',
      `${row.columns.length > 1 ? 'Columnas' : 'Columna'} ${row.columnLabel}`,
      row.issue.row ? `Fila ${row.issue.row}` : undefined
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

  private groupIssues(rows: IssueTableRow[]): IssueSection[] {
    const grouped = new Map(this.sectionDefinitions.map((definition) => [definition.id, [] as IssueTableRow[]]));
    rows.forEach((row) => {
      const sectionId = this.resolveSection(row.issue);
      grouped.get(sectionId)?.push(row);
    });
    return this.sectionDefinitions.map((definition) => ({
      ...definition,
      issues: grouped.get(definition.id) ?? []
    }));
  }

  private mergeEquivalentIssues(issues: ValidationIssue[]): IssueTableRow[] {
    const groups = new Map<string, IssueTableRow>();

    issues.forEach((issue) => {
      const key = this.issueGroupKey(issue);
      const column = this.issueColumnLabel(issue);
      const existing = groups.get(key);

      if (existing) {
        existing.issues.push(issue);
        existing.columns = this.mergeColumns(existing.columns, column);
        existing.columnLabel = this.columnListLabel(existing.columns);
        existing.message = this.messageLabel(existing);
        existing.recommendation = this.recommendationLabel(existing);
        return;
      }

      const columns = column && column !== '-' ? [column] : [];
      const row: IssueTableRow = {
        id: key,
        issue,
        issues: [issue],
        columns,
        columnLabel: this.columnListLabel(columns) || '-',
        message: issue.message,
        recommendation: issue.recommendation
      };
      row.message = this.messageLabel(row);
      row.recommendation = this.recommendationLabel(row);
      groups.set(key, row);
    });

    return Array.from(groups.values());
  }

  private issueGroupKey(issue: ValidationIssue): string {
    if (this.isMissingReferenceIssue(issue)) {
      return [
        issue.category,
        issue.code,
        issue.severity,
        issue.sheet ?? '',
        issue.row ?? '',
        issue.entityType ?? '',
        issue.entityId ?? '',
        issue.entityName ?? '',
        issue.formula ?? '',
        issue.blocksImport ? '1' : '0'
      ].join('\u001f');
    }

    return [
      issue.code,
      issue.category,
      issue.severity,
      issue.sheet ?? '',
      issue.row ?? '',
      issue.entityType ?? '',
      issue.entityId ?? '',
      issue.entityName ?? '',
      issue.message ?? '',
      issue.explanation ?? '',
      issue.recommendation ?? '',
      issue.formula ?? issue.invalidFragment ?? '',
      issue.blocksImport ? '1' : '0'
    ].join('\u001f');
  }

  private detailIssue(row: IssueTableRow): ValidationIssue {
    const fragments = this.missingReferenceFragments(row);
    return {
      ...row.issue,
      column: row.columnLabel,
      cell: row.columns.length === 1 ? row.issue.cell : undefined,
      message: row.message,
      recommendation: row.recommendation,
      invalidFragment: fragments.length > 1 ? this.textListLabel(fragments) : row.issue.invalidFragment
    };
  }

  private issueColumnLabel(issue: ValidationIssue): string {
    return issue.column || this.columnFromCell(issue.cell) || '-';
  }

  private mergeColumns(columns: string[], column: string): string[] {
    const unique = new Set([...columns, column].filter((value) => value && value !== '-'));
    return Array.from(unique).sort((left, right) => this.columnNumber(left) - this.columnNumber(right));
  }

  private columnNumber(column: string): number {
    return column
      .toUpperCase()
      .split('')
      .reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);
  }

  private columnListLabel(columns: string[]): string {
    if (columns.length === 0) {
      return '-';
    }
    return this.textListLabel(columns);
  }

  private messageLabel(row: IssueTableRow): string {
    const fragments = this.missingReferenceFragments(row);
    if (fragments.length <= 1) {
      return row.issue.message;
    }

    return `La formula contiene referencias inexistentes: ${this.textListLabel(fragments)}. No existen en ${this.referenceTargetsLabel(row.issues)}.`;
  }

  private recommendationLabel(row: IssueTableRow): string | undefined {
    const fragments = this.missingReferenceFragments(row);
    if (fragments.length <= 1) {
      return row.issue.recommendation;
    }

    return `Revisar juntas las referencias faltantes ${this.textListLabel(fragments)}. Crear las definiciones faltantes o corregir los identificadores usados en la formula indicada.`;
  }

  private missingReferenceFragments(row: IssueTableRow): string[] {
    if (!row.issues.every((issue) => this.isMissingReferenceIssue(issue))) {
      return [];
    }
    return this.uniqueText(row.issues.map((issue) => issue.invalidFragment ?? ''));
  }

  private isMissingReferenceIssue(issue: ValidationIssue): boolean {
    return (
      issue.category === 'REFERENCES' &&
      Boolean(issue.invalidFragment) &&
      [
        'MISSING_AUXILIARY_REFERENCE',
        'MISSING_CONCEPT_REFERENCE',
        'MISSING_LEG_VARIABLE_REFERENCE'
      ].includes(issue.code)
    );
  }

  private referenceTargetsLabel(issues: ValidationIssue[]): string {
    const labels = this.uniqueText(issues.map((issue) => this.referenceTargetName(issue)));
    if (labels.length === 1) {
      return `la tabla de ${labels[0]}`;
    }
    return `las tablas correspondientes (${this.textListLabel(labels)})`;
  }

  private referenceTargetName(issue: ValidationIssue): string {
    if (issue.referenceType === 'A') {
      return 'calculo auxiliar';
    }
    if (issue.referenceType === 'L') {
      return 'variable de legajo';
    }
    if (issue.referenceType === 'N' || issue.referenceType === 'I') {
      return 'novedad/concepto';
    }
    return 'concepto';
  }

  private uniqueText(values: string[]): string[] {
    const seen = new Set<string>();
    return values.filter((value) => {
      const cleanValue = value.trim();
      if (!cleanValue || seen.has(cleanValue)) {
        return false;
      }
      seen.add(cleanValue);
      return true;
    });
  }

  private textListLabel(values: string[]): string {
    if (values.length === 0) {
      return '';
    }
    if (values.length === 1) {
      return values[0];
    }
    if (values.length === 2) {
      return `${values[0]} y ${values[1]}`;
    }
    return `${values.slice(0, -1).join(', ')} y ${values[values.length - 1]}`;
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
      code === 'AUXILIARY_ACCUMULATOR_HAS_FORMULA'
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
      issue.entityType === 'AUXILIARY' ||
      code === 'INVALID_AUXILIARY_ROW'
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
