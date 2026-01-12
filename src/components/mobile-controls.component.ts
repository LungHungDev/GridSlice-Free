import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorStateService, AspectRatioOption } from '../services/editor-state.service';
import { ImageProcessorService } from '../services/image-processor.service';

type MobileTab = 'layers' | 'background' | 'ratio' | null;

@Component({
  selector: 'app-mobile-controls',
  standalone: true,
  imports: [CommonModule],
  template: `
      <!-- Top Header Bar -->
      <div class="lg:hidden absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 pointer-events-none">
        <!-- Logo -->
        <h1 class="text-xl font-black text-white/90 drop-shadow-md tracking-tighter pointer-events-auto select-none">GridSlice Free</h1>
        
        <!-- Top Actions -->
        <div class="flex items-center gap-3 pointer-events-auto">
           <button 
             (click)="state.resetAll()" 
             class="flex items-center gap-1.5 px-3 py-2 bg-gray-800/80 backdrop-blur text-white/90 rounded-full shadow-lg border border-gray-600/50 active:scale-95 transition-transform text-xs font-bold">
             <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
             新圖片
           </button>
           
           <button 
             (click)="processor.generateSlices()"
             class="flex items-center gap-1.5 px-4 py-2 bg-blue-600/90 backdrop-blur text-white rounded-full shadow-lg shadow-blue-900/40 border border-blue-400/30 active:scale-95 transition-transform text-xs font-bold">
             <span>導出</span>
             <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
           </button>
        </div>
      </div>

      <!-- Floating Controls Area -->
      <div class="lg:hidden absolute inset-0 z-40 pointer-events-none">
         <!-- Bottom Left: Reset View -->
         <div class="absolute bottom-40 left-4 pointer-events-auto">
            <button (click)="state.resetView()" class="w-10 h-10 bg-gray-800/80 backdrop-blur text-white rounded-full shadow-lg border border-gray-600/50 flex items-center justify-center active:bg-gray-700 transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            </button>
         </div>

         <!-- Bottom Right: Layer Up/Down (Only when layer active) -->
         @if (state.activeLayerId()) {
            <div class="absolute bottom-40 right-4 flex flex-col gap-2 pointer-events-auto animate-in fade-in zoom-in duration-200">
               <button (click)="state.bringToFront(state.activeLayerId()!)" class="w-10 h-10 bg-gray-800/90 backdrop-blur text-blue-400 rounded-full shadow-lg border border-gray-600/50 flex items-center justify-center active:bg-gray-700 active:scale-95 transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
               </button>
               <button (click)="state.sendToBack(state.activeLayerId()!)" class="w-10 h-10 bg-gray-800/90 backdrop-blur text-blue-400 rounded-full shadow-lg border border-gray-600/50 flex items-center justify-center active:bg-gray-700 active:scale-95 transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
               </button>
            </div>
         }
      </div>

      <!-- Main Bottom Control Panel (Persistent) -->
      <div class="lg:hidden absolute bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-xl border-t border-gray-800 pb-safe pt-2 px-3 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
        
         <!-- Row 1: Grid & Dimensions -->
         <div class="flex items-center gap-3 mb-3">
            <!-- Grid Controls -->
            <div class="flex-1 bg-gray-800/50 rounded-lg p-1.5 flex flex-col gap-1.5 border border-gray-700/50">
               <div class="flex items-center justify-between">
                  <span class="text-[10px] text-gray-400 px-1">直欄</span>
                  <div class="flex items-center gap-1">
                     <button (click)="state.updateGrid(-1, 0)" class="w-6 h-6 bg-gray-700 rounded text-white active:bg-gray-600">-</button>
                     <span class="text-xs font-bold w-4 text-center text-white">{{state.cols()}}</span>
                     <button (click)="state.updateGrid(1, 0)" class="w-6 h-6 bg-gray-700 rounded text-white active:bg-gray-600">+</button>
                  </div>
               </div>
               <div class="flex items-center justify-between">
                  <span class="text-[10px] text-gray-400 px-1">橫列</span>
                  <div class="flex items-center gap-1">
                     <button (click)="state.updateGrid(0, -1)" class="w-6 h-6 bg-gray-700 rounded text-white active:bg-gray-600">-</button>
                     <span class="text-xs font-bold w-4 text-center text-white">{{state.rows()}}</span>
                     <button (click)="state.updateGrid(0, 1)" class="w-6 h-6 bg-gray-700 rounded text-white active:bg-gray-600">+</button>
                  </div>
               </div>
            </div>

            <!-- Dimensions & Ratio -->
            <div class="flex-1 flex flex-col gap-2">
               <!-- Pixel Inputs -->
               <div class="flex items-center gap-1.5">
                  <div class="relative flex-1">
                     <span class="absolute left-1.5 top-1 text-gray-500 text-[9px]">W</span>
                     <input type="number" [value]="state.cellWidth()" (input)="updateSize($event, 'w')" class="w-full bg-gray-800 text-white text-[10px] pl-4 pr-1 py-1 rounded border border-gray-700 focus:border-blue-500 outline-none text-center">
                  </div>
                  <span class="text-gray-500 text-[10px]">x</span>
                  <div class="relative flex-1">
                     <span class="absolute left-1.5 top-1 text-gray-500 text-[9px]">H</span>
                     <input type="number" [value]="state.cellHeight()" (input)="updateSize($event, 'h')" class="w-full bg-gray-800 text-white text-[10px] pl-4 pr-1 py-1 rounded border border-gray-700 focus:border-blue-500 outline-none text-center">
                  </div>
               </div>
               
               <!-- Ratio Button -->
               <button (click)="toggleTab('ratio')" class="w-full py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs text-blue-400 font-bold flex items-center justify-center gap-1 transition-colors">
                  <span>{{ state.selectedRatio().label }}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
               </button>
            </div>
         </div>

         <!-- Row 2: Secondary Tools -->
         <div class="flex gap-2 h-10">
             <button (click)="toggleTab('layers')" class="flex-1 bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center gap-2 text-gray-300 active:bg-gray-700 transition-colors relative">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                <span class="text-xs font-bold">圖層</span>
                @if(state.layers().length > 0) { <span class="absolute top-2 right-4 w-1.5 h-1.5 bg-blue-500 rounded-full"></span> }
             </button>

             <button (click)="toggleTab('background')" class="flex-1 bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center gap-2 text-gray-300 active:bg-gray-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
                <span class="text-xs font-bold">背景</span>
             </button>
         </div>
      </div>

      <!-- Full Screen Backdrop for Popups -->
      @if (activeTab()) {
         <div class="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" (click)="activeTab.set(null)">
            
            <!-- Bottom Sheet Content -->
            <div class="absolute bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 rounded-t-2xl p-5 animate-in slide-in-from-bottom-10 duration-200" (click)="$event.stopPropagation()">
               
               <!-- Handle -->
               <div class="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-4"></div>

               <!-- Ratio Selector -->
               @if (activeTab() === 'ratio') {
                  <h3 class="text-sm font-bold text-white mb-3">選擇比例</h3>
                  <div class="grid grid-cols-4 gap-2">
                     @for (ratio of state.aspectRatios; track ratio.label) {
                       <button (click)="selectRatio(ratio)" 
                         [class.bg-blue-600]="state.selectedRatio() === ratio" 
                         [class.bg-gray-800]="state.selectedRatio() !== ratio"
                         class="py-2.5 rounded-lg border border-transparent transition-colors text-white text-xs font-bold">
                         {{ratio.label}}
                       </button>
                     }
                  </div>
               }

               <!-- Layers Panel -->
               @if (activeTab() === 'layers') {
                  <div class="flex justify-between items-center mb-3">
                     <h3 class="text-sm font-bold text-white">圖層管理</h3>
                     <label class="px-3 py-1 bg-blue-600 rounded text-xs text-white font-bold cursor-pointer">
                        <input type="file" class="hidden" (change)="onAddImages($event)" accept="image/*" multiple>
                        + 新增
                     </label>
                  </div>
                  <div class="space-y-2 max-h-[50vh] overflow-y-auto custom-scrollbar">
                     @for (layer of state.layers().slice().reverse(); track layer.id) {
                        <div class="flex items-center gap-3 p-2 bg-gray-800/50 rounded-lg border"
                             [class.border-blue-500]="state.activeLayerId() === layer.id"
                             [class.border-transparent]="state.activeLayerId() !== layer.id"
                             (click)="state.activeLayerId.set(layer.id)">
                           <img [src]="layer.url" class="w-10 h-10 object-cover rounded bg-gray-900">
                           <div class="flex-1 min-w-0">
                              <div class="text-xs text-gray-300 truncate">{{layer.file.name}}</div>
                           </div>
                           <button (click)="state.removeLayer(layer.id)" class="text-red-400 p-2 bg-gray-900/50 rounded">
                              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                           </button>
                        </div>
                     }
                     @if (state.layers().length === 0) {
                        <div class="py-8 text-center text-gray-500 text-xs">暫無圖層</div>
                     }
                  </div>
               }

               <!-- Background Settings -->
               @if (activeTab() === 'background') {
                  <h3 class="text-sm font-bold text-white mb-4">背景設定</h3>
                  <div class="space-y-4">
                     <div class="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                        <span class="text-sm text-gray-300">透明背景</span>
                        <input type="checkbox" [checked]="state.isTransparent()" (change)="toggleTransparency($event)" class="w-5 h-5 accent-blue-600">
                     </div>
                     @if(!state.isTransparent()) {
                        <div class="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                           <span class="text-sm text-gray-300">背景顏色</span>
                           <div class="flex items-center gap-2">
                              <span class="text-xs font-mono text-gray-400">{{ state.backgroundColor() }}</span>
                              <input type="color" [value]="state.backgroundColor()" (input)="updateBgColor($event)" class="h-8 w-12 rounded cursor-pointer border-none bg-transparent">
                           </div>
                        </div>
                     }
                  </div>
               }

            </div>
         </div>
      }
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

  selectRatio(ratio: AspectRatioOption) {
    this.state.setAspectRatio(ratio);
    this.activeTab.set(null);
  }

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

  toggleTransparency(e: Event) {
    this.state.isTransparent.set((e.target as HTMLInputElement).checked);
  }

  updateBgColor(e: Event) {
    this.state.backgroundColor.set((e.target as HTMLInputElement).value);
  }
}
