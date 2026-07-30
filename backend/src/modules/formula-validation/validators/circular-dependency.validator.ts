import { createIssue } from '../domain/issue-factory';
import { collectEffectiveReferences } from '../domain/formula-analysis';
import { DependencyNodeDetail, IssueCodes, ValidationIssue } from '../types/validation.types';
import { BaseRecord, FormulaCell, WorkbookContext } from '../types/workbook.types';
import { ValidationRule } from './validation-rule';

type Graph = Map<string, Set<string>>;

export class CircularDependencyValidator implements ValidationRule {
  validate(context: WorkbookContext): ValidationIssue[] {
    const graph = this.buildGraph(context);
    const cycles = this.findCycles(graph);
    const issues: ValidationIssue[] = [];

    cycles.forEach((cycle) => {
      const selfReference = cycle.length === 1;
      const path = selfReference ? [cycle[0], cycle[0]] : [...cycle, cycle[0]];
      const details = this.dependencyDetails(path, context);
      const primary = details[0];
      issues.push(
        createIssue({
          code: selfReference ? IssueCodes.SELF_REFERENCE : IssueCodes.CIRCULAR_DEPENDENCY,
          severity: 'CRITICAL',
          category: 'DEPENDENCIES',
          title: selfReference ? 'Autorreferencia directa' : 'Dependencia circular',
          message: this.businessMessage(path, details, selfReference),
          explanation:
            'Este calculo no tiene un orden confiable: para obtener el resultado necesita otro calculo que finalmente vuelve al punto de partida.',
          recommendation:
            'Revisar las filas indicadas abajo. Corregir la referencia que vuelve al mismo calculo o mover esa parte a un auxiliar/base independiente que no dependa de esta cadena.',
          location: primary
            ? { sheet: primary.sheet, row: primary.row, column: primary.column, cell: primary.cell }
            : undefined,
          entityType: selfReference && cycle[0].startsWith('A[') ? 'AUXILIARY' : 'CONCEPT',
          entityId: this.nodeId(cycle[0]),
          entityName: primary?.label.replace(/^[AR]\[\d+\]\s+-\s+/, ''),
          dependencyPath: path,
          dependencyDetails: details,
          relatedLocations: details.map((detail) => ({
            sheet: detail.sheet,
            row: detail.row,
            column: detail.column,
            cell: detail.cell,
          })),
          blocksImport: true,
        }),
      );
    });

    return issues;
  }

  private buildGraph(context: WorkbookContext): Graph {
    const graph: Graph = new Map();
    const addEdge = (from: string, to: string): void => {
      const targets = graph.get(from) ?? new Set<string>();
      targets.add(to);
      graph.set(from, targets);
      if (!graph.has(to)) {
        graph.set(to, new Set());
      }
    };

    context.formulaCells.forEach((formulaCell) => {
      if (formulaCell.entityId === undefined) {
        return;
      }
      const ownerPrefix = formulaCell.entityType === 'AUXILIARY' ? 'A' : 'R';
      if (ownerPrefix !== 'A' && ownerPrefix !== 'R') {
        return;
      }
      const owner = `${ownerPrefix}[${formulaCell.entityId}]`;
      if (!graph.has(owner)) {
        graph.set(owner, new Set());
      }
      collectEffectiveReferences(formulaCell.parseResult.ast).forEach((reference) => {
        if (reference.id === undefined || (reference.type !== 'A' && reference.type !== 'R')) {
          return;
        }
        addEdge(owner, `${reference.type}[${reference.id}]`);
      });
    });

    return graph;
  }

  private findCycles(graph: Graph): string[][] {
    let index = 0;
    const stack: string[] = [];
    const indices = new Map<string, number>();
    const lowlinks = new Map<string, number>();
    const onStack = new Set<string>();
    const components: string[][] = [];

    const visit = (node: string): void => {
      indices.set(node, index);
      lowlinks.set(node, index);
      index += 1;
      stack.push(node);
      onStack.add(node);

      graph.get(node)?.forEach((target) => {
        if (!indices.has(target)) {
          visit(target);
          lowlinks.set(node, Math.min(lowlinks.get(node)!, lowlinks.get(target)!));
        } else if (onStack.has(target)) {
          lowlinks.set(node, Math.min(lowlinks.get(node)!, indices.get(target)!));
        }
      });

      if (lowlinks.get(node) === indices.get(node)) {
        const component: string[] = [];
        let target: string;
        do {
          target = stack.pop()!;
          onStack.delete(target);
          component.push(target);
        } while (target !== node);
        components.push(component);
      }
    };

    [...graph.keys()].sort().forEach((node) => {
      if (!indices.has(node)) {
        visit(node);
      }
    });

    return components
      .filter(
        (component) =>
          component.length > 1 || (component.length === 1 && graph.get(component[0])?.has(component[0])),
      )
      .map((component) => this.actualCycle(component, graph));
  }

