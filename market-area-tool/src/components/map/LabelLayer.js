// src/components/map/LabelLayer.js
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import TextSymbol from "@arcgis/core/symbols/TextSymbol";
import Color from "@arcgis/core/Color";
import Point from "@arcgis/core/geometry/Point";

/**
 * LabelLayer - A dedicated layer for managing labels for a data layer
 */
export class LabelLayer {
  /**
   * Create a new LabelLayer
   * @param {Layer} dataLayer - The data layer to create labels for
   * @param {MapView} view - The ArcGIS MapView
   * @param {Object} options - Configuration options
   */
  constructor(dataLayer, view, options = {}) {
    this.dataLayer = dataLayer;
    this.view = view;
    this.options = { ...options };
    
    // Create a graphics layer for the labels
    this.graphicsLayer = new GraphicsLayer({
      id: `labels-for-${dataLayer.id}`,
      title: `Labels for ${dataLayer.title || dataLayer.id}`,
      listMode: "hide", // Hide from layer list by default
      visible: view.zoom >= options.labelMinZoom
    });
    
    // Maps to track labels
    this.featureIdToLabel = new Map(); // featureId -> labelGraphic
    this.labelIdToFeature = new Map(); // labelId -> featureId
    
    // Initialize labels for existing features
    this._initializeLabels();
    
    // Set up feature monitoring
    this._setupFeatureMonitoring();
    
    console.log(`[LabelLayer] Created for ${dataLayer.id}`);
  }

  /**
   * Initialize labels for existing features
   * @private
   */
  _initializeLabels() {
    if (!this.dataLayer) return;
    
    // Handle different layer types
    if (this.dataLayer.type === "graphics" && this.dataLayer.graphics) {
      // For graphics layers, process each graphic
      this.dataLayer.graphics.forEach(graphic => {
        this._createLabelForFeature(graphic);
      });
      
      console.log(`[LabelLayer] Created labels for ${this.featureIdToLabel.size} features in graphics layer ${this.dataLayer.id}`);
    }
    else if (this.dataLayer.type === "feature") {
      // For feature layers, query features in the current view
      this._queryFeaturesAndCreateLabels();
    }
  }

  /**
   * Query features from a feature layer and create labels
   * @private
   */
  _queryFeaturesAndCreateLabels() {
    // Only proceed if we have a feature layer with a valid query capability
    if (!this.dataLayer || !this.dataLayer.queryFeatures) return;
    
    // Create a query for features in the current view
    const query = this.dataLayer.createQuery();
    query.returnGeometry = true;
    query.outFields = ["*"];
    query.where = "1=1"; // Get all features
    
    // Execute the query
    this.dataLayer.queryFeatures(query)
      .then(featureSet => {
        if (featureSet && featureSet.features) {
          featureSet.features.forEach(feature => {
            this._createLabelForFeature(feature);
          });
          
          console.log(`[LabelLayer] Created labels for ${featureSet.features.length} features in feature layer ${this.dataLayer.id}`);
        }
      })
      .catch(error => {
        console.error(`[LabelLayer] Error querying features for labels:`, error);
      });
  }

  /**
   * Set up monitoring for feature changes
   * @private
   */
  _setupFeatureMonitoring() {
    // For graphics layers, monitor changes
    if (this.dataLayer.type === "graphics" && this.dataLayer.graphics) {
      // Watch for graphics being added
      this.dataLayer.graphics.on("change", (event) => {
        // Handle added graphics
        if (event.added && event.added.length > 0) {
          event.added.forEach(graphic => {
            this._createLabelForFeature(graphic);
          });
        }
        
        // Handle removed graphics
        if (event.removed && event.removed.length > 0) {
          event.removed.forEach(graphic => {
            this._removeLabelForFeature(this._getFeatureId(graphic));
          });
        }
      });
    }
    
    // For feature layers, this would be more complex
    // Could use onLayerViewCreated and watch for updates
  }

