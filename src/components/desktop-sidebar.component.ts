import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorStateService, AspectRatioOption } from '../services/editor-state.service';
import { ImageProcessorService } from '../services/image-processor.service';

@Component({
  selector: 'app-desktop-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
      <aside class="hidden lg:flex w-80 h-full bg-gray-900 border-l border-gray-800 flex-col overflow-hidden shrink-0 z-40 relative shadow-2xl">
        <div class="p-6 space-y-8 overflow-y-auto custom-scrollbar flex-1 pb-6">
          
          <!-- Add Image -->
          <section>
             <button class="w-full py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-blue-500 rounded-lg text-sm text-white font-bold flex items-center justify-center gap-2 mb-2 transition-all relative overflow-hidden group shadow-lg">
                <input type="file" class="absolute inset-0 opacity-0 cursor-pointer z-10" (change)="onAddImages($event)" accept="image/*" multiple>
                <div class="p-1 bg-blue-600 rounded text-white group-hover:scale-110 transition-transform">
                   <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </div>
                新增圖片
             </button>
             <p class="text-[10px] text-gray-500 text-center">可拖曳圖片調整順序</p>
          </section>

          <!-- Layout -->
          <section>
            <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">版面設定 (Layout)</h3>
            <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 space-y-4">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[10px] text-gray-400 mb-1">直欄</label>
                  <div class="flex items-center gap-2">
                    <button (click)="state.updateGrid(-1, 0)" class="w-7 h-7 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white">-</button>
                    <span class="text-base font-bold w-4 text-center">{{state.cols()}}</span>
                    <button (click)="state.updateGrid(1, 0)" class="w-7 h-7 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white">+</button>
                  </div>
                </div>
                <div>
                  <label class="block text-[10px] text-gray-400 mb-1">橫列</label>
                  <div class="flex items-center gap-2">
                    <button (click)="state.updateGrid(0, -1)" class="w-7 h-7 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white">-</button>
                    <span class="text-base font-bold w-4 text-center">{{state.rows()}}</span>
                    <button (click)="state.updateGrid(0, 1)" class="w-7 h-7 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white">+</button>
                  </div>
                </div>
              </div>
              <div class="h-px bg-gray-700 my-2"></div>
              <div>
                 <div class="flex justify-between items-center mb-1">
                    <label class="text-[10px] text-gray-400">單格尺寸</label>
                    <span class="text-[10px] text-blue-400">總: {{ state.totalWidth() }}×{{ state.totalHeight() }}</span>
                 </div>
                 <div class="grid grid-cols-4 gap-1.5 mb-3">
                    @for (ratio of state.aspectRatios; track ratio.label) {
                      <button (click)="state.setAspectRatio(ratio)" [class.bg-blue-600]="state.selectedRatio() === ratio" [class.bg-gray-700]="state.selectedRatio() !== ratio" class="px-1 py-1 text-[10px] rounded border border-transparent hover:border-gray-500 transition-all text-center">{{ ratio.label }}</button>
                    }
                 </div>
                 <div class="flex items-center gap-2 mb-2">
                   <div class="flex-1 relative">
                     <span class="absolute left-2 top-1.5 text-gray-500 text-[10px]">W</span>
                     <input type="number" [value]="state.cellWidth()" (input)="updateSize($event, 'w')" class="w-full bg-gray-900 text-white text-xs pl-6 pr-2 py-1.5 rounded border border-gray-600 focus:border-blue-500 outline-none">
                   </div>
                   <div class="flex-1 relative">
                     <span class="absolute left-2 top-1.5 text-gray-500 text-[10px]">H</span>
                     <input type="number" [value]="state.cellHeight()" (input)="updateSize($event, 'h')" class="w-full bg-gray-900 text-white text-xs pl-6 pr-2 py-1.5 rounded border border-gray-600 focus:border-blue-500 outline-none">
                   </div>
                 </div>
              </div>
            </div>
          </section>

          <!-- Layers -->
          <section>
             <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 items-center gap-2">圖層管理</h3>
             <div class="space-y-2">
               @if (state.activeLayer(); as layer) {
                 <div class="bg-gray-800 p-3 rounded-lg border border-blue-900/50 ring-1 ring-blue-500/30 mb-4">
                    <div class="flex justify-between mb-2">
                       <span class="text-xs font-bold text-blue-400">當前: {{layer.file.name}}</span>
                       <button (click)="state.removeLayer(layer.id)" class="text-red-400 hover:text-red-300"><svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                    </div>
                    <div class="space-y-2">
                        <div class="flex items-center gap-2">
                          <span class="text-[10px] text-gray-400 w-6">縮放</span>
                          <input type="range" min="0.05" max="3" step="0.01" [value]="layer.scale" (input)="updateScale($event, layer.id)" class="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500">
                        </div>
                        <div class="flex gap-2">
                           <button (click)="state.bringToFront(layer.id)" class="flex-1 py-1 text-[10px] bg-gray-700 rounded hover:bg-gray-600">移至最前</button>
                           <button (click)="state.sendToBack(layer.id)" class="flex-1 py-1 text-[10px] bg-gray-700 rounded hover:bg-gray-600">移至最後</button>
                        </div>
                    </div>
                 </div>
               }
               <div class="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                  @for (layer of state.layers().slice().reverse(); track layer.id) {
                     <div class="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-800 transition-colors"
                          [class.bg-gray-800]="state.activeLayerId() === layer.id"
                          [class.text-blue-400]="state.activeLayerId() === layer.id"
                          [class.text-gray-400]="state.activeLayerId() !== layer.id"
                          (click)="state.activeLayerId.set(layer.id)">
                        <img [src]="layer.url" class="w-8 h-8 rounded object-cover bg-gray-700">
                        <span class="text-xs truncate flex-1">{{layer.file.name}}</span>
                     </div>
                  }
               </div>
             </div>
          </section>

          <!-- Settings -->
          <section>
             <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 items-center gap-2">設定</h3>
             <div class="bg-gray-800 p-3 rounded-lg border border-gray-700 space-y-3">
                <div class="flex items-center gap-3">
                   <label class="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" [checked]="state.isTransparent()" (change)="toggleTransparency($event)" class="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600">
                      <span class="text-xs text-gray-300">透明背景</span>
                   </label>
                   @if (!state.isTransparent()) {
                     <div class="flex items-center gap-2 flex-1">
                        <input type="color" [value]="state.backgroundColor()" (input)="updateBgColor($event)" class="h-6 w-8 p-0 border-0 rounded bg-transparent cursor-pointer">
                        <span class="text-xs text-gray-400 font-mono">{{ state.backgroundColor() }}</span>
                     </div>
                   }
                </div>
                <div>
                   <div class="flex justify-between mb-1">
                      <label class="text-[10px] text-gray-400">視野縮放</label>
                      <span class="text-[10px] font-mono text-blue-400">{{ (state.viewZoom() * 100).toFixed(0) }}%</span>
                   </div>
                   <input type="range" min="0.1" max="2.0" step="0.05" [value]="state.viewZoom()" (input)="updateZoom($event)" class="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-gray-400">
                </div>
             </div>
          </section>

          <button (click)="processor.generateSlices()" class="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg shadow-blue-900/50 transition-all transform active:scale-95 flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.5 19c0-1.7-1.3-3-3-3h-11"/><path d="M13 22l4.5-3L13 16"/><path d="M6 16V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v7"/></svg>
            開始切割圖片
          </button>
        </div>
      </aside>
  `
})
export class DesktopSidebarComponent {
  state = inject(EditorStateService);
  processor = inject(ImageProcessorService);

  onAddImages(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.processor.processFiles(Array.from(input.files));
      input.value = '';
    }
  }

  updateSize(e: Event, dim: 'w' | 'h') {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    this.state.updateCellSize(dim, val);
  }

  updateScale(e: Event, id: string) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    this.state.updateLayer(id, { scale: val });
  }

  toggleTransparency(e: Event) {
    this.state.isTransparent.set((e.target as HTMLInputElement).checked);
  }

  updateBgColor(e: Event) {
    this.state.backgroundColor.set((e.target as HTMLInputElement).value);
  }

  updateZoom(e: Event) {
    this.state.viewZoom.set(parseFloat((e.target as HTMLInputElement).value));
  }
}
