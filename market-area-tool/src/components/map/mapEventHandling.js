// Map event handling code to implement label visibility and anti-collision
import { setupLabelVisibilityHandling, cleanupLabelVisibilityHandling } from './labelutils';

/**
 * Initializes basic label visibility management for newly added layers
 * @param {MapView} view - The ArcGIS MapView
 * @returns {Function} Cleanup function
 */
export function initializeLayerLabelManagement(view) {
    if (!view || !view.map) {
      console.warn("[initializeLayerLabelManagement] Invalid view provided");
      return () => {};
    }
  
    const cleanupFunctions = [];
    const processedLayers = new Set();
    
    // Process a layer for label management
    const processLayer = (layer) => {
      // Skip if already processed or invalid
      if (!layer || !layer.graphics || processedLayers.has(layer.id)) {
        return;
      }
      
      console.log(`[LayerAdded] Setting up label visibility for new layer: ${layer.title || layer.id}`);
      
      // Set up label visibility handling based on zoom level
      const cleanup = setupLabelVisibilityHandling(view, layer);
      cleanupFunctions.push(cleanup);
      processedLayers.add(layer.id);
    };
  
    // Process existing layers
    view.map.layers.forEach(processLayer);
    
    // Handle layers being added
    const layerAddHandle = view.map.layers.on("change", (evt) => {
      if (evt.added && evt.added.length > 0) {
        evt.added.forEach(processLayer);
      }
      
      // When layers are removed, remove them from our tracking set
      if (evt.removed && evt.removed.length > 0) {
        evt.removed.forEach(layer => {
          if (layer && processedLayers.has(layer.id)) {
            console.log(`[LayerRemoved] Cleaning up label handling for removed layer: ${layer.title || layer.id}`);
            processedLayers.delete(layer.id);
          }
        });
      }
    });
    
    // Return a function to clean up all event handlers
    return function cleanup() {
      if (layerAddHandle) {
        layerAddHandle.remove();
      }
      
      cleanupFunctions.forEach(fn => {
        if (typeof fn === 'function') {
          fn();
        }
      });
      
      cleanupFunctions.length = 0;
      processedLayers.clear();
      
      console.log("[LabelManagement] All label management handlers removed");
    };
  }

/**
 * Recalculate label positions when the view extent changes
 * This helps prevent label overlaps as users pan and zoom
 * 
 * @param {MapView} view - The ArcGIS MapView object 
 * @param {GraphicsLayer} layer - The layer containing labels
 * @param {Object} options - Additional options
 */