  /**
   * Generate a unique ID for a feature
   * @param {Graphic} feature - The feature to generate an ID for
   * @returns {string} The generated feature ID
   * @private
   */
  _getFeatureId(feature) {
    if (!feature) return null;
    
    // First check explicit ID field (OBJECTID or similar)
    if (feature.attributes) {
      if (feature.attributes.OBJECTID !== undefined) {
        return `${this.dataLayer.id}-oid-${feature.attributes.OBJECTID}`;
      }
      
      if (feature.attributes.ObjectId !== undefined) {
        return `${this.dataLayer.id}-oid-${feature.attributes.ObjectId}`;
      }
      
      if (feature.attributes.FID !== undefined) {
        return `${this.dataLayer.id}-fid-${feature.attributes.FID}`;
      }
      
      if (feature.attributes.id !== undefined) {
        return `${this.dataLayer.id}-id-${feature.attributes.id}`;
      }
    }
    
    // Use internal UID if available
    if (feature.uid) {
      return `${this.dataLayer.id}-uid-${feature.uid}`;
    }
    
    // Last resort: use geometry if available
    if (feature.geometry) {
      if (feature.geometry.type === "point") {
        return `${this.dataLayer.id}-point-${feature.geometry.x.toFixed(6)}-${feature.geometry.y.toFixed(6)}`;
      }
      
      // For other geometry types, use the extent
      const extent = feature.geometry.extent;
      if (extent) {
        return `${this.dataLayer.id}-geom-${extent.xmin.toFixed(2)}-${extent.ymin.toFixed(2)}`;
      }
    }
    
    // Final fallback - random ID
    return `${this.dataLayer.id}-rand-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get text for a label from a feature
   * @param {Graphic} feature - The feature to get text for
   * @returns {string} The label text
   * @private
   */
  _getLabelText(feature) {
    if (!feature) return "";
    
    // First check if feature already has a preferred label field
    if (feature.attributes) {
      // Check common label field names
      const labelFields = [
        "name", "NAME", "label", "LABEL", "title", "TITLE",
        "description", "DESC", "Text", "text", "value", "VALUE"
      ];
      
      for (const field of labelFields) {
        if (feature.attributes[field] !== undefined && 
            feature.attributes[field] !== null) {
          return String(feature.attributes[field]);
        }
      }
      
      // For visualization layers, check visualization-specific fields
      if (this.dataLayer.visualizationType === "pipe" ||
          this.dataLayer.visualizationType === "pipeline") {
        // For pipeline, check status fields
        const statusFields = ["status", "STATUS", "state", "STATE"];
        for (const field of statusFields) {
          if (feature.attributes[field] !== undefined &&
              feature.attributes[field] !== null) {
            return String(feature.attributes[field]);
          }
        }
      }
      
      // If feature has a limited set of attributes, use the first one that's not OBJECTID
      const keys = Object.keys(feature.attributes);
      if (keys.length > 0) {
        // Skip common ID fields
        const skipFields = ["OBJECTID", "ObjectId", "FID", "SHAPE", "Shape"];
        for (const key of keys) {
          if (!skipFields.includes(key) && 
              feature.attributes[key] !== undefined && 
              feature.attributes[key] !== null) {
            return String(feature.attributes[key]);
          }
        }
      }
    }
    
    // If feature has a text symbol, use that
    if (feature.symbol && feature.symbol.type === "text" &&
        feature.symbol.text) {
      return feature.symbol.text;
    }
    
    // Last resort: Use feature ID
    const featureId = this._getFeatureId(feature);
    return featureId ? `Feature ${featureId.split('-').pop()}` : "Point";
  }

  /**
   * Create a label for a feature
   * @param {Graphic} feature - The feature to create a label for
   * @returns {Graphic} The created label graphic
   * @private
   */
  _createLabelForFeature(feature) {
    if (!feature || !feature.geometry) return null;
    
    // Generate feature ID
    const featureId = this._getFeatureId(feature);
    if (!featureId) return null;
    
    // Skip if we already have a label for this feature
    if (this.featureIdToLabel.has(featureId)) {
      return this.featureIdToLabel.get(featureId);
    }
    
    // Get label text
    const labelText = this._getLabelText(feature);
    if (!labelText) return null;
    
    // Create label
    try {
      // Generate a unique ID for the label
      const labelId = `label-${featureId}`;
      
      // Create the text symbol with default style
      const textSymbol = new TextSymbol({
        text: labelText,
        font: {
          size: this.options.fontSizeRange[0],
          family: "sans-serif",
          weight: "normal"
        },
        color: new Color([0, 0, 0, 0.95]),
        haloColor: new Color(this.options.haloColor),
        haloSize: this.options.haloSize,
        xoffset: 0,
        yoffset: 0
      });
      
      // Create the label graphic
      const labelGraphic = new Graphic({
        geometry: feature.geometry.clone(),
        symbol: textSymbol,
        attributes: {
          id: labelId,
          featureId: featureId,
          isLabel: true,
          layerId: this.dataLayer.id,
          text: labelText,
          // Store additional info if needed
        }
      });
      
      // Add to graphics layer
      this.graphicsLayer.add(labelGraphic);
      
      // Store mappings
      this.featureIdToLabel.set(featureId, labelGraphic);
      this.labelIdToFeature.set(labelId, featureId);
      
      return labelGraphic;
    } catch (error) {
      console.error(`[LabelLayer] Error creating label for feature ${featureId}:`, error);
      return null;
    }
  }

  /**
   * Remove a label for a feature
   * @param {string} featureId - The ID of the feature
   * @private
   */
  _removeLabelForFeature(featureId) {
    if (!featureId) return;
    
    const labelGraphic = this.featureIdToLabel.get(featureId);
    if (labelGraphic) {
      // Remove from graphics layer
      this.graphicsLayer.remove(labelGraphic);
      
      // Remove from mappings
      const labelId = labelGraphic.attributes?.id;
      this.featureIdToLabel.delete(featureId);
      if (labelId) {
        this.labelIdToFeature.delete(labelId);
      }
    }
  }

  /**
   * Set visibility for the label layer
   * @param {boolean} visible - Whether labels should be visible
   */
  setLayerVisibility(visible) {
    this.graphicsLayer.visible = visible;
  }

  /**
   * Update options for the label layer
   * @param {Object} options - New options
   */
  updateOptions(options) {
    this.options = { ...this.options, ...options };
    
    // Apply any changes that affect existing labels
    // For example, update the visibility based on zoom level
    this.setLayerVisibility(
      this.view.zoom >= this.options.labelMinZoom
    );
  }

  /**
   * Check if this layer has a specific label
   * @param {Graphic} labelGraphic - The label graphic to check
   * @returns {boolean} True if this layer has the label
   */
  hasLabel(labelGraphic) {
    if (!labelGraphic || !labelGraphic.attributes) return false;
    
    // Check if the label is in our layer
    const labelId = labelGraphic.attributes.id;
    return this.labelIdToFeature.has(labelId);
  }

  /**
   * Update a label's properties
   * @param {Graphic} labelGraphic - The label to update
   * @param {Object} properties - Properties to update (text, fontSize, position)
   * @returns {Graphic} The updated label
   */
  updateLabel(labelGraphic, properties) {
    if (!labelGraphic || !labelGraphic.attributes) return null;
    
    // Make sure this is our label
    if (!this.hasLabel(labelGraphic)) return null;
    
    try {
      // Clone the current symbol
      const symbol = labelGraphic.symbol.clone();
      
      // Update text if specified
      if (properties.text !== undefined) {
        symbol.text = properties.text;
        // Also update the stored text
        labelGraphic.attributes.text = properties.text;
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
      labelGraphic.attributes.userEdited = true;
      labelGraphic.attributes.lastEdited = Date.now();
      
      return labelGraphic;
    } catch (error) {
      console.error(`[LabelLayer] Error updating label:`, error);
      return null;
    }
  }

  /**
   * Get all labels in this layer
   * @returns {Array} Array of label graphics
   */
  getAllLabels() {
    return Array.from(this.featureIdToLabel.values());
  }

  /**
   * Get label data for storage
   * @returns {Object} Object with label data keyed by feature ID
   */
  getLabelsForStorage() {
    const labelData = {};
    
    this.featureIdToLabel.forEach((labelGraphic, featureId) => {
      // Only store labels that have been edited or aren't at default positions
      if (labelGraphic.attributes?.userEdited ||
          labelGraphic.symbol?.xoffset !== 0 ||
          labelGraphic.symbol?.yoffset !== 0) {
        
        labelData[featureId] = {
          text: labelGraphic.symbol?.text || labelGraphic.attributes?.text,
          fontSize: labelGraphic.symbol?.font?.size || this.options.fontSizeRange[0],
          position: {
            x: labelGraphic.symbol?.xoffset || 0,
            y: labelGraphic.symbol?.yoffset || 0
          },
          lastEdited: labelGraphic.attributes?.lastEdited || Date.now()
        };
      }
    });
    
    return labelData;
  }

  /**
   * Restore labels from storage data
   * @param {Object} labelData - Label data keyed by feature ID
   * @returns {number} Number of labels restored
   */
  restoreLabelsFromStorage(labelData) {
    if (!labelData) return 0;
    
    let restoredCount = 0;
    
    Object.entries(labelData).forEach(([featureId, data]) => {
      const labelGraphic = this.featureIdToLabel.get(featureId);
      
      if (labelGraphic) {
        // Update the existing label
        const properties = {
          text: data.text,
          fontSize: data.fontSize,
          position: data.position
        };
        
        this.updateLabel(labelGraphic, properties);
        restoredCount++;
      }
    });
    
    return restoredCount;
  }

  /**
   * Reset all labels to default positions
   * @returns {number} Number of labels reset
   */
  resetAllLabels() {
    let resetCount = 0;
    
    this.featureIdToLabel.forEach((labelGraphic) => {
      if (labelGraphic.symbol) {
        // Reset position
        const symbol = labelGraphic.symbol.clone();
        symbol.xoffset = 0;
        symbol.yoffset = 0;
        
        // Apply the updated symbol
        labelGraphic.symbol = symbol;
        
        // Reset user-edited flag
        if (labelGraphic.attributes) {
          delete labelGraphic.attributes.userEdited;
          labelGraphic.attributes.lastEdited = Date.now();
        }
        
        resetCount++;
      }
    });
    
    return resetCount;
  }

  /**
   * Clean up and destroy the label layer
   */
  destroy() {
    // Clear all internal maps
    this.featureIdToLabel.clear();
    this.labelIdToFeature.clear();
    
    // Remove the graphics layer from the map
    if (this.view && this.view.map) {
      this.view.map.remove(this.graphicsLayer);
    }
    
    // Remove all graphics
    this.graphicsLayer.removeAll();
    
    console.log(`[LabelLayer] Destroyed label layer for ${this.dataLayer.id}`);
  }
}