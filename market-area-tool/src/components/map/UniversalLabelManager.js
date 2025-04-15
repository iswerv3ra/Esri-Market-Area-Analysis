/**
 * UniversalLabelManager.js - Comprehensive label management system for ArcGIS maps
 * 
 * This module provides sophisticated label positioning that works well in all scenarios,
 * including dense urban areas and sparse rural layouts, with optimized collision 
 * avoidance and positioning algorithms.
 */

import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import TextSymbol from "@arcgis/core/symbols/TextSymbol";
import Color from "@arcgis/core/Color";
import Point from "@arcgis/core/geometry/Point";

/**
 * Class that manages advanced label positioning for map visualizations
 */
export class UniversalLabelManager {
  /**
   * Create a new UniversalLabelManager instance
   * @param {MapView} view - The ArcGIS MapView
   * @param {Object} options - Configuration options
   */
  constructor(view, options = {}) {
    this.view = view;
    this.options = {
      padding: 10,                  // Padding around labels in pixels
      maxLabelsVisible: 80,         // Maximum labels to show at once
      fontSizeRange: [9, 13],       // Min/max font size range
      priorityAttributes: ["value", "importance", "priority", "TotalUnits"],  // Attributes that increase priority
      priorityDistance: 150,        // Distance in meters to prioritize labels
      avoidCollisions: true,        // Enable collision avoidance
      maxPositionAttempts: 8,       // Max attempts to position a label
      labelMinZoom: 10,             // Minimum zoom to show labels
      debugMode: false,             // Show debug information
      layoutStrategy: 'advanced',   // 'simple', 'advanced', or 'high-quality'
      labelOpacity: 0.95,           // Label opacity
      fadeInTime: 300,              // Fade-in animation time in ms
      haloSize: 2,                  // Size of text halo in pixels
      haloColor: [255, 255, 255, 0.9], // Halo color with alpha
      maxLabelLength: 30,           // Max label text length
      minDistanceBetweenLabels: 20, // Minimum distance between labels in pixels
      densityAware: true,           // Enable density awareness
      clusterDistance: 40,          // Distance for clustering detection
      useSpatialClustering: true,   // Use spatial clustering technique
      textTransform: 'none',        // 'none', 'uppercase', 'lowercase', 'capitalize'
      maxLabelDistance: 70,         // Maximum distance a label can be from its point (in pixels)
      deduplicateLabels: true,      // Enable duplicate label detection and prevention
      // Label placement preferences (helps position labels more intelligently)
      labelPlacementPreference: ["top", "right", "bottom", "left", "top-right", "bottom-right", "bottom-left", "top-left"],
      // Added from labelManagerHelper
      preventLabelOverlap: true,    // Strictly prevent label overlap
      maxLabelDistanceFromPoint: 50,// Maximum distance a label can be from its point
      // Added to handle layers with self-managed labels
      respectSelfManagedLayers: true, // Respect layers that create their own labels
      ...options
    };

    // Set up essential properties
    this.layers = new Map();       // Map of tracked layers (layer.id -> layerInfo)
    this.labelCache = new Map();   // Cache of label information
    this.visibleLabels = new Set();// Currently visible labels
    this.labelBoxes = [];          // Currently active label bounding boxes
    this.updateInProgress = false; // Flag to prevent multiple simultaneous updates
    this.eventHandles = [];        // Tracking handles for cleanup
    this.clusterCache = new Map(); // Cache of cluster information
    this.viewportGrid = {};        // Grid for spatial indexing
    this.lastZoomLevel = view.zoom;// Track zoom level for optimization
    this.lastUpdateTime = null;    // Track last update time to prevent duplicates
    this.processedLabels = new Set(); // Track processed labels to prevent duplicates
    this.pointRegistry = new Map(); // Track points for label deduplication
    this.monitorIntervals = [];    // Track interval IDs for cleanup
    this.isEditingEnabled = false; // Editing mode flag
    this.selfManagedLayers = new Set(); // Track layers that manage their own labels
    this.layerTypeConfigs = {      // Default configurations for different layer types
      pipe: {
        padding: 8,
        minDistanceBetweenLabels: 18,
        maxLabelsVisible: 80,
        layoutStrategy: 'balanced'
      },
      comp: {
        padding: 12,
        minDistanceBetweenLabels: 24,
        maxLabelsVisible: 60,
        layoutStrategy: 'high-quality'
      },
      custom: {
        padding: 10,
        minDistanceBetweenLabels: 20,
        maxLabelsVisible: 75,
        layoutStrategy: 'advanced'
      }
    };
    
    // Create debug layer if needed
    if (this.options.debugMode) {
      this.debugLayer = new GraphicsLayer({
        id: "label-debug-layer",
        title: "Label Debug Layer",
        listMode: "hide"
      });
      this.view.map.add(this.debugLayer);
    }
    
    // Initialize the system
    this._initialize();
        
        console.log("[UniversalLabelManager] Initialized with options:", this.options);
    }

    /**
     * Initialize the label management system
     * @private
     */
    _initialize() {
        // Watch for view extent changes
        this.eventHandles.push(
        this.view.watch("extent", () => this._throttledUpdateLabelPositions())
        );
        
        // Watch for zoom changes
        this.eventHandles.push(
        this.view.watch("zoom", (newZoom) => {
            // Store the current zoom level
            this.currentZoom = newZoom;
            
            // Reset spatial grid on significant zoom change
            if (Math.abs(newZoom - this.lastZoomLevel) > 0.75) {
            this.viewportGrid = {};
            this.clusterCache.clear();
            this.lastZoomLevel = newZoom;
            this.pointRegistry.clear();
            }
            
            // If we're below minimum zoom, hide all labels
            if (newZoom < this.options.labelMinZoom) {
            this._hideAllLabels();
            return;
            }
            
            // Otherwise, update positions
            this._throttledUpdateLabelPositions();
        })
        );
        
        // Watch for layer changes
        this.eventHandles.push(
        this.view.map.layers.on("change", (event) => {
            // Handle added layers
            if (event.added?.length) {
            event.added.forEach(layer => this._addLayerIfNeeded(layer));
            }
            
            // Handle removed layers
            if (event.removed?.length) {
            event.removed.forEach(layer => this._removeLayer(layer));
            }
            
            // Update positions if layers changed
            if ((event.added?.length || event.removed?.length) && 
                this.currentZoom >= this.options.labelMinZoom) {
            this._throttledUpdateLabelPositions();
            }
        })
        );
        
        // Setup throttling for position updates
        this.throttleTimeout = null;
        this.throttleDelay = 250; // ms
        
        // Check all existing layers
        this.view.map.layers.forEach(layer => this._addLayerIfNeeded(layer));
        
        // Store initial zoom
        this.currentZoom = this.view.zoom;
        
        // Auto-load saved label positions from localStorage with a delay
        setTimeout(() => {
        try {
            console.log('[UniversalLabelManager] Auto-loading saved label positions...');
            const result = this.loadPositions(true, false); // Use localStorage, don't force refresh yet
            
            if (result.success && result.count > 0) {
            console.log(`[UniversalLabelManager] Auto-loaded ${result.count} saved label positions`);
            
            // Now trigger position update with slight delay to ensure all is processed
            setTimeout(() => {
                if (this.currentZoom >= this.options.labelMinZoom) {
                // Run duplicate detection first
                this.fixDuplicateLabels();
                // Then update all positions
                this._throttledUpdateLabelPositions();
                }
            }, 100);
            } else {
            console.log('[UniversalLabelManager] No saved label positions found during auto-load');
            }
        } catch (err) {
            console.error('[UniversalLabelManager] Error auto-loading saved positions:', err);
        }
        }, 500); // Delay to allow layers to initialize first
        
        // Perform initial update
        if (this.currentZoom >= this.options.labelMinZoom) {
        this._throttledUpdateLabelPositions();
        }
        
        // Initialize duplicate label detection and prevention if enabled
        if (this.options.deduplicateLabels) {
        // Set a short delay to allow initial layers to load
        setTimeout(() => {
            this.labelMonitorCleanup = this.fixDuplicateLabels();
        }, 500);
        }
        
        // Set up automatic periodic saving
        this._setupAutoSave();
    }

    
    /**
     * Add this method to UniversalLabelManager.js
     * This function marks saved positions as edited to ensure persistence
     * @returns {Object} Result object with success flag and message
     */
    markSavedPositionsAsEdited() {
        try {
        // Get saved positions from localStorage
        const storage = localStorage;
        const savedData = storage.getItem('customLabelPositions');
        
        if (!savedData) {
            console.log('[UniversalLabelManager] No saved label positions found to mark as edited');
            return { success: false, message: 'No saved positions to mark', count: 0 };
        }
        
        // Parse the saved positions
        const positions = JSON.parse(savedData);
        let modifiedCount = 0;
        
        // For each position, add an edited flag if not already present
        Object.keys(positions).forEach(labelId => {
            if (!positions[labelId].edited) {
            positions[labelId].edited = true;
            modifiedCount++;
            }
            
            if (!positions[labelId].permanent) {
            positions[labelId].permanent = true;
            modifiedCount++;
            }
            
            // Add a strong reference flag to ensure stable IDs
            if (!positions[labelId].userEdited) {
            positions[labelId].userEdited = true;
            modifiedCount++;
            }
            
            // Add parent ID if available for easier matching
            if (!positions[labelId].parentId && positions[labelId].parentID) {
            positions[labelId].parentId = positions[labelId].parentID;
            modifiedCount++;
            }
        });
        
        // Only save back if modifications were made
        if (modifiedCount > 0) {
            storage.setItem('customLabelPositions', JSON.stringify(positions));
            console.log(`[UniversalLabelManager] Marked ${Object.keys(positions).length} saved positions as edited`);
        }
        
        return { 
            success: true, 
            message: `Marked ${Object.keys(positions).length} saved positions as edited`,
            count: Object.keys(positions).length
        };
        } catch (error) {
        console.error('[UniversalLabelManager] Error marking saved positions as edited:', error);
        return { success: false, message: `Error: ${error.message}`, count: 0 };
        }
    }
  

    /**
     * Set up automatic periodic saving of label positions
     * @private
     */
    _setupAutoSave() {
        // Clear any existing auto-save interval
        if (this.autoSaveInterval) {
        clearInterval(this.autoSaveInterval);
        this.autoSaveInterval = null;
        }
        
        // Set up a new interval for periodic saving
        this.autoSaveInterval = setInterval(() => {
        // Only auto-save if we have active edits
        if (this.hasActiveEdits()) {
            try {
            console.log('[UniversalLabelManager] Auto-saving label positions...');
            const result = this.savePositions(true); // Force localStorage usage
            
            if (result.success) {
                console.log(`[UniversalLabelManager] Auto-saved ${result.count} label positions (${result.totalStored} total stored)`);
            } else {
                console.warn('[UniversalLabelManager] Auto-save failed:', result.message);
            }
            } catch (err) {
            console.error('[UniversalLabelManager] Error during auto-save:', err);
            }
        }
        }, 30000); // Auto-save every 30 seconds
        
        // Add the interval to the list for cleanup
        if (!this.monitorIntervals) {
        this.monitorIntervals = [];
        }
        this.monitorIntervals.push(this.autoSaveInterval);
        
        console.log('[UniversalLabelManager] Automatic label position saving enabled');
    }
    
    /**
     * Check if there are any active edits that need saving
     * @returns {boolean} True if there are active edits
     * @private
     */
    hasActiveEdits() {
        // Check for labels with edits
        for (const labelInfo of this.labelCache.values()) {
        if (!labelInfo.labelGraphic) continue;
        
        // Look for editing flags
        if (labelInfo.labelGraphic.attributes?._isEdited || 
            labelInfo.labelGraphic.attributes?._permanentEdit) {
            return true;
        }
        
        // Look for offset changes (manual positioning)
        if (labelInfo.labelGraphic.symbol && 
            (labelInfo.labelGraphic.symbol.xoffset !== 0 || 
            labelInfo.labelGraphic.symbol.yoffset !== 0)) {
            return true;
        }
        
        // Look for font size changes
        if (labelInfo.originalSymbol && 
            labelInfo.labelGraphic.symbol && 
            labelInfo.labelGraphic.symbol.font && 
            labelInfo.originalSymbol.font && 
            labelInfo.labelGraphic.symbol.font.size !== labelInfo.originalSymbol.font.size) {
            return true;
        }
        
        // Look for text changes
        if (labelInfo.originalSymbol && 
            labelInfo.labelGraphic.symbol && 
            labelInfo.labelGraphic.symbol.text !== labelInfo.originalSymbol.text) {
            return true;
        }
        }
        
        return false;
    }


    /**
     * Add a layer to be managed
     * @param {GraphicsLayer} layer - The layer to manage labels for
     * @private
     */
    _addLayerIfNeeded(layer) {
        // Only track graphics layers
        if (layer.type !== "graphics" || !layer.graphics) return;
        
        // Skip if already tracked
        if (this.layers.has(layer.id)) return;
        
        // Check if this layer has self-managed labels
        const hasSelfManagedLabels = layer.hasLabelGraphics === true;
        
        // Skip if no label tracking or labelability indicators
        const hasLabels = hasSelfManagedLabels || 
                        layer.labelVisibilityTracking || 
                        layer.hasLabelGraphics || 
                        (layer.title && layer.title.includes("Label"));
        
        if (!hasLabels) return;
        
        // Store layer info
        this.layers.set(layer.id, {
        layer,
        title: layer.title || layer.id,
        minZoom: layer.labelVisibilityTracking?.minimumZoom || this.options.labelMinZoom,
        visible: layer.visible && this.currentZoom >= this.options.labelMinZoom,
        labelGraphics: [],
        pointGraphics: [],
        hasSelfManagedLabels: hasSelfManagedLabels
        });
        
        console.log(`[UniversalLabelManager] Now managing labels for layer: ${layer.title || layer.id}`);
        
        // Analyze the layer for label graphics
        this._analyzeLayer(layer);
    }
  

