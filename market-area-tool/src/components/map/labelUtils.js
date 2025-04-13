// src/components/map/labelUtils.js

/**
 * Formats a point label including variables if configured
 * 
 * @param {Object} item - The data point object
 * @param {Object} config - Configuration containing column info and options
 * @returns {String} Formatted label text
 */
export function formatPointLabel(item, config) {
    if (!item) return "Point";
    
    const labelColumn = config?.labelColumn;
    const variable1Column = config?.variable1Column;
    const variable2Column = config?.variable2Column;
    const includeVariables = config?.labelOptions?.includeVariables !== false; // Default to true if not specified
    
    // If we're not including variables or no variables are selected, just return the label
    if (!includeVariables || (!variable1Column && !variable2Column)) {
      return item[labelColumn] || "Point";
    }
    
    // With variables - build a more descriptive label
    const parts = [];
    
    // First part is the label if available
    if (labelColumn && item[labelColumn] !== undefined && item[labelColumn] !== null) {
      parts.push(String(item[labelColumn]));
    }
    
    // If we should include variables in the label
    if (includeVariables) {
      // Build a variables part of the label
      const varParts = [];
      
      // Add variable 1 if available
      if (variable1Column && item[variable1Column] !== undefined && item[variable1Column] !== null) {
        // Format numbers nicely if needed
        const val = typeof item[variable1Column] === 'number' 
          ? formatNumberForLabel(item[variable1Column])
          : item[variable1Column];
        varParts.push(val);
      }
      
      // Add variable 2 if available
      if (variable2Column && item[variable2Column] !== undefined && item[variable2Column] !== null) {
        // Format numbers nicely if needed
        const val = typeof item[variable2Column] === 'number' 
          ? formatNumberForLabel(item[variable2Column])
          : item[variable2Column];
        varParts.push(val);
      }
      
      // Add variables to parts if we have any
      if (varParts.length > 0) {
        parts.push(varParts.join('/'));
      }
    }
    
    // Join all parts with a comma and space
    return parts.length > 0 ? parts.join(', ') : `Point ${item.OBJECTID || ''}`;
  }
  
  /**
   * Format a number for display in a label, applying appropriate rounding
   * 
   * @param {Number} value - The number to format
   * @returns {String} Formatted number
   */
  export function formatNumberForLabel(value) {
    if (typeof value !== 'number' || isNaN(value)) {
      return String(value);
    }
    
    // Handle different magnitude numbers differently
    if (Math.abs(value) >= 1000000) {
      // Millions: show as 1.2M
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1000) {
      // Thousands: show as 4.5K
      return `${(value / 1000).toFixed(1)}K`;
    } else if (Number.isInteger(value)) {
      // Integers: no decimal places
      return value.toString();
    } else if (Math.abs(value) < 0.01) {
      // Very small numbers: scientific notation
      return value.toExponential(1);
    } else {
      // Regular numbers: up to 2 decimal places
      return value.toFixed(2).replace(/\.00$/, '').replace(/\.0$/, '');
    }
  }
  
  /**
   * Generate a title for point popups that includes variables
   * 
   * @param {Object} item - Data point
   * @param {Object} config - Layer configuration
   * @returns {String} Properly formatted title
   */
  export function generatePointTitle(item, config) {
    if (!item) return "Point";
    
    const labelColumn = config?.labelColumn;
    const variable1Column = config?.variable1Column;
    const variable2Column = config?.variable2Column;
    
    // Build title parts
    const parts = [];
    
    // First part is the label if available
    if (labelColumn && item[labelColumn] !== undefined && item[labelColumn] !== null) {
      parts.push(String(item[labelColumn]));
    }
    
    // Add variables if available
    const varParts = [];
    
    // Add variable 1 if available
    if (variable1Column && item[variable1Column] !== undefined && item[variable1Column] !== null) {
      varParts.push(String(item[variable1Column]));
    }
    
    // Add variable 2 if available
    if (variable2Column && item[variable2Column] !== undefined && item[variable2Column] !== null) {
      varParts.push(String(item[variable2Column]));
    }
    
    // Add variables to parts if we have any
    if (varParts.length > 0) {
      parts.push(varParts.join(' / '));
    }
    
    // Join all parts with a comma and space, or default to Point + ID
    return parts.length > 0 ? parts.join(', ') : `Point ${item.OBJECTID || ''}`;
  }
  
  /**
   * Implement anti-collision logic for label positioning
   * 
   * @param {Array} points - Array of points with geometry
   * @param {Object} options - Configuration options
   * @returns {Array} Array of label position objects with adjusted offsets
   */
  export function calculateLabelPositions(points, options = {}) {
    if (!points || points.length === 0) return [];
    
    const avoidCollisions = options.avoidCollisions !== false; // Default true
    const fontSize = options.fontSize || 10;
    const screenWidth = options.viewWidth || 1000; // Default viewport width
    const screenHeight = options.viewHeight || 800; // Default viewport height
    const maxLabelsVisible = options.maxLabelsVisible || 50; // Max labels to show at once
    
    // If not avoiding collisions, return standard positions
    if (!avoidCollisions) {
      return points.map(point => ({
        id: point.id || `label-${Math.random().toString(36).substr(2, 9)}`,
        x: 0,
        y: fontSize + 4, // Default below point
        visible: true
      }));
    }
    
    // Calculate estimated label dimensions based on fontSize and text length
    const labelDimensions = points.map(point => {
      const labelText = point.labelText || '';
      const width = fontSize * 0.6 * labelText.length; // Approximate width based on text length
      return {
        id: point.id,
        width: Math.max(width, 20), // Minimum width of 20px
        height: fontSize + 2 // Height of text plus padding
      };
    });
    
    // Create initial positions (all labels below their points)
    let positions = points.map((point, index) => ({
      id: point.id,
      x: 0, // Initial offset from point center (x)
      y: fontSize + 4, // Initial offset from point center (y) - place below point
      width: labelDimensions[index].width,
      height: labelDimensions[index].height,
      point: point, // Reference to original point
      visible: true,
      screenX: point.screenX, // Screen coordinates if available
      screenY: point.screenY,
      priority: point.priority || 0 // Used for importance ranking
    }));
    
    // Simple collision check between two labels
    const checkCollision = (pos1, pos2) => {
      const x1 = pos1.point.screenX + pos1.x - pos1.width/2;
      const y1 = pos1.point.screenY + pos1.y - pos1.height/2;
      const x2 = pos2.point.screenX + pos2.x - pos2.width/2;
      const y2 = pos2.point.screenY + pos2.y - pos2.height/2;
      
      return !(
        x1 + pos1.width < x2 || 
        x2 + pos2.width < x1 || 
        y1 + pos1.height < y2 || 
        y2 + pos2.height < y1
      );
    };
    
    // Try different positions to avoid collisions
    const candidateOffsets = [
      { x: 0, y: fontSize + 4 },       // Below
      { x: 0, y: -(fontSize + 4) },    // Above
      { x: fontSize + 4, y: 0 },       // Right
      { x: -(fontSize + 4), y: 0 },    // Left
      { x: fontSize + 4, y: fontSize + 4 },    // Bottom-right
      { x: -(fontSize + 4), y: fontSize + 4 }, // Bottom-left
      { x: fontSize + 4, y: -(fontSize + 4) }, // Top-right
      { x: -(fontSize + 4), y: -(fontSize + 4) } // Top-left
    ];
    
    // Flag to track if any optimizations were made
    let optimizationsMade = true;
    let iterations = 0;
    const maxIterations = 3; // Limit iteration count
    
    // Sort positions by priority if a lot of labels
    if (positions.length > maxLabelsVisible) {
      positions.sort((a, b) => b.priority - a.priority);
      
      // Only show top labels based on maxLabelsVisible
      positions.forEach((pos, index) => {
        pos.visible = index < maxLabelsVisible;
      });
    }
    
    // Iteratively optimize label positions to avoid collisions
    while (optimizationsMade && iterations < maxIterations) {
      optimizationsMade = false;
      iterations++;
      
      // Check each visible label against others
      for (let i = 0; i < positions.length; i++) {
        // Skip invisible labels
        if (!positions[i].visible) continue;
        
        let collisionFound = false;
        
        // Check against all other visible labels
        for (let j = 0; j < positions.length; j++) {
          if (i === j || !positions[j].visible) continue;
          
          // Check if labels collide
          if (checkCollision(positions[i], positions[j])) {
            collisionFound = true;
            break;
          }
        }
        
        // If collision found, try alternate positions
        if (collisionFound) {
          let resolved = false;
          
          // Try each candidate position until no collision
          for (const offset of candidateOffsets) {
            // Apply candidate offset
            const originalX = positions[i].x;
            const originalY = positions[i].y;
            positions[i].x = offset.x;
            positions[i].y = offset.y;
            
            // Check if this resolves collisions
            let stillColliding = false;
            for (let j = 0; j < positions.length; j++) {
              if (i === j || !positions[j].visible) continue;
              
              if (checkCollision(positions[i], positions[j])) {
                stillColliding = true;
                break;
              }
            }
            
            if (!stillColliding) {
              resolved = true;
              optimizationsMade = true;
              break; // This position works - no collisions
            } else {
              // Reset to original position and try next candidate
              positions[i].x = originalX;
              positions[i].y = originalY;
            }
          }
          
          // If no position resolves collisions, hide the label
          if (!resolved) {
            positions[i].visible = false;
            optimizationsMade = true;
          }
        }
      }
    }
    
    // Return final position adjustments
    return positions.map(pos => ({
      id: pos.id,
      x: pos.x,
      y: pos.y,
      visible: pos.visible
    }));
  }

