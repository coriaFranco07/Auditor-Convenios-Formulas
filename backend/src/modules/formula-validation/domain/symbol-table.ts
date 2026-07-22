import {
  AccumulatorRecord,
  AuxiliaryRecord,
  BaseRecord,
  ConceptRecord,
  LegVariableRecord,
} from '../types/workbook.types';

export interface SymbolTables {
  concepts: Map<number, ConceptRecord[]>;
  variables: Map<number, LegVariableRecord[]>;
  auxiliaries: Map<number, AuxiliaryRecord[]>;
  accumulators: Map<number, AccumulatorRecord[]>;
}

export const groupById = <T extends BaseRecord>(records: T[]): Map<number, T[]> => {
  const grouped = new Map<number, T[]>();
  records.forEach((record) => {
    if (record.id === undefined) {
      return;
    }
    const current = grouped.get(record.id) ?? [];
    current.push(record);
    grouped.set(record.id, current);
  });
  return grouped;
};

export const buildSymbolTables = (context: {
  concepts: ConceptRecord[];
  variables: LegVariableRecord[];
  auxiliaries: AuxiliaryRecord[];
  accumulators: AccumulatorRecord[];
}): SymbolTables => ({
  concepts: groupById(context.concepts),
  variables: groupById(context.variables),
  auxiliaries: groupById(context.auxiliaries),
  accumulators: groupById(context.accumulators),
});

