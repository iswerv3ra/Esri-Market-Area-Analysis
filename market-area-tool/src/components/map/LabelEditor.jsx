import React, { useState, useEffect, useRef } from "react";
import {
  Sliders, Move, Type, Lock, Save, Edit, Check, X as XIcon,
  RefreshCw, AlertTriangle, Layers, Globe, MousePointer, MoveHorizontal, CheckCircle2
} from "lucide-react";
import SimpleLabelDragger from "../../services/SimpleLabelDragger";

/**
 * Checks if a label symbol has a rectangular background
 * @param {Object} symbol - The text symbol to check
 * @returns {boolean} - Whether the label has a background rectangle
 */
const hasBackgroundRectangle = (symbol) => {
  if (!symbol) return false;
  // Check for explicit background color property and ensure it's not transparent
  return symbol.backgroundColor !== null && symbol.backgroundColor !== undefined &&
         (Array.isArray(symbol.backgroundColor) ? symbol.backgroundColor[3] > 0 : symbol.backgroundColor.a > 0);
};

/**
 * Gets the background opacity from a symbol
 * @param {Object} symbol - The text symbol to check
 * @returns {number} - The opacity value between 0-1
 */
const getBackgroundOpacity = (symbol) => {
  if (!symbol || !symbol.backgroundColor) return 0.85; // Default opacity
  
  if (Array.isArray(symbol.backgroundColor) && symbol.backgroundColor.length >= 4) {
    return symbol.backgroundColor[3]; // RGBA array format
  } else if (symbol.backgroundColor && typeof symbol.backgroundColor === 'object' && 
             symbol.backgroundColor.a !== undefined) {
    return symbol.backgroundColor.a; // Object format with alpha
  }
  
  return 0.85; // Default fallback
};

