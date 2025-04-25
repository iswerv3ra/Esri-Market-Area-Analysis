// src/services/LabelManager.js
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
    //    <<<--- ADJUST THIS FIELD NAME based on your actual data in `customData` ---<<<
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
    // Old random fallback (avoid):
    // return `random-${Math.random().toString(36).substring(2, 9)}`;
  }
  
  /**
   * Scan a layer for labels and ensure they're properly managed
   * @param {Object} layer - The layer to scan
   */
  processLayer(layer) {
    if (!layer || !layer.graphics) return;
    
    console.log(`[LabelManager] Processing layer: ${layer.title || layer.id}`);
    
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
        
        // Store in our tracking map
        this.editedLabels.set(labelId, {
          graphic: graphic,
          position: {
            x: graphic.symbol?.xoffset || 0,
            y: graphic.symbol?.yoffset || 0
          },
          fontSize: graphic.symbol?.font?.size || this.settings.fontSize,
          text: graphic.symbol?.text || graphic.attributes?.text || "",
        });
        
        labelsFound.push(labelId);
        
        // Apply any saved position
        this._applySavedPosition(graphic);
      }
    });
    
    console.log(`[LabelManager] Found ${labelsFound.length} labels in layer`);
    
    // Mark layer as processed
    layer._labelManagerProcessed = true;
    
    return labelsFound;
  }
  
 /**
   * Apply a saved position/style to a label.
   * DO NOT apply saved text here; let the layer creation logic handle initial text.
   * @param {Object} label - The label graphic
   * @private
   */
 _applySavedPosition(label) {
    if (!label || !label.symbol) return;

    try {
      const labelId = this.getLabelId(label);
      if (!labelId) return;

      const savedPositions = this._getSavedPositions();

      if (savedPositions[labelId]) {
        const savedData = savedPositions[labelId];
        const newSymbol = label.symbol.clone(); // Start with current symbol properties

        // Apply position if available
        if (savedData.position) {
          newSymbol.xoffset = savedData.position.x;
          newSymbol.yoffset = savedData.position.y;
        }

        // Apply font size if available
        if (savedData.fontSize && newSymbol.font) {
          newSymbol.font = {
            ...newSymbol.font,
            size: savedData.fontSize
          };
        }

        // --- REMOVED TEXT APPLICATION ---
        // // Apply text if available and different
        // if (savedData.text && savedData.text !== newSymbol.text) {
        //   newSymbol.text = savedData.text; // REMOVED
        // }
        // --- END REMOVAL ---

        // Apply the updated symbol (with potentially updated position/font)
        label.symbol = newSymbol;

        // Update tracking map: Use the CURRENT text from the label graphic,
        // not the potentially stale saved text.
        this.editedLabels.set(labelId, {
          graphic: label,
          position: {
            x: newSymbol.xoffset || 0,
            y: newSymbol.yoffset || 0
          },
          fontSize: newSymbol.font?.size || this.settings.fontSize,
          text: label.symbol?.text || label.attributes?.text || "", // Get current text
        });

        // Ensure label visibility is applied
        label.visible = savedData.visible !== false;

        console.log(`[LabelManager] Applied saved position/style to label ${labelId}`); // Updated log message
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
              });
         }
      }
    } catch (error) {
      console.error(`[LabelManager] Error applying saved position to ${label?.attributes?.labelId || 'unknown label'}:`, error);
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
   * Save positions to storage
   * @param {boolean} force - Whether to force save even if no edits
   * @returns {Object} Result of the save operation
   */
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
        savedPositions[labelId] = {
          position: labelData.position,
          fontSize: labelData.fontSize,
          text: labelData.text,
          visible: labelData.graphic?.visible !== false,
          lastEdited: Date.now()
        };
        updatedCount++;
      });
      
      // Save to localStorage
      localStorage.setItem(this.storageKey, JSON.stringify(savedPositions));
      
      console.log(`[LabelManager] Saved ${updatedCount} label positions`);
      
      return {
        success: true,
        message: `Saved ${updatedCount} label positions`,
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
   * @returns {Object} Result of the load operation
   */
  loadPositions(force = false) {
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
      
      console.log(`[LabelManager] Applied ${appliedCount} saved positions`);
      
      return {
        success: true,
        message: `Applied ${appliedCount} saved positions`,
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
  
  /**
   * Update a label's font size
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
      
      // Update tracking
      this.editedLabels.set(labelId, {
        ...labelData,
        fontSize: fontSize,
      });
      
      console.log(`[LabelManager] Updated font size for ${labelId} to ${fontSize}`);
      
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
   * Update a label's text
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
      newSymbol.text = text;
      
      // Apply the updated symbol
      labelData.graphic.symbol = newSymbol;
      
      // Update attributes as well
      if (labelData.graphic.attributes) {
        labelData.graphic.attributes.text = text;
        labelData.graphic.attributes.labelText = text;
      }
      
      // Update tracking
      this.editedLabels.set(labelId, {
        ...labelData,
        text: text,
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
   * @returns {boolean} New edit mode state
   */
  toggleEditingMode(enableEdit) {
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
        
        // Perform hit test
        this.view.hitTest(event.screenPoint).then(response => {
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
    
    // Clear selection
    this.selectedLabel = null;
    this.isMoving = false;
  }
  
  /**
   * Clean up event handlers
   * @private
   */
  _cleanupEventHandlers() {
    // Remove all event handlers
    for (const handler of this.handlers) {
      if (handler && typeof handler.remove === 'function') {
        handler.remove();
      }
    }
    
    // Clear the handlers array
    this.handlers = [];
  }
  
  /**
   * Select a label for editing
   * @param {Object} labelGraphic - The label graphic to select
   * @returns {Object} The selected label
   */
  selectLabel(labelGraphic) {
    if (!this.editMode || !labelGraphic) return null;
    
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
    if (!this.editMode || !this.selectedLabel || !this.view) {
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
   * Refresh all labels to ensure they're properly displayed
   * @returns {Object} Result of the refresh operation
   */
  refreshLabels() {
    try {
      // Ensure all tracked labels are visible based on zoom level
      let refreshCount = 0;
      
      this.editedLabels.forEach((labelData, labelId) => {
        if (labelData.graphic && labelData.graphic.symbol) {
          // Ensure label is visible based on zoom level
          labelData.graphic.visible = this.view.zoom >= this.settings.minZoom;
          refreshCount++;
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
            layer.refresh();
          }
        });
      }
      
      console.log(`[LabelManager] Refreshed ${refreshCount} labels`);
      
      return {
        success: true,
        message: `Refreshed ${refreshCount} labels`,
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
   * Configure settings for a specific layer type
   * @param {string} layerType - Type of layer (comp, pipe, custom, etc.)
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
    const settings = typeSettings[type] || typeSettings.custom;
    
    // Update settings
    this.updateSettings(settings);
    
    console.log(`[LabelManager] Configured settings for layer type: ${type}`);
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