export function setupDynamicLabelPositioning(view, layer, options = {}) {
  if (!view || !layer) {
    console.warn("[setupDynamicLabelPositioning] Invalid view or layer reference");
    return;
  }
  
  // Default options
  const config = {
    throttleDelay: 150,      // Delay in ms to throttle updates
    onlyWhenZooming: false,  // Whether to update only during zoom operations
    ...options
  };
  
  let timeoutId = null;
  let lastUpdateTime = 0;
  
  // Function to update label positions
  const updateLabelPositions = () => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTime;
    
    // Skip if update was too recent
    if (timeSinceLastUpdate < config.throttleDelay) {
      timeoutId = setTimeout(updateLabelPositions, config.throttleDelay - timeSinceLastUpdate);
      return;
    }
    
    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    
    // Record the update time
    lastUpdateTime = now;
    
    try {
      // Exit if layer no longer exists or has no graphics
      if (!layer || !layer.graphics || layer.graphics.length === 0) return;
      
      console.log(`[DynamicLabels] Updating positions for ${layer.title} (${view.zoom.toFixed(2)})`);
      
      // Get current view dimensions
      const viewportWidth = view.width;
      const viewportHeight = view.height;
      
      // Extract points and corresponding labels
      const points = [];
      const labelGraphics = [];
      const pointById = new Map();
      
      // First pass - collect points
      layer.graphics.forEach(graphic => {
        const attrs = graphic.attributes || {};
        
        // Skip label graphics in this pass
        if (attrs.isLabel) return;
        
        // Get screen coordinates for this point
        const screenPoint = view.toScreen(graphic.geometry);
        if (!screenPoint) return;
        
        // Store point information
        const pointId = attrs.OBJECTID ?? `point-${Math.random().toString(36).substr(2, 9)}`;
        points.push({
          id: pointId,
          screenX: screenPoint.x,
          screenY: screenPoint.y,
        });
        
        // Store reference to point by ID for quick lookup
        pointById.set(pointId, {
          graphic,
          screenPoint
        });
      });
      
      // Second pass - collect labels and associate with points
      layer.graphics.forEach(graphic => {
        const attrs = graphic.attributes || {};
        
        // Only process label graphics
        if (!attrs.isLabel) return;
        
        // Find associated point
        const parentId = attrs.parentID;
        if (parentId === undefined || !pointById.has(parentId)) return;
        
        // Store label graphic
        labelGraphics.push({
          graphic,
          pointId: parentId,
          visible: attrs.visible !== false, // Respect manually hidden labels
          priority: 0, // Default priority
        });
      });
      
      // Skip if no labels found
      if (labelGraphics.length === 0) return;
      
      // Get current view scale and set priorities
      const currentScale = view.scale;
      labelGraphics.forEach((labelData, index) => {
        // Simple priority based on index (first graphics have higher priority)
        labelData.priority = index < 20 ? 2 : 1;
      });
      
      // Calculate the maximum number of visible labels based on zoom level
      // More zoomed in = more labels
      const zoomRatio = Math.min(1, Math.max(0, (view.zoom - 8) / 10)); // 0-1 value from zoom 8-18
      const maxLabelsVisible = Math.round(20 + (zoomRatio * 100)); // 20 at zoom 8, up to 120 at zoom 18+
      
      // Sort labels by priority (higher first)
      labelGraphics.sort((a, b) => b.priority - a.priority);
      
      // Set visibility based on zoom and priority
      labelGraphics.forEach((labelData, index) => {
        // Keep original visibility setting if not at base visibility
        if (!labelData.visible) return;
        
        // Set visibility based on priority and max visible count
        const shouldBeVisible = index < maxLabelsVisible;
        labelData.graphic.visible = shouldBeVisible && view.zoom >= (layer.labelVisibilityTracking?.minimumZoom || 10);
      });
      
      // Calculate offsets to reduce overlaps
      // This is a simplified logic - in a full implementation we'd use a more 
      // sophisticated label placement algorithm
      
      // Use spiral pattern starting from higher priority labels
      const usedPositions = new Set(); // Track used positions
      const getPositionKey = (x, y) => `${Math.round(x/10)},${Math.round(y/10)}`; // 10px grid
      
      // Array of potential offsets (x, y) in order of preference
      const offsetPatterns = [
        [0, 14],           // Below
        [0, -14],          // Above
        [14, 0],           // Right
        [-14, 0],          // Left
        [14, 14],          // Bottom-right
        [-14, 14],         // Bottom-left 
        [14, -14],         // Top-right
        [-14, -14],        // Top-left
        [0, 21],           // Further below
        [0, -21],          // Further above
        [21, 0],           // Further right
        [-21, 0],          // Further left
      ];
      
      // Apply offsets to each visible label
      labelGraphics.forEach(labelData => {
        // Skip hidden labels
        if (!labelData.graphic.visible) return;
        
        // Get the associated point
        const pointData = pointById.get(labelData.pointId);
        if (!pointData) return;
        
        const screenX = pointData.screenPoint.x;
        const screenY = pointData.screenPoint.y;
        
        // Try each offset pattern until we find an unused position
        let bestOffset = offsetPatterns[0]; // Default to first pattern
        
        // Check existing symbol first - if it's already placed well, keep it
        const currentSymbol = labelData.graphic.symbol;
        if (currentSymbol) {
          const currentX = currentSymbol.xoffset || 0;
          const currentY = currentSymbol.yoffset || 0;
          
          // If position is still available, keep it
          const currentPosKey = getPositionKey(screenX + currentX, screenY + currentY);
          if (!usedPositions.has(currentPosKey)) {
            bestOffset = [currentX, currentY];
            usedPositions.add(currentPosKey);
          }
        }
        
        // If we don't have a valid position yet, try patterns
        if (bestOffset === offsetPatterns[0]) {
          for (const offset of offsetPatterns) {
            const posKey = getPositionKey(screenX + offset[0], screenY + offset[1]);
            
            if (!usedPositions.has(posKey)) {
              bestOffset = offset;
              usedPositions.add(posKey);
              break;
            }
          }
        }
        
        // Update the label symbol with the best offset
        if (labelData.graphic.symbol) {
          const newSymbol = labelData.graphic.symbol.clone();
          newSymbol.xoffset = bestOffset[0];
          newSymbol.yoffset = bestOffset[1];
          labelData.graphic.symbol = newSymbol;
        }
      });
      
      console.log(`[DynamicLabels] Updated ${labelGraphics.length} labels for ${layer.title}`);
    } catch (error) {
      console.error("[DynamicLabels] Error updating label positions:", error);
    }
  };
  
  // Set up event listeners
  
  // Update on extent change (handles zoom and pan)
  const extentHandle = view.watch("extent", () => {
    // Skip if set to update only during zoom
    if (config.onlyWhenZooming && !view.interacting) return;
    
    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    // Set new timeout for updating
    timeoutId = setTimeout(updateLabelPositions, config.throttleDelay);
  });
  
  // Update when stationary after interaction
  const stationaryHandle = view.watch("stationary", (isStationary) => {
    if (isStationary) {
      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Set new timeout for updating
      timeoutId = setTimeout(updateLabelPositions, 50); // Shorter delay for final update
    }
  });
  
  // Store handles on the layer for cleanup
  layer.dynamicLabelHandles = {
    extent: extentHandle,
    stationary: stationaryHandle
  };
  
  // Do an initial update
  updateLabelPositions();
  
  // Return a cleanup function
  return function cleanup() {
    // Clear any pending timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    
    // Remove event listeners
    if (layer.dynamicLabelHandles) {
      if (layer.dynamicLabelHandles.extent) {
        layer.dynamicLabelHandles.extent.remove();
      }
      if (layer.dynamicLabelHandles.stationary) {
        layer.dynamicLabelHandles.stationary.remove();
      }
      layer.dynamicLabelHandles = null;
    }
  };
}

