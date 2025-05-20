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
 * - Ensures labels are unique to each map configuration
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
    this.mapType = null; // Added to support different map types
    this.handlers = [];
    this.dragInfo = { startPoint: null, labelOffset: null };
    this.labelLayer = null;
    
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
    
    this.autoSaveInterval = null;
    
    this._initialize();
  }

  /**
   * Generate storage key that includes mapConfigId and mapType
   * @returns {string} The storage key
   */
  getStorageKey() {
    // Ensure we use a stable key that's based on the map configuration
    if (!this.mapConfigId) {
      // Try to get from sessionStorage if missing
      this.mapConfigId = sessionStorage.getItem("currentMapConfigId");
      console.log(`[LabelManager] Retrieved mapConfigId from sessionStorage: ${this.mapConfigId}`);
    }
    
    // Also check for map type if available
    if (!this.mapType) {
      this.mapType = sessionStorage.getItem("currentMapType");
      console.log(`[LabelManager] Retrieved mapType from sessionStorage: ${this.mapType}`);
    }
    
    // Build the storage key with enhanced uniqueness
    const baseKey = 'customLabelPositions';
    let storageKey = baseKey;
    
    // Add config ID if available
    if (this.mapConfigId) {
      storageKey = `${storageKey}_config_${this.mapConfigId}`;
    }
    
    // Add map type if available for additional uniqueness
    if (this.mapType) {
      storageKey = `${storageKey}_type_${this.mapType}`;
    }
    
    console.log(`[LabelManager] Using storage key: ${storageKey}`);
    return storageKey;
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
    this.mapType = sessionStorage.getItem("currentMapType");
    
    // Load saved positions
    if (this.projectId) {
      this.loadPositions();
    }
    
    console.log("[LabelManager] Initialized with project:", this.projectId, 
                "config:", this.mapConfigId, 
                "type:", this.mapType);
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
   * Set project context and map configuration context
   * @param {string} projectId - Project ID
   * @param {string} mapConfigId - Map configuration ID
   * @param {string} mapType - Map type (optional)
   */
  setContext(projectId, mapConfigId, mapType = null) {
    // Log current and new values for debugging
    console.log(`[LabelManager] Context change: Project ${this.projectId} -> ${projectId}, Config ${this.mapConfigId} -> ${mapConfigId}, Type ${this.mapType} -> ${mapType}`);
    
    const previousConfigId = this.mapConfigId;
    const previousMapType = this.mapType;
    
    this.projectId = projectId;
    this.mapConfigId = mapConfigId;
    this.mapType = mapType;
    
    // Update in sessionStorage to ensure persistence
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem("currentMapConfigId", mapConfigId);
      if (mapType) {
        sessionStorage.setItem("currentMapType", mapType);
      }
    }
    
    console.log(`[LabelManager] Context set: Project=${projectId}, Config=${mapConfigId}, Type=${mapType}`);
    
    // Important: Clear tracked labels when switching configurations or map types
    if (previousConfigId !== mapConfigId || (mapType && previousMapType !== mapType)) {
      console.log(`[LabelManager] Configuration/Map Type changed, clearing tracked labels`);
      this.editedLabels.clear();
    }
    
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
    
    // Get mapConfigId from the layer or fall back to current context
    const layerMapConfigId = layer.mapConfigId || 
                          (layer.labelFormatInfo?.mapConfigId) || 
                          this.mapConfigId;
    
    // Get mapType from the layer or fall back to current context
    const layerMapType = layer.mapType || 
                        (layer.labelFormatInfo?.mapType) || 
                        this.mapType;
    
    // CRITICAL: Only process if the layer's mapConfigId and mapType match our current context
    const configMismatch = this.mapConfigId && layerMapConfigId && this.mapConfigId !== layerMapConfigId;
    const typeMismatch = this.mapType && layerMapType && this.mapType !== layerMapType;
    
    if (configMismatch || typeMismatch) {
      console.log(`[LabelManager] Skipping layer processing - context mismatch:`, 
                  `Layer Config=${layerMapConfigId}, Manager Config=${this.mapConfigId}`,
                  `Layer Type=${layerMapType}, Manager Type=${this.mapType}`);
      return [];
    }
    
    console.log(`[LabelManager] Processing layer: ${layer.title || layer.id} with mapConfigId=${layerMapConfigId}, mapType=${layerMapType}`);
    
    // Get label options if they exist on the layer's configuration
    const labelOptions = layer.labelConfiguration?.labelOptions || layer.layerConfiguration?.labelOptions || {};
    
    // Track labels found in this layer
    const labelsFound = [];
    
    // Store map config ID and type on the layer if not already set
    if (this.mapConfigId && !layer.mapConfigId) {
      layer.mapConfigId = this.mapConfigId;
      console.log(`[LabelManager] Set mapConfigId ${this.mapConfigId} on layer ${layer.title || layer.id}`);
      if (layer.labelFormatInfo) {
        layer.labelFormatInfo.mapConfigId = this.mapConfigId;
      }
    }
    
    if (this.mapType && !layer.mapType) {
      layer.mapType = this.mapType;
      console.log(`[LabelManager] Set mapType ${this.mapType} on layer ${layer.title || layer.id}`);
      if (layer.labelFormatInfo) {
        layer.labelFormatInfo.mapType = this.mapType;
      }
    }
    
    // Process all graphics in the layer
    layer.graphics.forEach(graphic => {
      // Check if this is a label
      const isLabel = graphic.symbol?.type === "text" || 
                    graphic.attributes?.isLabel === true;
      
      if (isLabel) {
        // Generate a stable ID for this label
        const labelId = this.getLabelId(graphic);
        
        if (!labelId) return; // Skip if no stable ID can be generated
        
        // Add context metadata to graphic attributes if missing
        if (graphic.attributes) {
          if (!graphic.attributes.mapConfigId && this.mapConfigId) {
            graphic.attributes.mapConfigId = this.mapConfigId;
          }
          if (!graphic.attributes.mapType && this.mapType) {
            graphic.attributes.mapType = this.mapType;
          }
        }
        
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
          borderLineSize: graphic.symbol?.borderLineSize || 0,
          // Store context information in the label data
          mapConfigId: this.mapConfigId,
          mapType: this.mapType
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
    layer._processedWithConfigId = this.mapConfigId;
    layer._processedWithMapType = this.mapType;
    
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
        const savedData = savedPositions[labelId];
        
        // CRITICAL: Verify the map context matches before applying
        if (savedData.mapConfigId && this.mapConfigId && 
            savedData.mapConfigId !== this.mapConfigId) {
          console.log(`[LabelManager] Skipping position application - config mismatch: Label=${savedData.mapConfigId}, Manager=${this.mapConfigId}`);
          return false;
        }
        
        // CRITICAL: Also verify map type matches if available
        if (savedData.mapType && this.mapType && 
            savedData.mapType !== this.mapType) {
          console.log(`[LabelManager] Skipping position application - type mismatch: Label=${savedData.mapType}, Manager=${this.mapType}`);
          return false;
        }
        
        console.log(`[LabelManager] Found saved data for label ${labelId}:`, 
                  JSON.stringify({
                    fontSize: savedData.fontSize,
                    fontWeight: savedData.fontWeight,
                    hasBackground: !!savedData.backgroundColor,
                    mapConfigId: savedData.mapConfigId,
                    mapType: savedData.mapType
                  }));
                  
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
          // Also store context information
          label.attributes.mapConfigId = savedData.mapConfigId || this.mapConfigId;
          label.attributes.mapType = savedData.mapType || this.mapType;
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
          // Store context information
          mapConfigId: savedData.mapConfigId || this.mapConfigId,
          mapType: savedData.mapType || this.mapType
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
            borderLineSize: label.symbol?.borderLineSize || 0,
            // Store context information
            mapConfigId: this.mapConfigId,
            mapType: this.mapType
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
      // Use the configurable storage key that includes mapConfigId and mapType
      const savedData = localStorage.getItem(this.getStorageKey());
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
                // CRITICAL: Check if the label belongs to the current context
                const hitLabel = labelHit.graphic;
                
                // Skip if label is from a different map config
                if (hitLabel.attributes?.mapConfigId && 
                    this.mapConfigId && 
                    hitLabel.attributes.mapConfigId !== this.mapConfigId) {
                  console.log("[LabelManager] Ignoring label from different map config");
                  return;
                }
                
                // Skip if label is from a different map type
                if (hitLabel.attributes?.mapType && 
                    this.mapType && 
                    hitLabel.attributes.mapType !== this.mapType) {
                  console.log("[LabelManager] Ignoring label from different map type");
                  return;
                }
                
                // Found a label - start drag operation
                event.stopPropagation();
                
                // Store references
                this.draggedLabel = hitLabel;
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
  
  /**
   * Save positions to storage
   * @param {boolean} force - Whether to force save even if no changes
   * @returns {Object} Result of the save operation
   */
  savePositions(force = false) {
    if (this.editedLabels.size === 0 && !force) {
      return { success: true, message: "No changes to save", count: 0 };
    }
    
    try {
      // Ensure we have the correct configId and mapType context
      if (!this.mapConfigId) {
        this.mapConfigId = sessionStorage.getItem("currentMapConfigId");
        console.log(`[LabelManager] Retrieved mapConfigId from sessionStorage for save: ${this.mapConfigId}`);
      }
      
      if (!this.mapType) {
        this.mapType = sessionStorage.getItem("currentMapType");
        console.log(`[LabelManager] Retrieved mapType from sessionStorage for save: ${this.mapType}`);
      }
      
      // Get the storage key for the current context
      const storageKey = this.getStorageKey();
      
      // Get existing saved positions
      let savedPositions = {};
      try {
        const savedData = localStorage.getItem(storageKey);
        savedPositions = savedData ? JSON.parse(savedData) : {};
      } catch (readError) {
        console.error(`[LabelManager] Error reading from ${storageKey}:`, readError);
        savedPositions = {};
      }
      
      // Update with current edited labels
      let updatedCount = 0;
      
      this.editedLabels.forEach((labelData, labelId) => {
        // Determine font size and weight
        const fontSize = labelData.fontSize || 
                        labelData.graphic?.symbol?.font?.size || 
                        this.settings.fontSize;
        
        const fontWeight = labelData.fontWeight || 
                          labelData.graphic?.symbol?.font?.weight || 
                          "normal";
        
        const backgroundColor = labelData.backgroundColor;
        const borderLineColor = labelData.borderLineColor;
        const borderLineSize = labelData.borderLineSize;
        
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
          // Store the mapConfigId explicitly for verification
          mapConfigId: this.mapConfigId,
          // Store the mapType explicitly for verification
          mapType: this.mapType,
          // Store additional symbol properties for complete persistence
          symbolProperties: {
            haloSize: labelData.graphic?.symbol?.haloSize,
            haloColor: labelData.graphic?.symbol?.haloColor,
            kerning: labelData.graphic?.symbol?.kerning,
            horizontalAlignment: labelData.graphic?.symbol?.horizontalAlignment
          }
        };
        
        console.log(`[LabelManager SAVE] Label ${labelId}: fontSize=${fontSize}, weight=${fontWeight}, hasBackground=${!!backgroundColor}, mapConfigId=${this.mapConfigId}, mapType=${this.mapType}`);
        updatedCount++;
      });
      
      // CRITICAL: Force immediate storage - make sure it's committed
      localStorage.setItem(storageKey, JSON.stringify(savedPositions));
      
      console.log(`[LabelManager] Saved ${updatedCount} label positions and styles for config ${this.mapConfigId}, type ${this.mapType} using key ${storageKey}`);
      
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
      // Get saved positions using current context
      const savedPositions = this._getSavedPositions();
      const positionCount = Object.keys(savedPositions).length;
      
      if (positionCount === 0) {
        console.log('[LabelManager] No saved positions found');
        return { success: true, message: "No saved positions found", count: 0 };
      }
      
      console.log(`[LabelManager] Found ${positionCount} saved positions for config ${this.mapConfigId}, type ${this.mapType}`);
      
      // Apply to tracked labels and visible layers
      let appliedCount = 0;
      
      // First apply to all tracked labels
      this.editedLabels.forEach((labelData, labelId) => {
        if (savedPositions[labelId] && labelData.graphic) {
          try {
            const savedData = savedPositions[labelId];
            
            // CRITICAL: Verify context matches
            if (savedData.mapConfigId && this.mapConfigId && 
                savedData.mapConfigId !== this.mapConfigId) {
              return; // Skip if config ID doesn't match
            }
            
            if (savedData.mapType && this.mapType && 
                savedData.mapType !== this.mapType) {
              return; // Skip if map type doesn't match
            }
            
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
            
            // Apply background properties if present
            if (savedData.backgroundColor) {
              newSymbol.backgroundColor = savedData.backgroundColor;
              newSymbol.borderLineColor = savedData.borderLineColor || null;
              newSymbol.borderLineSize = savedData.borderLineSize || 0;
              
              // Apply additional properties
              newSymbol.kerning = true;
              newSymbol.horizontalAlignment = "center";
              
              // Remove any halo effect when background is applied
              newSymbol.haloSize = 0;
              newSymbol.haloColor = null;
            }
            
            // Apply text if different
            if (savedData.text && savedData.text !== newSymbol.text) {
              newSymbol.text = savedData.text;
            }
            
            // Apply the updated symbol
            graphic.symbol = newSymbol;
            
            // Update visibility
            graphic.visible = savedData.visible !== false;
            
            // Update tracking info with context information
            this.editedLabels.set(labelId, {
              graphic: graphic,
              position: {
                x: newSymbol.xoffset || 0,
                y: newSymbol.yoffset || 0
              },
              fontSize: newSymbol.font?.size || this.settings.fontSize,
              text: newSymbol.text || "",
              fontWeight: newSymbol.font?.weight || "normal",
              backgroundColor: newSymbol.backgroundColor,
              borderLineColor: newSymbol.borderLineColor,
              borderLineSize: newSymbol.borderLineSize,
              mapConfigId: savedData.mapConfigId || this.mapConfigId,
              mapType: savedData.mapType || this.mapType
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
          if (!layer.graphics) return;
          
          // Skip if processed with current context
          if (layer._processedWithConfigId === this.mapConfigId && 
              layer._processedWithMapType === this.mapType) {
            return;
          }
          
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
                
                // CRITICAL: Verify context matches
                if (savedData.mapConfigId && this.mapConfigId && 
                    savedData.mapConfigId !== this.mapConfigId) {
                  return; // Skip if config ID doesn't match
                }
                
                if (savedData.mapType && this.mapType && 
                    savedData.mapType !== this.mapType) {
                  return; // Skip if map type doesn't match
                }
                
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
                
                // Apply background properties if present
                if (savedData.backgroundColor) {
                  newSymbol.backgroundColor = savedData.backgroundColor;
                  newSymbol.borderLineColor = savedData.borderLineColor || null;
                  newSymbol.borderLineSize = savedData.borderLineSize || 0;
                  
                  // Apply additional properties
                  newSymbol.kerning = true;
                  newSymbol.horizontalAlignment = "center";
                  
                  // Remove any halo effect when background is applied
                  newSymbol.haloSize = 0;
                  newSymbol.haloColor = null;
                }
                
                // Apply text if different
                if (savedData.text && savedData.text !== newSymbol.text) {
                  newSymbol.text = savedData.text;
                }
                
                // Apply the updated symbol
                graphic.symbol = newSymbol;
                
                // Update visibility
                graphic.visible = savedData.visible !== false;
                
                // Add context metadata to graphic attributes
                if (graphic.attributes) {
                  graphic.attributes.mapConfigId = savedData.mapConfigId || this.mapConfigId;
                  graphic.attributes.mapType = savedData.mapType || this.mapType;
                }
                
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
                  backgroundColor: savedData.backgroundColor,
                  borderLineColor: savedData.borderLineColor,
                  borderLineSize: savedData.borderLineSize,
                  mapConfigId: savedData.mapConfigId || this.mapConfigId,
                  mapType: savedData.mapType || this.mapType
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
          
          // Mark layer as fully processed with this context
          layer._processedWithConfigId = this.mapConfigId;
          layer._processedWithMapType = this.mapType;
        });
      }
      
      console.log(`[LabelManager] Applied ${appliedCount} saved positions and styles for config ${this.mapConfigId}, type ${this.mapType}`);
      
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
   * Reset all label positions for the current map configuration and type
   * @returns {Object} Result of the reset operation
   */
  resetAllLabels() {
    try {
      // Remove saved positions from storage for this specific context
      localStorage.removeItem(this.getStorageKey());
      
      let resetCount = 0;
      
      // Reset all tracked labels that belong to the current context
      this.editedLabels.forEach((labelData, labelId) => {
        // Skip labels from different contexts
        if (labelData.mapConfigId && this.mapConfigId && 
            labelData.mapConfigId !== this.mapConfigId) {
          return;
        }
        
        if (labelData.mapType && this.mapType && 
            labelData.mapType !== this.mapType) {
          return;
        }
        
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
      
      // Only clear labels for this context
      const filteredEditedLabels = new Map();
      this.editedLabels.forEach((labelData, labelId) => {
        // Keep labels from different contexts
        if ((labelData.mapConfigId && labelData.mapConfigId !== this.mapConfigId) ||
            (labelData.mapType && labelData.mapType !== this.mapType)) {
          filteredEditedLabels.set(labelId, labelData);
        }
      });
      
      // Replace the current tracking map
      this.editedLabels = filteredEditedLabels;
      
      console.log(`[LabelManager] Reset ${resetCount} label positions for config ${this.mapConfigId}, type ${this.mapType}`);
      
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
      
      // Verify the label belongs to the current context
      if ((labelData.mapConfigId && this.mapConfigId && 
           labelData.mapConfigId !== this.mapConfigId) ||
          (labelData.mapType && this.mapType && 
           labelData.mapType !== this.mapType)) {
        return { 
          success: false, 
          message: `Label belongs to a different context (Config: ${labelData.mapConfigId}, Type: ${labelData.mapType})` 
        };
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
        mapConfigId: this.mapConfigId,
        mapType: this.mapType
      });
      
      // Remove from saved positions
      const savedPositions = this._getSavedPositions();
      if (savedPositions[labelId]) {
        delete savedPositions[labelId];
        localStorage.setItem(this.getStorageKey(), JSON.stringify(savedPositions));
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
      
      // Verify the label belongs to the current context
      if ((labelData.mapConfigId && this.mapConfigId && 
           labelData.mapConfigId !== this.mapConfigId) ||
          (labelData.mapType && this.mapType && 
           labelData.mapType !== this.mapType)) {
        return { 
          success: false, 
          message: `Label belongs to a different context (Config: ${labelData.mapConfigId}, Type: ${labelData.mapType})` 
        };
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
  
  /**
   * Update a label's font size with immediate save
   * @param {string|Object} labelOrId - Label ID or label graphic
   * @param {number} fontSize - New font size
   * @returns {Object} Result of the update operation
   */
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
      
      // Verify the label belongs to the current context
      if ((labelData.mapConfigId && this.mapConfigId && 
           labelData.mapConfigId !== this.mapConfigId) ||
          (labelData.mapType && this.mapType && 
           labelData.mapType !== this.mapType)) {
        return { 
          success: false, 
          message: `Label belongs to a different context (Config: ${labelData.mapConfigId}, Type: ${labelData.mapType})` 
        };
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
      
      // Verify the label belongs to the current context
      if ((labelData.mapConfigId && this.mapConfigId && 
           labelData.mapConfigId !== this.mapConfigId) ||
          (labelData.mapType && this.mapType && 
           labelData.mapType !== this.mapType)) {
        return { 
          success: false, 
          message: `Label belongs to a different context (Config: ${labelData.mapConfigId}, Type: ${labelData.mapType})` 
        };
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
              // Filter to only include labels from the current context
              const contextLabelHits = labelHits.filter(hit => {
                const attrs = hit.graphic.attributes || {};
                
                // Check if label matches current context
                const configMatch = !attrs.mapConfigId || !this.mapConfigId || 
                                  attrs.mapConfigId === this.mapConfigId;
                                  
                const typeMatch = !attrs.mapType || !this.mapType || 
                                attrs.mapType === this.mapType;
                                
                return configMatch && typeMatch;
              });
              
              if (contextLabelHits.length > 0) {
                // Select the first hit label from the current context
                event.stopPropagation();
                this.selectLabel(contextLabelHits[0].graphic);
              } else {
                // Deselect if no labels from current context
                this.selectedLabel = null;
              }
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
    
    // Verify the label belongs to the current context
    const attrs = labelGraphic.attributes || {};
    const configMatch = !attrs.mapConfigId || !this.mapConfigId || 
                      attrs.mapConfigId === this.mapConfigId;
                      
    const typeMatch = !attrs.mapType || !this.mapType || 
                    attrs.mapType === this.mapType;
    
    if (!configMatch || !typeMatch) {
      console.log("[LabelManager] Ignoring selection of label from different context");
      return null;
    }
    
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
        mapConfigId: this.mapConfigId,
        mapType: this.mapType
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
    
    // Verify the label belongs to the current context
    const attrs = this.selectedLabel.attributes || {};
    const configMatch = !attrs.mapConfigId || !this.mapConfigId || 
                      attrs.mapConfigId === this.mapConfigId;
                      
    const typeMatch = !attrs.mapType || !this.mapType || 
                    attrs.mapType === this.mapType;
    
    if (!configMatch || !typeMatch) {
      console.log("[LabelManager] Cannot move label from different context");
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
        // Skip labels from different contexts
        if ((labelData.mapConfigId && this.mapConfigId && 
             labelData.mapConfigId !== this.mapConfigId) ||
            (labelData.mapType && this.mapType && 
             labelData.mapType !== this.mapType)) {
          return;
        }
        
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
                lastEdited: Date.now(),
                mapConfigId: this.mapConfigId,
                mapType: this.mapType
              };
              
              // Save to localStorage immediately
              localStorage.setItem(this.getStorageKey(), JSON.stringify(savedPositions));
              
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
  
  /**
   * Configure layer settings based on layer type
   * @param {string} layerType - The type of layer (pipe, comp, custom, etc.)
   */
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
    
    // Store the current map type
    this.mapType = type;
    
    // Update in session storage
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem("currentMapType", type);
    }
    
    console.log(`[LabelManager] Configured settings for layer type: ${type}, preserving user fontSize: ${userFontSize !== null}`);
  }
  
  /**
   * Get all label graphics for the current context
   * @returns {Array} Array of label graphics
   */
  getAllLabelGraphics() {
    const labels = [];
    
    this.editedLabels.forEach(labelData => {
      // Only include labels from the current context
      if ((labelData.mapConfigId && this.mapConfigId && 
           labelData.mapConfigId !== this.mapConfigId) ||
          (labelData.mapType && this.mapType && 
           labelData.mapType !== this.mapType)) {
        return;
      }
      
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
      
      // Skip positions from different contexts
      if ((savedPos.mapConfigId && this.mapConfigId && 
           savedPos.mapConfigId !== this.mapConfigId) ||
          (savedPos.mapType && this.mapType && 
           savedPos.mapType !== this.mapType)) {
        return;
      }
      
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
          fontWeight: savedPos.fontWeight || "normal",
          backgroundColor: savedPos.backgroundColor,
          borderLineColor: savedPos.borderLineColor,
          borderLineSize: savedPos.borderLineSize,
          mapConfigId: savedPos.mapConfigId || this.mapConfigId,
          mapType: savedPos.mapType || this.mapType
        });
        
        markedCount++;
      }
    });
    
    console.log(`[LabelManager] Marked ${markedCount} saved positions as edited for config ${this.mapConfigId}, type ${this.mapType}`);
    
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