/**
 * Factory function to update label visibility based on zoom level
 * 
 * @param {MapView} view - The ArcGIS MapView
 * @param {GraphicsLayer} layer - The graphics layer containing labels
 * @returns {Function} Cleanup function to remove event handlers
 */
export function setupLabelVisibilityHandling(view, layer) {
    if (!view || !layer) {
      console.warn("[setupLabelVisibilityHandling] Invalid view or layer");
      return () => {}; // Return a no-op cleanup function
    }
    
    // Extract tracking configuration from layer
    const tracking = layer.labelVisibilityTracking || {
      enabled: true,
      minimumZoom: 10,
      currentlyVisible: false
    };
    
    const minZoom = tracking.minimumZoom || 10;
    
    // Log initial setup
    console.log(`[LabelVisibility] Setting up for layer "${layer.title}". MinZoom: ${minZoom}, CurrentZoom: ${view.zoom?.toFixed(2)}`);
    
    // Watch for zoom changes
    const zoomHandle = view.watch("zoom", (newZoom) => {
      // Determine if labels should be visible at this zoom level
      const shouldBeVisible = newZoom >= minZoom;
      
      // Log zoom changes for debugging
      console.log(`[LabelVisibility] Zoom changed to ${newZoom.toFixed(2)}. Labels ${shouldBeVisible ? 'should be' : 'should not be'} visible.`);
      
      // Skip if visibility state hasn't changed
      if (tracking.currentlyVisible === shouldBeVisible) {
        console.log(`[LabelVisibility] No visibility change needed (already ${shouldBeVisible ? 'visible' : 'hidden'})`);
        return;
      }
      
      // Update the tracking state
      tracking.currentlyVisible = shouldBeVisible;
      
      // Count for logging
      let updatedCount = 0;
      
      // Find and update all label graphics
      layer.graphics.forEach(graphic => {
        const attrs = graphic.attributes;
        if (attrs && attrs.isLabel === true) {
          // FIXED: Set visibility directly without checking attrs.visible
          // The previous logic was too restrictive
          graphic.visible = shouldBeVisible;
          updatedCount++;
        }
      });
      
      console.log(`[LabelVisibility] "${layer.title}": Updated ${updatedCount} labels to ${shouldBeVisible ? 'visible' : 'hidden'} at zoom ${newZoom.toFixed(2)}`);
    });
    
    // Store the handle for cleanup
    layer.labelVisibilityHandle = zoomHandle;
    
    // Perform initial update based on current zoom
    const currentZoom = view.zoom;
    const shouldBeVisible = currentZoom >= minZoom;
    tracking.currentlyVisible = shouldBeVisible;
    
    // Count for logging
    let initialUpdateCount = 0;
    
    // Apply initial visibility to all labels in the layer
    layer.graphics.forEach(graphic => {
      const attrs = graphic.attributes;
      if (attrs && attrs.isLabel === true) {
        // FIXED: Set visibility directly without checking attrs.visible
        graphic.visible = shouldBeVisible;
        initialUpdateCount++;
      }
    });
    
    console.log(`[LabelVisibility] Initial setup complete for "${layer.title}": Set ${initialUpdateCount} labels to ${shouldBeVisible ? 'visible' : 'hidden'} at zoom ${currentZoom?.toFixed(2)}`);
    
    // Return cleanup function
    return function cleanupLabelVisibility() {
      if (zoomHandle && typeof zoomHandle.remove === 'function') {
        zoomHandle.remove();
        console.log(`[LabelVisibility] Removed zoom watch handler for "${layer.title}"`);
      }
      
      if (layer) {
        layer.labelVisibilityHandle = null;
      }
    };
  }

