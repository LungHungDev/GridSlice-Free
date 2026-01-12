import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorStateService } from '../services/editor-state.service';
import { ImageProcessorService } from '../services/image-processor.service';

type MobileTab = 'layout' | 'layers' | 'settings' | null;

@Component({
  selector: 'app-mobile-controls',
  standalone: true,
  imports: [CommonModule],
  template: `
      <!-- Watermark -->
      <div class="lg:hidden absolute top-12 left-6 z-40 pointer-events-none select-none">
        <h1 class="text-xl font-black text-white/10 tracking-tighter">GridSlice Free</h1>
      </div>

      <!-- Action FAB -->
      <div class="lg:hidden absolute top-4 right-4 z-50">
        <button 
          (click)="processor.generateSlices()"
          class="flex items-center gap-2 px-4 py-2.5 bg-blue-600/90 backdrop-blur text-white rounded-full shadow-lg shadow-blue-900/40 active:scale-95 transition-transform font-bold text-sm border border-blue-400/30">
          <span>切割導出</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
      </div>

      <!-- Bottom Controls -->
      <div class="lg:hidden absolute bottom-8 left-0 right-0 z-50 flex flex-col items-center justify-end pointer-events-none">
        
        <!-- Backdrop for close -->
        @if (activeTab()) {
           <div class="fixed inset-0 pointer-events-auto" (click)="activeTab.set(null)"></div>
        }

        <!-- Popup -->
        @if (activeTab()) {
          <div class="pointer-events-auto mb-4 w-[90%] max-w-sm bg-gray-900/90 backdrop-blur-md border border-gray-700/50 rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-5 fade-in duration-200 relative z-10" (click)="$event.stopPropagation()">
            <div class="flex justify-between items-center mb-4 border-b border-gray-700/50 pb-2">
              <span class="text-sm font-bold text-gray-200">{{ getTitle() }}</span>
              <button (click)="activeTab.set(null)" class="p-1 text-gray-400 hover:text-white bg-gray-800 rounded-full">
                 <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            @if (activeTab() === 'layout') {
               <div class="space-y-4">
                  <div class="flex justify-between items-center bg-gray-800/50 p-2 rounded-lg">
                    <div class="flex items-center gap-2">
                       <span class="text-xs text-gray-400">直欄</span>
                       <button (click)="state.updateGrid(-1, 0)" class="w-6 h-6 bg-gray-700 rounded text-white">-</button>
                       <span class="font-bold w-4 text-center">{{state.cols()}}</span>
                       <button (click)="state.updateGrid(1, 0)" class="w-6 h-6 bg-gray-700 rounded text-white">+</button>
                    </div>
                    <div class="w-px h-6 bg-gray-700"></div>
                    <div class="flex items-center gap-2">
                       <span class="text-xs text-gray-400">橫列</span>
                       <button (click)="state.updateGrid(0, -1)" class="w-6 h-6 bg-gray-700 rounded text-white">-</button>
                       <span class="font-bold w-4 text-center">{{state.rows()}}</span>
                       <button (click)="state.updateGrid(0, 1)" class="w-6 h-6 bg-gray-700 rounded text-white">+</button>
                    </div>
                  </div>
                  <div class="grid grid-cols-4 gap-2">
                     @for (ratio of state.aspectRatios; track ratio.label) {
                       <button (click)="state.setAspectRatio(ratio)" 
                         [class.bg-blue-600]="state.selectedRatio() === ratio" 
                         [class.bg-gray-800]="state.selectedRatio() !== ratio"
                         class="text-[10px] py-1.5 rounded border border-transparent transition-colors text-white">
                         {{ratio.label}}
                       </button>
                     }
                  </div>
               </div>
            }

            @if (activeTab() === 'layers') {
              <div class="space-y-3 max-h-[40vh] overflow-y-auto custom-scrollbar">
                 <label class="block w-full py-3 border-2 border-dashed border-gray-600 hover:border-blue-500 rounded-xl text-center cursor-pointer active:bg-gray-800 transition-colors">
                    <input type="file" class="hidden" (change)="onAddImages($event)" accept="image/*" multiple>
                    <span class="text-sm text-blue-400 font-bold">+ 新增圖片</span>
                 </label>

                 @for (layer of state.layers().slice().reverse(); track layer.id) {
                    <div class="flex items-center gap-3 p-2 bg-gray-800/50 rounded-lg border"
                         [class.border-blue-500]="state.activeLayerId() === layer.id"
                         [class.border-transparent]="state.activeLayerId() !== layer.id"
                         (click)="state.activeLayerId.set(layer.id)">
                       <img [src]="layer.url" class="w-10 h-10 object-cover rounded bg-gray-900">
                       <div class="flex-1 min-w-0">
                          <div class="text-xs text-gray-300 truncate">{{layer.file.name}}</div>
                          <div class="flex items-center gap-2 mt-1">
                             <button (click)="state.bringToFront(layer.id)" class="text-[10px] text-gray-500 bg-gray-900 px-1.5 rounded">移前</button>
                             <button (click)="state.sendToBack(layer.id)" class="text-[10px] text-gray-500 bg-gray-900 px-1.5 rounded">移後</button>
                          </div>
                       </div>
                       <button (click)="state.removeLayer(layer.id)" class="text-red-400 p-2">
                          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                       </button>
                    </div>
                 }
              </div>
            }

            @if (activeTab() === 'settings') {
               <div class="space-y-4">
                  <div class="flex items-center justify-between">
                     <span class="text-sm text-gray-300">透明背景</span>
                     <input type="checkbox" [checked]="state.isTransparent()" (change)="toggleTransparency($event)" class="w-5 h-5 accent-blue-600">
                  </div>
                  @if(!state.isTransparent()) {
                     <div class="flex items-center justify-between">
                        <span class="text-sm text-gray-300">背景顏色</span>
                        <input type="color" [value]="state.backgroundColor()" (input)="updateBgColor($event)" class="h-8 w-12 rounded cursor-pointer">
                     </div>
                  }
                  <button (click)="state.resetView()" class="w-full py-2 bg-gray-800 rounded text-xs text-gray-400">重置視野位置</button>
               </div>
            }
          </div>
        }

        <!-- Tab Bar -->
        <div class="pointer-events-auto flex items-center gap-6 bg-gray-900/80 backdrop-blur rounded-full px-6 py-3 border border-gray-800 shadow-2xl relative z-20">
          <button (click)="toggleTab('layout')" [class.text-blue-400]="activeTab() === 'layout'" class="flex flex-col items-center gap-1 text-gray-400 transition-colors">
             <div class="p-2 rounded-full" [class.bg-blue-500/20]="activeTab() === 'layout'">
               <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
             </div>
             <span class="text-[10px] font-bold">佈局</span>
          </button>
          
          <button (click)="toggleTab('layers')" [class.text-blue-400]="activeTab() === 'layers'" class="flex flex-col items-center gap-1 text-gray-400 transition-colors relative">
             <div class="p-2 rounded-full" [class.bg-blue-500/20]="activeTab() === 'layers'">
               <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
             </div>
             <span class="text-[10px] font-bold">圖層</span>
             @if(state.layers().length > 0) { <span class="absolute top-1 right-2 w-1.5 h-1.5 bg-blue-500 rounded-full"></span> }
          </button>

          <button (click)="toggleTab('settings')" [class.text-blue-400]="activeTab() === 'settings'" class="flex flex-col items-center gap-1 text-gray-400 transition-colors">
             <div class="p-2 rounded-full" [class.bg-blue-500/20]="activeTab() === 'settings'">
               <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
             </div>
             <span class="text-[10px] font-bold">設定</span>
          </button>
        </div>
      </div>
  `
})
export class MobileControlsComponent {
  state = inject(EditorStateService);
  processor = inject(ImageProcessorService);

  activeTab = signal<MobileTab>(null);

  toggleTab(tab: MobileTab) {
    if (this.activeTab() === tab) {
      this.activeTab.set(null);
    } else {
      this.activeTab.set(tab);
    }
  }

  getTitle() {
    switch(this.activeTab()) {
      case 'layout': return '版面設定';
      case 'layers': return '圖層管理';
      case 'settings': return '顯示設定';
      default: return '';
    }
  }

  onAddImages(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.processor.processFiles(Array.from(input.files));
      input.value = '';
    }
  }

  toggleTransparency(e: Event) {
    this.state.isTransparent.set((e.target as HTMLInputElement).checked);
  }

  updateBgColor(e: Event) {
    this.state.backgroundColor.set((e.target as HTMLInputElement).value);
  }
}
