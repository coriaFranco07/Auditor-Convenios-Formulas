import { normalizeText } from '../../../config/schema';
import { AuxiliaryRecord, ConceptRecord, FormulaCell, LegVariableRecord, WorkbookContext } from '../types/workbook.types';
import { ReplacementSuggestion, ValidationIssue } from '../types/validation.types';

type CandidateRecord = ConceptRecord | AuxiliaryRecord | LegVariableRecord;

interface CandidateScore {
  record: CandidateRecord;
  token: string;
  score: number;
  reasons: string[];
  formula?: string;
}

const missingReferenceCodes = new Set([
  'MISSING_AUXILIARY_REFERENCE',
  'MISSING_CONCEPT_REFERENCE',
  'MISSING_LEG_VARIABLE_REFERENCE',
]);

export const addReplacementSuggestions = (
  context: WorkbookContext,
  issues: ValidationIssue[],
): ValidationIssue[] => {
  const usageByToken = buildUsageByToken(context.formulaCells);

  return issues.map((issue) => {
    if (!issue.referenceType || issue.referenceId === undefined || !missingReferenceCodes.has(issue.code)) {
      return issue;
    }

    const suggestions = suggestReplacements(issue, context, usageByToken);
    if (suggestions.length === 0) {
      return issue;
    }

    return {
      ...issue,
      replacementSuggestions: suggestions,
      recommendation: humanRecommendation(issue, suggestions),
    };
  });
};

const suggestReplacements = (
  issue: ValidationIssue,
  context: WorkbookContext,
  usageByToken: Map<string, FormulaCell[]>,
): ReplacementSuggestion[] => {
  const candidates = candidateRecords(issue, context);
  const scored = candidates
    .filter((candidate) => candidate.id !== undefined)
    .map((candidate) => scoreCandidate(issue, candidate, usageByToken))
    .filter((candidate) => candidate.score >= 12)
    .sort((left, right) => right.score - left.score || Number(left.record.id) - Number(right.record.id))
    .slice(0, 3);

  return scored.map((candidate) => ({
    token: candidate.token,
    label: candidateLabel(candidate.record),
    reason: candidate.reasons.length
      ? candidate.reasons.join(' ')
      : 'Es un candidato del mismo tipo; confirmar funcionalmente antes de modificar.',
    confidence: confidence(candidate.score),
    score: candidate.score,
    sheet: candidate.record.sheet,
    row: candidate.record.row,
    cell: candidate.record.sourceColumns.id?.cell,
    formula: candidate.formula,
  }));
};

const candidateRecords = (issue: ValidationIssue, context: WorkbookContext): CandidateRecord[] => {
  if (issue.referenceType === 'A') {
    return context.auxiliaries;
  }
  if (issue.referenceType === 'L') {
    return context.variables;
  }
  if (issue.referenceType === 'R' || issue.referenceType === 'U' || issue.referenceType === 'N' || issue.referenceType === 'I') {
    return context.concepts;
  }
  return [];
};

const scoreCandidate = (
  issue: ValidationIssue,
  record: CandidateRecord,
  usageByToken: Map<string, FormulaCell[]>,
): CandidateScore => {
  const token = `${issue.referenceType}[${record.id}]`;
  const reasons: string[] = [];
  let score = 0;

  const distance = Math.abs(Number(record.id) - Number(issue.referenceId));
  const distanceScore = scoreDistance(distance);
  if (distanceScore > 0) {
    score += distanceScore;
    reasons.push(`El identificador ${token} esta cerca de ${issue.referenceType}[${issue.referenceId}].`);
  }

  if (sameLastDigit(record.id, issue.referenceId)) {
    score += 7;
    reasons.push('Conserva la misma terminacion numerica, posible error de carga o tipeo.');
  }

  const nameScore = scoreNameContext(issue, record);
  if (nameScore > 0) {
    score += nameScore;
    reasons.push('El nombre del candidato tiene relacion con el concepto o formula observada.');
  }

  const rowScore = scoreRowContext(issue, record);
  if (rowScore > 0) {
    score += rowScore;
    reasons.push('Esta ubicado cerca de la fila donde se detecto el problema.');
  }

  const formulaContextScore = scoreFormulaContext(issue, token, usageByToken);
  if (formulaContextScore.score > 0) {
    score += formulaContextScore.score;
    reasons.push(formulaContextScore.reason);
  }

  const formula = formulaFor(record);
  if (formula) {
    score += 4;
  }

  return {
    record,
    token,
    score,
    reasons: compactReasons(reasons),
    formula,
  };
};

const scoreDistance = (distance: number): number => {
  if (distance === 1) {
    return 34;
  }
  if (distance <= 3) {
    return 28;
  }
  if (distance <= 5) {
    return 23;
  }
  if (distance <= 10) {
    return 18;
  }
  if (distance <= 20) {
    return 12;
  }
  if (distance <= 50) {
    return 6;
  }
  return 0;
};

const sameLastDigit = (candidateId: number | undefined, missingId: number | undefined): boolean =>
  candidateId !== undefined && missingId !== undefined && candidateId % 10 === missingId % 10;