    /**
     * Remove a layer from management
     * @param {GraphicsLayer} layer - The layer to remove
     * @private
     */
    _removeLayer(layer) {
        if (!this.layers.has(layer.id)) return;
        
        // Remove from tracking
        this.layers.delete(layer.id);
        
        // Remove any cached labels for this layer
        for (const [labelId, labelInfo] of this.labelCache.entries()) {
        if (labelInfo.layerId === layer.id) {
            this.labelCache.delete(labelId);
            this.visibleLabels.delete(labelId);
        }
        }
        
        console.log(`[UniversalLabelManager] Stopped managing labels for layer: ${layer.title || layer.id}`);
        
        // Update positions to handle removed labels
        this._throttledUpdateLabelPositions();
    }


    /**
     * Generate a consistent ID for a label graphic
     * This method is critical for ensuring that label IDs match between components
     * @param {Graphic} labelGraphic - The label graphic
     * @param {string} layerId - The layer ID
     * @returns {string} A consistent ID for the label
     * @private
     */
    _generateConsistentLabelId(labelGraphic, layerId) {
        if (!labelGraphic || !labelGraphic.attributes) {
        // Fallback for labels without attributes
        return `${layerId}-label-${Math.random().toString(36).substring(2, 9)}`;
        }
        
        // Use explicit labelId if available (highest priority)
        if (labelGraphic.attributes.labelId) {
        return `${layerId}-explicit-${labelGraphic.attributes.labelId}`;
        }
        
        // Use OBJECTID if available (commonly used for identification)
        if (labelGraphic.attributes.OBJECTID !== undefined) {
        return `${layerId}-oid-${labelGraphic.attributes.OBJECTID}`;
        }
        
        // Check for oid-label-X format
        if (labelGraphic.attributes.parentID !== undefined) {
        return `${layerId}-oid-label-${labelGraphic.attributes.parentID}`;
        }
        
        // Check for uid
        if (labelGraphic.attributes.uid) {
        return `${layerId}-uid-${labelGraphic.attributes.uid}`;
        }
        
        // Use the ArcGIS-provided uid if available
        if (labelGraphic.uid) {
        return `${layerId}-graphic-uid-${labelGraphic.uid}`;
        }
        
        // Fallback to geometry-based ID if available
        if (labelGraphic.geometry) {
        const textPart = (labelGraphic.symbol && labelGraphic.symbol.text) 
            ? labelGraphic.symbol.text.substring(0, 10).replace(/\s+/g, '_') 
            : 'no_text';
        
        return `${layerId}-geom-${labelGraphic.geometry.x?.toFixed(2)}-${labelGraphic.geometry.y?.toFixed(2)}-${textPart}`;
        }
        
        // Final fallback
        return `${layerId}-unknown-${Math.random().toString(36).substring(2, 9)}`;
    }


    /**
     * Analyze a layer to find label graphics and their associated points
     * @param {GraphicsLayer} layer - The layer to analyze
     * @private
     */
    _analyzeLayer(layer) {
        if (!this.layers.has(layer.id)) return;
        
        const layerInfo = this.layers.get(layer.id);
        const labelGraphics = [];
        const pointGraphics = [];
        const parentMap = new Map(); // Map of OBJECTID -> graphic
        const processedLabelIds = new Set(); // Track processed labels to prevent duplicates
        
        // First pass: gather all points and existing labels
        layer.graphics.forEach(graphic => {
        if (!graphic.attributes) return;
        
        // Check if this is a label graphic using multiple criteria
        const isLabel = graphic.attributes.isLabel === true || 
                        (graphic.symbol && graphic.symbol.type === "text") ||
                        graphic.attributes.isLabelGraphic === true;
                        
        if (isLabel) {
            // This is a label graphic
            // Generate a consistent ID for this label
            const labelId = this._generateConsistentLabelId(graphic, layer.id);
            
            // Only add if not already processed (prevents duplicates)
            if (!processedLabelIds.has(labelId)) {
            labelGraphics.push(graphic);
            processedLabelIds.add(labelId);
            }
        } else {
            pointGraphics.push(graphic);
            if (graphic.attributes.OBJECTID !== undefined) {
            parentMap.set(graphic.attributes.OBJECTID, graphic);
            }
        }
        });
        
        // Update layer info with graphics collections
        layerInfo.labelGraphics = labelGraphics;
        layerInfo.pointGraphics = pointGraphics;
        
        // If this layer has self-managed labels, we should process the existing 
        // label graphics, but not create new ones
        if (layerInfo.hasSelfManagedLabels) {
        console.log(`[UniversalLabelManager] Layer ${layer.title || layer.id} has ${labelGraphics.length} self-managed labels.`);
        
        // For self-managed layers, we still need to process existing label graphics
        // so that they can be positioned correctly and managed for zoom levels
        labelGraphics.forEach(labelGraphic => {
            const parentId = labelGraphic.attributes.parentID;
            const parentGraphic = parentId !== undefined ? parentMap.get(parentId) : null;
            
            // Store in cache for positioning (but don't create new graphics)
            const labelId = this._generateConsistentLabelId(labelGraphic, layer.id);
            
            // Ensure we store the complete parent reference
            if (!parentGraphic && parentId && parentMap.has(parentId)) {
            const resolvedParent = parentMap.get(parentId);
            console.log(`[UniversalLabelManager] Resolved parent for label ${labelId}`);
            }
            
            // Check if already in cache to prevent duplicates
            if (!this.labelCache.has(labelId)) {
            this.labelCache.set(labelId, {
                layerId: layer.id,
                labelGraphic,
                parentGraphic: parentGraphic || null,
                parentId,
                priority: this._calculatePriority(labelGraphic, parentGraphic),
                visible: labelGraphic.visible,
                originalSymbol: labelGraphic.symbol ? { ...labelGraphic.symbol.toJSON() } : null,
                processed: false,
                isSelfManaged: true
            });
            
            console.log(`[UniversalLabelManager] Cached self-managed label: ${labelId}`);
            }
        });
        
        return; // Skip creating new label graphics
        }
        
        // For standard layers (not self-managed), create new label graphics as needed
        // Second pass: link labels to points
        labelGraphics.forEach(labelGraphic => {
        const parentId = labelGraphic.attributes.parentID;
        const parentGraphic = parentId !== undefined ? parentMap.get(parentId) : null;
        
        // Skip orphaned labels (no parent)
        if (parentId !== undefined && !parentGraphic) {
            return;
        }
        
        // Store in cache
        const labelId = this._generateConsistentLabelId(labelGraphic, layer.id);
        
        // Check if already in cache to prevent duplicates
        if (!this.labelCache.has(labelId)) {
            this.labelCache.set(labelId, {
            layerId: layer.id,
            labelGraphic,
            parentGraphic,
            parentId,
            priority: this._calculatePriority(labelGraphic, parentGraphic),
            visible: false,
            originalSymbol: labelGraphic.symbol ? { ...labelGraphic.symbol.toJSON() } : null,
            processed: false
            });
        }
        });
        
        console.log(`[UniversalLabelManager] Layer ${layer.title || layer.id} has ${labelGraphics.length} labels and ${pointGraphics.length} points`);
    }

    /**
     * Calculate priority score for a label
     * @param {Graphic} labelGraphic - The label graphic
     * @param {Graphic} parentGraphic - The parent point graphic
     * @returns {number} Priority score (higher is more important)
     * @private
     */
    _calculatePriority(labelGraphic, parentGraphic) {
        if (!labelGraphic || !labelGraphic.attributes) return 0;
        
        let priority = 1;
        
        // Boost priority for attributes matching priorityAttributes
        if (this.options.priorityAttributes.length > 0) {
        for (const attr of this.options.priorityAttributes) {
            // Check label attributes first
            if (labelGraphic.attributes[attr] !== undefined) {
            // If it's a number, use it directly
            if (typeof labelGraphic.attributes[attr] === 'number') {
                priority += labelGraphic.attributes[attr];
            } else {
                priority += 2; // Default boost for non-numeric attributes
            }
            }
            // Then check parent attributes
            else if (parentGraphic && parentGraphic.attributes && parentGraphic.attributes[attr] !== undefined) {
            // If it's a number, use it directly
            if (typeof parentGraphic.attributes[attr] === 'number') {
                priority += parentGraphic.attributes[attr];
            } else {
                priority += 2; // Default boost for non-numeric attributes
            }
            }
        }
        }
        
        // Boost priority for points near current center of view
        if (parentGraphic && parentGraphic.geometry && this.view) {
        const viewCenter = this.view.center;
        const pointLocation = parentGraphic.geometry;
        
        try {
            // Calculate distance in meters
            const distance = Math.sqrt(
            Math.pow(viewCenter.longitude - pointLocation.longitude, 2) + 
            Math.pow(viewCenter.latitude - pointLocation.latitude, 2)
            ) * 111319.9; // Rough conversion to meters
            
            // Boost priority for points close to center
            if (distance < this.options.priorityDistance) {
            priority += 2 * (1 - distance / this.options.priorityDistance);
            }
        } catch (e) {
            // Skip distance calculation if error
        }
        }
        
        // Add a small random factor to break ties consistently
        priority += Math.random() * 0.1;
        
        return priority;
    }

    /**
     * Hide all labels
     * @private
     */
    _hideAllLabels() {
        for (const [labelId, labelInfo] of this.labelCache.entries()) {
        if (labelInfo.labelGraphic) {
            labelInfo.labelGraphic.visible = false;
            labelInfo.visible = false;
        }
        }
        
        this.visibleLabels.clear();
        this.labelBoxes = [];
        
        // Clear debug graphics
        if (this.options.debugMode && this.debugLayer) {
        this.debugLayer.removeAll();
        }
        
        console.log("[UniversalLabelManager] All labels hidden");
    }

    /**
     * Gets the text content from a label graphic
     * @param {Graphic} labelGraphic - The label graphic
     * @returns {string} The text content of the label
     * @private
     */
    _getTextFromLabel(labelGraphic) {
        if (!labelGraphic) return "";
        
        // Try to get from symbol first
        if (labelGraphic.symbol && labelGraphic.symbol.text) {
        return labelGraphic.symbol.text;
        }
        
        // Try to get from attributes
        if (labelGraphic.attributes) {
        if (labelGraphic.attributes.labelText) {
            return labelGraphic.attributes.labelText;
        }
        if (labelGraphic.attributes.LABEL) {
            return labelGraphic.attributes.LABEL;
        }
        if (labelGraphic.attributes.NAME) {
            return labelGraphic.attributes.NAME;
        }
        }
        
        return "";
    }

    /**
     * Find this method in UniversalLabelManager.js and update it to ensure
     * only one label is created per point
     */
    fixDuplicateLabels() {
        if (!this.view || !this.view.map) {
        console.error("[UniversalLabelManager] Map view not available for fixing duplicates");
        return () => {};
        }
        
        console.log("[UniversalLabelManager] Starting duplicate label detection and cleanup");
        
        // Step 1: Find all layers with label graphics
        const layers = this.view.map.layers.toArray().filter(layer => 
        layer && layer.graphics && layer.type === "graphics"
        );
        
        console.log(`[UniversalLabelManager] Found ${layers.length} graphics layers to process`);
        
        // Process each layer to identify and fix duplicates
        layers.forEach(layer => {
        // Create a registry of points and their labels
        const pointRegistry = new Map();
        const pointLocations = new Map();
        const duplicateLabels = [];
        const editedLabels = new Map(); // Track manually edited labels
        
        // First pass: identify points and their labels
        layer.graphics.forEach(graphic => {
            if (!graphic.attributes) return;
            
            // IMPORTANT: Skip graphics that don't have isLabel attribute
            // This ensures we only process actual label graphics
            if (graphic.attributes.isLabel) {
            // This is a label graphic
            const parentId = graphic.attributes.parentID;
            if (!parentId) return;
            
            // Check if this is a manually edited label
            if (graphic.attributes._isEdited === true) {
                // If it's been edited, we want to prioritize this one
                if (!editedLabels.has(parentId)) {
                    editedLabels.set(parentId, []);
                }
                editedLabels.get(parentId).push(graphic);
            }
            
            // Track this label with its parent point
            if (!pointRegistry.has(parentId)) {
                pointRegistry.set(parentId, []);
            }
            pointRegistry.get(parentId).push(graphic);
            } else {
            // This is a regular point/feature graphic
            const objectId = graphic.attributes.OBJECTID || graphic.uid;
            if (objectId) {
                // Store the point location for distance calculations
                if (graphic.geometry) {
                pointLocations.set(objectId, graphic.geometry);
                }
            }
            }
        });
        
        // Second pass: identify duplicates and mark best label for each point
        pointRegistry.forEach((labels, pointId) => {
            if (labels.length <= 1) return; // No duplicates for this point
            
            console.log(`[UniversalLabelManager] Point ${pointId} has ${labels.length} labels - marking duplicates for removal`);
            
            // First check if there are any edited labels for this point
            const editedPointLabels = editedLabels.get(pointId) || [];
            let bestLabel = null;
            
            if (editedPointLabels.length > 0) {
                // Prioritize the most recently edited label (assume it's the last one)
                bestLabel = editedPointLabels[editedPointLabels.length - 1];
                console.log(`[UniversalLabelManager] Using edited label as primary for point ${pointId}`);
            } else {
                // No edited labels, find the best label based on scoring
                let bestScore = -Infinity;
                
                // Score each label
                labels.forEach(label => {
                    // Calculate score based on:
                    // 1. Priority attribute if present
                    // 2. Distance to parent point if available
                    // 3. Text quality/length
                    let score = 0;
                    
                    // Priority attribute boost
                    if (label.attributes.priority) {
                        score += Number(label.attributes.priority) || 0;
                    }
                    
                    // Text quality - prefer non-empty text that isn't excessively long
                    const labelText = this._getTextFromLabel(label);
                    if (labelText && labelText.length > 0) {
                        score += 5; // Base score for having text
                        if (labelText.length < 30) {
                        score += 3; // Bonus for reasonable length
                        }
                    }
                    
                    // Distance to parent point (if we have locations)
                    const pointLocation = pointLocations.get(pointId);
                    if (pointLocation && label.geometry) {
                        try {
                        // Calculate rough distance
                        const dx = pointLocation.x - label.geometry.x;
                        const dy = pointLocation.y - label.geometry.y;
                        const distance = Math.sqrt(dx*dx + dy*dy);
                        
                        // Closer labels get higher scores (inverse relationship)
                        score += 10 / (distance + 1);
                        } catch (e) {
                        // Skip distance calculation on error
                        }
                    }
                    
                    // Update best label if this one has a higher score
                    if (score > bestScore) {
                        bestScore = score;
                        bestLabel = label;
                    }
                });
            }
            
            // Mark all non-best labels as duplicates to hide
            labels.forEach(label => {
                if (label !== bestLabel) {
                    duplicateLabels.push(label);
                }
            });
        });
        
        // Third pass: hide duplicate labels
        if (duplicateLabels.length > 0) {
            console.log(`[UniversalLabelManager] Hiding ${duplicateLabels.length} duplicate labels in layer "${layer.title || layer.id}"`);
            
            duplicateLabels.forEach(label => {
                // Hide the duplicate label
                label.visible = false;
                
                // Mark it so it doesn't get reshown by other systems
                label.attributes._isDuplicate = true;
            });
        }
        });
        
        console.log("[UniversalLabelManager] Duplicate label cleanup complete");
        
        // Return a monitoring function that will continue to keep duplicates hidden
        return this._monitorLabelUpdates();
    }

