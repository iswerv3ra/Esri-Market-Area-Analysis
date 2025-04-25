// src/components/map/LabelEditor.jsx

import React, { useState, useEffect, useRef } from "react";
import {
  Sliders, Move, Type, Lock, Save, Edit, Check, X as XIcon,
  RefreshCw, AlertTriangle,
} from "lucide-react";

const LabelEditor = ({
  isOpen,
  onClose,
  mapView,
  labelManager, // Expecting an instance of SimplifiedLabelManager
  activeLayer, // Optional: Layer context
}) => {
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [fontSize, setFontSize] = useState(10);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [labelText, setLabelText] = useState("");
  const [isMoving, setIsMoving] = useState(false);
  const [selectAllMode, setSelectAllMode] = useState(false);
  const [isTextEditing, setIsTextEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [apiAvailable, setApiAvailable] = useState(true); // Always true for localStorage

  const textInputRef = useRef(null);

  useEffect(() => {
    // Exit early if not open or prerequisites missing
    if (!isOpen || !mapView || !labelManager) {
       if (!isOpen && labelManager && typeof labelManager.toggleEditingMode === 'function') {
           try { labelManager.toggleEditingMode(false); } catch(e){/* ignore */}
       }
       return;
    }

    setApiAvailable(true); // localStorage is always available

    // Enable editing mode in the manager, check for method existence
    if (typeof labelManager.toggleEditingMode === 'function') {
        try {
            labelManager.toggleEditingMode(true);
            console.log("[LabelEditor] Enabled editing mode in manager.");
        } catch (error) {
            console.error("[LabelEditor] Error enabling edit mode:", error);
        }
    } else {
        console.warn("[LabelEditor] LabelManager missing toggleEditingMode method");
    }

    // Watch for changes in the manager's selectedLabel property
    const watchSelection = () => {
      // Ensure labelManager exists and has the getLabelId method
      if (!labelManager || typeof labelManager.getLabelId !== 'function') return;

      const managerSelection = labelManager.selectedLabel;
      // Get the ID from the manager's current selection (if any)
      const managerId = managerSelection ? labelManager.getLabelId(managerSelection) : null;
      // Get the ID from the component's current state selection (if any)
      const componentId = selectedLabel ? labelManager.getLabelId(selectedLabel) : null;

      // --- COMPARE IDs FIRST ---
      // Only proceed if the *conceptual* label (identified by ID) has changed.
      if (managerId !== componentId) {
          // Log only when the actual ID changes
          console.log(`[LabelEditor Watch] Detected ID change. New ID: ${managerId}, Old ID: ${componentId}. Updating state.`);

          // Update the component's state with the new selection object from the manager
          setSelectedLabel(managerSelection); // Still store the object

          // --- Update UI based on the new selection ---
          if (managerSelection && managerSelection.symbol && managerSelection.attributes) {
              const symbol = managerSelection.symbol;
              const attributes = managerSelection.attributes;
              const font = symbol.font;

              console.log("[LabelEditor Watch] Valid label structure found. Updating UI with:", {
                  fontSize: font?.size,
                  text: symbol.text,
                  xoffset: symbol.xoffset,
                  yoffset: symbol.yoffset,
                  attributes: attributes
              });

              setFontSize(font?.size || 10);
              setLabelText(symbol.text || "");
              setPosition({ x: symbol.xoffset || 0, y: symbol.yoffset || 0 });
              setIsTextEditing(false);

              console.log(`[LabelEditor Watch] Successfully updated UI for selected label (ID: ${managerId})`);

          } else {
               // Reset UI state if the new selection is null or invalid
              setFontSize(10);
              setLabelText("");
              setPosition({ x: 0, y: 0 });
              setIsTextEditing(false);

              console.log("[LabelEditor Watch] Resetting UI state because selected label is null or invalid.");
          }
          // --- End UI Update ---
      }
      // If IDs are the same, do nothing - prevents the loop!
  };

  // Keep the interval logic the same
  const intervalId = setInterval(watchSelection, 200); // Or maybe increase interval slightly? 200ms?

    // --- Cleanup function ---
    return () => {
        clearInterval(intervalId); // Stop watching
        if (labelManager && typeof labelManager.toggleEditingMode === 'function') {
            try {
                 labelManager.toggleEditingMode(false); // <--- THIS IS CALLED
                 console.log("[LabelEditor Cleanup] Disabled editing mode in manager.");
            } catch (error) {
                 console.error("[LabelEditor Cleanup] Error disabling edit mode:", error);
            }
        } // ...
    };
    // --- End Cleanup function ---

  }, [isOpen, mapView, labelManager]); // Remove selectedLabel

  // --- Auto-focus text input when editing ---
  useEffect(() => {
    if (isTextEditing && textInputRef.current) {
      textInputRef.current.focus();
      textInputRef.current.select(); // Select text for easy replacement
    }
  }, [isTextEditing]); // Dependency: isTextEditing

  // --- Handle status message timeouts ---
  useEffect(() => {
    let timer; // Declare timer variable
    if (statusMessage && statusMessage.timeout) {
      // Set timeout to clear the message
      timer = setTimeout(() => {
        setStatusMessage(null); // Clear message after timeout
      }, statusMessage.timeout);
    }
    // Cleanup: Clear the timeout if the component unmounts or statusMessage changes
    return () => clearTimeout(timer);
  }, [statusMessage]); // Dependency: statusMessage

  // --- Update Font Size ---
  const updateFontSize = (newSize) => {
    setFontSize(newSize); // Update local state immediately for responsiveness

    // Check if labelManager and the method exist
    if (!labelManager || typeof labelManager.updateLabelFontSize !== 'function') {
        console.warn("Cannot update font size: Manager or method missing.");
        return;
    }

    try {
        // Apply to the currently selected label
        if (selectedLabel) {
            labelManager.updateLabelFontSize(selectedLabel, newSize);
            console.log(`[LabelEditor] Updated font size to ${newSize} for selected label`);
        }
        // Note: 'Select All' font update needs explicit implementation if required,
        // as SimplifiedLabelManager doesn't have a built-in 'update all' method.
        // You would need to get all labels and loop through them.
        else if (selectAllMode) {
             console.warn("Select All mode font size update requires iterating all labels.");
             // Example (if needed):
             // const allLabels = labelManager.getAllLabelGraphics ? labelManager.getAllLabelGraphics() : [];
             // allLabels.forEach(label => labelManager.updateLabelFontSize(label, newSize));
        }
    } catch (error) {
        console.error('[LabelEditor] Error updating font size:', error);
        setStatusMessage({ type: 'error', text: `Font size update error: ${error.message}`, timeout: 5000 });
    }
};


  // --- Update Label Text ---
  const updateLabelText = (newText) => {
    setLabelText(newText); // Update local state

    // Check prerequisites
    if (!labelManager || typeof labelManager.updateLabelText !== 'function' || !selectedLabel) {
        console.warn("Cannot update label text: Manager, method, or selected label missing.");
        return;
    }

    try {
        // Call the manager method
        labelManager.updateLabelText(selectedLabel, newText);
        console.log(`[LabelEditor] Updated text for selected label to: "${newText}"`);
    } catch (error) {
        console.error('[LabelEditor] Error updating label text:', error);
        setStatusMessage({ type: 'error', text: `Text update error: ${error.message}`, timeout: 5000 });
    }
};

 // --- Enable Label Moving Mode ---
 const enableMovingMode = () => {
    // Check prerequisites and current state
    if (!selectedLabel || !labelManager || typeof labelManager.startMovingLabel !== 'function' || isMoving) {
        console.warn("Cannot start moving: Prerequisites missing or already moving.");
        return;
    }

    setIsMoving(true); // Set UI state

    try {
        // Call the manager method (should automatically use its internal selectedLabel)
        const success = labelManager.startMovingLabel();
        if (!success) {
            // Handle failure from the manager
            setIsMoving(false);
            setStatusMessage({ type: 'error', text: 'Could not start moving label. Select a label.', timeout: 5000 });
        } else {
            console.log("[LabelEditor] Label moving mode enabled.");
        }
    } catch (error) {
        // Handle errors during the call
        console.error('[LabelEditor] Error starting label move:', error);
        setIsMoving(false);
        setStatusMessage({ type: 'error', text: `Move start error: ${error.message}`, timeout: 5000 });
    }
};


  // --- Stop Label Moving Mode ---
  const stopMovingMode = () => {
    // Check if actually moving and if manager/method exist
    if (!isMoving || !labelManager || typeof labelManager.stopMovingLabel !== 'function') {
        return; // Exit if not moving or prerequisites missing
    }

    try {
        // Call the manager method to stop the move operation
        labelManager.stopMovingLabel();
        console.log("[LabelEditor] Label moving mode stopped.");
    } catch (error) {
        // Log any errors during stopping
        console.error('[LabelEditor] Error stopping label move:', error);
        // Still set isMoving to false in finally block
    } finally {
        // Always update the UI state, regardless of success/error
        setIsMoving(false);
    }
};


  // --- Toggle Select All Mode (UI Only for Simplified Manager) ---
  const toggleSelectAllMode = () => {
    const nextMode = !selectAllMode;
    setSelectAllMode(nextMode);
    // Deselect any single label when toggling this mode
    if (nextMode && selectedLabel) {
        // --- CORRECTED LOGIC ---
        // Manager doesn't have explicit deselect. Clear local state.
        // Manager's internal selectedLabel will likely be nulled on next click outside.
        setSelectedLabel(null);
        if (labelManager && typeof labelManager.stopMovingLabel === 'function' && isMoving){
            // Ensure moving is stopped if active
            labelManager.stopMovingLabel();
        }
        setIsMoving(false);
        setIsTextEditing(false);
        setLabelText("");
        setFontSize(10);
        setPosition({ x: 0, y: 0 });
        console.log("[LabelEditor] Cleared local selection for 'Select All' mode.");
        // --- END CORRECTION ---
    }
    console.log(`[LabelEditor] Toggled 'Select All' UI mode to: ${nextMode}`);
  };


 // --- Save All Label Positions ---
 const finalizeLabels = async (silent = false) => {
    // Prevent concurrent saves and check prerequisites
    if (isSaving || !labelManager || typeof labelManager.savePositions !== 'function') {
        console.log(`[LabelEditor] Save skipped: ${isSaving ? 'Already saving' : 'Manager/method missing'}`);
        return false; // Indicate save did not happen
    }

    setIsSaving(true); // Set saving state

    try {
        // Commit any pending UI changes before saving
        if (isTextEditing && selectedLabel) {
            updateLabelText(labelText); // Save text input value
            setIsTextEditing(false);    // Exit text edit UI
        }
        if (isMoving) {
            stopMovingMode(); // Finalize any active move operation
        }

        // Call the manager's save method (use await if it's async)
        const result = await labelManager.savePositions(true); // Force save all edits
        console.log('[LabelEditor] Save result:', result);

        // Provide user feedback unless silent
        if (!silent) {
            setStatusMessage({
                type: 'success',
                text: `Saved ${result?.count || 0} label positions`,
                timeout: 3000
            });
        }
        return true; // Indicate success
    } catch (error) {
        // Handle errors during saving
        console.error('[LabelEditor] Error saving labels:', error);
        if (!silent) {
            setStatusMessage({ type: 'error', text: `Save error: ${error.message}`, timeout: 5000 });
        }
        return false; // Indicate failure
    } finally {
        setIsSaving(false); // Always reset saving state
    }
};


  // --- Refresh Labels ---
  const refreshLabels = () => {
    // Check prerequisites
    if (!labelManager || typeof labelManager.refreshLabels !== 'function') {
        console.warn("Cannot refresh labels: Manager or method missing.");
        return;
    }

    try {
        // Call the manager method
        const result = labelManager.refreshLabels();
        console.log('[LabelEditor] Refresh result:', result);
        // Provide feedback
        setStatusMessage({ type: 'success', text: `Refreshed ${result?.count || 0} labels`, timeout: 3000 });
    } catch (error) {
        // Handle errors
        console.error('[LabelEditor] Error refreshing labels:', error);
        setStatusMessage({ type: 'error', text: `Refresh error: ${error.message}`, timeout: 5000 });
    }
};


  // --- Reset All Label Changes ---
  const resetChanges = () => {
    // Check prerequisites
    if (!labelManager || typeof labelManager.resetAllLabels !== 'function') {
        console.warn("Cannot reset labels: Manager or method missing.");
        return;
    }

    try {
        // Call the manager method
        const result = labelManager.resetAllLabels();
        console.log('[LabelEditor] Reset result:', result);

        // Reset local UI state completely
        setSelectedLabel(null);
        setLabelText("");
        setFontSize(10);
        setPosition({ x: 0, y: 0 });
        setIsTextEditing(false);
        setSelectAllMode(false); // Turn off select all mode if active
        setIsMoving(false);     // Ensure moving mode is off

        // Provide feedback
        setStatusMessage({ type: 'success', text: `Reset ${result?.count || 0} labels to default`, timeout: 3000 });
    } catch (error) {
        // Handle errors
        console.error('[LabelEditor] Error resetting labels:', error);
        setStatusMessage({ type: 'error', text: `Reset error: ${error.message}`, timeout: 5000 });
    }
};


  // --- Reset Single Label Position ---
  const resetSingleLabel = () => {
    // Check prerequisites
    if (!selectedLabel || !labelManager || typeof labelManager.resetLabelPosition !== 'function') {
        console.warn("Cannot reset single label: No label selected or manager/method missing.");
        return;
    }

    try {
        // Call the manager method with the currently selected label graphic
        const result = labelManager.resetLabelPosition(selectedLabel);
        console.log('[LabelEditor] Reset single label result:', result);

        if (result.success) {
            // Successfully reset in the manager. Now update the UI to reflect the reset state.
            // Re-fetch the potentially updated label data from the manager IF it's still selected.
            const currentSelected = labelManager.selectedLabel; // Check if it's still the same selected label

            if (currentSelected && currentSelected === selectedLabel && currentSelected.symbol) {
                 // If the same label is still selected, update UI from its current state
                setPosition({ x: currentSelected.symbol.xoffset || 0, y: currentSelected.symbol.yoffset || 0 });
                setFontSize(currentSelected.symbol.font?.size || 10);
                 // Text shouldn't change on position reset, but sync just in case
                 setLabelText(currentSelected.symbol.text || "");
            } else {
                // If the label was deselected or became invalid after reset, reset UI fully
                setSelectedLabel(null); // Deselect in UI
                setPosition({ x: 0, y: 0 });
                setFontSize(10);
                setLabelText("");
                setIsTextEditing(false);
            }
            // Provide success feedback
            setStatusMessage({ type: 'success', text: 'Label position reset', timeout: 3000 });
        } else {
            // Handle failure from the manager
            setStatusMessage({ type: 'error', text: result.message || 'Could not reset label position', timeout: 5000 });
        }
    } catch (error) {
        // Handle unexpected errors
        console.error('[LabelEditor] Error resetting single label:', error);
        setStatusMessage({ type: 'error', text: `Reset error: ${error.message}`, timeout: 5000 });
    }
};


  // --- Handle Editor Close ---
  const handleClose = async () => {
    // Ensure changes are saved silently before closing
    await finalizeLabels(true);
    // Call the provided onClose callback (passed from parent)
    if (onClose) {
      onClose();
    }
  };

  // --- Render Status Message ---
  const renderStatusMessage = () => {
    if (!statusMessage) return null;

    // Determine styles based on message type
    const bgColor =
      statusMessage.type === 'error' ? 'bg-red-100 dark:bg-red-900/40' :
      statusMessage.type === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/40' :
      'bg-green-100 dark:bg-green-900/40';

    const textColor =
      statusMessage.type === 'error' ? 'text-red-700 dark:text-red-300' :
      statusMessage.type === 'warning' ? 'text-yellow-700 dark:text-yellow-300' :
      'text-green-700 dark:text-green-300';

    // Choose icon based on type
    const iconComponent =
      statusMessage.type === 'error' ? <AlertTriangle className="h-4 w-4 flex-shrink-0" /> :
      statusMessage.type === 'warning' ? <AlertTriangle className="h-4 w-4 flex-shrink-0" /> :
      <Check className="h-4 w-4 flex-shrink-0" />;

    // Return the styled message component
    return (
      <div className={`mb-4 p-3 rounded-md ${bgColor} ${textColor} flex items-center space-x-2 text-sm`}>
        {iconComponent}
        <span>{statusMessage.text}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="flex-none p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold">Label Editor</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Click label to edit. Dragging map disabled while moving labels.
            </p>
          </div>
          <button onClick={refreshLabels} className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" title="Refresh labels">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Status Message Area */}
      {statusMessage && (
        <div className="px-4 pt-4">{renderStatusMessage()}</div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Editing Controls: Show only if a label is selected AND has needed properties */}
        {selectedLabel && selectedLabel.symbol && selectedLabel.attributes ? ( // <-- Added checks
          <div className="space-y-4 p-4 border rounded-lg border-gray-200 dark:border-gray-700">
            {/* Label Text Edit Section */}
            <div>
              <label className="text-sm font-medium mb-1 block flex items-center">
                <Edit className="mr-2 h-4 w-4 text-gray-500" /> Label Text
              </label>
              {isTextEditing ? (
                // Input field shown when editing text
                <div className="flex items-center space-x-2">
                  <input
                    ref={textInputRef}
                    type="text"
                    value={labelText} // Uses state variable
                    onChange={(e) => setLabelText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { updateLabelText(labelText); setIsTextEditing(false); } // Use state value on Enter
                      else if (e.key === "Escape") { setLabelText(selectedLabel.symbol?.text || ""); setIsTextEditing(false); }
                    }}
                    onBlur={() => { updateLabelText(labelText); setIsTextEditing(false); }} // Save state value on blur
                    className="flex-grow px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
                    placeholder="Enter label text"
                  />
                  {/* Save/Cancel buttons for text edit */}
                  <button onClick={() => { updateLabelText(labelText); setIsTextEditing(false); }} className="p-1.5 rounded-md bg-green-500 text-white hover:bg-green-600" title="Save"><Check className="h-4 w-4" /></button>
                  <button onClick={() => { setLabelText(selectedLabel.symbol?.text || ""); setIsTextEditing(false); }} className="p-1.5 rounded-md bg-gray-500 text-white hover:bg-gray-600" title="Cancel"><XIcon className="h-4 w-4" /></button>
                </div>
              ) : (
                // Display text and edit button when not editing text
                <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 min-h-[38px]">
                  <p className="text-sm truncate flex-1 mr-2" title={labelText || ""}> {/* Use state variable */}
                    {labelText || "(No text)"} {/* Use state variable */}
                  </p>
                  <button onClick={() => setIsTextEditing(true)} className="p-1 rounded-full text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/50" title="Edit Text">
                    <Edit className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Font Size Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium flex items-center"><Sliders className="mr-2 h-4 w-4" /> Font Size</label>
                <span className="text-sm font-mono bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">{fontSize}px</span> {/* Use state variable */}
              </div>
              <input
                type="range" min="8" max="24" step="1" value={fontSize} // Use state variable
                onChange={(e) => updateFontSize(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Position Control Button */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium flex items-center"><Move className="mr-2 h-4 w-4" /> Position (Offset)</label>
                <span className="text-xs font-mono bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">X: {Math.round(position.x)}, Y: {Math.round(position.y)}</span> {/* Use state variable */}
              </div>
              <button
                onClick={enableMovingMode} disabled={isMoving}
                className={`w-full py-2 px-4 rounded-md text-sm font-medium flex items-center justify-center transition-colors ${isMoving ? 'bg-blue-200 text-blue-700 dark:bg-blue-900 dark:text-blue-300 cursor-wait animate-pulse' : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-900'}`}
              >
                <Move className="mr-2 h-4 w-4" /> {isMoving ? "Moving... (Drag on map)" : "Adjust Position"}
              </button>
            </div>

            {/* Reset Single Label Button */}
            <button onClick={resetSingleLabel} className="w-full py-1.5 px-4 mt-4 rounded-md text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600">
              Reset This Label
            </button>
          </div>
        ) : (
          // Placeholder shown when no label is selected or selected label is invalid
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
            <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
              <Type className="h-10 w-10 text-gray-400 dark:text-gray-500" />
            </div>
            <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300">No Label Selected</h4>
            <p className="mt-2 text-sm">Click a label on the map to edit its properties.</p>
            {selectedLabel && (!selectedLabel.symbol || !selectedLabel.attributes) && ( // Show reason if invalid
              <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">(Selected graphic missing symbol/attributes)</p>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex-none p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        {/* Edited Label Count - Check manager and property existence */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {(labelManager && labelManager.editedLabels?.size !== undefined) ? `${labelManager.editedLabels.size} label(s) modified` : '0 labels modified'}
          </span>
        </div>
        {/* Action Buttons */}
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
          {/* Reset All Changes Button */}
          <button
            onClick={resetChanges}
            disabled={!labelManager || !labelManager.editedLabels || labelManager.editedLabels.size === 0}
            className="flex-1 py-2 px-4 rounded-md text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 dark:disabled:bg-gray-700/50"
          >
            Reset All Changes
          </button>
          {/* Apply Changes Button */}
          <button
            onClick={() => finalizeLabels()}
            disabled={!labelManager || !labelManager.editedLabels || labelManager.editedLabels.size === 0 || isSaving}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium flex items-center justify-center transition-colors ${!labelManager || !labelManager.editedLabels || labelManager.editedLabels.size === 0 ? 'bg-blue-300 text-white cursor-not-allowed' : isSaving ? 'bg-blue-500 text-white cursor-wait' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            <Save className={`mr-2 h-4 w-4 ${isSaving ? 'animate-spin' : ''}`} /> {isSaving ? 'Saving...' : 'Apply Changes'}
          </button>
        </div>
        {/* Close Editor Button */}
        <button onClick={handleClose} className="w-full mt-2 py-2 px-4 rounded-md text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
          Close Editor
        </button>
      </div>
    </div>
 );
};

export default LabelEditor;