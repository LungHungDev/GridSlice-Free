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
  selectedFile = signal<File | null>(null);
  imageUrl = signal<string | null>(null);

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFile(input.files[0]);
    }
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.processFile(event.dataTransfer.files[0]);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  processFile(file: File) {
    if (!file.type.match(/image\/(png|jpeg|jpg)/)) {
      alert('不支援的檔案格式！\n請上傳 JPG, JPEG 或 PNG 圖片。');
      return;
    }
    
    this.selectedFile.set(file);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      this.imageUrl.set(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  reset() {
    this.selectedFile.set(null);
    this.imageUrl.set(null);
  }
}