const LabelEditor = ({
  isOpen,
  onClose,
  mapView,
  labelManager,
  labelDragger, // Optional prop - expecting an instance of SimpleLabelDragger
  activeLayer, // Optional: Layer context
}) => {
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [fontSize, setFontSize] = useState(10);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [labelText, setLabelText] = useState("");
  const [isMoving, setIsMoving] = useState(false); // For single label move (DEPRECATED)
  const [selectAllMode, setSelectAllMode] = useState(false);
  const [isTextEditing, setIsTextEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [apiAvailable, setApiAvailable] = useState(true); // Always true for localStorage
  const [allLabelsCount, setAllLabelsCount] = useState(0); // Track total label count
  const [backgroundOpacity, setBackgroundOpacity] = useState(0.85); // Default opacity for backgrounds
  const [labelOptions, setLabelOptions] = useState({
    includeVariables: true,      // Whether to include variables in labels
    avoidCollisions: true,       // Whether to avoid label collisions
    visibleAtAllZooms: false,    // Whether labels are visible at all zoom levels
    fontSize: 10,                // Default label font size
    bold: false,                 // Whether to use bold text for labels
    whiteBackground: false,      // Whether to use a solid white background
    showLabelConfig: false       // UI toggle for label settings
  });
  const [draggerInitialized, setDraggerInitialized] = useState(false);
  const [localLabelDragger, setLocalLabelDragger] = useState(null);
  const textInputRef = useRef(null);
  
  // State for Position Adjustment Mode (formerly Multi-Drag Mode)
  const [isMultiDragMode, setIsMultiDragMode] = useState(false);
  const [draggedLabels, setDraggedLabels] = useState([]); // { graphic, originalPosition, currentPosition }
  const [dragInfo, setDragInfo] = useState({ startPoint: null, draggedLabels: [] });
  const [extraHandlers, setExtraHandlers] = useState([]);
  const [originalNavState, setOriginalNavState] = useState(null); // Used by Position Adjustment Mode
  

  useEffect(() => {
    // Only try to initialize if the editor is open and prerequisites are available
    if (!isOpen || !mapView || !labelManager) return;
    
    // Only initialize once
    if (draggerInitialized) return;
    
    // Check if we already have a dragger from either source
    const existingDragger = localLabelDragger || 
                           (typeof window !== 'undefined' ? window.labelDragger : null);
    
    if (existingDragger && typeof existingDragger.enable === 'function') {
      console.log("[LabelEditor] Label dragger already initialized");
      setLocalLabelDragger(existingDragger);
      setDraggerInitialized(true);
      return;
    }
    
    try {
      console.log("[LabelEditor] Creating a new SimpleLabelDragger instance");
      
      // Create a new SimpleLabelDragger instance directly
      const dragger = new SimpleLabelDragger({
        view: mapView,
        labelManager: labelManager,
        onDragStart: (label) => {
          console.log("[LabelDragger] Started dragging label:", labelManager.getLabelId(label));
        },
        onDrag: (label, dx, dy) => {
          // Update is handled internally by the dragger
          console.log("[LabelDragger] Dragging label:", labelManager.getLabelId(label), `delta: (${dx}, ${dy})`);
        },
        onDragEnd: (label) => {
          console.log("[LabelDragger] Finished dragging label:", labelManager.getLabelId(label));
          // Consider saving after drag ends
          if (labelManager && typeof labelManager.savePositions === 'function') {
            const result = labelManager.savePositions(false);
            // Check if result is a Promise before using .catch
            if (result && typeof result.catch === 'function') {
              result.catch(err => {
                console.error("[LabelDragger] Error saving after drag:", err);
              });
            }
          }
        }
      });
      
      // Initialize and store the dragger
      dragger.initialize();
      setLocalLabelDragger(dragger);
      window.labelDragger = dragger;
      setDraggerInitialized(true);
      console.log("[LabelEditor] SimpleLabelDragger initialized successfully");
    } catch (error) {
      console.error("[LabelEditor] Error creating SimpleLabelDragger:", error);
      
      // Fall back to using the manager's method if direct initialization fails
      if (typeof labelManager.createLabelDragger === 'function') {
        try {
          console.log("[LabelEditor] Falling back to labelManager.createLabelDragger");
          const fallbackDragger = labelManager.createLabelDragger(mapView);
          
          if (fallbackDragger && typeof fallbackDragger.enable === 'function') {
            setLocalLabelDragger(fallbackDragger);
            window.labelDragger = fallbackDragger;
            setDraggerInitialized(true);
            console.log("[LabelEditor] Fallback dragger initialized successfully");
          }
        } catch (fallbackError) {
          console.error("[LabelEditor] Fallback initialization failed:", fallbackError);
        }
      }
    }
  }, [isOpen, mapView, labelManager, draggerInitialized, localLabelDragger]);

  // --- Auto-focus text input when editing ---
  useEffect(() => {
    if (isTextEditing && textInputRef.current) {
      textInputRef.current.focus();
      textInputRef.current.select();
    }
  }, [isTextEditing]);

  // --- Handle status message timeouts ---
  useEffect(() => {
    let timer;
    if (statusMessage && statusMessage.timeout) {
      timer = setTimeout(() => {
        setStatusMessage(null);
      }, statusMessage.timeout);
    }
    return () => clearTimeout(timer);
  }, [statusMessage]);

  // --- Watch for label selection changes ---
  useEffect(() => {
    if (!isOpen || !labelManager) return;

    // Define the selection watcher function
    const watchSelection = () => {
      // Get the currently selected label from the labelManager
      const currentSelectedLabel = labelManager.selectedLabel || null;
      
      // If it's different from our current state, update
      if (currentSelectedLabel !== selectedLabel) {
        console.log("[LabelEditor] Label selection changed:", 
          currentSelectedLabel ? labelManager.getLabelId(currentSelectedLabel) : 'none');
        
        // Update our state
        setSelectedLabel(currentSelectedLabel);
        
        // Update position display if selected
        if (currentSelectedLabel && currentSelectedLabel.symbol) {
          const symbol = currentSelectedLabel.symbol;
          setPosition({
            x: symbol.xoffset || 0,
            y: symbol.yoffset || 0
          });
          
          // Update font size
          if (symbol.font && typeof symbol.font.size === 'number') {
            setFontSize(symbol.font.size);
          } else {
            setFontSize(10); // Default
          }
          
          // Update label text
          let textToDisplay = symbol.text || "";
          if (currentSelectedLabel.attributes?.hasCustomFormat && 
              currentSelectedLabel.attributes?.originalLabel) {
            textToDisplay = currentSelectedLabel.attributes.originalLabel;
          }
          setLabelText(textToDisplay);
          
          // Update style options
          setLabelOptions(prev => ({
            ...prev,
            bold: symbol.font?.weight === 'bold',
            whiteBackground: hasBackgroundRectangle(symbol)
          }));
          
          // Update background opacity if background is enabled
          if (symbol.backgroundColor) {
            setBackgroundOpacity(getBackgroundOpacity(symbol));
          }
        }
      }
    };
    
    // Initial check
    watchSelection();
    
    // Set up a listener for the custom event our dragger dispatches
    const handleLabelSelected = (event) => {
      console.log("[LabelEditor] Label selection event received");
      watchSelection();
    };
    
    // Add event listener
    window.addEventListener('labelSelected', handleLabelSelected);
    
    // Also set up a polling interval as a fallback
    const intervalId = setInterval(watchSelection, 500);
    
    // Clean up
    return () => {
      window.removeEventListener('labelSelected', handleLabelSelected);
      clearInterval(intervalId);
    };
  }, [isOpen, labelManager, selectedLabel]);

  // --- Cleanup for Position Adjustment Mode ---
  useEffect(() => {
    // This effect specifically handles the cleanup when position adjustment mode is turned off
    // or the component unmounts while it's active.
    return () => {
      if (isMultiDragMode) {
        console.log("[LabelEditor Cleanup Effect] Cleaning up Position Adjustment Mode...");
        
        // Get the dragger
        const dragger = localLabelDragger || 
                       (typeof window !== 'undefined' ? window.labelDragger : null);
        
        // Deactivate the dragger if it's available
        if (dragger) {
          try {
            if (dragger instanceof SimpleLabelDragger) {
              dragger.deactivate();
              console.log("[LabelEditor Cleanup] Deactivated SimpleLabelDragger");
            } else if (typeof dragger.enable === 'function') {
              dragger.enable(false);
              console.log("[LabelEditor Cleanup] Disabled position adjustment mode");
            }
          } catch (e) {
            console.warn("[LabelEditor Cleanup] Error disabling position adjustment mode:", e);
          }
        }
        
        // Remove extra handlers safely
        extraHandlers.forEach(handler => {
          if (handler && typeof handler.remove === 'function') {
            try { handler.remove(); } catch(e) { console.warn("Error removing handler:", e); }
          }
        });
        setExtraHandlers([]);
        
        // Restore navigation if possible
        if (mapView?.navigation && originalNavState) {
          try {
            mapView.navigation.browserTouchPanEnabled = originalNavState.browserTouchPanEnabled;
            if (originalNavState.keyboardNavigation !== undefined) {
                mapView.navigation.keyboardNavigation = originalNavState.keyboardNavigation;
            }
          } catch (e) { console.warn("Error restoring navigation:", e); }
        }
        setOriginalNavState(null);
        
        // Restore cursor
        if (mapView?.container) {
          try { mapView.container.style.cursor = 'default'; } catch(e) { console.warn("Error restoring cursor:", e); }
        }
      }
    };
  }, [isMultiDragMode, extraHandlers, originalNavState, mapView, localLabelDragger]);

// UPDATED: Enhanced updateFontSize function that ensures fontSize is saved properly
const updateFontSize = (newSize) => {
  setFontSize(newSize); // Update local state immediately

  if (!labelManager || typeof labelManager.updateLabelFontSize !== 'function') {
      console.warn("Cannot update font size: Manager or method missing.");
      return;
  }

  try {
      if (selectAllMode) {
          if (typeof labelManager.getAllLabelGraphics === 'function') {
              const allLabels = labelManager.getAllLabelGraphics();
              let updateCount = 0;
              allLabels.forEach(label => {
                  if (label && label.symbol) {
                      // Update the actual graphic
                      labelManager.updateLabelFontSize(label, newSize);
                      
                      // CRITICAL: Also update in the editedLabels map with explicit fontSize property
                      const labelId = labelManager.getLabelId(label);
                      if (labelId && labelManager.editedLabels) {
                          const existingData = labelManager.editedLabels.get(labelId) || {};
                          labelManager.editedLabels.set(labelId, {
                              ...existingData,
                              fontSize: newSize, // Store fontSize DIRECTLY in the data object
                              graphic: label
                          });
                      }
                      
                      updateCount++;
                  }
              });
              console.log(`[LabelEditor] Updated font size to ${newSize} for ALL labels (${updateCount} updates)`);
              setStatusMessage({ type: 'success', text: `Updated font size to ${newSize}px for ${updateCount} labels`, timeout: 3000 });
              
              // CRITICAL: Save immediately after updating all labels to ensure persistence
              if (typeof labelManager.savePositions === 'function') {
                  labelManager.savePositions(true); // Force immediate save
              }
          } else {
              console.warn("[LabelEditor] Cannot get all labels: getAllLabelGraphics method missing");
              setStatusMessage({ type: 'warning', text: `Cannot update all labels: method missing`, timeout: 3000 });
          }
      } else if (selectedLabel) {
          // Update the actual graphic
          labelManager.updateLabelFontSize(selectedLabel, newSize);
          
          // CRITICAL: Also update in the editedLabels map with explicit fontSize property
          const labelId = labelManager.getLabelId(selectedLabel);
          if (labelId && labelManager.editedLabels) {
              const existingData = labelManager.editedLabels.get(labelId) || {};
              labelManager.editedLabels.set(labelId, {
                  ...existingData,
                  fontSize: newSize, // Store fontSize DIRECTLY in the data object
                  graphic: selectedLabel
              });
          }
          
          console.log(`[LabelEditor] Updated font size to ${newSize} for selected label`);
          
          // CRITICAL: Save immediately to ensure persistence
          if (typeof labelManager.savePositions === 'function') {
              labelManager.savePositions(true); // Force immediate save
          }
      }
  } catch (error) {
      console.error('[LabelEditor] Error updating font size:', error);
      setStatusMessage({ type: 'error', text: `Font size update error: ${error.message}`, timeout: 5000 });
  }
};

  // --- Update Background Opacity for Selected Label ---
  const updateBackgroundOpacity = (opacity) => {
    setBackgroundOpacity(opacity);
    
    if (!labelManager || !selectedLabel || !selectedLabel.symbol) {
      console.warn("[LabelEditor] Cannot update background opacity: Missing required references");
      return;
    }
    
    try {
      // Clone the symbol for modification
      const newSymbol = selectedLabel.symbol.clone();
      
      // Get current background color
      let bgColor = newSymbol.backgroundColor;
      
      // If not already using background or array format, create default white
      if (!bgColor || !Array.isArray(bgColor)) {
        bgColor = [255, 255, 255, opacity];
      } else {
        // If array format, update the opacity (alpha) value
        bgColor[3] = opacity;
      }
      
      // Apply the updated background color
      newSymbol.backgroundColor = bgColor;
      
      // Apply the updated symbol
      selectedLabel.symbol = newSymbol;
      
      // Update in label manager if it has tracking
      if (typeof labelManager.getLabelId === 'function' && 
          typeof labelManager.editedLabels === 'object' && 
          labelManager.editedLabels) {
        const labelId = labelManager.getLabelId(selectedLabel);
        if (labelId) {
          const existingData = labelManager.editedLabels.get(labelId) || {};
          labelManager.editedLabels.set(labelId, {
            ...existingData, graphic: selectedLabel
          });
        }
      }
      
      // Force refresh
      if (labelManager.refreshLabels) {
        labelManager.refreshLabels();
      } else if (mapView?.graphics) {
        mapView.graphics.refresh();
      }
      
      console.log(`[LabelEditor] Updated background opacity to ${opacity}`);
    } catch (error) {
      console.error("[LabelEditor] Error updating background opacity:", error);
      setStatusMessage({ 
        type: 'error', 
        text: `Failed to update background opacity: ${error.message}`, 
        timeout: 3000 
      });
    }
  };

  // --- Update Background Opacity for All Labels ---
  const updateGlobalBackgroundOpacity = (opacity) => {
    setBackgroundOpacity(opacity); // Update state
    
    if (!labelManager || typeof labelManager.getAllLabelGraphics !== 'function') {
      console.warn("[LabelEditor] Cannot update global background opacity: Missing required methods");
      return;
    }
    
    try {
      const allLabels = labelManager.getAllLabelGraphics();
      if (!allLabels || allLabels.length === 0) return;
      
      let updateCount = 0;
      
      allLabels.forEach(label => {
        if (!label || !label.symbol) return;
        
        // Only update labels that already have a background
        if (hasBackgroundRectangle(label.symbol)) {
          const newSymbol = label.symbol.clone();
          let bgColor = newSymbol.backgroundColor;
          
          if (Array.isArray(bgColor)) {
            bgColor[3] = opacity;
          } else if (bgColor && typeof bgColor === 'object') {
            bgColor.a = opacity;
          } else {
            bgColor = [255, 255, 255, opacity];
          }
          
          newSymbol.backgroundColor = bgColor;
          label.symbol = newSymbol;
          
          // Track in manager's editedLabels if available
          if (typeof labelManager.getLabelId === 'function' && 
              typeof labelManager.editedLabels === 'object' && 
              labelManager.editedLabels) {
            const labelId = labelManager.getLabelId(label);
            if (labelId) {
              const existingData = labelManager.editedLabels.get(labelId) || {};
              labelManager.editedLabels.set(labelId, {
                ...existingData, graphic: label
              });
            }
          }
          
          updateCount++;
        }
      });
      
      // Force refresh
      if (labelManager.refreshLabels) {
        labelManager.refreshLabels();
      } else if (mapView?.graphics) {
        mapView.graphics.refresh();
      }
      
      if (updateCount > 0) {
        console.log(`[LabelEditor] Updated background opacity to ${opacity} for ${updateCount} labels`);
        setStatusMessage({ 
          type: 'success', 
          text: `Updated background opacity for ${updateCount} labels`, 
          timeout: 2000 
        });
      }
    } catch (error) {
      console.error("[LabelEditor] Error updating global background opacity:", error);
      setStatusMessage({ 
        type: 'error', 
        text: `Failed to update background opacity: ${error.message}`, 
        timeout: 3000 
      });
    }
  };

  const togglePositionAdjustmentMode = (enable) => {
    const newMode = enable !== undefined ? enable : !isMultiDragMode;
    console.log(`[PositionAdjust] Toggling mode to: ${newMode}`);
    
    // Update state first
    setIsMultiDragMode(newMode);
    
    try {
      // Store original navigation state before disabling
      if (newMode && mapView && mapView.navigation) {
        setOriginalNavState({
          browserTouchPanEnabled: mapView.navigation.browserTouchPanEnabled,
          mouseWheelZoomEnabled: mapView.navigation.mouseWheelZoomEnabled,
          keyboardNavigation: mapView.navigation.keyboardNavigation,
          momentumEnabled: mapView.navigation.momentumEnabled || false,
          dragEnabled: mapView.navigation.dragEnabled || true
        });
        
        // CRITICAL FIX: Completely disable map navigation during dragging
        mapView.navigation.browserTouchPanEnabled = false;
        mapView.navigation.mouseWheelZoomEnabled = false;
        mapView.navigation.keyboardNavigation = false;
        mapView.navigation.momentumEnabled = false;
        
        // Disable drag navigation if that property exists
        if (typeof mapView.navigation.dragEnabled !== 'undefined') {
          mapView.navigation.dragEnabled = false;
        }
        
        // Set a flag on the mapView to indicate label editing mode
        mapView._labelEditingActive = true;
        
        // Add class to map container to prevent default touch behaviors
        if (mapView.container) {
          mapView.container.classList.add('label-edit-mode');
        }
      }
      
      // Try to get the dragger from our state or window
      let dragger = localLabelDragger || 
                   (typeof window !== 'undefined' ? window.labelDragger : null);
      
      // If we don't have a dragger yet, create one
      if (!dragger && newMode && mapView && labelManager) {
        console.log("[PositionAdjust] Creating a new SimpleLabelDragger instance");
        
        try {
          const newDragger = new SimpleLabelDragger({
            view: mapView,
            labelManager: labelManager,
            onDragStart: (label) => {
              console.log("[LabelDragger] Started dragging label:", labelManager.getLabelId(label));
            },
            onDrag: (label, dx, dy) => {
              console.log("[LabelDragger] Dragging label:", labelManager.getLabelId(label), `delta: (${dx}, ${dy})`);
            },
            onDragEnd: (label) => {
              console.log("[LabelDragger] Finished dragging label:", labelManager.getLabelId(label));
              // Save after drag ends
              if (labelManager && typeof labelManager.savePositions === 'function') {
                labelManager.savePositions(true).catch(err => {
                  console.error("[LabelDragger] Error saving after drag:", err);
                });
              }
            }
          });
          
          // Initialize the dragger
          if (typeof newDragger.initialize === 'function') {
            newDragger.initialize();
          }
          
          // Store the new dragger
          dragger = newDragger;
          setLocalLabelDragger(newDragger);
          window.labelDragger = newDragger;
          setDraggerInitialized(true);
          
          console.log("[PositionAdjust] Successfully created SimpleLabelDragger");
        } catch (initError) {
          console.error("[PositionAdjust] Error creating dragger:", initError);
          throw new Error("Failed to create label dragger: " + initError.message);
        }
      }
      
      // Verify we have a usable dragger
      if (!dragger) {
        throw new Error("No dragger available and could not create one");
      }
      
      // Check if dragger has the necessary methods
      const hasEnableMethod = typeof dragger.enable === 'function';
      const hasActivateMethod = typeof dragger.activate === 'function';
      const hasDeactivateMethod = typeof dragger.deactivate === 'function';
      
      if (!hasEnableMethod && !hasActivateMethod && !hasDeactivateMethod) {
        throw new Error("Dragger is missing required methods: enable, activate, or deactivate");
      }
      
      // Toggle dragger state using the available method
      if (newMode) {
        // Activate dragger using the most appropriate method
        if (hasActivateMethod) {
          const result = dragger.activate();
          console.log("[PositionAdjust] Dragger activate result:", result);
        } else if (hasEnableMethod) {
          const result = dragger.enable(true);
          console.log("[PositionAdjust] Dragger enable(true) result:", result);
        } else {
          throw new Error("Cannot activate dragger - no suitable method available");
        }
      } else {
        // Deactivate dragger using the most appropriate method
        if (hasDeactivateMethod) {
          const result = dragger.deactivate();
          console.log("[PositionAdjust] Dragger deactivate result:", result);
        } else if (hasEnableMethod) {
          const result = dragger.enable(false);
          console.log("[PositionAdjust] Dragger enable(false) result:", result);
        } else {
          throw new Error("Cannot deactivate dragger - no suitable method available");
        }
        
        // Restore map navigation when deactivating
        if (mapView && mapView.navigation && originalNavState) {
          mapView.navigation.browserTouchPanEnabled = originalNavState.browserTouchPanEnabled;
          mapView.navigation.mouseWheelZoomEnabled = originalNavState.mouseWheelZoomEnabled;
          mapView.navigation.keyboardNavigation = originalNavState.keyboardNavigation || false;
          mapView.navigation.momentumEnabled = originalNavState.momentumEnabled || false;
          
          // Restore drag navigation if applicable
          if (typeof mapView.navigation.dragEnabled !== 'undefined') {
            mapView.navigation.dragEnabled = originalNavState.dragEnabled || true;
          }
          
          // Remove the editing flag
          mapView._labelEditingActive = false;
        }
        
        // Remove class from map container
        if (mapView && mapView.container) {
          mapView.container.classList.remove('label-edit-mode');
        }
      }
      
      // Update map cursor to indicate mode
      if (mapView && mapView.container) {
        mapView.container.style.cursor = newMode ? 'move' : 'default';
      }
      
      setStatusMessage({ 
        type: 'info', 
        text: newMode ? 'Position Adjustment Mode: Click to select a label, then click again to place it' : 'Position adjustment mode disabled', 
        timeout: 3000 
      });
      
      return true;
    } catch (error) {
      console.error("[PositionAdjust] Error toggling dragger:", error);
      setStatusMessage({ 
        type: 'error', 
        text: `Error toggling position adjustment mode: ${error.message}`, 
        timeout: 5000 
      });
      
      // Reset navigation and UI state on error
      if (newMode && mapView && mapView.navigation && originalNavState) {
        mapView.navigation.browserTouchPanEnabled = originalNavState.browserTouchPanEnabled;
        mapView.navigation.mouseWheelZoomEnabled = originalNavState.mouseWheelZoomEnabled;
        mapView.navigation.keyboardNavigation = originalNavState.keyboardNavigation || false;
        mapView.navigation.momentumEnabled = originalNavState.momentumEnabled || false;
        mapView._labelEditingActive = false;
      }
      
      // Reset UI state
      setIsMultiDragMode(false);
      
      return false;
    }
  };

  // --- Update Label Text ---
  const updateLabelText = (newText) => {
    const cleanText = newText.trim();
    setLabelText(cleanText); // Update local state for input field

    if (!labelManager || typeof labelManager.updateLabelText !== 'function' || !selectedLabel) {
        console.warn("Cannot update label text: Manager, method, or selected label missing.");
        return;
    }

    try {
        labelManager.updateLabelText(selectedLabel, cleanText); // Pass the clean base text
        console.log(`[LabelEditor] Updated text for selected label to: "${cleanText}"`);
        // UI display text is handled by watchSelection reading symbol.text
    } catch (error) {
        console.error('[LabelEditor] Error updating label text:', error);
        setStatusMessage({ type: 'error', text: `Text update error: ${error.message}`, timeout: 5000 });
    }
  };

  // --- Enable Single Label Moving Mode (DEPRECATED - use direct drag) ---
  const enableMovingMode = () => {
    console.warn("[LabelEditor] enableMovingMode is deprecated. Direct drag is handled in Map.jsx.");
    // If you need a fallback or specific UI state:
    // setIsMoving(true); // Set UI state if needed for feedback
    setStatusMessage({ type: 'info', text: 'Drag label directly on the map to adjust position.', timeout: 4000 });
  };

  // --- Stop Single Label Moving Mode (DEPRECATED) ---
  const stopMovingMode = () => {
    console.warn("[LabelEditor] stopMovingMode is deprecated.");
    // setIsMoving(false); // Reset UI state if used
  };

  // UPDATED: updateLabelOption function to properly track all changes
  const updateLabelOption = (option, value) => {
    console.log(`[LabelEditor] Updating ${option} to ${value}`);
    setLabelOptions(prev => ({ ...prev, [option]: value })); // Update general UI state

    if (!labelManager || !labelManager.getLabelId) {
        console.warn("[LabelEditor] No label manager or required methods available to apply changes");
        return;
    }

    try {
        const applyChange = (labelGraphic) => {
            if (!labelGraphic || !labelGraphic.symbol) return false;
            const newSymbol = labelGraphic.symbol.clone();
            let changed = false;

            switch (option) {
                case 'bold':
                    if (!newSymbol.font) newSymbol.font = {};
                    const newWeight = value ? 'bold' : 'normal';
                    if (newSymbol.font.weight !== newWeight) {
                        newSymbol.font.weight = newWeight;
                        changed = true;
                    }
                    break;

                case 'whiteBackground':
                    const currentBg = hasBackgroundRectangle(newSymbol);
                    if (value !== currentBg) {
                        if (value) {
                            // When enabling background, use the current opacity setting
                            newSymbol.backgroundColor = [255, 255, 255, backgroundOpacity];
                            newSymbol.backgroundBorderLineColor = [200, 200, 200, 0.5];
                            newSymbol.backgroundBorderLineSize = 0.5;
                            newSymbol.haloSize = 0; newSymbol.haloColor = null; // Remove halo
                        } else {
                            newSymbol.backgroundColor = null;
                            newSymbol.backgroundBorderLineColor = null;
                            newSymbol.backgroundBorderLineSize = 0;
                        }
                        changed = true;
                    }
                    break;
            }

            if (changed) {
                labelGraphic.symbol = newSymbol; // Apply the updated symbol
                const labelId = labelManager.getLabelId(labelGraphic);
                if (labelId && labelManager.editedLabels) {
                    const existingData = labelManager.editedLabels.get(labelId) || {};
                    
                    // Store BOTH in the symbol AND in the editedLabels data to ensure persistence
                    labelManager.editedLabels.set(labelId, {
                        ...existingData, 
                        graphic: labelGraphic,
                        // IMPORTANT: Explicitly store the font weight and background settings
                        fontWeight: option === 'bold' ? (value ? 'bold' : 'normal') : existingData.fontWeight,
                        backgroundColor: option === 'whiteBackground' ? 
                            (value ? [255, 255, 255, backgroundOpacity] : null) : 
                            existingData.backgroundColor
                    });
                }
                return true;
            }
            return false;
        };

        let updateCount = 0;
        let refreshNeeded = false;

        if (selectAllMode) {
            const allLabels = labelManager.getAllLabelGraphics ? labelManager.getAllLabelGraphics() : [];
            if (allLabels.length === 0) return;
            allLabels.forEach(label => {
                if (applyChange(label)) { updateCount++; refreshNeeded = true; }
            });
            if (updateCount > 0) {
                console.log(`[LabelEditor] Updated ${option} to ${value} for ${updateCount} labels`);
                setStatusMessage({ type: 'success', text: `Updated ${option} for ${updateCount} labels`, timeout: 2000 });
            }
        } else if (selectedLabel) {
            if (applyChange(selectedLabel)) {
                updateCount++; refreshNeeded = true;
                console.log(`[LabelEditor] Updated ${option} to ${value} for selected label`);
                // Sync UI toggle state after successful change
                const updatedSymbol = selectedLabel.symbol;
                if (option === 'bold') setLabelOptions(prev => ({ ...prev, bold: updatedSymbol?.font?.weight === 'bold' }));
                if (option === 'whiteBackground') setLabelOptions(prev => ({ ...prev, whiteBackground: hasBackgroundRectangle(updatedSymbol) }));
            }
        } else {
            console.warn("[LabelEditor] No label selected and not in Select All mode"); return;
        }

        if (refreshNeeded) {
            if (labelManager.refreshLabels) labelManager.refreshLabels();
            else if (mapView?.graphics) mapView.graphics.refresh();
            
            // Force a save after change to ensure persistence
            labelManager.savePositions(true);
        }

    } catch (error) {
        console.error(`[LabelEditor] Error updating ${option}:`, error);
        setStatusMessage({ type: 'error', text: `Failed to update ${option}: ${error.message}`, timeout: 3000 });
        setLabelOptions(prev => ({ ...prev, [option]: !value })); // Revert UI toggle
    }
  };

  // --- Toggle Select All Mode ---
  const toggleSelectAllMode = () => {
    const nextMode = !selectAllMode;
    setSelectAllMode(nextMode);

    if (nextMode) {
        if (selectedLabel) { // Deselect single label if activating Select All
             labelManager.selectedLabel = null;
             setSelectedLabel(null);
        }
        // if (isMoving) stopMovingMode(); // isMoving deprecated
        if (isMultiDragMode) togglePositionAdjustmentMode(false); // Turn off position adjustment

        if (labelManager && typeof labelManager.getAllLabelGraphics === 'function') {
            const allLabels = labelManager.getAllLabelGraphics();
            setAllLabelsCount(allLabels.length || 0);
            if (allLabels.length > 0 && allLabels[0].symbol) {
                const firstSymbol = allLabels[0].symbol;
                setFontSize(firstSymbol.font?.size || 10);
                setLabelOptions(prev => ({
                    ...prev,
                    bold: firstSymbol.font?.weight === 'bold',
                    whiteBackground: hasBackgroundRectangle(firstSymbol)
                }));
                
                // Set background opacity from first label with background
                const labelWithBg = allLabels.find(l => l && l.symbol && hasBackgroundRectangle(l.symbol));
                if (labelWithBg && labelWithBg.symbol) {
                  setBackgroundOpacity(getBackgroundOpacity(labelWithBg.symbol));
                }
            } else {
                setFontSize(10);
                setLabelOptions(prev => ({ ...prev, bold: false, whiteBackground: false }));
                setBackgroundOpacity(0.85);
            }
        } else {
            setFontSize(10);
            setLabelOptions(prev => ({ ...prev, bold: false, whiteBackground: false }));
            setBackgroundOpacity(0.85);
        }
        setStatusMessage({ type: 'info', text: `Select All Mode: Affects ${allLabelsCount} labels.`, timeout: 3000 });
    } else {
        setFontSize(10);
        setLabelOptions(prev => ({ ...prev, bold: false, whiteBackground: false }));
        setBackgroundOpacity(0.85);
    }
    console.log(`[LabelEditor] Toggled 'Select All' mode to: ${nextMode}`);
  };

  // --- New Function: Fix Overlapping Labels ---
  const handleFixOverlappingLabels = async () => {
    if (!mapView || !labelManager || isFixingOverlaps) return;
    
    try {
      setIsFixingOverlaps(true);
      setOverlapFixResults(null);
      setStatusMessage({ 
        type: 'info', 
        text: 'Analyzing labels for overlaps...', 
        timeout: 5000 
      });
      
      // Get all labels
      const allLabels = labelManager.getAllLabelGraphics ? 
        labelManager.getAllLabelGraphics() : [];
        
      if (!allLabels || allLabels.length < 2) {
        setStatusMessage({ 
          type: 'warning', 
          text: 'Not enough labels to analyze for overlaps.', 
          timeout: 3000 
        });
        setIsFixingOverlaps(false);
        return;
      }
      
      // Use visible labels only
      const visibleLabels = allLabels.filter(label => label.visible !== false);
      
      console.log(`[LabelEditor] Fixing overlaps for ${visibleLabels.length} visible labels`);
      
      // Allow the status message to render first
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Run the overlap resolver
      const result = resolveOverlappingLabels(visibleLabels, mapView, labelManager, 5, 3);
      
      if (result.success) {
        // Update status message based on results
        if (result.resolvedCount > 0) {
          setStatusMessage({ 
            type: 'success', 
            text: `Fixed overlaps for ${result.resolvedCount} labels. ${result.remainingOverlaps} minor overlaps remain.`, 
            timeout: 5000 
          });
          
          // Save changes
          if (typeof labelManager.savePositions === 'function') {
            labelManager.savePositions(true);
          }
        } else if (result.remainingOverlaps === 0) {
          setStatusMessage({ 
            type: 'info', 
            text: 'No significant label overlaps detected.', 
            timeout: 3000 
          });
        } else {
          setStatusMessage({ 
            type: 'warning', 
            text: `Couldn't resolve all overlaps. ${result.remainingOverlaps} overlaps remain.`, 
            timeout: 5000 
          });
        }
        
        // Store results for display
        setOverlapFixResults(result);
      } else {
        // Error handling
        setStatusMessage({ 
          type: 'error', 
          text: result.message || 'Error resolving label overlaps.', 
          timeout: 5000 
        });
      }
    } catch (error) {
      console.error('[LabelEditor] Error fixing overlapping labels:', error);
      setStatusMessage({ 
        type: 'error', 
        text: `Error: ${error.message}`, 
        timeout: 5000 
      });
    } finally {
      setIsFixingOverlaps(false);
    }
  };

// UPDATED: Enhanced finalizeLabels function with more robust saving
const finalizeLabels = async (silent = false) => {
  if (isSaving || !labelManager || typeof labelManager.savePositions !== 'function') {
      console.log(`[LabelEditor] Save skipped: ${isSaving ? 'Already saving' : 'Manager/method missing'}`);
      return false;
  }
  setIsSaving(true);

  try {
      // Commit pending UI changes first
      if (isTextEditing && selectedLabel) {
          const baseText = selectedLabel.attributes?.hasCustomFormat
              ? labelText.replace(/\s*\(.*\)$/, '').trim()
              : labelText;
          updateLabelText(baseText);
          setIsTextEditing(false);
      }

      // CRITICAL: Make sure we capture and save current UI state for fontSize 
      // and other properties before finalizing
      if (selectAllMode) {
          // In select all mode, apply current fontSize to all labels
          const allLabels = labelManager.getAllLabelGraphics ? labelManager.getAllLabelGraphics() : [];
          if (allLabels && allLabels.length > 0) {
              console.log(`[LabelEditor] Applying final fontSize ${fontSize} to all ${allLabels.length} labels`);
              allLabels.forEach(label => {
                  if (label && typeof labelManager.updateLabelFontSize === 'function') {
                      // Force update fontSize in the graphic
                      labelManager.updateLabelFontSize(label, fontSize);
                      
                      // Also ensure it's stored in editedLabels with all properties
                      const labelId = labelManager.getLabelId(label);
                      if (labelId && labelManager.editedLabels) {
                          const existingData = labelManager.editedLabels.get(labelId) || {};
                          labelManager.editedLabels.set(labelId, {
                              ...existingData,
                              fontSize: fontSize, // Store fontSize DIRECTLY in the data object
                              fontWeight: labelOptions.bold ? 'bold' : 'normal',
                              backgroundColor: labelOptions.whiteBackground ? [255, 255, 255, backgroundOpacity] : null
                          });
                      }
                  }
              });
          }
      } else if (selectedLabel) {
          // For single label, ensure current UI state is applied
          if (typeof labelManager.updateLabelFontSize === 'function') {
              labelManager.updateLabelFontSize(selectedLabel, fontSize);
          }
          
          // Force bold and background settings to be applied
          const labelId = labelManager.getLabelId(selectedLabel);
          if (labelId && labelManager.editedLabels) {
              const existingData = labelManager.editedLabels.get(labelId) || {};
              labelManager.editedLabels.set(labelId, {
                  ...existingData,
                  fontSize: fontSize, // Store fontSize DIRECTLY in the data object
                  fontWeight: labelOptions.bold ? 'bold' : 'normal',
                  backgroundColor: labelOptions.whiteBackground ? [255, 255, 255, backgroundOpacity] : null
              });
          }
      }

      // Force immediate save with true parameter
      console.log("[LabelEditor] Performing final save with current font settings");
      const result = await labelManager.savePositions(true); 
      console.log('[LabelEditor] Save result:', result);

      if (!silent) {
          const count = (labelManager.editedLabels?.size !== undefined) ? labelManager.editedLabels.size : (result?.count || 0);
          setStatusMessage({
              type: 'success',
              text: count > 0 ? `Applied ${count} label modifications.` : 'No modifications to apply.',
              timeout: 3000
          });
      }
      
      // After saving, force a refresh of all labels to make sure changes are visible
      if (typeof labelManager.refreshLabels === 'function') {
          setTimeout(() => labelManager.refreshLabels(), 100);
      }
      
      if (labelManager.editedLabels?.size) {
          console.log(`[LabelEditor] Successfully saved ${labelManager.editedLabels.size} edited labels.`);
      }
      return true;
  } catch (error) {
      console.error('[LabelEditor] Error saving labels:', error);
      if (!silent) {
          setStatusMessage({ type: 'error', text: `Save error: ${error.message}`, timeout: 5000 });
      }
      return false;
  } finally {
      setIsSaving(false);
  }
};

  // --- Refresh Labels from Source ---
  const refreshLabels = () => {
    if (!labelManager || typeof labelManager.refreshLabels !== 'function') {
        console.warn("Cannot refresh labels: Manager or method missing.");
        return;
    }
    try {
        const result = labelManager.refreshLabels();
        console.log('[LabelEditor] Refresh result:', result);

        if (labelManager.getAllLabelGraphics) {
            setAllLabelsCount(labelManager.getAllLabelGraphics().length || 0);
        }
        setSelectedLabel(null); labelManager.selectedLabel = null; // Clear selection
        setLabelText(""); setFontSize(10); setPosition({ x: 0, y: 0 });
        setIsTextEditing(false); setSelectAllMode(false);
        if (isMultiDragMode) togglePositionAdjustmentMode(false);
        setLabelOptions(prev => ({ ...prev, bold: false, whiteBackground: false }));
        setBackgroundOpacity(0.85);

        setStatusMessage({ type: 'success', text: `Refreshed labels from source.`, timeout: 3000 });
    } catch (error) {
        console.error('[LabelEditor] Error refreshing labels:', error);
        setStatusMessage({ type: 'error', text: `Refresh error: ${error.message}`, timeout: 5000 });
    }
  };

  // --- Reset All Local Changes ---
  const resetChanges = () => {
    if (!labelManager || typeof labelManager.resetAllLabels !== 'function') {
        console.warn("Cannot reset labels: Manager or method missing.");
        return;
    }
    try {
        const result = labelManager.resetAllLabels();
        console.log('[LabelEditor] Reset result:', result);

        setSelectedLabel(null); labelManager.selectedLabel = null;
        setLabelText(""); setFontSize(10); setPosition({ x: 0, y: 0 });
        setIsTextEditing(false); setSelectAllMode(false);
        if (isMultiDragMode) togglePositionAdjustmentMode(false);
        setLabelOptions(prev => ({ ...prev, bold: false, whiteBackground: false }));
        setBackgroundOpacity(0.85);

        if (labelManager.editedLabels?.clear) {
             labelManager.editedLabels.clear();
        }
        // Force re-render to update count display
        setFontSize(prev => prev);

        setStatusMessage({ type: 'success', text: `Reverted ${result?.count || 0} local changes.`, timeout: 3000 });
    } catch (error) {
        console.error('[LabelEditor] Error resetting labels:', error);
        setStatusMessage({ type: 'error', text: `Reset error: ${error.message}`, timeout: 5000 });
    }
  };

  // --- Reset Single Label ---
  const resetSingleLabel = () => {
    if (!selectedLabel || !labelManager || typeof labelManager.resetLabelPosition !== 'function') {
        console.warn("Cannot reset single label: No label selected or manager/method missing.");
        return;
    }
    try {
        const result = labelManager.resetLabelPosition(selectedLabel);
        console.log('[LabelEditor] Reset single label result:', result);

        if (result.success) {
            // Rely on watchSelection to update UI from manager's potentially reset graphic
            // Force immediate UI update for better feedback
            const resetGraphic = result.graphic || selectedLabel;
            if (resetGraphic?.symbol) {
                const symbol = resetGraphic.symbol;
                const font = symbol.font;
                setFontSize(font?.size || 10);
                const baseText = resetGraphic.attributes?.hasCustomFormat ? resetGraphic.attributes.originalLabel || symbol.text : symbol.text;
                setLabelText(baseText || "");
                setPosition({ x: symbol.xoffset || 0, y: symbol.yoffset || 0 }); // Use reset offset
                setLabelOptions(prev => ({
                    ...prev,
                    bold: font?.weight === 'bold',
                    whiteBackground: hasBackgroundRectangle(symbol)
                }));
                setIsTextEditing(false);
                setBackgroundOpacity(getBackgroundOpacity(symbol));
            }
            setStatusMessage({ type: 'success', text: 'Label reset to default', timeout: 3000 });
        } else {
            setStatusMessage({ type: 'error', text: result.message || 'Could not reset label', timeout: 5000 });
        }
    } catch (error) {
        console.error('[LabelEditor] Error resetting single label:', error);
        setStatusMessage({ type: 'error', text: `Reset error: ${error.message}`, timeout: 5000 });
    }
  };

  // --- Handle Editor Close ---
  const handleClose = async () => {
    // Always save changes on close
    if (labelManager && typeof labelManager.savePositions === 'function') {
        try {
            console.log("[LabelEditor] Saving all label modifications before closing");
            await finalizeLabels(true); // Save pending changes silently
            
            // Second force-save to ensure persistence
            await labelManager.savePositions(true);
            
            // Force a final refresh
            if (typeof labelManager.refreshLabels === 'function') {
                labelManager.refreshLabels();
            }
        } catch (err) {
            console.error("[LabelEditor] Error during final save:", err);
        }
    }
    
    // Ensure position adjustment mode is disabled
    if (isMultiDragMode) {
        togglePositionAdjustmentMode(false);
    }

    // Call parent's close handler after ensuring changes are saved
    if (onClose) {
        onClose();
    }
};

  // --- Render Status Message ---
  const renderStatusMessage = () => {
    if (!statusMessage) return null;
    const bgColor =
      statusMessage.type === 'error' ? 'bg-red-100 dark:bg-red-900/40' :
      statusMessage.type === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/40' :
      statusMessage.type === 'info' ? 'bg-blue-100 dark:bg-blue-900/40' :
      'bg-green-100 dark:bg-green-900/40';
    const textColor =
      statusMessage.type === 'error' ? 'text-red-700 dark:text-red-300' :
      statusMessage.type === 'warning' ? 'text-yellow-700 dark:text-yellow-300' :
      statusMessage.type === 'info' ? 'text-blue-700 dark:text-blue-300' :
      'text-green-700 dark:text-green-300';
    let iconComponent;
    if (statusMessage.type === 'error' || statusMessage.type === 'warning') {
      iconComponent = <AlertTriangle className="h-4 w-4 flex-shrink-0" />;
    } else if (statusMessage.type === 'info') {
      iconComponent = <Globe className="h-4 w-4 flex-shrink-0" />;
    } else {
      iconComponent = <Check className="h-4 w-4 flex-shrink-0" />;
    }
    return (
      <div className={`mb-4 p-3 rounded-md ${bgColor} ${textColor} flex items-center space-x-2 text-sm`}>
        {iconComponent}
        <span>{statusMessage.text}</span>
      </div>
    );
  };

  // --- RENDER ---
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="flex-none p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold">Label Editor</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {isMultiDragMode ? "Position Adjustment Mode Active." : "Click label to edit. Drag labels on map."}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {/* Position Adjustment Mode Toggle */}
            <button
              onClick={() => togglePositionAdjustmentMode()}
              className={`p-2 rounded-md ${isMultiDragMode ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              title={isMultiDragMode ? "Exit Position Adjustment Mode" : "Enter Position Adjustment Mode"}
              disabled={selectAllMode} // Disable if selectAllMode active
            >
              <MousePointer size={18} />
            </button>

            {/* Select All Mode Toggle */}
            <button
              onClick={toggleSelectAllMode}
              className={`p-2 rounded-md ${selectAllMode ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              title={selectAllMode ? "Exit Select All Mode" : "Select All Mode"}
               disabled={isMultiDragMode} // Disable if position adjustment active
            >
              <Layers size={18} />
            </button>

            {/* Refresh Button */}
            <button
              onClick={refreshLabels}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Refresh labels from source"
              disabled={isSaving}
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Mode Indicator Banners */}
      {selectAllMode && (
        <div className="bg-blue-50 dark:bg-blue-900/30 px-4 py-2 border-b border-blue-100 dark:border-blue-800">
          <div className="flex items-center text-blue-700 dark:text-blue-300">
            <Globe className="h-4 w-4 mr-2" />
            <span className="text-sm font-medium">
              Select All Mode: Adjusting {allLabelsCount} labels simultaneously
            </span>
          </div>
        </div>
      )}
       {isMultiDragMode && (
        <div className="bg-purple-50 dark:bg-purple-900/30 px-4 py-2 border-b border-purple-100 dark:border-purple-800">
          <div className="flex items-center text-purple-700 dark:text-purple-300">
            <MousePointer className="h-4 w-4 mr-2" />
            <span className="text-sm font-medium flex-1 mr-2">
              Position Adjustment: Click to select a label, then click again to place it.
            </span>
            <button
              className="px-3 py-1 text-xs font-medium rounded-md bg-purple-200 text-purple-600 dark:bg-purple-800 dark:text-purple-300 hover:bg-purple-300 dark:hover:bg-purple-700"
              onClick={() => togglePositionAdjustmentMode(false)}
            >
              Exit Adjustment Mode
            </button>
          </div>
        </div>
      )}

      {/* Status Message Area */}
      {statusMessage && (
        <div className="px-4 pt-4">{renderStatusMessage()}</div>
      )}


      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Select All Mode Controls */}
        {selectAllMode ? (
          <div className="space-y-4 p-4 border rounded-lg border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
             <div className="flex items-center space-x-2 mb-4">
                <Globe className="h-5 w-5 text-blue-500" />
                <h3 className="text-base font-medium text-blue-700 dark:text-blue-300">Global Label Settings</h3>
             </div>
             {/* Font Size Slider for All Labels */}
             <div className="space-y-2">
                <div className="flex justify-between items-center">
                   <label className="text-sm font-medium flex items-center"><Sliders className="mr-2 h-4 w-4" /> Global Font Size</label>
                   <span className="text-sm font-mono bg-blue-200 dark:bg-blue-800 px-2 py-0.5 rounded">{fontSize}px</span>
                </div>
                <input
                   type="range" min="8" max="24" step="1" value={fontSize}
                   onChange={(e) => updateFontSize(parseInt(e.target.value, 10))}
                   className="w-full h-2 bg-blue-200 dark:bg-blue-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                   Applies to all {allLabelsCount} labels
                </p>
             </div>
             {/* Bold Text and White Background options for All Labels */}
             <div className="mt-4 space-y-3">
                {/* Bold Toggle */}
                <div className="flex items-center justify-between">
                   <label className="text-sm font-medium text-blue-700 dark:text-blue-300 cursor-pointer flex items-center"
                      onClick={() => updateLabelOption('bold', !labelOptions.bold)}>
                      <span className="font-bold mr-1">B</span> Bold Text (All)
                   </label>
                   <button type="button" onClick={() => updateLabelOption('bold', !labelOptions.bold)} className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none ${labelOptions.bold ? 'bg-blue-600 dark:bg-blue-500' : 'bg-blue-200 dark:bg-blue-700'}`}>
                      <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${labelOptions.bold ? 'translate-x-6' : 'translate-x-1'}`} />
                   </button>
                </div>
                {/* Background Toggle */}
                <div className="flex items-center justify-between">
                   <label className="text-sm font-medium text-blue-700 dark:text-blue-300 cursor-pointer"
                      onClick={() => updateLabelOption('whiteBackground', !labelOptions.whiteBackground)}>
                      White Background (All)
                   </label>
                   <button type="button" onClick={() => updateLabelOption('whiteBackground', !labelOptions.whiteBackground)} className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none ${labelOptions.whiteBackground ? 'bg-blue-600 dark:bg-blue-500' : 'bg-blue-200 dark:bg-blue-700'}`}>
                      <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${labelOptions.whiteBackground ? 'translate-x-6' : 'translate-x-1'}`} />
                   </button>
                </div>
                
                {/* Background Opacity Slider - only shown when background is enabled (Select All mode) */}
                {labelOptions.whiteBackground && (
                  <div className="ml-6 mt-2 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm text-blue-700 dark:text-blue-300">Background Opacity (All)</label>
                      <span className="text-xs font-mono bg-blue-200 dark:bg-blue-800 px-1.5 py-0.5 rounded">
                        {Math.round(backgroundOpacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={backgroundOpacity}
                      onChange={(e) => updateGlobalBackgroundOpacity(parseFloat(e.target.value))}
                      className="w-full h-2 bg-blue-200 dark:bg-blue-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      disabled={!labelOptions.whiteBackground}
                    />
                  </div>
                )}
             </div>
             <button onClick={toggleSelectAllMode} className="w-full py-1.5 px-4 mt-4 rounded-md text-sm font-medium bg-white text-blue-600 hover:bg-blue-50 dark:bg-blue-800 dark:text-blue-300 dark:hover:bg-blue-700 border border-blue-300 dark:border-blue-700">
                Exit Select All Mode
             </button>
          </div>
        ) : (
          /* Single Label Editing Controls */
          selectedLabel && selectedLabel.symbol && selectedLabel.attributes ? (
            <div className="space-y-4 p-4 border rounded-lg border-gray-200 dark:border-gray-700">
              {/* Label Text Edit */}
              <div>
                <label className="text-sm font-medium mb-1 block flex items-center">
                  <Type className="mr-2 h-4 w-4 text-gray-500" /> Label Text
                </label>
                {isTextEditing ? (
                  <div className="flex items-center space-x-2">
                    <input
                      ref={textInputRef} type="text" value={labelText} // Base text state
                      onChange={(e) => setLabelText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { updateLabelText(labelText); setIsTextEditing(false); } else if (e.key === "Escape") { setLabelText(selectedLabel.attributes?.originalLabel || selectedLabel.symbol?.text || ""); setIsTextEditing(false); }}}
                      onBlur={() => { updateLabelText(labelText); setIsTextEditing(false); }}
                      className="flex-grow px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
                      placeholder="Enter base label text"
                    />
                    <button onClick={() => { updateLabelText(labelText); setIsTextEditing(false); }} className="p-1.5 rounded-md bg-green-500 text-white hover:bg-green-600" title="Save"><Check className="h-4 w-4" /></button>
                    <button onClick={() => { setLabelText(selectedLabel.attributes?.originalLabel || selectedLabel.symbol?.text || ""); setIsTextEditing(false); }} className="p-1.5 rounded-md bg-gray-500 text-white hover:bg-gray-600" title="Cancel"><XIcon className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 min-h-[38px]">
                    <p className="text-sm truncate flex-1 mr-2" title={selectedLabel.symbol?.text || ""}>
                      {selectedLabel.symbol?.text || "(No text)"} {/* Display potentially formatted text */}
                    </p>
                    <button onClick={() => setIsTextEditing(true)} className="p-1 rounded-full text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/50" title="Edit Text">
                      <Edit className="h-4 w-4" />
                    </button>
                  </div>
                )}
                 {selectedLabel.attributes?.hasCustomFormat && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Editing base text. Variables like ({selectedLabel.attributes?.variableName}) are added automatically.</p>}
              </div>

              {/* Font Size Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium flex items-center"><Sliders className="mr-2 h-4 w-4" /> Font Size</label>
                  <span className="text-sm font-mono bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">{fontSize}px</span>
                </div>
                <input type="range" min="8" max="24" step="1" value={fontSize}
                  onChange={(e) => updateFontSize(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  disabled={isTextEditing || isMultiDragMode} // Disable during text edit or position adjustment
                />
              </div>

              {/* Position Display */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                    <label className="text-sm font-medium flex items-center"><Move className="mr-2 h-4 w-4 text-gray-500" /> Position (Offset)</label>
                    <span className="text-xs font-mono bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">X: {Math.round(position.x)}, Y: {Math.round(position.y)}</span>
                </div>
                {isMultiDragMode ? (
                   <p className="text-xs text-purple-500 dark:text-purple-400">In position adjustment mode - click again to place label</p>
                ) : (
                   <div className="flex space-x-2">
                     <p className="text-xs text-gray-500 dark:text-gray-400">Drag label on the map to adjust position or</p>
                     <button 
                       onClick={() => togglePositionAdjustmentMode(true)}
                       className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                     >
                       enter adjustment mode
                     </button>
                   </div>
                )}
              </div>

              {/* Style Options for Single Label */}
               <div className="mt-4 space-y-3 border-t pt-4 dark:border-gray-600">
                   <h4 className="text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">Style Options</h4>
                   {/* Bold Toggle */}
                   <div className="flex items-center justify-between">
                       <label className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer flex items-center"
                           onClick={() => updateLabelOption('bold', !labelOptions.bold)}>
                           <span className="font-bold mr-1">B</span> Bold Text
                       </label>
                       <button type="button" onClick={() => updateLabelOption('bold', !labelOptions.bold)} className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none ${labelOptions.bold ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`}>
                           <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${labelOptions.bold ? 'translate-x-6' : 'translate-x-1'}`} />
                       </button>
                   </div>
                   {/* Background Toggle */}
                   <div className="flex items-center justify-between">
                       <label className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                           onClick={() => updateLabelOption('whiteBackground', !labelOptions.whiteBackground)}>
                           White Background
                       </label>
                       <button type="button" onClick={() => updateLabelOption('whiteBackground', !labelOptions.whiteBackground)} className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none ${labelOptions.whiteBackground ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`}>
                           <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${labelOptions.whiteBackground ? 'translate-x-6' : 'translate-x-1'}`} />
                       </button>
                   </div>
                   
                   {/* Background Opacity Slider - only shown when background is enabled */}
                   {labelOptions.whiteBackground && (
                     <div className="ml-6 mt-2 space-y-2">
                       <div className="flex justify-between items-center">
                         <label className="text-sm text-gray-600 dark:text-gray-400">Background Opacity</label>
                         <span className="text-xs font-mono bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                           {Math.round(backgroundOpacity * 100)}%
                         </span>
                       </div>
                       <input
                         type="range"
                         min="0"
                         max="1"
                         step="0.05"
                         value={backgroundOpacity}
                         onChange={(e) => updateBackgroundOpacity(parseFloat(e.target.value))}
                         className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                         disabled={isTextEditing || !labelOptions.whiteBackground}
                       />
                     </div>
                   )}
               </div>

              {/* Reset Single Label Button */}
              <button onClick={resetSingleLabel} className="w-full py-1.5 px-4 mt-4 rounded-md text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600"
                disabled={isTextEditing || isMultiDragMode}>
                Reset This Label
              </button>
            </div>
          ) : (
            // Placeholder when no label is selected
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
              <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                <Type className="h-10 w-10 text-gray-400 dark:text-gray-500" />
              </div>
              <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300">No Label Selected</h4>
              <p className="mt-2 text-sm">Click a label on the map to edit its properties.</p>
              <div className="mt-4 flex flex-col sm:flex-row gap-2 items-center">
                  <button onClick={toggleSelectAllMode}
                     className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline flex items-center px-3 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/50"
                     disabled={isMultiDragMode} // Disable if other modes active
                  >
                     <Layers className="mr-1 h-4 w-4" /> Use Select All Mode
                  </button>
                  <span className="text-xs hidden sm:inline">OR</span>
                   <button onClick={() => togglePositionAdjustmentMode(true)}
                     className="text-purple-600 dark:text-purple-400 text-sm font-medium hover:underline flex items-center px-3 py-1 rounded hover:bg-purple-50 dark:hover:bg-purple-900/50"
                     disabled={selectAllMode} // Disable if other modes active
                   >
                      <MousePointer className="mr-1 h-4 w-4" /> Adjust Label Positions
                  </button>
              </div>

              {selectedLabel && (!selectedLabel.symbol || !selectedLabel.attributes) && (
                <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">(Selected graphic missing symbol/attributes)</p>
              )}
            </div>
          )
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex-none p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {(labelManager && labelManager.editedLabels?.size !== undefined) ? `${labelManager.editedLabels.size} modification(s) pending` : '0 modifications pending'}
          </span>
        </div>
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
          <button
            onClick={resetChanges}
            disabled={!labelManager || !labelManager.editedLabels || labelManager.editedLabels.size === 0 || isSaving || isMultiDragMode}
            className="flex-1 py-2 px-4 rounded-md text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 dark:disabled:bg-gray-700/50 dark:disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            Revert Pending
          </button>
          <button
            onClick={() => finalizeLabels()}
             disabled={!labelManager || !labelManager.editedLabels || labelManager.editedLabels.size === 0 || isSaving || isMultiDragMode}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium flex items-center justify-center transition-colors ${(!labelManager || !labelManager.editedLabels || labelManager.editedLabels.size === 0 || isMultiDragMode) ? 'bg-blue-300 dark:bg-blue-800 text-white dark:text-gray-400 cursor-not-allowed' : isSaving ? 'bg-blue-500 text-white cursor-wait' : 'bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500'}`}
          >
            <Save className={`mr-2 h-4 w-4 ${isSaving ? 'animate-spin' : ''}`} /> {isSaving ? 'Applying...' : 'Apply Changes'}
          </button>
        </div>
        <button onClick={handleClose} className="w-full mt-2 py-2 px-4 rounded-md text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
           disabled={isSaving}>
          Close Editor
        </button>
      </div>
    </div>
  );
};

export default LabelEditor;