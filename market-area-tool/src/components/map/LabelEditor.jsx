// src/components/map/LabelEditor.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  Sliders,
  Move,
  Type,
  Lock,
  Save,
  Edit,
  Check,
  X as XIcon,
} from "lucide-react";

const LabelEditor = ({
  isOpen,
  onClose,
  mapView,
  labelManager,
  activeLayer, // Assuming labels might be on the activeLayer or managed globally
}) => {
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [fontSize, setFontSize] = useState(10);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [labelText, setLabelText] = useState("");
  const [isMoving, setIsMoving] = useState(false);
  const [editedLabels, setEditedLabels] = useState({});
  const [allLabels, setAllLabels] = useState([]);
  const [selectAllMode, setSelectAllMode] = useState(false);
  const [isTextEditing, setIsTextEditing] = useState(false);
  const [preventAlerts, setPreventAlerts] = useState(false);

  const clickHandlerRef = useRef(null);
  const moveDownHandlerRef = useRef(null);
  const moveMoveHandlerRef = useRef(null);
  const moveUpHandlerRef = useRef(null);

  const dragStartRef = useRef(null);
  const labelStartOffsetRef = useRef(null);
  const textInputRef = useRef(null);

  // --- Initialize label selection mode and gather all labels ---
  useEffect(() => {
    if (!isOpen || !mapView || !mapView.ready) return;

    const collectAllLabels = () => {
      const labels = [];
      const processedIds = new Set(); // Prevent duplicates if labels are in multiple layers/collections

      const collectFromLayer = (layer) => {
        if (!layer?.graphics?.items) return; // Check graphics collection exists and has items
        layer.graphics.items.forEach((graphic) => {
          const labelId = getLabelId(graphic); // Get a unique ID
          if (
            !processedIds.has(labelId) &&
            (graphic.attributes?.isLabel === true ||
              (graphic.symbol && graphic.symbol.type === "text"))
          ) {
            labels.push(graphic);
            processedIds.add(labelId);
          }
        });
      };

      // Collect from activeLayer if provided
      if (activeLayer) {
        collectFromLayer(activeLayer);
      }
      // Collect from general mapView graphics (sometimes labels are added here)
      if (mapView.graphics?.items) {
        mapView.graphics.items.forEach((graphic) => {
          const labelId = getLabelId(graphic);
          if (
            !processedIds.has(labelId) &&
            (graphic.attributes?.isLabel === true ||
              (graphic.symbol && graphic.symbol.type === "text"))
          ) {
            labels.push(graphic);
            processedIds.add(labelId);
          }
        });
      }
      // Collect from other layers as a fallback (less common for editable labels)
      else {
        mapView.map.layers.forEach((layer) => {
          // Only check GraphicsLayers for labels usually
          if (layer.type === "graphics") {
            collectFromLayer(layer);
          }
        });
      }

      console.log(
        `[LabelEditor] Collected ${labels.length} unique labels for editing`
      );
      setAllLabels(labels);
      return labels;
    };

    const enableLabelSelection = () => {
      console.log("[LabelEditor] Enabling label selection mode");
      if (mapView.container) mapView.container.style.cursor = "pointer";

      clickHandlerRef.current = mapView.on("click", (event) => {
        if (isTextEditing || isMoving) {
          event.stopPropagation();
          return;
        }

        const screenPoint = { x: event.x, y: event.y };
        mapView
          .hitTest(screenPoint)
          .then((response) => {
            const labelHits = response.results?.filter(
              (result) =>
                result.graphic?.attributes?.isLabel === true ||
                (result.graphic?.symbol &&
                  result.graphic?.symbol.type === "text")
            );

            if (labelHits && labelHits.length > 0) {
              event.stopPropagation();
              const hitLabel = labelHits[0].graphic;
              // Set the selected label
              setSelectedLabel(hitLabel);
              setFontSize(hitLabel.symbol?.font?.size || 10);
              setLabelText(hitLabel.symbol?.text || "");
              setPosition({
                x: hitLabel.symbol?.xoffset || 0,
                y: hitLabel.symbol?.yoffset || 0,
              });
              setSelectAllMode(false);
              setIsTextEditing(false);
            } else {
              if (selectedLabel) {
                console.log(
                  "[LabelEditor] Clicked outside, deselecting label."
                );
                setSelectedLabel(null);
                setLabelText("");
              }
            }
          })
          .catch((err) => {
            console.error("[LabelEditor] Error during hit test:", err);
          });
      });
    };

    collectAllLabels();
    enableLabelSelection();

    // Cleanup
    return () => {
      if (clickHandlerRef.current) clickHandlerRef.current.remove();
      if (moveDownHandlerRef.current) moveDownHandlerRef.current.remove();
      if (moveMoveHandlerRef.current) moveMoveHandlerRef.current.remove();
      if (moveUpHandlerRef.current) moveUpHandlerRef.current.remove();
      if (mapView?.container) mapView.container.style.cursor = "default";
      setSelectedLabel(null);
      setLabelText("");
      setSelectAllMode(false);
      setIsMoving(false);
      setIsTextEditing(false);
    };
  }, [isOpen, mapView, activeLayer]);

  // --- Auto-focus text input ---
  useEffect(() => {
    if (isTextEditing && textInputRef.current) {
      textInputRef.current.focus();
      textInputRef.current.select();
    }
  }, [isTextEditing]);

  // --- Get unique label ID ---
  const getLabelId = (label) => {
    if (!label) return null;

    // First check for layer information
    const layerPrefix = label.layer?.id ? `${label.layer.id}-` : "";

    // Prioritize explicit IDs
    if (label.attributes?.labelId)
      return `${layerPrefix}explicit-${label.attributes.labelId}`;

    // Check for OBJECTID (most common scenario)
    if (label.attributes?.OBJECTID) {
      if (label.attributes?.isLabel) {
        // If it's a label with an OBJECTID, it could be its own ID or a parent reference
        // Check if it has a parentID attribute, which means this OBJECTID is for the label itself
        if (label.attributes.parentID !== undefined) {
          return `${layerPrefix}oid-label-${label.attributes.parentID}`;
        } else {
          // If no parentID, then this OBJECTID belongs to the label itself
          return `${layerPrefix}oid-${label.attributes.OBJECTID}`;
        }
      } else {
        // Regular feature with OBJECTID
        return `${layerPrefix}oid-${label.attributes.OBJECTID}`;
      }
    }

    // Check for parentID which is commonly used for labels
    if (label.attributes?.parentID) {
      return `${layerPrefix}oid-label-${label.attributes.parentID}`;
    }

    // Check for uid which is sometimes used
    if (label.attributes?.uid)
      return `${layerPrefix}uid-${label.attributes.uid}`;

    // ArcGIS internal uid (available on all graphics)
    if (label.uid) return `${layerPrefix}graphic-uid-${label.uid}`;

    // Fallback using geometry and text content
    if (label.geometry) {
      const textPart =
        label.symbol?.text?.substring(0, 10).replace(/\s+/g, "_") || "no_text";
      return `${layerPrefix}geom-${label.geometry.x?.toFixed(
        2
      )}-${label.geometry.y?.toFixed(2)}-${textPart}`;
    }

    // Last resort
    return `${layerPrefix}unknown-${Math.random()
      .toString(36)
      .substring(2, 9)}`;
  };

  // --- Trigger Refresh ---
  const triggerLabelRefresh = (labelIds = []) => {
    // First ensure that the edited label is marked as the primary one
    if (labelIds.length === 1 && selectedLabel) {
      const labelId = labelIds[0];

      // Mark this label as the primary one to keep during de-duplication
      if (selectedLabel.attributes) {
        selectedLabel.attributes._isEdited = true;
        // Ensure it's visible
        selectedLabel.visible = true;
      }
    }

    // Use the labelManager if available
    if (labelManager && typeof labelManager.refreshLabels === "function") {
      console.log(
        "[LabelEditor] Triggering refresh via labelManager for IDs:",
        labelIds
      );

      // Use a small delay to ensure all DOM updates have completed
      setTimeout(() => {
        try {
          const result = labelManager.refreshLabels(labelIds);

          // If the refresh failed (label not found), try a fallback mechanism
          if (!result.success) {
            console.warn(
              "[LabelEditor] Label manager refresh failed:",
              result.message
            );

            // Try direct refresh as fallback
            if (
              selectedLabel &&
              selectedLabel.layer &&
              typeof selectedLabel.layer.refresh === "function"
            ) {
              console.log(
                "[LabelEditor] Falling back to direct layer refresh for selected label"
              );
              selectedLabel.layer.refresh();
            } else if (
              activeLayer &&
              typeof activeLayer.refresh === "function"
            ) {
              console.log("[LabelEditor] Falling back to active layer refresh");
              activeLayer.refresh();
            }
          }
        } catch (error) {
          console.error("[LabelEditor] Error during label refresh:", error);

          // Fallback to regular layer refresh
          if (activeLayer && typeof activeLayer.refresh === "function") {
            console.log(
              "[LabelEditor] Using layer refresh fallback after error"
            );
            activeLayer.refresh();
          }
        }
      }, 0);

      return;
    }

    // Fallback: Attempt to refresh layers or the view
    console.warn(
      "[LabelEditor] labelManager.refreshLabels not available. Using layer/view refresh fallback."
    );

    // Before refreshing, hide any potential duplicates
    if (labelIds.length === 1 && selectedLabel) {
      hideAllDuplicatesFor(selectedLabel);
    }

    const layersToRefresh = new Set();

    // First, handle layers with specific labels
    if (labelIds.length > 0 && allLabels.length > 0) {
      const labelsToProcess = allLabels.filter((lbl) =>
        labelIds.includes(getLabelId(lbl))
      );

      // Add related layers
      labelsToProcess.forEach((label) => {
        if (label.layer) {
          layersToRefresh.add(label.layer);
        }
      });
    }

    // If no specific layers were found, refresh activeLayer or all graphics
    if (layersToRefresh.size === 0) {
      if (activeLayer) {
        layersToRefresh.add(activeLayer);
      } else if (mapView?.map?.layers) {
        // Add all graphics layers
        mapView.map.layers.forEach((layer) => {
          if (layer.type === "graphics") {
            layersToRefresh.add(layer);
          }
        });
      }
    }

    // Refresh all relevant layers
    if (layersToRefresh.size > 0) {
      layersToRefresh.forEach((layer) => {
        if (layer && typeof layer.refresh === "function") {
          console.log(
            `[LabelEditor] Refreshing layer: ${layer.id || layer.title}`
          );
          layer.refresh();
        }
      });
    } else if (
      mapView?.graphics &&
      typeof mapView.graphics.refresh === "function"
    ) {
      // If no specific layer found, refresh the main view graphics
      console.log("[LabelEditor] Refreshing mapView.graphics");
      mapView.graphics.refresh();
    } else {
      console.error("[LabelEditor] Cannot find appropriate refresh mechanism.");
    }
  };

  /**
   * Enhanced hideAllDuplicatesFor function for LabelEditor.jsx
   * Replace the existing function with this improved version
   */
  const hideAllDuplicatesFor = (label) => {
    if (!label || !label.attributes) return;

    // Get the label ID
    const labelId = getLabelId(label);
    if (!labelId) {
      console.warn(
        `[LabelEditor] Cannot hide duplicates - unable to generate ID for label`
      );
      return;
    }

    // Mark this label as the primary one with comprehensive flagging
    label.visible = true;
    if (label.attributes) {
      // Apply all protection flags to ensure persistence
      label.attributes._isEdited = true;
      label.attributes._permanentEdit = true;
      label.attributes._userEdited = true;
      label.attributes._preserveOnRefresh = true;
      label.attributes._preventAutoHide = true;
      label.attributes._positionLocked = true;

      // Store original parent ID if not already present
      if (label.attributes.parentID && !label.attributes._originalParentID) {
        label.attributes._originalParentID = label.attributes.parentID;
      }

      // Remove any duplicate flags
      delete label.attributes._isDuplicate;
      delete label.attributes._duplicateOf;
    }

    // Get parent ID to identify potential duplicates
    const parentId = label.attributes.parentID;
    if (!parentId) {
      console.warn(
        `[LabelEditor] Cannot hide duplicates - no parent ID for label ${labelId}`
      );
      return;
    }

    // First approach: Use labelManager if available
    if (
      labelManager &&
      typeof labelManager._hideAllDuplicatesFor === "function"
    ) {
      console.log(
        `[LabelEditor] Using labelManager to hide duplicates for label ${labelId}`
      );

      // Call the manager's method with enhanced label info
      const labelInfo = {
        labelGraphic: label,
        parentId: parentId,
        isEdited: true,
        isPermanent: true,
        isUserEdited: true,
      };

      labelManager._hideAllDuplicatesFor(labelId, labelInfo);
      return; // Use manager exclusively if available
    }

    // If manager not available, do it manually as fallback
    let duplicatesFound = 0;

    // Check in allLabels array first
    allLabels.forEach((otherLabel) => {
      // Skip the label we're updating
      if (otherLabel === label) return;

      // Check if this label has the same parent ID
      if (otherLabel.attributes?.parentID === parentId) {
        // Hide this duplicate
        otherLabel.visible = false;

        // Mark it as a duplicate with comprehensive reference
        if (otherLabel.attributes) {
          otherLabel.attributes._isDuplicate = true;
          otherLabel.attributes._duplicateOf = labelId;
          otherLabel.attributes._duplicateOfParentId = parentId;
        }

        duplicatesFound++;
      }
    });

    // Check in active layer if available (as secondary search)
    if (activeLayer && activeLayer.graphics?.items) {
      activeLayer.graphics.items.forEach((graphic) => {
        // Skip non-label graphics and the label we're updating
        if (
          graphic === label ||
          !(
            graphic.attributes?.isLabel === true ||
            (graphic.symbol && graphic.symbol.type === "text")
          )
        ) {
          return;
        }

        // Check if this label has the same parent ID
        if (graphic.attributes?.parentID === parentId) {
          // Hide this duplicate
          graphic.visible = false;

          // Mark it as a duplicate
          if (graphic.attributes) {
            graphic.attributes._isDuplicate = true;
            graphic.attributes._duplicateOf = labelId;
            graphic.attributes._duplicateOfParentId = parentId;
          }

          duplicatesFound++;
        }
      });
    }

    // Check in mapView graphics as last resort
    if (mapView?.graphics?.items) {
      mapView.graphics.items.forEach((graphic) => {
        // Skip non-label graphics and the label we're updating
        if (
          graphic === label ||
          !(
            graphic.attributes?.isLabel === true ||
            (graphic.symbol && graphic.symbol.type === "text")
          )
        ) {
          return;
        }

        // Check if this label has the same parent ID
        if (graphic.attributes?.parentID === parentId) {
          // Hide this duplicate
          graphic.visible = false;

          // Mark it as a duplicate
          if (graphic.attributes) {
            graphic.attributes._isDuplicate = true;
            graphic.attributes._duplicateOf = labelId;
            graphic.attributes._duplicateOfParentId = parentId;
          }

          duplicatesFound++;
        }
      });
    }

    if (duplicatesFound > 0) {
      console.log(
        `[LabelEditor] Hid ${duplicatesFound} duplicate labels for parent ID ${parentId}`
      );
    }
  };

  /**
   * Enhanced updateLabelProperties function for LabelEditor.jsx
   * Replace the existing function with this improved version
   */
  const updateLabelProperties = (label, properties) => {
    if (!label || !label.symbol) return;
    const labelId = getLabelId(label);
    if (!labelId) return;

    try {
      // Clone the symbol to avoid reference issues
      const newSymbol = label.symbol.clone();
      let changed = false;

      // Track what properties changed for logging
      const changes = [];

      // Update font size if needed
      if (
        properties.fontSize !== undefined &&
        newSymbol.font?.size !== properties.fontSize
      ) {
        newSymbol.font = { ...newSymbol.font, size: properties.fontSize };
        changed = true;
        changes.push(`fontSize: ${newSymbol.font?.size}`);
      }

      // Update position if needed
      if (
        properties.position !== undefined &&
        (newSymbol.xoffset !== properties.position.x ||
          newSymbol.yoffset !== properties.position.y)
      ) {
        newSymbol.xoffset = properties.position.x;
        newSymbol.yoffset = properties.position.y;
        changed = true;
        changes.push(
          `position: (${properties.position.x}, ${properties.position.y})`
        );
      }

      // Update text if needed
      if (properties.text !== undefined && newSymbol.text !== properties.text) {
        newSymbol.text = properties.text;
        changed = true;
        changes.push(`text: "${properties.text}"`);
      }

      if (changed) {
        // Before applying changes, ensure this label is marked as primary and hide any duplicates
        hideAllDuplicatesFor(label);

        // Mark this label with comprehensive editing flags
        if (label.attributes) {
          // Apply all protection flags to ensure persistence
          label.attributes._isEdited = true;
          label.attributes._permanentEdit = true;
          label.attributes._userEdited = true;
          label.attributes._preserveOnRefresh = true;
          label.attributes._preventAutoHide = true;
          label.attributes._positionLocked = true;

          // Store original parent ID if not already present
          if (
            label.attributes.parentID &&
            !label.attributes._originalParentID
          ) {
            label.attributes._originalParentID = label.attributes.parentID;
          }
        }

        // Apply the cloned, modified symbol
        label.symbol = newSymbol;

        // Ensure the label is visible
        label.visible = true;

        // Update tracking state for persistence
        setEditedLabels((prev) => ({
          ...prev,
          [labelId]: {
            ...(prev[labelId] || { graphic: label }),
            fontSize:
              newSymbol.font?.size ?? prev[labelId]?.fontSize ?? fontSize,
            position: {
              x: newSymbol.xoffset ?? prev[labelId]?.position?.x ?? position.x,
              y: newSymbol.yoffset ?? prev[labelId]?.position?.y ?? position.y,
            },
            text: newSymbol.text ?? prev[labelId]?.text ?? labelText,
            edited: true,
            permanent: true,
            userEdited: true,
          },
        }));

        // Trigger a refresh for this specific label
        triggerLabelRefresh([labelId]);

        console.log(
          `[LabelEditor] Updated properties for label ${labelId}`,
          changes.length > 0 ? `(${changes.join(", ")})` : ""
        );
      } else {
        console.log(
          `[LabelEditor] No effective change detected for label ${labelId}`
        );
      }
    } catch (error) {
      console.error(
        `[LabelEditor] Error updating properties for label ${labelId}:`,
        error
      );
    }
  };

  // Update updateFontSize function
  const updateFontSize = (newSize, targetLabel = null) => {
    setFontSize(newSize); // Update UI state immediately

    if (selectAllMode && labelManager) {
      const allLabels = labelManager.getAllLabelGraphics();
      allLabels.forEach((label) => {
        labelManager.updateLabelFontSize(label, newSize);
      });
      console.log(
        `[LabelEditor] Updated font size to ${newSize} for all labels`
      );
    } else {
      const labelToUpdate = targetLabel || selectedLabel;
      if (labelToUpdate && labelManager) {
        labelManager.updateLabelFontSize(labelToUpdate, newSize);
        console.log(
          `[LabelEditor] Updated font size to ${newSize} for selected label`
        );
      }
    }
  };

  // Updated updateLabelText function for LabelEditor.jsx
  const updateLabelText = (newText, targetLabel = null) => {
    const labelToUpdate = targetLabel || selectedLabel;
    if (labelToUpdate && labelManager) {
      setLabelText(newText); // Update UI state

      // Use the label manager's updateLabelText function
      labelManager.updateLabelText(labelToUpdate, newText);

      // Apply change immediately to ensure the label updates
      if (
        labelToUpdate.symbol &&
        typeof labelToUpdate.symbol.clone === "function"
      ) {
        const symbol = labelToUpdate.symbol.clone();
        symbol.text = newText;
        labelToUpdate.symbol = symbol;
      }

      console.log(`[LabelEditor] Updated text for label to: ${newText}`);
    }
  };

  // Update enableMovingMode function
  const enableMovingMode = () => {
    if (!selectedLabel || !mapView || isMoving) return;

    console.log("[LabelEditor] Enabling label moving mode.");
    setIsMoving(true);
    if (mapView.container) mapView.container.style.cursor = "move";

    if (moveDownHandlerRef.current) moveDownHandlerRef.current.remove();
    if (moveMoveHandlerRef.current) moveMoveHandlerRef.current.remove();
    if (moveUpHandlerRef.current) moveUpHandlerRef.current.remove();

    // Pointer Down
    moveDownHandlerRef.current = mapView.on("pointer-down", (event) => {
      if (!selectedLabel) {
        setIsMoving(false);
        if (mapView.container) mapView.container.style.cursor = "pointer";
        return;
      }
      event.stopPropagation();
      dragStartRef.current = { x: event.x, y: event.y };
      labelStartOffsetRef.current = {
        x: selectedLabel.symbol?.xoffset || 0,
        y: selectedLabel.symbol?.yoffset || 0,
      };
    });

    // Pointer Move
    moveMoveHandlerRef.current = mapView.on("pointer-move", (event) => {
      if (
        !dragStartRef.current ||
        !labelStartOffsetRef.current ||
        !selectedLabel
      )
        return;

      event.stopPropagation();

      const dx = event.x - dragStartRef.current.x;
      const dy = event.y - dragStartRef.current.y;

      // Invert dy for correct vertical movement
      const newOffset = {
        x: labelStartOffsetRef.current.x + dx,
        y: labelStartOffsetRef.current.y - dy,
      };

      // Update UI state
      setPosition(newOffset);

      // Update label through manager
      if (labelManager) {
        labelManager.updateLabelPosition(selectedLabel, newOffset);
      }
    });

    // Pointer Up
    moveUpHandlerRef.current = mapView.on("pointer-up", (event) => {
      console.log("[LabelEditor] Pointer Up (Moving Mode)");
      event.stopPropagation();

      // Reset state & handlers
      dragStartRef.current = null;
      labelStartOffsetRef.current = null;
      setIsMoving(false);
      if (mapView.container) mapView.container.style.cursor = "pointer";

      if (moveDownHandlerRef.current) moveDownHandlerRef.current.remove();
      if (moveMoveHandlerRef.current) moveMoveHandlerRef.current.remove();
      if (moveUpHandlerRef.current) moveUpHandlerRef.current.remove();
      moveDownHandlerRef.current = null;
      moveMoveHandlerRef.current = null;
      moveUpHandlerRef.current = null;

      console.log(
        "[LabelEditor] Finished moving label. Final Offset:",
        position
      );

      // Save changes
      if (labelManager) {
        labelManager.saveLabels();
      }
    });
  };

  // --- Toggle "Select All" mode ---
  const toggleSelectAllMode = () => {
    if (!selectAllMode) {
      setSelectedLabel(null);
      setLabelText("");
      setIsTextEditing(false);
      setIsMoving(false);
    }
    setSelectAllMode(!selectAllMode);
    console.log(
      `[LabelEditor] ${!selectAllMode ? "Enabled" : "Disabled"} select all mode`
    );
  };

  // Update finalizeLabels function
  const finalizeLabels = (silent = false) => {
    if (!labelManager) {
      console.log("[LabelEditor] No label manager available.");
      return false;
    }

    try {
      // Complete any active text editing
      if (isTextEditing && selectedLabel) {
        labelManager.updateLabelText(selectedLabel, labelText);
        setIsTextEditing(false);
      }

      // Save all labels
      const result = labelManager.saveLabels();

      if (result.success) {
        console.log(`[LabelEditor] Saved ${result.count} labels`);

        // Clear edit tracking state
        setSelectedLabel(null);
        setLabelText("");
        setSelectAllMode(false);

        // Show success message if not silent
        if (!silent) {
          alert("Label changes saved successfully.");
        }

        return true;
      } else {
        console.error("[LabelEditor] Error saving labels:", result.message);

        if (!silent) {
          alert("Failed to save label positions.");
        }

        return false;
      }
    } catch (error) {
      console.error("[LabelEditor] Error finalizing labels:", error);

      if (!silent) {
        alert("Failed to save label positions.");
      }

      return false;
    }
  };

  /**
   * Handles editor closing with automatic save
   */
  const handleClose = () => {
    // If there are unsaved edits, automatically save them
    if (Object.keys(editedLabels).length > 0) {
      console.log("[LabelEditor] Auto-saving label edits before closing...");

      try {
        // Call finalizeLabels but in silent mode (no alerts)
        finalizeLabels(true);
        console.log("[LabelEditor] Successfully auto-saved label edits.");
      } catch (err) {
        console.error("[LabelEditor] Error during auto-save:", err);
      }
    }

    // Call the provided onClose callback
    if (onClose) {
      onClose();
    }
  };

  // Update resetChanges function
  const resetChanges = () => {
    if (!labelManager) {
      console.log("[LabelEditor] No label manager available for reset.");
      return;
    }

    console.log("[LabelEditor] Resetting all label changes.");

    try {
      // Reset via manager
      const result = labelManager.resetAllLabelPositions();
      console.log(`[LabelEditor] Reset ${result.count} labels.`);

      // Reset UI state
      setSelectedLabel(null);
      setLabelText("");
      setIsTextEditing(false);
      setSelectAllMode(false);
      setIsMoving(false);

      console.log("[LabelEditor] Reset complete.");
    } catch (error) {
      console.error("[LabelEditor] Error resetting labels:", error);
    }
  };

  // --- Reset single label ---
  const resetSingleLabel = () => {
    if (!selectedLabel) return;
    const labelId = getLabelId(selectedLabel);
    if (!labelId) return;
    console.log(`[LabelEditor] Resetting changes for label: ${labelId}`);

    let resetSuccessful = false;
    // Try manager reset
    if (labelManager && typeof labelManager.resetLabelPosition === "function") {
      try {
        labelManager.resetLabelPosition(labelId); // Use the ID
        resetSuccessful = true;
        console.log(`[LabelEditor] Reset label ${labelId} via manager.`);
      } catch (err) {
        console.error(
          `[LabelEditor] Error resetting label ${labelId} via manager:`,
          err
        );
      }
    }

    // Fallback: Remove from local storage
    if (!resetSuccessful) {
      const existingPositions = JSON.parse(
        localStorage.getItem("customLabelPositions") || "{}"
      );
      if (existingPositions[labelId]) {
        delete existingPositions[labelId];
        localStorage.setItem(
          "customLabelPositions",
          JSON.stringify(existingPositions)
        );
        console.log(
          `[LabelEditor] Reset label ${labelId} via localStorage removal.`
        );
        resetSuccessful = true; // Handled locally
      }
    }

    // Remove from component's tracked edits
    if (editedLabels[labelId]) {
      setEditedLabels((prev) => {
        const newEditedLabels = { ...prev };
        delete newEditedLabels[labelId];
        return newEditedLabels;
      });
    }

    // Deselect and reset UI state
    setSelectedLabel(null);
    setLabelText("");
    setIsTextEditing(false);
    setIsMoving(false);

    // Trigger visual refresh for the specific label after state updates
    if (resetSuccessful) {
      // Use a short delay to ensure state updates might have propagated if needed
      setTimeout(() => triggerLabelRefresh([labelId]), 0);
    } else {
      console.warn(
        `[LabelEditor] Could not confirm reset method for ${labelId}, visual update might be needed manually.`
      );
    }
  };

  // --- JSX Rendering ---
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="flex-none p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold">Label Editor</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Click label to edit, or use "Select All". Dragging map is disabled
          while moving labels.
        </p>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-6">
        {/* Select All Toggle */}
        <div>
          <button
            onClick={toggleSelectAllMode}
            className={`w-full py-2 px-4 rounded-md text-sm font-medium flex items-center justify-center transition-colors duration-150 ${
              selectAllMode
                ? "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 ring-2 ring-blue-300 dark:ring-blue-500"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600"
            }`}
          >
            <Sliders className="mr-2 h-4 w-4" />
            {selectAllMode ? "Editing All Labels" : "Select All Labels"}
            <span className="ml-1.5 text-xs bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded px-1.5 py-0.5">
              {allLabels.length}
            </span>
          </button>
        </div>

        {/* Editing Controls */}
        {selectAllMode ? (
          // --- Controls for ALL labels ---
          <div className="space-y-4 p-4 border rounded-lg border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10">
            <h4 className="font-medium text-blue-700 dark:text-blue-300 flex items-center">
              <Type className="mr-2 h-4 w-4" />
              Editing All ({allLabels.length}) Labels
            </h4>
            {/* Font Size (All) */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium flex items-center">
                  <Sliders className="mr-2 h-4 w-4" /> Font Size
                </label>
                <span className="text-sm font-mono bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
                  {fontSize}px
                </span>
              </div>
              <input
                type="range"
                min="8"
                max="24"
                step="1"
                value={fontSize}
                onChange={(e) => updateFontSize(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>
        ) : selectedLabel ? (
          // --- Controls for SELECTED label ---
          <div className="space-y-4 p-4 border rounded-lg border-gray-200 dark:border-gray-700">
            {/* Label Text */}
            <div>
              <label className="text-sm font-medium mb-1 block flex items-center">
                <Edit className="mr-2 h-4 w-4 text-gray-500" /> Label Text
              </label>
              {isTextEditing ? (
                <div className="flex items-center space-x-2">
                  <input
                    ref={textInputRef}
                    type="text"
                    value={labelText}
                    onChange={(e) => setLabelText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        updateLabelText(e.target.value);
                        setIsTextEditing(false);
                      } else if (e.key === "Escape") {
                        setLabelText(selectedLabel.symbol?.text || "");
                        setIsTextEditing(false);
                      }
                    }}
                    onBlur={() => {
                      updateLabelText(labelText);
                      setIsTextEditing(false);
                    }}
                    className="flex-grow px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
                    placeholder="Enter label text"
                  />
                  <button
                    onClick={() => {
                      updateLabelText(labelText);
                      setIsTextEditing(false);
                    }}
                    className="p-1.5 rounded-md bg-green-500 text-white hover:bg-green-600"
                    title="Save"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setLabelText(selectedLabel.symbol?.text || "");
                      setIsTextEditing(false);
                    }}
                    className="p-1.5 rounded-md bg-gray-500 text-white hover:bg-gray-600"
                    title="Cancel"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 min-h-[38px]">
                  <p
                    className="text-sm truncate flex-1 mr-2"
                    title={labelText || selectedLabel.symbol?.text || ""}
                  >
                    {labelText || selectedLabel.symbol?.text || "(No text)"}
                  </p>
                  <button
                    onClick={() => setIsTextEditing(true)}
                    className="p-1 rounded-full text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/50"
                    title="Edit Text"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Font Size */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium flex items-center">
                  <Sliders className="mr-2 h-4 w-4" /> Font Size
                </label>
                <span className="text-sm font-mono bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
                  {fontSize}px
                </span>
              </div>
              <input
                type="range"
                min="8"
                max="24"
                step="1"
                value={fontSize}
                onChange={(e) => updateFontSize(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Position Control */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium flex items-center">
                  <Move className="mr-2 h-4 w-4" /> Position (Offset)
                </label>
                <span className="text-xs font-mono bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
                  X: {Math.round(position.x)}, Y: {Math.round(position.y)}
                </span>
              </div>
              <button
                onClick={enableMovingMode}
                disabled={isMoving}
                className={`w-full py-2 px-4 rounded-md text-sm font-medium flex items-center justify-center transition-colors duration-150 ${
                  isMoving
                    ? "bg-blue-200 text-blue-700 dark:bg-blue-900 dark:text-blue-300 cursor-wait animate-pulse"
                    : "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-900"
                }`}
              >
                <Move className="mr-2 h-4 w-4" />
                {isMoving ? "Moving... (Drag on map)" : "Adjust Position"}
              </button>
            </div>

            {/* Reset Single Label */}
            <button
              onClick={resetSingleLabel}
              className="w-full py-1.5 px-4 mt-4 rounded-md text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600"
            >
              Reset This Label's Changes
            </button>
          </div>
        ) : (
          // --- Placeholder when no label selected ---
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
            <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
              <Type className="h-10 w-10 text-gray-400 dark:text-gray-500" />
            </div>
            <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300">
              No Label Selected
            </h4>
            <p className="mt-2 text-sm">
              Click a label on the map or use "Select All".
            </p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex-none p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {Object.keys(editedLabels).length} label(s) modified
          </span>
        </div>
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
          <button
            onClick={resetChanges}
            disabled={Object.keys(editedLabels).length === 0 && !selectAllMode}
            className="flex-1 py-2 px-4 rounded-md text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 dark:disabled:bg-gray-700/50 dark:disabled:text-gray-500"
          >
            Reset All Changes
          </button>
          <button
            onClick={finalizeLabels}
            disabled={Object.keys(editedLabels).length === 0 && !selectAllMode}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium flex items-center justify-center transition-colors duration-150 ${
              Object.keys(editedLabels).length === 0 && !selectAllMode
                ? "bg-blue-300 text-white cursor-not-allowed dark:bg-blue-800 dark:text-blue-400"
                : "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
            }`}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full mt-2 py-2 px-4 rounded-md text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          Close Editor
        </button>
      </div>
    </div>
  );
};

export default LabelEditor;
