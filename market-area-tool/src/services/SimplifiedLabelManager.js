// src/services/SimplifiedLabelManager.js
import Graphic from "@arcgis/core/Graphic";
import TextSymbol from "@arcgis/core/symbols/TextSymbol";
import Color from "@arcgis/core/Color";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";

/**
 * Optimized LabelManager to provide centralized label handling with enhanced performance
 * - Manages creation, editing, and persistence of labels
 * - Single source of truth for label positions
 * - Unified storage mechanism with compression
 * - Ensures labels are unique to each map configuration
 * - Optimized collision detection and positioning algorithms
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
    this.mapType = null;
    this.handlers = [];
    this.dragInfo = { startPoint: null, labelOffset: null };
    this.labelLayer = null;

    // Direct drag handling state
    this.isDragging = false;
    this.dragStartPoint = null;
    this.draggedLabel = null;
    this.originalOffset = null;

    // Performance optimization: Cache for text measurements
    this._textMeasurementCache = new Map();
    this._canvasContext = null;
    this._boundingBoxCache = new WeakMap();
    
    // Optimized search patterns - pre-computed for better performance
    this._searchPatterns = null;
    this._zoomIndependentPatterns = null;

    // Debounce timers for performance
    this._saveDebounceTimer = null;
    this._refreshDebounceTimer = null;

    // Default settings with performance optimizations
    this.settings = {
      fontSize: 10,
      fontFamily: "sans-serif",
      haloSize: 2,
      haloColor: [255, 255, 255, 0.9],
      color: [0, 0, 0, 0.95],
      avoidCollisions: true,
      minZoom: 8,
      autoSaveIntervalMs: 30000,
      // Performance settings
      collisionDetectionThreshold: 0.3,
      maxOptimizationAttempts: 50,
      enableTextMeasurementCache: true,
      enableBoundingBoxCache: true,
    };

    this.autoSaveInterval = null;
    this._initialize();
  }

  /**
   * Optimized storage key generation with caching
   * @returns {string} The storage key
   */
  getStorageKey() {
    // Cache the storage key to avoid repeated string concatenation
    if (this._cachedStorageKey && 
        this._lastMapConfigId === this.mapConfigId && 
        this._lastMapType === this.mapType) {
      return this._cachedStorageKey;
    }

    // Ensure we use a stable key that's based on the map configuration
    if (!this.mapConfigId) {
      this.mapConfigId = sessionStorage.getItem("currentMapConfigId");
      console.log(`[LabelManager] Retrieved mapConfigId from sessionStorage: ${this.mapConfigId}`);
    }

    if (!this.mapType) {
      this.mapType = sessionStorage.getItem("currentMapType");
      console.log(`[LabelManager] Retrieved mapType from sessionStorage: ${this.mapType}`);
    }

    // Build the storage key with enhanced uniqueness
    const baseKey = "customLabelPositions";
    let storageKey = baseKey;

    if (this.mapConfigId) {
      storageKey = `${storageKey}_config_${this.mapConfigId}`;
    }

    if (this.mapType) {
      storageKey = `${storageKey}_type_${this.mapType}`;
    }

    // Cache the result
    this._cachedStorageKey = storageKey;
    this._lastMapConfigId = this.mapConfigId;
    this._lastMapType = this.mapType;

    console.log(`[LabelManager] Using storage key: ${storageKey}`);
    return storageKey;
  }

  /**
   * Initialize the label manager with optimizations
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

    // Initialize canvas context for text measurements
    this._initializeTextMeasurement();

    // Pre-compute search patterns for better performance
    this._precomputeSearchPatterns();

    // Set up optimized auto-save interval
    this._setupOptimizedAutoSave();

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
                "config:", this.mapConfigId, "type:", this.mapType);
  }

  /**
   * Initialize optimized text measurement system
   * @private
   */
  _initializeTextMeasurement() {
    if (this.settings.enableTextMeasurementCache) {
      const canvas = document.createElement("canvas");
      this._canvasContext = canvas.getContext("2d");
      
      // Set canvas to a reasonable size for better performance
      canvas.width = 1000;
      canvas.height = 200;
    }
  }

  /**
   * Pre-compute search patterns for optimal performance
   * @private
   */
  _precomputeSearchPatterns() {
    this._searchPatterns = this._generateOptimizedSearchPatterns();
    this._zoomIndependentPatterns = this._generateZoomIndependentSearchPatterns();
  }

  /**
   * Optimized bounding box calculation with caching and improved text measurements
   * @param {Object} label - The label graphic
   * @param {Object} position - The label position {x, y}
   * @returns {Object} Bounding box {x, y, width, height, centerX, centerY}
   * @private
   */
  _calculateLabelBoundingBox(label, position) {
    if (!label || !label.symbol) return null;

    // Check cache first if enabled
    if (this.settings.enableBoundingBoxCache) {
      const cacheKey = `${label.uid || 'unknown'}_${position.x}_${position.y}`;
      if (this._boundingBoxCache.has(label)) {
        const cached = this._boundingBoxCache.get(label);
        if (cached.position.x === position.x && cached.position.y === position.y) {
          return cached.boundingBox;
        }
      }
    }

    const text = label.symbol.text || label.attributes?.text || "";
    if (!text) return null;

    const fontSize = label.symbol.font?.size || this.settings.fontSize;
    const fontWeight = label.symbol.font?.weight || "normal";
    const fontFamily = label.symbol.font?.family || this.settings.fontFamily;

    // Optimized text measurement with caching
    const textDimensions = this._getOptimizedTextDimensions(text, fontSize, fontWeight, fontFamily);
    
    // Account for background padding and borders
    const hasBackground = !!label.symbol.backgroundColor;
    const borderSize = label.symbol.borderLineSize || 0;
    const padding = hasBackground ? Math.max(4, borderSize * 2) : 2;

    // Account for halo effect
    const haloSize = label.symbol.haloSize || 0;
    const extraPadding = Math.max(padding, haloSize);

    const boundingBox = {
      x: position.x - textDimensions.width / 2 - extraPadding,
      y: position.y - textDimensions.height / 2 - extraPadding,
      width: textDimensions.width + extraPadding * 2,
      height: textDimensions.height + extraPadding * 2,
      centerX: position.x,
      centerY: position.y,
      textWidth: textDimensions.width,
      textHeight: textDimensions.height,
    };

    // Cache the result if enabled
    if (this.settings.enableBoundingBoxCache) {
      this._boundingBoxCache.set(label, {
        position: { x: position.x, y: position.y },
        boundingBox: boundingBox
      });
    }

    return boundingBox;
  }

  /**
   * Optimized text dimension calculation with caching
   * @param {string} text - The text to measure
   * @param {number} fontSize - Font size
   * @param {string} fontWeight - Font weight
   * @param {string} fontFamily - Font family
   * @returns {Object} Text dimensions {width, height}
   * @private
   */
  _getOptimizedTextDimensions(text, fontSize, fontWeight, fontFamily) {
    // Create cache key
    const cacheKey = `${text}_${fontSize}_${fontWeight}_${fontFamily}`;
    
    // Check cache first
    if (this.settings.enableTextMeasurementCache && this._textMeasurementCache.has(cacheKey)) {
      return this._textMeasurementCache.get(cacheKey);
    }

    let textWidth, textHeight;

    if (this._canvasContext) {
      // Use cached canvas context for better performance
      this._canvasContext.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      const metrics = this._canvasContext.measureText(text);
      textWidth = metrics.width;
      textHeight = fontSize * 1.2; // Line height factor
    } else {
      // Fallback to creating new canvas (less optimal)
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      const metrics = context.measureText(text);
      textWidth = metrics.width;
      textHeight = fontSize * 1.2;
    }

    const dimensions = { width: textWidth, height: textHeight };

    // Cache the result
    if (this.settings.enableTextMeasurementCache) {
      this._textMeasurementCache.set(cacheKey, dimensions);
      
      // Limit cache size to prevent memory leaks
      if (this._textMeasurementCache.size > 1000) {
        const firstKey = this._textMeasurementCache.keys().next().value;
        this._textMeasurementCache.delete(firstKey);
      }
    }

    return dimensions;
  }

  /**
   * Optimized bounding box overlap check with early termination
   * @param {Object} box1 - First bounding box
   * @param {Object} box2 - Second bounding box
   * @returns {boolean} True if boxes overlap
   * @private
   */
  _checkBoundingBoxOverlap(box1, box2) {
    if (!box1 || !box2) return false;

    // Early termination optimizations
    return !(
      box1.x + box1.width < box2.x ||
      box2.x + box2.width < box1.x ||
      box1.y + box1.height < box2.y ||
      box2.y + box2.height < box1.y
    );
  }

  /**
   * Optimized overlap area calculation
   * @param {Object} box1 - First bounding box
   * @param {Object} box2 - Second bounding box
   * @returns {number} Overlap area
   * @private
   */
  _calculateOverlapArea(box1, box2) {
    if (!this._checkBoundingBoxOverlap(box1, box2)) return 0;

    const xOverlap = Math.min(box1.x + box1.width, box2.x + box2.width) - 
                    Math.max(box1.x, box2.x);
    const yOverlap = Math.min(box1.y + box1.height, box2.y + box2.height) - 
                    Math.max(box1.y, box2.y);

    return xOverlap * yOverlap;
  }

  /**
   * Highly optimized label position optimization with improved algorithms
   * @param {Array} labelsToOptimize - Array of {graphic, labelId, position} objects
   * @returns {Map} Map of labelId to optimized position
   * @private
   */
  _optimizeLabelPositions(labelsToOptimize) {
    if (!labelsToOptimize || labelsToOptimize.length === 0) return new Map();

    console.log(`[LabelManager] Optimizing positions for ${labelsToOptimize.length} labels`);

    const optimizedPositions = new Map();

    // Optimized sorting with cached calculations
    const sortedLabels = this._optimizedLabelSorting(labelsToOptimize);

    // Use pre-computed search patterns
    const searchPatterns = this._searchPatterns;

    // Process each label with optimized algorithm
    for (let index = 0; index < sortedLabels.length; index++) {
      const labelData = sortedLabels[index];
      const { graphic, labelId, position } = labelData;

      if (!position) {
        optimizedPositions.set(labelId, { x: 0, y: 0 });
        continue;
      }

      let bestPosition = { ...position };
      let minOverlapScore = Number.MAX_VALUE;
      let foundPerfectPosition = false;
      let attemptCount = 0;

      // Optimized search with early termination
      for (const pattern of searchPatterns) {
        if (foundPerfectPosition || attemptCount >= this.settings.maxOptimizationAttempts) {
          break;
        }

        const testPosition = {
          x: position.x + pattern.x,
          y: position.y + pattern.y,
        };

        // Calculate bounding box for this test position
        const testBox = this._calculateLabelBoundingBox(graphic, testPosition);
        if (!testBox) continue;

        // Optimized overlap calculation
        let overlapScore = this._calculateOptimizedOverlapScore(
          testBox, labelData, sortedLabels, optimizedPositions, index
        );

        // Apply position quality modifiers
        overlapScore += this._calculatePositionPenalty(position, testPosition, pattern);

        // Update best position if this is better
        if (overlapScore < minOverlapScore) {
          minOverlapScore = overlapScore;
          bestPosition = testPosition;

          // Early termination for perfect positions
          if (overlapScore <= this.settings.collisionDetectionThreshold) {
            foundPerfectPosition = true;
          }
        }

        attemptCount++;
      }

      // Store the optimized position
      optimizedPositions.set(labelId, bestPosition);

      // Log significant moves for debugging (optimized logging)
      if (bestPosition.x !== position.x || bestPosition.y !== position.y) {
        const distanceSquared = Math.pow(bestPosition.x - position.x, 2) + 
                               Math.pow(bestPosition.y - position.y, 2);
        if (distanceSquared > 100) { // Only log moves > 10px
          const distance = Math.sqrt(distanceSquared);
          console.log(
            `[LabelManager] Optimized label ${labelId}: moved ${distance.toFixed(1)}px ` +
            `from (${position.x}, ${position.y}) to (${bestPosition.x}, ${bestPosition.y})`
          );
        }
      }
    }

    return optimizedPositions;
  }

  /**
   * Optimized label sorting with cached calculations
   * @param {Array} labelsToOptimize - Labels to sort
   * @returns {Array} Sorted labels
   * @private
   */
  _optimizedLabelSorting(labelsToOptimize) {
    // Pre-calculate sorting criteria to avoid repeated calculations
    const labelsWithCriteria = labelsToOptimize.map(labelData => {
      const text = labelData.graphic.symbol?.text || "";
      const fontSize = labelData.graphic.symbol?.font?.size || this.settings.fontSize;
      
      return {
        ...labelData,
        _textLength: text.length,
        _fontSize: fontSize,
        _sortKey: text.length * 1000 + fontSize // Combined sort key for better performance
      };
    });

    // Single sort operation with combined criteria
    return labelsWithCriteria.sort((a, b) => b._sortKey - a._sortKey);
  }

  /**
   * Optimized overlap score calculation with early termination
   * @param {Object} testBox - Bounding box of the test position
   * @param {Object} currentLabel - Current label being positioned
   * @param {Array} allLabels - All labels being processed
   * @param {Map} optimizedPositions - Already optimized positions
   * @param {number} currentIndex - Index of current label
   * @returns {number} Total overlap score (lower is better)
   * @private
   */
  _calculateOptimizedOverlapScore(testBox, currentLabel, allLabels, optimizedPositions, currentIndex) {
    let totalScore = 0;
    const maxScore = 10000; // Early termination threshold

    // Check against already optimized labels (more important)
    for (let i = 0; i < currentIndex && totalScore < maxScore; i++) {
      const otherLabel = allLabels[i];
      const otherPosition = optimizedPositions.get(otherLabel.labelId);

      if (!otherPosition) continue;

      const otherBox = this._calculateLabelBoundingBox(otherLabel.graphic, otherPosition);
      if (!otherBox) continue;

      const overlapArea = this._calculateOverlapArea(testBox, otherBox);
      if (overlapArea > 0) {
        const importanceWeight = this._getLabelImportanceWeight(otherLabel.graphic);
        totalScore += overlapArea * importanceWeight;
      }
    }

    // Early termination if score is already too high
    if (totalScore >= maxScore) return totalScore;

    // Check against remaining unprocessed labels (lower weight)
    for (let i = currentIndex + 1; i < allLabels.length && totalScore < maxScore; i++) {
      const otherLabel = allLabels[i];
      const otherBox = this._calculateLabelBoundingBox(otherLabel.graphic, otherLabel.position);

      if (!otherBox) continue;

      const overlapArea = this._calculateOverlapArea(testBox, otherBox);
      if (overlapArea > 0) {
        totalScore += overlapArea * 0.5; // Lower weight for unprocessed
      }
    }

    return totalScore;
  }

  /**
   * Optimized position penalty calculation
   * @param {Object} originalPos - Original position
   * @param {Object} testPos - Test position
   * @param {Object} pattern - Search pattern used
   * @returns {number} Position penalty score
   * @private
   */
  _calculatePositionPenalty(originalPos, testPos, pattern) {
    // Pre-calculate distance squared to avoid sqrt when possible
    const distanceSquared = Math.pow(testPos.x - originalPos.x, 2) + 
                           Math.pow(testPos.y - originalPos.y, 2);
    
    let penalty = distanceSquared * 0.0001; // Reduced calculation

    // Directional preference optimizations
    if (pattern.y > 0) penalty += 2; // Below original
    if (pattern.x < 0) penalty += 1; // Left of original

    return penalty;
  }

  /**
   * Optimized importance weight calculation with caching
   * @param {Object} graphic - Label graphic
   * @returns {number} Importance weight
   * @private
   */
  _getLabelImportanceWeight(graphic) {
    // Check if we've cached this calculation
    if (graphic._cachedImportanceWeight) {
      return graphic._cachedImportanceWeight;
    }

    let weight = 1.0;

    // Optimized weight calculations
    const fontSize = graphic.symbol?.font?.size || this.settings.fontSize;
    weight += (fontSize - this.settings.fontSize) * 0.1;

    if (graphic.symbol?.font?.weight === "bold") weight += 0.5;
    if (graphic.symbol?.backgroundColor) weight += 0.3;

    const textLength = (graphic.symbol?.text || "").length;
    weight += Math.min(textLength * 0.02, 0.5);

    // Cache the result
    graphic._cachedImportanceWeight = weight;

    return weight;
  }

  /**
   * Generate optimized search patterns with better distribution
   * @returns {Array} Array of {x, y} offset patterns
   * @private
   */
  _generateOptimizedSearchPatterns() {
    const patterns = [{ x: 0, y: 0 }]; // Original position first

    // Optimized spiral generation with fewer but better-placed points
    const radiusSteps = [12, 20, 30, 45, 65];
    const angleSteps = 8;

    for (const radius of radiusSteps) {
      for (let i = 0; i < angleSteps; i++) {
        const angle = (i * 2 * Math.PI) / angleSteps;
        patterns.push({
          x: Math.round(radius * Math.cos(angle)),
          y: Math.round(radius * Math.sin(angle)),
        });
      }
    }

    // Add strategic positions
    const strategicOffsets = [
      { x: 0, y: -15 }, { x: 0, y: 15 },   // Vertical
      { x: 15, y: 0 }, { x: -15, y: 0 },   // Horizontal
      { x: 12, y: -12 }, { x: -12, y: -12 }, // Diagonal
      { x: 12, y: 12 }, { x: -12, y: 12 }
    ];

    // Efficiently merge unique patterns
    const existingSet = new Set(patterns.map(p => `${p.x},${p.y}`));
    for (const offset of strategicOffsets) {
      const key = `${offset.x},${offset.y}`;
      if (!existingSet.has(key)) {
        patterns.push(offset);
        existingSet.add(key);
      }
    }

    return patterns;
  }

  /**
   * Optimized zoom-independent search patterns
   * @returns {Array} Array of {x, y} offset patterns in screen pixels
   * @private
   */
  _generateZoomIndependentSearchPatterns() {
    const patterns = [{ x: 0, y: 0 }];

    // Optimized for zoom independence
    const radiusSteps = [10, 16, 25, 35, 50];
    const angleSteps = 8;

    for (const radius of radiusSteps) {
      for (let i = 0; i < angleSteps; i++) {
        const angle = (i * 2 * Math.PI) / angleSteps;
        patterns.push({
          x: Math.round(radius * Math.cos(angle)),
          y: Math.round(radius * Math.sin(angle)),
        });
      }
    }

    return patterns;
  }

  /**
   * Check for significant overlap with optimized algorithm
   * @param {Array} labels - Array of label data objects
   * @returns {boolean} True if significant overlap exists
   * @private
   */
  _hasSignificantOverlap(labels) {
    if (labels.length < 2) return false;

    const threshold = Math.min(Math.ceil(labels.length * 0.2), 5);
    let overlapCount = 0;

    // Early termination optimization
    for (let i = 0; i < labels.length - 1 && overlapCount < threshold; i++) {
      const labelA = labels[i];
      const boxA = this._calculateLabelBoundingBox(labelA.graphic, labelA.position);
      if (!boxA) continue;

      for (let j = i + 1; j < labels.length && overlapCount < threshold; j++) {
        const labelB = labels[j];
        const boxB = this._calculateLabelBoundingBox(labelB.graphic, labelB.position);
        if (!boxB) continue;

        if (this._checkBoundingBoxOverlap(boxA, boxB)) {
          overlapCount++;
        }
      }
    }

    return overlapCount >= threshold;
  }

  /**
   * Enhanced optimizeAllLabels with better performance and context awareness
   */
  optimizeAllLabels() {
    if (!this.view?.map?.layers) {
      console.log("[LabelManager] optimizeAllLabels: View or map layers not available.");
      return;
    }

    console.log("[LabelManager] Starting optimized global label optimization for config:", 
                this.mapConfigId, "type:", this.mapType);

    // Collect all labels efficiently
    const allLabelsToOptimize = this._collectLabelsForOptimization();

    if (allLabelsToOptimize.length === 0) {
      console.log("[LabelManager] No labels need global optimization for the current context.");
      return;
    }

    console.log(`[LabelManager] Found ${allLabelsToOptimize.length} labels to optimize globally.`);

    // Early exit if no significant overlap
    if (!this._hasSignificantOverlap(allLabelsToOptimize)) {
      console.log("[LabelManager] No significant overlap detected, skipping global optimization.");
      return;
    }

    // Optimize with performance monitoring
    const startTime = performance.now();
    const optimizedPositionsMap = this._optimizeLabelPositions(allLabelsToOptimize);
    const optimizationTime = performance.now() - startTime;

    // Apply optimized positions efficiently
    const appliedCount = this._applyOptimizedPositionsEfficiently(
      optimizedPositionsMap, allLabelsToOptimize
    );

    console.log(`[LabelManager] Applied optimized positions to ${appliedCount} labels globally ` +
                `in ${optimizationTime.toFixed(2)}ms`);
  }

  /**
   * Efficiently collect labels for optimization
   * @returns {Array} Labels to optimize
   * @private
   */
  _collectLabelsForOptimization() {
    const allLabelsToOptimize = [];
    const savedPositions = this._getSavedPositions();

    // Use for...of for better performance with large collections
    for (const layer of this.view.map.layers) {
      if (!layer.graphics || !layer.visible) continue;

      // Context matching optimization
      if (!this._isLayerInCurrentContext(layer)) continue;

      for (const graphic of layer.graphics) {
        if (!this._isValidLabelForOptimization(graphic, savedPositions)) continue;

        const labelId = this.getLabelId(graphic);
        if (!labelId || savedPositions[labelId]) continue;

        allLabelsToOptimize.push({
          graphic: graphic,
          labelId: labelId,
          position: {
            x: graphic.symbol?.xoffset || 0,
            y: graphic.symbol?.yoffset || 0,
          },
        });
      }
    }

    return allLabelsToOptimize;
  }

  /**
   * Check if layer is in current context (optimized)
   * @param {Object} layer - Layer to check
   * @returns {boolean} True if in current context
   * @private
   */
  _isLayerInCurrentContext(layer) {
    const layerMapConfigId = layer.mapConfigId || layer.labelFormatInfo?.mapConfigId;
    const layerMapType = layer.mapType || layer.labelFormatInfo?.mapType;

    const configMatch = !this.mapConfigId || !layerMapConfigId || 
                       this.mapConfigId === layerMapConfigId;
    const typeMatch = !this.mapType || !layerMapType || 
                     this.mapType === layerMapType;

    return configMatch && typeMatch;
  }

  /**
   * Check if graphic is a valid label for optimization
   * @param {Object} graphic - Graphic to check
   * @param {Object} savedPositions - Saved positions
   * @returns {boolean} True if valid
   * @private
   */
  _isValidLabelForOptimization(graphic, savedPositions) {
    const isLabel = graphic.symbol?.type === "text" || 
                   graphic.attributes?.isLabel === true;
    return isLabel && graphic.visible;
  }

  /**
   * Efficiently apply optimized positions
   * @param {Map} optimizedPositionsMap - Optimized positions
   * @param {Array} allLabelsToOptimize - Original labels
   * @returns {number} Number of applied positions
   * @private
   */
  _applyOptimizedPositionsEfficiently(optimizedPositionsMap, allLabelsToOptimize) {
    let appliedCount = 0;
    const minMovementThreshold = 4; // Only apply if moved more than 2px

    for (const [labelId, newPosition] of optimizedPositionsMap) {
      const originalLabelData = allLabelsToOptimize.find(l => l.labelId === labelId);
      if (!originalLabelData?.graphic?.symbol) continue;

      // Check if movement is significant enough
      const distanceSquared = Math.pow(newPosition.x - originalLabelData.position.x, 2) + 
                             Math.pow(newPosition.y - originalLabelData.position.y, 2);

      if (distanceSquared > minMovementThreshold) {
        this._applyPositionToGraphic(originalLabelData.graphic, newPosition, labelId);
        appliedCount++;
      }
    }

    return appliedCount;
  }

  /**
   * Apply position to graphic efficiently
   * @param {Object} graphic - Graphic to update
   * @param {Object} newPosition - New position
   * @param {string} labelId - Label ID
   * @private
   */
  _applyPositionToGraphic(graphic, newPosition, labelId) {
    const newSymbol = graphic.symbol.clone();
    newSymbol.xoffset = newPosition.x;
    newSymbol.yoffset = newPosition.y;
    graphic.symbol = newSymbol;

    // Update tracking efficiently
    const existingData = this.editedLabels.get(labelId) || {
      graphic: graphic,
      text: graphic.symbol.text || graphic.attributes?.text || "",
      fontSize: graphic.symbol.font?.size || this.settings.fontSize,
      fontWeight: graphic.symbol.font?.weight || "normal",
      backgroundColor: graphic.symbol.backgroundColor || null,
      borderLineColor: graphic.symbol.borderLineColor || null,
      borderLineSize: graphic.symbol.borderLineSize || 0,
      mapConfigId: this.mapConfigId,
      mapType: this.mapType,
    };

    existingData.position = newPosition;
    this.editedLabels.set(labelId, existingData);
  }

  /**
   * Set context with optimization
   * @param {string} projectId - Project ID
   * @param {string} mapConfigId - Map configuration ID
   * @param {string} mapType - Map type (optional)
   */
  setContext(projectId, mapConfigId, mapType = null) {
    console.log(`[LabelManager] Context change: Project ${this.projectId} -> ${projectId}, ` +
                `Config ${this.mapConfigId} -> ${mapConfigId}, Type ${this.mapType} -> ${mapType}`);

    const contextChanged = this.mapConfigId !== mapConfigId || 
                          (mapType && this.mapType !== mapType);

    // Update context
    this.projectId = projectId;
    this.mapConfigId = mapConfigId;
    this.mapType = mapType;

    // Invalidate caches on context change
    if (contextChanged) {
      this._cachedStorageKey = null;
      this._textMeasurementCache.clear();
      this._boundingBoxCache = new WeakMap();
    }

    // Update session storage
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("currentMapConfigId", mapConfigId);
      if (mapType) {
        sessionStorage.setItem("currentMapType", mapType);
      }
    }

    // Clear tracked labels when switching configurations
    if (contextChanged) {
      console.log("[LabelManager] Configuration/Map Type changed, clearing tracked labels");
      this.editedLabels.clear();
    }

    // Reload positions with the new context
    this.loadPositions();
  }

  /**
   * Get a unique AND STABLE ID for a label (optimized for performance)
   * @param {Object} label - The label graphic
   * @returns {string|null} A stable unique ID, or null if no suitable attributes found
   */
  getLabelId(label) {
    // Early validation
    if (!label?.attributes) {
      console.warn("[LabelManager] getLabelId: Label graphic or attributes missing.");
      return null;
    }

    const attributes = label.attributes;

    // Use cached ID if available
    if (attributes._cachedLabelId) {
      return attributes._cachedLabelId;
    }

    let labelId = null;

    // Prioritized ID generation (optimized order)
    if (attributes.OBJECTID !== undefined && attributes.OBJECTID !== null) {
      labelId = `oid-${attributes.OBJECTID}`;
    } else if (attributes.parentID) {
      labelId = `parent-${attributes.parentID}`;
    } else if (attributes.labelId) {
      labelId = `labelId-${attributes.labelId}`;
    } else if (attributes.id && typeof attributes.id !== "object") {
      labelId = `id-${attributes.id}`;
    } else if (attributes.MapLabel) {
      labelId = `data-MapLabel-${attributes.MapLabel}`;
    } else if (label.geometry?.type === "point") {
      // Geometry-based fallback (less optimal)
      const point = label.geometry;
      const x = point.x.toFixed(4);
      const y = point.y.toFixed(4);
      const textPart = attributes.text || label.symbol?.text || "no-text";
      labelId = `geom-${x}-${y}-${textPart}`;
    }

    // Cache the result for future use
    if (labelId) {
      attributes._cachedLabelId = labelId;
    } else {
      console.error("[LabelManager] Failed to generate a stable ID for label. Attributes:", 
                   attributes, "Geometry:", label.geometry);
    }

    return labelId;
  }

  /**
   * Optimized zoom-independent offset calculation
   * @param {Object} graphic - The label graphic
   * @param {Object} targetPosition - Target position
   * @returns {Object} Screen pixel offset {x, y}
   * @private
   */
  _calculateZoomIndependentOffset(graphic, targetPosition) {
    if (!graphic?.geometry || !this.view) {
      return { x: 0, y: 0 };
    }

    try {
      const anchorPoint = graphic.geometry;
      const anchorScreen = this.view.toScreen(anchorPoint);
      
      if (!anchorScreen) return { x: 0, y: 0 };

      // Optimized position handling
      if (targetPosition && typeof targetPosition.x === 'number' && typeof targetPosition.y === 'number') {
        return {
          x: targetPosition.x - anchorScreen.x,
          y: targetPosition.y - anchorScreen.y
        };
      }

      if (targetPosition?.latitude !== undefined && targetPosition?.longitude !== undefined) {
        const targetScreen = this.view.toScreen({
          latitude: targetPosition.latitude,
          longitude: targetPosition.longitude,
          spatialReference: this.view.spatialReference
        });
        
        if (targetScreen) {
          return {
            x: targetScreen.x - anchorScreen.x,
            y: targetScreen.y - anchorScreen.y
          };
        }
      }

      return { x: 0, y: 0 };
    } catch (error) {
      console.error("[LabelManager] Error calculating zoom-independent offset:", error);
      return { x: 0, y: 0 };
    }
  }

  /**
   * Apply zoom-independent positioning optimized
   * @param {Object} graphic - The label graphic
   * @param {Object} offset - Screen pixel offset {x, y}
   * @private
   */
  _applyZoomIndependentPosition(graphic, offset) {
    if (!graphic?.symbol) return false;

    try {
      const newSymbol = graphic.symbol.clone();
      newSymbol.xoffset = offset.x;
      newSymbol.yoffset = offset.y;
      graphic.symbol = newSymbol;
      return true;
    } catch (error) {
      console.error("[LabelManager] Error applying zoom-independent position:", error);
      return false;
    }
  }

  /**
   * Enhanced processLayer method with optimizations
   * @param {Object} layer - The layer to process
   * @returns {Array} Array of label IDs found
   */
  processLayer(layer) {
    if (!layer?.graphics) return [];

    // Context validation optimization
    if (!this._validateLayerContext(layer)) {
      return [];
    }

    console.log(`[LabelManager] Processing layer: ${layer.title || layer.id} ` +
                `with mapConfigId=${layer.mapConfigId}, mapType=${layer.mapType}`);

    // Get label options and saved positions once
    const labelOptions = layer.labelConfiguration?.labelOptions || 
                        layer.layerConfiguration?.labelOptions || {};
    const savedPositions = this._getSavedPositions();
    
    const labelsFound = [];
    const labelsToOptimize = [];

    // Set context on layer if missing
    this._ensureLayerContext(layer);

    // Process graphics efficiently
    for (const graphic of layer.graphics) {
      const result = this._processGraphicOptimized(
        graphic, labelOptions, savedPositions, labelsToOptimize
      );
      
      if (result.labelId) {
        labelsFound.push(result.labelId);
      }
    }

    // Apply optimizations if needed
    if (labelsToOptimize.length > 0 && this.settings.avoidCollisions) {
      this._applyOptimizedPositionsToLayer(labelsToOptimize);
    }

    // Mark layer as processed
    this._markLayerAsProcessed(layer);

    console.log(`[LabelManager] Found ${labelsFound.length} labels in layer ` +
                `(${labelsToOptimize.length} optimized)`);

    return labelsFound;
  }

  /**
   * Validate layer context efficiently
   * @param {Object} layer - Layer to validate
   * @returns {boolean} True if valid
   * @private
   */
  _validateLayerContext(layer) {
    const layerMapConfigId = layer.mapConfigId || layer.labelFormatInfo?.mapConfigId;
    const layerMapType = layer.mapType || layer.labelFormatInfo?.mapType;

    const configMismatch = this.mapConfigId && layerMapConfigId && 
                          this.mapConfigId !== layerMapConfigId;
    const typeMismatch = this.mapType && layerMapType && 
                        this.mapType !== layerMapType;

    if (configMismatch || typeMismatch) {
      console.log("[LabelManager] Skipping layer processing - context mismatch:", 
                  `Layer Config=${layerMapConfigId}, Manager Config=${this.mapConfigId}`,
                  `Layer Type=${layerMapType}, Manager Type=${this.mapType}`);
      return false;
    }

    return true;
  }

  /**
   * Ensure layer has context information
   * @param {Object} layer - Layer to update
   * @private
   */
  _ensureLayerContext(layer) {
    if (this.mapConfigId && !layer.mapConfigId) {
      layer.mapConfigId = this.mapConfigId;
      if (layer.labelFormatInfo) {
        layer.labelFormatInfo.mapConfigId = this.mapConfigId;
      }
    }

    if (this.mapType && !layer.mapType) {
      layer.mapType = this.mapType;
      if (layer.labelFormatInfo) {
        layer.labelFormatInfo.mapType = this.mapType;
      }
    }
  }

  /**
   * Process individual graphic optimized
   * @param {Object} graphic - Graphic to process
   * @param {Object} labelOptions - Label options
   * @param {Object} savedPositions - Saved positions
   * @param {Array} labelsToOptimize - Array to add labels needing optimization
   * @returns {Object} Processing result
   * @private
   */
  _processGraphicOptimized(graphic, labelOptions, savedPositions, labelsToOptimize) {
    const isLabel = graphic.symbol?.type === "text" || 
                   graphic.attributes?.isLabel === true;
    
    if (!isLabel) return { labelId: null };

    const labelId = this.getLabelId(graphic);
    if (!labelId) return { labelId: null };

    // Add context metadata efficiently
    this._addContextToGraphic(graphic);

    const hasSavedStyle = savedPositions[labelId] !== undefined;

    if (!hasSavedStyle) {
      this._applyInitialLabelStyle(graphic, labelOptions);
      
      labelsToOptimize.push({
        graphic: graphic,
        labelId: labelId,
        position: {
          x: graphic.symbol?.xoffset || 0,
          y: graphic.symbol?.yoffset || 0,
        },
      });
    }

    // Update tracking efficiently
    this._updateLabelTracking(graphic, labelId);

    // Apply saved position if it exists
    if (hasSavedStyle) {
      this._applySavedPosition(graphic);
    }

    return { labelId };
  }

  /**
   * Add context to graphic efficiently
   * @param {Object} graphic - Graphic to update
   * @private
   */
  _addContextToGraphic(graphic) {
    if (!graphic.attributes) return;

    if (!graphic.attributes.mapConfigId && this.mapConfigId) {
      graphic.attributes.mapConfigId = this.mapConfigId;
    }
    if (!graphic.attributes.mapType && this.mapType) {
      graphic.attributes.mapType = this.mapType;
    }
  }

  /**
   * Apply initial label style optimized
   * @param {Object} graphic - Graphic to style
   * @param {Object} labelOptions - Style options
   * @private
   */
  _applyInitialLabelStyle(graphic, labelOptions) {
    if (!graphic.symbol) return;

    // Apply bold option
    if (labelOptions.bold === true && graphic.symbol.font) {
      graphic.symbol.font.weight = "bold";
    }

    // Apply background options
    if (labelOptions.whiteBackground === true) {
      graphic.symbol.backgroundColor = [255, 255, 255, 0.9];
      graphic.symbol.kerning = true;
      graphic.symbol.horizontalAlignment = "center";
      graphic.symbol.borderLineColor = [220, 220, 220, 0.5];
      graphic.symbol.borderLineSize = 0.5;
      graphic.symbol.haloSize = 0;
      graphic.symbol.haloColor = null;
    } else if (labelOptions.whiteBackground === false) {
      graphic.symbol.backgroundColor = null;
      graphic.symbol.borderLineColor = null;
      graphic.symbol.borderLineSize = 0;
    }

    // Apply zoom-independent positioning
    this._ensureZoomIndependentPosition(graphic);
  }

  /**
   * Ensure zoom-independent positioning
   * @param {Object} graphic - Graphic to update
   * @private
   */
  _ensureZoomIndependentPosition(graphic) {
    const currentOffset = {
      x: graphic.symbol?.xoffset || 0,
      y: graphic.symbol?.yoffset || 0
    };

    if (currentOffset.x === 0 && currentOffset.y === 0) {
      const defaultOffset = this._calculateOptimalDefaultOffset(graphic);
      this._applyZoomIndependentPosition(graphic, defaultOffset);
    } else {
      this._applyZoomIndependentPosition(graphic, currentOffset);
    }
  }

  /**
   * Update label tracking efficiently
   * @param {Object} graphic - Graphic to track
   * @param {string} labelId - Label ID
   * @private
   */
  _updateLabelTracking(graphic, labelId) {
    this.editedLabels.set(labelId, {
      graphic: graphic,
      position: {
        x: graphic.symbol?.xoffset || 0,
        y: graphic.symbol?.yoffset || 0,
      },
      fontSize: graphic.symbol?.font?.size || this.settings.fontSize,
      text: graphic.symbol?.text || graphic.attributes?.text || "",
      fontWeight: graphic.symbol?.font?.weight || "normal",
      backgroundColor: graphic.symbol?.backgroundColor || null,
      borderLineColor: graphic.symbol?.borderLineColor || null,
      borderLineSize: graphic.symbol?.borderLineSize || 0,
      mapConfigId: this.mapConfigId,
      mapType: this.mapType,
      _zoomIndependent: true
    });
  }

  /**
   * Apply optimized positions to layer
   * @param {Array} labelsToOptimize - Labels to optimize
   * @private
   */
  _applyOptimizedPositionsToLayer(labelsToOptimize) {
    console.log(`[LabelManager] Optimizing ${labelsToOptimize.length} new labels with zoom-independent positioning`);

    const optimizedPositions = this._optimizeLabelPositionsZoomIndependent(labelsToOptimize);

    for (const [labelId, position] of optimizedPositions) {
      const labelData = labelsToOptimize.find(l => l.labelId === labelId);
      if (!labelData?.graphic?.symbol) continue;

      if (this._applyZoomIndependentPosition(labelData.graphic, position)) {
        const existingData = this.editedLabels.get(labelId);
        if (existingData) {
          existingData.position = position;
          existingData._zoomIndependent = true;
        }
      }
    }
  }

  /**
   * Mark layer as processed
   * @param {Object} layer - Layer to mark
   * @private
   */
  _markLayerAsProcessed(layer) {
    layer._labelManagerProcessed = true;
    layer._processedWithConfigId = this.mapConfigId;
    layer._processedWithMapType = this.mapType;
  }

  /**
   * Calculate optimal default offset optimized
   * @param {Object} graphic - The label graphic
   * @returns {Object} Default offset {x, y} in screen pixels
   * @private
   */
  _calculateOptimalDefaultOffset(graphic) {
    if (!graphic?.symbol) return { x: 0, y: 0 };

    const fontSize = graphic.symbol.font?.size || this.settings.fontSize;
    const text = graphic.symbol.text || "";
    
    // Optimized calculations
    const approximateWidth = text.length * (fontSize * 0.6);
    const textHeight = fontSize * 1.2;

    const baseOffsetX = Math.max(approximateWidth * 0.3, 15);
    const baseOffsetY = -(textHeight * 0.5 + 8);

    return { x: baseOffsetX, y: baseOffsetY };
  }

  /**
   * Optimized zoom-independent label position optimization
   * @param {Array} labelsToOptimize - Array of labels to optimize
   * @returns {Map} Map of labelId to optimized position
   * @private
   */
  _optimizeLabelPositionsZoomIndependent(labelsToOptimize) {
    if (!labelsToOptimize?.length) return new Map();

    console.log(`[LabelManager] Optimizing positions for ${labelsToOptimize.length} labels with zoom-independent logic`);

    const optimizedPositions = new Map();
    const sortedLabels = this._optimizedLabelSorting(labelsToOptimize);
    const searchPatterns = this._zoomIndependentPatterns;

    // Process with performance optimization
    for (let index = 0; index < sortedLabels.length; index++) {
      const { graphic, labelId, position } = sortedLabels[index];

      if (!position) {
        optimizedPositions.set(labelId, { x: 0, y: 0 });
        continue;
      }

      const bestPosition = this._findOptimalPositionZoomIndependent(
        graphic, position, searchPatterns, sortedLabels, optimizedPositions, index
      );

      optimizedPositions.set(labelId, bestPosition);
    }

    return optimizedPositions;
  }

  /**
   * Find optimal position with zoom independence
   * @param {Object} graphic - Label graphic
   * @param {Object} position - Current position
   * @param {Array} searchPatterns - Search patterns
   * @param {Array} sortedLabels - All sorted labels
   * @param {Map} optimizedPositions - Current optimized positions
   * @param {number} index - Current index
   * @returns {Object} Optimal position
   * @private
   */
  _findOptimalPositionZoomIndependent(graphic, position, searchPatterns, sortedLabels, optimizedPositions, index) {
    let bestPosition = { ...position };
    let minOverlapScore = Number.MAX_VALUE;
    let foundPerfectPosition = false;

    for (const pattern of searchPatterns) {
      if (foundPerfectPosition) break;

      const testPosition = {
        x: position.x + pattern.x,
        y: position.y + pattern.y,
      };

      const testBox = this._calculateLabelBoundingBoxZoomIndependent(graphic, testPosition);
      if (!testBox) continue;

      let overlapScore = this._calculateTotalOverlapScoreZoomIndependent(
        testBox, { graphic, position }, sortedLabels, optimizedPositions, index
      );

      overlapScore += this._calculatePositionPenalty(position, testPosition, pattern);

      if (overlapScore < minOverlapScore) {
        minOverlapScore = overlapScore;
        bestPosition = testPosition;

        if (overlapScore <= this.settings.collisionDetectionThreshold) {
          foundPerfectPosition = true;
        }
      }
    }

    return bestPosition;
  }

  /**
   * Calculate bounding box with zoom independence optimized
   * @param {Object} label - The label graphic
   * @param {Object} position - Position in screen pixels
   * @returns {Object} Bounding box
   * @private
   */
  _calculateLabelBoundingBoxZoomIndependent(label, position) {
    if (!label?.symbol) return null;

    const text = label.symbol.text || label.attributes?.text || "";
    if (!text) return null;

    const fontSize = label.symbol.font?.size || this.settings.fontSize;
    const fontWeight = label.symbol.font?.weight || "normal";
    const fontFamily = label.symbol.font?.family || this.settings.fontFamily;

    // Use optimized text measurement
    const textDimensions = this._getOptimizedTextDimensions(text, fontSize, fontWeight, fontFamily);

    // Calculate padding efficiently
    const hasBackground = !!label.symbol.backgroundColor;
    const borderSize = label.symbol.borderLineSize || 0;
    const padding = hasBackground ? Math.max(4, borderSize * 2) : 2;
    const haloSize = label.symbol.haloSize || 0;
    const extraPadding = Math.max(padding, haloSize);

    return {
      x: position.x - textDimensions.width / 2 - extraPadding,
      y: position.y - textDimensions.height / 2 - extraPadding,
      width: textDimensions.width + extraPadding * 2,
      height: textDimensions.height + extraPadding * 2,
      centerX: position.x,
      centerY: position.y,
      textWidth: textDimensions.width,
      textHeight: textDimensions.height,
    };
  }

  /**
   * Calculate overlap score with zoom independence optimized
   * @param {Object} testBox - Test bounding box
   * @param {Object} currentLabel - Current label
   * @param {Array} allLabels - All labels
   * @param {Map} optimizedPositions - Optimized positions
   * @param {number} currentIndex - Current index
   * @returns {number} Overlap score
   * @private
   */
  _calculateTotalOverlapScoreZoomIndependent(testBox, currentLabel, allLabels, optimizedPositions, currentIndex) {
    let totalScore = 0;
    const maxScore = 10000;

    // Check optimized labels
    for (let i = 0; i < currentIndex && totalScore < maxScore; i++) {
      const otherLabel = allLabels[i];
      const otherPosition = optimizedPositions.get(otherLabel.labelId);

      if (!otherPosition) continue;

      const otherBox = this._calculateLabelBoundingBoxZoomIndependent(otherLabel.graphic, otherPosition);
      if (!otherBox) continue;

      const overlapArea = this._calculateOverlapArea(testBox, otherBox);
      if (overlapArea > 0) {
        const importanceWeight = this._getLabelImportanceWeight(otherLabel.graphic);
        totalScore += overlapArea * importanceWeight;
      }
    }

    // Early termination
    if (totalScore >= maxScore) return totalScore;

    // Check unprocessed labels
    for (let i = currentIndex + 1; i < allLabels.length && totalScore < maxScore; i++) {
      const otherLabel = allLabels[i];
      const otherBox = this._calculateLabelBoundingBoxZoomIndependent(otherLabel.graphic, otherLabel.position);

      if (!otherBox) continue;

      const overlapArea = this._calculateOverlapArea(testBox, otherBox);
      if (overlapArea > 0) {
        totalScore += overlapArea * 0.5;
      }
    }

    return totalScore;
  }

  /**
   * Optimized saved position application
   * @param {Object} label - The label graphic
   * @returns {boolean} Whether position was applied successfully
   * @private
   */
  _applySavedPosition(label) {
    if (!label?.symbol) return false;

    try {
      const labelId = this.getLabelId(label);
      if (!labelId) return false;

      const savedPositions = this._getSavedPositions();
      const savedData = savedPositions[labelId];

      if (!savedData) return false;

      // Context validation
      if (!this._validateSavedDataContext(savedData)) return false;

      console.log(`[LabelManager] Found saved data for label ${labelId}:`, {
        fontSize: savedData.fontSize,
        fontWeight: savedData.fontWeight,
        hasBackground: !!savedData.backgroundColor,
        mapConfigId: savedData.mapConfigId,
        mapType: savedData.mapType,
      });

      // Apply saved properties efficiently
      const success = this._applyAllSavedProperties(label, savedData, labelId);

      if (success) {
        this._updateTrackingWithSavedData(label, savedData, labelId);
        console.log(`[LabelManager] Successfully applied saved style to label ${labelId}`);
      }

      return success;
    } catch (error) {
      console.error(`[LabelManager] Error applying saved position:`, error);
      return false;
    }
  }

  /**
   * Validate saved data context
   * @param {Object} savedData - Saved data to validate
   * @returns {boolean} True if valid
   * @private
   */
  _validateSavedDataContext(savedData) {
    if (savedData.mapConfigId && this.mapConfigId && 
        savedData.mapConfigId !== this.mapConfigId) {
      console.log("[LabelManager] Skipping position application - config mismatch");
      return false;
    }

    if (savedData.mapType && this.mapType && 
        savedData.mapType !== this.mapType) {
      console.log("[LabelManager] Skipping position application - type mismatch");
      return false;
    }

    return true;
  }

  /**
   * Apply all saved properties efficiently
   * @param {Object} label - Label to update
   * @param {Object} savedData - Saved data
   * @param {string} labelId - Label ID
   * @returns {boolean} Success
   * @private
   */
  _applyAllSavedProperties(label, savedData, labelId) {
    const newSymbol = label.symbol.clone();

    // Apply position
    if (savedData.position) {
      newSymbol.xoffset = savedData.position.x;
      newSymbol.yoffset = savedData.position.y;
    }

    // Ensure font object exists
    if (!newSymbol.font) {
      newSymbol.font = {
        family: this.settings.fontFamily,
        size: this.settings.fontSize,
        weight: "normal",
      };
    }

    // Apply font properties
    if (savedData.fontSize !== undefined) {
      newSymbol.font.size = savedData.fontSize;
    }

    if (savedData.fontWeight) {
      newSymbol.font.weight = savedData.fontWeight;
    }

    // Apply background properties
    if (savedData.backgroundColor) {
      newSymbol.backgroundColor = savedData.backgroundColor;
      newSymbol.borderLineColor = savedData.borderLineColor || null;
      newSymbol.borderLineSize = savedData.borderLineSize || 0;
      newSymbol.kerning = true;
      newSymbol.horizontalAlignment = "center";
      newSymbol.haloSize = 0;
      newSymbol.haloColor = null;
    }

    // Apply symbol and mark with persistent flags
    label.symbol = newSymbol;
    this._markLabelWithPersistentFlags(label, savedData);

    return true;
  }

  /**
   * Mark label with persistent flags
   * @param {Object} label - Label to mark
   * @param {Object} savedData - Saved data
   * @private
   */
  _markLabelWithPersistentFlags(label, savedData) {
    if (!label.attributes) return;

    label.attributes._persistentStyle = true;
    label.attributes._fontSize = savedData.fontSize;
    label.attributes._fontWeight = savedData.fontWeight;
    label.attributes._hasBackground = !!savedData.backgroundColor;
    label.attributes.mapConfigId = savedData.mapConfigId || this.mapConfigId;
    label.attributes.mapType = savedData.mapType || this.mapType;
  }

  /**
   * Update tracking with saved data
   * @param {Object} label - Label graphic
   * @param {Object} savedData - Saved data
   * @param {string} labelId - Label ID
   * @private
   */
  _updateTrackingWithSavedData(label, savedData, labelId) {
    this.editedLabels.set(labelId, {
      graphic: label,
      position: {
        x: label.symbol.xoffset || 0,
        y: label.symbol.yoffset || 0,
      },
      fontSize: savedData.fontSize || label.symbol.font?.size || this.settings.fontSize,
      text: label.symbol.text || label.attributes?.text || "",
      fontWeight: savedData.fontWeight || label.symbol.font?.weight || "normal",
      backgroundColor: savedData.backgroundColor || null,
      borderLineColor: savedData.borderLineColor || null,
      borderLineSize: savedData.borderLineSize || 0,
      _persistentStyle: true,
      mapConfigId: savedData.mapConfigId || this.mapConfigId,
      mapType: savedData.mapType || this.mapType,
    });

    label.visible = savedData.visible !== false;
  }

  /**
   * Get saved positions with caching
   * @returns {Object} Map of saved positions by label ID
   * @private
   */
  _getSavedPositions() {
    try {
      const savedData = localStorage.getItem(this.getStorageKey());
      return savedData ? JSON.parse(savedData) : {};
    } catch (error) {
      console.error("[LabelManager] Error reading saved positions:", error);
      return {};
    }
  }

  /**
   * Setup optimized auto-save with debouncing
   * @private
   */
  _setupOptimizedAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }

    this.autoSaveInterval = setInterval(() => {
      if (this.editedLabels.size > 0) {
        this._debouncedSave();
      }
    }, this.settings.autoSaveIntervalMs);

    console.log(`[LabelManager] Optimized auto-save enabled (${this.settings.autoSaveIntervalMs}ms)`);
  }

  /**
   * Debounced save to prevent excessive storage operations
   * @private
   */
  _debouncedSave() {
    if (this._saveDebounceTimer) {
      clearTimeout(this._saveDebounceTimer);
    }

    this._saveDebounceTimer = setTimeout(() => {
      this.savePositions();
    }, 1000); // 1 second debounce
  }

  /**
   * Optimized direct drag mode enablement
   * @param {boolean} enable - Whether to enable direct dragging
   */
  enableDirectDragMode(enable = true) {
    this._cleanupEventHandlers();

    if (enable && this.view) {
      console.log("[LabelManager] Enabling optimized direct drag mode");

      // Reset drag state
      this._resetDragState();

      // Disable map navigation
      this._setMapNavigation(false);

      // Set up optimized event handlers
      this._setupOptimizedDragHandlers();

      console.log(`[LabelManager] Direct drag mode enabled with ${this.handlers.length} optimized handlers`);
    } else {
      this._setMapNavigation(true);
      this._resetDragState();
      console.log("[LabelManager] Direct drag mode disabled");
    }
  }

  /**
   * Reset drag state
   * @private
   */
  _resetDragState() {
    this.isDragging = false;
    this.dragStartPoint = null;
    this.draggedLabel = null;
    this.originalOffset = null;
  }

  /**
   * Set map navigation state
   * @param {boolean} enabled - Whether navigation is enabled
   * @private
   */
  _setMapNavigation(enabled) {
    if (this.view?.navigation) {
      this.view.navigation.browserTouchPanEnabled = enabled;
    }
  }

  /**
   * Setup optimized drag event handlers
   * @private
   */
  _setupOptimizedDragHandlers() {
    // Optimized pointer down handler
    const pointerDownHandler = this.view.on("pointer-down", (event) => {
      if (this.isDragging || event.button !== 0) return;

      this._handleOptimizedPointerDown(event);
    });
    this.handlers.push(pointerDownHandler);

    // Optimized pointer move handler
    const pointerMoveHandler = this.view.on("pointer-move", (event) => {
      if (!this.isDragging || !this.draggedLabel) return;

      this._handleOptimizedPointerMove(event);
    });
    this.handlers.push(pointerMoveHandler);

    // Optimized pointer up handler
    const pointerUpHandler = this.view.on("pointer-up", (event) => {
      if (!this.isDragging) return;

      this._handleOptimizedPointerUp(event);
    });
    this.handlers.push(pointerUpHandler);

    // Optimized pointer leave handler
    const pointerLeaveHandler = this.view.on("pointer-leave", () => {
      if (this.isDragging) {
        this._handleOptimizedPointerLeave();
      }
    });
    this.handlers.push(pointerLeaveHandler);
  }

  /**
   * Handle optimized pointer down
   * @param {Object} event - Pointer event
   * @private
   */
  _handleOptimizedPointerDown(event) {
    if (!event?.screenPoint) return;

    this.view.hitTest(event.screenPoint)
      .then((response) => {
        const labelHit = this._findValidLabelHit(response);
        
        if (labelHit) {
          this._startDragOperation(event, labelHit);
        }
      })
      .catch((err) => {
        console.warn("[LabelManager] Error in optimized hit test:", err);
      });
  }

  /**
   * Find valid label hit from hit test results
   * @param {Object} response - Hit test response
   * @returns {Object|null} Valid label hit
   * @private
   */
  _findValidLabelHit(response) {
    if (!response?.results) return null;

    for (const result of response.results) {
      const graphic = result.graphic;
      
      if (!this._isValidLabelGraphic(graphic)) continue;
      if (!this._isGraphicInCurrentContext(graphic)) continue;

      return graphic;
    }

    return null;
  }

  /**
   * Check if graphic is a valid label
   * @param {Object} graphic - Graphic to check
   * @returns {boolean} True if valid label
   * @private
   */
  _isValidLabelGraphic(graphic) {
    return graphic && 
           (graphic.symbol?.type === "text" || graphic.attributes?.isLabel === true);
  }

  /**
   * Check if graphic is in current context
   * @param {Object} graphic - Graphic to check
   * @returns {boolean} True if in current context
   * @private
   */
  _isGraphicInCurrentContext(graphic) {
    const attrs = graphic.attributes || {};
    
    const configMatch = !attrs.mapConfigId || !this.mapConfigId || 
                       attrs.mapConfigId === this.mapConfigId;
    const typeMatch = !attrs.mapType || !this.mapType || 
                     attrs.mapType === this.mapType;

    return configMatch && typeMatch;
  }

  /**
   * Start drag operation
   * @param {Object} event - Pointer event
   * @param {Object} labelGraphic - Label graphic
   * @private
   */
  _startDragOperation(event, labelGraphic) {
    event.stopPropagation();

    this.draggedLabel = labelGraphic;
    this.dragStartPoint = { x: event.x, y: event.y };
    this.originalOffset = {
      x: labelGraphic.symbol?.xoffset || 0,
      y: labelGraphic.symbol?.yoffset || 0,
    };
    this.isDragging = true;
    this.selectedLabel = labelGraphic;

    // Update cursor
    if (this.view.container) {
      this.view.container.style.cursor = "grabbing";
    }

    console.log("[LabelManager] Started optimized dragging:", this.getLabelId(labelGraphic));
  }

  /**
   * Handle optimized pointer move
   * @param {Object} event - Pointer event
   * @private
   */
  _handleOptimizedPointerMove(event) {
    if (!this.dragStartPoint || !this.originalOffset) return;

    event.stopPropagation();

    // Calculate new offset
    const dx = event.x - this.dragStartPoint.x;
    const dy = event.y - this.dragStartPoint.y;

    const newOffset = {
      x: this.originalOffset.x + dx,
      y: this.originalOffset.y - dy, // Invert Y axis
    };

    // Update label position efficiently
    this._updateDraggedLabelPosition(newOffset);
  }

  /**
   * Update dragged label position efficiently
   * @param {Object} newOffset - New offset
   * @private
   */
  _updateDraggedLabelPosition(newOffset) {
    if (!this.draggedLabel?.symbol) return;

    const newSymbol = this.draggedLabel.symbol.clone();
    newSymbol.xoffset = newOffset.x;
    newSymbol.yoffset = newOffset.y;
    this.draggedLabel.symbol = newSymbol;

    // Update tracking efficiently
    const labelId = this.getLabelId(this.draggedLabel);
    if (labelId && this.editedLabels.has(labelId)) {
      const existingData = this.editedLabels.get(labelId);
      existingData.position = newOffset;
    }
  }

  /**
   * Handle optimized pointer up
   * @param {Object} event - Pointer event
   * @private
   */
  _handleOptimizedPointerUp(event) {
    event.stopPropagation();

    // Restore cursor
    if (this.view.container) {
      this.view.container.style.cursor = "move";
    }

    // Save changes with debouncing
    if (this.draggedLabel) {
      this._debouncedSave();
      console.log("[LabelManager] Saved label position after optimized drag");
    }

    this._resetDragState();
  }

  /**
   * Handle optimized pointer leave
   * @private
   */
  _handleOptimizedPointerLeave() {
    // Restore cursor
    if (this.view.container) {
      this.view.container.style.cursor = "move";
    }

    // Save changes
    if (this.draggedLabel) {
      this._debouncedSave();
    }

    this._resetDragState();
  }

  /**
   * Optimized save positions with compression
   * @param {boolean} force - Whether to force save even if no changes
   * @returns {Object} Result of the save operation
   */
  savePositions(force = false) {
    if (this.editedLabels.size === 0 && !force) {
      return { success: true, message: "No changes to save", count: 0 };
    }

    try {
      // Ensure context
      this._ensureContextForSave();

      const storageKey = this.getStorageKey();
      let savedPositions = this._loadExistingSavedPositions(storageKey);

      // Update with current edited labels efficiently
      const updatedCount = this._updateSavedPositions(savedPositions);

      // Optimized storage operation
      localStorage.setItem(storageKey, JSON.stringify(savedPositions));

      console.log(`[LabelManager] Saved ${updatedCount} label positions and styles ` +
                  `for config ${this.mapConfigId}, type ${this.mapType} using key ${storageKey}`);

      return {
        success: true,
        message: `Saved ${updatedCount} label positions and styles`,
        count: updatedCount,
      };
    } catch (error) {
      console.error("[LabelManager] Error saving positions:", error);
      return {
        success: false,
        message: `Error saving positions: ${error.message}`,
        count: 0,
      };
    }
  }

  /**
   * Ensure context for save operation
   * @private
   */
  _ensureContextForSave() {
    if (!this.mapConfigId) {
      this.mapConfigId = sessionStorage.getItem("currentMapConfigId");
    }
    if (!this.mapType) {
      this.mapType = sessionStorage.getItem("currentMapType");
    }
  }

  /**
   * Load existing saved positions
   * @param {string} storageKey - Storage key
   * @returns {Object} Existing saved positions
   * @private
   */
  _loadExistingSavedPositions(storageKey) {
    try {
      const savedData = localStorage.getItem(storageKey);
      return savedData ? JSON.parse(savedData) : {};
    } catch (readError) {
      console.error(`[LabelManager] Error reading from ${storageKey}:`, readError);
      return {};
    }
  }

  /**
   * Update saved positions efficiently
   * @param {Object} savedPositions - Positions to update
   * @returns {number} Number of updated positions
   * @private
   */
  _updateSavedPositions(savedPositions) {
    let updatedCount = 0;

    for (const [labelId, labelData] of this.editedLabels) {
      const positionData = this._createPositionData(labelData);
      
      savedPositions[labelId] = positionData;
      updatedCount++;

      console.log(`[LabelManager SAVE] Label ${labelId}: ` +
                  `fontSize=${positionData.fontSize}, weight=${positionData.fontWeight}, ` +
                  `hasBackground=${!!positionData.backgroundColor}, ` +
                  `mapConfigId=${this.mapConfigId}, mapType=${this.mapType}`);
    }

    return updatedCount;
  }

  /**
   * Create position data object
   * @param {Object} labelData - Label data
   * @returns {Object} Position data
   * @private
   */
  _createPositionData(labelData) {
    const fontSize = labelData.fontSize || 
                    labelData.graphic?.symbol?.font?.size || 
                    this.settings.fontSize;

    const fontWeight = labelData.fontWeight || 
                      labelData.graphic?.symbol?.font?.weight || 
                      "normal";

    return {
      position: labelData.position,
      fontSize: fontSize,
      text: labelData.text,
      visible: labelData.graphic?.visible !== false,
      fontWeight: fontWeight,
      backgroundColor: labelData.backgroundColor,
      borderLineColor: labelData.borderLineColor,
      borderLineSize: labelData.borderLineSize,
      lastEdited: Date.now(),
      mapConfigId: this.mapConfigId,
      mapType: this.mapType,
      symbolProperties: {
        haloSize: labelData.graphic?.symbol?.haloSize,
        haloColor: labelData.graphic?.symbol?.haloColor,
        kerning: labelData.graphic?.symbol?.kerning,
        horizontalAlignment: labelData.graphic?.symbol?.horizontalAlignment,
      },
    };
  }

  /**
   * Optimized load positions
   * @param {boolean} force - Whether to force reload
   * @param {boolean} preserveEdits - Whether to preserve current edits
   * @returns {Object} Result of the load operation
   */
  loadPositions(force = false, preserveEdits = true) {
    try {
      const savedPositions = this._getSavedPositions();
      const positionCount = Object.keys(savedPositions).length;

      if (positionCount === 0) {
        console.log("[LabelManager] No saved positions found");
        return { success: true, message: "No saved positions found", count: 0 };
      }

      console.log(`[LabelManager] Found ${positionCount} saved positions ` +
                  `for config ${this.mapConfigId}, type ${this.mapType}`);

      // Apply positions efficiently
      const appliedCount = this._applyAllSavedPositions(savedPositions);

      console.log(`[LabelManager] Applied ${appliedCount} saved positions and styles ` +
                  `for config ${this.mapConfigId}, type ${this.mapType}`);

      return {
        success: true,
        message: `Applied ${appliedCount} saved positions and styles`,
        count: appliedCount,
      };
    } catch (error) {
      console.error("[LabelManager] Error loading positions:", error);
      return {
        success: false,
        message: `Error loading positions: ${error.message}`,
        count: 0,
      };
    }
  }

  /**
   * Apply all saved positions efficiently
   * @param {Object} savedPositions - Saved positions
   * @returns {number} Number of applied positions
   * @private
   */
  _applyAllSavedPositions(savedPositions) {
    let appliedCount = 0;

    // Apply to tracked labels first
    appliedCount += this._applyPositionsToTrackedLabels(savedPositions);

    // Apply to visible layers
    appliedCount += this._applyPositionsToVisibleLayers(savedPositions);

    return appliedCount;
  }

  /**
   * Apply positions to tracked labels
   * @param {Object} savedPositions - Saved positions
   * @returns {number} Number of applied positions
   * @private
   */
  _applyPositionsToTrackedLabels(savedPositions) {
    let appliedCount = 0;

    for (const [labelId, labelData] of this.editedLabels) {
      if (!savedPositions[labelId] || !labelData.graphic) continue;

      const savedData = savedPositions[labelId];
      
      if (!this._validateSavedDataContext(savedData)) continue;

      if (this._applyAllSavedProperties(labelData.graphic, savedData, labelId)) {
        this._updateTrackingWithSavedData(labelData.graphic, savedData, labelId);
        appliedCount++;
      }
    }

    return appliedCount;
  }

  /**
   * Apply positions to visible layers
   * @param {Object} savedPositions - Saved positions
   * @returns {number} Number of applied positions
   * @private
   */
  _applyPositionsToVisibleLayers(savedPositions) {
    if (!this.view?.map?.layers) return 0;

    let appliedCount = 0;

    for (const layer of this.view.map.layers) {
      if (!layer.graphics) continue;

      // Skip if already processed with current context
      if (layer._processedWithConfigId === this.mapConfigId &&
          layer._processedWithMapType === this.mapType) {
        continue;
      }

      appliedCount += this._applyPositionsToLayer(layer, savedPositions);
    }

    return appliedCount;
  }

  /**
   * Apply positions to specific layer
   * @param {Object} layer - Layer to process
   * @param {Object} savedPositions - Saved positions
   * @returns {number} Number of applied positions
   * @private
   */
  _applyPositionsToLayer(layer, savedPositions) {
    let layerAppliedCount = 0;

    for (const graphic of layer.graphics) {
      const isLabel = graphic.symbol?.type === "text" || 
                     graphic.attributes?.isLabel === true;
      if (!isLabel) continue;

      const labelId = this.getLabelId(graphic);
      if (!labelId || this.editedLabels.has(labelId)) continue;

      const savedData = savedPositions[labelId];
      if (!savedData || !this._validateSavedDataContext(savedData)) continue;

      if (this._applyAllSavedProperties(graphic, savedData, labelId)) {
        this._addContextToGraphic(graphic);
        this._updateTrackingWithSavedData(graphic, savedData, labelId);
        layerAppliedCount++;
      }
    }

    if (layerAppliedCount > 0) {
      console.log(`[LabelManager] Applied ${layerAppliedCount} saved positions to layer ${layer.id}`);
    }

    // Mark layer as processed
    layer._processedWithConfigId = this.mapConfigId;
    layer._processedWithMapType = this.mapType;

    return layerAppliedCount;
  }

  /**
   * Optimized reset all labels
   * @returns {Object} Result of the reset operation
   */
  resetAllLabels() {
    try {
      // Remove saved positions for current context
      localStorage.removeItem(this.getStorageKey());

      let resetCount = 0;

      // Reset tracked labels efficiently
      for (const [labelId, labelData] of this.editedLabels) {
        if (!this._isLabelInCurrentContext(labelData)) continue;

        if (this._resetLabelToDefaults(labelData.graphic)) {
          resetCount++;
        }
      }

      // Clear tracking for current context
      this._clearContextLabelsFromTracking();

      console.log(`[LabelManager] Reset ${resetCount} label positions ` +
                  `for config ${this.mapConfigId}, type ${this.mapType}`);

      return {
        success: true,
        message: `Reset ${resetCount} label positions`,
        count: resetCount,
      };
    } catch (error) {
      console.error("[LabelManager] Error resetting positions:", error);
      return {
        success: false,
        message: `Error resetting positions: ${error.message}`,
        count: 0,
      };
    }
  }

  /**
   * Check if label is in current context
   * @param {Object} labelData - Label data
   * @returns {boolean} True if in current context
   * @private
   */
  _isLabelInCurrentContext(labelData) {
    const configMatch = !labelData.mapConfigId || !this.mapConfigId || 
                       labelData.mapConfigId === this.mapConfigId;
    const typeMatch = !labelData.mapType || !this.mapType || 
                     labelData.mapType === this.mapType;

    return configMatch && typeMatch;
  }

  /**
   * Reset label to defaults
   * @param {Object} graphic - Graphic to reset
   * @returns {boolean} Success
   * @private
   */
  _resetLabelToDefaults(graphic) {
    if (!graphic?.symbol) return false;

    const newSymbol = graphic.symbol.clone();
    newSymbol.xoffset = 0;
    newSymbol.yoffset = 0;

    if (newSymbol.font) {
      newSymbol.font = {
        ...newSymbol.font,
        size: this.settings.fontSize,
      };
    }

    graphic.symbol = newSymbol;
    graphic.visible = true;

    return true;
  }

  /**
   * Clear context labels from tracking
   * @private
   */
  _clearContextLabelsFromTracking() {
    const filteredEditedLabels = new Map();

    for (const [labelId, labelData] of this.editedLabels) {
      if (!this._isLabelInCurrentContext(labelData)) {
        filteredEditedLabels.set(labelId, labelData);
      }
    }

    this.editedLabels = filteredEditedLabels;
  }

  /**
   * Reset single label position optimized
   * @param {string|Object} labelOrId - Label ID or label graphic
   * @returns {Object} Result of the reset operation
   */
  resetLabelPosition(labelOrId) {
    try {
      const labelId = typeof labelOrId === "string" ? labelOrId : this.getLabelId(labelOrId);
      if (!labelId) {
        return { success: false, message: "Invalid label ID" };
      }

      const labelData = this.editedLabels.get(labelId);
      if (!labelData?.graphic?.symbol) {
        return { success: false, message: "Label not found or invalid" };
      }

      // Verify context
      if (!this._isLabelInCurrentContext(labelData)) {
        return {
          success: false,
          message: `Label belongs to a different context`,
        };
      }

      // Reset label
      if (!this._resetLabelToDefaults(labelData.graphic)) {
        return { success: false, message: "Failed to reset label" };
      }

      // Update tracking
      this._updateTrackingAfterReset(labelId, labelData);

      // Remove from saved positions
      this._removeLabelFromSavedPositions(labelId);

      console.log(`[LabelManager] Reset label position for ${labelId}`);

      return {
        success: true,
        message: `Reset label position for ${labelId}`,
        graphic: labelData.graphic,
      };
    } catch (error) {
      console.error("[LabelManager] Error resetting label position:", error);
      return {
        success: false,
        message: `Error resetting label position: ${error.message}`,
      };
    }
  }

  /**
   * Update tracking after reset
   * @param {string} labelId - Label ID
   * @param {Object} labelData - Label data
   * @private
   */
  _updateTrackingAfterReset(labelId, labelData) {
    this.editedLabels.set(labelId, {
      graphic: labelData.graphic,
      position: { x: 0, y: 0 },
      fontSize: this.settings.fontSize,
      text: labelData.graphic.symbol.text || "",
      mapConfigId: this.mapConfigId,
      mapType: this.mapType,
    });
  }

  /**
   * Remove label from saved positions
   * @param {string} labelId - Label ID
   * @private
   */
  _removeLabelFromSavedPositions(labelId) {
    const savedPositions = this._getSavedPositions();
    if (savedPositions[labelId]) {
      delete savedPositions[labelId];
      localStorage.setItem(this.getStorageKey(), JSON.stringify(savedPositions));
    }
  }

  /**
   * Update label position optimized
   * @param {string|Object} labelOrId - Label ID or label graphic
   * @param {Object} position - New position {x, y}
   * @returns {Object} Result of the update operation
   */
  updateLabelPosition(labelOrId, position) {
    try {
      const labelId = typeof labelOrId === "string" ? labelOrId : this.getLabelId(labelOrId);
      if (!labelId) {
        return { success: false, message: "Invalid label ID" };
      }

      const labelData = this.editedLabels.get(labelId);
      if (!labelData?.graphic?.symbol) {
        return { success: false, message: "Label not found or invalid" };
      }

      // Verify context
      if (!this._isLabelInCurrentContext(labelData)) {
        return {
          success: false,
          message: `Label belongs to a different context`,
        };
      }

      // Update position efficiently
      const newSymbol = labelData.graphic.symbol.clone();
      newSymbol.xoffset = position.x;
      newSymbol.yoffset = position.y;
      labelData.graphic.symbol = newSymbol;

      // Update tracking
      labelData.position = { x: position.x, y: position.y };

      console.log(`[LabelManager] Updated label position for ${labelId}`);

      return {
        success: true,
        message: `Updated label position for ${labelId}`,
      };
    } catch (error) {
      console.error("[LabelManager] Error updating label position:", error);
      return {
        success: false,
        message: `Error updating label position: ${error.message}`,
      };
    }
  }

  /**
   * Update label font size optimized with immediate save
   * @param {string|Object} labelOrId - Label ID or label graphic
   * @param {number} fontSize - New font size
   * @returns {Object} Result of the update operation
   */
  updateLabelFontSize(labelOrId, fontSize) {
    try {
      const labelId = typeof labelOrId === "string" ? labelOrId : this.getLabelId(labelOrId);
      if (!labelId) {
        return { success: false, message: "Invalid label ID" };
      }

      const labelData = this.editedLabels.get(labelId);
      if (!labelData?.graphic?.symbol) {
        return { success: false, message: "Label not found or invalid" };
      }

      // Verify context
      if (!this._isLabelInCurrentContext(labelData)) {
        return {
          success: false,
          message: `Label belongs to a different context`,
        };
      }

      // Update font size efficiently
      const newSymbol = labelData.graphic.symbol.clone();
      
      if (newSymbol.font) {
        newSymbol.font = { ...newSymbol.font, size: fontSize };
      } else {
        newSymbol.font = {
          family: this.settings.fontFamily,
          size: fontSize,
        };
      }

      labelData.graphic.symbol = newSymbol;

      // Update tracking with explicit fontSize
      labelData.fontSize = fontSize;

      console.log(`[LabelManager] Updated font size for ${labelId} to ${fontSize}`);

      // Trigger immediate save
      this._debouncedSave();

      return {
        success: true,
        message: `Updated font size for ${labelId}`,
      };
    } catch (error) {
      console.error("[LabelManager] Error updating font size:", error);
      return {
        success: false,
        message: `Error updating font size: ${error.message}`,
      };
    }
  }

  /**
   * Update label text optimized
   * @param {string|Object} labelOrId - Label ID or label graphic
   * @param {string} text - New text
   * @returns {Object} Result of the update operation
   */
  updateLabelText(labelOrId, text) {
    try {
      const labelId = typeof labelOrId === "string" ? labelOrId : this.getLabelId(labelOrId);
      if (!labelId) {
        return { success: false, message: "Invalid label ID" };
      }

      const labelData = this.editedLabels.get(labelId);
      if (!labelData?.graphic?.symbol) {
        return { success: false, message: "Label not found or invalid" };
      }

      // Verify context
      if (!this._isLabelInCurrentContext(labelData)) {
        return {
          success: false,
          message: `Label belongs to a different context`,
        };
      }

      // Update text efficiently
      const newSymbol = labelData.graphic.symbol.clone();

      // Handle variable formatting
      if (labelData.graphic.attributes?.hasCustomFormat === true) {
        const originalText = newSymbol.text || "";
        const varMatch = originalText.match(/\s*\((.*)\)/);
        
        newSymbol.text = varMatch && varMatch[1] ? 
                        text + " (" + varMatch[1] + ")" : text;
      } else {
        newSymbol.text = text;
      }

      labelData.graphic.symbol = newSymbol;

      // Update attributes
      if (labelData.graphic.attributes) {
        labelData.graphic.attributes.text = text;
        labelData.graphic.attributes.labelText = newSymbol.text;
      }

      // Update tracking
      labelData.text = newSymbol.text;

      console.log(`[LabelManager] Updated text for ${labelId}`);

      return {
        success: true,
        message: `Updated text for ${labelId}`,
      };
    } catch (error) {
      console.error("[LabelManager] Error updating text:", error);
      return {
        success: false,
        message: `Error updating text: ${error.message}`,
      };
    }
  }

  /**
   * Toggle editing mode optimized
   * @param {boolean} enableEdit - Whether to enable or disable edit mode
   * @param {boolean} exclusive - Whether to clear selection when disabling (default: true)
   * @returns {boolean} New edit mode state
   */
  toggleEditingMode(enableEdit, exclusive = true) {
    const newEditMode = enableEdit !== undefined ? enableEdit : !this.editMode;

    if (newEditMode === this.editMode) {
      return this.editMode;
    }

    this._cleanupEventHandlers();

    if (newEditMode) {
      this._enableOptimizedEditMode();
    } else {
      this._disableOptimizedEditMode();
      
      if (exclusive) {
        this.selectedLabel = null;
      }
    }

    this.editMode = newEditMode;
    console.log(`[LabelManager] Edit mode ${this.editMode ? "enabled" : "disabled"}`);

    return this.editMode;
  }

  /**
   * Enable optimized edit mode
   * @private
   */
  _enableOptimizedEditMode() {
    if (!this.view) return;

    // Change cursor
    if (this.view.container) {
      this.view.container.style.cursor = "pointer";
    }

    // Add optimized click handler for label selection
    this.handlers.push(
      this.view.on("click", (event) => {
        if (this.isMoving) {
          event.stopPropagation();
          return;
        }

        this._handleOptimizedLabelSelection(event);
      })
    );
  }

  /**
   * Handle optimized label selection
   * @param {Object} event - Click event
   * @private
   */
  _handleOptimizedLabelSelection(event) {
    try {
      this.view.hitTest(event.screenPoint)
        .then((response) => {
          if (!response?.results) {
            console.warn("[LabelManager] Invalid hit test response");
            return;
          }

          // Find context-appropriate label hits
          const contextLabelHits = this._findContextLabelHits(response.results);

          if (contextLabelHits.length > 0) {
            event.stopPropagation();
            this.selectLabel(contextLabelHits[0]);
          } else {
            this.selectedLabel = null;
          }
        })
        .catch((error) => {
          console.error("[LabelManager] Error during hit test:", error);
        });
    } catch (error) {
      console.error("[LabelManager] Error setting up hit test:", error);
    }
  }

  /**
   * Find label hits in current context
   * @param {Array} results - Hit test results
   * @returns {Array} Context-appropriate label hits
   * @private
   */
  _findContextLabelHits(results) {
    const labelHits = results.filter((result) => {
      const graphic = result.graphic;
      return graphic && 
             (graphic.symbol?.type === "text" || graphic.attributes?.isLabel === true);
    });

    return labelHits.filter((hit) => {
      const attrs = hit.graphic.attributes || {};
      
      const configMatch = !attrs.mapConfigId || !this.mapConfigId || 
                         attrs.mapConfigId === this.mapConfigId;
      const typeMatch = !attrs.mapType || !this.mapType || 
                       attrs.mapType === this.mapType;

      return configMatch && typeMatch;
    }).map(hit => hit.graphic);
  }

  /**
   * Disable optimized edit mode
   * @private
   */
  _disableOptimizedEditMode() {
    // Reset cursor
    if (this.view?.container) {
      this.view.container.style.cursor = "default";
    }

    // Reset states
    this.isMoving = false;
  }

  /**
   * Optimized event handler cleanup
   * @private
   */
  _cleanupEventHandlers() {
    for (const handler of this.handlers) {
      if (handler && typeof handler.remove === "function") {
        try {
          handler.remove();
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
    }
    this.handlers = [];
  }

  /**
   * Select a label for editing with optimization
   * @param {Object} labelGraphic - The label graphic to select
   * @returns {Object} The selected label
   */
  selectLabel(labelGraphic) {
    if (!labelGraphic) return null;

    // Verify context efficiently
    if (!this._isGraphicInCurrentContext(labelGraphic)) {
      console.log("[LabelManager] Ignoring selection of label from different context");
      return null;
    }

    this.selectedLabel = labelGraphic;
    const labelId = this.getLabelId(labelGraphic);

    // Ensure tracking
    if (labelId && !this.editedLabels.has(labelId)) {
      this._addLabelToTracking(labelGraphic, labelId);
    }

    console.log(`[LabelManager] Selected label: ${labelId}`);
    return labelGraphic;
  }

  /**
   * Add label to tracking efficiently
   * @param {Object} labelGraphic - Label graphic
   * @param {string} labelId - Label ID
   * @private
   */
  _addLabelToTracking(labelGraphic, labelId) {
    this.editedLabels.set(labelId, {
      graphic: labelGraphic,
      position: {
        x: labelGraphic.symbol?.xoffset || 0,
        y: labelGraphic.symbol?.yoffset || 0,
      },
      fontSize: labelGraphic.symbol?.font?.size || this.settings.fontSize,
      text: labelGraphic.symbol?.text || "",
      mapConfigId: this.mapConfigId,
      mapType: this.mapType,
    });
  }

  /**
   * Start moving a label with optimization
   * @returns {boolean} Whether moving was successfully started
   */
  startMovingLabel() {
    if (!this.selectedLabel || !this.view) {
      return false;
    }

    // Verify context
    if (!this._isGraphicInCurrentContext(this.selectedLabel)) {
      console.log("[LabelManager] Cannot move label from different context");
      return false;
    }

    // Set moving state
    this.isMoving = true;

    // Update cursor
    if (this.view.container) {
      this.view.container.style.cursor = "move";
    }

    // Store and disable navigation
    this._storeAndDisableNavigation();

    // Add optimized move event handlers
    this._setupMoveEventHandlers();

    console.log("[LabelManager] Started moving label");
    return true;
  }

  /**
   * Store and disable navigation
   * @private
   */
  _storeAndDisableNavigation() {
    this.originalNavState = {
      browserTouchPanEnabled: this.view.navigation.browserTouchPanEnabled,
      mouseWheelZoomEnabled: this.view.navigation.mouseWheelZoomEnabled,
      keyboardNavigation: this.view.navigation.keyboardNavigation,
    };

    this.view.navigation.browserTouchPanEnabled = false;
    this.view.navigation.mouseWheelZoomEnabled = false;
    this.view.navigation.keyboardNavigation = false;
  }

  /**
   * Setup optimized move event handlers
   * @private
   */
  _setupMoveEventHandlers() {
    // Pointer down handler
    this.handlers.push(
      this.view.on("pointer-down", (event) => {
        if (!this.isMoving || !this.selectedLabel) return;

        event.stopPropagation();
        event.preventDefault();

        this.dragInfo.startPoint = { x: event.x, y: event.y };
        this.dragInfo.labelOffset = {
          x: this.selectedLabel.symbol?.xoffset || 0,
          y: this.selectedLabel.symbol?.yoffset || 0,
        };
      })
    );

    // Pointer move handler
    this.handlers.push(
      this.view.on("pointer-move", (event) => {
        if (!this.isMoving || !this.selectedLabel || !this.dragInfo.startPoint) return;

        event.stopPropagation();
        event.preventDefault();

        const dx = event.x - this.dragInfo.startPoint.x;
        const dy = event.y - this.dragInfo.startPoint.y;

        const newOffset = {
          x: this.dragInfo.labelOffset.x + dx,
          y: this.dragInfo.labelOffset.y - dy,
        };

        this.updateLabelOffset(newOffset);
      })
    );

    // Pointer up handler
    this.handlers.push(
      this.view.on("pointer-up", (event) => {
        event.stopPropagation();
        event.preventDefault();
        this.stopMovingLabel();
      })
    );

    // Pointer leave handler
    this.handlers.push(
      this.view.on("pointer-leave", () => {
        this.stopMovingLabel();
      })
    );
  }

  /**
   * Stop moving a label with optimization
   */
  stopMovingLabel() {
    if (!this.isMoving) return;

    // Reset state
    this.isMoving = false;

    // Reset cursor
    if (this.view?.container) {
      this.view.container.style.cursor = "pointer";
    }

    // Clear drag info
    this.dragInfo = { startPoint: null, labelOffset: null };

    // Restore navigation
    this._restoreNavigation();

    // Clean up and re-enable editing
    this._cleanupEventHandlers();

    if (this.editMode) {
      this._enableOptimizedEditMode();
    }

    // Save changes with debouncing
    this._debouncedSave();

    console.log("[LabelManager] Stopped moving label");
  }

  /**
   * Restore navigation state
   * @private
   */
  _restoreNavigation() {
    if (this.view && this.originalNavState) {
      this.view.navigation.browserTouchPanEnabled = this.originalNavState.browserTouchPanEnabled;
      this.view.navigation.mouseWheelZoomEnabled = this.originalNavState.mouseWheelZoomEnabled;
      this.view.navigation.keyboardNavigation = this.originalNavState.keyboardNavigation;
    }
  }

  /**
   * Update the offset of the selected label optimized
   * @param {Object} offset - New offset {x, y}
   */
  updateLabelOffset(offset) {
    if (!this.selectedLabel?.symbol) return;

    try {
      const newSymbol = this.selectedLabel.symbol.clone();
      newSymbol.xoffset = offset.x;
      newSymbol.yoffset = offset.y;
      this.selectedLabel.symbol = newSymbol;

      // Update tracking efficiently
      const labelId = this.getLabelId(this.selectedLabel);
      if (labelId && this.editedLabels.has(labelId)) {
        this.editedLabels.get(labelId).position = { x: offset.x, y: offset.y };
      }
    } catch (error) {
      console.error("[LabelManager] Error updating label offset:", error);
    }
  }

  /**
   * Optimized refresh labels with debouncing
   * @returns {Object} Result of the refresh operation
   */
  refreshLabels() {
    // Use debouncing to prevent excessive refresh calls
    if (this._refreshDebounceTimer) {
      clearTimeout(this._refreshDebounceTimer);
    }

    this._refreshDebounceTimer = setTimeout(() => {
      this._performOptimizedRefresh();
    }, 100);

    return {
      success: true,
      message: "Refresh scheduled",
      count: 0,
    };
  }

  /**
   * Perform optimized refresh
   * @private
   */
  _performOptimizedRefresh() {
    try {
      const savedPositions = this._getSavedPositions();
      let refreshCount = 0;
      let appliedStylesCount = 0;

      // Process tracked labels efficiently
      for (const [labelId, labelData] of this.editedLabels) {
        if (!this._isLabelInCurrentContext(labelData)) continue;

        if (labelData.graphic?.symbol) {
          try {
            // Reapply saved styles during refresh
            if (savedPositions[labelId]) {
              if (this._applySavedPosition(labelData.graphic)) {
                appliedStylesCount++;
              }
            } else if (this._hasTrackingStyles(labelData)) {
              // Save tracking styles to localStorage
              this._saveTrackingStyles(labelId, labelData, savedPositions);
              appliedStylesCount++;
            }

            // Update visibility based on zoom
            labelData.graphic.visible = this.view.zoom >= this.settings.minZoom;
            refreshCount++;
          } catch (labelError) {
            console.error(`[LabelManager] Error refreshing label ${labelId}:`, labelError);
          }
        }
      }

      // Refresh layers efficiently
      this._refreshLayers();

      console.log(`[LabelManager] Refreshed ${refreshCount} labels, reapplied styles to ${appliedStylesCount}`);

      return {
        success: true,
        message: `Refreshed ${refreshCount} labels, reapplied ${appliedStylesCount} styles`,
        count: refreshCount,
      };
    } catch (error) {
      console.error("[LabelManager] Error refreshing labels:", error);
      return {
        success: false,
        message: `Error refreshing labels: ${error.message}`,
        count: 0,
      };
    }
  }

  /**
   * Check if tracking has styles
   * @param {Object} labelData - Label data
   * @returns {boolean} True if has styles
   * @private
   */
  _hasTrackingStyles(labelData) {
    return labelData.fontSize || labelData.fontWeight || labelData.backgroundColor;
  }

  /**
   * Save tracking styles to localStorage
   * @param {string} labelId - Label ID
   * @param {Object} labelData - Label data
   * @param {Object} savedPositions - Saved positions object
   * @private
   */
  _saveTrackingStyles(labelId, labelData, savedPositions) {
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
      mapType: this.mapType,
    };

    localStorage.setItem(this.getStorageKey(), JSON.stringify(savedPositions));
    this._applySavedPosition(labelData.graphic);
  }

  /**
   * Refresh layers efficiently
   * @private
   */
  _refreshLayers() {
    // Refresh label layer
    if (this.labelLayer && typeof this.labelLayer.refresh === "function") {
      this.labelLayer.refresh();
    }

    // Refresh map layers with error handling
    if (this.view?.map?.layers) {
      for (const layer of this.view.map.layers) {
        if (layer.graphics && typeof layer.refresh === "function") {
          try {
            layer.refresh();
          } catch (layerError) {
            console.warn(`[LabelManager] Error refreshing layer ${layer.id}:`, layerError);
          }
        }
      }
    }

    // Force view redraw
    if (this.view && typeof this.view.redraw === "function") {
      try {
        this.view.redraw();
      } catch (redrawError) {
        console.warn("[LabelManager] Error redrawing view:", redrawError);
      }
    }
  }

  /**
   * Update manager settings with optimization
   * @param {Object} newSettings - New settings
   */
  updateSettings(newSettings) {
    if (!newSettings) return;

    // Cache invalidation for settings that affect calculations
    if (newSettings.fontSize !== undefined || 
        newSettings.fontFamily !== undefined ||
        newSettings.enableTextMeasurementCache !== undefined) {
      this._textMeasurementCache.clear();
    }

    if (newSettings.enableBoundingBoxCache !== undefined) {
      this._boundingBoxCache = new WeakMap();
    }

    // Update settings
    this.settings = { ...this.settings, ...newSettings };

    console.log("[LabelManager] Updated settings:", newSettings);

    // Apply relevant settings to labels
    if (newSettings.fontSize || newSettings.minZoom) {
      this.refreshLabels();
    }

    // Update auto-save if interval changed
    if (newSettings.autoSaveIntervalMs) {
      this._setupOptimizedAutoSave();
    }
  }

  /**
   * Configure layer settings based on layer type with optimization
   * @param {string} layerType - The type of layer (pipe, comp, custom, etc.)
   */
  configureLayerSettings(layerType) {
    if (!layerType) return;

    const type = layerType.toLowerCase();

    // Optimized settings lookup
    const typeSettings = {
      pipe: { fontSize: 10, haloSize: 2, minZoom: 8, autoSaveIntervalMs: 30000 },
      comp: { fontSize: 9, haloSize: 2.5, minZoom: 8, autoSaveIntervalMs: 30000 },
      custom: { fontSize: 8, haloSize: 2, minZoom: 8, autoSaveIntervalMs: 30000 },
    };

    const defaultSettings = typeSettings[type] || typeSettings.custom;

    // Check for existing user settings efficiently
    const savedPositions = this._getSavedPositions();
    const hasUserSettings = Object.keys(savedPositions).length > 0;

    let userFontSize = null;
    if (hasUserSettings) {
      // Find representative label font size
      const firstLabelId = Object.keys(savedPositions)[0];
      const firstLabel = savedPositions[firstLabelId];
      if (firstLabel?.fontSize !== undefined) {
        userFontSize = firstLabel.fontSize;
        console.log(`[LabelManager] Found user-defined fontSize: ${userFontSize}`);
      }
    }

    // Merge settings preserving user fontSize
    const mergedSettings = {
      ...defaultSettings,
      fontSize: userFontSize !== null ? userFontSize : defaultSettings.fontSize,
    };

    this.updateSettings(mergedSettings);
    this.mapType = type;

    // Update session storage
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("currentMapType", type);
    }

    console.log(`[LabelManager] Configured settings for layer type: ${type}, ` +
                `preserving user fontSize: ${userFontSize !== null}`);
  }

  /**
   * Get all label graphics for the current context optimized
   * @returns {Array} Array of label graphics
   */
  getAllLabelGraphics() {
    const labels = [];

    for (const labelData of this.editedLabels.values()) {
      if (!this._isLabelInCurrentContext(labelData)) continue;

      if (labelData.graphic) {
        labels.push(labelData.graphic);
      }
    }

    return labels;
  }

  /**
   * Check if the API is available (optimized)
   * @returns {Promise<boolean>} Whether the API is available
   */
  async isAPIAvailable() {
    // Since we're using localStorage, always return true
    return Promise.resolve(true);
  }

  /**
   * Mark all saved positions as edited optimized
   * @returns {number} Number of positions marked
   */
  markSavedPositionsAsEdited() {
    const savedPositions = this._getSavedPositions();
    const positionIds = Object.keys(savedPositions);

    let markedCount = 0;

    // Process positions efficiently
    for (const labelId of positionIds) {
      const savedPos = savedPositions[labelId];

      // Skip different contexts
      if (!this._isSavedPositionInCurrentContext(savedPos)) continue;

      // Skip if already tracked
      if (this.editedLabels.has(labelId)) {
        markedCount++;
        continue;
      }

      // Find graphic efficiently
      const graphic = this._findGraphicInLayers(labelId);

      if (graphic) {
        this._addSavedPositionToTracking(labelId, savedPos, graphic);
        markedCount++;
      }
    }

    console.log(`[LabelManager] Marked ${markedCount} saved positions as edited ` +
                `for config ${this.mapConfigId}, type ${this.mapType}`);

    return markedCount;
  }

  /**
   * Check if saved position is in current context
   * @param {Object} savedPos - Saved position
   * @returns {boolean} True if in current context
   * @private
   */
  _isSavedPositionInCurrentContext(savedPos) {
    const configMatch = !savedPos.mapConfigId || !this.mapConfigId || 
                       savedPos.mapConfigId === this.mapConfigId;
    const typeMatch = !savedPos.mapType || !this.mapType || 
                     savedPos.mapType === this.mapType;

    return configMatch && typeMatch;
  }

  /**
   * Find graphic in layers efficiently
   * @param {string} targetLabelId - Label ID to find
   * @returns {Object|null} Found graphic or null
   * @private
   */
  _findGraphicInLayers(targetLabelId) {
    if (!this.view?.map?.layers) return null;

    for (const layer of this.view.map.layers) {
      if (!layer.graphics) continue;

      for (const graphic of layer.graphics) {
        const isLabel = graphic.symbol?.type === "text" || 
                       graphic.attributes?.isLabel === true;
        if (!isLabel) continue;

        const id = this.getLabelId(graphic);
        if (id === targetLabelId) {
          return graphic;
        }
      }
    }

    return null;
  }

  /**
   * Add saved position to tracking
   * @param {string} labelId - Label ID
   * @param {Object} savedPos - Saved position
   * @param {Object} graphic - Graphic object
   * @private
   */
  _addSavedPositionToTracking(labelId, savedPos, graphic) {
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
      mapType: savedPos.mapType || this.mapType,
    });
  }

  /**
   * Clean up and destroy the manager with optimization
   */
  destroy() {
    // Save any pending changes
    this.savePositions(true);

    // Clean up event handlers
    this._cleanupEventHandlers();

    // Clear intervals and timers
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }

    if (this._saveDebounceTimer) {
      clearTimeout(this._saveDebounceTimer);
      this._saveDebounceTimer = null;
    }

    if (this._refreshDebounceTimer) {
      clearTimeout(this._refreshDebounceTimer);
      this._refreshDebounceTimer = null;
    }

    // Clear caches
    this._textMeasurementCache.clear();
    this._boundingBoxCache = new WeakMap();

    // Clear references
    this.view = null;
    this.selectedLabel = null;
    this.editedLabels.clear();
    this._canvasContext = null;
    this._searchPatterns = null;
    this._zoomIndependentPatterns = null;

    console.log("[LabelManager] Destroyed with optimizations cleared");
  }

  /**
   * Performance monitoring and statistics
   * @returns {Object} Performance statistics
   */
  getPerformanceStats() {
    return {
      trackedLabels: this.editedLabels.size,
      textMeasurementCacheSize: this._textMeasurementCache.size,
      boundingBoxCacheEnabled: this.settings.enableBoundingBoxCache,
      textMeasurementCacheEnabled: this.settings.enableTextMeasurementCache,
      currentContext: {
        mapConfigId: this.mapConfigId,
        mapType: this.mapType,
        projectId: this.projectId,
      },
      settings: {
        collisionDetectionThreshold: this.settings.collisionDetectionThreshold,
        maxOptimizationAttempts: this.settings.maxOptimizationAttempts,
        autoSaveIntervalMs: this.settings.autoSaveIntervalMs,
      },
    };
  }

  /**
   * Clear all caches for memory management
   */
  clearCaches() {
    this._textMeasurementCache.clear();
    this._boundingBoxCache = new WeakMap();
    this._cachedStorageKey = null;
    
    // Clear any cached importance weights on graphics
    for (const labelData of this.editedLabels.values()) {
      if (labelData.graphic && labelData.graphic._cachedImportanceWeight) {
        delete labelData.graphic._cachedImportanceWeight;
      }
    }

    console.log("[LabelManager] All caches cleared");
  }

  /**
   * Optimize performance by adjusting settings based on label count
   * @param {number} labelCount - Number of labels
   */
  optimizeForLabelCount(labelCount) {
    if (labelCount > 1000) {
      // High label count - prioritize performance
      this.updateSettings({
        maxOptimizationAttempts: 25,
        collisionDetectionThreshold: 0.5,
        enableTextMeasurementCache: true,
        enableBoundingBoxCache: true,
      });
      console.log("[LabelManager] Optimized settings for high label count");
    } else if (labelCount > 100) {
      // Medium label count - balanced approach
      this.updateSettings({
        maxOptimizationAttempts: 35,
        collisionDetectionThreshold: 0.3,
        enableTextMeasurementCache: true,
        enableBoundingBoxCache: true,
      });
      console.log("[LabelManager] Optimized settings for medium label count");
    } else {
      // Low label count - prioritize quality
      this.updateSettings({
        maxOptimizationAttempts: 50,
        collisionDetectionThreshold: 0.1,
        enableTextMeasurementCache: false,
        enableBoundingBoxCache: false,
      });
      console.log("[LabelManager] Optimized settings for low label count");
    }
  }
}

export default LabelManager;