/**
 * Cleanup function to remove zoom watch handlers
 * 
 * @param {GraphicsLayer} layer - The layer to clean up
 */
export function cleanupLabelVisibilityHandling(layer) {
  if (layer && layer.labelVisibilityHandle) {
    layer.labelVisibilityHandle.remove();
    layer.labelVisibilityHandle = null;
  }
}

/**
 * Initialize label visibility management for all layers in a map view
 * 
 * @param {MapView} view - The ArcGIS MapView to manage labels for
 * @returns {Function} Cleanup function to remove all event handlers
 */
export function initializeLayerLabelManagement(view) {
  if (!view || !view.map) {
    console.warn("[initializeLayerLabelManagement] Invalid view provided");
    return () => {};
  }

  const cleanupFunctions = [];
  
  // Setup initial layers
  view.map.layers.forEach(layer => {
    if (layer.labelVisibilityTracking?.enabled) {
      const cleanup = setupLabelVisibilityHandling(view, layer);
      cleanupFunctions.push(cleanup);
    }
  });
  
  // Watch for layers being added
  const layerWatchHandle = view.map.layers.on("change", (event) => {
    // Handle layers being added
    event.added?.forEach(layer => {
      if (layer.labelVisibilityTracking?.enabled) {
        const cleanup = setupLabelVisibilityHandling(view, layer);
        cleanupFunctions.push(cleanup);
      }
    });
    
    // No need to handle removal - the layer's own cleanup will run
  });
  
  // Return master cleanup function
  return function cleanupAllLabelManagement() {
    // Remove the layer watch
    if (layerWatchHandle) {
      layerWatchHandle.remove();
    }
    
    // Run all individual cleanup functions
    cleanupFunctions.forEach(cleanup => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    });
    
    // Clear the array
    cleanupFunctions.length = 0;
  };
}

