/**
 * A simple utility class that works with LabelManager to enable label positioning
 * functionality for labels on the map using a click-to-select, move, click-to-drop pattern.
 */
class SimpleLabelDragger {
  /**
   * Constructor for SimpleLabelDragger
   * @param {Object} config - Configuration object containing view, labelManager and callbacks
   */
  constructor(config) {
    // Handle both styles of initialization for backward compatibility
    if (arguments.length === 2 && arguments[0] && arguments[1]) {
      // Old style: separate parameters
      this.view = arguments[0];
      this.labelManager = arguments[1];
      this.onDragStart = null;
      this.onDrag = null;
      this.onDragEnd = null;
    } else if (config && typeof config === 'object') {
      // New style: config object
      this.view = config.view;
      this.labelManager = config.labelManager;
      this.onDragStart = config.onDragStart || null;
      this.onDrag = config.onDrag || null;
      this.onDragEnd = config.onDragEnd || null;
    } else {
      console.error("[SimpleLabelDragger] Invalid initialization parameters");
      this.view = null;
      this.labelManager = null;
    }

    // Event handlers
    this.handlers = [];
    this.domEventHandlers = [];
    
    // State tracking
    this.isActive = false;             // Whether the dragger is enabled
    this.selectedLabel = null;         // Currently selected label
    this.isMoving = false;             // Whether currently in moving state
    this.originalOffset = null;        // Original offset of the label 
    this.originalPosition = null;      // Original screen position
    this.currentPosition = null;       // Current mouse position
    this.originalNavState = null;      // Original map navigation state
    
    // Reference to the move indicator element
    this.moveIndicator = null;
    
    // Settings for move throttling 
    this.lastMoveTime = 0;
    this.moveThrottle = 16; // milliseconds (roughly 60fps)
    
    // Track when we're waiting for a selection operation to complete
    this.isSelectionPending = false;
    
    // Initialize if we have both required references
    if (this.view && this.labelManager) {
      this.initialize();
    } else {
      console.warn("[SimpleLabelDragger] Missing required view or labelManager. Dragger inactive.");
    }
  }

