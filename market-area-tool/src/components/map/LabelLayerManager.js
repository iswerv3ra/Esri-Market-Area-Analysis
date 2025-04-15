// src/components/map/LabelLayerManager.js

import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import TextSymbol from "@arcgis/core/symbols/TextSymbol";
import Color from "@arcgis/core/Color";
import Point from "@arcgis/core/geometry/Point";

/**
 * LabelLayerManager - Manages dedicated label layers for data layers
 * and integrates with existing label graphics in the map
 */
export class LabelLayerManager {
  constructor(view, options = {}) {
    this.view = view;
    this.options = {
      padding: 10,
      fontSizeRange: [9, 13],
      haloSize: 2,
      haloColor: [255, 255, 255, 0.9],
      minDistanceBetweenLabels: 20,
      labelMinZoom: 9,
      maxLabelsVisible: 60,
      debugMode: false,
      ...options
    };

    this.labelLayers = new Map(); // dataLayerId -> LabelLayer
    this.integratedLabels = new Map(); // dataLayerId -> [labelGraphics]
    this.selectedLabel = null;
    this.editMode = false;
    this.eventHandles = [];
    this.autoSaveInterval = null;

    // Initialize
    this._initialize();
    console.log("[LabelLayerManager] Initialized");
  }

  /**
   * Initialize the manager
   * @private
   */
  _initialize() {
    // Monitor zoom changes for label visibility
    this.eventHandles.push(
      this.view.watch("zoom", (zoom) => {
        this._updateLabelVisibility(zoom);
      })
    );

    // Monitor layer changes
    this.eventHandles.push(
      this.view.map.layers.on("change", (event) => {
        // Handle added layers
        if (event.added?.length) {
          event.added.forEach(layer => this._handleLayerAdded(layer));
        }
        
        // Handle removed layers
        if (event.removed?.length) {
          event.removed.forEach(layer => this._handleLayerRemoved(layer));
        }
      })
    );

    // Check existing layers
    this.view.map.allLayers.forEach(layer => this._handleLayerAdded(layer));

    // Set up automatic periodic saving
    this._setupAutoSave();
    
    // Process all layers again to ensure we haven't missed any
    setTimeout(() => {
      this.view.map.allLayers.forEach(layer => {
        this._findAndIntegrateExistingLabels(layer);
      });
    }, 1000);
  }


/**
 * Create a label for a feature that doesn't already have one
 * Enhanced to better support all types of features and provide clear logging
 * 
 * @param {Layer} layer - The layer containing the feature
 * @param {Graphic} feature - The feature needing a label
 * @private
 */
_createLabelForFeature(layer, feature) {
    if (!feature || !feature.geometry) {
      console.warn("[LabelLayerManager] Cannot create label: Feature is missing or has no geometry");
      return null;
    }
    
    // Determine the label text from feature attributes
    let labelText = null;
    
    // Check various common label text sources
    if (feature.attributes) {
      // Best case: explicit labelText attribute
      if (feature.attributes.labelText) {
        labelText = feature.attributes.labelText;
      }
      // Second best: name attribute (common for points)
      else if (feature.attributes.name) {
        labelText = feature.attributes.name;
      }
      // Third: title attribute (also common)
      else if (feature.attributes.title) {
        labelText = feature.attributes.title;
      }
      // Additional common attribute names
      else if (feature.attributes.NAME) {
        labelText = feature.attributes.NAME;
      }
      // For pipe/comp features, often use status or value
      else if (feature.attributes.status) {
        labelText = feature.attributes.status;
      }
      else if (feature.attributes.value) {
        labelText = feature.attributes.value;
      }
      // For custom points, try displayName or displayValue
      else if (feature.attributes.displayName) {
        labelText = feature.attributes.displayName;
      }
      else if (feature.attributes.displayValue) {
        labelText = feature.attributes.displayValue;
      }
    }
    
    // If we couldn't find a label text, use a default
    if (!labelText) {
      // For custom points, at least generate a generic label
      if (feature.attributes?.isCustomPoint) {
        labelText = `Point ${feature.attributes._internalId || Math.random().toString(36).substring(2, 6)}`;
      } else {
        console.warn("[LabelLayerManager] No suitable text found for label in feature:", feature.attributes);
        return null; // Skip label creation if we can't find text
      }
    }
    
    try {
      // Import required modules
      console.log(`[LabelLayerManager] Creating label for feature with text: "${labelText}"`);
      
      // Generate a unique ID for the label
      const featureId = feature.attributes?.OBJECTID || 
                        feature.attributes?.FID || 
                        feature.attributes?._internalId || 
                        feature.attributes?.id || 
                        `feature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const labelId = `label-${featureId}`;
      
      // Create the text symbol with improved default style
      const textSymbol = {
        type: "text",
        text: labelText,
        font: {
          size: this.options.fontSizeRange[0],
          family: "sans-serif",
          weight: "normal"
        },
        color: [0, 0, 0, 0.95], // Near black with high opacity
        haloColor: this.options.haloColor,
        haloSize: this.options.haloSize,
        xoffset: 0,
        yoffset: -10 // Offset slightly above point features by default
      };
      
      // Create the label graphic
      const labelGraphic = {
        geometry: feature.geometry.clone ? feature.geometry.clone() : feature.geometry,
        symbol: textSymbol,
        attributes: {
          id: labelId,
          isLabel: true,
          parentID: featureId,
          layerId: layer.id,
          text: labelText,
          FEATURE_TYPE: "label",
          // Track the feature's visualization type
          visualizationType: layer.visualizationType || "unknown",
          // Transfer other relevant attributes from the feature
          displayName: feature.attributes?.displayName,
          displayValue: feature.attributes?.displayValue,
          status: feature.attributes?.status,
          _createdBy: "LabelLayerManager._createLabelForFeature",
          _createdAt: new Date().toISOString()
        }
      };
      
      // Add to the layer using ArcGIS modules
      const addLabelToLayer = async () => {
        try {
          const [{ default: Graphic }, { default: TextSymbol }, { default: Color }] = 
            await Promise.all([
              import("@arcgis/core/Graphic"),
              import("@arcgis/core/symbols/TextSymbol"),
              import("@arcgis/core/Color")
            ]);
            
          // Create proper ArcGIS objects
          const arcgisSymbol = new TextSymbol({
            ...textSymbol,
            color: new Color(textSymbol.color),
            haloColor: new Color(textSymbol.haloColor)
          });
          
          const arcgisGraphic = new Graphic({
            geometry: labelGraphic.geometry,
            symbol: arcgisSymbol,
            attributes: labelGraphic.attributes
          });
          
          // Add to the layer
          layer.add(arcgisGraphic);
          console.log(`[LabelLayerManager] Successfully added label "${labelText}" to layer ${layer.id}`);
          
          // Make sure our integrations list includes this layer
          if (!this.integratedLabels.has(layer.id)) {
            this.integratedLabels.set(layer.id, []);
          }
          
          // Add the new label to our tracked labels
          this.integratedLabels.get(layer.id).push(arcgisGraphic);
          
          return arcgisGraphic;
        } catch (error) {
          console.error(`[LabelLayerManager] Error creating ArcGIS label objects:`, error);
          return null;
        }
      };
      
      // Execute the async function
      addLabelToLayer();
      
      // Return the label description (this isn't the actual graphic yet,
      // but has all the info that will go into the graphic)
      return labelGraphic;
    } catch (error) {
      console.error(`[LabelLayerManager] Error creating label for feature:`, error);
      return null;
    }
  }

/**
 * Enhanced _findAndIntegrateExistingLabels method
 * Improved to better detect features that need labels and create missing labels
 * 
 * @param {Layer} layer - The layer to search for labels and features
 * @private
 */
_findAndIntegrateExistingLabels(layer) {
    // Skip if not a valid layer or already processed
    if (!layer) {
      console.warn("[LabelLayerManager] Cannot scan null/undefined layer");
      return;
    }
    
    // Skip if already fully processed recently (performance optimization)
    const layerId = layer.id || layer.uid;
    const processedKey = `${layerId}_lastProcessed`;
    const now = Date.now();
    const lastProcessed = this._processedLayers ? this._processedLayers[processedKey] : 0;
    
    // Don't re-process the same layer too frequently (unless force=true)
    const minProcessInterval = 2000; // 2 seconds
    if (lastProcessed && (now - lastProcessed < minProcessInterval)) {
      console.log(`[LabelLayerManager] Skipping recently processed layer: ${layer.title || layer.id}`);
      return;
    }
    
    // Initialize processing tracking if needed
    if (!this._processedLayers) {
      this._processedLayers = {};
    }
    this._processedLayers[processedKey] = now;
    
    console.log(`[LabelLayerManager] Scanning layer for labels: ${layer.title || layer.id}`);
    
    // Track different types of items found
    const stats = {
      existingLabels: 0,
      featuresNeedingLabels: 0,
      createdLabels: 0,
      errors: 0
    };
    
    // Map to store feature IDs that already have labels
    const featuresWithLabels = new Map();
    
    // Track labels we find
    const labelGraphics = [];
    const processedIds = new Set(); // Prevent duplicates
    
    // STEP 1: Find all existing label graphics
    if (layer.graphics && layer.graphics.items) {
      layer.graphics.items.forEach(graphic => {
        // Skip if we've seen this exact graphic already
        if (processedIds.has(graphic.uid)) return;
        processedIds.add(graphic.uid);
        
        // Check if this is a label
        const isExplicitLabel = graphic.attributes?.isLabel === true;
        const hasTextSymbol = graphic.symbol?.type === "text";
        const hasLabelText = graphic.attributes?.labelText !== undefined || 
                             graphic.attributes?.text !== undefined;
        const hasParentID = graphic.attributes?.parentID !== undefined;
        
        if (isExplicitLabel || hasTextSymbol || (hasLabelText && hasParentID)) {
          // This is a label - mark it as such if needed
          if (!graphic.attributes) {
            graphic.attributes = {};
          }
          graphic.attributes.isLabel = true;
          
          // Add to our collection
          labelGraphics.push(graphic);
          stats.existingLabels++;
          
          // Track which feature this label belongs to
          if (hasParentID) {
            featuresWithLabels.set(graphic.attributes.parentID, graphic);
          }
          
          // Debug logging
          if (this.options.debugMode) {
            console.log(`[LabelLayerManager] Found existing label:`, {
              text: graphic.symbol?.text || graphic.attributes?.labelText || graphic.attributes?.text,
              parentID: graphic.attributes?.parentID,
              hasTextSymbol
            });
          }
        }
      });
    }
    
    // STEP 2: Find all features that NEED labels but don't have them
    if (layer.graphics && layer.graphics.items) {
      layer.graphics.items.forEach(graphic => {
        // Skip if it's a label itself
        if (graphic.attributes?.isLabel === true || 
            graphic.symbol?.type === "text") {
          return;
        }
        
        // Check if this is a feature that should have a label
        const isVisualizationFeature = 
          (layer.visualizationType === "comp" || 
           layer.visualizationType === "pipe" || 
           layer.visualizationType === "custom");
        
        const hasLabelableContent = 
          graphic.attributes?.labelText !== undefined || 
          graphic.attributes?.name !== undefined ||
          graphic.attributes?.title !== undefined ||
          graphic.attributes?.displayName !== undefined ||
          graphic.attributes?.status !== undefined ||
          graphic.attributes?.isCustomPoint === true;
          
        // Get the feature's ID
        const featureId = 
          graphic.attributes?.OBJECTID || 
          graphic.attributes?.FID || 
          graphic.attributes?._internalId || 
          graphic.attributes?.id ||
          graphic.uid;
          
        // Check if this feature already has a label
        const alreadyHasLabel = featuresWithLabels.has(featureId);
        
        // If feature should have a label but doesn't, create one
        if ((isVisualizationFeature || hasLabelableContent) && !alreadyHasLabel) {
          stats.featuresNeedingLabels++;
          
          // Create a label for this feature
          try {
            const newLabel = this._createLabelForFeature(layer, graphic);
            if (newLabel) {
              stats.createdLabels++;
            }
          } catch (err) {
            console.error("[LabelLayerManager] Error creating label for feature:", err);
            stats.errors++;
          }
        }
      });
    }
    
    // STEP 3: Register all found and created labels
    if (labelGraphics.length > 0) {
      console.log(`[LabelLayerManager] Found and integrated ${labelGraphics.length} existing labels in layer: ${layer.title || layer.id}`);
      this.integratedLabels.set(layer.id, labelGraphics);
      
      // Apply any global label settings to these labels
      this._applyLabelSettingsToGraphics(labelGraphics);
    }
    
    // Log results
    console.log(`[LabelLayerManager] Layer scan complete for ${layer.title || layer.id}:`, stats);
    
    if (stats.featuresNeedingLabels > 0 && stats.createdLabels > 0) {
      // Return true if we actually created any new labels
      return true;
    }
    
    return stats.existingLabels > 0;
  }

  /**
   * Apply label settings to an array of label graphics
   * @param {Array} labelGraphics - Array of label graphics to update
   * @private
   */
  _applyLabelSettingsToGraphics(labelGraphics) {
    if (!labelGraphics || labelGraphics.length === 0) return;
    
    labelGraphics.forEach(graphic => {
      if (!graphic.symbol || graphic.symbol.type !== "text") return;
      
      // Ensure font size is within our desired range
      if (graphic.symbol.font && 
          (graphic.symbol.font.size < this.options.fontSizeRange[0] || 
           graphic.symbol.font.size > this.options.fontSizeRange[1])) {
        graphic.symbol.font.size = this.options.fontSizeRange[0];
      }
      
      // Ensure halo is set
      if (graphic.symbol.haloSize !== this.options.haloSize || 
          !graphic.symbol.haloColor) {
        graphic.symbol.haloSize = this.options.haloSize;
        graphic.symbol.haloColor = new Color(this.options.haloColor);
      }
      
      // Set visibility based on zoom level
      graphic.visible = this.view.zoom >= this.options.labelMinZoom;
    });
  }

  /**
   * Handles when a layer is added to the map
   * @param {Layer} layer - The layer that was added
   * @private
   */
  _handleLayerAdded(layer) {
    // Look for existing labels first
    this._findAndIntegrateExistingLabels(layer);
    
    // Only create new label layers for layers that need them
    // and don't already have integrated labels
    if (this._shouldCreateLabelsForLayer(layer) && 
        !this.integratedLabels.has(layer.id)) {
      this.createLabelLayer(layer);
    }
  }

  /**
   * Determine if a layer should have an associated label layer
   * @param {Layer} layer - The layer to check
   * @returns {boolean} True if the layer should have labels
   * @private
   */
  _shouldCreateLabelsForLayer(layer) {
    if (!layer || !layer.id) return false;
    
    // Skip layers that already appear to be label layers
    if (layer.id.includes('labels-for-') || 
        (layer.title && (
          layer.title.includes('Labels for') || 
          layer.title.includes('Label')
        )) || 
        layer.type === 'labels') {
      return false;
    }
    
    // Create labels for visualization and feature layers
    return (
      layer.type === "graphics" || 
      layer.isVisualizationLayer === true ||
      layer.visualizationType === "comp" ||
      layer.visualizationType === "pipe" ||
      layer.visualizationType === "custom" ||
      (layer.type === "feature" && layer.renderer)
    );
  }

  /**
   * Checks if a graphic is a label
   * @param {Graphic} graphic - The graphic to check
   * @returns {boolean} True if the graphic is a label
   * @private
   */
  _isLabelGraphic(graphic) {
    // Check various indicators that this is a label
    return (
      // Explicit flag
      graphic.attributes?.isLabel === true ||
      // Text symbol
      (graphic.symbol && graphic.symbol.type === "text") ||
      // Parent ID (commonly used for labels)
      graphic.attributes?.parentID !== undefined ||
      // Label text attribute
      graphic.attributes?.labelText !== undefined ||
      // Attributes that signify this is a label
      graphic.attributes?._isLabelGraphic === true
    );
  }

  /**
   * Handle layer removal
   * @param {Layer} layer - The layer being removed
   * @private
   */
  _handleLayerRemoved(layer) {
    // Clean up our dedicated label layers
    const labelLayer = this.labelLayers.get(layer.id);
    if (labelLayer) {
      console.log(`[LabelLayerManager] Removing label layer for ${layer.id}`);
      labelLayer.destroy();
      this.labelLayers.delete(layer.id);
    }
    
    // Clean up integrated labels
    if (this.integratedLabels.has(layer.id)) {
      console.log(`[LabelLayerManager] Removing integrated label tracking for ${layer.id}`);
      this.integratedLabels.delete(layer.id);
    }
  }

  /**
   * Update label visibility based on zoom level
   * @param {number} zoom - Current zoom level
   * @private
   */
  _updateLabelVisibility(zoom) {
    const isZoomVisible = zoom >= this.options.labelMinZoom;
    
    // Update dedicated label layers
    this.labelLayers.forEach(labelLayer => {
      labelLayer.setLayerVisibility(isZoomVisible);
    });
    
    // Update integrated labels
    this.integratedLabels.forEach((labelGraphics, layerId) => {
      labelGraphics.forEach(graphic => {
        if (graphic) {
          graphic.visible = isZoomVisible;
        }
      });
    });
  }

  /**
   * Set up automatic saving of label positions
   * @private
   */
  _setupAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    this.autoSaveInterval = setInterval(() => {
      this.saveLabels();
    }, 30000); // Save every 30 seconds
  }

  /**
   * Create a dedicated label layer for a data layer
   * @param {Layer} dataLayer - The data layer to create labels for
   * @returns {LabelLayer} The created label layer
   */
  createLabelLayer(dataLayer) {
    if (!dataLayer || this.labelLayers.has(dataLayer.id)) {
      return this.labelLayers.get(dataLayer.id);
    }

    console.log(`[LabelLayerManager] Creating dedicated label layer for ${dataLayer.id}`);
    
    // Import LabelLayer dynamically - this is necessary due to circular dependencies
    import('./LabelLayer.js').then(({ LabelLayer }) => {
      // Create a new label layer
      const labelLayer = new LabelLayer(dataLayer, this.view, this.options);
      
      // Add to map (low in the stack so labels are on top)
      this.view.map.add(labelLayer.graphicsLayer);
      
      // Store in our registry
      this.labelLayers.set(dataLayer.id, labelLayer);
      
      // Load any saved label positions
      this._loadSavedLabelsForLayer(dataLayer.id, labelLayer);
    }).catch(error => {
      console.error(`[LabelLayerManager] Error creating label layer for ${dataLayer.id}:`, error);
    });
  }

  /**
   * Load saved label positions for a specific layer
   * @param {string} layerId - The layer ID
   * @param {LabelLayer} labelLayer - The label layer instance
   * @private
   */
  _loadSavedLabelsForLayer(layerId, labelLayer) {
    try {
      const savedLabels = localStorage.getItem('labelPositions');
      if (!savedLabels) return;
      
      const allLabelData = JSON.parse(savedLabels);
      const layerLabels = allLabelData[layerId];
      
      if (layerLabels) {
        labelLayer.restoreLabelsFromStorage(layerLabels);
        console.log(`[LabelLayerManager] Restored ${Object.keys(layerLabels).length} labels for layer ${layerId}`);
      }
    } catch (error) {
      console.error(`[LabelLayerManager] Error loading saved labels for layer ${layerId}:`, error);
    }
  }

  /**
   * Toggle label editing mode on/off
   * @returns {boolean} New editing state
   */
  toggleEditMode() {
    this.editMode = !this.editMode;
    
    if (this.editMode) {
      this._enableLabelSelection();
    } else {
      this._disableLabelSelection();
      this.selectedLabel = null;
    }
    
    // Update cursor on view
    if (this.view.container) {
      this.view.container.style.cursor = this.editMode ? 'pointer' : 'default';
    }
    
    console.log(`[LabelLayerManager] Label editing mode ${this.editMode ? 'enabled' : 'disabled'}`);
    return this.editMode;
  }

  /**
   * Enable label selection in the view
   * @private
   */
  _enableLabelSelection() {
    // Add click handler to select labels
    this.eventHandles.push(
      this.view.on('click', (event) => {
        if (!this.editMode) return;
        
        // Perform hit test
        this.view.hitTest(event.screenPoint).then(response => {
          const labelHits = response.results?.filter(result => {
            const graphic = result.graphic;
            return graphic && this._isLabelGraphic(graphic);
          });
          
          if (labelHits && labelHits.length > 0) {
            event.stopPropagation();
            this.selectLabel(labelHits[0].graphic);
          } else {
            this.selectedLabel = null;
          }
        });
      })
    );
  }

  /**
   * Disable label selection
   * @private
   */
  _disableLabelSelection() {
    // Just clean up event handlers that will be re-created on enable
    // The main cleanup happens in destroy()
  }

  /**
   * Select a label for editing
   * @param {Graphic} labelGraphic - The label graphic to select
   */
  selectLabel(labelGraphic) {
    if (!this.editMode || !labelGraphic) return;
    
    // Highlight the selected label
    this.selectedLabel = labelGraphic;
    
    // Update highlights if needed
    
    console.log(`[LabelLayerManager] Selected label: ${labelGraphic.attributes?.id || 'unknown'}`);
    
    return labelGraphic;
  }

  /**
   * Update a label's properties
   * @param {Graphic} labelGraphic - The label to update
   * @param {Object} properties - Properties to update
   * @returns {Graphic} The updated label graphic
   */
  updateLabel(labelGraphic, properties) {
    if (!labelGraphic) return null;
    
    try {
      // Clone the current symbol if possible
      const symbol = labelGraphic.symbol?.clone ? labelGraphic.symbol.clone() : labelGraphic.symbol;
      if (!symbol || symbol.type !== "text") {
        console.warn("[LabelLayerManager] Cannot update label - not a valid text symbol");
        return null;
      }
      
      // Update text if specified
      if (properties.text !== undefined) {
        symbol.text = properties.text;
        // Also update the stored text
        if (labelGraphic.attributes) {
          labelGraphic.attributes.text = properties.text;
          labelGraphic.attributes.labelText = properties.text;
        }
      }
      
      // Update font size if specified
      if (properties.fontSize !== undefined && symbol.font) {
        symbol.font = {
          ...symbol.font,
          size: properties.fontSize
        };
      }
      
      // Update position if specified
      if (properties.position) {
        symbol.xoffset = properties.position.x;
        symbol.yoffset = properties.position.y;
      }
      
      // Apply the updated symbol
      labelGraphic.symbol = symbol;
      
      // Mark as user-edited
      if (labelGraphic.attributes) {
        labelGraphic.attributes.userEdited = true;
        labelGraphic.attributes.lastEdited = Date.now();
        labelGraphic.attributes._isEdited = true; // For compatibility with old code
      }
      
      return labelGraphic;
    } catch (error) {
      console.error(`[LabelLayerManager] Error updating label:`, error);
      return null;
    }
  }

  /**
   * Update label text
   * @param {Graphic} labelGraphic - The label to update
   * @param {string} newText - New text content
   * @returns {Graphic} The updated label
   */
  updateLabelText(labelGraphic, newText) {
    return this.updateLabel(labelGraphic, { text: newText });
  }

  /**
   * Update label font size
   * @param {Graphic} labelGraphic - The label to update
   * @param {number} fontSize - New font size
   * @returns {Graphic} The updated label
   */
  updateLabelFontSize(labelGraphic, fontSize) {
    return this.updateLabel(labelGraphic, { fontSize });
  }

  /**
   * Update label position
   * @param {Graphic} labelGraphic - The label to update
   * @param {Object} position - New position {x, y} offsets
   * @returns {Graphic} The updated label
   */
  updateLabelPosition(labelGraphic, position) {
    return this.updateLabel(labelGraphic, { position });
  }

  /**
   * Save all labels to localStorage
   * @returns {Object} Result of the save operation
   */
  saveLabels() {
    try {
      const allLabels = {};
      let totalLabels = 0;
      
      // Collect label data from dedicated label layers
      this.labelLayers.forEach((labelLayer, layerId) => {
        const layerLabels = labelLayer.getLabelsForStorage();
        if (Object.keys(layerLabels).length > 0) {
          allLabels[layerId] = layerLabels;
          totalLabels += Object.keys(layerLabels).length;
        }
      });
      
      // Collect label data from integrated labels
      this.integratedLabels.forEach((labelGraphics, layerId) => {
        const layerLabels = {};
        let count = 0;
        
        labelGraphics.forEach(graphic => {
          if (!graphic || !graphic.symbol || !graphic.attributes) return;
          
          // Only store labels that have been edited
          if (graphic.attributes.userEdited || 
              graphic.attributes._isEdited ||
              graphic.symbol.xoffset !== 0 || 
              graphic.symbol.yoffset !== 0) {
            
            // Generate an ID for this label
            const labelId = graphic.attributes.id || 
                           `${layerId}-label-${count}`;
            
            layerLabels[labelId] = {
              text: graphic.symbol.text || graphic.attributes.text || graphic.attributes.labelText,
              fontSize: graphic.symbol.font?.size || this.options.fontSizeRange[0],
              position: {
                x: graphic.symbol.xoffset || 0,
                y: graphic.symbol.yoffset || 0
              },
              lastEdited: graphic.attributes.lastEdited || Date.now()
            };
            
            count++;
          }
        });
        
        if (count > 0) {
          allLabels[layerId] = layerLabels;
          totalLabels += count;
        }
      });
      
      // Save to localStorage
      localStorage.setItem('labelPositions', JSON.stringify(allLabels));
      
      return { 
        success: true, 
        message: `Saved ${totalLabels} labels across ${Object.keys(allLabels).length} layers`,
        count: totalLabels
      };
    } catch (error) {
      console.error("[LabelLayerManager] Error saving labels:", error);
      return { 
        success: false, 
        message: `Error saving labels: ${error.message}`,
        count: 0
      };
    }
  }

  /**
   * Load saved labels from localStorage
   * @returns {Object} Result of the load operation
   */
  loadLabels() {
    try {
      const savedLabels = localStorage.getItem('labelPositions');
      if (!savedLabels) {
        return { 
          success: true, 
          message: "No saved labels found", 
          count: 0 
        };
      }
      
      const allLabelData = JSON.parse(savedLabels);
      let totalLoaded = 0;
      
      // Restore labels for dedicated label layers
      Object.entries(allLabelData).forEach(([layerId, layerLabels]) => {
        const labelLayer = this.labelLayers.get(layerId);
        if (labelLayer) {
          const count = labelLayer.restoreLabelsFromStorage(layerLabels);
          totalLoaded += count;
        }
      });
      
      // Restore labels for integrated labels
      Object.entries(allLabelData).forEach(([layerId, labelData]) => {
        const labelGraphics = this.integratedLabels.get(layerId);
        if (labelGraphics && labelGraphics.length > 0) {
          Object.entries(labelData).forEach(([labelId, data]) => {
            // Try to find a matching label graphic
            const labelGraphic = labelGraphics.find(graphic => 
              graphic.attributes?.id === labelId || 
              graphic.attributes?.OBJECTID === labelId);
            
            if (labelGraphic) {
              // Update the existing label
              this.updateLabel(labelGraphic, {
                text: data.text,
                fontSize: data.fontSize,
                position: data.position
              });
              totalLoaded++;
            }
          });
        }
      });
      
      return { 
        success: true, 
        message: `Loaded ${totalLoaded} labels`, 
        count: totalLoaded 
      };
    } catch (error) {
      console.error("[LabelLayerManager] Error loading labels:", error);
      return { 
        success: false, 
        message: `Error loading labels: ${error.message}`,
        count: 0
      };
    }
  }

/**
 * Enhanced configureLayerSettings with better comp/pipe support
 * @param {string} layerType - Type of layer ("pipe", "comp", "custom", etc.)
 */
configureLayerSettings(layerType) {
    if (!layerType) return;
    
    // Normalize layer type
    const type = layerType.toLowerCase();
    
    // Define settings for different layer types
    const typeConfigs = {
      pipe: {
        padding: 8,
        minDistanceBetweenLabels: 18,
        maxLabelsVisible: 80,
        fontSizeRange: [10, 14], // Slightly larger font range for pipes
        haloSize: 2, // Strong halo for better visibility
        labelPlacement: "above", // Position labels above points
        labelOffsetY: -12, // Offset above the point
      },
      comp: {
        padding: 12,
        minDistanceBetweenLabels: 24,
        maxLabelsVisible: 60,
        fontSizeRange: [9, 13], // Standard font range
        haloSize: 2.5, // Strong halo for better visibility
        labelPlacement: "above", // Position labels above points
        labelOffsetY: -14, // Offset above the point
      },
      custom: {
        padding: 10,
        minDistanceBetweenLabels: 20,
        maxLabelsVisible: 75,
        fontSizeRange: [8, 12], // Smaller font range for potentially dense custom data
        haloSize: 2, // Standard halo
        labelPlacement: "above", // Position labels above points
        labelOffsetY: -10, // Offset above the point
      }
    };
    
    // Get the configuration for this type or use custom as default
    const typeConfig = typeConfigs[type] || typeConfigs.custom;
    
    // Apply settings
    Object.assign(this.options, typeConfig);
    
    console.log(`[LabelLayerManager] Applied settings for layer type: ${type}`, typeConfig);
    
    // Update all existing label layers with new settings
    this.labelLayers.forEach(layer => {
      if (layer.updateOptions) {
        layer.updateOptions(this.options);
      }
    });
    
    // Update integrated labels
    this.integratedLabels.forEach((labelGraphics) => {
      this._applyLabelSettingsToGraphics(labelGraphics);
    });
    
    // If this is a point-based layer type like comp or pipe, make special adjustments
    if (['pipe', 'comp', 'custom'].includes(type)) {
      // Schedule a complete refresh of labels to properly position them
      setTimeout(() => this.refreshLabels(), 250);
    }
  }

  /**
   * Reset all label positions
   * @returns {Object} Result of the reset operation
   */
  resetAllLabelPositions() {
    try {
      // Clear saved positions
      localStorage.removeItem('labelPositions');
      
      // Reset dedicated label layers
      let totalReset = 0;
      this.labelLayers.forEach(layer => {
        if (layer.resetAllLabels) {
          const count = layer.resetAllLabels();
          totalReset += count;
        }
      });
      
      // Reset integrated labels
      this.integratedLabels.forEach((labelGraphics) => {
        labelGraphics.forEach(graphic => {
          if (graphic && graphic.symbol) {
            // Reset position
            graphic.symbol.xoffset = 0;
            graphic.symbol.yoffset = 0;
            
            // Reset user-edited flag
            if (graphic.attributes) {
              delete graphic.attributes.userEdited;
              delete graphic.attributes._isEdited;
              graphic.attributes.lastEdited = Date.now();
            }
            
            totalReset++;
          }
        });
      });
      
      return {
        success: true,
        message: `Reset ${totalReset} labels`,
        count: totalReset
      };
    } catch (error) {
      console.error("[LabelLayerManager] Error resetting labels:", error);
      return {
        success: false,
        message: `Error resetting labels: ${error.message}`,
        count: 0
      };
    }
  }

  /**
   * Get all label graphics across all layers
   * @returns {Array} Array of label graphics
   */
  getAllLabelGraphics() {
    const allLabels = [];
    
    // Get labels from dedicated label layers
    this.labelLayers.forEach(layer => {
      if (layer.getAllLabels) {
        allLabels.push(...layer.getAllLabels());
      }
    });
    
    // Get integrated labels
    this.integratedLabels.forEach(labelGraphics => {
      allLabels.push(...labelGraphics);
    });
    
    return allLabels;
  }

  /**
   * Clean up and destroy the manager
   */
  destroy() {
    // Save labels before destroying
    this.saveLabels();
    
    // Clear auto-save interval
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    
    // Remove event handlers
    this.eventHandles.forEach(handle => {
      if (handle && typeof handle.remove === 'function') {
        handle.remove();
      }
    });
    this.eventHandles = [];
    
    // Destroy all label layers
    this.labelLayers.forEach(layer => {
      if (layer.destroy) {
        layer.destroy();
      }
    });
    this.labelLayers.clear();
    
    // Clear integrated label tracking
    this.integratedLabels.clear();
    
    // Reset state
    this.selectedLabel = null;
    this.editMode = false;
    
    console.log("[LabelLayerManager] Successfully destroyed");
  }

  /**
   * Force a refresh of labels to ensure all are properly initialized and visible
   */
  refreshLabels(labelIds = [], respectEdits = true) {
    console.log("[LabelLayerManager] Refreshing labels...");
    
    // Refresh all integrated labels
    let refreshCount = 0;
    this.integratedLabels.forEach((labelGraphics, layerId) => {
      labelGraphics.forEach(graphic => {
        if (graphic) {
          // Make sure label is visible based on zoom level
          graphic.visible = this.view.zoom >= this.options.labelMinZoom;
          refreshCount++;
        }
      });
    });
    
    // Refresh dedicated label layers
    this.labelLayers.forEach(layer => {
      if (layer.refreshLabels) {
        const count = layer.refreshLabels();
        refreshCount += count;
      }
    });
    
    console.log(`[LabelLayerManager] Refreshed ${refreshCount} labels`);
    return { success: true, message: `Refreshed ${refreshCount} labels`, count: refreshCount };
  }
}


export function initializeLabelLayerManager(view, options = {}) {
  console.log("[initializeLabelLayerManager] Setting up label manager");
  
  // Default configuration optimized for better visibility and performance
  const defaultConfig = {
    labelMinZoom: 8,                    // Show labels at zoom level 8+
    fontSizeRange: [10, 14],            // Font size range
    haloSize: 2.5,                      // Text halo for better readability
    haloColor: [255, 255, 255, 0.95],   // White halo with high opacity
    padding: 12,                        // Padding between labels
    minDistanceBetweenLabels: 25,       // Distance between labels in pixels
    maxLabelsVisible: 80,               // Maximum number of labels to show
    // Enhanced settings for better integration
    autoScanLayers: true,               // Automatically scan for labels
    scanInterval: 2000,                 // Scan for new labels every 2 seconds
    debugMode: false,                   // Set to true for detailed logging
    // Support for custom layer types
    scanCustomTypes: ['comp', 'pipe', 'custom'],
    // Improved label positioning
    labelPlacement: "above",            // Default placement
    labelOffsetY: -10,                  // Default vertical offset
  };
  
  // Merge with any provided options
  const mergedConfig = { ...defaultConfig, ...options };
  
  // Create and return the manager
  const manager = new LabelLayerManager(view, mergedConfig);
  
  // Setup automatic scanning for labels if enabled
  if (mergedConfig.autoScanLayers) {
    let scanIntervalId = setInterval(() => {
      // Only scan if the manager isn't destroyed
      if (manager.destroyed) {
        clearInterval(scanIntervalId);
        return;
      }
      
      // Scan all layers for labels
      view.map.allLayers.forEach(layer => {
        // Focus on visualization layers first
        if (layer.isVisualizationLayer || 
            mergedConfig.scanCustomTypes.includes(layer.visualizationType)) {
          manager._findAndIntegrateExistingLabels(layer);
        }
      });
    }, mergedConfig.scanInterval);
    
    // Store the interval ID for cleanup
    manager._scanIntervalId = scanIntervalId;
  }
  
  return manager;
}