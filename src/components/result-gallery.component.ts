import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorStateService } from '../services/editor-state.service';
import { ImageProcessorService } from '../services/image-processor.service';

@Component({
  selector: 'app-result-gallery',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex-1 overflow-y-auto p-4 lg:p-8 bg-gray-950 z-50 h-full">
        <div class="max-w-5xl mx-auto pb-20 lg:pb-0">
           <div class="flex flex-col gap-6 mb-6">
             <div>
                <h2 class="text-xl lg:text-2xl font-bold text-white">切割完成！</h2>
                <p class="text-xs lg:text-sm text-gray-400 mt-1">共 {{ state.generatedSlices().length }} 張圖片 ({{state.cellWidth()}} x {{state.cellHeight()}} px / 張)</p>
             </div>
             <div class="flex flex-col gap-2">
               <div class="flex gap-3 items-stretch h-12">
                 <button (click)="clearResults()" class="flex-1 px-4 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg shadow-lg">繼續編輯</button>
                 <button (click)="downloadAll()" class="flex-[2] px-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg shadow-lg flex justify-center items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    下載全部 (ZIP)
                 </button>
               </div>
             </div>
           </div>
           
           <div class="grid gap-3 lg:gap-4 bg-checkerboard/30 p-4 rounded-xl border border-gray-800" [style.grid-template-columns]="'repeat(' + state.cols() + ', minmax(0, 1fr))'">
              @for (slice of state.generatedSlices(); track $index) {
                 <div class="group relative bg-transparent rounded-lg overflow-hidden border border-gray-700/50 w-full shadow-lg" style="font-size: 0;" [style.aspect-ratio]="finalAspectRatio()">
                    <img [src]="slice" class="w-full h-full object-cover">
                    <a [href]="slice" [download]="getDownloadName($index)" class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 text-base">
                       <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </a>
                    <div class="absolute top-1 left-1 lg:top-2 lg:left-2 bg-black/50 text-white text-[10px] lg:text-xs px-1.5 py-0.5 lg:py-1 rounded z-10 font-sans">#{{ $index + 1 }}</div>
                 </div>
              }
           </div>
        </div>
      </div>
  `
})
export class ResultGalleryComponent {
  state = inject(EditorStateService);
  processor = inject(ImageProcessorService);

  filenamePrefix = computed(() => {
    // Generate simple default if no files, or based on first file
    const layers = this.state.layers();
    let base = 'collage';
    if (layers.length > 0) {
        base = layers[0].file.name.replace(/\.[^/.]+$/, "");
    }
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14); 
    const formattedTs = `${timestamp.slice(0, 8)}-${timestamp.slice(8)}`;
    return `${base}_${formattedTs}`;
  });

  finalAspectRatio = computed(() => `${this.state.cellWidth()} / ${this.state.cellHeight()}`);

  clearResults() {
    this.state.generatedSlices.set([]);
  }

  getDownloadName(index: number) {
     const ext = this.state.isTransparent() ? 'png' : 'jpg';
     return `${this.filenamePrefix()}_slice_${index + 1}.${ext}`;
  }

  downloadAll() {
    this.processor.downloadAll(this.filenamePrefix());
  }
}