    /**
     * Monitors label updates to ensure duplicates stay hidden
     * @returns {Function} A cleanup function to stop monitoring
     * @private
     */
    _monitorLabelUpdates() {
        // Watch for label manager updates and re-hide duplicates
        const intervalId = setInterval(() => {
        if (!this.view || !this.view.map) return;
        
        // Track stats for logging
        let hiddenCount = 0;
        const processedLayers = new Set();
        
        this.view.map.layers.forEach(layer => {
            if (layer && layer.graphics) {
            // Track this layer for logging
            processedLayers.add(layer.id || layer.title);
            
            // Create a map of edited labels by parent ID for faster lookup
            const editedLabelsByParent = new Map();
            
            // First pass: Find all edited labels
            layer.graphics.forEach(graphic => {
                if (graphic.attributes && 
                    graphic.attributes.isLabel && 
                    graphic.attributes._isEdited === true && 
                    graphic.attributes.parentID) {
                
                const parentId = graphic.attributes.parentID;
                if (!editedLabelsByParent.has(parentId)) {
                    editedLabelsByParent.set(parentId, []);
                }
                editedLabelsByParent.get(parentId).push(graphic);
                }
            });
            
            // Second pass: Process all labels
            layer.graphics.forEach(graphic => {
                // Check for duplicates to hide
                if (graphic.attributes && graphic.attributes.isLabel) {
                // Duplicate detection and handling
                if (graphic.attributes._isDuplicate) {
                    // This is a known duplicate - keep it hidden
                    if (graphic.visible) {
                    graphic.visible = false;
                    hiddenCount++;
                    }
                } 
                // Check for parent ID conflicts with edited labels
                else if (graphic.attributes.parentID) {
                    const parentId = graphic.attributes.parentID;
                    const editedLabelsForParent = editedLabelsByParent.get(parentId) || [];
                    
                    // If there are edited labels for this parent
                    if (editedLabelsForParent.length > 0) {
                    // If this is not one of the edited labels, hide it
                    const isEdited = editedLabelsForParent.includes(graphic);
                    
                    if (!isEdited && graphic.visible) {
                        graphic.visible = false;
                        graphic.attributes._isDuplicate = true;
                        hiddenCount++;
                    }
                    }
                }
                }
            });
            }
        });
        
        // Log stats if we actually hid any duplicates
        if (hiddenCount > 0) {
            console.log(`[UniversalLabelManager] Monitor: Re-hid ${hiddenCount} duplicated labels across ${processedLayers.size} layers`);
        }
        }, 1000); // Check every second
        
        // Store interval ID for cleanup
        if (!this.monitorIntervals) {
        this.monitorIntervals = [];
        }
        this.monitorIntervals.push(intervalId);
        
        // Return cleanup function
        return () => {
        clearInterval(intervalId);
        const index = this.monitorIntervals.indexOf(intervalId);
        if (index !== -1) {
            this.monitorIntervals.splice(index, 1);
        }
        };
    }

/**
 * Update label positions with collision avoidance
 * @private
 */
_updateLabelPositions() {
    if (this.updateInProgress || this.currentZoom < this.options.labelMinZoom) return;
    
    this.updateInProgress = true;
    
    try {
      // Start with a clean slate
      this.labelBoxes = [];
      this.processedLabels.clear();
      
      // If debug mode, clear previous debug graphics
      if (this.options.debugMode && this.debugLayer) {
        this.debugLayer.removeAll();
      }
      
      // Get viewport dimensions
      const viewportWidth = this.view.width;
      const viewportHeight = this.view.height;
      
      // Initialize spatial grid if density awareness is enabled
      if (this.options.densityAware) {
        this._initSpatialGrid(viewportWidth, viewportHeight);
      }
      
      // Prepare processing pipeline
      const labelCandidates = [];
      
      // Group labels by layer and check visibility
      for (const [layerId, layerInfo] of this.layers.entries()) {
        // Skip invisible layers
        if (!layerInfo.layer.visible) continue;
        
        // Skip layers below min zoom
        const minZoom = layerInfo.minZoom;
        if (this.currentZoom < minZoom) continue;
        
        // Special handling for layers with self-managed labels
        if (layerInfo.hasSelfManagedLabels) {
          // For self-managed layers, find all existing label graphics and update their visibility
          let selfManagedCount = 0;
          
          for (const [labelId, labelInfo] of this.labelCache.entries()) {
            if (labelInfo.layerId !== layerId || !labelInfo.isSelfManaged) continue;
            
            const { labelGraphic } = labelInfo;
            if (!labelGraphic || !labelGraphic.geometry) continue;
            
            // Convert point to screen coordinates to check if on-screen
            const screenPoint = this.view.toScreen(labelGraphic.geometry);
            
            // Only update visibility based on zoom level and on-screen status
            const isOnScreen = screenPoint && 
                              screenPoint.x >= 0 && screenPoint.y >= 0 && 
                              screenPoint.x <= viewportWidth && screenPoint.y <= viewportHeight;
            
            // Update visibility based on zoom level and on-screen status
            if (labelGraphic.attributes?.visible !== false) { // Respect explicit visibility attribute
              labelGraphic.visible = this.currentZoom >= minZoom && isOnScreen;
              
              if (labelGraphic.visible) {
                selfManagedCount++;
                this.visibleLabels.add(labelId);
              } else {
                this.visibleLabels.delete(labelId);
              }
            }
          }
          
          console.log(`[UniversalLabelManager] Updated ${selfManagedCount} self-managed labels for layer: ${layerInfo.title}`);
          continue; // Continue to next layer - no need for positioning
        }
        
        // Standard handling for layers that don't manage their own labels
        // Find all label graphics that belong to this layer
        for (const [labelId, labelInfo] of this.labelCache.entries()) {
          if (labelInfo.layerId !== layerId) continue;
          
          // Skip if already processed in this update cycle
          if (this.processedLabels.has(labelId)) continue;
          this.processedLabels.add(labelId);
          
          const { labelGraphic, parentGraphic, priority } = labelInfo;
          
          // Skip if no parent graphic or if label has no geometry
          if (!labelGraphic || !labelGraphic.geometry) continue;
          
          // Convert point to screen coordinates
          const screenPoint = this.view.toScreen(labelGraphic.geometry);
          
          // Skip if off-screen
          if (!screenPoint || screenPoint.x < 0 || screenPoint.y < 0 || 
              screenPoint.x > viewportWidth || screenPoint.y > viewportHeight) {
            // Hide label
            labelGraphic.visible = false;
            labelInfo.visible = false;
            this.visibleLabels.delete(labelId);
            continue;
          }
          
          // Calculate label text and dimensions
          const labelText = this._getTextFromLabel(labelGraphic);
          if (!labelText) continue;
          
          const fontSize = this._calculateFontSize();
          
          // Estimate label dimensions
          const labelWidth = labelText.length * fontSize * 0.6;
          const labelHeight = fontSize * 1.2;
          
          // Add to grid for density awareness if enabled
          let densityScore = 1;
          let clusterId = null;
          
          if (this.options.densityAware && this.options.useSpatialClustering) {
            const cell = this._addToSpatialGrid(screenPoint.x, screenPoint.y, labelId, priority);
            densityScore = this._calculateDensityScore(cell);
            clusterId = cell;
          }
          
          // Add to candidates
          labelCandidates.push({
            id: labelId,
            labelInfo,
            screenPoint,
            labelText,
            fontSize,
            width: labelWidth,
            height: labelHeight,
            priority: priority,
            densityScore: densityScore,
            clusterId: clusterId
          });
        }
      }
      
      // If we have density awareness enabled, adjust priorities based on density
      if (this.options.densityAware) {
        this._adjustPrioritiesForDensity(labelCandidates);
      }
      
      console.log(`[UniversalLabelManager] Processing ${labelCandidates.length} label candidates`);
      
      // No candidates to process
      if (labelCandidates.length === 0) {
        console.log(`[UniversalLabelManager] No label candidates to process`);
        this.updateInProgress = false;
        return;
      }
      
      // Sort candidates by priority (highest first)
      labelCandidates.sort((a, b) => b.priority - a.priority);
      
      // Apply limit to max visible labels
      const maxLabels = Math.min(this.options.maxLabelsVisible, labelCandidates.length);
      const candidatesToProcess = labelCandidates.slice(0, maxLabels);
      
      console.log(`[UniversalLabelManager] Processing ${candidatesToProcess.length} label candidates out of ${labelCandidates.length} total`);
      
      // Process candidates based on selected strategy
      if (this.options.layoutStrategy === 'advanced') {
        this._applyAdvancedLayout(candidatesToProcess);
      } else if (this.options.layoutStrategy === 'high-quality') {
        this._applyHighQualityLayout(candidatesToProcess);
      } else if (this.options.layoutStrategy === 'balanced') {
        // Balanced is a variant of advanced with different parameters
        const savedMaxDistance = this.options.maxLabelDistance;
        this.options.maxLabelDistance = Math.min(savedMaxDistance, 40); // Tighter distance constraint
        this._applyAdvancedLayout(candidatesToProcess);
        this.options.maxLabelDistance = savedMaxDistance; // Restore original value
      } else {
        // Default to simple algorithm
        this._applySimpleLayout(candidatesToProcess);
      }
      
      // Update visibility flag in cache
      for (const candidate of candidatesToProcess) {
        const { id, labelInfo } = candidate;
        if (labelInfo.labelGraphic.visible) {
          this.visibleLabels.add(id);
        } else {
          this.visibleLabels.delete(id);
        }
      }
      
      // Display count of visible labels
      console.log(`[UniversalLabelManager] Showing ${this.visibleLabels.size} labels after positioning`);
    } catch (error) {
      console.error("[UniversalLabelManager] Error updating label positions:", error);
    } finally {
      this.updateInProgress = false;
    }
  }

  /**
   * Initialize spatial grid for density tracking
   * @param {number} width - Viewport width
   * @param {number} height - Viewport height
   * @private
   */
  _initSpatialGrid(width, height) {
    this.viewportGrid = {};
    
    // Calculate grid cell size based on cluster distance
    const cellSize = this.options.clusterDistance;
    const columns = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);
    