/**
 * Initialize dynamic label positioning to prevent overlaps during map navigation
 * 
 * @param {MapView} view - The ArcGIS MapView to manage labels for
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
  
  let throttleTimeout = null;
  let isProcessing = false;
  
  // Throttled function to update label positions
  const updateLabelPositions = () => {
    if (isProcessing) return;
    
    if (throttleTimeout) {
      clearTimeout(throttleTimeout);
    }
    
    throttleTimeout = setTimeout(() => {
      isProcessing = true;
      
      try {
        // Find all graphics layers with labels
        view.map.layers.forEach(layer => {
          if (layer.type !== "graphics" || !layer.graphics) return;
          
          // Skip layers without label tracking
          if (!layer.labelVisibilityTracking) return;
          
          // Only process visible labels
          const labelGraphics = layer.graphics.filter(g => 
            g.attributes?.isLabel === true && 
            g.visible !== false && 
            layer.labelVisibilityTracking.currentlyVisible
          );
          
          if (labelGraphics.length === 0) return;
          
          // Group labels by their parent point
          const labelsByParent = {};
          labelGraphics.forEach(label => {
            const parentId = label.attributes.parentID;
            if (parentId !== undefined) {
              if (!labelsByParent[parentId]) {
                labelsByParent[parentId] = [];
              }
              labelsByParent[parentId].push(label);
            }
          });
          
          // TODO: Implement advanced collision detection using view.toScreen()
          // For now, we'll just ensure basic visibility based on zoom level
        });
      } catch (error) {
        console.error("[DynamicLabelManagement] Error updating label positions:", error);
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
    
    // Clear array
    viewHandles.length = 0;
  };
}