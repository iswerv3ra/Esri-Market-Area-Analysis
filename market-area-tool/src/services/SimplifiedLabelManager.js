// src/services/SimplifiedLabelManager.js
import Graphic from "@arcgis/core/Graphic";
import TextSymbol from "@arcgis/core/symbols/TextSymbol";
import Color from "@arcgis/core/Color";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";

/**
 * Simplified LabelManager to provide centralized label handling
 * - Manages creation, editing, and persistence of labels
 * - Single source of truth for label positions
 * - Unified storage mechanism
 */
class LabelManager {
  constructor(view) {
    this.view = view;
    this.editMode = false;
    this.selectedLabel = null;
    this.isMoving = false;
    this.editedLabels = new Map();
    this.projectId = null;
    this.mapConfigId = null;
    this.handlers = [];
    this.dragInfo = { startPoint: null, labelOffset: null };
    this.labelLayer = null;
    this.storageKey = 'customLabelPositions';
    this.autoSaveInterval = null;
    
    // Direct drag handling state
    this.isDragging = false;
    this.dragStartPoint = null;
    this.draggedLabel = null;
    this.originalOffset = null;
    
    // Default settings
    this.settings = {
      fontSize: 10,
      fontFamily: "sans-serif",
      haloSize: 2,
      haloColor: [255, 255, 255, 0.9],
      color: [0, 0, 0, 0.95],
      avoidCollisions: true,
      minZoom: 8,
      autoSaveIntervalMs: 30000, // 30 seconds
    };
    
    this._initialize();
  }

  /**
   * Initialize the label manager
   * @private
   */
  _initialize() {
    // Create a dedicated graphics layer for labels if needed
    if (!this.labelLayer && this.view?.map) {
      this.labelLayer = new GraphicsLayer({
        id: "label-graphics-layer",
        title: "Map Labels",
        listMode: "hide",
      });
      this.view.map.add(this.labelLayer);
      console.log("[LabelManager] Created dedicated label layer");
    }
    
    // Set up auto-save interval
    this._setupAutoSave();
    
    // Load project info from storage
    this.projectId = localStorage.getItem("currentProjectId") || 
                    sessionStorage.getItem("currentProjectId");
    this.mapConfigId = sessionStorage.getItem("currentMapConfigId");
    
    // Load saved positions
    if (this.projectId) {
      this.loadPositions();
    }
    
    console.log("[LabelManager] Initialized");
  }
  
  /**
   * Set up auto-save interval
   * @private
   */
  _setupAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    this.autoSaveInterval = setInterval(() => {
      if (this.editedLabels.size > 0) {
        this.savePositions();
      }
    }, this.settings.autoSaveIntervalMs);
    