    // Initialize all grid cells
    for (let x = 0; x < columns; x++) {
      for (let y = 0; y < rows; y++) {
        const cellKey = `${x},${y}`;
        this.viewportGrid[cellKey] = {
          count: 0,
          points: [],
          totalPriority: 0
        };
      }
    }
  }

  /**
   * Add a point to the spatial grid
   * @param {number} x - Screen x coordinate
   * @param {number} y - Screen y coordinate
   * @param {string} id - Point ID
   * @param {number} priority - Point priority
   * @returns {string} Cell key
   * @private
   */
  _addToSpatialGrid(x, y, id, priority) {
    const cellSize = this.options.clusterDistance;
    const cellX = Math.floor(x / cellSize);
    const cellY = Math.floor(y / cellSize);
    const cellKey = `${cellX},${cellY}`;
    
    // Create cell if it doesn't exist
    if (!this.viewportGrid[cellKey]) {
      this.viewportGrid[cellKey] = {
        count: 0,
        points: [],
        totalPriority: 0
      };
    }
    
    // Add to cell
    this.viewportGrid[cellKey].count++;
    this.viewportGrid[cellKey].points.push({
      id,
      x,
      y,
      priority
    });
    this.viewportGrid[cellKey].totalPriority += priority;
    
    return cellKey;
  }

  /**
   * Calculate density score for a grid cell
   * @param {string} cellKey - Cell key
   * @returns {number} Density score
   * @private
   */
  _calculateDensityScore(cellKey) {
    if (!this.viewportGrid[cellKey]) return 1;
    
    const cell = this.viewportGrid[cellKey];
    
    // Get neighbor cells
    const [cellX, cellY] = cellKey.split(',').map(Number);
    const neighborKeys = this._getNeighborCellKeys(cellX, cellY);
    
    // Calculate total density including neighbors
    let totalPoints = cell.count;
    
    neighborKeys.forEach(neighborKey => {
      if (this.viewportGrid[neighborKey]) {
        totalPoints += this.viewportGrid[neighborKey].count;
      }
    });
    
    // Return a normalized score where higher density = lower score
    return 1 / Math.max(1, Math.log(totalPoints + 1));
  }

  /**
   * Get keys of neighboring cells
   * @param {number} cellX - Cell X coordinate
   * @param {number} cellY - Cell Y coordinate
   * @returns {Array<string>} Array of cell keys
   * @private
   */
  _getNeighborCellKeys(cellX, cellY) {
    const neighbors = [];
    
    // Include 8 surrounding cells
    for (let x = cellX - 1; x <= cellX + 1; x++) {
      for (let y = cellY - 1; y <= cellY + 1; y++) {
        // Skip self
        if (x === cellX && y === cellY) continue;
        
        neighbors.push(`${x},${y}`);
      }
    }
    
    return neighbors;
  }

  /**
   * Adjust candidate priorities based on density
   * @param {Array} candidates - Label candidates
   * @private
   */
  _adjustPrioritiesForDensity(candidates) {
    // Skip if no density awareness
    if (!this.options.densityAware) return;
    
    // Track which clusters have been processed
    const processedClusters = new Set();
    
    candidates.forEach(candidate => {
      const { clusterId, densityScore } = candidate;
      
      if (!clusterId) return;
      
      // Apply density score to priority
      candidate.priority *= densityScore;
      
      // Track cluster representative (first candidate in each cluster)
      if (!processedClusters.has(clusterId)) {
        // First label in cluster gets priority boost
        candidate.priority *= 1.5;
        processedClusters.add(clusterId);
      }
    });
  }

  /**
   * Calculate font size based on zoom level
   * @returns {number} Font size in pixels
   * @private
   */
  _calculateFontSize() {
    const [minSize, maxSize] = this.options.fontSizeRange;
    const minZoom = this.options.labelMinZoom;
    const maxZoom = 18; // Typical max zoom
    
    // Linear interpolation based on zoom level
    const zoomFactor = Math.min(1, Math.max(0, (this.currentZoom - minZoom) / (maxZoom - minZoom)));
    const fontSize = minSize + zoomFactor * (maxSize - minSize);
    
    return Math.round(fontSize);
  }

  /**
   * Check if two label boxes overlap
   * @param {Object} box1 - First box {x, y, width, height}
   * @param {Object} box2 - Second box {x, y, width, height}
   * @returns {boolean} True if boxes overlap
   * @private
   */
  _checkOverlap(box1, box2) {
    const padding = this.options.padding;
    
    return !(
      box1.x + box1.width + padding < box2.x - padding ||
      box2.x + box2.width + padding < box1.x - padding ||
      box1.y + box1.height + padding < box2.y - padding ||
      box2.y + box2.height + padding < box1.y - padding
    );
  }

  /**
   * Calculate distance between two boxes
   * @param {Object} box1 - First box {x, y, width, height}
   * @param {Object} box2 - Second box {x, y, width, height}
   * @returns {number} Distance between box centers
   * @private
   */
  _calculateDistance(box1, box2) {
    const center1 = {
      x: box1.x + box1.width / 2,
      y: box1.y + box1.height / 2
    };
    
    const center2 = {
      x: box2.x + box2.width / 2,
      y: box2.y + box2.height / 2
    };
    
    return Math.sqrt(
      Math.pow(center1.x - center2.x, 2) + 
      Math.pow(center1.y - center2.y, 2)
    );
  }

  /**
   * Apply simple layout algorithm (fastest)
   * @param {Array} candidates - Label candidates to position
   * @private
   */
  _applySimpleLayout(candidates) {
    const padding = this.options.padding;
    const minDistance = this.options.minDistanceBetweenLabels;
    
    // Get placement preferences from options or use default placements
    const positionPreferences = this.options.labelPlacementPreference || [
      "top", "right", "bottom", "left", 
      "top-right", "bottom-right", "bottom-left", "top-left"
    ];

    // Map preference names to position vectors
    const positionVectors = {
      "top": {x: 0, y: -1},
      "right": {x: 1, y: 0},
      "bottom": {x: 0, y: 1},
      "left": {x: -1, y: 0},
      "top-right": {x: 1, y: -1},
      "bottom-right": {x: 1, y: 1},
      "bottom-left": {x: -1, y: 1},
      "top-left": {x: -1, y: -1}
    };

    // Create ordered positions array based on preferences
    const positions = positionPreferences.map(pref => positionVectors[pref]).filter(p => p); // Filter out any undefined positions
    
    // Fall back to default positions if none were valid
    if (positions.length === 0) {
      positions.push(
        {x: 0, y: -1},     // Top
        {x: 1, y: 0},      // Right
        {x: 0, y: 1},      // Bottom
        {x: -1, y: 0},     // Left
        {x: 1, y: -1},     // Top-right
        {x: 1, y: 1},      // Bottom-right
        {x: -1, y: 1},     // Bottom-left
        {x: -1, y: -1}     // Top-left
      );
    }
    
    for (const candidate of candidates) {
      const { labelInfo, screenPoint, width, height, fontSize } = candidate;
      
      // Start with hiding the label
      labelInfo.labelGraphic.visible = false;
      labelInfo.visible = false;
      
      // Try each position until we find one without overlap
      let placed = false;
      let bestPosition = null;
      let minOverlaps = Infinity;
      
      for (let i = 0; i < positions.length && !placed; i++) {
        const pos = positions[i];
        
        // Calculate label box position
        const labelBox = {
          x: screenPoint.x + pos.x * (fontSize + padding),
          y: screenPoint.y + pos.y * (fontSize + padding),
          width: width,
          height: height,
          position: i
        };
        
        // Center the label on the position
        labelBox.x -= (pos.x === 0) ? (width / 2) : (pos.x > 0 ? 0 : width);
        labelBox.y -= (pos.y === 0) ? (height / 2) : (pos.y > 0 ? 0 : height);
        
        // Check for viewport boundaries
        if (
          labelBox.x < padding || 
          labelBox.y < padding || 
          labelBox.x + labelBox.width > this.view.width - padding ||
          labelBox.y + labelBox.height > this.view.height - padding
        ) {
          continue; // Skip positions outside viewport
        }
        
        // Count overlaps with existing labels
        let overlaps = 0;
        let tooClose = false;
        
        for (const box of this.labelBoxes) {
          if (this._checkOverlap(labelBox, box)) {
            overlaps++;
          } else {
            // Check if too close to existing label (but not overlapping)
            const distance = this._calculateDistance(labelBox, box);
            if (distance < minDistance) {
              tooClose = true;
              break;
            }
          }
        }
        
        // If no overlaps and not too close, we can place here
        if (overlaps === 0 && !tooClose) {
          placed = true;
          bestPosition = labelBox;
          break;
        }
        
        // Track position with minimum overlaps
        if (overlaps < minOverlaps && !tooClose) {
          minOverlaps = overlaps;
          bestPosition = labelBox;
        }
      }
      
      // If we found a position with no overlaps, place the label
      // Or allow minimal overlap if strict prevention is disabled
      if (placed || (bestPosition && (!this.options.preventLabelOverlap || minOverlaps < 2))) {
        // Use best position (either non-overlapping or minimal overlap)
        const posToUse = bestPosition;
        
        // Apply label text transformation if needed
        let transformedText = candidate.labelText;
        if (this.options.textTransform !== 'none') {
          if (this.options.textTransform === 'uppercase') {
            transformedText = transformedText.toUpperCase();
          } else if (this.options.textTransform === 'lowercase') {
            transformedText = transformedText.toLowerCase();
          } else if (this.options.textTransform === 'capitalize') {
            transformedText = transformedText.replace(/\b\w/g, l => l.toUpperCase());
          }
        }
        
        // Create text symbol with correct offset
        const originalSymbol = labelInfo.originalSymbol || {};
        const textSymbol = new TextSymbol({
          text: transformedText,
          font: {
            size: fontSize,
            family: originalSymbol.font?.family || "sans-serif",
            weight: originalSymbol.font?.weight || "normal"
          },
          color: new Color(originalSymbol.color || [0, 0, 0, this.options.labelOpacity]),
          haloColor: new Color(this.options.haloColor),
          haloSize: this.options.haloSize,
          // Calculate exact offset in pixels based on the screen position
          xoffset: posToUse.x + posToUse.width/2 - screenPoint.x,
          yoffset: posToUse.y + posToUse.height/2 - screenPoint.y
        });
        
        // Apply the symbol
        labelInfo.labelGraphic.symbol = textSymbol;
        
        // Show the label
        labelInfo.labelGraphic.visible = true;
        labelInfo.visible = true;
        
        // Add to occupied boxes
        this.labelBoxes.push(posToUse);
        
        // Add debug visualization if enabled
        if (this.options.debugMode && this.debugLayer) {
          this._addDebugGraphic(posToUse, placed);
        }
      }
    }
  }

  /**
   * Apply advanced layout algorithm (balanced quality/speed)
   * @param {Array} candidates - Label candidates to position
   * @private
   */
  _applyAdvancedLayout(candidates) {
    // Start with simple layout as the initial placement
    this._applySimpleLayout(candidates);
    
    // Skip force-directed refinement if too few labels
    if (candidates.length < 5) return;
    
    // Make a deep copy of current label positions
    const labelPositions = this.labelBoxes.map(box => ({ ...box }));
    
    // Parameters for force-directed layout
    const iterations = 10;
    const padding = this.options.padding;
    const minDistance = this.options.minDistanceBetweenLabels;
    
    // Force constants
    const repulsionStrength = 800;
    const springStrength = 0.15;
    const dampingFactor = 0.7;
    const borderRepulsionStrength = 1500;
    
    // Max distance constraint
    const maxLabelDistance = Math.min(
      this.options.maxLabelDistance,
      this.options.maxLabelDistanceFromPoint || 70
    );
    
    // Prepare mapping from position index to candidate
    const positionToCandidateMap = new Map();
    candidates.forEach((candidate, index) => {
      if (index < labelPositions.length) {
        positionToCandidateMap.set(index, candidate);
      }
    });
    
    // Run multiple iterations of force direction
    for (let iter = 0; iter < iterations; iter++) {
      // Initialize forces for each label
      const forces = labelPositions.map(() => ({ x: 0, y: 0 }));
      
      // Calculate repulsive forces between labels
      for (let i = 0; i < labelPositions.length; i++) {
        const pos1 = labelPositions[i];
        const candidate = positionToCandidateMap.get(i);
        if (!candidate) continue;
        
        const center1 = {
          x: pos1.x + pos1.width / 2,
          y: pos1.y + pos1.height / 2
        };
        
        // Original point position
        const originalPoint = candidate.screenPoint;
        
        // Repulsion from other labels
        for (let j = 0; j < labelPositions.length; j++) {
          if (i === j) continue;
          
          const pos2 = labelPositions[j];
          const center2 = {
            x: pos2.x + pos2.width / 2,
            y: pos2.y + pos2.height / 2
          };
          
          // Vector from j to i
          const dx = center1.x - center2.x;
          const dy = center1.y - center2.y;
          
          // Distance between centers (with minimum to prevent division by zero)
          const distance = Math.max(0.1, Math.sqrt(dx * dx + dy * dy));
          
          // Check if too close
          if (distance < minDistance * 1.5) {
            // Direction vector
            const nx = dx / distance;
            const ny = dy / distance;
            
            // Force magnitude (stronger at close distances)
            const forceMagnitude = repulsionStrength / (distance * distance);
            
            // Apply repulsive force
            forces[i].x += nx * forceMagnitude;
            forces[i].y += ny * forceMagnitude;
          }
        }
        
        // Repulsion from viewport borders to keep labels in view
        const border = padding * 2;
        const rightBorder = this.view.width - border - pos1.width;
        const bottomBorder = this.view.height - border - pos1.height;
        
        // Left border
        if (pos1.x < border) {
          forces[i].x += borderRepulsionStrength / (pos1.x + 0.1);
        }
        
        // Right border
        if (pos1.x > rightBorder) {
          forces[i].x -= borderRepulsionStrength / (rightBorder - pos1.x + 0.1);
        }
        
        // Top border
        if (pos1.y < border) {
          forces[i].y += borderRepulsionStrength / (pos1.y + 0.1);
        }
        
        // Bottom border
        if (pos1.y > bottomBorder) {
          forces[i].y -= borderRepulsionStrength / (bottomBorder - pos1.y + 0.1);
        }
        
        // Enhanced spring force to keep label near its original point
        const springDx = originalPoint.x - center1.x;
        const springDy = originalPoint.y - center1.y;
        const springDistance = Math.sqrt(springDx * springDx + springDy * springDy);
        
        // Stronger spring force based on distance (farther = stronger pull)
        let adjustedSpringStrength = springStrength;
        
        // Exponentially increase spring strength as distance increases
        if (springDistance > maxLabelDistance * 0.5) {
          const distanceFactor = Math.min(3, Math.pow(springDistance / (maxLabelDistance * 0.5), 2));
          adjustedSpringStrength *= distanceFactor;
        }
        
        if (springDistance > 0) {
          const springForceMagnitude = springDistance * adjustedSpringStrength;
          forces[i].x += (springDx / springDistance) * springForceMagnitude;
          forces[i].y += (springDy / springDistance) * springForceMagnitude;
        }
        
        // Add additional repulsion from the point itself to prevent overlap
        const pointDistance = Math.sqrt(
          Math.pow(originalPoint.x - center1.x, 2) + 
          Math.pow(originalPoint.y - center1.y, 2)
        );
        
        const minPointDistance = 15; // Minimum distance from point
        
        if (pointDistance < minPointDistance) {
          const pointRepulsionStrength = 200;
          const pnx = (center1.x - originalPoint.x) / Math.max(0.1, pointDistance);
          const pny = (center1.y - originalPoint.y) / Math.max(0.1, pointDistance);
          const pointRepulsionMagnitude = pointRepulsionStrength * (1 - pointDistance / minPointDistance);
          
          forces[i].x += pnx * pointRepulsionMagnitude;
          forces[i].y += pny * pointRepulsionMagnitude;
        }
      }
      
      // Apply forces to positions with damping that decreases over iterations
      const iterationDamping = dampingFactor * (1 - iter / iterations);
      
      for (let i = 0; i < labelPositions.length; i++) {
        const candidate = positionToCandidateMap.get(i);
        if (!candidate) continue;
        
        const originalPoint = candidate.screenPoint;
        
        // Apply dampened forces
        labelPositions[i].x += forces[i].x * iterationDamping;
        labelPositions[i].y += forces[i].y * iterationDamping;
        
        // Enforce maximum distance constraint
        const centerX = labelPositions[i].x + labelPositions[i].width / 2;
        const centerY = labelPositions[i].y + labelPositions[i].height / 2;
        
        const currentDistance = Math.sqrt(
          Math.pow(centerX - originalPoint.x, 2) + 
          Math.pow(centerY - originalPoint.y, 2)
        );
        
        if (currentDistance > maxLabelDistance) {
          // Scale back to max distance
          const scale = maxLabelDistance / currentDistance;
          const vectorX = centerX - originalPoint.x;
          const vectorY = centerY - originalPoint.y;
          
          // New center position
          const newCenterX = originalPoint.x + vectorX * scale;
          const newCenterY = originalPoint.y + vectorY * scale;
          
          // Update label box position
          labelPositions[i].x = newCenterX - labelPositions[i].width / 2;
          labelPositions[i].y = newCenterY - labelPositions[i].height / 2;
        }
        
        // Keep labels within viewport bounds
        const pos = labelPositions[i];
        pos.x = Math.max(padding, Math.min(this.view.width - pos.width - padding, pos.x));
        pos.y = Math.max(padding, Math.min(this.view.height - pos.height - padding, pos.y));
      }
    }
    
    // Apply the refined positions to labels
    for (let i = 0; i < candidates.length && i < labelPositions.length; i++) {
      const candidate = candidates[i];
      if (!candidate.labelInfo.visible) continue;
      
      const labelInfo = candidate.labelInfo;
      const screenPoint = candidate.screenPoint;
      const newPosition = labelPositions[i];
      
      // Skip if no valid position
      if (!newPosition) continue;
      
      // Calculate center of the label box
      const centerX = newPosition.x + newPosition.width / 2;
      const centerY = newPosition.y + newPosition.height / 2;
      
      // Apply label text transformation if needed
      let transformedText = candidate.labelText;
      if (this.options.textTransform !== 'none') {
        if (this.options.textTransform === 'uppercase') {
          transformedText = transformedText.toUpperCase();
        } else if (this.options.textTransform === 'lowercase') {
          transformedText = transformedText.toLowerCase();
        } else if (this.options.textTransform === 'capitalize') {
          transformedText = transformedText.replace(/\b\w/g, l => l.toUpperCase());
        }
      }
      
      // Create new symbol with updated offsets
      const originalSymbol = labelInfo.originalSymbol || {};
      const textSymbol = new TextSymbol({
        text: transformedText,
        font: {
          size: candidate.fontSize,
          family: originalSymbol.font?.family || "sans-serif",
          weight: originalSymbol.font?.weight || "normal"
        },
        color: new Color(originalSymbol.color || [0, 0, 0, this.options.labelOpacity]),
        haloColor: new Color(this.options.haloColor),
        haloSize: this.options.haloSize,
        // Calculate exact offset in pixels based on the screen position
        xoffset: centerX - screenPoint.x,
        yoffset: centerY - screenPoint.y
      });
      
      // Apply the symbol with new offset
      labelInfo.labelGraphic.symbol = textSymbol;
      
      // Update debug visualization if enabled
      if (this.options.debugMode && this.debugLayer) {
        this._updateDebugGraphic(i, newPosition, true);
      }
    }
    
    // Update the labelBoxes array with refined positions
    this.labelBoxes = labelPositions;
  }

  /**
   * Apply high-quality layout algorithm (slowest but best quality)
   * @param {Array} candidates - Label candidates to position
   * @private
   */
  _applyHighQualityLayout(candidates) {
    // Start with advanced layout
    this._applyAdvancedLayout(candidates);
    
    // Skip for small label sets
    if (candidates.length < 10) return;
    
    // Make a deep copy of current label positions
    const labelPositions = this.labelBoxes.map(box => ({ ...box }));
    
    // Simulated annealing parameters
    const maxTemperature = 100;
    const minTemperature = 0.1;
    const coolingRate = 0.95;
    const iterations = 20;
    
    // Track best state
    let bestState = [...labelPositions];
    let bestEnergy = this._calculateLayoutEnergy(labelPositions);
    
    // Current state
    let currentState = [...labelPositions];
    let currentEnergy = bestEnergy;
    
    // Temperature initialization
    let temperature = maxTemperature;
    
    // Simulated annealing process
    while (temperature > minTemperature) {
      for (let i = 0; i < iterations; i++) {
        // Generate neighbor state
        const neighborState = this._generateNeighborState(currentState);
        
        // Calculate energy of neighbor
        const neighborEnergy = this._calculateLayoutEnergy(neighborState);
        
        // Decide whether to accept new state
        const acceptanceProbability = this._calculateAcceptanceProbability(
          currentEnergy, neighborEnergy, temperature
        );
        
        if (Math.random() < acceptanceProbability) {
          // Accept new state
          currentState = neighborState;
          currentEnergy = neighborEnergy;
          
          // Update best state if better
          if (neighborEnergy < bestEnergy) {
            bestState = [...neighborState];
            bestEnergy = neighborEnergy;
          }
        }
      }
      
      // Cool down
      temperature *= coolingRate;
    }
    
    // Apply best state to labels
    for (let i = 0; i < candidates.length && i < bestState.length; i++) {
      const candidate = candidates[i];
      if (!candidate.labelInfo.visible) continue;
      
      const labelInfo = candidate.labelInfo;
      const screenPoint = candidate.screenPoint;
      const newPosition = bestState[i];
      
      // Skip if no valid position
      if (!newPosition) continue;
      
      // Calculate center of the label box
      const centerX = newPosition.x + newPosition.width / 2;
      const centerY = newPosition.y + newPosition.height / 2;
      
      // Apply label text transformation if needed
      let transformedText = candidate.labelText;
      if (this.options.textTransform !== 'none') {
        if (this.options.textTransform === 'uppercase') {
          transformedText = transformedText.toUpperCase();
        } else if (this.options.textTransform === 'lowercase') {
          transformedText = transformedText.toLowerCase();
        } else if (this.options.textTransform === 'capitalize') {
          transformedText = transformedText.replace(/\b\w/g, l => l.toUpperCase());
        }
      }
      
      // Create new symbol with updated offsets
      const originalSymbol = labelInfo.originalSymbol || {};
      const textSymbol = new TextSymbol({
        text: transformedText,
        font: {
          size: candidate.fontSize,
          family: originalSymbol.font?.family || "sans-serif",
          weight: originalSymbol.font?.weight || "normal"
        },
        color: new Color(originalSymbol.color || [0, 0, 0, this.options.labelOpacity]),
        haloColor: new Color(this.options.haloColor),
        haloSize: this.options.haloSize,
        xoffset: centerX - screenPoint.x,
        yoffset: centerY - screenPoint.y
      });
      
      // Apply the symbol with new offset
      labelInfo.labelGraphic.symbol = textSymbol;
      
      // Update debug visualization if enabled
      if (this.options.debugMode && this.debugLayer) {
        this._updateDebugGraphic(i, newPosition, true);
      }
    }
    
    // Update the labelBoxes array with best positions
    this.labelBoxes = bestState;
  }

  /**
   * Calculate energy for a label layout (lower is better)
   * @param {Array} state - Current layout state
   * @returns {number} Energy value
   * @private
   */
  _calculateLayoutEnergy(state) {
    let energy = 0;
    const padding = this.options.padding;
    const minDistance = this.options.minDistanceBetweenLabels;
    
    // Penalize overlaps heavily
    for (let i = 0; i < state.length; i++) {
      for (let j = i + 1; j < state.length; j++) {
        if (this._checkOverlap(state[i], state[j])) {
          energy += 100;
        }
      }
      
      // Penalize proximity (encourage spacing)
      for (let j = i + 1; j < state.length; j++) {
        const distance = this._calculateDistance(state[i], state[j]);
        
        // Penalize if too close but not overlapping
        if (distance < minDistance) {
          energy += 50 * (1 - distance / minDistance);
        }
      }
      
      // Penalize labels close to edges
      const box = state[i];
      if (box.x < padding) energy += (padding - box.x) * 2;
      if (box.y < padding) energy += (padding - box.y) * 2;
      if (box.x + box.width > this.view.width - padding) {
        energy += (box.x + box.width - (this.view.width - padding)) * 2;
      }
      if (box.y + box.height > this.view.height - padding) {
        energy += (box.y + box.height - (this.view.height - padding)) * 2;
      }
    }
    
    return energy;
  }

  /**
   * Generate a neighboring state by perturbing the current state
   * @param {Array} currentState - Current layout state
   * @returns {Array} Neighboring state
   * @private
   */
  _generateNeighborState(currentState) {
    const newState = currentState.map(box => ({ ...box }));
    const maxPerturbation = 15; // Maximum pixel movement
    
    // Randomly select a label to perturb
    const i = Math.floor(Math.random() * newState.length);
    
    // Apply random perturbation
    newState[i].x += (Math.random() * 2 - 1) * maxPerturbation;
    newState[i].y += (Math.random() * 2 - 1) * maxPerturbation;
    
    // Keep within viewport bounds
    const padding = this.options.padding;
    newState[i].x = Math.max(padding, Math.min(this.view.width - newState[i].width - padding, newState[i].x));
    newState[i].y = Math.max(padding, Math.min(this.view.height - newState[i].height - padding, newState[i].y));
    
    return newState;
  }

  /**
   * Calculate the acceptance probability for simulated annealing
   * @param {number} currentEnergy - Energy of current state
   * @param {number} neighborEnergy - Energy of neighbor state
   * @param {number} temperature - Current temperature
   * @returns {number} Acceptance probability [0-1]
   * @private
   */
  _calculateAcceptanceProbability(currentEnergy, neighborEnergy, temperature) {
    // Always accept better states
    if (neighborEnergy < currentEnergy) {
      return 1;
    }
    
    // Calculate acceptance probability for worse states
    return Math.exp((currentEnergy - neighborEnergy) / temperature);
  }

  /**
   * Add a debug graphic for a label box
   * @param {Object} labelBox - Label bounding box
   * @param {boolean} noOverlap - Whether the label has no overlaps
   * @private
   */
  _addDebugGraphic(labelBox, noOverlap) {
    if (!this.options.debugMode || !this.debugLayer) return;
    
    const color = noOverlap ? [0, 255, 0, 0.3] : [255, 0, 0, 0.3];
    
    // Create a polygon for the label box
    const polygon = {
      type: "polygon",
      rings: [
        [labelBox.x, labelBox.y],
        [labelBox.x + labelBox.width, labelBox.y],
        [labelBox.x + labelBox.width, labelBox.y + labelBox.height],
        [labelBox.x, labelBox.y + labelBox.height],
        [labelBox.x, labelBox.y]
      ]
    };
    
    // Create a graphic for the debug visualization
    const graphic = new Graphic({
      geometry: polygon,
      symbol: {
        type: "simple-fill",
        color: color,
        outline: {
          color: [0, 0, 0, 0.5],
          width: 1
        }
      },
      attributes: {
        isDebug: true,
        index: this.debugLayer.graphics.length
      }
    });
    
    this.debugLayer.add(graphic);
  }

  /**
   * Update an existing debug graphic
   * @param {number} index - Index of the debug graphic
   * @param {Object} labelBox - Updated label bounding box
   * @param {boolean} noOverlap - Whether the label has no overlaps
   * @private
   */
  _updateDebugGraphic(index, labelBox, noOverlap) {
    if (!this.options.debugMode || !this.debugLayer) return;
    
    // Find the existing debug graphic
    const graphic = this.debugLayer.graphics.find(g => g.attributes.index === index);
    
    if (!graphic) {
      // Add new if not found
      this._addDebugGraphic(labelBox, noOverlap);
      return;
    }
    
    // Update the polygon geometry
    graphic.geometry = {
      type: "polygon",
      rings: [
        [labelBox.x, labelBox.y],
        [labelBox.x + labelBox.width, labelBox.y],
        [labelBox.x + labelBox.width, labelBox.y + labelBox.height],
        [labelBox.x, labelBox.y + labelBox.height],
        [labelBox.x, labelBox.y]
      ]
    };
    
    // Update color based on overlap status
    const color = noOverlap ? [0, 255, 0, 0.3] : [255, 0, 0, 0.3];
    graphic.symbol = {
      type: "simple-fill",
      color: color,
      outline: {
        color: [0, 0, 0, 0.5],
        width: 1
      }
    };
  }

  /**
   * Throttled update function to prevent too many updates
   * @private
   */
  _throttledUpdateLabelPositions() {
    if (this.throttleTimeout) {
      clearTimeout(this.throttleTimeout);
    }
    
    // Check if we've already processed this update cycle
    const now = Date.now();
    if (this.lastUpdateTime && now - this.lastUpdateTime < 500) {
      // Skip too-frequent updates to prevent duplicates
      this.throttleTimeout = setTimeout(() => {
        this._updateLabelPositions();
        this.throttleTimeout = null;
        this.lastUpdateTime = Date.now();
      }, this.throttleDelay * 2);
      return;
    }
    
    this.throttleTimeout = setTimeout(() => {
      this._updateLabelPositions();
      this.throttleTimeout = null;
      this.lastUpdateTime = Date.now();
    }, this.throttleDelay);
  }

    /**
     * Toggle label editing mode
     * @returns {boolean} New editing state
     */
    toggleEditingMode() {
        this.isEditingEnabled = !this.isEditingEnabled;
        console.log(`[UniversalLabelManager] Editing mode: ${this.isEditingEnabled ? 'enabled' : 'disabled'}`);
        
        // If editing is enabled, set up editing interactions
        if (this.isEditingEnabled) {
        // Add editing-specific styling to the view if needed
        if (this.view && this.view.container) {
            this.view.container.classList.add('label-editing-enabled');
        }
        } else {
        // Remove editing-specific styling
        if (this.view && this.view.container) {
            this.view.container.classList.remove('label-editing-enabled');
        }
        
        // Force update of label positions
        this._throttledUpdateLabelPositions();
        }
        
        return this.isEditingEnabled;
    }
  

    /**
     * Helper method to find a label by ID using multiple strategies
     * This is a new method to add to UniversalLabelManager.js
     * 
     * @param {string} labelId - The ID to search for
     * @returns {Object|null} The label info or null if not found
     * @private
     */
    _findLabelById(labelId) {
        // Parse the ID - could be layerId-oid-label-29 or oid-label-29 or other formats
        let parsedLayerId = null;
        let parsedObjId = null;
        
        // Try to extract layer ID and object ID from label ID
        const idParts = labelId.split('-');
        
        // Handle format: layerId-oid-label-number
        if (idParts.length >= 4 && idParts[1] === 'oid' && idParts[2] === 'label') {
        parsedLayerId = idParts[0];
        parsedObjId = parseInt(idParts[3], 10);
        }
        // Handle format: oid-label-number (no layer ID)
        else if (idParts.length >= 3 && idParts[0] === 'oid' && idParts[1] === 'label') {
        parsedObjId = parseInt(idParts[2], 10);
        }
        
        // If we couldn't parse an object ID, look for any numeric parts
        if (parsedObjId === null) {
        for (const part of idParts) {
            const num = parseInt(part, 10);
            if (!isNaN(num)) {
            parsedObjId = num;
            break;
            }
        }
        }
        
        // If we have a parsed object ID, look for matches
        if (parsedObjId !== null) {
        // Check the label cache for any matches
        for (const [cachedId, labelInfo] of this.labelCache.entries()) {
            // Check if this label matches the object ID
            const parentId = labelInfo.parentId || labelInfo.labelGraphic?.attributes?.parentID;
            if (parentId === parsedObjId) {
            return labelInfo;
            }
            
            // Check if the ID itself contains the object ID
            if (cachedId.includes(`-${parsedObjId}`)) {
            return labelInfo;
            }
        }
        
        // If not found in cache, try to find in layers
        const layersToSearch = [];
        
        if (parsedLayerId && this.layers.has(parsedLayerId)) {
            // If we parsed a layer ID and it exists, just search that layer
            layersToSearch.push(this.layers.get(parsedLayerId).layer);
        } else {
            // Otherwise search all layers
            for (const layerInfo of this.layers.values()) {
            layersToSearch.push(layerInfo.layer);
            }
        }
        
        // Look for the label in each layer
        for (const layer of layersToSearch) {
            if (!layer.graphics) continue;
            
            // Search for graphic where attributes.parentID matches
            for (const graphic of layer.graphics.items) {
            if (!graphic.attributes) continue;
            
            // Check if this is a label and its parentID matches
            const isLabel = graphic.attributes.isLabel === true || 
                            (graphic.symbol && graphic.symbol.type === "text");
                            
            if (isLabel && graphic.attributes.parentID === parsedObjId) {
                // Build a label info object
                const labelInfo = {
                layerId: layer.id,
                labelGraphic: graphic,
                parentId: parsedObjId,
                priority: 1,
                visible: true,
                originalSymbol: graphic.symbol ? { ...graphic.symbol.toJSON() } : null,
                processed: false,
                isSelfManaged: true
                };
                
                // Add to cache for future lookups
                const newLabelId = this._generateConsistentLabelId(graphic, layer.id);
                if (!this.labelCache.has(newLabelId)) {
                this.labelCache.set(newLabelId, labelInfo);
                console.log(`[UniversalLabelManager] Added previously missing label to cache: ${newLabelId}`);
                }
                
                return labelInfo;
            }
            }
        }
        }
        
        // No match found
        return null;
    }

    /**
     * Enhanced refreshLabels method that respects edited labels
     * Replace or update the existing refreshLabels method in UniversalLabelManager.js
     * 
     * @param {Array<string>} labelIds - Array of label IDs to refresh
     * @param {boolean} respectEdits - Whether to respect edited labels
     * @returns {Object} Status of the refresh operation
     */
    refreshLabels(labelIds = [], respectEdits = false) {
        console.log(`[UniversalLabelManager] Refreshing labels:`, labelIds, respectEdits ? '(preserving edits)' : '');
        
        // Track processed labels and results
        const processed = new Set();
        const notFound = [];
        const refreshed = [];
        
        try {
        // If no specific IDs provided, refresh all visible labels
        if (!Array.isArray(labelIds) || labelIds.length === 0) {
            console.log('[UniversalLabelManager] No specific labels to refresh, updating all positions');
            
            // Before updating all positions, ensure edited labels are marked properly
            if (respectEdits) {
            try {
                // Mark saved positions as edited for maximum persistence
                if (typeof this.markSavedPositionsAsEdited === 'function') {
                this.markSavedPositionsAsEdited();
                }
                
                // Apply a special flag to all edited labels in the cache
                for (const [labelId, labelInfo] of this.labelCache.entries()) {
                if (labelInfo.labelGraphic?.attributes?._isEdited || 
                    labelInfo.labelGraphic?.attributes?._permanentEdit || 
                    labelInfo.labelGraphic?.attributes?._userEdited) {
                    
                    // Apply comprehensive protection
                    if (labelInfo.labelGraphic.attributes) {
                    labelInfo.labelGraphic.attributes._preserveOnRefresh = true;
                    labelInfo.labelGraphic.attributes._preventAutoHide = true;
                    }
                }
                }
            } catch (err) {
                console.warn('[UniversalLabelManager] Error marking edited labels:', err);
            }
            }
            
            this._throttledUpdateLabelPositions();
            return { success: true, message: 'Refreshed all labels' };
        }
        
        // Step 1: Find the labels in the cache, but also handle layer lookups for IDs not found
        for (const labelId of labelIds) {
            // Skip if already processed
            if (processed.has(labelId)) continue;
            processed.add(labelId);
            
            // First try direct cache lookup
            let labelInfo = this.labelCache.get(labelId);
            
            // If not found in cache, attempt to look it up in the layers
            if (!labelInfo) {
            // See if we can find a matching label through parent ID or other means
            labelInfo = this._findLabelById(labelId);
            }
            
            if (labelInfo) {
            const { labelGraphic } = labelInfo;
            
            // Make sure it's visible
            if (labelGraphic) {
                // Force label visibility
                labelInfo.visible = true;
                labelGraphic.visible = true;
                
                // Mark it as primary/edited with comprehensive flagging
                if (labelGraphic.attributes) {
                labelGraphic.attributes._isEdited = true;
                labelGraphic.attributes._permanentEdit = true;
                labelGraphic.attributes._userEdited = true;
                labelGraphic.attributes._preserveOnRefresh = true;
                labelGraphic.attributes._preventAutoHide = true;
                
                // Remove any "duplicate" flag
                delete labelGraphic.attributes._isDuplicate;
                delete labelGraphic.attributes._duplicateOf;
                }
                
                // Find and hide duplicates for this label
                this._hideAllDuplicatesFor(labelId, labelInfo);
                
                refreshed.push(labelId);
            }
            } else {
            notFound.push(labelId);
            }
        }
        
        // Force an update to reposition labels
        this._throttledUpdateLabelPositions();
        
        // Log the results
        if (notFound.length > 0) {
            console.warn(`[UniversalLabelManager] Unable to find ${notFound.length} labels: ${notFound.join(', ')}`);
        }
        
        if (refreshed.length > 0 || notFound.length === 0) {
            console.log(`[UniversalLabelManager] Successfully refreshed ${refreshed.length} labels`);
            return { success: true, message: `Refreshed ${refreshed.length} labels` };
        } else {
            return { success: false, message: `Failed to find any specified labels` };
        }
        
        } catch (error) {
        console.error('[UniversalLabelManager] Error refreshing labels:', error);
        return { success: false, message: `Error refreshing labels: ${error.message}` };
        }
    }

    /**
     * Hide all duplicate labels for a specific label
     * @param {string} labelId - ID of the primary label to keep
     * @param {Object} labelInfo - Label information object
     * @private
     */
    _hideAllDuplicatesFor(labelId, labelInfo) {
        if (!labelInfo) {
        // Try to get label info from cache if not provided
        labelInfo = this.labelCache.get(labelId);
        }
        
        if (!labelInfo || !labelInfo.labelGraphic) {
        console.warn(`[UniversalLabelManager] Cannot hide duplicates - invalid label info for: ${labelId}`);
        return;
        }
        
        // Make sure the primary label is visible
        labelInfo.visible = true;
        labelInfo.labelGraphic.visible = true;
        
        // Mark this label as the primary/edited one
        if (labelInfo.labelGraphic.attributes) {
        labelInfo.labelGraphic.attributes._isEdited = true;
        // Remove any "duplicate" flag if it was previously marked as a duplicate
        delete labelInfo.labelGraphic.attributes._isDuplicate;
        delete labelInfo.labelGraphic.attributes._duplicateOf;
        }
        
        // Get parent ID for finding duplicates
        const parentId = labelInfo.parentId || labelInfo.labelGraphic.attributes?.parentID;
        if (!parentId) {
        console.warn(`[UniversalLabelManager] Cannot hide duplicates - no parent ID for label: ${labelId}`);
        return;
        }
        
        let duplicatesFound = 0;
        
        // Method 1: Check in the cache
        this.labelCache.forEach((info, id) => {
        // Skip the primary label
        if (id === labelId) return;
        
        // Check if this is a duplicate (same parent)
        const infoParentId = info.parentId || info.labelGraphic?.attributes?.parentID;
        if (infoParentId === parentId) {
            // Hide this duplicate
            if (info.labelGraphic) {
            info.labelGraphic.visible = false;
            info.visible = false;
            
            // Mark it as a duplicate
            if (info.labelGraphic.attributes) {
                info.labelGraphic.attributes._isDuplicate = true;
                info.labelGraphic.attributes._duplicateOf = labelId;
            }
            
            duplicatesFound++;
            }
        }
        });
        
        // Method 2: Search in all layers for additional duplicates
        this.layers.forEach(layerInfo => {
        if (!layerInfo.layer || !layerInfo.layer.graphics) return;
        
        layerInfo.layer.graphics.forEach(graphic => {
            // Skip non-label graphics
            if (!graphic.attributes?.isLabel && 
                !(graphic.symbol && graphic.symbol.type === "text")) {
            return;
            }
            
            // Skip the primary label
            if (graphic === labelInfo.labelGraphic) return;
            
            // Check if this is a duplicate (same parent ID)
            if (graphic.attributes?.parentID === parentId) {
            // Hide this duplicate
            graphic.visible = false;
            
            // Mark it as a duplicate
            if (graphic.attributes) {
                graphic.attributes._isDuplicate = true;
                graphic.attributes._duplicateOf = labelId;
            }
            
            duplicatesFound++;
            }
        });
        });
        
        // Method 3: Check the mapView's graphics layer as a last resort
        if (this.view && this.view.graphics) {
        this.view.graphics.forEach(graphic => {
            // Skip non-label graphics
            if (!graphic.attributes?.isLabel && 
                !(graphic.symbol && graphic.symbol.type === "text")) {
            return;
            }
            
            // Skip the primary label
            if (graphic === labelInfo.labelGraphic) return;
            
            // Check if this is a duplicate (same parent ID)
            if (graphic.attributes?.parentID === parentId) {
            // Hide this duplicate
            graphic.visible = false;
            
            // Mark it as a duplicate
            if (graphic.attributes) {
                graphic.attributes._isDuplicate = true;
                graphic.attributes._duplicateOf = labelId;
            }
            
            duplicatesFound++;
            }
        });
        }
        
        if (duplicatesFound > 0) {
        console.log(`[UniversalLabelManager] Hid ${duplicatesFound} duplicate labels for ${labelId} (parentID: ${parentId})`);
        }
    }

    /**
     * Apply permanent label changes to make edits persistent
     * @param {Object} editedLabels - Map of edited labels with their new properties
     * @returns {boolean} Success indicator
     */
    applyPermanentLabelChanges(editedLabels) {
        if (!editedLabels || Object.keys(editedLabels).length === 0) {
        console.log('[UniversalLabelManager] No label changes to apply');
        return false;
        }
        
        console.log(`[UniversalLabelManager] Applying permanent changes to ${Object.keys(editedLabels).length} labels`);
        
        try {
        // Import necessary modules
        const TextSymbol = require('@arcgis/core/symbols/TextSymbol').default;
        const Color = require('@arcgis/core/Color').default;
        
        // Apply each label change
        Object.entries(editedLabels).forEach(([labelId, props]) => {
            const labelInfo = this.labelCache.get(labelId);
            
            if (!labelInfo || !labelInfo.labelGraphic) {
            console.warn(`[UniversalLabelManager] Label not found in cache: ${labelId}`);
            return;
            }
            
            // Update the cached original symbol to make changes permanent
            if (labelInfo.labelGraphic.symbol) {
            // Store the current state as the new "original"
            labelInfo.originalSymbol = labelInfo.labelGraphic.symbol.toJSON();
            
            // Create a permanent symbol with the new properties
            const permSymbol = new TextSymbol({
                text: props.text || labelInfo.labelGraphic.symbol.text,
                font: {
                ...labelInfo.labelGraphic.symbol.font,
                size: props.fontSize || labelInfo.labelGraphic.symbol.font?.size || 10
                },
                color: new Color(labelInfo.labelGraphic.symbol.color),
                haloColor: new Color(labelInfo.labelGraphic.symbol.haloColor),
                haloSize: labelInfo.labelGraphic.symbol.haloSize,
                xoffset: props.position?.x !== undefined ? props.position.x : labelInfo.labelGraphic.symbol.xoffset,
                yoffset: props.position?.y !== undefined ? props.position.y : labelInfo.labelGraphic.symbol.yoffset,
                horizontalAlignment: labelInfo.labelGraphic.symbol.horizontalAlignment,
                kerning: labelInfo.labelGraphic.symbol.kerning
            });
            
            // Apply the permanent symbol
            labelInfo.labelGraphic.symbol = permSymbol;
            
            // Update the visibility state
            labelInfo.visible = true;
            }
        });
        
        // Save changes to storage for persistence
        this.savePositions(true);
        
        // Force a position update to ensure labels are correctly positioned
        this._throttledUpdateLabelPositions();
        
        console.log('[UniversalLabelManager] Permanent label changes applied successfully');
        return true;
        } catch (error) {
        console.error('[UniversalLabelManager] Error applying permanent label changes:', error);
        return false;
        }
    }


    /**
     * Helper method to get a label ID that matches the cache
     * @param {Graphic} labelGraphic - The label graphic
     * @returns {string|null} The label ID or null if not found
     * @private
     */
    _getLabelId(labelGraphic) {
        if (!labelGraphic) return null;
        
        // Try to generate a consistent ID using attributes
        let generatedId = null;
        
        // Try to use various potential ID attributes
        if (labelGraphic.attributes) {
        const layerId = labelGraphic.layer?.id || 'unknown';
        
        if (labelGraphic.attributes.OBJECTID) {
            generatedId = `${layerId}-${labelGraphic.attributes.OBJECTID}`;
        } else if (labelGraphic.attributes.uid) {
            generatedId = `${layerId}-${labelGraphic.attributes.uid}`;
        } else if (labelGraphic.attributes.parentID) {
            generatedId = `${layerId}-label-${labelGraphic.attributes.parentID}`;
        }
        }
        
        // If we generated an ID, check if it exists in the cache
        if (generatedId && this.labelCache.has(generatedId)) {
        return generatedId;
        }
        
        // For each label in our cache, check if this is the same graphic
        for (const [labelId, labelInfo] of this.labelCache.entries()) {
        if (labelInfo.labelGraphic === labelGraphic) {
            return labelId;
        }
        }
        
        // If we have a generated ID but it's not in the cache, still use it
        if (generatedId) {
        return generatedId;
        }
        
        // No match found
        return null;
    }


    /**
     * Helper method to create a symbol from JSON
     * @param {Object} symbolJSON - The symbol JSON object
     * @returns {TextSymbol|null} The created symbol or null if failed
     * @private
     */
    _createSymbolFromJSON(symbolJSON) {
        if (!symbolJSON) return null;
        
        try {
        // Import required modules
        const TextSymbol = require('@arcgis/core/symbols/TextSymbol').default;
        const Color = require('@arcgis/core/Color').default;
        
        return new TextSymbol({
            text: symbolJSON.text,
            font: symbolJSON.font,
            color: new Color(symbolJSON.color),
            haloColor: new Color(symbolJSON.haloColor),
            haloSize: symbolJSON.haloSize,
            xoffset: symbolJSON.xoffset,
            yoffset: symbolJSON.yoffset,
            horizontalAlignment: symbolJSON.horizontalAlignment,
            kerning: symbolJSON.kerning
        });
        } catch (error) {
        console.error('[UniversalLabelManager] Error creating symbol from JSON:', error);
        return null;
        }
    }

    /**
     * Reset a specific label to its original position
     * @param {Graphic} labelGraphic - The label graphic to reset
     * @returns {boolean} Success indicator
     */
    resetLabelPosition(labelGraphic) {
        if (!labelGraphic) return false;
        
        try {
        // Get label ID
        const labelId = this._getLabelId(labelGraphic);
        if (!labelId) return false;
        
        // Look up the label in the cache
        const labelInfo = this.labelCache.get(labelId);
        if (!labelInfo || !labelInfo.originalSymbol) return false;
        
        // Import required modules
        const TextSymbol = require('@arcgis/core/symbols/TextSymbol').default;
        const Color = require('@arcgis/core/Color').default;
        
        // Create a new symbol from the original JSON
        const origSymbol = labelInfo.originalSymbol;
        const newSymbol = new TextSymbol({
            text: origSymbol.text,
            font: origSymbol.font,
            color: new Color(origSymbol.color),
            haloColor: new Color(origSymbol.haloColor),
            haloSize: origSymbol.haloSize,
            xoffset: origSymbol.xoffset,
            yoffset: origSymbol.yoffset,
            horizontalAlignment: origSymbol.horizontalAlignment,
            kerning: origSymbol.kerning
        });
        
        // Apply the restored symbol
        labelGraphic.symbol = newSymbol;
        
        console.log(`[UniversalLabelManager] Reset label position for ${labelId}`);
        return true;
        } catch (error) {
        console.error('[UniversalLabelManager] Error resetting label position:', error);
        return false;
        }
    } 

    /**
     * Save current label positions to storage
     * @param {Object|boolean} editedLabelsOrUseLocalStorage - Either edited labels object or boolean flag to force localStorage 
     * @param {boolean} useLocalStorage - Whether to use localStorage (vs sessionStorage)
     * @returns {Object} Result object with success flag and message
     */
    savePositions(editedLabelsOrUseLocalStorage = {}, useLocalStorage = false) {
        try {
        // Handle overloaded parameter - if first param is boolean, it's the useLocalStorage flag
        if (typeof editedLabelsOrUseLocalStorage === 'boolean') {
            useLocalStorage = editedLabelsOrUseLocalStorage;
            editedLabelsOrUseLocalStorage = {};
        }
        
        // Always use localStorage for maximum persistence
        useLocalStorage = true;
        
        const positions = {};
        
        // First, process explicit edits if provided
        if (typeof editedLabelsOrUseLocalStorage === 'object' && Object.keys(editedLabelsOrUseLocalStorage).length > 0) {
            console.log(`[UniversalLabelManager] Processing ${Object.keys(editedLabelsOrUseLocalStorage).length} explicit label edits`);
            
            Object.entries(editedLabelsOrUseLocalStorage).forEach(([labelId, data]) => {
            // Only process if we have a valid graphic
            if (data.graphic && data.graphic.symbol) {
                positions[labelId] = {
                xoffset: data.position?.x !== undefined ? data.position.x : data.graphic.symbol.xoffset,
                yoffset: data.position?.y !== undefined ? data.position.y : data.graphic.symbol.yoffset,
                fontSize: data.fontSize || data.graphic.symbol.font?.size,
                text: data.text || data.graphic.symbol.text,
                visible: data.graphic.visible !== undefined ? data.graphic.visible : true,
                parentId: data.graphic.attributes?.parentID
                };
                
                // Mark with permanent edit flag
                if (data.graphic.attributes) {
                data.graphic.attributes._permanentEdit = true;
                data.graphic.attributes._isEdited = true;
                }
            }
            });
        }
        
        // If no explicit edits or not enough, add all visible/edited labels from cache
        if (Object.keys(positions).length === 0) {
            this.labelCache.forEach((labelInfo, labelId) => {
            if (labelInfo.labelGraphic && labelInfo.labelGraphic.symbol) {
                const symbol = labelInfo.labelGraphic.symbol;
                
                // Only store if it's marked as edited or has visible=true
                if (labelInfo.labelGraphic.attributes?._isEdited || 
                    labelInfo.labelGraphic.attributes?._permanentEdit || 
                    (symbol.xoffset !== 0 || symbol.yoffset !== 0) || 
                    labelInfo.visible) {
                
                positions[labelId] = {
                    xoffset: symbol.xoffset,
                    yoffset: symbol.yoffset,
                    fontSize: symbol.font?.size,
                    text: symbol.text,
                    visible: labelInfo.visible,
                    parentId: labelInfo.parentId || labelInfo.labelGraphic.attributes?.parentID
                };
                }
            }
            });
        }
        
        // Always use localStorage for maximum persistence
        const storage = localStorage;
        
        // Load existing positions to merge with
        const existingPositionsStr = storage.getItem('customLabelPositions') || '{}';
        let existingPositions = {};
        
        try {
            existingPositions = JSON.parse(existingPositionsStr);
        } catch (err) {
            console.warn('[UniversalLabelManager] Error parsing existing label positions, starting fresh');
            existingPositions = {};
        }
        
        // Merge with existing positions, giving priority to new ones
        const mergedPositions = { ...existingPositions, ...positions };
        
        // Save to storage
        storage.setItem('customLabelPositions', JSON.stringify(mergedPositions));
        
        console.log(`[UniversalLabelManager] Saved ${Object.keys(positions).length} label positions to localStorage (${Object.keys(mergedPositions).length} total stored)`);
        
        return { 
            success: true, 
            message: `Saved ${Object.keys(positions).length} label positions`,
            count: Object.keys(positions).length,
            totalStored: Object.keys(mergedPositions).length
        };
        } catch (error) {
        console.error('[UniversalLabelManager] Error saving positions:', error);
        return { success: false, message: `Error saving positions: ${error.message}` };
        }
    }

    /**
     * Enhanced loadPositions method with improved edit preservation
     * Replace or update the existing loadPositions method in UniversalLabelManager.js
     * 
     * @param {boolean} useLocalStorage - Whether to use localStorage
     * @param {boolean} forceRefresh - Force a refresh after loading positions
     * @param {boolean} preserveEdits - Preserve manually edited labels
     * @returns {Object} Result object with success flag, message, and count
     */
    loadPositions(useLocalStorage = true, forceRefresh = true, preserveEdits = false) {
        try {
        // Always use localStorage for maximum persistence
        const storage = localStorage;
        const savedData = storage.getItem('customLabelPositions');
        
        if (!savedData) {
            console.log('[UniversalLabelManager] No saved label positions found');
            return { success: false, message: 'No saved positions found', count: 0 };
        }
        
        const positions = JSON.parse(savedData);
        let count = 0;
        let appliedToLayerIds = new Set();
        let editedLabels = new Set(); // Track edited labels for special handling
        
        console.log(`[UniversalLabelManager] Found ${Object.keys(positions).length} saved label positions`);
        
        // First pass: Identify all edited labels
        if (preserveEdits) {
            for (const [labelId, position] of Object.entries(positions)) {
            if (position.edited === true || position.permanent === true || position.userEdited === true) {
                editedLabels.add(labelId);
            }
            }
            console.log(`[UniversalLabelManager] Found ${editedLabels.size} edited labels to preserve`);
        }
        
        // Create map of parent IDs and other identifiers for matching
        const parentIdMap = new Map();
        const idPrefixMap = new Map(); // For partial ID matching
        
        // Populate maps with existing labels in the cache
        this.labelCache.forEach((labelInfo, labelId) => {
            // Add to parent ID map
            const parentId = labelInfo.parentId || labelInfo.labelGraphic?.attributes?.parentID;
            if (parentId !== undefined) {
            if (!parentIdMap.has(parentId)) {
                parentIdMap.set(parentId, []);
            }
            parentIdMap.get(parentId).push({ id: labelId, info: labelInfo });
            }
            
            // Add to ID prefix map for partial matching
            // Extract the numeric part of the ID for fuzzy matching
            const idParts = labelId.split('-');
            const numericParts = [];
            
            // Extract all numeric parts for matching
            for (const part of idParts) {
            const num = parseInt(part, 10);
            if (!isNaN(num)) {
                numericParts.push(num);
            }
            }
            
            if (numericParts.length > 0) {
            const numericKey = numericParts.join('-');
            if (!idPrefixMap.has(numericKey)) {
                idPrefixMap.set(numericKey, []);
            }
            idPrefixMap.get(numericKey).push({ id: labelId, info: labelInfo });
            }
        });
        
        /**
         * Find the best matching label using multiple strategies
         * @param {string} savedLabelId - Saved label ID
         * @param {Object} savedPosition - Saved position data
         * @returns {Object|null} Matching label info or null
         */
        const findBestMatchingLabel = (savedLabelId, savedPosition) => {
            // Strategy 1: Direct ID match (best case)
            if (this.labelCache.has(savedLabelId)) {
            return { id: savedLabelId, info: this.labelCache.get(savedLabelId) };
            }
            
            // Strategy 2: Parent ID match (reliable)
            const parentId = savedPosition.parentId || savedPosition.parentID;
            if (parentId !== undefined && parentIdMap.has(parentId)) {
            const matches = parentIdMap.get(parentId);
            if (matches && matches.length > 0) {
                // Use the first match by default
                return matches[0];
            }
            }
            
            // Strategy 3: Extract numeric parts from ID for fuzzy matching
            const idParts = savedLabelId.split('-');
            const numericParts = [];
            
            // Extract all numeric parts for matching
            for (const part of idParts) {
            const num = parseInt(part, 10);
            if (!isNaN(num)) {
                numericParts.push(num);
            }
            }
            
            if (numericParts.length > 0) {
            const numericKey = numericParts.join('-');
            if (idPrefixMap.has(numericKey)) {
                const matches = idPrefixMap.get(numericKey);
                if (matches && matches.length > 0) {
                return matches[0];
                }
            }
            }
            
            // Strategy 4: Try to match by object index/ID in the format "oid-label-X"
            if (savedLabelId.includes('oid-label-')) {
            const match = savedLabelId.match(/oid-label-(\d+)/);
            if (match && match[1]) {
                const objId = parseInt(match[1], 10);
                
                // Check if we have labels with this object ID as parent
                if (parentIdMap.has(objId)) {
                return parentIdMap.get(objId)[0];
                }
            }
            }
            
            // No match found
            return null;
        };
        
        // Process saved positions with enhanced matching
        for (const [savedLabelId, savedPosition] of Object.entries(positions)) {
            const isEdited = editedLabels.has(savedLabelId);
            
            // Find matching label using our enhanced matching function
            const matchingLabel = findBestMatchingLabel(savedLabelId, savedPosition);
            
            if (matchingLabel) {
            const { id: matchedId, info: labelInfo } = matchingLabel;
            
            // Apply the saved position to the matched label
            if (labelInfo.labelGraphic && labelInfo.labelGraphic.symbol) {
                try {
                const symbol = labelInfo.labelGraphic.symbol.clone();
                
                // Apply saved properties
                if (savedPosition.xoffset !== undefined) symbol.xoffset = savedPosition.xoffset;
                if (savedPosition.yoffset !== undefined) symbol.yoffset = savedPosition.yoffset;
                if (savedPosition.fontSize !== undefined && symbol.font) {
                    symbol.font = { ...symbol.font, size: savedPosition.fontSize };
                }
                if (savedPosition.text !== undefined) symbol.text = savedPosition.text;
                
                // Apply updated symbol
                labelInfo.labelGraphic.symbol = symbol;
                
                // Apply visibility state
                if (savedPosition.visible !== undefined) {
                    labelInfo.labelGraphic.visible = savedPosition.visible;
                    labelInfo.visible = savedPosition.visible;
                }
                
                // Mark as a permanent edit with comprehensive flagging
                if (labelInfo.labelGraphic.attributes) {
                    // Enhanced flagging system
                    labelInfo.labelGraphic.attributes._permanentEdit = true;
                    labelInfo.labelGraphic.attributes._isEdited = true;
                    
                    // Store the reference to the original saved ID for future matching
                    labelInfo.labelGraphic.attributes._savedLabelId = savedLabelId;
                    
                    // Enhanced protection for edited labels
                    if (isEdited) {
                    labelInfo.labelGraphic.attributes._userEdited = true;
                    labelInfo.labelGraphic.attributes._preventAutoHide = true;
                    labelInfo.labelGraphic.attributes._preserveOnRefresh = true;
                    labelInfo.labelGraphic.attributes._positionLocked = true;
                    }
                    
                    // Remove any duplicate flags
                    delete labelInfo.labelGraphic.attributes._isDuplicate;
                    delete labelInfo.labelGraphic.attributes._duplicateOf;
                }
                
                // Track which layers were affected for targeted refresh
                if (labelInfo.layerId) {
                    appliedToLayerIds.add(labelInfo.layerId);
                }
                
                count++;
                } catch (err) {
                console.warn(`[UniversalLabelManager] Error applying saved position for label ${matchedId}:`, err);
                }
            }
            } 
            else if (isEdited) {
            // If this was an edited label but we couldn't find a match, log a warning
            console.warn(`[UniversalLabelManager] Could not find match for edited label: ${savedLabelId}`);
            }
        }
        
        console.log(`[UniversalLabelManager] Applied ${count} saved label positions across ${appliedToLayerIds.size} layers`);
        
        // Hide duplicates after applying saved positions but with enhanced respect for edited labels
        if (count > 0) {
            setTimeout(() => {
            try {
                this._hideDuplicatesAfterLoad(editedLabels);
            } catch (err) {
                console.warn('[UniversalLabelManager] Error hiding duplicates after load:', err);
            }
            }, 0);
        }
        
        // Force update if any positions were loaded and refresh is requested
        if (count > 0 && forceRefresh) {
            // Use a short delay to allow all changes to process
            setTimeout(() => {
            this._throttledUpdateLabelPositions();
            console.log('[UniversalLabelManager] Triggered refresh after loading saved positions');
            }, 50);
        }
        
        return { 
            success: true, 
            message: `Loaded ${count} label positions`, 
            count,
            appliedLayers: Array.from(appliedToLayerIds)
        };
        } catch (error) {
        console.error('[UniversalLabelManager] Error loading positions:', error);
        return { success: false, message: `Error loading positions: ${error.message}`, count: 0 };
        }
    }
    
    /**
     * Enhanced _hideDuplicatesAfterLoad method with improved edit preservation
     * Replace or update the existing method in UniversalLabelManager.js
     * 
     * @param {Set|null} editedLabels - Set of edited label IDs to preserve
     * @private
     */
    _hideDuplicatesAfterLoad(editedLabels = null) {
        try {
        // Group labels by parent ID
        const parentMap = new Map();
        
        // First pass: collect all labels by parent ID
        this.labelCache.forEach((labelInfo, labelId) => {
            const parentId = labelInfo.parentId || 
                            labelInfo.labelGraphic?.attributes?.parentID ||
                            labelInfo.labelGraphic?.attributes?._originalParentID;
            
            if (parentId !== undefined) {
            if (!parentMap.has(parentId)) {
                parentMap.set(parentId, []);
            }
            parentMap.get(parentId).push({ id: labelId, info: labelInfo });
            }
        });
        
        // Second pass: for each parent, keep only one visible label UNLESS it's edited
        let hiddenCount = 0;
        let preservedCount = 0;
        
        parentMap.forEach((labels, parentId) => {
            if (labels.length <= 1) return; // No duplicates
            
            // First, check if any labels are explicitly marked as edited
            const editedLabelIndices = [];
            
            // Find all edited labels for this parent
            labels.forEach((label, index) => {
            const { id, info } = label;
            
            // Check multiple edit flags
            const isExplicitlyEdited = 
                (editedLabels && editedLabels.has(id)) ||
                info.labelGraphic?.attributes?._userEdited ||
                info.labelGraphic?.attributes?._preventAutoHide ||
                info.labelGraphic?.attributes?._preserveOnRefresh ||
                info.labelGraphic?.attributes?._positionLocked;
            
            if (isExplicitlyEdited) {
                editedLabelIndices.push(index);
            }
            });
            
            // If we found any edited labels, preserve ALL of them
            if (editedLabelIndices.length > 0) {
            // Mark all edited labels as visible and primary
            editedLabelIndices.forEach(index => {
                const { id, info } = labels[index];
                
                if (info.labelGraphic) {
                info.labelGraphic.visible = true;
                info.visible = true;
                
                if (info.labelGraphic.attributes) {
                    info.labelGraphic.attributes._isPrimary = true;
                    info.labelGraphic.attributes._permanentEdit = true;
                    delete info.labelGraphic.attributes._isDuplicate;
                    delete info.labelGraphic.attributes._duplicateOf;
                }
                }
                
                preservedCount++;
            });
            
            // Hide all non-edited labels for this parent
            for (let i = 0; i < labels.length; i++) {
                if (!editedLabelIndices.includes(i)) {
                const { info } = labels[i];
                
                if (info.labelGraphic) {
                    info.labelGraphic.visible = false;
                    info.visible = false;
                    
                    if (info.labelGraphic.attributes) {
                    info.labelGraphic.attributes._isDuplicate = true;
                    info.labelGraphic.attributes._duplicateOf = labels[editedLabelIndices[0]].id;
                    }
                    
                    hiddenCount++;
                }
                }
            }
            } 
            else {
            // No edited labels, use standard priority heuristic
            let primaryLabel = null;
            let highestPriority = -1;
            
            for (const label of labels) {
                const { id, info } = label;
                let priority = 0;
                
                // Prioritize labels that have been explicitly edited
                if (info.labelGraphic?.attributes?._permanentEdit) priority += 10;
                if (info.labelGraphic?.attributes?._isEdited) priority += 5;
                
                // Prioritize visible labels
                if (info.labelGraphic?.visible) priority += 2;
                if (info.visible) priority += 2;
                
                // Prioritize labels with offset (suggests they were manually positioned)
                if (info.labelGraphic?.symbol) {
                const xOffset = info.labelGraphic.symbol.xoffset || 0;
                const yOffset = info.labelGraphic.symbol.yoffset || 0;
                
                if (xOffset !== 0 || yOffset !== 0) priority += 3;
                }
                
                if (priority > highestPriority) {
                primaryLabel = label;
                highestPriority = priority;
                }
            }
            
            // If we found a primary label, hide all others
            if (primaryLabel) {
                // Ensure primary is visible
                if (primaryLabel.info.labelGraphic) {
                primaryLabel.info.labelGraphic.visible = true;
                primaryLabel.info.visible = true;
                
                if (primaryLabel.info.labelGraphic.attributes) {
                    primaryLabel.info.labelGraphic.attributes._isPrimary = true;
                    delete primaryLabel.info.labelGraphic.attributes._isDuplicate;
                    delete primaryLabel.info.labelGraphic.attributes._duplicateOf;
                }
                }
                
                // Hide all other labels for this parent
                for (const label of labels) {
                if (label.id !== primaryLabel.id) {
                    if (label.info.labelGraphic) {
                    label.info.labelGraphic.visible = false;
                    label.info.visible = false;
                    
                    if (label.info.labelGraphic.attributes) {
                        label.info.labelGraphic.attributes._isDuplicate = true;
                        label.info.labelGraphic.attributes._duplicateOf = primaryLabel.id;
                    }
                    
                    hiddenCount++;
                    }
                }
                }
            }
            }
        });
        
        console.log(`[UniversalLabelManager] Hid ${hiddenCount} duplicate labels after loading saved positions`);
        if (preservedCount > 0) {
            console.log(`[UniversalLabelManager] Preserved ${preservedCount} edited labels from auto-hiding`);
        }
        } catch (err) {
        console.error('[UniversalLabelManager] Error hiding duplicates after load:', err);
        }
    }
  

    /**
     * Configure label settings based on layer type
     * @param {string} layerType - The type of layer ("pipe", "comp", "custom", etc.)
     */
    configureLayerSettings(layerType) {
        if (!layerType) return;
        
        // Normalize layer type
        const type = layerType.toLowerCase();
        
        // Get type-specific configuration or use default
        const typeConfig = this.layerTypeConfigs[type] || this.layerTypeConfigs.custom;
        
        // Apply settings from the configuration
        Object.keys(typeConfig).forEach(key => {
        this.options[key] = typeConfig[key];
        });
        
        console.log(`[UniversalLabelManager] Applied settings for layer type: ${type}`);
        
        // Force update with new settings
        this._throttledUpdateLabelPositions();
    }

    /**
     * Format a point label including variables if configured
     * @param {Object} item - The data point object
     * @param {Object} config - Configuration containing column info and options
     * @returns {String} Formatted label text
     */
    formatPointLabel(item, config) {
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
            ? this._formatNumberForLabel(item[variable1Column])
            : item[variable1Column];
            varParts.push(val);
        }
        
        // Add variable 2 if available
        if (variable2Column && item[variable2Column] !== undefined && item[variable2Column] !== null) {
            // Format numbers nicely if needed
            const val = typeof item[variable2Column] === 'number' 
            ? this._formatNumberForLabel(item[variable2Column])
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
     * @param {Number} value - The number to format
     * @returns {String} Formatted number
     * @private
     */
    _formatNumberForLabel(value) {
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
   * Truncate label text to a maximum length
   * @param {String} text - Original label text
   * @param {Number} maxLength - Maximum length (defaults to option value)
   * @returns {String} Truncated text with ellipsis if needed
   */
  truncateLabel(text, maxLength = null) {
    if (maxLength === null) {
      maxLength = this.options.maxLabelLength;
    }
    
    if (!text || text.length <= maxLength) {
      return text;
    }
    
    return text.substring(0, maxLength - 1) + '…';
  }

  /**
   * Creates a text symbol for a label with standard styling
   * @param {String} text - Label text
   * @param {Object} options - Styling options
   * @returns {TextSymbol} Configured text symbol
   */
  createLabelSymbol(text, options = {}) {
    const {
      fontSize = this._calculateFontSize(),
      fontFamily = "sans-serif",
      fontWeight = "normal",
      color = [0, 0, 0, this.options.labelOpacity],
      haloColor = this.options.haloColor,
      haloSize = this.options.haloSize,
      xoffset = 0,
      yoffset = 0,
      horizontalAlignment = "center",
      kerning = true
    } = options;
    
    return new TextSymbol({
      text,
      font: {
        size: fontSize,
        family: fontFamily,
        weight: fontWeight
      },
      color: new Color(color),
      haloColor: new Color(haloColor),
      haloSize,
      xoffset,
      yoffset,
      horizontalAlignment,
      kerning
    });
  }

  /**
   * Fix label offset issues on high DPI displays
   * @param {Graphic} labelGraphic - The label graphic to fix
   * @param {Object} offset - Desired offset {x, y}
   */
  fixLabelOffsetForHighDPI(labelGraphic, offset) {
    if (!labelGraphic || !labelGraphic.symbol) return;
    
    // Get the device pixel ratio
    const pixelRatio = window.devicePixelRatio || 1;
    
    // If we're on a high DPI display, adjust the offset
    if (pixelRatio > 1) {
      const textSymbol = labelGraphic.symbol;
      textSymbol.xoffset = offset.x / pixelRatio;
      textSymbol.yoffset = offset.y / pixelRatio;
      labelGraphic.symbol = textSymbol;
    } else {
      // Standard display, use normal offsets
      const textSymbol = labelGraphic.symbol;
      textSymbol.xoffset = offset.x;
      textSymbol.yoffset = offset.y;
      labelGraphic.symbol = textSymbol;
    }
  }

  /**
   * Destroy the label manager and clean up
   */
  destroy() {
    // Remove all event handlers
    this.eventHandles.forEach(handle => {
      if (handle && typeof handle.remove === 'function') {
        handle.remove();
      }
    });
    
    // Clear throttle timeout
    if (this.throttleTimeout) {
      clearTimeout(this.throttleTimeout);
      this.throttleTimeout = null;
    }
    
    // Clear monitor intervals
    if (this.monitorIntervals) {
      this.monitorIntervals.forEach(intervalId => {
        clearInterval(intervalId);
      });
      this.monitorIntervals = [];
    }
    
    // Run label monitor cleanup if it exists
    if (this.labelMonitorCleanup && typeof this.labelMonitorCleanup === 'function') {
      this.labelMonitorCleanup();
      this.labelMonitorCleanup = null;
    }
    
    // Remove debug layer if exists
    if (this.options.debugMode && this.debugLayer) {
      this.view.map.remove(this.debugLayer);
    }
    
    // Clear all maps and arrays
    this.layers.clear();
    this.labelCache.clear();
    this.visibleLabels.clear();
    this.labelBoxes = [];
    this.eventHandles = [];
    this.viewportGrid = {};
    this.clusterCache.clear();
    this.pointRegistry.clear();
    this.processedLabels.clear();
    
    console.log("[UniversalLabelManager] Successfully destroyed");
  }
}

/**
 * Initialize the universal label manager for a map view with optimized settings
 * 
 * @param {MapView} view - The ArcGIS MapView
 * @param {Object} options - Configuration options
 * @returns {UniversalLabelManager} The label manager instance
 */
export function initializeUniversalLabelManager(view, options = {}) {
    console.log("[initializeUniversalLabelManager] Setting up label manager");
    
    // Default configuration optimized for better visibility
    const defaultConfig = {
      labelMinZoom: 9,                    // Show labels at zoom level 9+
      layoutStrategy: 'advanced',         // Use balanced quality/performance algorithm
      maxLabelsVisible: 100,              // Show more labels at once
      fontSizeRange: [10, 14],            // Slightly larger font size range
      haloSize: 2.5,                      // Enhanced text halo for better readability
      haloColor: [255, 255, 255, 0.95],   // White halo with higher opacity
      padding: 12,                        // Increased padding between labels
      minDistanceBetweenLabels: 25,       // More distance between labels in pixels
      priorityAttributes: ["TotalUnits", "value", "priority"], // Attributes for prioritization
      densityAware: true,                 // Enable density awareness
      useSpatialClustering: true,         // Use spatial clustering for better label management
      textTransform: 'none',              // No text transformation
      deduplicateLabels: true,            // Prevent duplicate labels for the same point
      maxLabelDistance: 70,               // Maximum distance a label can be from its point (in pixels)
      preventLabelOverlap: true,          // Strictly prevent label overlap
      // Specify label placement preferences (helps with positioning)
      labelPlacementPreference: ["top", "right", "bottom", "left", "top-right", "bottom-right", "bottom-left", "top-left"],
      // Control how the manager handles layers that create their own labels
      respectSelfManagedLayers: true      // Respect layers with hasLabelGraphics flag
    };
    
    // Merge with any provided options
    const mergedConfig = { ...defaultConfig, ...options };
    
    // Create and return the manager
    const labelManager = new UniversalLabelManager(view, mergedConfig);
    
    // Log configuration details for debugging
    console.log(`[initializeUniversalLabelManager] Created label manager with ${mergedConfig.respectSelfManagedLayers ? 'support' : 'no support'} for self-managed layers`);
    
    return labelManager;
  }