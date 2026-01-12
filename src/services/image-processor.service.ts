import { Injectable } from '@angular/core';
import JSZip from 'jszip';
import { EditorStateService, ImageLayer } from './editor-state.service';

@Injectable({
  providedIn: 'root'
})
export class ImageProcessorService {

  constructor(private state: EditorStateService) {}

  processFiles(files: File[]): Promise<void> {
    return new Promise((resolve) => {
      let loadedCount = 0;
      const cw = this.state.totalWidth();
      const ch = this.state.totalHeight();
      const currentLayersCount = this.state.layers().length;

      files.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const url = e.target?.result as string;
          const img = new Image();
          img.onload = () => {
             // Calculate scale to fit nicely
             const scaleW = cw / img.width;
             const scaleH = ch / img.height;
             const scale = Math.min(scaleW, scaleH) * 0.6;
             
             const finalW = img.width * scale;
             const finalH = img.height * scale;
             
             // Stagger position
             const offset = index * 30;
             const startX = (cw - finalW) / 2 + offset;
             const startY = (ch - finalH) / 2 + offset;

             const layer: ImageLayer = {
               id: Math.random().toString(36).substring(2, 9),
               file,
               url,
               imgElement: img,
               originalWidth: img.width,
               originalHeight: img.height,
               x: startX,
               y: startY,
               scale,
               zIndex: currentLayersCount + index + 1
             };
             
             this.state.addLayer(layer);
             
             loadedCount++;
             if (loadedCount === files.length) {
               resolve();
             }
          };
          img.src = url;
        };
        reader.readAsDataURL(file);
      });
    });
  }

  generateSlices() {
    const targetWidth = this.state.totalWidth();
    const targetHeight = this.state.totalHeight();
    
    const mainCanvas = document.createElement('canvas');
    mainCanvas.width = targetWidth;
    mainCanvas.height = targetHeight;
    const ctx = mainCanvas.getContext('2d');
    
    if (!ctx) return;
    
    if (!this.state.isTransparent()) {
       ctx.fillStyle = this.state.backgroundColor();
       ctx.fillRect(0, 0, targetWidth, targetHeight);
    }
    
    const sortedLayers = [...this.state.layers()].sort((a, b) => a.zIndex - b.zIndex);
    
    sortedLayers.forEach(layer => {
       const lx = layer.x;
       const ly = layer.y;
       const lw = layer.originalWidth * layer.scale;
       const lh = layer.originalHeight * layer.scale;
       ctx.drawImage(layer.imgElement, lx, ly, lw, lh);
    });
    
    const slices: string[] = [];
    const cellW = this.state.cellWidth();
    const cellH = this.state.cellHeight();
    
    const mime = this.state.isTransparent() ? 'image/png' : 'image/jpeg';
    const quality = 0.95;

    for (let r = 0; r < this.state.rows(); r++) {
      for (let c = 0; c < this.state.cols(); c++) {
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
    
    this.state.generatedSlices.set(slices);
  }

  async downloadAll(filenamePrefix: string) {
    const zip = new JSZip();
    const slices = this.state.generatedSlices();
    const folder = zip.folder("slices");
    
    if (!folder) return;
    
    const ext = this.state.isTransparent() ? 'png' : 'jpg';

    slices.forEach((dataUrl, index) => {
      const base64Data = dataUrl.split(',')[1];
      folder.file(`${filenamePrefix}_slice_${index + 1}.${ext}`, base64Data, { base64: true });
    });

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filenamePrefix}_grid_slices.zip`;
    a.click();
    
    URL.revokeObjectURL(url);
  }
}
