import { HttpClient, HttpEvent } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  FormulaManualResponse,
  ValidationHistoryItem,
  ValidationIssue,
  ValidationResult
} from '../models/validation.models';

@Injectable({ providedIn: 'root' })
export class ValidationApiService {
  private readonly baseUrl = `${environment.apiUrl}/validations`;

  constructor(private readonly http: HttpClient) {}

  analyze(file: File): Observable<HttpEvent<ValidationResult>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ValidationResult>(this.baseUrl, formData, {
      observe: 'events',
      reportProgress: true
    });
  }

  get(validationId: string): Observable<ValidationResult> {
    return this.http.get<ValidationResult>(`${this.baseUrl}/${validationId}`);
  }

  listHistory(): Observable<ValidationHistoryItem[]> {
    return this.http.get<ValidationHistoryItem[]>(this.baseUrl);
  }

  deleteValidation(validationId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${validationId}`);
  }

  downloadUrl(validationId: string, format: 'json' | 'csv' | 'xlsx' | 'issues-xlsx'): string {
    return `${this.baseUrl}/${validationId}/export/${format}`;
  }

  explainIssue(validationId: string, issueId: string): Observable<ValidationIssue> {
    return this.http.post<ValidationIssue>(`${this.baseUrl}/${validationId}/issues/${issueId}/explain`, {});
  }

  getManual(validationId: string): Observable<FormulaManualResponse> {
    return this.http.get<FormulaManualResponse>(`${this.baseUrl}/${validationId}/manual`);
  }
}
