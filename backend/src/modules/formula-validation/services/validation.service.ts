import { randomUUID } from 'node:crypto';
import { createIssue } from '../domain/issue-factory';
import { addReplacementSuggestions } from '../domain/replacement-suggestion.factory';
import { ExcelReaderService } from './excel-reader.service';
import { AuxiliaryValidator } from '../validators/auxiliary.validator';
import { CatalogValidator } from '../validators/catalog.validator';
import { CircularDependencyValidator } from '../validators/circular-dependency.validator';
import { DuplicateValidator } from '../validators/duplicate.validator';
import { FormulaSyntaxValidator } from '../validators/formula-syntax.validator';
import { FormulaSemanticValidator } from '../validators/formula-semantic.validator';
import { FunctionalAuditValidator } from '../validators/functional-audit.validator';
import { ReferenceValidator } from '../validators/reference.validator';
import { TypeValidator } from '../validators/type.validator';
import { ValidationRule } from '../validators/validation-rule';
import { WorkbookStructureValidator } from '../validators/workbook-structure.validator';
import {
  AnalysisStatus,
  IssueCodes,
  StoredValidationResult,
  ValidationHistoryItem,
  ValidationIssue,
  ValidationSummary,
} from '../types/validation.types';
import { WorkbookContext } from '../types/workbook.types';
import { ValidationRepository } from '../repositories/validation.repository';
import { AiIssueExplainerService } from './ai-issue-explainer.service';
import { FormulaManualService } from './formula-manual.service';
import { FormulaManualResponse } from '../types/formula-manual.types';

export class ValidationService {
  private readonly reader = new ExcelReaderService();

  private readonly validators: ValidationRule[] = [
    new WorkbookStructureValidator(),
    new DuplicateValidator(),
    new FormulaSyntaxValidator(),
    new FormulaSemanticValidator(),
    new ReferenceValidator(),
    new TypeValidator(),
    new FunctionalAuditValidator(),
    new CircularDependencyValidator(),
    new AuxiliaryValidator(),
    new CatalogValidator(),
  ];

  constructor(
    private readonly repository: ValidationRepository,
    private readonly aiExplainer = new AiIssueExplainerService(),
    private readonly formulaManual = new FormulaManualService(),
  ) {}

  async analyze(filePath: string, fileName: string): Promise<StoredValidationResult> {
    const id = randomUUID();
    const started = new Date();
    const startedAt = started.toISOString();

    try {
      const context = await this.reader.read(filePath, fileName);
      const issues = addReplacementSuggestions(
        context,
        this.validators.flatMap((validator) => validator.validate(context)),
      );
      const finished = new Date();
      const summary = this.createSummary({
        status: this.resolveStatus(issues),
        issues,
        started,
        finished,
        sheetsAnalyzed: this.auditedSheetsAnalyzed(context),
        conceptsAnalyzed: context.concepts.length,
        variablesAnalyzed: context.variables.length,
        auxiliariesAnalyzed: context.auxiliaries.length,
        accumulatorsAnalyzed: 0,
        formulasAnalyzed: context.formulaCells.length,
      });
      return this.repository.save({
        id,
        fileName,
        summary,
        issues,
        createdAt: startedAt,
        expiresAt: this.repository.expiresAt(started),
        sourceBuffer: context.sourceBuffer,
      });
    } catch (error) {
      const finished = new Date();
      const issue = createIssue({
        code: IssueCodes.INVALID_WORKBOOK,
        severity: 'CRITICAL',
        category: 'WORKBOOK_STRUCTURE',
        title: 'Workbook invalido o corrupto',
        message: error instanceof Error ? error.message : 'No se pudo leer el archivo XLSX.',
        explanation: 'ExcelJS no pudo abrir el archivo como workbook XLSX valido.',
        recommendation: 'Verificar que el archivo sea un .xlsx real y no este corrupto.',
        entityType: 'WORKBOOK',
        blocksImport: true,
      });
      const summary = this.createSummary({
        status: 'FAILED',
        issues: [issue],
        started,
        finished,
        sheetsAnalyzed: 0,
        conceptsAnalyzed: 0,
        variablesAnalyzed: 0,
        auxiliariesAnalyzed: 0,
        accumulatorsAnalyzed: 0,
        formulasAnalyzed: 0,
      });
      return this.repository.save({
        id,
        fileName,
        summary,
        issues: [issue],
        createdAt: startedAt,
        expiresAt: this.repository.expiresAt(started),
      });
    }
  }

  async get(validationId: string): Promise<StoredValidationResult | undefined> {
    return this.repository.findById(validationId);
  }

  async list(): Promise<ValidationHistoryItem[]> {
    return this.repository.list();
  }

  async delete(validationId: string): Promise<boolean> {
    return this.repository.deleteById(validationId);
  }

  async explainIssue(validationId: string, issueId: string): Promise<ValidationIssue | undefined> {
    const result = await this.repository.findById(validationId);
    const issue = result?.issues.find((candidate) => candidate.id === issueId);
    if (!result || !issue) {
      return undefined;
    }

    if (!issue.aiExplanation) {
      issue.aiExplanation = await this.aiExplainer.explain(issue);
      await this.repository.save(result);
    }

    return issue;
  }

  async manual(validationId: string): Promise<FormulaManualResponse | undefined> {
    const result = await this.repository.findById(validationId);
    if (!result?.sourceBuffer) {
      return undefined;
    }

    const context = await this.reader.readBuffer(result.sourceBuffer, result.fileName);
    return this.formulaManual.build(context, result);
  }

  publicResult(result: StoredValidationResult): Omit<StoredValidationResult, 'sourceBuffer'> {
    const { sourceBuffer: _sourceBuffer, ...publicResult } = result;
    return publicResult;
  }

  private createSummary(input: {
    status: AnalysisStatus;
    issues: ValidationIssue[];
    started: Date;
    finished: Date;
    sheetsAnalyzed: number;
    conceptsAnalyzed: number;
    variablesAnalyzed: number;
    auxiliariesAnalyzed: number;
    accumulatorsAnalyzed: number;
    formulasAnalyzed: number;
  }): ValidationSummary {
    const count = (severity: string): number =>
      input.issues.filter((issue) => issue.severity === severity).length;
    return {
      status: input.status,
      totalIssues: input.issues.length,
      critical: count('CRITICAL'),
      errors: count('ERROR'),
      warnings: count('WARNING'),
      info: count('INFO'),
      sheetsAnalyzed: input.sheetsAnalyzed,
      conceptsAnalyzed: input.conceptsAnalyzed,
      variablesAnalyzed: input.variablesAnalyzed,
      auxiliariesAnalyzed: input.auxiliariesAnalyzed,
      accumulatorsAnalyzed: input.accumulatorsAnalyzed,
      formulasAnalyzed: input.formulasAnalyzed,
      analysisStartedAt: input.started.toISOString(),
      analysisFinishedAt: input.finished.toISOString(),
      durationMs: input.finished.getTime() - input.started.getTime(),
    };
  }

  private auditedSheetsAnalyzed(context: Pick<WorkbookContext, 'sheets'>): number {
    const auditedKeys: Array<keyof WorkbookContext['sheets']> = ['concepts', 'auxiliaries'];
    return auditedKeys.filter((key) => Boolean(context.sheets[key])).length;
  }

  private resolveStatus(issues: ValidationIssue[]): AnalysisStatus {
    if (issues.some((issue) => issue.severity === 'CRITICAL' || issue.blocksImport)) {
      return 'BLOCKED';
    }
    if (issues.length > 0) {
      return 'VALID_WITH_WARNINGS';
    }
    return 'VALID';
  }
}
