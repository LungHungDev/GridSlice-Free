import { Component, input, effect, inject, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorStateService } from '../services/editor-state.service';
import { ImageProcessorService } from '../services/image-processor.service';

// Child Components
import { EditorStageComponent } from './editor-stage.component';
import { DesktopSidebarComponent } from './desktop-sidebar.component';
import { MobileControlsComponent } from './mobile-controls.component';
import { ResultGalleryComponent } from './result-gallery.component';

@Component({
  selector: 'app-splitter-editor',
  standalone: true,
  imports: [
    CommonModule, 
    EditorStageComponent, 
    DesktopSidebarComponent, 
    MobileControlsComponent,
    ResultGalleryComponent
  ],
  template: `
    <div class="h-full w-full bg-gray-950 relative overflow-hidden flex flex-col lg:flex-row">
      
      @if (state.generatedSlices().length > 0) {
        <!-- RESULT VIEW -->
        <app-result-gallery class="w-full h-full" />
      } @else {
        <!-- EDITOR VIEW -->
        
        <!-- Mobile Controls Overlay -->
        <app-mobile-controls />

        <!-- Desktop Header (Empty placeholder for spacing if needed, or info) -->
        <div class="hidden lg:flex h-12 border-b border-gray-800 items-center px-4 justify-between bg-gray-900/50 backdrop-blur shrink-0 z-30 absolute top-0 left-0 right-0 pointer-events-none">
          <!-- Can put status text here later -->
        </div>

        <!-- Main Canvas Stage -->
        <main class="flex-1 relative bg-gray-900 overflow-hidden flex flex-col w-full h-full min-h-0">
           <app-editor-stage class="w-full h-full" />
        </main>

        <!-- Desktop Sidebar -->
        <app-desktop-sidebar />
      }
    </div>
  `
})
export class SplitterEditorComponent {
  initialFiles = input.required<File[]>();
  
  state = inject(EditorStateService);
  processor = inject(ImageProcessorService);

  constructor() {
    // React to new files being passed in from AppComponent
    effect(() => {
      const files = this.initialFiles();
      if (files.length > 0) {
        // CRITICAL FIX: Use untracked() here.
        // processFiles() reads signals (like layers.length, totalWidth) and then updates layers.
        // If not untracked, this effect creates a dependency on 'layers', causing an infinite loop.
        untracked(() => {
            this.processor.processFiles(files);
        });
      }
    });
  }
}
