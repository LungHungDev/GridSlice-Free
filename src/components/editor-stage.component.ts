import { Component, computed, signal, OnDestroy, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorStateService, ImageLayer } from '../services/editor-state.service';

@Component({
  selector: 'app-editor-stage',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Background: Gray with 0.5 opacity + Checkerboard -->
    <div class="absolute inset-0 z-0 bg-gray-600/50 pointer-events-none">
        <div class="absolute inset-0 bg-checkerboard opacity-20"></div>
    </div>

    <!-- Interactive Container -->
    <div class="relative flex items-center justify-center w-full h-full p-4 lg:p-8 overflow-visible z-10 touch-none select-none"
         [style.transform]="'translate(' + state.viewTranslateX() + 'px, ' + state.viewTranslateY() + 'px)'"
         (mousedown)="onBgMouseDown($event)"
         (wheel)="onWheel($event)"
         (touchstart)="onContainerTouchStart($event)"
         (touchmove)="onContainerTouchMove($event)"
         (touchend)="onContainerTouchEnd($event)">
         
        <!-- The Canvas Scale Wrapper -->
        <div 
          class="relative flex-shrink-0 transition-transform duration-75 ease-out origin-center shadow-2xl"
          [style.width.px]="displayDims().width"
          [style.height.px]="displayDims().height"
          [style.transform]="'scale(' + state.viewZoom() + ')'">
          
          <!-- Canvas Background -->
          <div class="absolute inset-0 z-0 bg-checkerboard"></div>
          @if (!state.isTransparent()) {
              <div class="absolute inset-0 z-0" [style.background-color]="state.backgroundColor()"></div>
          }

          <!-- Layers -->
          <div class="absolute inset-0 z-10">
              @for (layer of state.layers(); track layer.id) {
                <div
                    class="absolute origin-top-left will-change-transform"
                    [class.ring-1]="state.activeLayerId() === layer.id"
                    [class.ring-blue-400]="state.activeLayerId() === layer.id"
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
                        [class.opacity-50]="state.activeLayerId() !== layer.id && state.activeLayerId() !== null"
                        [class.opacity-100]="state.activeLayerId() === layer.id || state.activeLayerId() === null"
                        alt="layer">
                </div>
              }
          </div>

           <!-- Grid Guides -->
           <div class="absolute inset-0 z-20 pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] border border-white/20">
              @for (i of colArray(); track i) {
                <div class="absolute top-0 bottom-0 border-l border-dashed border-white/60 shadow-[0_0_2px_black]" [style.left.%]="(i / state.cols()) * 100"></div>
              }
              @for (j of rowArray(); track j) {
                <div class="absolute left-0 right-0 border-t border-dashed border-white/60 shadow-[0_0_2px_black]" [style.top.%]="(j / state.rows()) * 100"></div>
              }
           </div>
           
           <!-- Snap Indicators -->
           @if(isSnappingX()){ <div class="absolute inset-y-0 w-px bg-yellow-400 z-30 shadow-[0_0_4px_yellow]" [style.left.px]="snapXPos() * displayScale()"></div> }
           @if(isSnappingY()){ <div class="absolute inset-x-0 h-px bg-yellow-400 z-30 shadow-[0_0_4px_yellow]" [style.top.px]="snapYPos() * displayScale()"></div> }
        </div>
    </div>
  `
})
export class EditorStageComponent implements OnDestroy {
  state = inject(EditorStateService);

  windowWidth = signal(window.innerWidth);
  windowHeight = signal(window.innerHeight);

  // Computed Helpers
  colArray = computed(() => Array.from({ length: this.state.cols() - 1 }, (_, i) => i + 1));
  rowArray = computed(() => Array.from({ length: this.state.rows() - 1 }, (_, i) => i + 1));

  // Display calculations
  displayScale = computed(() => {
     const cw = this.state.totalWidth();
     const ch = this.state.totalHeight();
     if (cw === 0 || ch === 0) return 1;

     const winW = this.windowWidth();
     const winH = this.windowHeight();
     const isMobile = winW < 1024;
     const availableW = isMobile ? winW : (winW - 320 - 48);
     const availableH = isMobile ? winH : (winH - 50);

     return Math.min((availableW - 40) / cw, (availableH - 40) / ch);
  });
  
  displayDims = computed(() => ({
      width: this.state.totalWidth() * this.displayScale(),
      height: this.state.totalHeight() * this.displayScale()
  }));

  // Snapping State
  isSnappingX = signal(false);
  isSnappingY = signal(false);
  snapXPos = signal(0);
  snapYPos = signal(0);

  // Interaction State
  private isLayerDragging = false;
  private isViewDragging = false;
  private dragStart = { x: 0, y: 0 };
  private dragLayerStart = { x: 0, y: 0 };
  private dragLayerId: string | null = null;
  private potentialDragLayerId: string | null = null; // Touch specific

  // Touch State
  private isTouchZooming = false;
  private isTouchPanning = false;
  private isTouchDraggingLayer = false;
  private zoomTarget: 'view' | 'layer' = 'view';
  private lastPinchDistance = 0;
  private startZoom = 1;
  private startLayerScale = 1;
  private pinchCenterStart = { x: 0, y: 0 };
  private layerPosStart = { x: 0, y: 0 };
  private touchStartCoords = { x: 0, y: 0 };

  private resizeListener: () => void;
  private mouseMoveListener: (e: MouseEvent) => void;
  private mouseUpListener: (e: MouseEvent) => void;
  
  constructor() {
    this.resizeListener = () => {
        this.windowWidth.set(window.innerWidth);
        this.windowHeight.set(window.innerHeight);
    };
    window.addEventListener('resize', this.resizeListener);

    this.mouseMoveListener = (e) => this.globalMouseMove(e);
    this.mouseUpListener = (e) => this.globalMouseUp(e);

    document.addEventListener('mousemove', this.mouseMoveListener);
    document.addEventListener('mouseup', this.mouseUpListener);
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.resizeListener);
    document.removeEventListener('mousemove', this.mouseMoveListener);
    document.removeEventListener('mouseup', this.mouseUpListener);
  }

  // --- MOUSE Interaction ---

  onBgMouseDown(e: MouseEvent) {
    this.state.activeLayerId.set(null);
    this.isViewDragging = true;
  }

  startDrag(e: MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    this.state.activeLayerId.set(id);
    this.dragLayerId = id;
    this.isLayerDragging = true;
    
    const layer = this.state.layers().find(l => l.id === id);
    if (layer) {
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.dragLayerStart = { x: layer.x, y: layer.y };
    }
  }

  globalMouseMove(e: MouseEvent) {
    if (this.isLayerDragging && this.dragLayerId) {
       const dx = e.clientX - this.dragStart.x;
       const dy = e.clientY - this.dragStart.y;
       this.handleLayerDrag(dx, dy);
    } else if (this.isViewDragging) {
       this.state.viewTranslateX.update(v => v + e.movementX);
       this.state.viewTranslateY.update(v => v + e.movementY);
    }
  }

  globalMouseUp(e: MouseEvent) {
    this.isLayerDragging = false;
    this.isViewDragging = false;
    this.dragLayerId = null;
    this.isSnappingX.set(false);
    this.isSnappingY.set(false);
  }

  onWheel(e: WheelEvent) {
      e.preventDefault();
      const delta = e.deltaY * -0.001;
      const newZoom = Math.max(0.1, Math.min(2.0, this.state.viewZoom() + delta));
      this.state.viewZoom.set(newZoom);
  }

  // --- TOUCH Interaction ---

  layerTouchStart(e: TouchEvent, id: string) {
      this.potentialDragLayerId = id;
      this.state.activeLayerId.set(id);
  }

  onContainerTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
       // Pinch Start
       this.isTouchZooming = true;
       this.isTouchPanning = false;
       this.isTouchDraggingLayer = false;
       this.lastPinchDistance = this.getDistance(e.touches);

       if (this.potentialDragLayerId) {
         this.zoomTarget = 'layer';
         const layer = this.state.layers().find(l => l.id === this.potentialDragLayerId);
         if (layer) {
             this.startLayerScale = layer.scale;
             this.layerPosStart = { x: layer.x, y: layer.y };
             this.pinchCenterStart = this.getCanvasPointFromTouches(e.touches);
         }
       } else {
         this.zoomTarget = 'view';
         this.startZoom = this.state.viewZoom();
       }
    } else if (e.touches.length === 1) {
       const touch = e.touches[0];
       if (this.potentialDragLayerId) {
          // Drag Layer Start
          this.isTouchDraggingLayer = true;
          this.dragLayerId = this.potentialDragLayerId;
          const layer = this.state.layers().find(l => l.id === this.dragLayerId);
          if (layer) {
             this.dragStart = { x: touch.clientX, y: touch.clientY };
             this.dragLayerStart = { x: layer.x, y: layer.y };
          }
       } else {
          // Pan View Start
          this.isTouchPanning = true;
          this.touchStartCoords = { x: touch.clientX - this.state.viewTranslateX(), y: touch.clientY - this.state.viewTranslateY() };
       }
    }
  }

  onContainerTouchMove(e: TouchEvent) {
    // Pinch Move
    if (this.isTouchZooming && e.touches.length === 2) {
       e.preventDefault();
       const currentDist = this.getDistance(e.touches);
       if (this.lastPinchDistance > 0) {
          const scaleChange = currentDist / this.lastPinchDistance;
          
          if (this.zoomTarget === 'view') {
              const newZoom = Math.max(0.1, Math.min(2.0, this.startZoom * scaleChange));
              this.state.viewZoom.set(newZoom);
          } else if (this.zoomTarget === 'layer' && this.potentialDragLayerId) {
              const layer = this.state.layers().find(l => l.id === this.potentialDragLayerId);
              if (layer) {
                  // Calculate new scale & Snap
                  let newScale = this.startLayerScale * scaleChange;
                  newScale = Math.max(0.05, Math.min(5.0, newScale));
                  
                  // Center Pivot Math
                  const currentPinchCenter = this.getCanvasPointFromTouches(e.touches);
                  const vectorX = this.pinchCenterStart.x - this.layerPosStart.x;
                  const vectorY = this.pinchCenterStart.y - this.layerPosStart.y;
                  const relativeScale = newScale / this.startLayerScale;
                  
                  const newLayerX = currentPinchCenter.x - (vectorX * relativeScale);
                  const newLayerY = currentPinchCenter.y - (vectorY * relativeScale);
                  
                  this.state.updateLayer(this.potentialDragLayerId, {
                      scale: newScale, x: newLayerX, y: newLayerY
                  });
              }
          }
       }
    }
    // Layer Drag Move
    else if (this.isTouchDraggingLayer && e.touches.length === 1 && this.dragLayerId) {
       e.preventDefault();
       const touch = e.touches[0];
       this.handleLayerDrag(touch.clientX - this.dragStart.x, touch.clientY - this.dragStart.y);
    }
    // Pan View Move
    else if (this.isTouchPanning && e.touches.length === 1) {
       e.preventDefault();
       const touch = e.touches[0];
       this.state.viewTranslateX.set(touch.clientX - this.touchStartCoords.x);
       this.state.viewTranslateY.set(touch.clientY - this.touchStartCoords.y);
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

  // --- Maths Helpers ---

  private handleLayerDrag(dxScreen: number, dyScreen: number) {
     if (!this.dragLayerId) return;
     
     const scale = this.displayScale() * this.state.viewZoom();
     const dx = dxScreen / scale;
     const dy = dyScreen / scale;
     
     const layer = this.state.layers().find(l => l.id === this.dragLayerId);
     if (!layer) return;

     let nx = this.dragLayerStart.x + dx;
     let ny = this.dragLayerStart.y + dy;

     // Snapping Logic
     const cw = this.state.totalWidth();
     const ch = this.state.totalHeight();
     const currentW = layer.originalWidth * layer.scale;
     const currentH = layer.originalHeight * layer.scale;
     const SNAP_DIST = 15;

     let snappedX = false, snappedY = false;
     let sx = 0, sy = 0;

     // X Targets
     const targetsX = [0, cw];
     for(let i=1; i<this.state.cols(); i++) targetsX.push((i/this.state.cols())*cw);
     
     for (const t of targetsX) {
         if (Math.abs(nx - t) < SNAP_DIST) { nx = t; snappedX=true; sx=t; break; }
         if (Math.abs(nx + currentW - t) < SNAP_DIST) { nx = t - currentW; snappedX=true; sx=t; break; }
         if (Math.abs(nx + currentW/2 - t) < SNAP_DIST) { nx = t - currentW/2; snappedX=true; sx=t; break; }
     }

     // Y Targets
     const targetsY = [0, ch];
     for(let j=1; j<this.state.rows(); j++) targetsY.push((j/this.state.rows())*ch);

     for (const t of targetsY) {
         if (Math.abs(ny - t) < SNAP_DIST) { ny = t; snappedY=true; sy=t; break; }
         if (Math.abs(ny + currentH - t) < SNAP_DIST) { ny = t - currentH; snappedY=true; sy=t; break; }
         if (Math.abs(ny + currentH/2 - t) < SNAP_DIST) { ny = t - currentH/2; snappedY=true; sy=t; break; }
     }

     this.isSnappingX.set(snappedX);
     this.isSnappingY.set(snappedY);
     if(snappedX) this.snapXPos.set(sx);
     if(snappedY) this.snapYPos.set(sy);

     this.state.updateLayer(this.dragLayerId, { x: nx, y: ny });
  }

  private getDistance(touches: TouchList) {
     return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  }

  private getCanvasPointFromTouches(touches: TouchList) {
     const screenX = (touches[0].clientX + touches[1].clientX) / 2;
     const screenY = (touches[0].clientY + touches[1].clientY) / 2;
     
     const winW = this.windowWidth();
     const winH = this.windowHeight();
     const cx = winW / 2;
     const cy = winH / 2;
     
     const originX = cx + this.state.viewTranslateX();
     const originY = cy + this.state.viewTranslateY();
     
     const dims = this.displayDims();
     const canvasLeft = originX - (dims.width / 2);
     const canvasTop = originY - (dims.height / 2);
     
     const relX = (screenX - canvasLeft) / this.state.viewZoom();
     const relY = (screenY - canvasTop) / this.state.viewZoom();
     
     return { x: relX / this.displayScale(), y: relY / this.displayScale() };
  }
}
