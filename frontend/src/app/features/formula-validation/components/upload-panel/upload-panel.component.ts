import { Component, EventEmitter, HostBinding, Input, Output } from '@angular/core';

@Component({
  selector: 'app-upload-panel',
  templateUrl: './upload-panel.component.html',
  styleUrls: ['./upload-panel.component.scss']
})
export class UploadPanelComponent {
  @Input() selectedFile?: File;
  @Input() progress = 0;
  @Input() analyzing = false;
  @Input() message = '';
  @Output() fileSelected = new EventEmitter<File>();
  @Output() fileRemoved = new EventEmitter<void>();
  @Output() analyzeRequested = new EventEmitter<void>();

  @HostBinding('class') hostClass = 'block';
  dragging = false;

  get fileSize(): string {
    if (!this.selectedFile) {
      return '';
    }
    const mb = this.selectedFile.size / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  }

  handleInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    if (file) {
      this.fileSelected.emit(file);
      input.value = '';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging = true;
  }

  onDragLeave(): void {
    this.dragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging = false;
    const file = event.dataTransfer?.files.item(0);
    if (file) {
      this.fileSelected.emit(file);
    }
  }
}