    console.log(`[LabelManager] Auto-save enabled (${this.settings.autoSaveIntervalMs}ms)`);
  }
  
  /**
   * Set project context
   * @param {string} projectId - Project ID
   * @param {string} mapConfigId - Map configuration ID
   */
  setContext(projectId, mapConfigId) {
    this.projectId = projectId;
    this.mapConfigId = mapConfigId;
    console.log(`[LabelManager] Context set: Project=${projectId}, Config=${mapConfigId}`);
    
    // Reload positions with the new context
    this.loadPositions();
  }
  
  /**
   * Get a unique AND STABLE ID for a label based on its data attributes.
   * This ID should NOT change if the layer or graphic object is recreated.
   * @param {Object} label - The label graphic
   * @returns {string|null} A stable unique ID, or null if no suitable attributes found.
   */
  getLabelId(label) {
    // We absolutely need the graphic and its attributes
    if (!label?.attributes) {
      console.warn("[LabelManager] getLabelId: Label graphic or attributes missing.");
      return null;
    }

    const attributes = label.attributes;

    // --- Prioritize Stable, Unique Data Attributes ---

    // 1. Use 'OBJECTID' if it exists (very common and usually stable)
    //    Make sure it's not undefined or null. Check for 0 explicitly if needed.
    if (attributes.OBJECTID !== undefined && attributes.OBJECTID !== null) {
      // Prefix to avoid collision with other potential ID types
      return `oid-${attributes.OBJECTID}`;
    }

    // 2. Use 'parentID' if labels are explicitly linked to a parent graphic ID
    if (attributes.parentID) {
      return `parent-${attributes.parentID}`;
    }

    // 3. Use an explicit 'labelId' or 'id' field *you* might have added to attributes
    if (attributes.labelId) {
      return `labelId-${attributes.labelId}`;
    }
    // Check 'id' but ensure it's not the geometry object sometimes assigned there
    if (attributes.id && typeof attributes.id !== 'object') {
      return `id-${attributes.id}`;
    }

    // 4. Use a specific unique field from your *source* data (e.g., a unique name, code)
    const uniqueDataField = 'MapLabel'; // Or maybe another unique field? Check createCompLayer's source data
    if (attributes[uniqueDataField]) {
       // Prefix with the field name for clarity
       return `data-${uniqueDataField}-${attributes[uniqueDataField]}`;
    }

    // --- Less Ideal Fallbacks (Use with caution) ---

    // 5. Use geometry *only* as a last resort if no other unique ID is available.
    //    This is less stable due to potential floating-point variations.
    if (label.geometry?.type === 'point') {
      const point = label.geometry;
      // Round coordinates to minimize precision issues
      const x = point.x.toFixed(4);
      const y = point.y.toFixed(4);
      // Include text if available to make it more unique
      const textPart = attributes.text || label.symbol?.text || 'no-text';
      return `geom-${x}-${y}-${textPart}`;
    }

    // --- If absolutely nothing else works ---
    console.error("[LabelManager] Failed to generate a stable ID for label. Attributes:", attributes, "Geometry:", label.geometry);
    // Returning null is better than returning a random ID that breaks persistence
    return null;
  }
  
  /**
   * Process a layer to find and track all labels within it
   * @param {Object} layer - The layer to process
   * @returns {Array} Array of label IDs found
   */
  processLayer(layer) {
    if (!layer || !layer.graphics) return [];
    
    console.log(`[LabelManager] Processing layer: ${layer.title || layer.id}`);
    
    // Get label options if they exist on the layer's configuration
    const labelOptions = layer.labelConfiguration?.labelOptions || layer.layerConfiguration?.labelOptions || {};
    
    // Track labels found in this layer
    const labelsFound = [];
    
    // Process all graphics in the layer
    layer.graphics.forEach(graphic => {
        // Check if this is a label
        const isLabel = graphic.symbol?.type === "text" || 
                    graphic.attributes?.isLabel === true;
        
        if (isLabel) {
            // Generate a stable ID for this label
            const labelId = this.getLabelId(graphic);
            
            if (!labelId) return; // Skip if no stable ID can be generated
            
            // CRITICAL: Check for saved styles BEFORE applying options
            const savedPositions = this._getSavedPositions();
            const hasSavedStyle = savedPositions[labelId] !== undefined;
            
            // CRITICAL: Only apply basic styles if no saved styles exist
            if (!hasSavedStyle) {
                // Apply label style options before storing
                if (graphic.symbol) {
                    // Apply bold option
                    if (labelOptions.bold === true && graphic.symbol.font) {
                        graphic.symbol.font.weight = 'bold';
                    }
                    
                    // Apply white background option - USING RECTANGULAR BACKGROUND INSTEAD OF HALO
                    if (labelOptions.whiteBackground === true) {
                        // Create a rectangular background behind text
                        graphic.symbol.backgroundColor = [255, 255, 255, 0.9]; // White with 90% opacity
                        // Add some padding around the text
                        graphic.symbol.kerning = true;
                        graphic.symbol.horizontalAlignment = "center";
                        // Optional: Add slight border for definition
                        graphic.symbol.borderLineColor = [220, 220, 220, 0.5]; // Light gray border
                        graphic.symbol.borderLineSize = 0.5;
                        // Remove any existing halo effect
                        graphic.symbol.haloSize = 0;
                        graphic.symbol.haloColor = null;
                    } else if (labelOptions.whiteBackground === false) {
                        // Remove background
                        graphic.symbol.backgroundColor = null;
                        graphic.symbol.borderLineColor = null;
                        graphic.symbol.borderLineSize = 0;
                    }
                }
            }
            
            // Store in our tracking map
            this.editedLabels.set(labelId, {
                graphic: graphic,
                position: {
                    x: graphic.symbol?.xoffset || 0,
                    y: graphic.symbol?.yoffset || 0
                },
                fontSize: graphic.symbol?.font?.size || this.settings.fontSize,
                text: graphic.symbol?.text || graphic.attributes?.text || "",
                fontWeight: graphic.symbol?.font?.weight || "normal",
                backgroundColor: graphic.symbol?.backgroundColor || null,
                borderLineColor: graphic.symbol?.borderLineColor || null,
                borderLineSize: graphic.symbol?.borderLineSize || 0
            });
            
            labelsFound.push(labelId);
            
            // CRITICAL: Apply any saved position with forced reapplication
            if (hasSavedStyle) {
                this._applySavedPosition(graphic);
            }
        }
    });
    
    console.log(`[LabelManager] Found ${labelsFound.length} labels in layer`);
    
    // Mark layer as processed
    layer._labelManagerProcessed = true;
    
    return labelsFound;
  }
    
  /**
   * Applies saved position and styling to a label
   * @param {Object} label - The label graphic
   * @returns {boolean} Whether position was applied successfully
   * @private
   */
  _applySavedPosition(label) {
    if (!label || !label.symbol) return false;

    try {
        const labelId = this.getLabelId(label);
        if (!labelId) return false;
    
        const savedPositions = this._getSavedPositions();
    
        if (savedPositions[labelId]) {
            console.log(`[LabelManager] Found saved data for label ${labelId}:`, 
                        JSON.stringify({
                            fontSize: savedPositions[labelId].fontSize,
                            fontWeight: savedPositions[labelId].fontWeight,
                            hasBackground: !!savedPositions[labelId].backgroundColor
                        }));
                        
            const savedData = savedPositions[labelId];
            const newSymbol = label.symbol.clone(); // Start with current symbol properties
    
            // Apply position if available
            if (savedData.position) {
                newSymbol.xoffset = savedData.position.x;
                newSymbol.yoffset = savedData.position.y;
            }
    
            // CRITICAL IMPROVEMENT: Create font object if missing
            if (!newSymbol.font) {
                newSymbol.font = { 
                    family: this.settings.fontFamily,
                    size: this.settings.fontSize,
                    weight: "normal"
                };
            }
            
            // CRITICAL: Apply saved fontSize correctly 
            if (savedData.fontSize !== undefined) {
                newSymbol.font.size = savedData.fontSize;
                console.log(`[LabelManager] Applied saved fontSize ${savedData.fontSize} to label ${labelId}`);
            }
            
            // CRITICAL: Apply font weight ALWAYS if available in saved data
            if (savedData.fontWeight) {
                newSymbol.font.weight = savedData.fontWeight;
                console.log(`[LabelManager] Applied saved fontWeight ${savedData.fontWeight} to label ${labelId}`);
            }
            
            // CRITICAL: Apply background ALWAYS if available in saved data
            if (savedData.backgroundColor) {
                newSymbol.backgroundColor = savedData.backgroundColor;
                newSymbol.borderLineColor = savedData.borderLineColor || null;
                newSymbol.borderLineSize = savedData.borderLineSize || 0;
                newSymbol.kerning = true;
                newSymbol.horizontalAlignment = "center";
                
                // Remove any halo effect when background is applied
                newSymbol.haloSize = 0;
                newSymbol.haloColor = null;
                
                console.log(`[LabelManager] Applied background to label ${labelId}`);
            }
            
            // CRITICAL: Mark label with persistent style flags to prevent overrides
            if (label.attributes) {
                label.attributes._persistentStyle = true;
                label.attributes._fontSize = savedData.fontSize;
                label.attributes._fontWeight = savedData.fontWeight;
                label.attributes._hasBackground = !!savedData.backgroundColor;
            }
    
            // Apply the updated symbol to the label
            label.symbol = newSymbol;
    
            // Update tracking map with ALL properties explicitly
            this.editedLabels.set(labelId, {
                graphic: label,
                position: {
                    x: newSymbol.xoffset || 0,
                    y: newSymbol.yoffset || 0
                },
                fontSize: savedData.fontSize || newSymbol.font?.size || this.settings.fontSize,
                text: newSymbol.text || label.attributes?.text || "", 
                fontWeight: savedData.fontWeight || newSymbol.font?.weight || "normal",
                backgroundColor: savedData.backgroundColor || null,
                borderLineColor: savedData.borderLineColor || null,
                borderLineSize: savedData.borderLineSize || 0,
                // Add style flags for persistence
                _persistentStyle: true,
            });
    
            // Ensure label visibility is applied
            label.visible = savedData.visible !== false;
    
            console.log(`[LabelManager] Successfully applied saved style to label ${labelId}`);
            return true;
        } else {
            // If no saved position, still ensure it's tracked with current info
            if (!this.editedLabels.has(labelId)) {
                this.editedLabels.set(labelId, {
                    graphic: label,
                    position: {
                        x: label.symbol?.xoffset || 0,
                        y: label.symbol?.yoffset || 0
                    },
                    fontSize: label.symbol?.font?.size || this.settings.fontSize,
                    text: label.symbol?.text || label.attributes?.text || "",
                    fontWeight: label.symbol?.font?.weight || "normal",
                    backgroundColor: label.symbol?.backgroundColor || null,
                    borderLineColor: label.symbol?.borderLineColor || null,
                    borderLineSize: label.symbol?.borderLineSize || 0
                });
            }
            return false;
        }
    } catch (error) {
        console.error(`[LabelManager] Error applying saved position to ${label?.attributes?.labelId || 'unknown label'}:`, error);
        return false;
    }
  }
  
  /**
   * Get all saved positions from storage
   * @returns {Object} Map of saved positions by label ID
   * @private
   */
  _getSavedPositions() {
    try {
      const savedData = localStorage.getItem(this.storageKey);
      return savedData ? JSON.parse(savedData) : {};
    } catch (error) {
      console.error('[LabelManager] Error reading saved positions:', error);
      return {};
    }
  }
  
  /**
   * Enables or disables direct drag mode for labels
   * @param {boolean} enable - Whether to enable direct dragging
   */
  enableDirectDragMode(enable = true) {
    // Clean up any existing handlers first
    this._cleanupEventHandlers();
    
    if (enable && this.view) {
      console.log("[LabelManager] Enabling direct drag mode");
      
      // Flag for tracking
      this.isDragging = false;
      this.dragStartPoint = null;
      this.draggedLabel = null;
      this.originalOffset = null;
      
      // Disable map navigation to prevent conflicts
      if (this.view.navigation) {
        this.view.navigation.browserTouchPanEnabled = false;
      }
      
      // Events for direct drag interaction
      // 1. Mouse down - start drag if on a label
      const pointerDownHandler = this.view.on('pointer-down', (event) => {
        if (this.isDragging) return;
        
        // Skip if not left mouse button
        if (event.button !== 0) return;
        
        // We need to make sure event has the screenPoint property
        if (!event || !event.screenPoint) {
          console.warn("[LabelManager] Invalid event in pointer-down");
          return;
        }
        
        try {
          // Perform hit test to find clicked label
          this.view.hitTest(event.screenPoint)
            .then(response => {
              if (!response || !response.results) return;
              
              const results = response.results || [];
              const labelHit = results.find(result => 
                result.graphic && (
                  result.graphic.symbol?.type === "text" || 
                  result.graphic.attributes?.isLabel === true
                )
              );
              
              if (labelHit && labelHit.graphic) {
                // Found a label - start drag operation
                event.stopPropagation();
                
                // Store references
                this.draggedLabel = labelHit.graphic;
                this.dragStartPoint = { x: event.x, y: event.y };
                this.originalOffset = { 
                  x: this.draggedLabel.symbol?.xoffset || 0, 
                  y: this.draggedLabel.symbol?.yoffset || 0 
                };
                this.isDragging = true;
                
                // Update cursor
                if (this.view.container) {
                  this.view.container.style.cursor = 'grabbing';
                }
                
                // Select the label in manager
                this.selectedLabel = this.draggedLabel;
                
                console.log("[LabelManager] Started dragging label:", this.getLabelId(this.draggedLabel));
              }
            })
            .catch(err => {
              console.warn("[LabelManager] Error in hit test:", err);
            });
        } catch (err) {
          console.error("[LabelManager] Error in pointer-down:", err);
        }
      });
      this.handlers.push(pointerDownHandler);
      
      // 2. Mouse move - update label position during drag
      const pointerMoveHandler = this.view.on('pointer-move', (event) => {
        // Check if we're in a valid drag state
        if (!this.isDragging || !this.draggedLabel || !this.dragStartPoint || !this.originalOffset) {
          return;
        }
        
        try {
          event.stopPropagation();
          
          // Calculate position delta
          const dx = event.x - this.dragStartPoint.x;
          const dy = event.y - this.dragStartPoint.y;
          
          const newOffset = {
            x: this.originalOffset.x + dx,
            y: this.originalOffset.y - dy // Invert Y axis
          };
          
          // Update the label's symbol
          if (this.draggedLabel.symbol) {
            const newSymbol = this.draggedLabel.symbol.clone();
            newSymbol.xoffset = newOffset.x;
            newSymbol.yoffset = newOffset.y;
            this.draggedLabel.symbol = newSymbol;
            
            // Update tracking info
            const labelId = this.getLabelId(this.draggedLabel);
            if (labelId && this.editedLabels) {
              const existingData = this.editedLabels.get(labelId) || {};
              this.editedLabels.set(labelId, {
                ...existingData,
                graphic: this.draggedLabel,
                position: newOffset
              });
            }
          }
        } catch (err) {
          console.error("[LabelManager] Error during drag:", err);
        }
      });
      this.handlers.push(pointerMoveHandler);
      
      // 3. Mouse up - end drag operation
      const pointerUpHandler = this.view.on('pointer-up', (event) => {
        if (!this.isDragging) return;
        
        try {
          event.stopPropagation();
          
          // Restore cursor
          if (this.view.container) {
            this.view.container.style.cursor = 'move';
          }
          
          // Auto-save position changes
          if (this.isDragging && this.draggedLabel) {
            // Save position
            this.savePositions(true);
            console.log("[LabelManager] Saved label position after drag");
          }
        } catch (err) {
          console.error("[LabelManager] Error ending drag:", err);
        } finally {
          // Reset drag state
          this.isDragging = false;
          this.draggedLabel = null;
          this.dragStartPoint = null;
          this.originalOffset = null;
        }
      });
      this.handlers.push(pointerUpHandler);
      
      // 4. Mouse leave - cancel drag
      const pointerLeaveHandler = this.view.on('pointer-leave', () => {
        if (!this.isDragging) return;
        
        try {
          // Restore cursor
          if (this.view.container) {
            this.view.container.style.cursor = 'move';
          }
          
          // Save any changes made before leaving
          if (this.draggedLabel) {
            this.savePositions(true);
          }
        } catch (err) {
          console.error("[LabelManager] Error handling pointer leave:", err);
        } finally {
          // Reset drag state
          this.isDragging = false;
          this.draggedLabel = null;
          this.dragStartPoint = null;
          this.originalOffset = null;
        }
      });
      this.handlers.push(pointerLeaveHandler);
      
      console.log(`[LabelManager] Direct drag mode enabled with ${this.handlers.length} handlers`);
    } else {
      // Restore navigation
      if (this.view?.navigation) {
        this.view.navigation.browserTouchPanEnabled = true;
      }
      
      this.isDragging = false;
      this.draggedLabel = null;
      this.dragStartPoint = null;
      this.originalOffset = null;
      
      console.log("[LabelManager] Direct drag mode disabled");
    }
  }
  


  savePositions(force = false) {
    if (this.editedLabels.size === 0 && !force) {
        return { success: true, message: "No changes to save", count: 0 };
    }
    
    try {
        // Get existing saved positions
        const savedPositions = this._getSavedPositions();
        
        // Update with current edited labels
        let updatedCount = 0;
        
        this.editedLabels.forEach((labelData, labelId) => {
            // CRITICAL CHANGE: Prioritize direct fontSize property
            let fontSize = null;
            
            // First check for direct fontSize property in labelData
            if (labelData.fontSize !== undefined && labelData.fontSize !== null) {
                fontSize = labelData.fontSize;
            } 
            // Next try to get from the symbol's font
            else if (labelData.graphic?.symbol?.font?.size !== undefined) {
                fontSize = labelData.graphic.symbol.font.size;
            }
            // Fallback to default
            else {
                fontSize = this.settings.fontSize;
            }
            
            // Get font weight - prioritize direct property
            let fontWeight = "normal";
            if (labelData.fontWeight) {
                fontWeight = labelData.fontWeight;
            } 
            else if (labelData.graphic?.symbol?.font?.weight) {
                fontWeight = labelData.graphic.symbol.font.weight;
            }
            
            // Get background and border settings
            let backgroundColor = null;
            let borderLineColor = null;
            let borderLineSize = 0;
            
            // Extract from explicit properties if available
            if (labelData.backgroundColor !== undefined) {
                backgroundColor = labelData.backgroundColor;
            }
            else if (labelData.graphic?.symbol?.backgroundColor) {
                backgroundColor = labelData.graphic.symbol.backgroundColor;
            }
            
            if (labelData.borderLineColor !== undefined) {
                borderLineColor = labelData.borderLineColor;
            }
            else if (labelData.graphic?.symbol?.borderLineColor) {
                borderLineColor = labelData.graphic.symbol.borderLineColor;
            }
            
            if (labelData.borderLineSize !== undefined) {
                borderLineSize = labelData.borderLineSize;
            }
            else if (labelData.graphic?.symbol?.borderLineSize) {
                borderLineSize = labelData.graphic.symbol.borderLineSize;
            }
            
            // CRITICAL: Store ALL properties explicitly to ensure persistence
            savedPositions[labelId] = {
                position: labelData.position,
                fontSize: fontSize,
                text: labelData.text,
                visible: labelData.graphic?.visible !== false,
                fontWeight: fontWeight,
                backgroundColor: backgroundColor,
                borderLineColor: borderLineColor,
                borderLineSize: borderLineSize,
                lastEdited: Date.now(),
                // Store additional symbol properties for complete persistence
                symbolProperties: {
                    haloSize: labelData.graphic?.symbol?.haloSize,
                    haloColor: labelData.graphic?.symbol?.haloColor,
                    kerning: labelData.graphic?.symbol?.kerning,
                    horizontalAlignment: labelData.graphic?.symbol?.horizontalAlignment
                }
            };
            
            console.log(`[LabelManager SAVE] Label ${labelId}: fontSize=${fontSize}, weight=${fontWeight}, hasBackground=${!!backgroundColor}`);
            updatedCount++;
        });
        
        // CRITICAL: Force immediate storage - make sure it's committed
        localStorage.setItem(this.storageKey, JSON.stringify(savedPositions));
        
        console.log(`[LabelManager] Saved ${updatedCount} label positions and styles`);
        
        return {
            success: true,
            message: `Saved ${updatedCount} label positions and styles`,
            count: updatedCount
        };
    } catch (error) {
        console.error('[LabelManager] Error saving positions:', error);
        return {
            success: false,
            message: `Error saving positions: ${error.message}`,
            count: 0
        };
    }
}
  
  /**
   * Load positions from storage
   * @param {boolean} force - Whether to force reload
   * @param {boolean} preserveEdits - Whether to preserve current edits
   * @returns {Object} Result of the load operation
   */
  loadPositions(force = false, preserveEdits = true) {
    try {
      // Get saved positions
      const savedPositions = this._getSavedPositions();
      const positionCount = Object.keys(savedPositions).length;
      
      if (positionCount === 0) {
        console.log('[LabelManager] No saved positions found');
        return { success: true, message: "No saved positions found", count: 0 };
      }
      
      console.log(`[LabelManager] Found ${positionCount} saved positions`);
      
      // Apply to tracked labels and visible layers
      let appliedCount = 0;
      
      // First apply to all tracked labels
      this.editedLabels.forEach((labelData, labelId) => {
        if (savedPositions[labelId] && labelData.graphic) {
          try {
            const savedData = savedPositions[labelId];
            const graphic = labelData.graphic;
            
            // Skip if graphic is no longer valid
            if (!graphic.symbol) return;
            
            // Create new symbol with saved properties
            const newSymbol = graphic.symbol.clone();
            
            // Apply position
            if (savedData.position) {
              newSymbol.xoffset = savedData.position.x;
              newSymbol.yoffset = savedData.position.y;
            }
            
            // Apply font size
            if (savedData.fontSize && newSymbol.font) {
              newSymbol.font = {
                ...newSymbol.font,
                size: savedData.fontSize
              };
            }
            
            // Apply font weight (bold) if present
            if (savedData.fontWeight && newSymbol.font) {
              newSymbol.font = {
                ...newSymbol.font,
                weight: savedData.fontWeight
              };
            }
            
            // Apply background (halo) if present
            if (savedData.haloSize !== undefined) {
              newSymbol.haloSize = savedData.haloSize;
              if (savedData.haloColor) {
                newSymbol.haloColor = savedData.haloColor;
              }
            }
            
            // Apply text if different
            if (savedData.text && savedData.text !== newSymbol.text) {
              newSymbol.text = savedData.text;
            }
            
            // Apply the updated symbol
            graphic.symbol = newSymbol;
            
            // Update visibility
            graphic.visible = savedData.visible !== false;
            
            // Update tracking info
            this.editedLabels.set(labelId, {
              graphic: graphic,
              position: {
                x: newSymbol.xoffset || 0,
                y: newSymbol.yoffset || 0
              },
              fontSize: newSymbol.font?.size || this.settings.fontSize,
              text: newSymbol.text || "",
              fontWeight: newSymbol.font?.weight || "normal",
              haloSize: newSymbol.haloSize,
              haloColor: newSymbol.haloColor
            });
            
            appliedCount++;
          } catch (error) {
            console.error(`[LabelManager] Error applying position to ${labelId}:`, error);
          }
        }
      });
      
      // Then scan visible layers for labels we might not be tracking yet
      if (this.view?.map?.layers) {
        this.view.map.layers.forEach(layer => {
          // Skip if not a graphics layer or already processed
          if (!layer.graphics || layer._allLabelsApplied) return;
          
          let layerAppliedCount = 0;
          
          // Check each graphic
          layer.graphics.forEach(graphic => {
            // Skip if not a label
            const isLabel = graphic.symbol?.type === "text" || 
                           graphic.attributes?.isLabel === true;
            if (!isLabel) return;
            
            const labelId = this.getLabelId(graphic);
            if (!labelId) return; // Skip if no ID can be generated
            
            // Skip if we've already processed this label
            if (this.editedLabels.has(labelId)) return;
            
            // Check if we have a saved position
            if (savedPositions[labelId]) {
              try {
                const savedData = savedPositions[labelId];
                
                // Skip if graphic is no longer valid
                if (!graphic.symbol) return;
                
                // Create new symbol with saved properties
                const newSymbol = graphic.symbol.clone();
                
                // Apply position
                if (savedData.position) {
                  newSymbol.xoffset = savedData.position.x;
                  newSymbol.yoffset = savedData.position.y;
                }
                
                // Apply font size
                if (savedData.fontSize && newSymbol.font) {
                  newSymbol.font = {
                    ...newSymbol.font,
                    size: savedData.fontSize
                  };
                }
                
                // Apply font weight (bold) if present
                if (savedData.fontWeight && newSymbol.font) {
                  newSymbol.font = {
                    ...newSymbol.font,
                    weight: savedData.fontWeight
                  };
                }
                
                // Apply background (halo) if present
                if (savedData.haloSize !== undefined) {
                  newSymbol.haloSize = savedData.haloSize;
                  if (savedData.haloColor) {
                    newSymbol.haloColor = savedData.haloColor;
                  }
                }
                
                // Apply text if different
                if (savedData.text && savedData.text !== newSymbol.text) {
                  newSymbol.text = savedData.text;
                }
                
                // Apply the updated symbol
                graphic.symbol = newSymbol;
                
                // Update visibility
                graphic.visible = savedData.visible !== false;
                
                // Start tracking this label
                this.editedLabels.set(labelId, {
                  graphic: graphic,
                  position: {
                    x: newSymbol.xoffset || 0,
                    y: newSymbol.yoffset || 0
                  },
                  fontSize: newSymbol.font?.size || this.settings.fontSize,
                  text: newSymbol.text || "",
                  fontWeight: newSymbol.font?.weight || "normal",
                  haloSize: newSymbol.haloSize,
                  haloColor: newSymbol.haloColor
                });
                
                layerAppliedCount++;
                appliedCount++;
              } catch (error) {
                console.error(`[LabelManager] Error applying position to new label ${labelId}:`, error);
              }
            }
          });
          
          if (layerAppliedCount > 0) {
            console.log(`[LabelManager] Applied ${layerAppliedCount} saved positions to layer ${layer.id}`);
          }
          
          // Mark layer as fully processed
          layer._allLabelsApplied = true;
        });
      }
      
      console.log(`[LabelManager] Applied ${appliedCount} saved positions and styles`);
      
      return {
        success: true,
        message: `Applied ${appliedCount} saved positions and styles`,
        count: appliedCount
      };
    } catch (error) {
      console.error('[LabelManager] Error loading positions:', error);
      return {
        success: false,
        message: `Error loading positions: ${error.message}`,
        count: 0
      };
    }
  }

  /**
   * Reset all label positions
   * @returns {Object} Result of the reset operation
   */
  resetAllLabels() {
    try {
      // Remove saved positions from storage
      localStorage.removeItem(this.storageKey);
      
      let resetCount = 0;
      
      // Reset all tracked labels
      this.editedLabels.forEach((labelData, labelId) => {
        const graphic = labelData.graphic;
        
        // Skip if graphic is no longer valid
        if (!graphic || !graphic.symbol) return;
        
        // Create new symbol with reset position
        const newSymbol = graphic.symbol.clone();
        
        // Reset position
        newSymbol.xoffset = 0;
        newSymbol.yoffset = 0;
        
        // Reset to default font size
        if (newSymbol.font) {
          newSymbol.font = {
            ...newSymbol.font,
            size: this.settings.fontSize
          };
        }
        
        // Apply the updated symbol
        graphic.symbol = newSymbol;
        
        // Ensure visible
        graphic.visible = true;
        
        resetCount++;
      });
      
      // Clear tracking
      this.editedLabels.clear();
      
      console.log(`[LabelManager] Reset ${resetCount} label positions`);
      
      return {
        success: true,
        message: `Reset ${resetCount} label positions`,
        count: resetCount
      };
    } catch (error) {
      console.error('[LabelManager] Error resetting positions:', error);
      return {
        success: false,
        message: `Error resetting positions: ${error.message}`,
        count: 0
      };
    }
  }
  
  /**
   * Reset a single label position
   * @param {string|Object} labelOrId - Label ID or label graphic
   * @returns {Object} Result of the reset operation
   */
  resetLabelPosition(labelOrId) {
    try {
      const labelId = typeof labelOrId === 'string' ? labelOrId : this.getLabelId(labelOrId);
      if (!labelId) {
        return { success: false, message: "Invalid label ID" };
      }
      
      // Get the label graphic
      const labelData = this.editedLabels.get(labelId);
      if (!labelData || !labelData.graphic || !labelData.graphic.symbol) {
        return { success: false, message: "Label not found or invalid" };
      }
      
      // Create new symbol with reset position
      const newSymbol = labelData.graphic.symbol.clone();
      
      // Reset position
      newSymbol.xoffset = 0;
      newSymbol.yoffset = 0;
      
      // Reset to default font size
      if (newSymbol.font) {
        newSymbol.font = {
          ...newSymbol.font,
          size: this.settings.fontSize
        };
      }
      
      // Apply the updated symbol
      labelData.graphic.symbol = newSymbol;
      
      // Ensure visible
      labelData.graphic.visible = true;
      
      // Update tracking
      this.editedLabels.set(labelId, {
        graphic: labelData.graphic,
        position: { x: 0, y: 0 },
        fontSize: this.settings.fontSize,
        text: labelData.graphic.symbol.text || "",
      });
      
      // Remove from saved positions
      const savedPositions = this._getSavedPositions();
      if (savedPositions[labelId]) {
        delete savedPositions[labelId];
        localStorage.setItem(this.storageKey, JSON.stringify(savedPositions));
      }
      
      console.log(`[LabelManager] Reset label position for ${labelId}`);
      
      return {
        success: true,
        message: `Reset label position for ${labelId}`,
        graphic: labelData.graphic // Return the reset graphic
      };
    } catch (error) {
      console.error('[LabelManager] Error resetting label position:', error);
      return {
        success: false,
        message: `Error resetting label position: ${error.message}`,
      };
    }
  }
  
  /**
   * Update a label's position
   * @param {string|Object} labelOrId - Label ID or label graphic
   * @param {Object} position - New position {x, y}
   * @returns {Object} Result of the update operation
   */
  updateLabelPosition(labelOrId, position) {
    try {
      const labelId = typeof labelOrId === 'string' ? labelOrId : this.getLabelId(labelOrId);
      if (!labelId) {
        return { success: false, message: "Invalid label ID" };
      }
      
      // Get the label graphic
      const labelData = this.editedLabels.get(labelId);
      if (!labelData || !labelData.graphic || !labelData.graphic.symbol) {
        return { success: false, message: "Label not found or invalid" };
      }
      
      // Create new symbol with updated position
      const newSymbol = labelData.graphic.symbol.clone();
      newSymbol.xoffset = position.x;
      newSymbol.yoffset = position.y;
      
      // Apply the updated symbol
      labelData.graphic.symbol = newSymbol;
      
      // Update tracking
      this.editedLabels.set(labelId, {
        ...labelData,
        position: { x: position.x, y: position.y },
      });
      
      console.log(`[LabelManager] Updated label position for ${labelId}`);
      
      return {
        success: true,
        message: `Updated label position for ${labelId}`,
      };
    } catch (error) {
      console.error('[LabelManager] Error updating label position:', error);
      return {
        success: false,
        message: `Error updating label position: ${error.message}`,
      };
    }
  }
  
  // ENHANCED: updateLabelFontSize method with immediate save trigger
  updateLabelFontSize(labelOrId, fontSize) {
    try {
        const labelId = typeof labelOrId === 'string' ? labelOrId : this.getLabelId(labelOrId);
        if (!labelId) {
            return { success: false, message: "Invalid label ID" };
        }
        
        // Get the label graphic
        const labelData = this.editedLabels.get(labelId);
        if (!labelData || !labelData.graphic || !labelData.graphic.symbol) {
            return { success: false, message: "Label not found or invalid" };
        }
        
        // Create new symbol with updated font size
        const newSymbol = labelData.graphic.symbol.clone();
        
        if (newSymbol.font) {
            newSymbol.font = {
                ...newSymbol.font,
                size: fontSize
            };
        } else {
            newSymbol.font = {
                family: this.settings.fontFamily,
                size: fontSize
            };
        }
        
        // Apply the updated symbol
        labelData.graphic.symbol = newSymbol;
        
        // CRITICAL: Update tracking with EXPLICIT fontSize property
        this.editedLabels.set(labelId, {
            ...labelData,
            fontSize: fontSize, // Store fontSize DIRECTLY in the data object
        });
        
        console.log(`[LabelManager] Updated font size for ${labelId} to ${fontSize}`);
        
        // IMPORTANT: Trigger an immediate save to ensure persistence
        this.savePositions(true);
        
        return {
            success: true,
            message: `Updated font size for ${labelId}`,
        };
    } catch (error) {
        console.error('[LabelManager] Error updating font size:', error);
        return {
            success: false,
            message: `Error updating font size: ${error.message}`,
        };
    }
  }
  
  /**
   * Update a label's text while preserving variable text formatting
   * @param {string|Object} labelOrId - Label ID or label graphic
   * @param {string} text - New text
   * @returns {Object} Result of the update operation
   */
  updateLabelText(labelOrId, text) {
    try {
      const labelId = typeof labelOrId === 'string' ? labelOrId : this.getLabelId(labelOrId);
      if (!labelId) {
        return { success: false, message: "Invalid label ID" };
      }
      
      // Get the label graphic
      const labelData = this.editedLabels.get(labelId);
      if (!labelData || !labelData.graphic || !labelData.graphic.symbol) {
        return { success: false, message: "Label not found or invalid" };
      }
      
      // Create new symbol with updated text
      const newSymbol = labelData.graphic.symbol.clone();
      
      // Check if we need to preserve variable formatting
      if (labelData.graphic.attributes && 
          labelData.graphic.attributes.hasCustomFormat === true) {
        // Extract the base label and variables
        const originalText = newSymbol.text || '';
        const baseLabel = text;  // New base text
        
        // Try to preserve the variable part if it exists
        const varMatch = originalText.match(/\s*\((.*)\)/);
        if (varMatch && varMatch[1]) {
          newSymbol.text = baseLabel + ' (' + varMatch[1] + ')';
        } else {
          newSymbol.text = text;
        }
      } else {
        // Standard text update
        newSymbol.text = text;
      }
      
      // Apply the updated symbol
      labelData.graphic.symbol = newSymbol;
      
      // Update attributes as well
      if (labelData.graphic.attributes) {
        labelData.graphic.attributes.text = text;
        labelData.graphic.attributes.labelText = newSymbol.text; // Store the formatted version
      }
      
      // Update tracking
      this.editedLabels.set(labelId, {
        ...labelData,
        text: newSymbol.text,
      });
      
      console.log(`[LabelManager] Updated text for ${labelId}`);
      
      return {
        success: true,
        message: `Updated text for ${labelId}`,
      };
    } catch (error) {
      console.error('[LabelManager] Error updating text:', error);
      return {
        success: false,
        message: `Error updating text: ${error.message}`,
      };
    }
  }
  
  /**
   * Toggle edit mode
   * @param {boolean} enableEdit - Whether to enable or disable edit mode
   * @param {boolean} exclusive - Whether to clear selection when disabling (default: true)
   * @returns {boolean} New edit mode state
   */
  toggleEditingMode(enableEdit, exclusive = true) {
    // If explicit state provided, use it, otherwise toggle
    const newEditMode = enableEdit !== undefined ? enableEdit : !this.editMode;
    
    // No change, return current state
    if (newEditMode === this.editMode) {
      return this.editMode;
    }
    
    // Clean up existing handlers
    this._cleanupEventHandlers();
    
    if (newEditMode) {
      // Enable edit mode
      this._enableEditMode();
    } else {
      // Disable edit mode
      this._disableEditMode();
      
      // Only clear selection if exclusive mode is true
      if (exclusive) {
        this.selectedLabel = null;
      }
    }
    
    this.editMode = newEditMode;
    console.log(`[LabelManager] Edit mode ${this.editMode ? 'enabled' : 'disabled'}`);
    
    return this.editMode;
  }
  
  /**
   * Enable edit mode
   * @private
   */
  _enableEditMode() {
    if (!this.view) return;
    
    // Change cursor
    if (this.view.container) {
      this.view.container.style.cursor = 'pointer';
    }
    
    // Add click handler for label selection
    this.handlers.push(
      this.view.on('click', (event) => {
        if (this.isMoving) {
          event.stopPropagation();
          return;
        }
        
        // Perform hit test with proper error handling
        try {
          this.view.hitTest(event.screenPoint).then(response => {
            // Validate response
            if (!response || !response.results) {
              console.warn("[LabelManager] Invalid hit test response");
              return;
            }
            
            // Find label hits
            const labelHits = response.results.filter(result => {
              const graphic = result.graphic;
              return graphic && (
                graphic.symbol?.type === "text" || 
                graphic.attributes?.isLabel === true
              );
            });
            
            if (labelHits && labelHits.length > 0) {
              // Select the first hit label
              event.stopPropagation();
              this.selectLabel(labelHits[0].graphic);
            } else {
              // Deselect if clicking outside
              this.selectedLabel = null;
            }
          }).catch(error => {
            console.error('[LabelManager] Error during hit test:', error);
          });
        } catch (error) {
          console.error('[LabelManager] Error setting up hit test:', error);
        }
      })
    );
  }
  
  /**
   * Disable edit mode
   * @private
   */
  _disableEditMode() {
    // Reset cursor
    if (this.view?.container) {
      this.view.container.style.cursor = 'default';
    }
    
    // Reset states
    this.isMoving = false;
  }
  
  /**
   * Clean up event handlers
   * @private
   */
  _cleanupEventHandlers() {
    for (const handler of this.handlers) {
      if (handler && typeof handler.remove === 'function') {
        try {
          handler.remove();
        } catch(e) {
          // Ignore errors during cleanup
        }
      }
    }
    this.handlers = [];
  }
  
  /**
   * Select a label for editing
   * @param {Object} labelGraphic - The label graphic to select
   * @returns {Object} The selected label
   */
  selectLabel(labelGraphic) {
    if (!labelGraphic) return null;
    
    // Store the selected label
    this.selectedLabel = labelGraphic;
    
    // Get the label ID
    const labelId = this.getLabelId(labelGraphic);
    
    // Make sure it's in our tracking map
    if (labelId && !this.editedLabels.has(labelId)) {
      this.editedLabels.set(labelId, {
        graphic: labelGraphic,
        position: {
          x: labelGraphic.symbol?.xoffset || 0,
          y: labelGraphic.symbol?.yoffset || 0
        },
        fontSize: labelGraphic.symbol?.font?.size || this.settings.fontSize,
        text: labelGraphic.symbol?.text || "",
      });
    }
    
    console.log(`[LabelManager] Selected label: ${labelId}`);
    
    return labelGraphic;
  }
  
  /**
   * Start moving a label
   * @returns {boolean} Whether moving was successfully started
   */
  startMovingLabel() {
    if (!this.selectedLabel || !this.view) {
      return false;
    }
    
    // Set moving state
    this.isMoving = true;
    
    // Update cursor
    if (this.view.container) {
      this.view.container.style.cursor = 'move';
    }
    
    // Store original navigation state
    this.originalNavState = {
      browserTouchPanEnabled: this.view.navigation.browserTouchPanEnabled,
      mouseWheelZoomEnabled: this.view.navigation.mouseWheelZoomEnabled,
      keyboardNavigation: this.view.navigation.keyboardNavigation,
    };
    
    // Disable map navigation
    this.view.navigation.browserTouchPanEnabled = false;
    this.view.navigation.mouseWheelZoomEnabled = false;
    this.view.navigation.keyboardNavigation = false;
    
    // Add move event handlers
    this.handlers.push(
      this.view.on('pointer-down', (event) => {
        if (!this.isMoving || !this.selectedLabel) {
          return;
        }
        
        // Prevent map interaction
        event.stopPropagation();
        event.preventDefault();
        
        // Store drag start info
        this.dragInfo.startPoint = { x: event.x, y: event.y };
        this.dragInfo.labelOffset = {
          x: this.selectedLabel.symbol?.xoffset || 0,
          y: this.selectedLabel.symbol?.yoffset || 0
        };
      })
    );
    
    this.handlers.push(
      this.view.on('pointer-move', (event) => {
        if (!this.isMoving || !this.selectedLabel || !this.dragInfo.startPoint) {
          return;
        }
        
        // Prevent map interaction
        event.stopPropagation();
        event.preventDefault();
        
        // Calculate new position
        const dx = event.x - this.dragInfo.startPoint.x;
        const dy = event.y - this.dragInfo.startPoint.y;
        
        const newOffset = {
          x: this.dragInfo.labelOffset.x + dx,
          y: this.dragInfo.labelOffset.y - dy // Invert y for correct direction
        };
        
        // Update the label position
        this.updateLabelOffset(newOffset);
      })
    );
    
    this.handlers.push(
      this.view.on('pointer-up', (event) => {
        // Prevent map interaction
        event.stopPropagation();
        event.preventDefault();
        
        this.stopMovingLabel();
      })
    );
    
    this.handlers.push(
      this.view.on('pointer-leave', () => {
        this.stopMovingLabel();
      })
    );
    
    console.log(`[LabelManager] Started moving label`);
    
    return true;
  }
  
  /**
   * Stop moving a label
   */
  stopMovingLabel() {
    if (!this.isMoving) {
      return;
    }
    
    // Reset moving state
    this.isMoving = false;
    
    // Reset cursor
    if (this.view?.container) {
      this.view.container.style.cursor = 'pointer';
    }
    
    // Clear drag info
    this.dragInfo = { startPoint: null, labelOffset: null };
    
    // Restore map navigation
    if (this.view && this.originalNavState) {
      this.view.navigation.browserTouchPanEnabled = this.originalNavState.browserTouchPanEnabled;
      this.view.navigation.mouseWheelZoomEnabled = this.originalNavState.mouseWheelZoomEnabled;
      this.view.navigation.keyboardNavigation = this.originalNavState.keyboardNavigation;
    }
    
    // Clean up event handlers
    this._cleanupEventHandlers();
    
    // Re-enable editing mode handlers
    if (this.editMode) {
      this._enableEditMode();
    }
    
    // Save changes
    this.savePositions();
    
    console.log(`[LabelManager] Stopped moving label`);
  }
  
  /**
   * Update the offset of the selected label
   * @param {Object} offset - New offset {x, y}
   */
  updateLabelOffset(offset) {
    if (!this.selectedLabel || !this.selectedLabel.symbol) {
      return;
    }
    
    try {
      // Create a new symbol with the updated offset
      const newSymbol = this.selectedLabel.symbol.clone();
      newSymbol.xoffset = offset.x;
      newSymbol.yoffset = offset.y;
      
      // Apply the new symbol
      this.selectedLabel.symbol = newSymbol;
      
      // Update tracking
      const labelId = this.getLabelId(this.selectedLabel);
      if (labelId && this.editedLabels.has(labelId)) {
        const labelData = this.editedLabels.get(labelId);
        this.editedLabels.set(labelId, {
          ...labelData,
          position: { x: offset.x, y: offset.y }
        });
      }
    } catch (error) {
      console.error('[LabelManager] Error updating label offset:', error);
    }
  }
  
  /**
   * Refresh all labels to ensure they're properly displayed with correct styles
   * @returns {Object} Result of the refresh operation
   */
  refreshLabels() {
    try {
        // Get all saved positions to ensure we apply latest styles
        const savedPositions = this._getSavedPositions();
        
        // Ensure all tracked labels are visible and have correct styles
        let refreshCount = 0;
        let appliedStylesCount = 0;
        
        // Process each tracked label
        this.editedLabels.forEach((labelData, labelId) => {
            if (labelData.graphic && labelData.graphic.symbol) {
                try {
                    // CRITICAL: ALWAYS reapply saved styles during refresh to prevent style loss
                    if (savedPositions[labelId]) {
                        // Apply saved position and styles
                        const applied = this._applySavedPosition(labelData.graphic);
                        if (applied) {
                            appliedStylesCount++;
                        }
                    } else if (labelData.fontSize || labelData.fontWeight || labelData.backgroundColor) {
                        // If we have styles in tracking but not in localStorage, save them
                        savedPositions[labelId] = {
                            position: labelData.position || { x: 0, y: 0 },
                            fontSize: labelData.fontSize || this.settings.fontSize,
                            fontWeight: labelData.fontWeight || "normal",
                            backgroundColor: labelData.backgroundColor,
                            borderLineColor: labelData.borderLineColor,
                            borderLineSize: labelData.borderLineSize,
                            text: labelData.text || "",
                            visible: labelData.graphic.visible !== false,
                            lastEdited: Date.now()
                        };
                        
                        // Save to localStorage immediately
                        localStorage.setItem(this.storageKey, JSON.stringify(savedPositions));
                        
                        // And apply the styles
                        const applied = this._applySavedPosition(labelData.graphic);
                        if (applied) {
                            appliedStylesCount++;
                        }
                    }
                    
                    // Ensure label is visible based on zoom level
                    labelData.graphic.visible = this.view.zoom >= this.settings.minZoom;
                    refreshCount++;
                } catch (labelError) {
                    console.error(`[LabelManager] Error refreshing label ${labelId}:`, labelError);
                }
            }
        });
        
        // Refresh the label layer if available
        if (this.labelLayer && typeof this.labelLayer.refresh === 'function') {
            this.labelLayer.refresh();
        }
        
        // Also refresh the original layers
        if (this.view?.map?.layers) {
            this.view.map.layers.forEach(layer => {
                if (layer.graphics && typeof layer.refresh === 'function') {
                    try {
                        layer.refresh();
                    } catch (layerError) {
                        console.warn(`[LabelManager] Error refreshing layer ${layer.id}:`, layerError);
                    }
                }
            });
        }
        
        // CRITICAL: Force redraw of map to ensure styles are displayed
        if (this.view && typeof this.view.redraw === 'function') {
            try {
                this.view.redraw();
            } catch (redrawError) {
                console.warn("[LabelManager] Error redrawing view:", redrawError);
            }
        }
        
        console.log(`[LabelManager] Refreshed ${refreshCount} labels, reapplied styles to ${appliedStylesCount}`);
        
        return {
            success: true,
            message: `Refreshed ${refreshCount} labels, reapplied ${appliedStylesCount} styles`,
            count: refreshCount
        };
    } catch (error) {
        console.error('[LabelManager] Error refreshing labels:', error);
        return {
            success: false,
            message: `Error refreshing labels: ${error.message}`,
            count: 0
        };
    }
  }
  
  /**
   * Update manager settings
   * @param {Object} newSettings - New settings
   */
  updateSettings(newSettings) {
    if (!newSettings) return;
    
    // Update settings
    this.settings = {
      ...this.settings,
      ...newSettings
    };
    
    console.log(`[LabelManager] Updated settings:`, newSettings);
    
    // Apply relevant settings to labels
    if (newSettings.fontSize || newSettings.minZoom) {
      this.refreshLabels();
    }
  }
  
  configureLayerSettings(layerType) {
    if (!layerType) return;
    
    // Normalize the type
    const type = layerType.toLowerCase();
    
    // Define settings for different layer types
    const typeSettings = {
      pipe: {
        fontSize: 10,
        haloSize: 2,
        minZoom: 8,
        autoSaveIntervalMs: 30000
      },
      comp: {
        fontSize: 9,
        haloSize: 2.5,
        minZoom: 8,
        autoSaveIntervalMs: 30000
      },
      custom: {
        fontSize: 8,
        haloSize: 2,
        minZoom: 8,
        autoSaveIntervalMs: 30000
      }
    };
    
    // Get settings for this type or use default
    const defaultSettings = typeSettings[type] || typeSettings.custom;
    
    // IMPORTANT: We need to get current saved settings before applying new ones
    // to avoid overwriting user-defined values
    const savedPositions = this._getSavedPositions();
    const hasUserSettings = Object.keys(savedPositions).length > 0;
    
    // Check if we have existing user settings for fontSize
    let userFontSize = null;
    
    if (hasUserSettings) {
      // Try to find a representative label to get its font size
      const firstLabelId = Object.keys(savedPositions)[0];
      if (firstLabelId && savedPositions[firstLabelId] && 
          savedPositions[firstLabelId].fontSize !== undefined) {
        userFontSize = savedPositions[firstLabelId].fontSize;
        console.log(`[LabelManager] Found user-defined fontSize: ${userFontSize}`);
      }
    }
    
    // Create settings object that preserves user fontSize if available
    const mergedSettings = {
      ...defaultSettings,
      // Only use default fontSize if no user setting exists
      fontSize: userFontSize !== null ? userFontSize : defaultSettings.fontSize
    };
    
    // Update settings
    this.updateSettings(mergedSettings);
    
    console.log(`[LabelManager] Configured settings for layer type: ${type}, preserving user fontSize: ${userFontSize !== null}`);
  }
  
  /**
   * Get all label graphics
   * @returns {Array} Array of label graphics
   */
  getAllLabelGraphics() {
    const labels = [];
    
    this.editedLabels.forEach(labelData => {
      if (labelData.graphic) {
        labels.push(labelData.graphic);
      }
    });
    
    return labels;
  }
  
  /**
   * Check if the API is available
   * @returns {Promise<boolean>} Whether the API is available
   */
  async isAPIAvailable() {
    // Simplified to always return true since we're using localStorage
    return true;
  }
  
  /**
   * Mark all saved positions as edited to ensure persistence
   * @returns {number} Number of positions marked
   */
  markSavedPositionsAsEdited() {
    // Get saved positions
    const savedPositions = this._getSavedPositions();
    const positionIds = Object.keys(savedPositions);
    
    let markedCount = 0;
    
    // Ensure all saved positions are tracked
    positionIds.forEach(labelId => {
      const savedPos = savedPositions[labelId];
      
      // Skip if already tracked
      if (this.editedLabels.has(labelId)) {
        markedCount++;
        return;
      }
      
      // Try to find the graphic in layers
      let graphic = null;
      
      if (this.view?.map?.layers) {
        // Search through all layers
        for (const layer of this.view.map.layers.toArray()) {
          if (!layer.graphics) continue;
          
          // Check each graphic
          for (const g of layer.graphics.toArray()) {
            // Skip if not a label
            const isLabel = g.symbol?.type === "text" || 
                          g.attributes?.isLabel === true;
            if (!isLabel) continue;
            
            const id = this.getLabelId(g);
            
            if (id === labelId) {
              graphic = g;
              break;
            }
          }
          
          if (graphic) break;
        }
      }
      
      // Add to tracking if graphic found
      if (graphic) {
        this.editedLabels.set(labelId, {
          graphic: graphic,
          position: savedPos.position || { x: 0, y: 0 },
          fontSize: savedPos.fontSize || this.settings.fontSize,
          text: savedPos.text || "",
        });
        
        markedCount++;
      }
    });
    
    console.log(`[LabelManager] Marked ${markedCount} saved positions as edited`);
    
    return markedCount;
  }
  
  /**
   * Clean up and destroy the manager
   */
  destroy() {
    // Save any pending changes
    this.savePositions(true);
    
    // Clean up event handlers
    this._cleanupEventHandlers();
    
    // Clear auto-save interval
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    
    // Clear references
    this.view = null;
    this.selectedLabel = null;
    this.editedLabels.clear();
    
    console.log('[LabelManager] Destroyed');
  }
}

export default LabelManager;