/**
 * Initialize dynamic label positioning for all layers in a view
 * 
 * @param {MapView} view - The ArcGIS MapView
 * @param {Object} options - Configuration options
 * @returns {Function} Cleanup function
 */
export function initializeDynamicLabelManagement(view, options = {}) {
    if (!view) {
      console.warn("[initializeDynamicLabelManagement] Invalid view provided");
      return () => {};
    }
    
    const throttleDelay = options.throttleDelay || 250; // ms
    const onlyWhenZooming = options.onlyWhenZooming || false;
    
    let throttleTimeout = null;
    let isProcessing = false;
    const processedLayers = new Set();
    
    // Process layers to update label positions
    const updateLabelPositions = () => {
      if (isProcessing) return;
      
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
      
      throttleTimeout = setTimeout(() => {
        isProcessing = true;
        
        try {
          if (!view || !view.map) return;
          
          // Loop through all graphics layers
          view.map.layers.forEach(layer => {
            if (layer.type !== "graphics" || !layer.graphics) return;
            
            // Track current zoom level
            const currentZoom = view.zoom;
            
            console.log(`[DynamicLabels] Updating positions for ${layer.title || 'Unknown Layer'} (${currentZoom.toFixed(2)})`);
            
            // Look for label graphics
            const labelGraphics = [];
            layer.graphics.forEach(graphic => {
              if (graphic.attributes?.isLabel === true) {
                labelGraphics.push(graphic);
              }
            });
            
            if (labelGraphics.length === 0) return;
            
            // Update label positions - ensure they're visible if at proper zoom level
            const minZoom = layer.labelVisibilityTracking?.minimumZoom || 10;
            const shouldBeVisible = currentZoom >= minZoom;
            
            // Make sure labels are visible at appropriate zoom levels
            labelGraphics.forEach(label => {
              // Key fix: Set visibility directly based on zoom threshold
              // This ensures labels are shown when zoomed in enough
              label.visible = shouldBeVisible;
            });
            
            console.log(`[DynamicLabels] Updated ${labelGraphics.length} labels for ${layer.title || 'Unknown Layer'}`);
            
            // Track that we've processed this layer
            processedLayers.add(layer.id);
          });
        } catch (error) {
          console.error("[DynamicLabels] Error updating labels:", error);
        } finally {
          isProcessing = false;
        }
      }, throttleDelay);
    };
    
    // Setup view change event handlers
    const viewHandles = [];
    
    if (onlyWhenZooming) {
      viewHandles.push(
        view.watch("zoom", () => updateLabelPositions())
      );
    } else {
      viewHandles.push(
        view.watch("extent", () => updateLabelPositions())
      );
    }
    
    // Initial update
    updateLabelPositions();
    
    // Return cleanup function
    return function cleanup() {
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
      
      viewHandles.forEach(handle => {
        if (handle && typeof handle.remove === 'function') {
          handle.remove();
        }
      });
      
      viewHandles.length = 0;
      processedLayers.clear();
    };
  }