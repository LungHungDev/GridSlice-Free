import { Component, computed, effect, input, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import JSZip from 'jszip';

interface AspectRatioOption {
  label: string;
  w: number;
  h: number;
  // If w/h are 0, it means 'Custom'
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
    <!-- Main Layout: Column on Mobile, Row on Desktop -->
    <div class="h-full flex flex-col lg:flex-row bg-gray-950 relative overflow-hidden">
      
      <!-- MOBILE HEADER (lg:hidden) -->
      <header class="lg:hidden h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 shrink-0 z-40 shadow-md">
        <div class="flex items-center gap-2">
           <span class="font-bold text-gray-200 tracking-tight">GridSlice</span>
           <span class="text-[10px] text-gray-500 font-mono border-l border-gray-700 pl-2">
             {{cols()}}x{{rows()}}
           </span>
        </div>
        <div class="flex items-center gap-3">
           <!-- Mobile Add Image -->
           <label class="p-2 bg-gray-800 rounded-full text-blue-400 border border-gray-700 cursor-pointer active:scale-95 transition-transform hover:bg-gray-700">
              <input type="file" class="hidden" (change)="onAddImages($event)" accept="image/*" multiple>
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
           </label>
           <!-- Mobile Slice Button -->
           <button 
             (click)="generateSlices()"
             class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-full shadow-lg shadow-blue-900/50 active:scale-95 transition-transform">
             切割
           </button>
        </div>
      </header>

      <!-- MAIN PREVIEW AREA -->
      <main class="flex-1 relative bg-gray-950 overflow-hidden flex flex-col w-full h-full min-h-0">
        
        <!-- Desktop Header (lg:flex) - Hidden on Mobile -->
        <div class="hidden lg:flex h-12 border-b border-gray-800 items-center px-4 justify-between bg-gray-900/50 backdrop-blur shrink-0 z-30">
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400 font-mono">
              {{ totalWidth() }} × {{ totalHeight() }} px
            </span>
            <span class="text-xs text-gray-500 font-mono inline-block border-l border-gray-700 pl-2 ml-1">
              {{cols()}} x {{rows()}} 網格
            </span>
          </div>
          <div class="flex gap-4 text-xs">
            <div class="flex items-center gap-1.5">
               <span class="w-2 h-2 rounded-full bg-blue-500"></span>
               <span class="text-gray-300">選取</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full border border-dashed border-gray-400"></span>
              <span class="text-gray-300">切割線</span>
            </div>
          </div>
        </div>

        <!-- The Editor Stage -->
        @if (!generatedSlices().length) {
          
          <div class="flex-1 relative overflow-hidden flex items-center justify-center bg-gray-900 select-none cursor-grab active:cursor-grabbing touch-none"
               (mousedown)="bgMouseDown($event)"
               (wheel)="onWheelZoom($event)"
               (touchstart)="onContainerTouchStart($event)"
               (touchmove)="onContainerTouchMove($event)"
               (touchend)="onContainerTouchEnd($event)">
               
            <!-- Mobile Backdrop for Drawer -->
            @if (activeMobileTab() && windowWidth() < 1024) {
              <div class="absolute inset-0 bg-black/60 z-30 backdrop-blur-sm transition-opacity" (click)="closeMobileMenu()"></div>
            }
            
            <!-- This container centers the canvas visualization -->
            <!-- Use transform translate for panning + scale for zooming -->
            <div class="relative flex items-center justify-center w-full h-full p-4 lg:p-8 overflow-visible"
                 [style.transform]="'translate(' + viewTranslateX() + 'px, ' + viewTranslateY() + 'px)'">
            
                <!-- The Reference Frame (The Canvas) -->
                <div 
                  class="relative flex-shrink-0 transition-transform duration-75 ease-out origin-center shadow-2xl"
                  [style.width.px]="displayDims().width"
                  [style.height.px]="displayDims().height"
                  [style.transform]="'scale(' + viewZoom() + ')'">
                  
                  <!-- 1. Background -->
                  <div class="absolute inset-0 z-0 bg-checkerboard"></div>
                  @if (!isTransparent()) {
                      <div class="absolute inset-0 z-0" [style.background-color]="backgroundColor()"></div>
                  }

                  <!-- 2. Images -->
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

                   <!-- 3. Mask & Grid -->
                   <div 
                      class="absolute inset-0 z-20 pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] border border-white/20">
                      <!-- Grid Lines -->
                      @for (i of colArray(); track i) {
                        <div 
                            class="absolute top-0 bottom-0 border-l border-dashed border-white/60 shadow-[0_0_2px_black]" 
                            [style.left.%]="(i / cols()) * 100"></div>
                      }
                      @for (j of rowArray(); track j) {
                        <div 
                            class="absolute left-0 right-0 border-t border-dashed border-white/60 shadow-[0_0_2px_black]" 
                            [style.top.%]="(j / rows()) * 100"></div>
                      }
                   </div>
                   
                   <!-- Snap Indicators -->
                   @if(isSnappingX()){
                     <div class="absolute inset-y-0 w-px bg-yellow-400 z-30 shadow-[0_0_4px_yellow]" 
                          [style.left.px]="snapXPos() * displayScale()"></div>
                   }
                   @if(isSnappingY()){
                     <div class="absolute inset-x-0 h-px bg-yellow-400 z-30 shadow-[0_0_4px_yellow]" 
                          [style.top.px]="snapYPos() * displayScale()"></div>
                   }

                </div>
            </div>
            
            <!-- Floating Hint (Hidden when drawer open on mobile) -->
            @if (!activeMobileTab()) {
                <div class="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none z-20">
                    <div class="text-[10px] lg:text-xs text-gray-400 bg-gray-900/90 px-4 py-1.5 rounded-full backdrop-blur border border-gray-700 shadow-xl">
                    手機雙指縮放 • 單指拖曳圖片/背景移動視野
                    </div>
                </div>
            }

          </div>
        } @else {
          <!-- Results View -->
          <div class="flex-1 overflow-y-auto p-4 lg:p-8 bg-gray-950 z-50">
            <div class="max-w-5xl mx-auto pb-20 lg:pb-0">
              <div class="flex flex-col gap-6 mb-6">
                <div>
                  <h2 class="text-xl lg:text-2xl font-bold text-white">切割完成！</h2>
                  <p class="text-xs lg:text-sm text-gray-400 mt-1">共 {{ generatedSlices().length }} 張圖片 ({{cellWidth()}} x {{cellHeight()}} px / 張)</p>
                </div>
                
                <div class="flex flex-col gap-2">
                  <div class="flex gap-3 items-stretch h-12">
                    <button 
                      (click)="clearResults()" 
                      class="flex-1 px-4 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg shadow-lg transition-colors text-sm lg:text-base">
                      繼續編輯
                    </button>
                    <button 
                      (click)="downloadAll()"
                      class="flex-[2] px-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg shadow-lg flex justify-center items-center gap-2 transition-colors text-sm lg:text-base">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      下載全部 (ZIP)
                    </button>
                  </div>
                  <p class="text-xs text-gray-500 text-center">可直接點擊下方圖片進行單張下載</p>
                </div>
              </div>
              
              <div 
                class="grid gap-3 lg:gap-4 bg-checkerboard/30 p-4 rounded-xl border border-gray-800"
                [style.grid-template-columns]="'repeat(' + cols() + ', minmax(0, 1fr))'">
                @for (slice of generatedSlices(); track $index) {
                  <div class="group relative bg-transparent rounded-lg overflow-hidden border border-gray-700/50 w-full shadow-lg" 
                       style="font-size: 0;"
                       [style.aspect-ratio]="finalAspectRatio()">
                    <img [src]="slice" class="w-full h-full object-cover">
                    <a 
                      [href]="slice" 
                      [download]="getDownloadName($index)"
                      class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 text-base">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </a>
                    <div class="absolute top-1 left-1 lg:top-2 lg:left-2 bg-black/50 text-white text-[10px] lg:text-xs px-1.5 py-0.5 lg:py-1 rounded z-10 font-sans">
                      #{{ $index + 1 }}
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        }
      </main>

      <!-- MOBILE BOTTOM NAV (lg:hidden) -->
      @if (!generatedSlices().length) {
        <nav class="lg:hidden h-[60px] bg-gray-900 border-t border-gray-800 grid grid-cols-3 shrink-0 z-50 safe-pb">
           <button 
             (click)="setMobileTab('layout')"
             [class.text-blue-400]="activeMobileTab() === 'layout'"
             [class.text-gray-400]="activeMobileTab() !== 'layout'"
             class="flex flex-col items-center justify-center gap-1 active:bg-gray-800/50 transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
             <span class="text-[10px] font-medium">佈局</span>
           </button>
           <button 
             (click)="setMobileTab('layers')"
             [class.text-blue-400]="activeMobileTab() === 'layers'"
             [class.text-gray-400]="activeMobileTab() !== 'layers'"
             class="flex flex-col items-center justify-center gap-1 active:bg-gray-800/50 transition-colors relative">
             <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
             <span class="text-[10px] font-medium">圖層</span>
             @if(layers().length > 0) {
                 <span class="absolute top-1 right-8 w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
             }
           </button>
           <button 
             (click)="setMobileTab('settings')"
             [class.text-blue-400]="activeMobileTab() === 'settings'"
             [class.text-gray-400]="activeMobileTab() !== 'settings'"
             class="flex flex-col items-center justify-center gap-1 active:bg-gray-800/50 transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
             <span class="text-[10px] font-medium">設定</span>
           </button>
        </nav>
      }

      <!-- Controls Panel (Responsive: Sidebar on Desktop, Drawer on Mobile) -->
      <aside 
        class="bg-gray-900 border-r border-gray-800 flex flex-col overflow-hidden transition-transform duration-300 ease-out
               lg:w-80 lg:relative lg:border-t-0 lg:h-full lg:translate-y-0 lg:z-auto
               fixed bottom-[60px] left-0 right-0 z-40 rounded-t-2xl shadow-2xl border-t border-gray-700
               max-h-[60vh] w-full"
        [class.translate-y-[120%]]="!activeMobileTab() && windowWidth() < 1024"
        [class.translate-y-0]="activeMobileTab() || windowWidth() >= 1024">
        
        <!-- Mobile Drawer Header -->
        <div class="lg:hidden flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
           <span class="text-sm font-bold text-gray-200 flex items-center gap-2">
             {{ getMobileTabTitle() }}
           </span>
           <button (click)="closeMobileMenu()" class="p-1 text-gray-400 hover:text-white bg-gray-800 rounded-full">
             <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
           </button>
        </div>

        <div class="p-4 lg:p-6 space-y-6 lg:space-y-8 overflow-y-auto custom-scrollbar flex-1 pb-10 lg:pb-6">
          
          <!-- Add Images (Desktop Only) -->
          <section class="hidden lg:block">
             <button 
                class="w-full py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 flex items-center justify-center gap-2 mb-2 transition-colors relative overflow-hidden">
                <input type="file" class="absolute inset-0 opacity-0 cursor-pointer" (change)="onAddImages($event)" accept="image/*" multiple>
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                新增圖片
             </button>
             <p class="text-[10px] text-gray-500 text-center">支援多圖層拼貼與自由拖曳</p>
          </section>

          <!-- Main Configuration: Grid & Cell Size -->
          <section [class.hidden]="!shouldShowSection('layout')">
            <h3 class="hidden lg:flex text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 lg:mb-4 items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
              版面設定 (Layout)
            </h3>
            
            <div class="bg-gray-800 p-3 rounded-lg border border-gray-700 space-y-4">
              
              <!-- 1. Grid Rows/Cols -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[10px] text-gray-400 mb-1">直欄 (Cols)</label>
                  <div class="flex items-center gap-2">
                    <button (click)="updateCols(-1)" class="w-7 h-7 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 active:bg-blue-600 transition-colors text-white">-</button>
                    <span class="text-base font-bold w-4 text-center">{{cols()}}</span>
                    <button (click)="updateCols(1)" class="w-7 h-7 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 active:bg-blue-600 transition-colors text-white">+</button>
                  </div>
                </div>
                <div>
                  <label class="block text-[10px] text-gray-400 mb-1">橫列 (Rows)</label>
                  <div class="flex items-center gap-2">
                    <button (click)="updateRows(-1)" class="w-7 h-7 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 active:bg-blue-600 transition-colors text-white">-</button>
                    <span class="text-base font-bold w-4 text-center">{{rows()}}</span>
                    <button (click)="updateRows(1)" class="w-7 h-7 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 active:bg-blue-600 transition-colors text-white">+</button>
                  </div>
                </div>
              </div>

              <div class="h-px bg-gray-700 my-2"></div>

              <!-- 2. Cell Size & Aspect Ratio -->
              <div>
                 <div class="flex justify-between items-center mb-1">
                    <label class="text-[10px] text-gray-400">單格尺寸 (px)</label>
                    <span class="text-[10px] text-blue-400">總尺寸: {{ totalWidth() }}×{{ totalHeight() }}</span>
                 </div>

                 <!-- Ratios -->
                 <div class="grid grid-cols-4 gap-1.5 mb-3">
                    @for (ratio of aspectRatios; track ratio.label) {
                      <button 
                        (click)="setAspectRatio(ratio)"
                        [class.bg-blue-600]="selectedRatio() === ratio"
                        [class.text-white]="selectedRatio() === ratio"
                        [class.border-transparent]="selectedRatio() === ratio"
                        [class.bg-gray-700]="selectedRatio() !== ratio"
                        [class.text-gray-300]="selectedRatio() !== ratio"
                        [class.border-gray-600]="selectedRatio() !== ratio"
                        class="px-1 py-1 text-[10px] rounded border hover:border-gray-500 transition-all text-center">
                        {{ ratio.label }}
                      </button>
                    }
                 </div>

                 <div class="flex items-center gap-2 mb-2">
                   <div class="flex-1 relative">
                     <span class="absolute left-2 top-1.5 text-gray-500 text-[10px]">W</span>
                     <input 
                        type="number" 
                        [value]="cellWidth()" 
                        (input)="updateCellWidth($event)" 
                        class="w-full bg-gray-900 text-white text-xs pl-6 pr-2 py-1.5 rounded border border-gray-600 focus:border-blue-500 outline-none">
                   </div>
                   <div class="text-gray-500 flex items-center justify-center">
                      @if (selectedRatio().w !== 0) {
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      } @else {
                        <span class="text-lg leading-none">×</span>
                      }
                   </div>
                   <div class="flex-1 relative">
                     <span class="absolute left-2 top-1.5 text-gray-500 text-[10px]">H</span>
                     <input 
                        type="number" 
                        [value]="cellHeight()" 
                        (input)="updateCellHeight($event)" 
                        class="w-full bg-gray-900 text-white text-xs pl-6 pr-2 py-1.5 rounded border border-gray-600 focus:border-blue-500 outline-none">
                   </div>
                 </div>
              </div>
            </div>
          </section>

          <!-- Selected Layer Controls -->
          <section [class.hidden]="!shouldShowSection('layers')">
             <h3 class="hidden lg:flex text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                圖層管理
             </h3>
             @if (activeLayer(); as layer) {
                 <div class="bg-gray-800/50 p-3 rounded-lg border border-blue-900/30 ring-1 ring-blue-900/50">
                    <div class="flex items-center justify-between mb-3">
                      <h3 class="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                         當前圖層
                      </h3>
                      <button (click)="removeLayer(layer.id)" class="text-red-400 hover:text-red-300" title="刪除圖層">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                    
                    <div class="space-y-3">
                      <div>
                        <div class="flex justify-between mb-1">
                          <label class="text-[10px] text-gray-400">圖片縮放</label>
                          <span class="text-[10px] font-mono text-blue-400">{{ (layer.scale * 100).toFixed(0) }}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0.05" 
                          max="3" 
                          step="0.01" 
                          [value]="layer.scale" 
                          (input)="updateLayerScale($event, layer.id)"
                          class="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500">
                      </div>
                      
                      <div class="flex gap-2">
                        <button (click)="bringToFront(layer.id)" class="flex-1 py-1.5 text-[10px] bg-gray-700 hover:bg-gray-600 rounded border border-gray-600 text-gray-300">移至最前</button>
                        <button (click)="sendToBack(layer.id)" class="flex-1 py-1.5 text-[10px] bg-gray-700 hover:bg-gray-600 rounded border border-gray-600 text-gray-300">移至最後</button>
                      </div>
                    </div>
                 </div>
             } @else {
                 <div class="p-4 bg-gray-800/30 rounded-lg border border-dashed border-gray-700 text-center">
                   <p class="text-xs text-gray-500">點擊圖片進行編輯</p>
                 </div>
             }
          </section>

          <!-- Settings (Background + View) -->
          <section [class.hidden]="!shouldShowSection('settings')">
             <h3 class="hidden lg:flex text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 items-center gap-2">
               <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
               設定 (Settings)
             </h3>

             <div class="bg-gray-800 p-3 rounded-lg border border-gray-700 space-y-4">
                 <!-- Background Color -->
                <div>
                  <label class="block text-[10px] text-gray-400 mb-1.5">背景設定</label>
                  <div class="flex items-center gap-3">
                     <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" [checked]="isTransparent()" (change)="toggleTransparency($event)" class="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900">
                        <span class="text-xs text-gray-300">透明背景</span>
                     </label>
                     
                     @if (!isTransparent()) {
                       <div class="flex items-center gap-2 flex-1 animate-in fade-in zoom-in duration-200">
                          <input 
                              type="color" 
                              [value]="backgroundColor()" 
                              (input)="updateBackgroundColor($event)"
                              class="h-6 w-8 p-0 border-0 rounded bg-transparent cursor-pointer">
                          <span class="text-xs text-gray-400 font-mono uppercase">{{ backgroundColor() }}</span>
                       </div>
                     }
                  </div>
                </div>

                <div class="h-px bg-gray-700"></div>

                <!-- Global View Controls -->
                <div>
                   <div class="flex justify-between mb-1">
                      <label class="text-[10px] text-gray-400">視野縮放</label>
                      <span class="text-[10px] font-mono text-blue-400">{{ (viewZoom() * 100).toFixed(0) }}%</span>
                   </div>
                   <input 
                      type="range" 
                      min="0.1" 
                      max="2.0" 
                      step="0.05" 
                      [value]="viewZoom()" 
                      (input)="updateViewZoom($event)"
                      class="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-gray-400">
                   <div class="flex justify-between mt-1">
                     <button (click)="resetViewZoom()" class="text-[10px] text-gray-500 hover:text-white underline">重置視野 (Fit)</button>
                   </div>
                </div>
             </div>
          </section>

          <!-- Action (Desktop Only) -->
          <button 
            (click)="generateSlices()"
            class="hidden lg:flex w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg shadow-blue-900/50 transition-all transform active:scale-95 items-center justify-center gap-2 text-sm lg:text-base">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.5 19c0-1.7-1.3-3-3-3h-11"/><path d="M13 22l4.5-3L13 16"/><path d="M6 16V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v7"/></svg>
            開始切割圖片
          </button>
          
          <div class="h-4 lg:hidden"></div>
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
  isTransparent = signal(false);
  backgroundColor = signal('#ffffff'); // Default white for non-transparent

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
    { label: '自訂', w: 0, h: 0 } // w:0 means Custom/Free
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
    // Add Timestamp: _YYYYMMDD-HHmmss
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14); // YYYYMMDDHHmmss
    // Format slightly for readability YYYYMMDD-HHmmss
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
     
     // Available space logic updated for RWD
     const isMobile = winW < 1024;
     
     // Desktop: Sidebar width 320px (80)
     // Mobile: Full width
     const availableW = isMobile ? winW : (winW - 320 - 48);
     
     // Desktop: Header 48px + Padding
     // Mobile: Header 56px + Nav 64px = 120px approx taken
     const availableH = isMobile ? (winH - 120) : (winH - 100);

     const scaleW = (availableW - 40) / cw; // 20px padding
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

  constructor() {
    this.resizeListener = () => {
        this.windowWidth.set(window.innerWidth);
        this.windowHeight.set(window.innerHeight);
    };
    window.addEventListener('resize', this.resizeListener);

    effect(() => {
      const files = this.initialFiles();
      if (files.length > 0) {
        this.processNewFiles(files);
      }
    });
  }

  ngOnDestroy() {
    if (this.resizeListener) {
        window.removeEventListener('resize', this.resizeListener);
    }
  }

  // --- Mobile RWD Logic ---

  setMobileTab(tab: MobileTab) {
    this.activeMobileTab.set(tab);
  }

  closeMobileMenu() {
    this.activeMobileTab.set(null);
  }

  shouldShowSection(section: string) {
    const isDesktop = this.windowWidth() >= 1024;
    if (isDesktop) return true;
    return this.activeMobileTab() === section;
  }

  getMobileTabTitle() {
      switch(this.activeMobileTab()) {
          case 'layout': return '版面佈局 (Layout)';
          case 'layers': return '圖層管理 (Layers)';
          case 'settings': return '顯示設定 (Settings)';
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
    
    // Recalculate based on current Width if it's not custom
    if (option.w !== 0 && option.h !== 0) {
       const currentW = this.cellWidth();
       // Ratio = w / h. So h = w / (ratioW / ratioH)
       const ratioVal = option.w / option.h;
       const newH = Math.round(currentW / ratioVal);
       this.cellHeight.set(newH);
    }
  }

  updateCellWidth(e: Event) {
      const v = parseInt((e.target as HTMLInputElement).value, 10);
      if (!isNaN(v) && v > 0) {
          this.cellWidth.set(v);
          // Auto update height if ratio is locked
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
          // Auto update width if ratio is locked
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
    if (e.ctrlKey || e.metaKey) {
       e.preventDefault();
       const delta = e.deltaY * -0.001;
       const newZoom = Math.max(0.1, Math.min(2.0, this.viewZoom() + delta));
       this.viewZoom.set(newZoom);
    }
  }

  // --- Layer Controls ---

  removeLayer(id: string) {
      this.layers.update(ls => ls.filter(l => l.id !== id));
      if (this.activeLayerId() === id) {
          this.activeLayerId.set(null);
      }
  }
  
  bgMouseDown(e: MouseEvent) {
      this.activeLayerId.set(null);
      // Close mobile menu if open when clicking bg
      if (this.windowWidth() < 1024) {
          this.closeMobileMenu();
      }
  }
  
  updateLayerScale(e: Event, id: string) {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.layers.update(ls => ls.map(l => {
          if (l.id === id) return { ...l, scale: val };
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
  isDragging = false;
  dragStart = { x: 0, y: 0 };
  dragLayerStart = { x: 0, y: 0 };
  dragLayerId: string | null = null;

  startDrag(e: MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation(); 
    
    this.activeLayerId.set(id);
    this.dragLayerId = id;
    this.isDragging = true;
    
    const layer = this.layers().find(l => l.id === id);
    if (!layer) return;

    this.dragStart = { x: e.clientX, y: e.clientY };
    this.dragLayerStart = { x: layer.x, y: layer.y };
    
    const mouseMove = (ev: MouseEvent) => {
      if (!this.isDragging || !this.dragLayerId) return;
      const dx = ev.clientX - this.dragStart.x;
      const dy = ev.clientY - this.dragStart.y;
      this.handleDragMove(dx, dy);
    };
    
    const mouseUp = () => {
      this.isDragging = false;
      this.dragLayerId = null;
      this.isSnappingX.set(false);
      this.isSnappingY.set(false);
      document.removeEventListener('mousemove', mouseMove);
      document.removeEventListener('mouseup', mouseUp);
    };
    
    document.addEventListener('mousemove', mouseMove);
    document.addEventListener('mouseup', mouseUp);
  }

  // --- Interaction Logic (Touch - Integrated) ---

  // State for Touch Interactions
  isTouchDraggingLayer = false;
  isTouchPanning = false;
  isTouchZooming = false;
  
  touchStartCoords = { x: 0, y: 0 }; // For Panning
  touchStartLayerCoords = { x: 0, y: 0 }; // For Layer Drag
  lastPinchDistance = 0;
  startZoom = 1;
  
  // This helps identify if a touch started on a layer
  potentialDragLayerId: string | null = null;

  layerTouchStart(e: TouchEvent, id: string) {
    // We don't stop propagation here. We just mark which layer was touched.
    // The container's touchstart will make the decision.
    this.potentialDragLayerId = id;
    this.activeLayerId.set(id);
  }

  onContainerTouchStart(e: TouchEvent) {
    // If we have 2 touches, we enter ZOOM mode immediately
    if (e.touches.length === 2) {
       this.isTouchZooming = true;
       this.isTouchPanning = false;
       this.isTouchDraggingLayer = false;
       this.lastPinchDistance = this.getDistance(e.touches);
       this.startZoom = this.viewZoom();
       return;
    }

    if (e.touches.length === 1) {
       const touch = e.touches[0];
       
       // If potentialDragLayerId is set, it means the touch went through an image first
       if (this.potentialDragLayerId) {
          this.isTouchDraggingLayer = true;
          this.dragLayerId = this.potentialDragLayerId;
          const layer = this.layers().find(l => l.id === this.dragLayerId);
          if (layer) {
             this.dragStart = { x: touch.clientX, y: touch.clientY };
             this.dragLayerStart = { x: layer.x, y: layer.y };
          }
       } else {
          // Touched background -> Pan Mode
          this.isTouchPanning = true;
          this.touchStartCoords = { x: touch.clientX - this.viewTranslateX(), y: touch.clientY - this.viewTranslateY() };
          
          // Also allow closing menu if tapping bg
          if (this.windowWidth() < 1024) {
             this.closeMobileMenu();
          }
       }
    }
  }

  onContainerTouchMove(e: TouchEvent) {
    // 1. Pinch Zoom
    if (this.isTouchZooming && e.touches.length === 2) {
       e.preventDefault(); // Prevent browser zoom
       const currentDist = this.getDistance(e.touches);
       if (this.lastPinchDistance > 0) {
          const scale = currentDist / this.lastPinchDistance;
          const newZoom = Math.max(0.1, Math.min(2.0, this.startZoom * scale));
          this.viewZoom.set(newZoom);
       }
       return;
    }

    // 2. Layer Drag
    if (this.isTouchDraggingLayer && e.touches.length === 1 && this.dragLayerId) {
       e.preventDefault(); // Prevent scrolling
       const touch = e.touches[0];
       const dx = touch.clientX - this.dragStart.x;
       const dy = touch.clientY - this.dragStart.y;
       this.handleDragMove(dx, dy);
       return;
    }

    // 3. Pan View
    if (this.isTouchPanning && e.touches.length === 1) {
       e.preventDefault(); // Prevent browser swipe nav
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
    } else if (e.touches.length === 1 && this.isTouchZooming) {
       // Transition from zoom back to something else? 
       // Usually best to just stop interaction until lift all fingers to avoid jumps
       this.isTouchZooming = false;
    }
  }

  startTouch(e: TouchEvent, id: string) {
    // This is legacy/fallback, logic moved to onContainerTouchStart
    // Kept empty or minimal to avoid breaking if template wasn't fully updated
  }
  
  getDistance(touches: TouchList) {
     const dx = touches[0].clientX - touches[1].clientX;
     const dy = touches[0].clientY - touches[1].clientY;
     return Math.hypot(dx, dy);
  }

  handleDragMove(dxScreen: number, dyScreen: number) {
    if (!this.dragLayerId) return;
    
    // Convert screen delta to canvas delta
    // Must also account for viewZoom!
    const scale = this.displayScale() * this.viewZoom();
    const dx = dxScreen / scale;
    const dy = dyScreen / scale;

    let nx = this.dragLayerStart.x + dx;
    let ny = this.dragLayerStart.y + dy;
    
    const SNAP_DIST = 15; // Canvas pixels
    const cw = this.totalWidth();
    const ch = this.totalHeight();
    const layer = this.layers().find(l => l.id === this.dragLayerId);
    if (!layer) return;
    
    const currentW = layer.originalWidth * layer.scale;
    const currentH = layer.originalHeight * layer.scale;
    
    let snappedX = false;
    let snappedY = false;
    let sx = 0, sy = 0;

    // Snap Logic (Edges to Canvas Edges)
    if (Math.abs(nx) < SNAP_DIST) { nx = 0; snappedX = true; sx = 0; }
    else if (Math.abs(nx + currentW - cw) < SNAP_DIST) { nx = cw - currentW; snappedX = true; sx = cw; }
    else if (Math.abs((nx + currentW/2) - (cw/2)) < SNAP_DIST) { nx = cw/2 - currentW/2; snappedX = true; sx = cw/2; }

    if (Math.abs(ny) < SNAP_DIST) { ny = 0; snappedY = true; sy = 0; }
    else if (Math.abs(ny + currentH - ch) < SNAP_DIST) { ny = ch - currentH; snappedY = true; sy = ch; }
    else if (Math.abs((ny + currentH/2) - (ch/2)) < SNAP_DIST) { ny = ch/2 - currentH/2; snappedY = true; sy = ch/2; }
    
    this.isSnappingX.set(snappedX);
    this.isSnappingY.set(snappedY);
    if(snappedX) this.snapXPos.set(sx);
    if(snappedY) this.snapYPos.set(sy);

    this.layers.update(ls => ls.map(l => {
        if (l.id === this.dragLayerId) return { ...l, x: nx, y: ny };
        return l;
    }));
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
    // 1. Create Master Canvas using EXACT defined Resolution
    const targetWidth = this.totalWidth();
    const targetHeight = this.totalHeight();
    
    const mainCanvas = document.createElement('canvas');
    mainCanvas.width = targetWidth;
    mainCanvas.height = targetHeight;
    const ctx = mainCanvas.getContext('2d');
    
    if (!ctx) return;
    
    // Background handling
    // If not transparent, fill with selected color.
    // If transparent, we leave it be (canvas default is transparent rgba(0,0,0,0))
    if (!this.isTransparent()) {
       ctx.fillStyle = this.backgroundColor();
       ctx.fillRect(0, 0, targetWidth, targetHeight);
    }
    
    // Sort layers by zIndex
    const sortedLayers = [...this.layers()].sort((a, b) => a.zIndex - b.zIndex);
    
    // Draw layers
    sortedLayers.forEach(layer => {
       const lx = layer.x;
       const ly = layer.y;
       const lw = layer.originalWidth * layer.scale;
       const lh = layer.originalHeight * layer.scale;
       
       ctx.drawImage(layer.imgElement, lx, ly, lw, lh);
    });
    
    // 2. Slice it
    const slices: string[] = [];
    const cellW = this.cellWidth();
    const cellH = this.cellHeight();
    
    const ratio = cellW / cellH;
    this.finalAspectRatio.set(`${ratio}`);

    // Determine output format
    // If transparent, MUST use PNG. If solid background, user prefers JPG typically (smaller size) but PNG is safer.
    // Let's use PNG if transparent, JPG if not (to save size for standard photos).
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