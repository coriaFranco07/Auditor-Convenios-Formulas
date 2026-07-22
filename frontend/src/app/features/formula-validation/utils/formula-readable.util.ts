import { DependencyNodeDetail } from '../models/validation.models';

export function formulaTypeLabel(formula: string): string {
  return /[=+\-*/();<>]|\b(SI|Y|O|NO)\s*\(/i.test(formula) ? 'Formula registrada' : 'Valor o texto registrado';
}

export function readableFormula(formula: string, details: DependencyNodeDetail[] | undefined = []): string {
  return formula
    .replace(/\bSI\s*\(/gi, 'Si se cumple (')
    .replace(/\bY\s*\(/gi, 'todas estas condiciones (')
    .replace(/\bO\s*\(/gi, 'alguna de estas condiciones (')
    .replace(/\bNO\s*\(/gi, 'no se cumple (')
    .replace(/;/g, '; entonces ')
    .replace(/\s*([+*/])\s*/g, ' $1 ')
    .replace(/([)\]\d])\s*-\s*([A-Za-z0-9_(])/g, '$1 - $2')
    .replace(/>=/g, ' mayor o igual que ')
    .replace(/<=/g, ' menor o igual que ')
    .replace(/>/g, ' mayor que ')
    .replace(/</g, ' menor que ')
    .replace(/=/g, ' igual a ')
    .replace(/\b([NIARUL])\[(\d+)\]/g, (_match, type: string, id: string) => referenceMeaning(type, id, details))
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function referenceMeaning(
  type: string,
  id: string,
  details: DependencyNodeDetail[] | undefined = []
): string {
  const detail = details.find((candidate) => candidate.node === `${type}[${id}]`);
  if (detail?.label) {
    return detail.label;
  }
  const labels: Record<string, string> = {
    N: 'unidades de novedad del concepto',
    I: 'importe de novedad del concepto',
    A: 'calculo auxiliar',
    R: 'importe calculado del concepto',
    U: 'unidad calculada del concepto',
    L: 'variable del legajo'
  };
  return `${labels[type] ?? 'referencia'} ${id}`;
}
