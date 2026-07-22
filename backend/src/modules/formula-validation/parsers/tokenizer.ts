import { FormulaDiagnostic, ReferenceType } from '../types/formula.types';

export type TokenType =
  | 'NUMBER'
  | 'REFERENCE'
  | 'IDENTIFIER'
  | 'OPERATOR'
  | 'LPAREN'
  | 'RPAREN'
  | 'SEMICOLON'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
  referenceType?: ReferenceType;
  referenceRawId?: string;
}

const referenceLetters = new Set(['N', 'I', 'A', 'R', 'U', 'L']);

export interface TokenizeResult {
  tokens: Token[];
  errors: FormulaDiagnostic[];
}

export class FormulaTokenizer {
  tokenize(input: string): TokenizeResult {
    const tokens: Token[] = [];
    const errors: FormulaDiagnostic[] = [];
    let position = 0;

    const push = (token: Token): void => {
      tokens.push(token);
    };

    while (position < input.length) {
      const char = input[position];

      if (/\s/.test(char)) {
        position += 1;
        continue;
      }

      if (/\d/.test(char) || (char === '.' && /\d/.test(input[position + 1] ?? ''))) {
        const start = position;
        let hasDot = false;
        while (position < input.length) {
          const current = input[position];
          if (current === '.') {
            if (hasDot) {
              break;
            }
            hasDot = true;
            position += 1;
            continue;
          }
          if (!/\d/.test(current)) {
            break;
          }
          position += 1;
        }
        push({ type: 'NUMBER', value: input.slice(start, position), start, end: position });
        continue;
      }

      if (/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(char)) {
        const start = position;
        let identifier = '';
        while (position < input.length && /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(input[position])) {
          identifier += input[position];
          position += 1;
        }

        const normalized = identifier
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase();

        let lookahead = position;
        while (/\s/.test(input[lookahead] ?? '')) {
          lookahead += 1;
        }

        if (referenceLetters.has(normalized) && input[lookahead] === '[') {
          position = lookahead + 1;
          const idStart = position;
          while (position < input.length && input[position] !== ']') {
            position += 1;
          }
          if (position >= input.length) {
            const rawId = input.slice(idStart);
            errors.push({
              message: `La referencia ${identifier}[ no cierra corchete.`,
              position: start,
              fragment: input.slice(start),
            });
            push({
              type: 'REFERENCE',
              value: input.slice(start),
              start,
              end: input.length,
              referenceType: normalized as ReferenceType,
              referenceRawId: rawId.trim(),
            });
            break;
          }
          const rawId = input.slice(idStart, position).trim();
          position += 1;
          push({
            type: 'REFERENCE',
            value: input.slice(start, position),
            start,
            end: position,
            referenceType: normalized as ReferenceType,
            referenceRawId: rawId,
          });
          continue;
        }

        push({ type: 'IDENTIFIER', value: normalized, start, end: position });
        continue;
      }

      if (char === '(') {
        push({ type: 'LPAREN', value: char, start: position, end: position + 1 });
        position += 1;
        continue;
      }
      if (char === ')') {
        push({ type: 'RPAREN', value: char, start: position, end: position + 1 });
        position += 1;
        continue;
      }
      if (char === ';') {
        push({ type: 'SEMICOLON', value: char, start: position, end: position + 1 });
        position += 1;
        continue;
      }

      const two = input.slice(position, position + 2);
      if (['>=', '<=', '==', '!=', '&&', '||'].includes(two)) {
        push({ type: 'OPERATOR', value: two, start: position, end: position + 2 });
        position += 2;
        continue;
      }

      if (['+', '-', '*', '/', '>', '<', '!'].includes(char)) {
        push({ type: 'OPERATOR', value: char, start: position, end: position + 1 });
        position += 1;
        continue;
      }

      errors.push({
        message: `Caracter no permitido: ${char}`,
        position,
        fragment: char,
      });
      position += 1;
    }

    tokens.push({ type: 'EOF', value: '', start: input.length, end: input.length });
    return { tokens, errors };
  }
}

