import { Component, computed, effect, input, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import JSZip from 'jszip';

interface AspectRatioOption {
  label: string;
  w: number;
  h: number;
}

interface ImageLayer {
  id: string;
  file: File;
  url: string;
  imgElement: HTMLImageElement;
  x: number;
  y: number;
  scale: number;
  originalWidth: number;
  originalHeight: number;
  zIndex: number;
}

type MobileTab = 'layout' | 'layers' | 'settings' | null;

@Component({
  selector: 'app-splitter-editor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Main Container -->
    <div class="h-full w-full bg-gray-950 relative overflow-hidden flex flex-col lg:flex-row">

      <!-- ========================================== -->
      <!-- MOBILE UI OVERLAY (lg:hidden)              -->
      <!-- ========================================== -->
      
      <!-- 1. Watermark Title (Fixed Top Left) -->
      <div class="lg:hidden absolute top-12 left-6 z-40 pointer-events-none select-none">
        <h1 class="text-xl font-black text-white/10 tracking-tighter">GridSlice Free</h1>
      </div>

      <!-- 2. Slice/Export FAB (Fixed Top Right) -->
      <div class="lg:hidden absolute top-4 right-4 z-50" [class.hidden]="generatedSlices().length > 0">
        <button 
          (click)="generateSlices()"
          class="flex items-center gap-2 px-4 py-2.5 bg-blue-600/90 backdrop-blur text-white rounded-full shadow-lg shadow-blue-900/40 active:scale-95 transition-transform font-bold text-sm border border-blue-400/30">
          <span>切割導出</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
      </div>

      <!-- 3. Bottom Floating Controls -->
      <div class="lg:hidden absolute bottom-8 left-0 right-0 z-50 flex flex-col items-center justify-end pointer-events-none" [class.hidden]="generatedSlices().length > 0">
        
        <!-- Bubble Popup (Content) -->
        @if (activeMobileTab()) {
          <div class="pointer-events-auto mb-4 w-[90%] max-w-sm bg-gray-900/90 backdrop-blur-md border border-gray-700/50 rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-5 fade-in duration-200">
            
            <!-- Popup Header -->
            <div class="flex justify-between items-center mb-4 border-b border-gray-700/50 pb-2">
              <span class="text-sm font-bold text-gray-200">{{ getMobileTabTitle() }}</span>
              <button (click)="closeMobileMenu()" class="p-1 text-gray-400 hover:text-white bg-gray-800 rounded-full">
                 <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <!-- Content: Layout -->
            @if (activeMobileTab() === 'layout') {
               <div class="space-y-4">
                  <!-- Grid -->
                  <div class="flex justify-between items-center bg-gray-800/50 p-2 rounded-lg">
                    <div class="flex items-center gap-2">
                       <span class="text-xs text-gray-400">直欄</span>
                       <button (click)="updateCols(-1)" class="w-6 h-6 bg-gray-700 rounded text-white">-</button>
                       <span class="font-bold w-4 text-center">{{cols()}}</span>
                       <button (click)="updateCols(1)" class="w-6 h-6 bg-gray-700 rounded text-white">+</button>
                    </div>
                    <div class="w-px h-6 bg-gray-700"></div>
                    <div class="flex items-center gap-2">
                       <span class="text-xs text-gray-400">橫列</span>
                       <button (click)="updateRows(-1)" class="w-6 h-6 bg-gray-700 rounded text-white">-</button>
                       <span class="font-bold w-4 text-center">{{rows()}}</span>
                       <button (click)="updateRows(1)" class="w-6 h-6 bg-gray-700 rounded text-white">+</button>
                    </div>
                  </div>
                  <!-- Ratios -->
                  <div class="grid grid-cols-4 gap-2">
                     @for (ratio of aspectRatios; track ratio.label) {
                       <button (click)="setAspectRatio(ratio)" 
                         [class.bg-blue-600]="selectedRatio() === ratio" 
                         [class.bg-gray-800]="selectedRatio() !== ratio"
                         class="text-[10px] py-1.5 rounded border border-transparent transition-colors text-white">
                         {{ratio.label}}
                       </button>
                     }
                  </div>
               </div>
            }

            <!-- Content: Layers -->
            @if (activeMobileTab() === 'layers') {
              <div class="space-y-3 max-h-[40vh] overflow-y-auto custom-scrollbar">
                 <label class="block w-full py-3 border-2 border-dashed border-gray-600 hover:border-blue-500 rounded-xl text-center cursor-pointer active:bg-gray-800 transition-colors">
                    <input type="file" class="hidden" (change)="onAddImages($event)" accept="image/*" multiple>
                    <span class="text-sm text-blue-400 font-bold">+ 新增圖片</span>
                 </label>

                 @for (layer of layers().slice().reverse(); track layer.id) {
                    <div class="flex items-center gap-3 p-2 bg-gray-800/50 rounded-lg border"
                         [class.border-blue-500]="activeLayerId() === layer.id"
                         [class.border-transparent]="activeLayerId() !== layer.id"
                         (click)="activeLayerId.set(layer.id)">
                       <img [src]="layer.url" class="w-10 h-10 object-cover rounded bg-gray-900">
                       <div class="flex-1 min-w-0">
                          <div class="text-xs text-gray-300 truncate">{{layer.file.name}}</div>
                          <div class="flex items-center gap-2 mt-1">
                             <button (click)="bringToFront(layer.id)" class="text-[10px] text-gray-500 bg-gray-900 px-1.5 rounded">移前</button>
                             <button (click)="sendToBack(layer.id)" class="text-[10px] text-gray-500 bg-gray-900 px-1.5 rounded">移後</button>
                          </div>
                       </div>
                       <button (click)="removeLayer(layer.id)" class="text-red-400 p-2">
                          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                       </button>
                    </div>
                 }
              </div>
            }

            <!-- Content: Settings -->
            @if (activeMobileTab() === 'settings') {
               <div class="space-y-4">
                  <div class="flex items-center justify-between">
                     <span class="text-sm text-gray-300">透明背景</span>
                     <input type="checkbox" [checked]="isTransparent()" (change)="toggleTransparency($event)" class="w-5 h-5 accent-blue-600">
                  </div>
                  @if(!isTransparent()) {
                     <div class="flex items-center justify-between">
                        <span class="text-sm text-gray-300">背景顏色</span>
                        <input type="color" [value]="backgroundColor()" (input)="updateBackgroundColor($event)" class="h-8 w-12 rounded cursor-pointer">
                     </div>
                  }
                  <button (click)="resetViewZoom()" class="w-full py-2 bg-gray-800 rounded text-xs text-gray-400">重置視野位置</button>
               </div>
            }

          </div>
        }

        <!-- Bottom FABs Row -->
        <div class="pointer-events-auto flex items-center gap-6 bg-gray-900/80 backdrop-blur rounded-full px-6 py-3 border border-gray-800 shadow-2xl">
          <button (click)="toggleMobileTab('layout')" [class.text-blue-400]="activeMobileTab() === 'layout'" class="flex flex-col items-center gap-1 text-gray-400 transition-colors">
             <div class="p-2 rounded-full" [class.bg-blue-500/20]="activeMobileTab() === 'layout'">
               <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
             </div>
             <span class="text-[10px] font-bold">佈局</span>
          </button>
          
          <button (click)="toggleMobileTab('layers')" [class.text-blue-400]="activeMobileTab() === 'layers'" class="flex flex-col items-center gap-1 text-gray-400 transition-colors relative">
             <div class="p-2 rounded-full" [class.bg-blue-500/20]="activeMobileTab() === 'layers'">
               <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
             </div>
             <span class="text-[10px] font-bold">圖層</span>
             @if(layers().length > 0) { <span class="absolute top-1 right-2 w-1.5 h-1.5 bg-blue-500 rounded-full"></span> }
          </button>

          <button (click)="toggleMobileTab('settings')" [class.text-blue-400]="activeMobileTab() === 'settings'" class="flex flex-col items-center gap-1 text-gray-400 transition-colors">
             <div class="p-2 rounded-full" [class.bg-blue-500/20]="activeMobileTab() === 'settings'">
               <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
             </div>
             <span class="text-[10px] font-bold">設定</span>
          </button>
        </div>
      </div>


      <!-- ========================================== -->
      <!-- DESKTOP / SHARED EDITOR AREA               -->
      <!-- ========================================== -->

      <main class="flex-1 relative bg-gray-900 overflow-hidden flex flex-col w-full h-full min-h-0">
        
        <!-- Desktop Header (lg:flex) -->
        <div class="hidden lg:flex h-12 border-b border-gray-800 items-center px-4 justify-between bg-gray-900/50 backdrop-blur shrink-0 z-30 absolute top-0 left-0 right-0 pointer-events-none">
          <div class="flex items-center gap-2 pointer-events-auto">
             <!-- Info Only -->
          </div>
          <div class="flex gap-4 text-xs pointer-events-auto">
             <!-- Status Only -->
          </div>
        </div>

        <!-- The Editor Stage -->
        @if (!generatedSlices().length) {
          
          <div class="flex-1 relative overflow-hidden flex items-center justify-center bg-gray-950 select-none cursor-grab active:cursor-grabbing touch-none"
               (mousedown)="bgMouseDown($event)"
               (wheel)="onWheelZoom($event)"
               (touchstart)="onContainerTouchStart($event)"
               (touchmove)="onContainerTouchMove($event)"
               (touchend)="onContainerTouchEnd($event)">
            
            <!-- Dark Checkerboard Background (Outside the Canvas) -->
            <div class="absolute inset-0 z-0 bg-gray-950 opacity-100 pointer-events-none">
               <div class="absolute inset-0 bg-checkerboard opacity-20"></div>
            </div>

            <!-- Mobile Backdrop (Invisible but closes menu) -->
            @if (activeMobileTab() && windowWidth() < 1024) {
              <div class="absolute inset-0 z-30" (touchstart)="closeMobileMenu()" (mousedown)="closeMobileMenu()"></div>
            }
            
            <!-- Editor View -->
            <div class="relative flex items-center justify-center w-full h-full p-4 lg:p-8 overflow-visible z-10"
                 [style.transform]="'translate(' + viewTranslateX() + 'px, ' + viewTranslateY() + 'px)'">
            
                <div 
                  class="relative flex-shrink-0 transition-transform duration-75 ease-out origin-center shadow-2xl"
                  [style.width.px]="displayDims().width"
                  [style.height.px]="displayDims().height"
                  [style.transform]="'scale(' + viewZoom() + ')'">
                  
                  <!-- Canvas Background -->
                  <div class="absolute inset-0 z-0 bg-checkerboard"></div>
                  @if (!isTransparent()) {
                      <div class="absolute inset-0 z-0" [style.background-color]="backgroundColor()"></div>
                  }

                  <!-- Layers -->
                  <div class="absolute inset-0 z-10">
                      @for (layer of layers(); track layer.id) {
                        <div
                            class="absolute origin-top-left will-change-transform"
                            [class.ring-1]="activeLayerId() === layer.id"
                            [class.ring-blue-400]="activeLayerId() === layer.id"
                            [style.z-index]="layer.zIndex"
                            [style.left.px]="layer.x * displayScale()"
                            [style.top.px]="layer.y * displayScale()"
                            [style.width.px]="layer.originalWidth * layer.scale * displayScale()"
                            [style.height.px]="layer.originalHeight * layer.scale * displayScale()"
                            (mousedown)="startDrag($event, layer.id)"
                            (touchstart)="layerTouchStart($event, layer.id)">
                             <img 
                                [src]="layer.url" 
                                class="w-full h-full object-contain pointer-events-none"
                                [class.opacity-50]="activeLayerId() !== layer.id && activeLayerId() !== null"
                                [class.opacity-100]="activeLayerId() === layer.id || activeLayerId() === null"
                                alt="layer">
                        </div>
                      }
                  </div>

                   <!-- Guides -->
                   <div 
                      class="absolute inset-0 z-20 pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] border border-white/20">
                      @for (i of colArray(); track i) {
                        <div class="absolute top-0 bottom-0 border-l border-dashed border-white/60 shadow-[0_0_2px_black]" [style.left.%]="(i / cols()) * 100"></div>
                      }
                      @for (j of rowArray(); track j) {
                        <div class="absolute left-0 right-0 border-t border-dashed border-white/60 shadow-[0_0_2px_black]" [style.top.%]="(j / rows()) * 100"></div>
                      }
                   </div>
                   
                   <!-- Snap Lines -->
                   @if(isSnappingX()){ <div class="absolute inset-y-0 w-px bg-yellow-400 z-30 shadow-[0_0_4px_yellow]" [style.left.px]="snapXPos() * displayScale()"></div> }
                   @if(isSnappingY()){ <div class="absolute inset-x-0 h-px bg-yellow-400 z-30 shadow-[0_0_4px_yellow]" [style.top.px]="snapYPos() * displayScale()"></div> }

                </div>
            </div>
            
          </div>
        } @else {
          <!-- Results View (Shared) -->
          <div class="flex-1 overflow-y-auto p-4 lg:p-8 bg-gray-950 z-50">
            <div class="max-w-5xl mx-auto pb-20 lg:pb-0">
               <div class="flex flex-col gap-6 mb-6">
                 <div>
                    <h2 class="text-xl lg:text-2xl font-bold text-white">切割完成！</h2>
                    <p class="text-xs lg:text-sm text-gray-400 mt-1">共 {{ generatedSlices().length }} 張圖片 ({{cellWidth()}} x {{cellHeight()}} px / 張)</p>
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
               
               <div class="grid gap-3 lg:gap-4 bg-checkerboard/30 p-4 rounded-xl border border-gray-800" [style.grid-template-columns]="'repeat(' + cols() + ', minmax(0, 1fr))'">
                  @for (slice of generatedSlices(); track $index) {
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
        }
      </main>

      <!-- ========================================== -->
      <!-- DESKTOP SIDEBAR (lg:flex)                  -->
      <!-- ========================================== -->
      <aside 
        class="hidden lg:flex w-80 h-full bg-gray-900 border-l border-gray-800 flex-col overflow-hidden shrink-0 z-40 relative shadow-2xl">
        
        <div class="p-6 space-y-8 overflow-y-auto custom-scrollbar flex-1 pb-6">
          
          <!-- Desktop Add Image -->
          <section>
             <button 
                class="w-full py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-blue-500 rounded-lg text-sm text-white font-bold flex items-center justify-center gap-2 mb-2 transition-all relative overflow-hidden group shadow-lg">
                <input type="file" class="absolute inset-0 opacity-0 cursor-pointer z-10" (change)="onAddImages($event)" accept="image/*" multiple>
                <div class="p-1 bg-blue-600 rounded text-white group-hover:scale-110 transition-transform">
                   <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </div>
                新增圖片
             </button>
             <p class="text-[10px] text-gray-500 text-center">可拖曳圖片調整順序</p>
          </section>

          <!-- Layout Config -->
          <section>
            <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
              版面設定 (Layout)
            </h3>
            
            <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 space-y-4">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[10px] text-gray-400 mb-1">直欄 (Cols)</label>
                  <div class="flex items-center gap-2">
                    <button (click)="updateCols(-1)" class="w-7 h-7 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white">-</button>
                    <span class="text-base font-bold w-4 text-center">{{cols()}}</span>
                    <button (click)="updateCols(1)" class="w-7 h-7 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white">+</button>
                  </div>
                </div>
                <div>
                  <label class="block text-[10px] text-gray-400 mb-1">橫列 (Rows)</label>
                  <div class="flex items-center gap-2">
                    <button (click)="updateRows(-1)" class="w-7 h-7 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white">-</button>
                    <span class="text-base font-bold w-4 text-center">{{rows()}}</span>
                    <button (click)="updateRows(1)" class="w-7 h-7 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white">+</button>
                  </div>
                </div>
              </div>
              <div class="h-px bg-gray-700 my-2"></div>
              <div>
                 <div class="flex justify-between items-center mb-1">
                    <label class="text-[10px] text-gray-400">單格尺寸</label>
                    <span class="text-[10px] text-blue-400">總: {{ totalWidth() }}×{{ totalHeight() }}</span>
                 </div>
                 <div class="grid grid-cols-4 gap-1.5 mb-3">
                    @for (ratio of aspectRatios; track ratio.label) {
                      <button (click)="setAspectRatio(ratio)" [class.bg-blue-600]="selectedRatio() === ratio" [class.bg-gray-700]="selectedRatio() !== ratio" class="px-1 py-1 text-[10px] rounded border border-transparent hover:border-gray-500 transition-all text-center">{{ ratio.label }}</button>
                    }
                 </div>
                 <div class="flex items-center gap-2 mb-2">
                   <div class="flex-1 relative">
                     <span class="absolute left-2 top-1.5 text-gray-500 text-[10px]">W</span>
                     <input type="number" [value]="cellWidth()" (input)="updateCellWidth($event)" class="w-full bg-gray-900 text-white text-xs pl-6 pr-2 py-1.5 rounded border border-gray-600 focus:border-blue-500 outline-none">
                   </div>
                   <div class="flex-1 relative">
                     <span class="absolute left-2 top-1.5 text-gray-500 text-[10px]">H</span>
                     <input type="number" [value]="cellHeight()" (input)="updateCellHeight($event)" class="w-full bg-gray-900 text-white text-xs pl-6 pr-2 py-1.5 rounded border border-gray-600 focus:border-blue-500 outline-none">
                   </div>
                 </div>
              </div>
            </div>
          </section>

          <!-- Desktop Layer Manager -->
          <section>
             <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                圖層管理
             </h3>
             <div class="space-y-2">
               @if (activeLayer(); as layer) {
                 <div class="bg-gray-800 p-3 rounded-lg border border-blue-900/50 ring-1 ring-blue-500/30 mb-4">
                    <div class="flex justify-between mb-2">
                       <span class="text-xs font-bold text-blue-400">當前: {{layer.file.name}}</span>
                       <button (click)="removeLayer(layer.id)" class="text-red-400 hover:text-red-300"><svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                    </div>
                    <div class="space-y-2">
                        <div class="flex items-center gap-2">
                          <span class="text-[10px] text-gray-400 w-6">縮放</span>
                          <input type="range" min="0.05" max="3" step="0.01" [value]="layer.scale" (input)="updateLayerScale($event, layer.id)" class="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500">
                        </div>
                        <div class="flex gap-2">
                           <button (click)="bringToFront(layer.id)" class="flex-1 py-1 text-[10px] bg-gray-700 rounded hover:bg-gray-600">移至最前</button>
                           <button (click)="sendToBack(layer.id)" class="flex-1 py-1 text-[10px] bg-gray-700 rounded hover:bg-gray-600">移至最後</button>
                        </div>
                    </div>
                 </div>
               }

               <div class="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                  @for (layer of layers().slice().reverse(); track layer.id) {
                     <div class="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-800 transition-colors"
                          [class.bg-gray-800]="activeLayerId() === layer.id"
                          [class.text-blue-400]="activeLayerId() === layer.id"
                          [class.text-gray-400]="activeLayerId() !== layer.id"
                          (click)="activeLayerId.set(layer.id)">
                        <img [src]="layer.url" class="w-8 h-8 rounded object-cover bg-gray-700">
                        <span class="text-xs truncate flex-1">{{layer.file.name}}</span>
                     </div>
                  }
               </div>
             </div>
          </section>

          <!-- Desktop Settings -->
          <section>
             <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 items-center gap-2">設定</h3>
             <div class="bg-gray-800 p-3 rounded-lg border border-gray-700 space-y-3">
                <div class="flex items-center gap-3">
                   <label class="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" [checked]="isTransparent()" (change)="toggleTransparency($event)" class="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600">
                      <span class="text-xs text-gray-300">透明背景</span>
                   </label>
                   @if (!isTransparent()) {
                     <div class="flex items-center gap-2 flex-1">
                        <input type="color" [value]="backgroundColor()" (input)="updateBackgroundColor($event)" class="h-6 w-8 p-0 border-0 rounded bg-transparent cursor-pointer">
                        <span class="text-xs text-gray-400 font-mono">{{ backgroundColor() }}</span>
                     </div>
                   }
                </div>
                <div>
                   <div class="flex justify-between mb-1">
                      <label class="text-[10px] text-gray-400">視野縮放</label>
                      <span class="text-[10px] font-mono text-blue-400">{{ (viewZoom() * 100).toFixed(0) }}%</span>
                   </div>
                   <input type="range" min="0.1" max="2.0" step="0.05" [value]="viewZoom()" (input)="updateViewZoom($event)" class="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-gray-400">
                </div>
             </div>
          </section>

          <button (click)="generateSlices()" class="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg shadow-blue-900/50 transition-all transform active:scale-95 flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.5 19c0-1.7-1.3-3-3-3h-11"/><path d="M13 22l4.5-3L13 16"/><path d="M6 16V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v7"/></svg>
            開始切割圖片
          </button>
        </div>
      </aside>

    </div>
  `
})
export class SplitterEditorComponent implements OnDestroy {
  initialFiles = input.required<File[]>();
  
  // State
  layers = signal<ImageLayer[]>([]);
  activeLayerId = signal<string | null>(null);
  
  // Mobile UI State
  activeMobileTab = signal<MobileTab>(null);

  // Configuration: Cell Size & Ratio
  cellWidth = signal(1080);
  cellHeight = signal(1080);
  
  // Grid Config
  rows = signal(1);
  cols = signal(2);

  // Background Settings
  isTransparent = signal(true); // Default to Transparent
  backgroundColor = signal('#ffffff'); 

  // View Control
  viewZoom = signal(1.0);
  viewTranslateX = signal(0);
  viewTranslateY = signal(0);

  aspectRatios: AspectRatioOption[] = [
    { label: '1:1', w: 1, h: 1 },
    { label: '2:3', w: 2, h: 3 },
    { label: '3:2', w: 3, h: 2 },
    { label: '3:4', w: 3, h: 4 },
    { label: '4:3', w: 4, h: 3 },
    { label: '4:5', w: 4, h: 5 },
    { label: '9:16', w: 9, h: 16 },
    { label: '16:9', w: 16, h: 9 },
    { label: '自訂', w: 0, h: 0 } 
  ];
  selectedRatio = signal<AspectRatioOption>(this.aspectRatios[0]);

  // Window State for RWD
  windowWidth = signal(window.innerWidth);
  windowHeight = signal(window.innerHeight);
  
  // Snapping UI State
  isSnappingX = signal(false);
  isSnappingY = signal(false);
  snapXPos = signal(0);
  snapYPos = signal(0);

  generatedSlices = signal<string[]>([]);
  finalAspectRatio = signal<string>('auto');

  // Computed Properties
  rowArray = computed(() => Array.from({ length: this.rows() - 1 }, (_, i) => i + 1));
  colArray = computed(() => Array.from({ length: this.cols() - 1 }, (_, i) => i + 1));
  activeLayer = computed(() => this.layers().find(l => l.id === this.activeLayerId()));
  
  totalWidth = computed(() => this.cellWidth() * this.cols());
  totalHeight = computed(() => this.cellHeight() * this.rows());

  filenamePrefix = computed(() => {
    const files = this.initialFiles();
    let base = 'collage';
    if (files.length > 0) {
        base = files[0].name.replace(/\.[^/.]+$/, "");
    }
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14); 
    const formattedTs = `${timestamp.slice(0, 8)}-${timestamp.slice(8)}`;
    return `${base}_${formattedTs}`;
  });

  // Calculate Display Dimensions (Fitting the Canvas into the Window)
  displayScale = computed(() => {
     const cw = this.totalWidth();
     const ch = this.totalHeight();
     if (cw === 0 || ch === 0) return 1;

     const winW = this.windowWidth();
     const winH = this.windowHeight();
     
     const isMobile = winW < 1024;
     const availableW = isMobile ? winW : (winW - 320 - 48);
     const availableH = isMobile ? winH : (winH - 50);

     const scaleW = (availableW - 40) / cw; 
     const scaleH = (availableH - 40) / ch;
     
     return Math.min(scaleW, scaleH);
  });
  
  displayDims = computed(() => {
      return {
          width: this.totalWidth() * this.displayScale(),
          height: this.totalHeight() * this.displayScale()
      };
  });

  private resizeListener: () => void;
  private mouseMoveListener: (e: MouseEvent) => void;
  private mouseUpListener: (e: MouseEvent) => void;

  constructor() {
    this.resizeListener = () => {
        this.windowWidth.set(window.innerWidth);
        this.windowHeight.set(window.innerHeight);
    };
    window.addEventListener('resize', this.resizeListener);

    // Global listeners for dragging behavior
    this.mouseMoveListener = (e: MouseEvent) => this.globalMouseMove(e);
    this.mouseUpListener = (e: MouseEvent) => this.globalMouseUp(e);
    document.addEventListener('mousemove', this.mouseMoveListener);
    document.addEventListener('mouseup', this.mouseUpListener);

    effect(() => {
      const files = this.initialFiles();
      if (files.length > 0) {
        this.processNewFiles(files);
      }
    });
  }

  ngOnDestroy() {
    if (this.resizeListener) window.removeEventListener('resize', this.resizeListener);
    if (this.mouseMoveListener) document.removeEventListener('mousemove', this.mouseMoveListener);
    if (this.mouseUpListener) document.removeEventListener('mouseup', this.mouseUpListener);
  }

  // --- Mobile RWD Logic ---

  toggleMobileTab(tab: MobileTab) {
    if (this.activeMobileTab() === tab) {
      this.activeMobileTab.set(null);
    } else {
      this.activeMobileTab.set(tab);
    }
  }

  closeMobileMenu() {
    this.activeMobileTab.set(null);
  }

  shouldShowSection(section: string) {
    return true; // Used by desktop only now
  }

  getMobileTabTitle() {
      switch(this.activeMobileTab()) {
          case 'layout': return '版面設定';
          case 'layers': return '圖層管理';
          case 'settings': return '顯示設定';
          default: return '';
      }
  }

  // --- File Processing ---

  processNewFiles(files: File[]) {
    let loadedCount = 0;
    const images: {file: File, url: string, img: HTMLImageElement}[] = [];

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const url = e.target?.result as string;
            const img = new Image();
            img.onload = () => {
                images.push({file, url, img});
                loadedCount++;
                if (loadedCount === files.length) {
                    this.addMultipleLayers(images);
                }
            };
            img.src = url;
        };
        reader.readAsDataURL(file);
    });
  }
  
  addMultipleLayers(images: {file: File, url: string, img: HTMLImageElement}[]) {
      const cw = this.totalWidth();
      const ch = this.totalHeight();
      
      const newLayers: ImageLayer[] = images.map((item, index) => {
          const id = Math.random().toString(36).substring(2, 9);
          
          const scaleW = cw / item.img.width;
          const scaleH = ch / item.img.height;
          const scale = Math.min(scaleW, scaleH) * 0.6;
          
          const finalW = item.img.width * scale;
          const finalH = item.img.height * scale;
          
          const offset = index * 30;
          const startX = (cw - finalW) / 2 + offset;
          const startY = (ch - finalH) / 2 + offset;

          return {
              id,
              file: item.file,
              url: item.url,
              imgElement: item.img,
              originalWidth: item.img.width,
              originalHeight: item.img.height,
              x: startX,
              y: startY,
              scale,
              zIndex: this.layers().length + index + 1
          };
      });

      this.layers.update(ls => [...ls, ...newLayers]);
      if (newLayers.length > 0) {
        this.activeLayerId.set(newLayers[newLayers.length - 1].id);
      }
  }

  onAddImages(event: Event) {
      const input = event.target as HTMLInputElement;
      if (input.files && input.files.length > 0) {
          this.processNewFiles(Array.from(input.files));
      }
      input.value = '';
  }

  // --- Grid & Cell Controls ---

  updateCols(delta: number) {
    this.cols.update(v => Math.max(1, Math.min(10, v + delta)));
  }

  updateRows(delta: number) {
    this.rows.update(v => Math.max(1, Math.min(10, v + delta)));
  }

  // --- Aspect Ratio & Size Logic ---

  setAspectRatio(option: AspectRatioOption) {
    this.selectedRatio.set(option);
    if (option.w !== 0 && option.h !== 0) {
       const currentW = this.cellWidth();
       const ratioVal = option.w / option.h;
       const newH = Math.round(currentW / ratioVal);
       this.cellHeight.set(newH);
    }
  }

  updateCellWidth(e: Event) {
      const v = parseInt((e.target as HTMLInputElement).value, 10);
      if (!isNaN(v) && v > 0) {
          this.cellWidth.set(v);
          const ratio = this.selectedRatio();
          if (ratio.w !== 0 && ratio.h !== 0) {
              const ratioVal = ratio.w / ratio.h;
              this.cellHeight.set(Math.round(v / ratioVal));
          }
      }
  }

  updateCellHeight(e: Event) {
      const v = parseInt((e.target as HTMLInputElement).value, 10);
      if (!isNaN(v) && v > 0) {
          this.cellHeight.set(v);
          const ratio = this.selectedRatio();
          if (ratio.w !== 0 && ratio.h !== 0) {
              const ratioVal = ratio.w / ratio.h;
              this.cellWidth.set(Math.round(v * ratioVal));
          }
      }
  }

  // --- Background Controls ---

  toggleTransparency(e: Event) {
     const checked = (e.target as HTMLInputElement).checked;
     this.isTransparent.set(checked);
  }

  updateBackgroundColor(e: Event) {
     const color = (e.target as HTMLInputElement).value;
     this.backgroundColor.set(color);
  }

  // --- View Zoom ---

  updateViewZoom(e: Event) {
    const v = parseFloat((e.target as HTMLInputElement).value);
    this.viewZoom.set(v);
  }

  resetViewZoom() {
    this.viewZoom.set(1.0);
    this.viewTranslateX.set(0);
    this.viewTranslateY.set(0);
  }

  onWheelZoom(e: WheelEvent) {
    // Desktop wheel zoom: straightforward zoom, no need for ctrl key
    e.preventDefault();
    const delta = e.deltaY * -0.001;
    const newZoom = Math.max(0.1, Math.min(2.0, this.viewZoom() + delta));
    this.viewZoom.set(newZoom);
  }

  // --- Layer Controls ---

  removeLayer(id: string) {
      this.layers.update(ls => ls.filter(l => l.id !== id));
      if (this.activeLayerId() === id) {
          this.activeLayerId.set(null);
      }
  }
  
  isViewDragging = false;
  
  bgMouseDown(e: MouseEvent) {
      this.activeLayerId.set(null);
      if (this.windowWidth() < 1024) {
          this.closeMobileMenu();
      }
      
      // Desktop View Drag Start
      this.isViewDragging = true;
  }
  
  updateLayerScale(e: Event, id: string) {
      const val = parseFloat((e.target as HTMLInputElement).value);
      
      // Check for snap (only if scaling via slider, we assume center scaling is fine or we just scale w/o position shift)
      // Actually, we want to snap edges if they are close.
      const layer = this.layers().find(l => l.id === id);
      if (!layer) return;

      const finalScale = this.applyScaleSnapping(layer, val);
      
      this.layers.update(ls => ls.map(l => {
          if (l.id === id) return { ...l, scale: finalScale };
          return l;
      }));
  }

  bringToFront(id: string) {
      this.layers.update(ls => {
          const maxZ = Math.max(...ls.map(l => l.zIndex), 0);
          return ls.map(l => l.id === id ? { ...l, zIndex: maxZ + 1 } : l);
      });
  }

  sendToBack(id: string) {
      this.layers.update(ls => {
          const minZ = Math.min(...ls.map(l => l.zIndex), 0);
          return ls.map(l => l.id === id ? { ...l, zIndex: minZ - 1 } : l);
      });
  }

  // --- Interaction Logic (Mouse) ---
  isLayerDragging = false;
  dragStart = { x: 0, y: 0 };
  dragLayerStart = { x: 0, y: 0 };
  dragLayerId: string | null = null;

  startDrag(e: MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation(); 
    
    this.activeLayerId.set(id);
    this.dragLayerId = id;
    this.isLayerDragging = true;
    
    const layer = this.layers().find(l => l.id === id);
    if (!layer) return;

    this.dragStart = { x: e.clientX, y: e.clientY };
    this.dragLayerStart = { x: layer.x, y: layer.y };
  }
  
  globalMouseMove(e: MouseEvent) {
      // 1. Layer Drag
      if (this.isLayerDragging && this.dragLayerId) {
          const dx = e.clientX - this.dragStart.x;
          const dy = e.clientY - this.dragStart.y;
          this.handleDragMove(dx, dy);
      }
      // 2. View Drag (Desktop Background)
      else if (this.isViewDragging) {
          this.viewTranslateX.update(v => v + e.movementX);
          this.viewTranslateY.update(v => v + e.movementY);
      }
  }
  
  globalMouseUp(e: MouseEvent) {
      this.isLayerDragging = false;
      this.isViewDragging = false;
      this.dragLayerId = null;
      this.isSnappingX.set(false);
      this.isSnappingY.set(false);
  }

  // --- Interaction Logic (Touch) ---

  // State for Touch Interactions
  isTouchDraggingLayer = false;
  isTouchPanning = false;
  isTouchZooming = false;
  
  // Distinguish zoom target
  zoomTarget: 'view' | 'layer' = 'view';
  
  touchStartCoords = { x: 0, y: 0 }; // For Panning
  lastPinchDistance = 0;
  startZoom = 1;         // For View Zoom
  
  // For Layer Pinch
  startLayerScale = 1;   
  pinchCenterStart = { x: 0, y: 0 }; // Canvas coordinates of the initial pinch center
  layerPosStart = { x: 0, y: 0 };    // Layer X/Y at start of pinch
  
  // Helps identify if a touch started on a layer
  potentialDragLayerId: string | null = null;

  layerTouchStart(e: TouchEvent, id: string) {
    this.potentialDragLayerId = id;
    this.activeLayerId.set(id);
  }

  onContainerTouchStart(e: TouchEvent) {
    // 2 Fingers -> ZOOM
    if (e.touches.length === 2) {
       this.isTouchZooming = true;
       this.isTouchPanning = false;
       this.isTouchDraggingLayer = false;
       this.lastPinchDistance = this.getDistance(e.touches);
       
       // DECIDE ZOOM TARGET
       if (this.potentialDragLayerId) {
          // If we started touching a layer, we zoom THAT layer
          this.zoomTarget = 'layer';
          const layer = this.layers().find(l => l.id === this.potentialDragLayerId);
          if (layer) {
              this.startLayerScale = layer.scale;
              this.layerPosStart = { x: layer.x, y: layer.y };
              this.pinchCenterStart = this.getCanvasPointFromTouches(e.touches);
          }
       } else {
          // Otherwise zoom view
          this.zoomTarget = 'view';
          this.startZoom = this.viewZoom();
       }
       return;
    }

    // 1 Finger -> DRAG or PAN
    if (e.touches.length === 1) {
       const touch = e.touches[0];
       
       if (this.potentialDragLayerId) {
          // Drag Layer
          this.isTouchDraggingLayer = true;
          this.dragLayerId = this.potentialDragLayerId;
          const layer = this.layers().find(l => l.id === this.dragLayerId);
          if (layer) {
             this.dragStart = { x: touch.clientX, y: touch.clientY };
             this.dragLayerStart = { x: layer.x, y: layer.y };
          }
       } else {
          // Pan View
          this.isTouchPanning = true;
          this.touchStartCoords = { x: touch.clientX - this.viewTranslateX(), y: touch.clientY - this.viewTranslateY() };
          if (this.windowWidth() < 1024) this.closeMobileMenu();
       }
    }
  }

  onContainerTouchMove(e: TouchEvent) {
    // 1. PINCH ZOOM
    if (this.isTouchZooming && e.touches.length === 2) {
       e.preventDefault();
       const currentDist = this.getDistance(e.touches);
       
       if (this.lastPinchDistance > 0) {
          const scaleChange = currentDist / this.lastPinchDistance;
          
          if (this.zoomTarget === 'view') {
             // Zoom View
             const newZoom = Math.max(0.1, Math.min(2.0, this.startZoom * scaleChange));
             this.viewZoom.set(newZoom);
          } else if (this.zoomTarget === 'layer' && this.potentialDragLayerId) {
             // Zoom Layer (Center Pivot)
             const layer = this.layers().find(l => l.id === this.potentialDragLayerId);
             if (layer) {
                 const rawNewScale = this.startLayerScale * scaleChange;
                 // Snap scale if edges hit something
                 const newScale = this.applyScaleSnapping(layer, Math.max(0.05, Math.min(5.0, rawNewScale)));
                 
                 // Pivot Math:
                 // P_current = Center of Fingers (Canvas Space)
                 // P_start = pinchCenterStart
                 // V = P_start - LayerOrigin_Start
                 // LayerOrigin_New = P_current - V * (NewScale / OldScale)
                 // NOTE: Since fingers move, P_current != P_start.
                 
                 const currentPinchCenter = this.getCanvasPointFromTouches(e.touches);
                 
                 // Vector from Layer Origin (at start) to Pinch Center (at start)
                 const vectorX = this.pinchCenterStart.x - this.layerPosStart.x;
                 const vectorY = this.pinchCenterStart.y - this.layerPosStart.y;
                 
                 // Scale this vector by the relative growth
                 const relativeScale = newScale / this.startLayerScale;
                 
                 // New Position is current finger center minus the scaled vector
                 const newLayerX = currentPinchCenter.x - (vectorX * relativeScale);
                 const newLayerY = currentPinchCenter.y - (vectorY * relativeScale);

                 this.layers.update(ls => ls.map(l => 
                    l.id === this.potentialDragLayerId ? { ...l, scale: newScale, x: newLayerX, y: newLayerY } : l
                 ));
             }
          }
       }
       return;
    }

    // 2. LAYER DRAG
    if (this.isTouchDraggingLayer && e.touches.length === 1 && this.dragLayerId) {
       e.preventDefault();
       const touch = e.touches[0];
       const dx = touch.clientX - this.dragStart.x;
       const dy = touch.clientY - this.dragStart.y;
       this.handleDragMove(dx, dy);
       return;
    }

    // 3. PAN VIEW
    if (this.isTouchPanning && e.touches.length === 1) {
       e.preventDefault();
       const touch = e.touches[0];
       const newX = touch.clientX - this.touchStartCoords.x;
       const newY = touch.clientY - this.touchStartCoords.y;
       this.viewTranslateX.set(newX);
       this.viewTranslateY.set(newY);
    }
  }

  onContainerTouchEnd(e: TouchEvent) {
    if (e.touches.length === 0) {
       this.isTouchPanning = false;
       this.isTouchDraggingLayer = false;
       this.isTouchZooming = false;
       this.dragLayerId = null;
       this.potentialDragLayerId = null;
       this.isSnappingX.set(false);
       this.isSnappingY.set(false);
    }
  }
  
  getDistance(touches: TouchList) {
     const dx = touches[0].clientX - touches[1].clientX;
     const dy = touches[0].clientY - touches[1].clientY;
     return Math.hypot(dx, dy);
  }
  
  // Helper to convert screen points to Canvas Coordinates (considering view translate & scale)
  getCanvasPointFromTouches(touches: TouchList) {
      // Average point of two touches
      const screenX = (touches[0].clientX + touches[1].clientX) / 2;
      const screenY = (touches[0].clientY + touches[1].clientY) / 2;
      return this.screenToCanvas(screenX, screenY);
  }

  screenToCanvas(sx: number, sy: number) {
      // 1. Subtract Translate
      // 2. Divide by View Zoom
      // 3. Subtract Display Offset (which is the centering padding) 
      // But wait, the layers are positioned relative to the "Canvas Container" (0,0 of the .relative div).
      // The canvas container is centered in the viewport.
      // So we need to find where the .relative div is on screen.
      
      // Since we use Angular Signals and direct style binding, getting exact element rect might be slightly async or require ViewChild.
      // However, we can approximate:
      // Global Translate: viewTranslateX, viewTranslateY
      // Then the container is centered.
      // Let's assume the View Container (.relative.flex... overflow-visible) is effectively the viewport origin (plus translate).
      // Actually, standard drag logic uses delta, so absolute math is tricky without `getBoundingClientRect`.
      
      // SIMPLIFICATION:
      // We only need DELTAs for drag, but for Pivot Zoom we need RELATIVE position.
      // Let's use the active layer's current position to offset.
      
      // Let's rely on the DOM element for the canvas wrapper to get robust coordinates.
      // Since I can't easily inject ElementRef in this output format without changing more files,
      // I will calculate relative to the window center which aligns with our CSS centering.
      
      const winW = this.windowWidth();
      const winH = this.windowHeight();
      
      // Container Center (before translate)
      const cx = winW / 2;
      const cy = winH / 2;
      
      // Apply Translate
      const originX = cx + this.viewTranslateX();
      const originY = cy + this.viewTranslateY();
      
      // Display Dims
      const dims = this.displayDims();
      const canvasLeft = originX - (dims.width / 2);
      const canvasTop = originY - (dims.height / 2);
      
      // Coordinate inside the scaled canvas
      const relX = (sx - canvasLeft) / this.viewZoom();
      const relY = (sy - canvasTop) / this.viewZoom();
      
      // Coordinate inside the unscaled canvas (Layer Space)
      return { 
          x: relX / this.displayScale(), 
          y: relY / this.displayScale() 
      };
  }

  handleDragMove(dxScreen: number, dyScreen: number) {
    if (!this.dragLayerId) return;
    
    const scale = this.displayScale() * this.viewZoom();
    const dx = dxScreen / scale;
    const dy = dyScreen / scale;

    let nx = this.dragLayerStart.x + dx;
    let ny = this.dragLayerStart.y + dy;
    
    const SNAP_DIST = 15;
    const cw = this.totalWidth();
    const ch = this.totalHeight();
    const layer = this.layers().find(l => l.id === this.dragLayerId);
    if (!layer) return;
    
    const currentW = layer.originalWidth * layer.scale;
    const currentH = layer.originalHeight * layer.scale;
    
    let snappedX = false;
    let snappedY = false;
    let sx = 0, sy = 0;

    // --- X Axis Snapping ---
    // Targets: 0, TotalWidth, AND Grid Lines
    const snapTargetsX = [0, cw];
    for (let i = 1; i < this.cols(); i++) {
        snapTargetsX.push((i / this.cols()) * cw);
    }
    
    // Check Left Edge
    for (const target of snapTargetsX) {
        if (Math.abs(nx - target) < SNAP_DIST) { nx = target; snappedX = true; sx = target; break; }
    }
    // Check Right Edge (if not snapped)
    if (!snappedX) {
        for (const target of snapTargetsX) {
            if (Math.abs(nx + currentW - target) < SNAP_DIST) { nx = target - currentW; snappedX = true; sx = target; break; }
        }
    }
    // Check Center (if not snapped)
    if (!snappedX) {
        for (const target of snapTargetsX) {
            if (Math.abs(nx + currentW/2 - target) < SNAP_DIST) { nx = target - currentW/2; snappedX = true; sx = target; break; }
        }
    }

    // --- Y Axis Snapping ---
    const snapTargetsY = [0, ch];
    for (let j = 1; j < this.rows(); j++) {
        snapTargetsY.push((j / this.rows()) * ch);
    }
    
    for (const target of snapTargetsY) {
        if (Math.abs(ny - target) < SNAP_DIST) { ny = target; snappedY = true; sy = target; break; }
    }
    if (!snappedY) {
        for (const target of snapTargetsY) {
            if (Math.abs(ny + currentH - target) < SNAP_DIST) { ny = target - currentH; snappedY = true; sy = target; break; }
        }
    }
    if (!snappedY) {
        for (const target of snapTargetsY) {
            if (Math.abs(ny + currentH/2 - target) < SNAP_DIST) { ny = target - currentH/2; snappedY = true; sy = target; break; }
        }
    }
    
    this.isSnappingX.set(snappedX);
    this.isSnappingY.set(snappedY);
    if(snappedX) this.snapXPos.set(sx);
    if(snappedY) this.snapYPos.set(sy);

    this.layers.update(ls => ls.map(l => {
        if (l.id === this.dragLayerId) return { ...l, x: nx, y: ny };
        return l;
    }));
  }

  // Snapping logic when scaling (Snap Edges to Grid/Canvas Border)
  applyScaleSnapping(layer: ImageLayer, newScale: number): number {
      const cw = this.totalWidth();
      const ch = this.totalHeight();
      const currentW = layer.originalWidth * newScale;
      const currentH = layer.originalHeight * newScale;
      const x = layer.x;
      const y = layer.y;
      
      const SNAP_TOLERANCE_PX = 10;
      
      // Targets X
      const snapTargetsX = [0, cw];
      for (let i = 1; i < this.cols(); i++) snapTargetsX.push((i / this.cols()) * cw);

      // Targets Y
      const snapTargetsY = [0, ch];
      for (let j = 1; j < this.rows(); j++) snapTargetsY.push((j / this.rows()) * ch);
      
      let snappedScale = newScale;
      let minDiff = Number.MAX_VALUE;

      // Check Right Edge Snapping: (x + w) ~ target
      // w = origW * s  =>  s = (target - x) / origW
      for (const target of snapTargetsX) {
         if (target > x) { // Only snap if target is to the right
             const targetScale = (target - x) / layer.originalWidth;
             // Check if this targetScale is close to newScale
             const diff = Math.abs(targetScale - newScale);
             // Convert diff back to pixels to check tolerance
             const pixelDiff = diff * layer.originalWidth;
             
             if (pixelDiff < SNAP_TOLERANCE_PX && diff < minDiff) {
                 minDiff = diff;
                 snappedScale = targetScale;
                 this.isSnappingX.set(true);
                 this.snapXPos.set(target);
             }
         }
      }

      // Check Bottom Edge Snapping: (y + h) ~ target
      // s = (target - y) / origH
      for (const target of snapTargetsY) {
          if (target > y) {
              const targetScale = (target - y) / layer.originalHeight;
              const diff = Math.abs(targetScale - newScale);
              const pixelDiff = diff * layer.originalHeight;
              
              if (pixelDiff < SNAP_TOLERANCE_PX && diff < minDiff) {
                  minDiff = diff;
                  snappedScale = targetScale;
                  this.isSnappingY.set(true);
                  this.snapYPos.set(target);
                  this.isSnappingX.set(false); // Prioritize Y visual if it overrides (simple toggle)
              }
          }
      }
      
      if (minDiff === Number.MAX_VALUE) {
          // No snap
          this.isSnappingX.set(false);
          this.isSnappingY.set(false);
      }

      return snappedScale;
  }

  clearResults() {
    this.generatedSlices.set([]);
  }
  
  getDownloadName(index: number) {
    return `${this.filenamePrefix()}_slice_${index + 1}.${this.isTransparent() ? 'png' : 'jpg'}`;
  }

  async downloadAll() {
    const zip = new JSZip();
    const slices = this.generatedSlices();
    const folder = zip.folder("slices");
    
    if (!folder) return;
    
    const prefix = this.filenamePrefix();
    const ext = this.isTransparent() ? 'png' : 'jpg';

    slices.forEach((dataUrl, index) => {
      const base64Data = dataUrl.split(',')[1];
      folder.file(`${prefix}_slice_${index + 1}.${ext}`, base64Data, { base64: true });
    });

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `${prefix}_grid_slices.zip`;
    a.click();
    
    URL.revokeObjectURL(url);
  }

  async generateSlices() {
    const targetWidth = this.totalWidth();
    const targetHeight = this.totalHeight();
    
    const mainCanvas = document.createElement('canvas');
    mainCanvas.width = targetWidth;
    mainCanvas.height = targetHeight;
    const ctx = mainCanvas.getContext('2d');
    
    if (!ctx) return;
    
    if (!this.isTransparent()) {
       ctx.fillStyle = this.backgroundColor();
       ctx.fillRect(0, 0, targetWidth, targetHeight);
    }
    
    const sortedLayers = [...this.layers()].sort((a, b) => a.zIndex - b.zIndex);
    
    sortedLayers.forEach(layer => {
       const lx = layer.x;
       const ly = layer.y;
       const lw = layer.originalWidth * layer.scale;
       const lh = layer.originalHeight * layer.scale;
       
       ctx.drawImage(layer.imgElement, lx, ly, lw, lh);
    });
    
    const slices: string[] = [];
    const cellW = this.cellWidth();
    const cellH = this.cellHeight();
    
    const ratio = cellW / cellH;
    this.finalAspectRatio.set(`${ratio}`);

    const mime = this.isTransparent() ? 'image/png' : 'image/jpeg';
    const quality = 0.95;

    for (let r = 0; r < this.rows(); r++) {
      for (let c = 0; c < this.cols(); c++) {
        const cellCanvas = document.createElement('canvas');
        cellCanvas.width = cellW;
        cellCanvas.height = cellH;
        const cellCtx = cellCanvas.getContext('2d');
        if (cellCtx) {
           cellCtx.drawImage(
             mainCanvas,
             c * cellW, r * cellH, cellW, cellH,
             0, 0, cellW, cellH
           );
           slices.push(cellCanvas.toDataURL(mime, quality));
        }
      }
    }
    
    this.generatedSlices.set(slices);
  }
}