const scoreNameContext = (issue: ValidationIssue, record: CandidateRecord): number => {
  const issueTokens = tokenize([issue.entityName, issue.formula, issue.message].filter(Boolean).join(' '));
  const candidateTokens = tokenize([record.name, formulaFor(record)].filter(Boolean).join(' '));
  if (issueTokens.length === 0 || candidateTokens.length === 0) {
    return 0;
  }
  const issueSet = new Set(issueTokens);
  const common = candidateTokens.filter((token) => issueSet.has(token));
  return Math.min(common.length * 8, 24);
};

const scoreRowContext = (issue: ValidationIssue, record: CandidateRecord): number => {
  if (!issue.row) {
    return 0;
  }
  const distance = Math.abs(record.row - issue.row);
  if (distance <= 5) {
    return 10;
  }
  if (distance <= 20) {
    return 5;
  }
  return 0;
};

const scoreFormulaContext = (
  issue: ValidationIssue,
  candidateToken: string,
  usageByToken: Map<string, FormulaCell[]>,
): { score: number; reason: string } => {
  const usages = usageByToken.get(candidateToken) ?? [];
  if (usages.length === 0 || !issue.formula) {
    return { score: 0, reason: '' };
  }

  const currentTokens = new Set(referenceTokens(issue.formula).filter((token) => token !== issue.invalidFragment));
  let score = 0;
  let sharedReference = false;
  let sameSheet = false;

  usages.forEach((usage) => {
    if (usage.sheet === issue.sheet) {
      sameSheet = true;
    }
    const usageTokens = referenceTokens(usage.formula);
    if (usageTokens.some((token) => currentTokens.has(token))) {
      sharedReference = true;
    }
  });

  if (sameSheet) {
    score += 8;
  }
  if (sharedReference) {
    score += 12;
  }

  return {
    score,
    reason: sharedReference
      ? 'Aparece en formulas que comparten referencias con este hallazgo.'
      : 'Aparece usado en otras formulas de la misma base.',
  };
};

const buildUsageByToken = (formulaCells: FormulaCell[]): Map<string, FormulaCell[]> => {
  const usage = new Map<string, FormulaCell[]>();
  formulaCells.forEach((cell) => {
    cell.parseResult.references.forEach((reference) => {
      if (reference.id === undefined) {
        return;
      }
      const token = `${reference.type}[${reference.id}]`;
      const current = usage.get(token) ?? [];
      current.push(cell);
      usage.set(token, current);
    });
  });
  return usage;
};

const candidateLabel = (record: CandidateRecord): string =>
  `${record.name ?? 'Sin nombre'}${record.entityType === 'AUXILIARY' && record.class ? ` (${auxiliaryKind(record.class)})` : ''}`;

const auxiliaryKind = (value: string): string => {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'A') {
    return 'acumulador';
  }
  if (normalized === 'F') {
    return 'formula';
  }
  if (normalized === 'V') {
    return 'valor constante';
  }
  return `clase ${value}`;
};

const formulaFor = (record: CandidateRecord): string | undefined => {
  if (record.entityType === 'AUXILIARY') {
    return [record.condition, record.trueFormula, record.falseFormula].filter(Boolean).join(' | ') || undefined;
  }
  if (record.entityType === 'CONCEPT') {
    return [
      record.monthlyCondition,
      record.monthlyUnit,
      record.monthlyFormulaTrue,
      record.monthlyFormulaFalse,
      record.dailyCondition,
      record.dailyUnit,
      record.dailyFormulaTrue,
      record.dailyFormulaFalse,
      record.preFormula,
      record.postFormula,
    ]
      .filter(Boolean)
      .join(' | ') || undefined;
  }
  return undefined;
};

const confidence = (score: number): ReplacementSuggestion['confidence'] => {
  if (score >= 58) {
    return 'ALTA';
  }
  if (score >= 34) {
    return 'MEDIA';
  }
  return 'BAJA';
};

const humanRecommendation = (issue: ValidationIssue, suggestions: ReplacementSuggestion[]): string => {
  const best = suggestions[0];
  return `Revisar si ${issue.invalidFragment ?? 'la referencia'} debia ser ${best.token} (${best.label}). Es una sugerencia de ayuda, no una correccion automatica. Confirmar contra el criterio funcional antes de modificar el Excel.`;
};

const tokenize = (value: string): string[] =>
  normalizeText(value)
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopWords.has(token));

const referenceTokens = (formula: string): string[] => {
  const matches = formula.match(/\b[NIARUL]\[\d+\]/g);
  return matches ?? [];
};

const compactReasons = (reasons: string[]): string[] => {
  const seen = new Set<string>();
  return reasons.filter((reason) => {
    if (seen.has(reason)) {
      return false;
    }
    seen.add(reason);
    return true;
  }).slice(0, 3);
};

const stopWords = new Set([
  'formula',
  'referencia',
  'concepto',
  'calculo',
  'auxiliar',
  'tabla',
  'pero',
  'existe',
  'fila',
  'hoja',
  'para',
  'con',
  'del',
  'los',
  'las',
  'por',
  'que',
]);
