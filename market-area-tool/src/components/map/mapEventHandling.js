/**
 * mapEventHandling.js - Map event management and label processing
 * 
 * This module provides specialized event handlers for map interactions,
 * particularly focusing on label management and visibility.
 */

import { 
    setupLabelVisibilityHandling, 
    calculateLabelPositions, 
    optimizeLabelText, 
    fixLabelOffsetForHighDPI 
  } from './labelutils';
  
  import Graphic from "@arcgis/core/Graphic";
  import Color from "@arcgis/core/Color";
  
  /**
   * Initialize label visibility management for all map layers
   * 
   * @param {MapView} view - The ArcGIS MapView
   * @returns {Function} Cleanup function to remove event handlers
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
      if (layerAddHandle && typeof layerAddHandle.remove === 'function') {
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
      return true;
    };
  }
  
  /**
   * Initialize dynamic label positioning to prevent overlaps during map navigation
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
    
    const throttleDelay = options.throttleDelay || 250; // ms between updates
    const onlyWhenZooming = options.onlyWhenZooming || false; // only update during zoom
    const maxLabelsPerLayer = options.maxLabelsPerLayer || 100; // Maximum labels to process per layer
    const collisionBuffer = options.collisionBuffer || 3; // Buffer around labels in pixels
    
    let throttleTimeout = null;
    let isProcessing = false;
    const processedLayers = new Map(); // Track processed layers and their state
    
    // Throttled function to update label positions
    const updateLabelPositions = () => {
      if (isProcessing) return;
      
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
      
      throttleTimeout = setTimeout(() => {
        isProcessing = true;
        
        try {
          if (!view || !view.map) return;
          
          // Current zoom level
          const currentZoom = view.zoom;
          
          // Find all graphics layers with labels
          view.map.layers.forEach(layer => {
            if (layer.type !== "graphics" || !layer.graphics) return;
            
            // Skip layer if no label tracking info
            const trackingInfo = layer.labelVisibilityTracking;
            if (!trackingInfo) return;
            
            // Check if the layer should show labels at current zoom
            const minZoom = trackingInfo.minimumZoom || 10;
            const shouldShowLabels = currentZoom >= minZoom;
            
            console.log(`[DynamicLabels] Updating positions for ${layer.title || 'Unknown Layer'} (${currentZoom.toFixed(2)})`);
            
            // Track label and parent point graphics
            const labelGraphics = [];
            const parentPoints = new Map(); // OBJECTID -> point graphic
            
            // First pass: gather all graphics
            layer.graphics.forEach(graphic => {
              if (!graphic.attributes) return;
              
              if (graphic.attributes.isLabel) {
                labelGraphics.push(graphic);
              } else if (graphic.attributes.OBJECTID !== undefined) {
                parentPoints.set(graphic.attributes.OBJECTID, graphic);
              }
            });
            
            // Skip if no labels found
            if (labelGraphics.length === 0) {
              console.log(`[DynamicLabels] No labels found in layer ${layer.title || 'Unknown Layer'}`);
              return;
            }
            
            // Limit the number of labels to process
            const labelsToProcess = labelGraphics.slice(0, maxLabelsPerLayer);
            
            // Second pass: prepare label points data for position calculation
            const labelPoints = [];
            
            labelsToProcess.forEach(labelGraphic => {
              if (!labelGraphic.geometry) return;
              
              const parentId = labelGraphic.attributes.parentID;
              const parentGraphic = parentId !== undefined ? parentPoints.get(parentId) : null;
              
              // Calculate screen coordinates
              const screenPoint = view.toScreen(labelGraphic.geometry);
              if (!screenPoint) return;
              
              // Extract text from symbol
              const labelText = labelGraphic.symbol?.text || '';
              if (!labelText) return;
              
              // Calculate label width based on text length and font size
              const fontSize = labelGraphic.symbol?.font?.size || 10;
              
              labelPoints.push({
                id: `label-${labelGraphic.attributes.OBJECTID || Math.random().toString(36).substring(2, 9)}`,
                screenX: screenPoint.x,
                screenY: screenPoint.y,
                labelText,
                fontSize,
                labelGraphic,
                parentGraphic,
                // Calculate priority based on label importance
                priority: labelGraphic.attributes.priority || 
                          labelGraphic.attributes.importance || 
                          (parentId ? 2 : 1) // Labels with parents have higher priority
              });
            });
            
            // Skip if no valid label points
            if (labelPoints.length === 0) return;
            
            // Calculate positions with anti-collision
            const positions = calculateLabelPositions(labelPoints, {
              viewWidth: view.width,
              viewHeight: view.height,
              fontSize: 10, // Default font size, will be overridden by individual label settings
              avoidCollisions: true,
              maxLabelsVisible: maxLabelsPerLayer,
              padding: collisionBuffer
            });
            
            // Apply calculated positions
            positions.forEach(position => {
              const point = labelPoints.find(p => p.id === position.id);
              if (!point || !point.labelGraphic) return;
              
              // Get current symbol
              const labelGraphic = point.labelGraphic;
              const currentSymbol = labelGraphic.symbol;
              if (!currentSymbol) return;
              
              // Update offsets in the symbol
              currentSymbol.xoffset = position.x;
              currentSymbol.yoffset = position.y;
              
              // Set visibility
              labelGraphic.visible = shouldShowLabels && position.visible;
              
              // Fix offsets for high DPI displays
              fixLabelOffsetForHighDPI(view, labelGraphic, {
                x: position.x,
                y: position.y
              });
            });
            
            console.log(`[DynamicLabels] Updated ${positions.length} labels for ${layer.title || 'Unknown Layer'}`);
          });
        } catch (error) {
          console.error("[DynamicLabels] Error updating label positions:", error);
        } finally {
          isProcessing = false;
        }
      }, throttleDelay);
    };
    
    // Event handlers for view changes
    const viewHandles = [];
    
    // Setup zoom/pan event handling based on configuration
    if (onlyWhenZooming) {
      // Only watch zoom changes
      viewHandles.push(
        view.watch("zoom", () => {
          updateLabelPositions();
        })
      );
    } else {
      // Watch both zoom and extent changes (panning)
      viewHandles.push(
        view.watch("extent", () => {
          updateLabelPositions();
        })
      );
    }
    
    // Initial update
    updateLabelPositions();
    
    // Return cleanup function
    return function cleanupDynamicLabelManagement() {
      // Clear any pending timeout
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
        throttleTimeout = null;
      }
      
      // Remove all view watches
      viewHandles.forEach(handle => {
        if (handle && typeof handle.remove === 'function') {
          handle.remove();
        }
      });
      
      // Clear tracking
      viewHandles.length = 0;
      processedLayers.clear();
      
      console.log("[DynamicLabelManagement] Cleanup complete");
      return true;
    };
  }
  
  /**
   * Monitor layer label performance for maps with many labels
   * 
   * @param {MapView} view - The ArcGIS MapView
   * @param {Number} threshold - Threshold in milliseconds before performance warning
   * @returns {Function} Cleanup function
   */
  export function monitorLabelPerformance(view, threshold = 100) {
    if (!view || !view.map) return () => {};
    
    const monitoredLayers = new Map(); // Track monitored layers
    
    // Process layer for monitoring
    const setupLayerMonitoring = (layer) => {
      if (!layer || layer.type !== 'graphics' || !layer.graphics || 
          monitoredLayers.has(layer.id)) {
        return;
      }
      
      // Skip layers that don't have labels
      const hasLabels = layer.graphics.some(g => g.attributes?.isLabel);
      if (!hasLabels) return;
      
      // Set up monitoring
      monitoredLayers.set(layer.id, {
        labelCount: 0,
        lastUpdateTime: 0
      });
      
      console.log(`[Performance] Monitoring label performance for layer: ${layer.title || layer.id}`);
    };
    
    // Process existing layers
    view.map.layers.forEach(setupLayerMonitoring);
    
    // Watch for layer changes
    const layerChangeHandle = view.map.layers.on("change", (evt) => {
      if (evt.added && evt.added.length > 0) {
        evt.added.forEach(setupLayerMonitoring);
      }
      
      if (evt.removed && evt.removed.length > 0) {
        evt.removed.forEach(layer => {
          if (layer && monitoredLayers.has(layer.id)) {
            monitoredLayers.delete(layer.id);
          }
        });
      }
    });
    
    // Check label performance on view updates
    const updateHandle = view.watch("updating", (isUpdating) => {
      if (!isUpdating) {
        const updateTimeStart = performance.now();
        
        // Check each monitored layer
        monitoredLayers.forEach((info, layerId) => {
          const layer = view.map.findLayerById(layerId);
          if (!layer) return;
          
          // Count label graphics
          let labelCount = 0;
          let visibleLabelCount = 0;
          
          layer.graphics.forEach(g => {
            if (g.attributes?.isLabel) {
              labelCount++;
              if (g.visible) visibleLabelCount++;
            }
          });
          
          // Update monitoring info
          info.labelCount = labelCount;
          
          // Log only if significant change in count
          if (Math.abs(info.labelCount - labelCount) > 10) {
            console.log(`[Performance] Layer "${layer.title || layer.id}" has ${labelCount} labels (${visibleLabelCount} visible)`);
          }
        });
        
        // Check time taken
        const updateTime = performance.now() - updateTimeStart;
        if (updateTime > threshold) {
          console.warn(`[Performance] Label performance check took ${updateTime.toFixed(1)}ms, which exceeds threshold of ${threshold}ms`);
        }
      }
    });
    
    // Return cleanup function
    return function cleanup() {
      if (layerChangeHandle && typeof layerChangeHandle.remove === 'function') {
        layerChangeHandle.remove();
      }
      
      if (updateHandle && typeof updateHandle.remove === 'function') {
        updateHandle.remove();
      }
      
      monitoredLayers.clear();
      
      console.log("[Performance] Label performance monitoring stopped");
      return true;
    };
  }
  
  /**
   * Enhance label visibility for specific map extents (useful for reports)
   * 
   * @param {MapView} view - The ArcGIS MapView
   * @param {Object} extent - The map extent to enhance
   * @param {Object} options - Enhancement options
   */
  export function enhanceLabelsForExtent(view, extent, options = {}) {
    if (!view || !view.map || !extent) return;
    
    const {
      increaseVisibility = true,
      priorityBoost = 2,
      markLabels = false,
      colorScale = ["#1a73e8", "#e53935", "#43a047", "#fb8c00"],
      fadeOutsideExtent = true,
      outsideOpacity = 0.4
    } = options;
    
    // Function to check if a point is within the extent
    const isPointInExtent = (point) => {
      return point && 
             point.x >= extent.xmin && 
             point.x <= extent.xmax && 
             point.y >= extent.ymin && 
             point.y <= extent.ymax;
    };
    
    // Process all layers with labels
    view.map.layers.forEach(layer => {
      if (layer.type !== 'graphics' || !layer.graphics) return;
      
      // Track label processing stats
      let insideCount = 0;
      let outsideCount = 0;
      let enhancedCount = 0;
      
      layer.graphics.forEach(graphic => {
        if (!graphic.attributes?.isLabel || !graphic.geometry) return;
        
        const isInside = isPointInExtent(graphic.geometry);
        
        if (isInside) {
          insideCount++;
          
          // Always make labels within extent visible
          if (increaseVisibility) {
            graphic.visible = true;
            
            // Boost attributes affecting priority in label positioning
            if (priorityBoost > 0) {
              graphic.attributes.priority = (graphic.attributes.priority || 1) * priorityBoost;
              graphic.attributes.importance = (graphic.attributes.importance || 1) * priorityBoost;
            }
          }
          
          // Mark labels with color coding if requested
          if (markLabels && graphic.symbol) {
            // Clone the symbol to avoid modifying the original
            const originalSymbol = graphic.symbol.clone();
            
            // Apply color based on parent ID or a deterministic value
            const parentId = graphic.attributes.parentID || 0;
            const colorIndex = parentId % colorScale.length;
            
            // Set label color using the color scale
            originalSymbol.color = new Color(colorScale[colorIndex]);
            
            // Apply symbol changes
            graphic.symbol = originalSymbol;
            enhancedCount++;
          }
        } else {
          outsideCount++;
          
          // Fade labels outside the extent if requested
          if (fadeOutsideExtent && graphic.symbol) {
            // Clone the symbol to avoid modifying the original
            const originalSymbol = graphic.symbol.clone();
            
            // Get original color and apply opacity
            const originalColor = originalSymbol.color.toRgba();
            originalColor[3] = outsideOpacity; // Set alpha channel
            
            // Apply faded color
            originalSymbol.color = new Color(originalColor);
            
            // Apply symbol changes
            graphic.symbol = originalSymbol;
          }
        }
      });
      
      console.log(`[ExtentEnhancement] Layer "${layer.title || layer.id}": ${insideCount} labels inside, ${outsideCount} outside, ${enhancedCount} enhanced`);
    });
  }
  
  /**
   * Register advanced map interaction event handlers for label management
   * 
   * @param {MapView} view - The ArcGIS MapView
   * @param {Object} options - Event handling options
   * @returns {Function} Cleanup function
   */
  export function registerMapEventHandlers(view, options = {}) {
    if (!view) return () => {};
    
    const {
      handleClick = true,
      handleHover = true,
      handleDoubleClick = false,
      handleMouseMove = false
    } = options;
    
    const handles = [];
    
    // Click handler
    if (handleClick) {
      const clickHandle = view.on("click", (event) => {
        // Get clicked graphics
        view.hitTest(event).then(response => {
          // Find hit graphics
          const graphics = response.results?.filter(result => result.graphic)
                                         .map(result => result.graphic) || [];
          
          if (graphics.length === 0) return;
          
          // Check if we clicked on a label
          const labelGraphic = graphics.find(g => g.attributes?.isLabel);
          if (labelGraphic) {
            console.log(`[MapEvent] Clicked on label: ${labelGraphic.symbol?.text || 'Unnamed'}`);
            
            // Find associated parent graphic
            const parentId = labelGraphic.attributes.parentID;
            if (parentId !== undefined) {
              const parentGraphic = findParentGraphic(view, parentId);
              
              if (parentGraphic) {
                // Highlight the parent graphic
                highlightGraphic(view, parentGraphic);
                
                // Show parent popup
                view.popup.open({
                  features: [parentGraphic],
                  location: event.mapPoint
                });
              }
            }
          }
        }).catch(err => {
          console.error("[MapEvent] Error in hit test:", err);
        });
      });
      
      handles.push(clickHandle);
    }
    
    // Hover handler
    if (handleHover) {
      const hoverHandle = view.on("pointer-move", debounce((event) => {
        // Skip if dragging or zooming
        if (view.navigating) return;
        
        view.hitTest(event).then(response => {
          const graphics = response.results?.filter(result => result.graphic)
                                         .map(result => result.graphic) || [];
          
          if (graphics.length === 0) {
            // Reset cursor
            view.container.style.cursor = "default";
            return;
          }
          
          // Check if we're hovering over a label
          const labelGraphic = graphics.find(g => g.attributes?.isLabel);
          if (labelGraphic) {
            // Change cursor
            view.container.style.cursor = "pointer";
            
            // Optional: temporarily emphasize the label
            const originalSymbol = labelGraphic.symbol;
            if (originalSymbol) {
              const enhancedSymbol = originalSymbol.clone();
              enhancedSymbol.font.weight = "bold";
              labelGraphic.symbol = enhancedSymbol;
              
              // Reset after delay
              setTimeout(() => {
                labelGraphic.symbol = originalSymbol;
              }, 500);
            }
          } else {
            // Reset cursor if not hovering over a label
            view.container.style.cursor = "default";
          }
        }).catch(err => {
          console.error("[MapEvent] Error in hover hit test:", err);
        });
      }, 50)); // Short debounce for hover
      
      handles.push(hoverHandle);
    }
    
    // Double-click handler
    if (handleDoubleClick) {
      const doubleClickHandle = view.on("double-click", (event) => {
        // Prevent default zoom behavior for label double-clicks
        view.hitTest(event).then(response => {
          const graphics = response.results?.filter(result => result.graphic)
                                         .map(result => result.graphic) || [];
          
          // Check if we double-clicked on a label
          const labelGraphic = graphics.find(g => g.attributes?.isLabel);
          if (labelGraphic) {
            // Prevent default zoom
            event.stopPropagation();
            
            console.log(`[MapEvent] Double-clicked on label: ${labelGraphic.symbol?.text || 'Unnamed'}`);
            
            // Find the parent graphic
            const parentId = labelGraphic.attributes.parentID;
            if (parentId !== undefined) {
              const parentGraphic = findParentGraphic(view, parentId);
              
              if (parentGraphic && parentGraphic.geometry) {
                // Zoom to parent graphic
                view.goTo({
                  target: parentGraphic.geometry,
                  zoom: view.zoom + 2
                }, {
                  duration: 500,
                  easing: "ease-out"
                });
              }
            }
          }
        }).catch(err => {
          console.error("[MapEvent] Error in double-click hit test:", err);
        });
      });
      
      handles.push(doubleClickHandle);
    }
    
    // Return cleanup function
    return function cleanup() {
      handles.forEach(handle => {
        if (handle && typeof handle.remove === 'function') {
          handle.remove();
        }
      });
      
      handles.length = 0;
      
      console.log("[MapEvent] All event handlers removed");
      return true;
    };
  }
  
  // Helper functions
  
  /**
   * Find a parent graphic by ID across all layers
   * 
   * @param {MapView} view - The ArcGIS MapView
   * @param {number|string} parentId - ID of the parent graphic
   * @returns {Graphic|null} Found parent graphic or null
   */
  function findParentGraphic(view, parentId) {
    if (!view || !view.map || parentId === undefined) return null;
    
    let foundGraphic = null;
    
    view.map.layers.forEach(layer => {
      if (layer.type === 'graphics' && layer.graphics && !foundGraphic) {
        layer.graphics.some(g => {
          if (g.attributes?.OBJECTID === parentId) {
            foundGraphic = g;
            return true;
          }
          return false;
        });
      }
    });
    
    return foundGraphic;
  }
  
  /**
   * Highlight a graphic temporarily
   * 
   * @param {MapView} view - The ArcGIS MapView
   * @param {Graphic} graphic - The graphic to highlight
   * @param {Number} duration - Highlight duration in ms
   */
  function highlightGraphic(view, graphic, duration = 1500) {
    if (!view || !view.highlightOptions) return;
    
    const highlight = view.highlight(graphic);
    
    setTimeout(() => {
      highlight.remove();
    }, duration);
  }
  
  /**
   * Debounce function to limit handler executions
   * 
   * @param {Function} func - Function to debounce
   * @param {Number} wait - Wait time in ms
   * @returns {Function} Debounced function
   */
  function debounce(func, wait) {
    let timeout;
    
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }