import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { AppComponent } from './app.component';
import { MaterialModule } from './material.module';
import { FormulaValidationPageComponent } from './features/formula-validation/pages/formula-validation-page.component';
import { IssuesTableComponent } from './features/formula-validation/components/issues-table/issues-table.component';
import { IssueDetailDialogComponent } from './features/formula-validation/dialogs/issue-detail-dialog.component';
import { FormulaTranslatorComponent } from './features/formula-validation/components/formula-translator/formula-translator.component';
import { UploadPanelComponent } from './features/formula-validation/components/upload-panel/upload-panel.component';

@NgModule({
  declarations: [
    AppComponent,
    FormulaValidationPageComponent,
    IssuesTableComponent,
    IssueDetailDialogComponent,
    FormulaTranslatorComponent,
    UploadPanelComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    ReactiveFormsModule,
    MaterialModule
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
