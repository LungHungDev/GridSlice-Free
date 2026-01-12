import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SplitterEditorComponent } from './components/splitter-editor.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SplitterEditorComponent],
  templateUrl: './app.component.html',
  styles: []
})
export class AppComponent {
  // We now store a list of files/urls to pass to the editor initially
  initialFiles = signal<File[]>([]);
  showEditor = signal(false);

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFiles(Array.from(input.files));
    }
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.processFiles(Array.from(event.dataTransfer.files));
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  processFiles(files: File[]) {
    const validFiles = files.filter(f => f.type.match(/image\/(png|jpeg|jpg)/));
    
    if (validFiles.length === 0) {
      alert('不支援的檔案格式！\n請上傳 JPG, JPEG 或 PNG 圖片。');
      return;
    }
    
    // If editor is already open, we might want to handle it differently, 
    // but for now, the main drop zone initializes the editor.
    this.initialFiles.set(validFiles);
    this.showEditor.set(true);
  }

  reset() {
    this.initialFiles.set([]);
    this.showEditor.set(false);
  }
}