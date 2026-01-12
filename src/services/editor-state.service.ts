import { Injectable, signal, computed } from '@angular/core';

export interface ImageLayer {
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

export interface AspectRatioOption {
  label: string;
  w: number;
  h: number;
}

@Injectable({
  providedIn: 'root'
})
export class EditorStateService {
  // --- Layers State ---
  layers = signal<ImageLayer[]>([]);
  activeLayerId = signal<string | null>(null);
  activeLayer = computed(() => this.layers().find(l => l.id === this.activeLayerId()));

  // --- Grid Configuration ---
  rows = signal(1);
  cols = signal(2);
  cellWidth = signal(1080);
  cellHeight = signal(1080);
  
  totalWidth = computed(() => this.cellWidth() * this.cols());
  totalHeight = computed(() => this.cellHeight() * this.rows());
  
  // Aspect Ratios
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

  // --- Background Settings ---
  isTransparent = signal(true);
  backgroundColor = signal('#ffffff');

  // --- View State ---
  viewZoom = signal(1.0);
  viewTranslateX = signal(0);
  viewTranslateY = signal(0);
  
  // --- Result State ---
  generatedSlices = signal<string[]>([]);
  
  // --- Methods ---

  addLayer(layer: ImageLayer) {
    this.layers.update(ls => [...ls, layer]);
    this.activeLayerId.set(layer.id);
  }

  updateLayer(id: string, updates: Partial<ImageLayer>) {
    this.layers.update(ls => ls.map(l => l.id === id ? { ...l, ...updates } : l));
  }

  removeLayer(id: string) {
    this.layers.update(ls => ls.filter(l => l.id !== id));
    if (this.activeLayerId() === id) {
      this.activeLayerId.set(null);
    }
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

  updateGrid(colsDelta: number, rowsDelta: number) {
    this.cols.update(v => Math.max(1, Math.min(10, v + colsDelta)));
    this.rows.update(v => Math.max(1, Math.min(10, v + rowsDelta)));
  }

  setAspectRatio(option: AspectRatioOption) {
    this.selectedRatio.set(option);
    if (option.w !== 0 && option.h !== 0) {
       const currentW = this.cellWidth();
       const ratioVal = option.w / option.h;
       const newH = Math.round(currentW / ratioVal);
       this.cellHeight.set(newH);
    }
  }

  updateCellSize(dim: 'w' | 'h', value: number) {
    if (isNaN(value) || value <= 0) return;
    
    if (dim === 'w') {
      this.cellWidth.set(value);
      const ratio = this.selectedRatio();
      if (ratio.w !== 0 && ratio.h !== 0) {
         this.cellHeight.set(Math.round(value / (ratio.w / ratio.h)));
      }
    } else {
      this.cellHeight.set(value);
      const ratio = this.selectedRatio();
      if (ratio.w !== 0 && ratio.h !== 0) {
         this.cellWidth.set(Math.round(value * (ratio.w / ratio.h)));
      }
    }
  }
  
  resetView() {
    this.viewZoom.set(1.0);
    this.viewTranslateX.set(0);
    this.viewTranslateY.set(0);
  }
}
