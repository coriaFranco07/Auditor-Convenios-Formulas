import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { finalize } from 'rxjs';
import {
  FormulaManualItem,
  FormulaManualResponse,
  ManualFormulaBlock,
  ManualReference
} from '../../models/validation.models';
import { ValidationApiService } from '../../services/validation-api.service';

type ManualTypeFilter = 'ALL' | 'CONCEPT' | 'AUXILIARY';

@Component({
  selector: 'app-formula-manual',
  templateUrl: './formula-manual.component.html',
  styleUrls: ['./formula-manual.component.scss']
})
export class FormulaManualComponent implements OnChanges {
  @Input() validationId?: string;

  manual?: FormulaManualResponse;
  selectedId?: string;
  loading = false;
  errorMessage = '';
  searchTerm = '';
  typeFilter: ManualTypeFilter = 'ALL';

  readonly filters: Array<{ id: ManualTypeFilter; label: string }> = [
    { id: 'ALL', label: 'Todos' },
    { id: 'CONCEPT', label: 'Conceptos' },
    { id: 'AUXILIARY', label: 'Auxiliares' }
  ];

  constructor(private readonly api: ValidationApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['validationId'] && this.validationId) {
      this.loadManual();
    }
  }

  get filteredItems(): FormulaManualItem[] {
    const term = this.normalize(this.searchTerm);
    return (this.manual?.items ?? []).filter((item) => {
      const matchesType = this.typeFilter === 'ALL' || item.entityType === this.typeFilter;
      const matchesTerm =
        !term ||
        this.normalize(`${item.entityId ?? ''} ${item.name} ${item.title} ${item.sheet}`).includes(term);
      return matchesType && matchesTerm;
    });
  }

  get selectedItem(): FormulaManualItem | undefined {
    return this.filteredItems.find((item) => item.id === this.selectedId) ?? this.filteredItems[0];
  }

  loadManual(): void {
    if (!this.validationId) {
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.api
      .getManual(this.validationId)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (manual) => {
          this.manual = manual;
          this.selectedId = manual.items[0]?.id;
        },
        error: () => {
          this.errorMessage = 'No se pudo generar el manual explicativo para este analisis.';
        }
      });
  }

  selectItem(item: FormulaManualItem): void {
    this.selectedId = item.id;
  }

  setFilter(filter: ManualTypeFilter): void {
    this.typeFilter = filter;
    this.selectedId = this.filteredItems[0]?.id;
  }

  onSearch(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value;
    this.selectedId = this.filteredItems[0]?.id;
  }

  itemTypeLabel(item: FormulaManualItem): string {
    return item.entityType === 'CONCEPT' ? 'Concepto' : 'Auxiliar';
  }

  itemCode(item: FormulaManualItem): string {
    return item.entityType === 'CONCEPT' ? String(item.entityId ?? '-') : `A${item.entityId ?? '-'}`;
  }

  locationLabel(item: FormulaManualItem): string {
    return `${item.sheet} - fila ${item.row}`;
  }

  formulaLocation(formula: ManualFormulaBlock): string {
    const location = formula.location;
    return [formula.sourceLabel, location?.cell, location?.row ? `fila ${location.row}` : undefined]
      .filter(Boolean)
      .join(' - ');
  }

  statusClass(reference: ManualReference): string {
    if (reference.status === 'Encontrada') {
      return 'found';
    }
    if (reference.status === 'Novedad externa') {
      return 'external';
    }
    return 'missing';
  }

  trackItem(_index: number, item: FormulaManualItem): string {
    return item.id;
  }

  trackFormula(_index: number, formula: ManualFormulaBlock): string {
    return formula.id;
  }

  trackReference(_index: number, reference: ManualReference): string {
    return reference.token;
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