  /**
   * Create a valid screen point from an event or coordinates
   * @param {Object} event - The event object
   * @returns {Object|null} - A valid screen point object or null if invalid
   * @private
   */
  _createValidScreenPoint(event) {
    try {
      // If we already have a valid screen point, use it
      if (event.screenPoint && typeof event.screenPoint.x === 'number' && 
          typeof event.screenPoint.y === 'number') {
        return event.screenPoint;
      }
      
      // Try to create from x/y properties directly on the event
      if (event.x !== undefined && event.y !== undefined && 
          typeof event.x === 'number' && typeof event.y === 'number') {
        return { x: event.x, y: event.y };
      }
      
      // Try to extract from native event if available
      const nativeEvent = event.native || event;
      if (nativeEvent && 
          typeof nativeEvent.clientX === 'number' && 
          typeof nativeEvent.clientY === 'number') {
        
        // If we have a view container, adjust coordinates to be relative to it
        if (this.view && this.view.container) {
          const rect = this.view.container.getBoundingClientRect();
          return { 
            x: nativeEvent.clientX - rect.left, 
            y: nativeEvent.clientY - rect.top 
          };
        }
        
        // Otherwise use client coordinates directly
        return { x: nativeEvent.clientX, y: nativeEvent.clientY };
      }
      
      // If we're dealing with a DOM event
      if (event instanceof MouseEvent || event instanceof TouchEvent) {
        if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
          // If we have a view container, adjust coordinates
          if (this.view && this.view.container) {
            const rect = this.view.container.getBoundingClientRect();
            return { 
              x: event.clientX - rect.left, 
              y: event.clientY - rect.top 
            };
          }
          
          return { x: event.clientX, y: event.clientY };
        }
        
        // Handle touch events
        if (event.touches && event.touches.length > 0) {
          const touch = event.touches[0];
          if (typeof touch.clientX === 'number' && typeof touch.clientY === 'number') {
            if (this.view && this.view.container) {
              const rect = this.view.container.getBoundingClientRect();
              return { 
                x: touch.clientX - rect.left, 
                y: touch.clientY - rect.top 
              };
            }
            
            return { x: touch.clientX, y: touch.clientY };
          }
        }
      }
      
      // Fallback: return null for invalid screen point
      return null;
    } catch (error) {
      console.error("[SimpleLabelDragger] Error creating screen point:", error);
      return null;
    }
  }

  /**
   * Initialize the dragger with event handlers
   */
  initialize() {
    console.log("[SimpleLabelDragger] Initializing label click handlers");
    
    // Clean up any existing handlers first
    this.cleanup();
    
    if (!this.view || !this.view.container) {
      console.error("[SimpleLabelDragger] Cannot initialize: Missing view or container");
      return;
    }
    
    // Create move indicator element
    this._createMoveIndicator();
  }
  
  /**
   * Create the move indicator element that follows the cursor when moving
   * @private
   */
  _createMoveIndicator() {
    // No longer creating a visible indicator as requested
    this._removeMoveIndicator();
    this.moveIndicator = null;
  }
  
  /**
   * Remove the move indicator element
   * @private
   */
  _removeMoveIndicator() {
    if (this.moveIndicator && this.moveIndicator.parentNode) {
      this.moveIndicator.parentNode.removeChild(this.moveIndicator);
      this.moveIndicator = null;
    }
  }
  
  /**
   * Find a label at the given screen point
   * @param {Object} screenPoint - The screen point to test
   * @returns {Promise<Object|null>} - The label graphic or null if none found
   * @private
   */
  async _findLabelAtPoint(screenPoint) {
    if (!this.view || !this.view.hitTest) {
      return null;
    }
    
    try {
      const response = await this.view.hitTest(screenPoint);
      
      // Validate response
      if (!response || !response.results || !Array.isArray(response.results)) {
        return null;
      }
      
      // Find label hit
      const labelHit = response.results.find(result => 
        result && result.graphic && (
          (result.graphic.symbol && result.graphic.symbol.type === "text") || 
          (result.graphic.attributes && result.graphic.attributes.isLabel === true)
        )
      );
      
      return labelHit ? labelHit.graphic : null;
    } catch (error) {
      console.error("[SimpleLabelDragger] Error finding label:", error);
      return null;
    }
  }
  
  /**
   * Handle map click events - either select a label or drop the currently selected one
   * @param {Object} event - The click event
   * @private
   */
  async _handleMapClick(event) {
    try {
      // Ensure we don't have any pending selection operations
      if (this.isSelectionPending) {
        return;
      }
      this.isSelectionPending = true;
      
      const screenPoint = this._createValidScreenPoint(event);
      if (!screenPoint) {
        this.isSelectionPending = false;
        return;
      }
      
      // Prevent default event behavior
      event.stopPropagation();
      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      
      // If already moving a label, this click is to drop it
      if (this.isMoving && this.selectedLabel) {
        this._dropLabel();
        this.isSelectionPending = false;
        return;
      }
      
      // Otherwise, try to find and select a label
      const labelGraphic = await this._findLabelAtPoint(screenPoint);
      
      if (labelGraphic) {
        // First, explicitly update the selectedLabel in the labelManager
        if (this.labelManager && typeof this.labelManager.selectLabel === 'function') {
          // Directly set the labelManager.selectedLabel property if it exists
          if (this.labelManager.hasOwnProperty('selectedLabel')) {
            this.labelManager.selectedLabel = labelGraphic;
          }
          
          // Call the selectLabel method
          this.labelManager.selectLabel(labelGraphic);
        }
        
        // Then handle the selection UI
        this._selectLabel(labelGraphic, screenPoint);
        
        // Update this.selectedLabel
        this.selectedLabel = labelGraphic;
        
        // Log the selection
        console.log(`[SimpleLabelDragger] Selected label (ID: ${this.labelManager.getLabelId(labelGraphic)})`);
        
        // Save selectedLabel to window for debugging and direct access
        if (typeof window !== 'undefined') {
          window._selectedLabel = labelGraphic;
        }
        
        // Force the labelManager to emit a change event if it has such a method
        if (this.labelManager && typeof this.labelManager.notifySelectionChanged === 'function') {
          this.labelManager.notifySelectionChanged(labelGraphic);
        }
        
        // Dispatch a custom event that the React component can listen for
        if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
          const event = new CustomEvent('labelSelected', {
            detail: { label: labelGraphic }
          });
          window.dispatchEvent(event);
          this.view.container.dispatchEvent(event);
        }
      } else {
        // No label found at click point - deselect any existing selection
        if (this.labelManager) {
          if (typeof this.labelManager.updateLabelPosition === 'function') {
            const finalPosition = {
              x: this.selectedLabel.symbol?.xoffset || 0,
              y: this.selectedLabel.symbol?.yoffset || 0
            };
            this.labelManager.updateLabelPosition(this.selectedLabel, finalPosition);
          }
          
          // Auto-save positions
          if (typeof this.labelManager.savePositions === 'function') {
            const result = this.labelManager.savePositions(true);
            // Check if result is a Promise before using .catch
            if (result && typeof result.catch === 'function') {
              result.catch(err => {
                console.error("[LabelDragger] Error saving after drag:", err);
              });
            }
          }
        }
        
        // Clear local selection
        this.selectedLabel = null;
        
        if (typeof window !== 'undefined') {
          window._selectedLabel = null;
        }
        
        // Log the deselection
        console.log('[SimpleLabelDragger] No label found at click point - deselected');
        
        // Force the labelManager to emit a change event if it has such a method
        if (this.labelManager && typeof this.labelManager.notifySelectionChanged === 'function') {
          this.labelManager.notifySelectionChanged(null);
        }
        
        // Dispatch a custom event for deselection
        if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
          const event = new CustomEvent('labelSelected', {
            detail: { label: null }
          });
          window.dispatchEvent(event);
          this.view.container.dispatchEvent(event);
        }
      }
      
      // Clear selection pending flag
      this.isSelectionPending = false;
    } catch (error) {
      console.error("[SimpleLabelDragger] Error handling map click:", error);
      this.isSelectionPending = false;
    }
  }
  
  /**
   * Select a label and prepare for moving
   * @param {Object} labelGraphic - The label graphic to select
   * @param {Object} screenPoint - The screen point where the click occurred
   * @private
   */
  _selectLabel(labelGraphic, screenPoint) {
    // If we're in active mode, prepare for moving
    if (this.isActive) {
      // Store the selected label
      this.selectedLabel = labelGraphic;
      
      // Store original position
      this.originalPosition = screenPoint;
      this.currentPosition = { ...screenPoint };
      
      // Get initial offset from symbol
      this.originalOffset = {
        x: labelGraphic.symbol?.xoffset || 0,
        y: labelGraphic.symbol?.yoffset || 0
      };
      
      // Set moving state
      this.isMoving = true;
      
      // Change cursor
      if (this.view.container) {
        this.view.container.style.cursor = 'grabbing';
      }
      
      // Call the onDragStart callback if provided
      if (this.onDragStart && typeof this.onDragStart === 'function') {
        try {
          this.onDragStart(labelGraphic);
        } catch (error) {
          console.error('[SimpleLabelDragger] Error in onDragStart callback:', error);
        }
      }
    }
  }
  
  /**
   * Drop the currently selected label
   * @private
   */
  _dropLabel() {
    if (!this.selectedLabel || !this.isMoving) return;
    
    try {
      // Save the final position to LabelManager if available
      if (this.labelManager) {
        if (typeof this.labelManager.updateLabelPosition === 'function') {
          const finalPosition = {
            x: this.selectedLabel.symbol?.xoffset || 0,
            y: this.selectedLabel.symbol?.yoffset || 0
          };
          this.labelManager.updateLabelPosition(this.selectedLabel, finalPosition);
        }
        
        // Auto-save positions
        if (typeof this.labelManager.savePositions === 'function') {
          this.labelManager.savePositions(true);
        }
      }
      
      // Call the onDragEnd callback if provided
      if (this.onDragEnd && typeof this.onDragEnd === 'function') {
        this.onDragEnd(this.selectedLabel);
      }
      
      console.log(`[SimpleLabelDragger] Dropped label (ID: ${this.labelManager.getLabelId(this.selectedLabel)})`);
    } catch (error) {
      console.error('[SimpleLabelDragger] Error dropping label:', error);
    } finally {
      // Reset moving state
      this.isMoving = false;
      
      // Keep the label selected for editing
      // (But clear the position tracking)
      this.originalPosition = null;
      this.currentPosition = null;
      
      // Restore cursor to move (still in edit mode)
      if (this.view.container) {
        this.view.container.style.cursor = 'move';
      }
    }
  }
  
  /**
   * Handle mouse/pointer movement to update label position
   * @param {Object} event - The move event
   * @private
   */
  _handleMouseMove(event) {
    // Skip if not in moving state
    if (!this.isMoving || !this.selectedLabel) return;
    
    // Throttle move events to prevent browser slowdown
    const now = Date.now();
    if (now - this.lastMoveTime < this.moveThrottle) {
      return;
    }
    this.lastMoveTime = now;
    
    try {
      // Get current mouse position
      const screenPoint = this._createValidScreenPoint(event);
      if (!screenPoint) return;
      
      // Update current position
      this.currentPosition = screenPoint;
      
      // Calculate offset delta
      const dx = screenPoint.x - this.originalPosition.x;
      const dy = screenPoint.y - this.originalPosition.y;
      
      // Update label position
      if (this.selectedLabel && this.selectedLabel.symbol) {
        // Create a new symbol to force redraw
        const newSymbol = this.selectedLabel.symbol.clone();
        
        // Update position properties
        newSymbol.xoffset = this.originalOffset.x + dx;
        newSymbol.yoffset = this.originalOffset.y - dy; // Invert Y for correct direction
        
        // Apply the updated symbol
        this.selectedLabel.symbol = newSymbol;
        
        // Force refresh using multiple strategies
        if (this.view && typeof this.view.redraw === 'function') {
          this.view.redraw();
        }
        if (this.selectedLabel.layer && typeof this.selectedLabel.layer.refresh === 'function') {
          this.selectedLabel.layer.refresh();
        }
        if (this.view.graphics && typeof this.view.graphics.refresh === 'function') {
          this.view.graphics.refresh();
        }
        
        // Call the onDrag callback if provided
        if (this.onDrag && typeof this.onDrag === 'function') {
          this.onDrag(this.selectedLabel, dx, dy);
        }
      }
    } catch (error) {
      console.error('[SimpleLabelDragger] Error updating label position:', error);
      
      // Try direct property update as a fallback
      try {
        if (this.selectedLabel && this.selectedLabel.symbol) {
          const dx = this.currentPosition.x - this.originalPosition.x;
          const dy = this.currentPosition.y - this.originalPosition.y;
          
          this.selectedLabel.symbol.xoffset = this.originalOffset.x + dx;
          this.selectedLabel.symbol.yoffset = this.originalOffset.y - dy;
          
          if (this.view.graphics) {
            this.view.graphics.refresh();
          }
        }
      } catch (fallbackError) {
        console.error('[SimpleLabelDragger] Fallback position update failed:', fallbackError);
      }
    }
  }

  /**
   * Activate the dragger
   * @returns {boolean} Whether activation was successful
   */
  activate() {
    if (!this.view || !this.labelManager) {
      console.warn("[SimpleLabelDragger] Cannot activate: Missing view or labelManager");
      return false;
    }
    
    // Skip if already active
    if (this.isActive) {
      console.log("[SimpleLabelDragger] Already active");
      return true;
    }
    
    // Change cursor to indicate selectable mode
    if (this.view.container) {
      this.view.container.style.cursor = 'move';
      this.view.container.classList.add('label-edit-mode');
    }
    
    // Set up event handlers
    try {
      // Click/tap handler for selecting and dropping labels
      const clickHandler = this.view.on("click", event => this._handleMapClick(event));
      this.handlers.push(clickHandler);
      
      // Mouse/pointer move handler for tracking movement
      const moveHandler = this.view.on("pointer-move", event => this._handleMouseMove(event));
      this.handlers.push(moveHandler);
      
      // Add global mouse move handler for more reliable tracking
      const globalMoveHandler = event => {
        if (this.isMoving && this.selectedLabel) {
          this._handleMouseMove(event);
        }
      };
      document.addEventListener('mousemove', globalMoveHandler);
      this.domEventHandlers.push({
        element: document,
        type: 'mousemove',
        handler: globalMoveHandler
      });
      
      // Add escape key handler to cancel moving
      const keyHandler = event => {
        if (event.key === 'Escape' && this.isMoving) {
          this._cancelMove();
        }
      };
      document.addEventListener('keydown', keyHandler);
      this.domEventHandlers.push({
        element: document,
        type: 'keydown',
        handler: keyHandler
      });
      
      // Add pointer leave handler for map container
      const pointerLeaveHandler = event => {
        // Don't cancel move when pointer leaves - we'll use the global handlers
        // Just update the move indicator
        if (this.isMoving && this.moveIndicator) {
          const screenPoint = this._createValidScreenPoint(event);
          if (screenPoint) {
            this.moveIndicator.style.left = `${screenPoint.x}px`;
            this.moveIndicator.style.top = `${screenPoint.y}px`;
          }
        }
      };
      this.view.container.addEventListener('pointerleave', pointerLeaveHandler);
      this.domEventHandlers.push({
        element: this.view.container,
        type: 'pointerleave',
        handler: pointerLeaveHandler
      });
      
      // Add a special handler to intercept existing click events to ensure selection works
      const captureClickHandler = (event) => {
        // Check if the event target is within our map container
        if (this.view.container.contains(event.target)) {
          // Only proceed if we're in position adjustment mode and not already moving
          if (this.isActive && !this.isMoving && !this.isSelectionPending) {
            this._handleMapClick(event);
          }
        }
      };
      
      // Use capture phase to get events before other handlers
      document.addEventListener('click', captureClickHandler, true);
      this.domEventHandlers.push({
        element: document,
        type: 'click',
        handler: captureClickHandler,
        useCapture: true
      });
      
    } catch (error) {
      console.error("[SimpleLabelDragger] Error setting up event handlers:", error);
      this.deactivate();
      return false;
    }
    
    // Disable map navigation to prevent conflicts
    if (this.view.navigation) {
      this.originalNavState = {
        browserTouchPanEnabled: this.view.navigation.browserTouchPanEnabled,
        mouseWheelZoomEnabled: this.view.navigation.mouseWheelZoomEnabled,
        keyboardNavigation: this.view.navigation.keyboardNavigation,
        momentumEnabled: this.view.navigation.momentumEnabled,
        dragEnabled: this.view.navigation.dragEnabled
      };
      
      this.view.navigation.browserTouchPanEnabled = false;
      this.view.navigation.mouseWheelZoomEnabled = false;
      this.view.navigation.keyboardNavigation = false;
      
      // Disable additional navigation properties if they exist
      if (typeof this.view.navigation.momentumEnabled !== 'undefined') {
        this.view.navigation.momentumEnabled = false;
      }
      if (typeof this.view.navigation.dragEnabled !== 'undefined') {
        this.view.navigation.dragEnabled = false;
      }
    }
    
    // Set a flag on the view to indicate editing mode
    this.view._labelEditingActive = true;
    this.isActive = true;
    
    console.log("[SimpleLabelDragger] Activated with click-to-select, move, click-to-drop behavior");
    return true;
  }
  
  /**
   * Cancel the current move operation without saving
   * @private
   */
  _cancelMove() {
    if (!this.isMoving || !this.selectedLabel) return;
    
    try {
      console.log("[SimpleLabelDragger] Canceling move operation");
      
      // Restore original position
      if (this.selectedLabel && this.selectedLabel.symbol && this.originalOffset) {
        const newSymbol = this.selectedLabel.symbol.clone();
        newSymbol.xoffset = this.originalOffset.x;
        newSymbol.yoffset = this.originalOffset.y;
        this.selectedLabel.symbol = newSymbol;
        
        // Force refresh
        if (this.view.graphics) {
          this.view.graphics.refresh();
        }
      }
    } catch (error) {
      console.error("[SimpleLabelDragger] Error canceling move:", error);
    } finally {
      // Reset moving state
      this.isMoving = false;
      this.originalPosition = null;
      this.currentPosition = null;
      
      // Restore cursor
      if (this.view.container) {
        this.view.container.style.cursor = 'move';
      }
    }
  }
  
  /**
   * Select a label directly (for use from external code)
   * @param {Object} labelGraphic - The label graphic to select
   * @returns {boolean} - Whether the selection was successful
   */
  selectLabel(labelGraphic) {
    if (!labelGraphic) {
      return false;
    }
    
    try {
      // Set the selected label in the manager
      if (this.labelManager) {
        if (this.labelManager.hasOwnProperty('selectedLabel')) {
          this.labelManager.selectedLabel = labelGraphic;
        }
        
        if (typeof this.labelManager.selectLabel === 'function') {
          this.labelManager.selectLabel(labelGraphic);
        }
      }
      
      // Update local state
      this.selectedLabel = labelGraphic;
      
      // Log the selection
      console.log(`[SimpleLabelDragger] Externally selected label (ID: ${this.labelManager.getLabelId(labelGraphic)})`);
      
      // Force notification events if available
      if (this.labelManager && typeof this.labelManager.notifySelectionChanged === 'function') {
        this.labelManager.notifySelectionChanged(labelGraphic);
      }
      
      // Dispatch a custom event
      if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
        const event = new CustomEvent('labelSelected', {
          detail: { label: labelGraphic }
        });
        window.dispatchEvent(event);
        if (this.view.container) {
          this.view.container.dispatchEvent(event);
        }
      }
      
      return true;
    } catch (error) {
      console.error("[SimpleLabelDragger] Error in selectLabel:", error);
      return false;
    }
  }

  /**
   * Deactivate the dragger
   * @returns {boolean} Whether deactivation was successful
   */
  deactivate() {
    // Skip if not active
    if (!this.isActive) {
      return true;
    }
    
    // Cancel any ongoing move operation
    if (this.isMoving) {
      this._cancelMove();
    }
    
    // Reset cursor
    if (this.view?.container) {
      this.view.container.style.cursor = 'default';
      this.view.container.classList.remove('label-edit-mode');
    }
    
    // Restore map navigation
    if (this.view?.navigation && this.originalNavState) {
      this.view.navigation.browserTouchPanEnabled = this.originalNavState.browserTouchPanEnabled;
      this.view.navigation.mouseWheelZoomEnabled = this.originalNavState.mouseWheelZoomEnabled;
      
      if (this.originalNavState.keyboardNavigation !== undefined) {
        this.view.navigation.keyboardNavigation = this.originalNavState.keyboardNavigation;
      }
      if (typeof this.view.navigation.momentumEnabled !== 'undefined' && 
          this.originalNavState.momentumEnabled !== undefined) {
        this.view.navigation.momentumEnabled = this.originalNavState.momentumEnabled;
      }
      if (typeof this.view.navigation.dragEnabled !== 'undefined' && 
          this.originalNavState.dragEnabled !== undefined) {
        this.view.navigation.dragEnabled = this.originalNavState.dragEnabled;
      }
      
      this.originalNavState = null;
    }
    
    // Remove the editing flag
    if (this.view) {
      this.view._labelEditingActive = false;
    }
    
    // Clean up event handlers
    this.cleanup();
    
    // Remove move indicator
    this._removeMoveIndicator();
    
    // Reset state
    this.isActive = false;
    this.selectedLabel = null;
    this.isMoving = false;
    this.originalPosition = null;
    this.currentPosition = null;
    this.originalOffset = null;
    
    console.log("[SimpleLabelDragger] Deactivated");
    return true;
  }

  /**
   * Enables or disables the dragger
   * @param {boolean} enable - Whether to enable or disable
   */
  enable(enable = true) {
    return enable ? this.activate() : this.deactivate();
  }

  /**
   * Clean up event handlers
   */
  cleanup() {
    // Remove ArcGIS event handlers
    this.handlers.forEach(handler => {
      if (handler && typeof handler.remove === 'function') {
        try {
          handler.remove();
        } catch (e) {
          // Ignore removal errors
        }
      }
    });
    this.handlers = [];
    
    // Remove DOM event handlers
    this.domEventHandlers.forEach(handlerInfo => {
      if (handlerInfo && handlerInfo.element && handlerInfo.type && handlerInfo.handler) {
        try {
          handlerInfo.element.removeEventListener(
            handlerInfo.type, 
            handlerInfo.handler, 
            handlerInfo.useCapture || false
          );
        } catch (e) {
          // Ignore removal errors
        }
      }
    });
    this.domEventHandlers = [];
  }
}

export default SimpleLabelDragger;