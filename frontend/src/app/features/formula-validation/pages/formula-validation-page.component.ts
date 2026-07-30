import { HttpEventType } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';
import { ValidationHistoryItem, ValidationResult } from '../models/validation.models';
import { ValidationApiService } from '../services/validation-api.service';

type ModuleView = 'upload' | 'history' | 'manual' | 'findings';

interface NavigationModule {
  id: ModuleView;
  title: string;
  caption: string;
  icon: string;
  requiresResult: boolean;
}

@Component({
  selector: 'app-formula-validation-page',
  templateUrl: './formula-validation-page.component.html',
  styleUrls: ['./formula-validation-page.component.scss']
})
export class FormulaValidationPageComponent implements OnInit {
  selectedFile?: File;
  result?: ValidationResult;
  progress = 0;
  analyzing = false;
  historyLoading = false;
  message = '';
  activeView: ModuleView = 'upload';
  historyItems: ValidationHistoryItem[] = [];
  deletingHistoryId?: string;

  readonly modules: NavigationModule[] = [
    {
      id: 'upload',
      title: 'Cargar Excel',
      caption: 'Auditoria de formulas',
      icon: 'upload_file',
      requiresResult: false
    },
    {
      id: 'history',
      title: 'Historial de Analisis',
      caption: 'Analisis guardados',
      icon: 'history',
      requiresResult: false
    },
    {
      id: 'manual',
      title: 'Manual explicativo',
      caption: 'Fichas por concepto',
      icon: 'menu_book',
      requiresResult: true
    },
    {
      id: 'findings',
      title: 'Hallazgos de auditoria',
      caption: '',
      icon: 'fact_check',
      requiresResult: true
    }
  ];

  get currentModule(): NavigationModule {
    return this.modules.find((module) => module.id === this.activeView) ?? this.modules[0];
  }

  constructor(
    private readonly api: ValidationApiService,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    const validationId = new URLSearchParams(window.location.search).get('validationId');
    if (validationId) {
      this.loadValidation(validationId);
      return;
    }
    this.activeView = this.viewFromUrl() ?? 'upload';
    if (this.activeView === 'history') {
      this.loadHistory();
    }
  }

  onFileSelected(file: File): void {
    this.selectedFile = file;
    this.result = undefined;
    this.progress = 0;
    this.message = '';
    this.activeView = 'upload';
  }

  onFileRemoved(): void {
    this.selectedFile = undefined;
    this.progress = 0;
    this.message = '';
  }

  onHeaderFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.onFileSelected(file);
    this.analyze();
  }

  analyze(): void {
    if (!this.selectedFile) {
      this.message = 'Selecciona un archivo .xlsx.';
      return;
    }
    this.analyzing = true;
    this.progress = 4;
    this.api
      .analyze(this.selectedFile)
      .pipe(finalize(() => (this.analyzing = false)))
      .subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            this.progress = Math.round((event.loaded / event.total) * 80);
          }
          if (event.type === HttpEventType.Response && event.body) {
            this.progress = 100;
            this.result = event.body;
            this.activeView = 'findings';
            this.loadHistory();
            this.pushValidationUrl(event.body.id);
            this.snackBar.open('Analisis finalizado', 'Cerrar', { duration: 3500 });
          }
        },
        error: (error) => {
          this.progress = 0;
          this.message = error?.error?.message ?? 'No se pudo analizar el archivo.';
          this.snackBar.open(this.message, 'Cerrar', { duration: 5000 });
        }
      });
  }

  download(format: 'json' | 'csv' | 'xlsx' | 'issues-xlsx'): void {
    if (!this.result) {
      return;
    }
    window.open(this.api.downloadUrl(this.result.id, format), '_blank');
  }

  exportErrors(): void {
    this.download('issues-xlsx');
  }

  selectView(view: ModuleView): void {
    const selectedModule = this.modules.find((item) => item.id === view);
    if (!selectedModule || this.isModuleDisabled(selectedModule)) {
      return;
    }
    this.activeView = view;
    this.pushViewUrl(view);
    if (view === 'history') {
      this.loadHistory();
    }
  }

  isModuleDisabled(module: NavigationModule): boolean {
    return module.requiresResult && !this.result;
  }

  loadHistory(): void {
    this.historyLoading = true;
    this.api
      .listHistory()
      .pipe(finalize(() => (this.historyLoading = false)))
      .subscribe({
        next: (items) => {
          this.historyItems = items;
        },
        error: () => {
          this.snackBar.open('No se pudo cargar el historial de analisis.', 'Cerrar', { duration: 5000 });
        }
      });
  }

  openHistoryItem(item: ValidationHistoryItem): void {
    this.loadValidation(item.id, 'findings');
  }

  deleteHistoryItem(item: ValidationHistoryItem): void {
    const confirmed = window.confirm(`Eliminar el analisis de "${item.fileName}"?`);
    if (!confirmed) {
      return;
    }

    this.deletingHistoryId = item.id;
    this.api
      .deleteValidation(item.id)
      .pipe(finalize(() => (this.deletingHistoryId = undefined)))
      .subscribe({
        next: () => {
          this.historyItems = this.historyItems.filter((candidate) => candidate.id !== item.id);
          if (this.result?.id === item.id) {
            this.result = undefined;
            this.selectedFile = undefined;
            this.progress = 0;
            this.activeView = 'history';
            this.clearValidationUrl();
          }
          this.snackBar.open('Analisis eliminado del historial', 'Cerrar', { duration: 3500 });
        },
        error: () => {
          this.snackBar.open('No se pudo eliminar el analisis.', 'Cerrar', { duration: 5000 });
        }
      });
  }

  formatHistoryDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-AR');
  }

  private loadValidation(validationId: string, targetView?: ModuleView): void {
    this.analyzing = true;
    this.message = 'Cargando analisis guardado...';
    this.api
      .get(validationId)
      .pipe(finalize(() => (this.analyzing = false)))
      .subscribe({
        next: (result) => {
          this.result = result;
          this.selectedFile = undefined;
          this.progress = 100;
          this.message = '';
          this.activeView = targetView ?? this.viewFromUrl() ?? 'findings';
          this.pushValidationUrl(result.id);
        },
        error: () => {
          this.progress = 0;
          this.message = 'No se pudo recuperar el analisis solicitado.';
          this.snackBar.open(this.message, 'Cerrar', { duration: 5000 });
        }
      });
  }

  private pushValidationUrl(validationId: string): void {
    const url = new URL(window.location.href);
    url.searchParams.set('validationId', validationId);
    url.searchParams.set('view', this.activeView);
    window.history.replaceState({}, '', url.toString());
  }

  private pushViewUrl(view: ModuleView): void {
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    window.history.replaceState({}, '', url.toString());
  }

  private clearValidationUrl(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete('validationId');
    url.searchParams.set('view', this.activeView);
    window.history.replaceState({}, '', url.toString());
  }

  private viewFromUrl(): ModuleView | undefined {
    const view = new URLSearchParams(window.location.search).get('view');
    return this.isModuleView(view) ? view : undefined;
  }

  private isModuleView(view: string | null): view is ModuleView {
    return (
      view === 'upload' ||
      view === 'history' ||
      view === 'manual' ||
      view === 'findings'
    );
  }
}
