import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { readableFormula } from '../utils/formula-readable.util';
import { ValidationIssue } from '../models/validation.models';
import { ValidationApiService } from '../services/validation-api.service';

interface IssueDetailDialogData {
  issue: ValidationIssue;
  validationId?: string;
}

@Component({
  selector: 'app-issue-detail-dialog',
  templateUrl: './issue-detail-dialog.component.html',
  styleUrls: ['./issue-detail-dialog.component.scss']
})
export class IssueDetailDialogComponent implements OnInit {
  issue: ValidationIssue;
  loadingAiExplanation = false;
  aiExplanationError = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: IssueDetailDialogData,
    private readonly dialogRef: MatDialogRef<IssueDetailDialogComponent>,
    private readonly api: ValidationApiService
  ) {
    this.issue = data.issue;
  }

  ngOnInit(): void {
    this.loadAiExplanation();
  }

  close(): void {
    this.dialogRef.close();
  }

  entityLabel(): string {
    return [this.entityTypeLabel(this.issue.entityType), this.issue.entityId, this.issue.entityName].filter(Boolean).join(' ');
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

  loadAiExplanation(): void {
    if (!this.data.validationId || this.issue.aiExplanation || this.loadingAiExplanation) {
      return;
    }
    this.loadingAiExplanation = true;
    this.aiExplanationError = '';
    this.api.explainIssue(this.data.validationId, this.issue.id).subscribe({
      next: (issue) => {
        this.issue.aiExplanation = issue.aiExplanation;
        this.loadingAiExplanation = false;
      },
      error: (error) => {
        this.aiExplanationError = error?.error?.message ?? 'No se pudo generar la explicacion con IA.';
        this.loadingAiExplanation = false;
      }
    });
  }

  hasAccountingGuide(): boolean {
    return Boolean(
      this.issue.dependencyDetails?.length ||
      this.issue.referenceType ||
      this.issue.formula ||
      this.issue.replacementSuggestions?.length
    );
  }

  showAiGuide(): boolean {
    if (this.issue.aiExplanation || this.loadingAiExplanation) {
      return true;
    }
    return Boolean(this.aiExplanationError && !this.aiExplanationError.toLowerCase().includes('gemini no esta configurado'));
  }

  locationLabel(sheet?: string, row?: number, cell?: string): string {
    return [sheet, row ? `fila ${row}` : undefined, cell ? `celda ${cell}` : undefined]
      .filter(Boolean)
      .join(' - ');
  }

  isDuplicateIssue(): boolean {
    return (
      this.issue.code === 'DUPLICATE_IDENTICAL' ||
      this.issue.code === 'DUPLICATE_CONFLICT' ||
      this.issue.category === 'DUPLICATES'
    );
  }

  readableFormula(formula: string): string {
    return readableFormula(formula, this.issue.dependencyDetails);
  }
}
