import { Component, ElementRef, ViewChild, computed, effect, input, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import JSZip from 'jszip';

interface AspectRatio {
  label: string;
  value: number; // width / height, -1 for Custom
  isFree: boolean;
}

@Component({
  selector: 'app-splitter-editor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full flex flex-col-reverse lg:flex-row bg-gray-950">
      
      <!-- Controls Sidebar -->
      <!-- Mobile: Bottom Sheet style, Desktop: Left Sidebar -->
      <aside class="w-full lg:w-80 bg-gray-900 border-t lg:border-t-0 lg:border-r border-gray-800 flex flex-col shrink-0 lg:h-full max-h-[50vh] lg:max-h-full overflow-hidden">
        <div class="p-4 lg:p-6 space-y-6 lg:space-y-8 overflow-y-auto custom-scrollbar">
          
          <!-- Grid Settings -->
          <section>
            <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 lg:mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
              網格佈局 (Grid)
            </h3>
            
            <div class="grid grid-cols-2 gap-3 lg:gap-4">
              <div class="bg-gray-800 p-2 lg:p-3 rounded-lg border border-gray-700">
                <label class="block text-[10px] lg:text-xs text-gray-400 mb-1.5">直欄 (Column)</label>
                <div class="flex items-center gap-2 lg:gap-3">
                  <button (click)="updateCols(-1)" class="w-7 h-7 lg:w-8 lg:h-8 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 active:bg-blue-600 transition-colors text-white">-</button>
                  <span class="text-lg lg:text-xl font-bold w-4 text-center">{{cols()}}</span>
                  <button (click)="updateCols(1)" class="w-7 h-7 lg:w-8 lg:h-8 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 active:bg-blue-600 transition-colors text-white">+</button>
                </div>
              </div>
              
              <div class="bg-gray-800 p-2 lg:p-3 rounded-lg border border-gray-700">
                <label class="block text-[10px] lg:text-xs text-gray-400 mb-1.5">橫列 (Row)</label>
                <div class="flex items-center gap-2 lg:gap-3">
                  <button (click)="updateRows(-1)" class="w-7 h-7 lg:w-8 lg:h-8 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 active:bg-blue-600 transition-colors text-white">-</button>
                  <span class="text-lg lg:text-xl font-bold w-4 text-center">{{rows()}}</span>
                  <button (click)="updateRows(1)" class="w-7 h-7 lg:w-8 lg:h-8 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 active:bg-blue-600 transition-colors text-white">+</button>
                </div>
              </div>
            </div>
          </section>

          <!-- Aspect Ratio Settings -->
          <section>
             <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 lg:mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              格線比例 (Ratio)
            </h3>
            <div class="grid grid-cols-3 gap-2">
              @for (ratio of aspectRatios; track ratio.label) {
                <button 
                  (click)="setRatio(ratio)"
                  [class.bg-blue-600]="selectedRatio() === ratio"
                  [class.text-white]="selectedRatio() === ratio"
                  [class.border-transparent]="selectedRatio() === ratio"
                  [class.bg-gray-800]="selectedRatio() !== ratio"
                  [class.text-gray-300]="selectedRatio() !== ratio"
                  [class.border-gray-700]="selectedRatio() !== ratio"
                  class="px-1 py-2 lg:px-2 text-[10px] lg:text-xs font-medium rounded-md border hover:border-gray-500 transition-all text-center whitespace-nowrap">
                  {{ ratio.label }}
                </button>
              }
            </div>
            
            <!-- Custom Ratio Inputs -->
            @if (selectedRatio().value === -1) {
              <div class="mt-3 flex items-center gap-2 bg-gray-800 p-2 rounded-lg border border-gray-700">
                 <div class="flex-1">
                   <label class="text-[10px] text-gray-400 block mb-1">寬 (W)</label>
                   <input type="number" [value]="customRatioW()" (input)="updateCustomW($event)" class="w-full bg-gray-700 text-white text-sm px-2 py-1 rounded border border-gray-600 focus:border-blue-500 outline-none">
                 </div>
                 <span class="text-gray-500 mt-4">:</span>
                 <div class="flex-1">
                   <label class="text-[10px] text-gray-400 block mb-1">高 (H)</label>
                   <input type="number" [value]="customRatioH()" (input)="updateCustomH($event)" class="w-full bg-gray-700 text-white text-sm px-2 py-1 rounded border border-gray-600 focus:border-blue-500 outline-none">
                 </div>
              </div>
            }

            <p class="text-[10px] lg:text-xs text-gray-500 mt-2">
              @if (selectedRatio().isFree) {
                裁切範圍將符合圖片比例。
              } @else if (selectedRatio().value === -1) {
                自訂每一格的比例為 {{customRatioW()}}:{{customRatioH()}}。
              } @else {
                鎖定每格比例為 {{ selectedRatio().label }}。
              }
            </p>
          </section>
          
          <!-- Zoom Controls -->
          <section>
            <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 lg:mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              調整裁切 (Crop)
            </h3>
            <div class="bg-gray-800 p-3 lg:p-4 rounded-lg border border-gray-700 space-y-4">
              <div>
                <div class="flex justify-between mb-1">
                  <label class="text-xs text-gray-400">縮放</label>
                  <span class="text-xs font-mono text-blue-400">{{ (zoom() * 100).toFixed(0) }}%</span>
                </div>
                <input 
                  type="range" 
                  min="0.1" 
                  max="3" 
                  step="0.01" 
                  [value]="zoom()" 
                  (input)="onZoomInput($event)"
                  class="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500">
              </div>
            </div>
          </section>

          <!-- Action -->
          <button 
            (click)="generateSlices()"
            class="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg shadow-blue-900/50 transition-all transform active:scale-95 flex items-center justify-center gap-2 text-sm lg:text-base">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.5 19c0-1.7-1.3-3-3-3h-11"/><path d="M13 22l4.5-3L13 16"/><path d="M6 16V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v7"/></svg>
            開始切割圖片
          </button>
          
          <!-- Spacer for mobile scroll -->
          <div class="h-4 lg:hidden"></div>
        </div>
      </aside>

      <!-- Main Preview / Results Area -->
      <main class="flex-1 relative bg-gray-950 overflow-hidden flex flex-col min-h-0">
        
        <!-- Viewport Header -->
        <div class="h-10 lg:h-12 border-b border-gray-800 flex items-center px-4 justify-between bg-gray-900/50 backdrop-blur shrink-0 z-20">
          <span class="text-[10px] lg:text-xs text-gray-400 font-mono">
            {{ originalWidth() }} × {{ originalHeight() }}
          </span>
          <div class="flex gap-4 text-[10px] lg:text-xs">
            <div class="flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-blue-500"></span>
              <span class="text-gray-300">保留</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full border border-dashed border-gray-400"></span>
              <span class="text-gray-300">切割線</span>
            </div>
          </div>
        </div>

        <!-- The Editor Stage -->
        @if (!generatedSlices().length) {
          <div class="flex-1 relative overflow-hidden flex items-center justify-center p-4 lg:p-8 bg-checkerboard select-none">
            
            <div 
              #viewportContainer
              class="relative shadow-2xl shadow-black ring-1 ring-gray-700 bg-gray-900 overflow-hidden cursor-move touch-none"
              [style.width.px]="viewportDims().width"
              [style.height.px]="viewportDims().height"
              (mousedown)="startDrag($event)"
              (touchstart)="startTouch($event)"
              (wheel)="onWheel($event)">
              
              <!-- The Image -->
               <img 
                [src]="imageUrl()" 
                class="absolute max-w-none origin-center pointer-events-none will-change-transform"
                [style.transform]="imageTransform()"
                [style.width.px]="imageDisplayWidth()"
                [style.height.px]="imageDisplayHeight()"
                [style.left.px]="position().x"
                [style.top.px]="position().y"
                alt="Source">

               <!-- Grid Overlay -->
               <div class="absolute inset-0 pointer-events-none border-2 border-blue-500/50 z-10">
                 <!-- Vertical Lines -->
                 @for (i of colArray(); track i) {
                   <div 
                    class="absolute top-0 bottom-0 border-l border-dashed border-white/50 shadow-[0_0_2px_black]" 
                    [style.left.%]="(i / cols()) * 100"></div>
                 }
                 <!-- Horizontal Lines -->
                 @for (j of rowArray(); track j) {
                   <div 
                    class="absolute left-0 right-0 border-t border-dashed border-white/50 shadow-[0_0_2px_black]" 
                    [style.top.%]="(j / rows()) * 100"></div>
                 }
                 
                 <!-- Dimensions Label -->
                 <div class="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-md">
                   {{ (viewportDims().width / displayScale()).toFixed(0) }} × {{ (viewportDims().height / displayScale()).toFixed(0) }} px
                 </div>
               </div>
               
               <!-- Snap Indicators (Optional feedback) -->
               @if(isSnappingX()){
                 <div class="absolute inset-y-0 w-px bg-yellow-400 z-50 shadow-[0_0_4px_yellow]" [style.left.px]="position().x <= 0 ? 0 : viewportDims().width - 1"></div>
               }
               @if(isSnappingY()){
                 <div class="absolute inset-x-0 h-px bg-yellow-400 z-50 shadow-[0_0_4px_yellow]" [style.top.px]="position().y <= 0 ? 0 : viewportDims().height - 1"></div>
               }

            </div>
            
            <div class="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
                <div class="text-[10px] lg:text-xs text-gray-500 bg-gray-900/80 px-3 py-1 rounded-full backdrop-blur shadow-sm">
                 拖曳移動 (邊框自動吸附) • 雙指縮放
                </div>
            </div>

          </div>
        } @else {
          <!-- Results View -->
          <div class="flex-1 overflow-y-auto p-4 lg:p-8 bg-gray-950">
            <div class="max-w-5xl mx-auto">
              <div class="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
                <div>
                  <h2 class="text-xl lg:text-2xl font-bold text-white">切割完成！</h2>
                  <p class="text-xs lg:text-sm text-gray-400 mt-1">共 {{ generatedSlices().length }} 張圖片</p>
                </div>
                <div class="flex gap-3 items-center">
                  <button (click)="clearResults()" class="text-xs lg:text-sm text-gray-400 hover:text-white underline">重設</button>
                  <button 
                    (click)="downloadAll()"
                    class="flex-1 lg:flex-none px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg shadow-lg flex justify-center items-center gap-2 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    下載全部 (ZIP)
                  </button>
                </div>
              </div>
              
              <div 
                class="grid gap-3 lg:gap-4"
                [style.grid-template-columns]="'repeat(' + cols() + ', minmax(0, 1fr))'">
                @for (slice of generatedSlices(); track $index) {
                  <div class="group relative bg-gray-900 rounded-lg overflow-hidden border border-gray-800 w-full" 
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
              
              <div class="mt-8 p-4 bg-gray-900 rounded-lg border border-gray-800 text-center">
                <p class="text-gray-400 text-xs lg:text-sm">點擊圖片可單獨下載</p>
              </div>
            </div>
          </div>
        }
      </main>
      
    </div>
  `
})
export class SplitterEditorComponent implements OnDestroy {
  imageUrl = input.required<string>();
  fileName = input<string>('');
  
  // Grid Config
  rows = signal(1);
  cols = signal(2);
  
  // Custom Ratio
  customRatioW = signal(3);
  customRatioH = signal(2);

  // Aspect Ratios
  aspectRatios: AspectRatio[] = [
    { label: '自由', value: 0, isFree: true },
    { label: '1:1', value: 1, isFree: false },
    { label: '4:5', value: 4/5, isFree: false },
    { label: '3:4', value: 3/4, isFree: false },
    { label: '9:16', value: 9/16, isFree: false },
    { label: '16:9', value: 16/9, isFree: false },
    { label: '自訂', value: -1, isFree: false },
  ];
  selectedRatio = signal<AspectRatio>(this.aspectRatios[3]); 

  // Image State
  originalWidth = signal(0);
  originalHeight = signal(0);
  
  // Window State for RWD
  windowWidth = signal(window.innerWidth);
  windowHeight = signal(window.innerHeight);
  
  // Transform State (Pan & Zoom)
  zoom = signal(1);
  position = signal({ x: 0, y: 0 });
  isSnappingX = signal(false);
  isSnappingY = signal(false);
  
  generatedSlices = signal<string[]>([]);
  finalAspectRatio = signal<string>('auto');

  // Computed Helpers
  rowArray = computed(() => Array.from({ length: this.rows() - 1 }, (_, i) => i + 1));
  colArray = computed(() => Array.from({ length: this.cols() - 1 }, (_, i) => i + 1));
  
  filenamePrefix = computed(() => {
    const name = this.fileName() || 'image';
    return name.replace(/\.[^/.]+$/, ""); // Remove extension
  });

  viewportDims = computed(() => {
    const ratioConf = this.selectedRatio();
    const r = this.rows();
    const c = this.cols();
    
    // Calculate TARGET aspect ratio for the TOTAL grid
    let totalRatio: number;
    
    if (ratioConf.isFree) {
       if (this.originalHeight() === 0) return { width: 100, height: 100 };
       totalRatio = this.originalWidth() / this.originalHeight();
    } else if (ratioConf.value === -1) {
       // Custom
       const w = Math.max(0.1, this.customRatioW());
       const h = Math.max(0.1, this.customRatioH());
       const cellRatio = w / h;
       totalRatio = (c * cellRatio) / r;
    } else {
       // Preset
       totalRatio = (c * ratioConf.value) / r;
    }

    // Dynamic max size based on window
    const winW = this.windowWidth();
    const winH = this.windowHeight();
    
    const maxW = Math.min(800, winW - 32); 
    const isMobile = winW < 1024;
    const maxH = isMobile ? (winH * 0.55) : (winH - 120);
    
    let w = maxW;
    let h = w / totalRatio;
    
    if (h > maxH) {
      h = maxH;
      w = h * totalRatio;
    }
    
    if (w > maxW) {
        w = maxW;
        h = w / totalRatio;
    }
    
    return { width: w, height: h };
  });

  fittedImageSize = computed(() => {
    if (this.originalHeight() === 0) return { width: 0, height: 0 };
    
    const v = this.viewportDims();
    const imgR = this.originalWidth() / this.originalHeight();
    const viewR = v.width / v.height;
    
    let baseW, baseH;
    
    if (imgR > viewR) {
      baseH = v.height;
      baseW = baseH * imgR;
    } else {
      baseW = v.width;
      baseH = baseW / imgR;
    }
    
    return { width: baseW, height: baseH };
  });

  imageDisplayWidth = computed(() => this.fittedImageSize().width * this.zoom());
  imageDisplayHeight = computed(() => this.fittedImageSize().height * this.zoom());
  
  displayScale = computed(() => {
    if (this.originalWidth() === 0) return 1;
    return this.imageDisplayWidth() / this.originalWidth();
  });
  
  imageTransform = computed(() => '');

  private resizeListener: () => void;

  constructor() {
    this.resizeListener = () => {
        this.windowWidth.set(window.innerWidth);
        this.windowHeight.set(window.innerHeight);
    };
    window.addEventListener('resize', this.resizeListener);

    effect(() => {
      const url = this.imageUrl();
      if (url) {
        const img = new Image();
        img.onload = () => {
          this.originalWidth.set(img.width);
          this.originalHeight.set(img.height);
          this.centerImage();
        };
        img.src = url;
      }
    });

    effect(() => {
      this.rows();
      this.cols();
      this.selectedRatio();
      this.customRatioW();
      this.customRatioH();
      this.windowWidth(); 
      setTimeout(() => this.centerImage(), 0);
    });
  }

  ngOnDestroy() {
      if (this.resizeListener) {
          window.removeEventListener('resize', this.resizeListener);
      }
  }
  
  centerImage() {
    const v = this.viewportDims();
    const iw = this.imageDisplayWidth();
    const ih = this.imageDisplayHeight();
    
    this.position.set({
      x: (v.width - iw) / 2,
      y: (v.height - ih) / 2
    });
    this.zoom.set(1);
    this.isSnappingX.set(false);
    this.isSnappingY.set(false);
  }

  // --- Interaction Logic ---
  isDragging = false;
  dragStart = { x: 0, y: 0 };
  basePos = { x: 0, y: 0 };

  startDrag(e: MouseEvent) {
    e.preventDefault();
    this.isDragging = true;
    this.dragStart = { x: e.clientX, y: e.clientY };
    this.basePos = { ...this.position() };
    
    const mouseMove = (ev: MouseEvent) => {
      if (!this.isDragging) return;
      const dx = ev.clientX - this.dragStart.x;
      const dy = ev.clientY - this.dragStart.y;
      this.handleDragMove(dx, dy);
    };
    
    const mouseUp = () => {
      this.isDragging = false;
      this.isSnappingX.set(false);
      this.isSnappingY.set(false);
      document.removeEventListener('mousemove', mouseMove);
      document.removeEventListener('mouseup', mouseUp);
    };
    
    document.addEventListener('mousemove', mouseMove);
    document.addEventListener('mouseup', mouseUp);
  }

  startTouch(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    this.isDragging = true;
    this.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    this.basePos = { ...this.position() };
    
    const touchMove = (ev: TouchEvent) => {
        if (!this.isDragging) return;
        ev.preventDefault();
        const dx = ev.touches[0].clientX - this.dragStart.x;
        const dy = ev.touches[0].clientY - this.dragStart.y;
        this.handleDragMove(dx, dy);
    };

    const touchEnd = () => {
       this.isDragging = false;
       this.isSnappingX.set(false);
       this.isSnappingY.set(false);
       document.removeEventListener('touchmove', touchMove);
       document.removeEventListener('touchend', touchEnd);
    };

    document.addEventListener('touchmove', touchMove, { passive: false });
    document.addEventListener('touchend', touchEnd);
  }
  
  handleDragMove(dx: number, dy: number) {
    let nx = this.basePos.x + dx;
    let ny = this.basePos.y + dy;
    
    const SNAP_DIST = 15;
    const v = this.viewportDims();
    const iw = this.imageDisplayWidth();
    const ih = this.imageDisplayHeight();
    
    // Snap X
    // Edges relative to viewport.
    // Image Left = nx
    // Image Right = nx + iw
    // Viewport Left = 0
    // Viewport Right = v.width
    
    let snappedX = false;
    let snappedY = false;

    // Snap Left to Viewport Left
    if (Math.abs(nx) < SNAP_DIST) {
      nx = 0;
      snappedX = true;
    }
    // Snap Right to Viewport Right
    else if (Math.abs(nx + iw - v.width) < SNAP_DIST) {
      nx = v.width - iw;
      snappedX = true;
    }
    
    // Snap Y
    if (Math.abs(ny) < SNAP_DIST) {
      ny = 0;
      snappedY = true;
    }
    else if (Math.abs(ny + ih - v.height) < SNAP_DIST) {
      ny = v.height - ih;
      snappedY = true;
    }
    
    this.isSnappingX.set(snappedX);
    this.isSnappingY.set(snappedY);

    this.position.set({ x: nx, y: ny });
  }

  onWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY * -0.001;
    const newZoom = Math.max(0.1, Math.min(5, this.zoom() + delta));
    this.zoom.set(newZoom);
  }
  
  onZoomInput(e: Event) {
    const v = parseFloat((e.target as HTMLInputElement).value);
    this.zoom.set(v);
  }

  updateRows(delta: number) {
    this.rows.update(v => Math.max(1, Math.min(10, v + delta)));
  }

  updateCols(delta: number) {
    this.cols.update(v => Math.max(1, Math.min(10, v + delta)));
  }

  setRatio(r: AspectRatio) {
    this.selectedRatio.set(r);
  }

  updateCustomW(e: Event) {
    const v = parseInt((e.target as HTMLInputElement).value, 10);
    if (!isNaN(v) && v > 0) this.customRatioW.set(v);
  }

  updateCustomH(e: Event) {
    const v = parseInt((e.target as HTMLInputElement).value, 10);
    if (!isNaN(v) && v > 0) this.customRatioH.set(v);
  }
  
  clearResults() {
    this.generatedSlices.set([]);
  }
  
  getDownloadName(index: number) {
    return `${this.filenamePrefix()}_slice_${index + 1}.jpg`;
  }

  async downloadAll() {
    const zip = new JSZip();
    const slices = this.generatedSlices();
    const folder = zip.folder("slices");
    
    if (!folder) return;
    
    const prefix = this.filenamePrefix();

    slices.forEach((dataUrl, index) => {
      // Remove header "data:image/jpeg;base64,"
      const base64Data = dataUrl.split(',')[1];
      folder.file(`${prefix}_slice_${index + 1}.jpg`, base64Data, { base64: true });
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
    const img = new Image();
    img.src = this.imageUrl();
    await img.decode();
    
    const scale = this.originalWidth() / this.imageDisplayWidth();
    
    const cropX = -this.position().x * scale;
    const cropY = -this.position().y * scale;
    const cropW = this.viewportDims().width * scale;
    const cropH = this.viewportDims().height * scale;
    
    const mainCanvas = document.createElement('canvas');
    mainCanvas.width = cropW;
    mainCanvas.height = cropH;
    const ctx = mainCanvas.getContext('2d');
    
    if (!ctx) return;
    
    ctx.drawImage(
      img,
      cropX, cropY, cropW, cropH, 
      0, 0, cropW, cropH
    );
    
    const slices: string[] = [];
    const cellW = cropW / this.cols();
    const cellH = cropH / this.rows();
    
    // Calculate aspect ratio for display
    const ratio = cellW / cellH;
    this.finalAspectRatio.set(`${ratio}`);

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
           slices.push(cellCanvas.toDataURL('image/jpeg', 0.95));
        }
      }
    }
    
    this.generatedSlices.set(slices);
  }
}