  private actualCycle(component: string[], graph: Graph): string[] {
    if (component.length === 1) {
      return component;
    }

    const componentNodes = new Set(component);

    const visit = (start: string, current: string, path: string[], seen: Set<string>): string[] | undefined => {
      const targets = [...(graph.get(current) ?? [])]
        .filter((target) => componentNodes.has(target))
        .sort();

      for (const target of targets) {
        if (target === start && path.length > 1) {
          return path;
        }
        if (!seen.has(target)) {
          seen.add(target);
          const cycle = visit(start, target, [...path, target], seen);
          if (cycle) {
            return cycle;
          }
          seen.delete(target);
        }
      }

      return undefined;
    };

    for (const start of [...component].sort()) {
      const cycle = visit(start, start, [start], new Set([start]));
      if (cycle) {
        return cycle;
      }
    }

    return component;
  }

  private nodeId(node: string): number | undefined {
    const match = /\[(\d+)\]/.exec(node);
    return match ? Number(match[1]) : undefined;
  }

  private businessMessage(path: string[], details: DependencyNodeDetail[], selfReference: boolean): string {
    if (selfReference && details[0]) {
      return `${details[0].label} se usa dentro de su propia formula.`;
    }
    const first = details[0]?.label ?? path[0];
    const second = details[1]?.label ?? path[1];
    return `${first} depende de ${second} y la cadena vuelve al calculo inicial.`;
  }

  private dependencyDetails(path: string[], context: WorkbookContext): DependencyNodeDetail[] {
    const details = path.map((node, index) => this.nodeDetail(node, context, path[index + 1]));
    if (path.length > 1 && path[0] === path[path.length - 1]) {
      details[details.length - 1] = details[0];
    }
    return details;
  }

  private nodeDetail(node: string, context: WorkbookContext, nextNode?: string): DependencyNodeDetail {
    const type = node.startsWith('A[') ? 'A' : 'R';
    const id = this.nodeId(node);
    const formula = this.findFormulaForEdge(node, nextNode, context);

    if (formula) {
      return this.detailFromFormula(node, formula);
    }

    if (type === 'R') {
      const concept = context.concepts.find((record) => record.id === id);
      if (concept) {
        return this.detailFromRecord(node, concept);
      }
    }

    const auxiliary = context.auxiliaries.find((record) => record.id === id);
    if (auxiliary) {
      return this.detailFromRecord(node, auxiliary);
    }

    return {
      node,
      label: node,
      sheet: 'Workbook',
      row: 0,
    };
  }

  private findFormulaForEdge(node: string, nextNode: string | undefined, context: WorkbookContext): FormulaCell | undefined {
    const type = node.startsWith('A[') ? 'A' : 'R';
    const id = this.nodeId(node);
    const candidates = context.formulaCells.filter(
      (cell) =>
        cell.entityId === id &&
        ((type === 'A' && cell.entityType === 'AUXILIARY') || (type === 'R' && cell.entityType === 'CONCEPT')),
    );

    if (!nextNode) {
      return candidates[0];
    }

    const nextType = nextNode.startsWith('A[') ? 'A' : 'R';
    const nextId = this.nodeId(nextNode);
    return (
      candidates.find((cell) =>
        cell.parseResult.references.some((reference) => reference.type === nextType && reference.id === nextId),
      ) ?? candidates[0]
    );
  }

  private detailFromFormula(node: string, formula: FormulaCell): DependencyNodeDetail {
    return {
      node,
      label: this.label(node, formula.entityName),
      sheet: formula.sheet,
      row: formula.row,
      column: formula.column,
      cell: formula.cell,
      formula: formula.formula,
    };
  }

  private detailFromRecord(node: string, record: BaseRecord): DependencyNodeDetail {
    const location =
      record.sourceColumns['id'] ??
      record.sourceColumns['number'] ??
      record.sourceColumns['code'] ??
      Object.values(record.sourceColumns)[0];
    return {
      node,
      label: this.label(node, record.name),
      sheet: record.sheet,
      row: record.row,
      column: location?.column,
      cell: location?.cell,
    };
  }

  private label(node: string, name?: string): string {
    return name ? `${node} - ${name}` : node;
  }
}
