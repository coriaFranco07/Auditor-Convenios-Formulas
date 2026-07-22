import { documentedCatalogs } from '../../../config/schema';
import { createIssue } from '../domain/issue-factory';
import { isBlank } from '../domain/normalization';
import { IssueCodes, ValidationIssue } from '../types/validation.types';
import { WorkbookContext } from '../types/workbook.types';
import { ValidationRule } from './validation-rule';

export class CatalogValidator implements ValidationRule {
  validate(context: WorkbookContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    context.concepts.forEach((concept) => {
      if (!isBlank(concept.activation) && !documentedCatalogs.activation.includes(String(concept.activation))) {
        issues.push(
          createIssue({
            code: IssueCodes.SCHEMA_DRIFT,
            severity: 'WARNING',
            category: 'CATALOGS',
            title: 'Valor de activacion no documentado',
            message: `El concepto ${concept.id} usa activacion "${concept.activation}".`,
            explanation: 'El valor no figura en el catalogo documentado; el PDF podria estar desactualizado.',
            recommendation: 'Confirmar con el area funcional si debe agregarse al catalogo.',
            location: concept.sourceColumns.activation,
            entityType: 'CONCEPT',
            entityId: concept.id,
            entityName: concept.name,
            blocksImport: false,
          }),
        );
      }
      if (!isBlank(concept.scope) && !documentedCatalogs.scope.includes(String(concept.scope))) {
        issues.push(
          createIssue({
            code: IssueCodes.SCHEMA_DRIFT,
            severity: 'WARNING',
            category: 'CATALOGS',
            title: 'Valor de alcance no documentado',
            message: `El concepto ${concept.id} usa alcance "${concept.scope}".`,
            explanation: 'El valor no coincide con el catalogo configurado.',
            recommendation: 'Confirmar si el valor es valido para este convenio.',
            location: concept.sourceColumns.scope,
            entityType: 'CONCEPT',
            entityId: concept.id,
            entityName: concept.name,
            blocksImport: false,
          }),
        );
      }
    });
    return issues;
  }
}

