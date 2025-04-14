// src/components/map/LabelEditor.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Sliders, Move, Type, Lock, Save, Edit, Check, X as XIcon } from 'lucide-react';

const LabelEditor = ({ 
  isOpen, 
  onClose, 
  mapView, 
  labelManager, 
  activeLayer 
}) => {
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [fontSize, setFontSize] = useState(10);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [labelText, setLabelText] = useState('');
  const [isMoving, setIsMoving] = useState(false);
  const [editedLabels, setEditedLabels] = useState({});
  const [allLabels, setAllLabels] = useState([]);
  const [selectAllMode, setSelectAllMode] = useState(false);
  const [isTextEditing, setIsTextEditing] = useState(false);
  const clickHandlerRef = useRef(null);
  const moveHandlerRef = useRef(null);
  const dragStartRef = useRef(null);
  const lastDragPosRef = useRef(null);
  const textInputRef = useRef(null);
  
  // Initialize label selection mode and gather all labels when component mounts
  useEffect(() => {
    if (!isOpen || !mapView || !mapView.ready) return;
    
    // Collect all labels from the map
    const collectAllLabels = () => {
      const labels = [];
      
      // Function to collect labels from a layer
      const collectFromLayer = (layer) => {
        if (!layer || !layer.graphics) return;
        
        layer.graphics.forEach(graphic => {
          if (graphic.attributes?.isLabel === true || 
              (graphic.symbol && graphic.symbol.type === "text")) {
            labels.push(graphic);
          }
        });
      };
      
      // If we have a specific active layer, use that
      if (activeLayer) {
        collectFromLayer(activeLayer);
      } else {
        // Otherwise collect from all layers in the map
        mapView.map.layers.forEach(layer => {
          collectFromLayer(layer);
        });
      }
      
      console.log(`[LabelEditor] Collected ${labels.length} labels for editing`);
      setAllLabels(labels);
      return labels;
    };
    
    // Enable label selection mode in the map
    const enableLabelSelection = () => {
      console.log('[LabelEditor] Enabling label selection mode');
      
      // Set the cursor to indicate selection mode
      mapView.container.style.cursor = 'pointer';
      
      // Create the click handler for selecting labels
      const clickHandler = mapView.on('click', (event) => {
        // Prevent the default map click behavior
        event.stopPropagation();
        
        // If we're currently text editing, don't select a new label
        if (isTextEditing) return;
        
        // Get the screen point where the user clicked
        const screenPoint = {
          x: event.x,
          y: event.y
        };
        
        // Use hit test to find graphics at the clicked location
        mapView.hitTest(screenPoint).then(response => {
          // Filter results to find label graphics
          const labelHits = response.results?.filter(result => 
            result.graphic?.attributes?.isLabel === true || 
            (result.graphic?.symbol && result.graphic?.symbol.type === "text")
          );
          
          if (labelHits && labelHits.length > 0) {
            const hitLabel = labelHits[0].graphic;
            console.log('[LabelEditor] Selected label:', hitLabel);
            
            // Set the selected label
            setSelectedLabel(hitLabel);
            
            // Get current font size from the label's symbol
            if (hitLabel.symbol && hitLabel.symbol.font) {
              setFontSize(hitLabel.symbol.font.size || 10);
            }
            
            // Get current text content
            if (hitLabel.symbol && hitLabel.symbol.text) {
              setLabelText(hitLabel.symbol.text);
            }
            
            // Get current offsets
            if (hitLabel.symbol) {
              setPosition({
                x: hitLabel.symbol.xoffset || 0,
                y: hitLabel.symbol.yoffset || 0
              });
            }
            
            // Exit select all mode when selecting an individual label
            setSelectAllMode(false);
          } else {
            // If no label was clicked, deselect current label
            setSelectedLabel(null);
            setLabelText('');
          }
        }).catch(err => {
          console.error('[LabelEditor] Error during hit test:', err);
        });
      });
      
      // Store the handler reference for cleanup
      clickHandlerRef.current = clickHandler;
    };
    
    // Collect labels and enable selection
    collectAllLabels();
    enableLabelSelection();
    
    // Cleanup function
    return () => {
      if (clickHandlerRef.current) {
        clickHandlerRef.current.remove();
        clickHandlerRef.current = null;
      }
      
      if (moveHandlerRef.current) {
        moveHandlerRef.current.remove();
        moveHandlerRef.current = null;
      }
      
      // Reset cursor
      if (mapView.container) {
        mapView.container.style.cursor = 'default';
      }
      
      // Deselect any selected label
      setSelectedLabel(null);
      setLabelText('');
      setSelectAllMode(false);
    };
  }, [isOpen, mapView, activeLayer, isTextEditing]);

  // Auto-focus text input when entering text editing mode
  useEffect(() => {
    if (isTextEditing && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [isTextEditing]);
  
  // Update the label's font size
  const updateFontSize = (newSize, targetLabel = null) => {
    const labelsToUpdate = [];
    
    // Determine which labels to update
    if (selectAllMode) {
      // Update all labels if in select all mode
      labelsToUpdate.push(...allLabels);
    } else if (targetLabel) {
      // Update a specific label if provided
      labelsToUpdate.push(targetLabel);
    } else if (selectedLabel) {
      // Update the currently selected label
      labelsToUpdate.push(selectedLabel);
    }
    
    if (labelsToUpdate.length === 0) return;
    
    try {
      // Update each label in the collection
      labelsToUpdate.forEach(label => {
        if (!label || !label.symbol) return;
        
        // Create a clone of the current symbol to avoid reference issues
        const newSymbol = label.symbol.clone();
        
        // Update the font size
        newSymbol.font = {
          ...newSymbol.font,
          size: newSize
        };
        
        // Apply the updated symbol
        label.symbol = newSymbol;
        
        // Store the edited label in our tracking map
        const labelId = getLabelId(label);
        if (labelId) {
          setEditedLabels(prev => ({
            ...prev,
            [labelId]: {
              graphic: label,
              fontSize: newSize,
              position: {
                x: newSymbol.xoffset || 0,
                y: newSymbol.yoffset || 0
              },
              text: newSymbol.text
            }
          }));
        }
      });
      
      console.log(`[LabelEditor] Updated font size to ${newSize} for ${labelsToUpdate.length} labels`);
    } catch (error) {
      console.error('[LabelEditor] Error updating font size:', error);
    }
  };
  
  // Update the label's text content
  const updateLabelText = (newText, targetLabel = null) => {
    const label = targetLabel || selectedLabel;
    if (!label || !label.symbol) return;
    
    try {
      // Create a clone of the current symbol
      const newSymbol = label.symbol.clone();
      
      // Update the text content
      newSymbol.text = newText;
      
      // Apply the updated symbol
      label.symbol = newSymbol;
      
      // Store the edited label
      const labelId = getLabelId(label);
      if (labelId) {
        setEditedLabels(prev => ({
          ...prev,
          [labelId]: {
            graphic: label,
            fontSize: newSymbol.font?.size || fontSize,
            position: {
              x: newSymbol.xoffset || 0,
              y: newSymbol.yoffset || 0
            },
            text: newText
          }
        }));
      }
      
      console.log(`[LabelEditor] Updated label text to "${newText.substring(0, 20)}${newText.length > 20 ? '...' : ''}"`);
    } catch (error) {
      console.error('[LabelEditor] Error updating label text:', error);
    }
  };
  
  // Enable label moving mode with proper drag functionality
  const enableMovingMode = () => {
    if (!selectedLabel || !mapView) return;
    
    setIsMoving(true);
    mapView.container.style.cursor = 'move';
    
    // Reset drag state
    dragStartRef.current = null;
    lastDragPosRef.current = null;
    
    // Set up mouse down handler
    const downHandler = mapView.on('pointer-down', (event) => {
      // Store the starting position
      dragStartRef.current = {
        x: event.x,
        y: event.y
      };
      
      // Get current label position for reference
      lastDragPosRef.current = {
        x: selectedLabel.symbol.xoffset || 0,
        y: selectedLabel.symbol.yoffset || 0
      };
      
      console.log('[LabelEditor] Started dragging label from position:', lastDragPosRef.current);
    });
    
    // Set up mouse move handler
    const moveHandler = mapView.on('pointer-move', (event) => {
      if (!isMoving || !dragStartRef.current || !lastDragPosRef.current) return;
      
      // Calculate the difference from the start position
      const dx = event.x - dragStartRef.current.x;
      const dy = event.y - dragStartRef.current.y;
      
      // Calculate new offset based on the original position plus the movement
      const newOffset = {
        x: lastDragPosRef.current.x + dx,
        y: lastDragPosRef.current.y + dy
      };
      
      // Update the UI state
      setPosition(newOffset);
      
      // Update the label's position
      try {
        const newSymbol = selectedLabel.symbol.clone();
        newSymbol.xoffset = newOffset.x;
        newSymbol.yoffset = newOffset.y;
        selectedLabel.symbol = newSymbol;
        
        // Store the edited label
        const labelId = getLabelId(selectedLabel);
        if (labelId) {
          setEditedLabels(prev => ({
            ...prev,
            [labelId]: {
              graphic: selectedLabel,
              fontSize: fontSize,
              position: newOffset,
              text: newSymbol.text
            }
          }));
        }
        
        // Log position changes for debugging
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          console.log('[LabelEditor] Moving label to position:', newOffset);
        }
      } catch (error) {
        console.error('[LabelEditor] Error updating label position:', error);
      }
    });
    
    // Set up mouse up handler to end moving
    const upHandler = mapView.on('pointer-up', () => {
      setIsMoving(false);
      mapView.container.style.cursor = 'pointer';
      
      // Reset drag state
      dragStartRef.current = null;
      
      // Clean up handlers for proper memory management
      downHandler.remove();
      moveHandler.remove();
      upHandler.remove();
      
      console.log('[LabelEditor] Finished moving label. New position:', position);
    });
    
    // Store handlers for cleanup
    moveHandlerRef.current = {
      remove: () => {
        if (downHandler) downHandler.remove();
        if (moveHandler) moveHandler.remove();
        if (upHandler) upHandler.remove();
      }
    };
  };
  
  // Get a unique ID for a label
  const getLabelId = (label) => {
    if (!label) return null;
    
    // Try to use various potential ID attributes
    if (label.attributes?.OBJECTID) return `label-${label.attributes.OBJECTID}`;
    if (label.attributes?.parentID) return `label-parent-${label.attributes.parentID}`;
    if (label.attributes?.uid) return `label-uid-${label.attributes.uid}`;
    if (label.uid) return `label-uid-${label.uid}`;
    
    // Fallback to using the geometry as part of the ID
    if (label.geometry) {
      return `label-${label.geometry.x}-${label.geometry.y}`;
    }
    
    return `label-unknown-${Math.random().toString(36).substring(2, 11)}`;
  };
  
  // Toggle "Select All" mode
  const toggleSelectAllMode = () => {
    // If entering select all mode, deselect individual label
    if (!selectAllMode) {
      setSelectedLabel(null);
      setLabelText('');
    }
    
    setSelectAllMode(!selectAllMode);
    console.log(`[LabelEditor] ${!selectAllMode ? 'Enabled' : 'Disabled'} select all mode`);
  };
  
  // Finalize all edited labels
  const finalizeLabels = () => {
    if (!labelManager || (Object.keys(editedLabels).length === 0 && !selectAllMode)) {
      console.log('[LabelEditor] No label changes to finalize');
      return;
    }
    
    console.log('[LabelEditor] Finalizing label edits for', Object.keys(editedLabels).length, 'labels');
    
    try {
      // Ensure all pending edits are applied first
      if (isTextEditing) {
        updateLabelText(labelText);
        setIsTextEditing(false);
      }
      
      // Try to save positions using the label manager first
      let saveSuccessful = false;
      
      if (typeof labelManager.savePositions === 'function') {
        try {
          const result = labelManager.savePositions(true); // Use localStorage for persistence
          saveSuccessful = result && result.success;
          console.log('[LabelEditor] Saved label positions via label manager:', result);
        } catch (err) {
          console.error('[LabelEditor] Error saving via label manager:', err);
        }
      }
      
      // Apply permanent changes to ensure persistence
      if (typeof labelManager.applyPermanentLabelChanges === 'function') {
        labelManager.applyPermanentLabelChanges(editedLabels);
        console.log('[LabelEditor] Applied permanent label changes to label manager');
      }
      // Fallback - store positions in local storage directly if the manager method failed
      else if (!saveSuccessful) {
        const positions = {};
        
        Object.entries(editedLabels).forEach(([id, data]) => {
          positions[id] = {
            fontSize: data.fontSize,
            xoffset: data.position.x,
            yoffset: data.position.y,
            text: data.text,
            visible: true
          };
        });
        
        localStorage.setItem('customLabelPositions', JSON.stringify(positions));
        console.log('[LabelEditor] Saved label positions to localStorage');
      }
      
      // Clear edited labels after saving
      setEditedLabels({});
      
      // Reset selection
      setSelectedLabel(null);
      setLabelText('');
      setSelectAllMode(false);
      
      // Show success message
      alert('Label changes saved successfully');
    } catch (error) {
      console.error('[LabelEditor] Error finalizing labels:', error);
      alert('Failed to save label positions');
    }
  };
  
  // Reset all changes
  const resetChanges = () => {
    if (!labelManager) return;
    
    try {
      // Reload original positions if possible
      if (typeof labelManager.loadPositions === 'function') {
        labelManager.loadPositions(false); // Use sessionStorage for temporary positions
      }
      
      // Clear edited labels
      setEditedLabels({});
      
      // Deselect current label
      setSelectedLabel(null);
      setLabelText('');
      setIsTextEditing(false);
      setSelectAllMode(false);
      
      console.log('[LabelEditor] Reset all label changes');
    } catch (error) {
      console.error('[LabelEditor] Error resetting labels:', error);
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-none p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Label Editor
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Click on a label to select and edit it, or use "Select All" to modify multiple labels.
        </p>
      </div>
      
      {/* Selected Label Info */}
      <div className="flex-1 p-4 overflow-y-auto">
        {/* Select All Toggle */}
        <div className="mb-4">
          <button
            onClick={toggleSelectAllMode}
            className={`w-full py-2 px-4 rounded-md text-sm font-medium flex items-center justify-center
              ${selectAllMode
                ? 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
          >
            <Sliders className="mr-2 h-4 w-4" />
            {selectAllMode ? 'Edit All Labels' : 'Select All Labels'}
            <span className="ml-1 text-xs">({allLabels.length})</span>
          </button>
        </div>
        
        {selectAllMode ? (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <h4 className="font-medium text-blue-700 dark:text-blue-300 flex items-center">
                <Type className="mr-2 h-4 w-4" />
                Editing All Labels
              </h4>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                Changes will apply to all {allLabels.length} labels
              </p>
            </div>
            
            {/* Font Size Control for All Labels */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                  <Sliders className="mr-2 h-4 w-4" />
                  Font Size (All Labels)
                </label>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {fontSize}px
                </span>
              </div>
              <input
                type="range"
                min="8"
                max="24"
                step="1"
                value={fontSize}
                onChange={(e) => {
                  const newSize = parseInt(e.target.value, 10);
                  setFontSize(newSize);
                  // Update all labels with the new font size
                  updateFontSize(newSize);
                }}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        ) : selectedLabel ? (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <h4 className="font-medium text-blue-700 dark:text-blue-300 flex items-center">
                <Type className="mr-2 h-4 w-4" />
                Selected Label
              </h4>
              {isTextEditing ? (
                <div className="mt-2 flex items-center">
                  <input
                    ref={textInputRef}
                    type="text"
                    value={labelText}
                    onChange={(e) => setLabelText(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    placeholder="Enter label text"
                  />
                  <button
                    onClick={() => {
                      updateLabelText(labelText);
                      setIsTextEditing(false);
                    }}
                    className="ml-2 p-1 rounded-full bg-green-500 text-white hover:bg-green-600"
                    title="Save text changes"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setLabelText(selectedLabel.symbol?.text || '');
                      setIsTextEditing(false);
                    }}
                    className="ml-1 p-1 rounded-full bg-gray-500 text-white hover:bg-gray-600"
                    title="Cancel text editing"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="mt-1 flex justify-between items-center">
                  <p className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1">
                    {labelText || selectedLabel.symbol?.text || 'No text content'}
                  </p>
                  <button
                    onClick={() => setIsTextEditing(true)}
                    className="ml-2 p-1 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
                    title="Edit label text"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            
            {/* Font Size Control */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                  <Sliders className="mr-2 h-4 w-4" />
                  Font Size
                </label>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {fontSize}px
                </span>
              </div>
              <input
                type="range"
                min="8"
                max="24"
                step="1"
                value={fontSize}
                onChange={(e) => {
                  const newSize = parseInt(e.target.value, 10);
                  setFontSize(newSize);
                  updateFontSize(newSize);
                }}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            
            {/* Position Control */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                  <Move className="mr-2 h-4 w-4" />
                  Position
                </label>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  X: {Math.round(position.x)}, Y: {Math.round(position.y)}
                </span>
              </div>
              <button
                onClick={enableMovingMode}
                disabled={isMoving}
                className={`w-full py-2 px-4 rounded-md text-sm font-medium 
                  ${isMoving 
                    ? 'bg-blue-100 text-blue-400 dark:bg-blue-900/30 dark:text-blue-300 cursor-not-allowed' 
                    : 'bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30'
                  }`}
              >
                {isMoving ? 'Moving... (click and drag to reposition)' : 'Click to reposition label'}
              </button>
              
              {isMoving && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Click and drag on the map to move the label. Click again to finish.
                </p>
              )}
            </div>
            
            {/* Reset button for this label */}
            <button
              onClick={() => {
                // Remove from edited labels
                const labelId = getLabelId(selectedLabel);
                if (labelId) {
                  setEditedLabels(prev => {
                    const newEditedLabels = { ...prev };
                    delete newEditedLabels[labelId];
                    return newEditedLabels;
                  });
                }
                
                // Reset label to original position if possible
                if (labelManager && typeof labelManager.resetLabelPosition === 'function') {
                  labelManager.resetLabelPosition(selectedLabel);
                }
                
                // Deselect the label
                setSelectedLabel(null);
                setLabelText('');
                setIsTextEditing(false);
              }}
              className="w-full py-2 px-4 mt-2 rounded-md text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Reset This Label
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <div className="p-4 rounded-full bg-blue-50 dark:bg-blue-900/20 mb-4">
              <Type className="h-8 w-8 text-blue-500 dark:text-blue-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              No Label Selected
            </h4>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Click on a label in the map to select and edit it, or use "Select All" to edit all labels at once.
            </p>
          </div>
        )}
      </div>
      
      {/* Footer with actions */}
      <div className="flex-none p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {Object.keys(editedLabels).length} labels edited
            </span>
          </div>
          
          <div className="flex justify-between space-x-2">
            <button
              onClick={resetChanges}
              className="flex-1 py-2 px-4 rounded-md text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
            >
              Reset All
            </button>
            
            <button
              onClick={finalizeLabels}
              disabled={Object.keys(editedLabels).length === 0 && !selectAllMode}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium flex items-center justify-center
                ${Object.keys(editedLabels).length === 0 && !selectAllMode
                  ? 'bg-blue-300 text-white cursor-not-allowed dark:bg-blue-800 dark:text-blue-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600'
                }`}
            >
              <Lock className="mr-2 h-4 w-4" />
              Finalize Changes
            </button>
          </div>
          
          <button
            onClick={onClose}
            className="w-full py-2 px-4 rounded-md text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Exit Label Editor
          </button>
        </div>
      </div>
    </div>
  );
};

export default LabelEditor;