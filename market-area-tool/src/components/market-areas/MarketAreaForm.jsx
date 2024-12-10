// src/components/MarketAreaForm.jsx

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowsRightLeftIcon,
  MagnifyingGlassIcon,
  CursorArrowRaysIcon,
} from "@heroicons/react/24/outline";
import { useMap } from "../../contexts/MapContext";
import { useMarketAreas } from "../../contexts/MarketAreaContext";
import { toast } from "react-hot-toast";
import Radius from "./Radius";
import { FEATURE_LAYERS } from "../../contexts/MapContext";

export default function MarketAreaForm({ onClose, editingMarketArea = null }) {
  const { projectId } = useParams();
  // Get marketAreas from context
  const { addMarketArea, updateMarketArea, marketAreas } = useMarketAreas();
  const {
    isLayerLoading,
    queryFeatures,
    addToSelection,
    removeFromSelection,
    clearSelection,
    updateFeatureStyles,
    drawRadius,
    addActiveLayer,
    removeActiveLayer,
    selectedFeatures,
    isMapSelectionActive,
    setIsMapSelectionActive,
    formatLocationName,
    radiusGraphicsLayer,
    setVisibleMarketAreaIds,
    clearMarketAreaGraphics,
    setEditingMarketArea,
    selectionGraphicsLayer,  // Add this
  } = useMap();

  const initializationDone = useRef(false);
  const locationsInitialized = useRef(false);

  // At the top of your component where state is initialized
  const [formState, setFormState] = useState({
    maType: editingMarketArea?.ma_type || "",
    maName: editingMarketArea?.name || "",
    shortName: editingMarketArea?.short_name || "",
    locationSearch: "",
    availableLocations: [],
    selectedLocations: [],
    isSearching: false,
    styleSettings: {
      ...(editingMarketArea?.style_settings || {
        fillColor: "#0078D4",
        fillOpacity: 1,
        borderColor: "#0078D4",
        borderWidth: 1,
      }),
      noBorder: editingMarketArea?.style_settings?.borderWidth === 0 || false,
      noFill: editingMarketArea?.style_settings?.fillOpacity === 0 || false,
    },
  });

  // Add this useEffect to properly handle visuals during initialization
  useEffect(() => {
    // Skip if we're editing (handled by editingMarketArea effect)
    if (editingMarketArea) return;

    // When opening fresh form, don't clear existing market areas
    const init = async () => {
      // Only clear selection, not layers
      clearSelection();
    };

    init();
  }, []); // Empty dependency array since this should only run once on mountaaaaaaa

  const [radiusPoints, setRadiusPoints] = useState(
    editingMarketArea?.radius_points || []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const maTypes = [
    { value: "radius", label: "Radius" },
    { value: "zip", label: "Zip Code" },
    { value: "county", label: "County" },
    { value: "place", label: "Place" },
    { value: "tract", label: "Census Tract" },
    { value: "block", label: "Census Block" },
    { value: "blockgroup", label: "Census Block Group" },
    { value: "cbsa", label: "CBSA" },
    { value: "state", label: "State" },
    { value: "usa", label: "USA" },
    { value: "md", label: "Metro Division" },
  ];

  const appendLocations = useCallback((newLocations) => {
    setFormState((prev) => {
      const existingIds = new Set(prev.selectedLocations.map((loc) => loc.id));
      const locationsToAdd = newLocations.filter(
        (loc) => !existingIds.has(loc.id)
      );

      return {
        ...prev,
        selectedLocations: [...prev.selectedLocations, ...locationsToAdd],
      };
    });
  }, []);

  // Toggle map selection mode
  const handleToggleMapSelection = useCallback(() => {
    setIsMapSelectionActive((prev) => !prev);
    if (!isMapSelectionActive) {
      toast.success("Click on the map to select areas");
    } else {
      toast.dismiss();
    }
  }, [isMapSelectionActive, setIsMapSelectionActive]);

  useEffect(() => {
    console.log("formState:", formState);
    console.log("formState.maType:", formState?.maType);
    if (!selectedFeatures.length || formState.maType === "radius") return;

    console.log("Selected features:", selectedFeatures);

    selectedFeatures.forEach((feature) => {
      console.log("Feature attributes:", feature.attributes);
    });

    const uniqueIdField =
      FEATURE_LAYERS[formState.maType]?.uniqueIdField || "FID";

    setFormState((prev) => {
      const newSelectedLocations = selectedFeatures
        .map((feature) => ({
          id: feature.attributes[uniqueIdField],
          name: formatLocationName(feature, formState.maType),
          feature: feature,
          geometry: feature.geometry,
        }))
        .filter((loc) => loc.name && loc.name.trim() !== "");

      // Filter out any duplicates
      const existingIds = new Set(prev.selectedLocations.map((loc) => loc.id));
      const uniqueNewLocations = newSelectedLocations.filter(
        (loc) => !existingIds.has(loc.id)
      );

      return {
        ...prev,
        selectedLocations: [...prev.selectedLocations, ...uniqueNewLocations],
        availableLocations: prev.availableLocations
          .filter(
            (loc) =>
              !newSelectedLocations.some((selected) => selected.id === loc.id)
          )
          .concat(
            prev.selectedLocations.filter(
              (loc) => !newSelectedLocations.some((sel) => sel.id === loc.id)
            )
          )
          .sort((a, b) => a.name.localeCompare(b.name)),
      };
    });
  }, [selectedFeatures, formState.maType, formatLocationName]);

  useEffect(() => {
    const initializeForm = async () => {
      if (!editingMarketArea || initializationDone.current) return;

      console.log("Initializing form with:", editingMarketArea);
      initializationDone.current = true;

      try {
        // Don't clear or hide any existing layers
        if (editingMarketArea.ma_type !== "radius") {
          // Just add the layer for editing if it's not already active
          await addActiveLayer(editingMarketArea.ma_type);

          if (
            editingMarketArea.locations?.length > 0 &&
            !locationsInitialized.current
          ) {
            locationsInitialized.current = true;

            // Create feature objects from saved locations
            const features = editingMarketArea.locations
              .map((loc) => ({
                geometry: loc.geometry,
                attributes: {
                  FID: loc.id,
                  NAME: loc.name,
                  marketAreaId: editingMarketArea.id,
                  order: editingMarketArea.order,
                },
              }))
              .filter(
                (feature) =>
                  formatLocationName(
                    feature,
                    editingMarketArea.ma_type
                  ).trim() !== ""
              );

            // Update form state
            setFormState((prev) => ({
              ...prev,
              maType: editingMarketArea.ma_type,
              maName: editingMarketArea.name,
              shortName: editingMarketArea.short_name,
              styleSettings: {
                ...editingMarketArea.style_settings,
                noBorder: editingMarketArea.style_settings?.borderWidth === 0,
                noFill: editingMarketArea.style_settings?.fillOpacity === 0,
              },
              selectedLocations: editingMarketArea.locations
                .filter((loc) => loc.name && loc.name.trim() !== "")
                .map((loc) => ({
                  id: loc.id,
                  name: loc.name,
                  geometry: loc.geometry,
                  feature: {
                    geometry: loc.geometry,
                    attributes: {
                      FID: loc.id,
                      NAME: loc.name,
                      marketAreaId: editingMarketArea.id,
                      order: editingMarketArea.order,
                    },
                  },
                })),
            }));

            // Update the visual representation of the editing area
            // without affecting other visible areas
            await updateFeatureStyles(
              features,
              editingMarketArea.style_settings,
              editingMarketArea.ma_type
            );
          }
        } else {
          // Handle radius type
          if (editingMarketArea.radius_points?.length > 0) {
            setFormState((prev) => ({
              ...prev,
              maType: editingMarketArea.ma_type,
              maName: editingMarketArea.name,
              shortName: editingMarketArea.short_name,
              styleSettings: {
                ...editingMarketArea.style_settings,
                noBorder: editingMarketArea.style_settings?.borderWidth === 0,
                noFill: editingMarketArea.style_settings?.fillOpacity === 0,
              },
            }));

            setRadiusPoints(editingMarketArea.radius_points);

            // Update radius visualization while preserving other areas
            for (const point of editingMarketArea.radius_points) {
              await drawRadius(
                point,
                editingMarketArea.style_settings,
                editingMarketArea.id,
                editingMarketArea.order
              );
            }
          }
        }
      } catch (error) {
        console.error("Error initializing form for editing:", error);
        toast.error("Failed to load market area for editing");
      }
    };

    initializeForm();
  }, [
    editingMarketArea,
    addActiveLayer,
    updateFeatureStyles,
    formatLocationName,
    drawRadius,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setIsMapSelectionActive(false);
      clearSelection();
      // Don't remove any layers on unmount to maintain visibility
    };
  }, [clearSelection, setIsMapSelectionActive]);

  const updateStyles = useCallback(() => {
    try {
      const { fillColor, fillOpacity, borderColor, borderWidth } =
        formState.styleSettings;

      if (formState.maType === "radius") {
        clearSelection();
        radiusPoints.forEach((point) => {
          drawRadius(point, formState.styleSettings);
        });
      } else if (formState.selectedLocations.length > 0) {
        const marketAreaId = editingMarketArea?.id || "current";
        const features = formState.selectedLocations.map((loc) => ({
          geometry: loc.geometry || loc.feature?.geometry,
          attributes: {
            FID: loc.id,
            name: loc.name,
            marketAreaId: marketAreaId,
            order: editingMarketArea?.order || 0,
          },
        }));

        updateFeatureStyles(
          features,
          {
            fill: fillColor,
            fillOpacity,
            outline: borderColor,
            outlineWidth: borderWidth,
          },
          formState.maType
        );
      }
    } catch (error) {
      console.error("Error updating styles:", error);
      toast.error("Failed to update visualization");
    }
  }, [
    formState.styleSettings,
    formState.selectedLocations,
    formState.maType,
    radiusPoints,
    updateFeatureStyles,
    drawRadius,
    clearSelection,
    editingMarketArea,
  ]);

  useEffect(() => {
    updateStyles();
  }, [formState.styleSettings, radiusPoints, updateStyles]);

  const handleMATypeChange = useCallback(
    async (e) => {
      const newType = e.target.value;

      try {
        setIsMapSelectionActive(false);
        clearSelection();

        // Only remove the active feature layer type that's currently being used for selection
        if (formState.maType) {
          await removeActiveLayer(formState.maType);
        }

        setFormState((prev) => ({
          ...prev,
          maType: newType,
          locationSearch: "",
          availableLocations: [],
          selectedLocations: [],
        }));

        setRadiusPoints([]);
        setError(null);

        if (newType && newType !== "radius") {
          try {
            // Add the new feature layer without affecting existing market areas
            await addActiveLayer(newType);
          } catch (error) {
            console.error(`Error initializing layer ${newType}:`, error);
            setError(
              `Failed to initialize ${newType} layer. Please try again.`
            );
          }
        }
      } catch (error) {
        console.error("Error switching market area type:", error);
        toast.error("Failed to switch market area type");
        setError(`Failed to switch to ${newType}. Please try again.`);
      }
    },
    [
      addActiveLayer,
      clearSelection,
      removeActiveLayer,
      setIsMapSelectionActive,
      formState.maType,
    ]
  );

  // Enhanced search handler with debouncing and extended search
  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      if (
        formState.locationSearch.length >= 3 &&
        formState.maType &&
        formState.maType !== "radius"
      ) {
        setFormState((prev) => ({ ...prev, isSearching: true }));
        try {
          // Query features without map extent restriction
          const results = await queryFeatures(
            formState.locationSearch,
            formState.maType,
            {
              returnGeometry: true,
              outFields: ["*"],
              // Remove any spatial constraints here
              spatialRel: "esriSpatialRelIntersects",
              num: 100, // Increase the number of results returned
            }
          );

          const mappedResults = results
            .map((feature) => ({
              id: feature.attributes.FID,
              name: formatLocationName(feature, formState.maType),
              feature: feature,
              geometry: feature.geometry,
            }))
            .filter(
              (loc) =>
                loc.name &&
                loc.name.trim() !== "" &&
                !formState.selectedLocations.some((sel) => sel.id === loc.id)
            );

          setFormState((prev) => ({
            ...prev,
            availableLocations: mappedResults,
            isSearching: false,
          }));
        } catch (error) {
          console.error("Search error:", error);
          toast.error("Error searching locations");
          setError("Error searching locations");
          setFormState((prev) => ({ ...prev, isSearching: false }));
        }
      } else if (formState.locationSearch.length < 3) {
        // Clear available locations if search string is too short
        setFormState((prev) => ({
          ...prev,
          availableLocations: [],
          isSearching: false,
        }));
      }
    }, 300); // Debounce delay

    return () => clearTimeout(searchTimer);
  }, [
    formState.locationSearch,
    formState.maType,
    formState.selectedLocations,
    queryFeatures,
    formatLocationName,
  ]);

  // Location selection handler to append selected locations
  const handleLocationSelect = useCallback(
    (location) => {
      console.log("[MarketAreaForm] Selecting location:", location);
      try {
        appendLocations([location]); // Append the new location
        addToSelection(location.feature, formState.maType); // Pass layerType
        toast.success(`Selected: ${location.name}`);
      } catch (error) {
        console.error("Error selecting location:", error);
        toast.error("Failed to select location");
      }
    },
    [addToSelection, appendLocations, formState.maType]
  );

  // Location deselection handler
  const handleLocationDeselect = useCallback(
    (location) => {
      console.log("[MarketAreaForm] Deselecting location:", location);
      try {
        // Remove the location from selectedLocations
        setFormState((prev) => {
          const updatedSelectedLocations = prev.selectedLocations.filter(
            (loc) => loc.id !== location.id
          );
          const updatedAvailableLocations = [
            ...prev.availableLocations,
            location,
          ].sort((a, b) => a.name.localeCompare(b.name)); // Optional: sort alphabetically

          return {
            ...prev,
            selectedLocations: updatedSelectedLocations,
            availableLocations: updatedAvailableLocations,
          };
        });

        // Call removeFromSelection to update the map
        removeFromSelection(location.feature, formState.maType);
        toast.success(`Deselected: ${location.name}`);
      } catch (error) {
        console.error("Error deselecting location:", error);
        toast.error("Failed to deselect location");
      }
    },
    [removeFromSelection, formState.maType]
  );

  // Style change handler
  const handleStyleChange = useCallback((type, value) => {
    setFormState((prev) => {
      const newStyleSettings = { ...prev.styleSettings };

      if (type === "noBorder") {
        newStyleSettings.noBorder = value;
        if (value) {
          newStyleSettings.borderWidth = 0;
        } else {
          if (newStyleSettings.borderWidth === 0) {
            newStyleSettings.borderWidth = 1; // Default to 1 if previously 0
          }
        }
      } else if (type === "noFill") {
        newStyleSettings.noFill = value;
        if (value) {
          newStyleSettings.fillOpacity = 0;
        } else {
          if (newStyleSettings.fillOpacity === 0) {
            newStyleSettings.fillOpacity = 1; // Default to fully opaque if previously 0
          }
        }
      } else if (type === "fillOpacity") {
        // Ensure value is between 0 and 1
        newStyleSettings.fillOpacity = Math.max(0, Math.min(1, value));
        // If opacity is being set, ensure noFill is false
        if (newStyleSettings.fillOpacity === 0) {
          newStyleSettings.noFill = true;
        } else {
          newStyleSettings.noFill = false;
        }
      } else if (type === "borderWidth") {
        newStyleSettings.borderWidth = Math.max(0, Number(value));
        if (newStyleSettings.borderWidth === 0) {
          newStyleSettings.noBorder = true;
        } else {
          newStyleSettings.noBorder = false;
        }
      } else {
        newStyleSettings[type] = value;
      }

      return {
        ...prev,
        styleSettings: newStyleSettings,
      };
    });
  }, []);

  // Helper function at the top of your component
  const preserveExistingMarketAreas = useCallback(async () => {
    const savedGraphics = selectionGraphicsLayerRef.current?.graphics
      .filter((g) => g.attributes?.marketAreaId)
      .toArray();

    // Remove everything first
    await removeActiveLayer(formState.maType);
    clearSelection(null);

    // Re-add the saved market area graphics
    if (savedGraphics?.length > 0) {
      const { default: Graphic } = await import("@arcgis/core/Graphic");
      savedGraphics.forEach((g) => {
        const graphic = new Graphic({
          geometry: g.geometry,
          attributes: g.attributes,
          symbol: g.symbol,
        });
        selectionGraphicsLayerRef.current.add(graphic);
      });
    }
  }, [formState.maType, removeActiveLayer, clearSelection]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
  
    try {
      const styleSettings = {
        fillColor: formState.styleSettings.fillColor,
        fillOpacity: formState.styleSettings.noFill ? 0 : formState.styleSettings.fillOpacity,
        borderColor: formState.styleSettings.borderColor,
        borderWidth: formState.styleSettings.noBorder ? 0 : formState.styleSettings.borderWidth,
      };
  
      const mappedType = formState.maType === "md" ? "place" : formState.maType;
  
      const marketAreaData = {
        ma_type: mappedType,
        name: formState.maName,
        short_name: formState.shortName,
        style_settings: styleSettings,
        locations: formState.maType !== "radius"
          ? formState.selectedLocations.map((loc) => ({
              id: loc.id,
              name: loc.name,
              geometry: loc.geometry || loc.feature?.geometry,
            }))
          : [],
        radius_points: formState.maType === "radius"
          ? radiusPoints.map((point) => ({
              center: point.center,
              radii: point.radii,
            }))
          : [],
        original_type: formState.maType,
      };
  
      // Store ALL existing market area graphics, including the one being edited
      const existingGraphics = selectionGraphicsLayer.graphics
        .filter(g => g.attributes?.marketAreaId)
        .toArray()
        .map(g => ({
          geometry: g.geometry,
          attributes: g.attributes,
          symbol: g.symbol
        }));
  
      let savedMarketArea;
      if (editingMarketArea) {
        savedMarketArea = await updateMarketArea(projectId, editingMarketArea.id, marketAreaData);
        toast.success("Market area updated successfully");
      } else {
        savedMarketArea = await addMarketArea(projectId, marketAreaData);
        toast.success("Market area created successfully");
      }
  
      // Disable map selection mode
      setIsMapSelectionActive(false);
  
      // Store current selections with the saved market area ID
      const currentSelections = selectedFeatures.map(feature => ({
        ...feature,
        attributes: {
          ...feature.attributes,
          marketAreaId: editingMarketArea?.id || savedMarketArea.id,
          FEATURE_TYPE: formState.maType
        }
      }));
  
      // Remove just the feature layer but keep the graphics layer intact
      if (formState.maType) {
        await removeActiveLayer(formState.maType);
      }
  
      // Clear the graphics layer
      selectionGraphicsLayer.removeAll();
  
      // First, restore all existing market area graphics
      const { default: Graphic } = await import("@arcgis/core/Graphic");
      existingGraphics.forEach(g => {
        const graphic = new Graphic({
          geometry: g.geometry,
          attributes: g.attributes,
          symbol: g.symbol
        });
        selectionGraphicsLayer.add(graphic);
      });
  
      // If we're editing, make sure to update the existing market area's style
      if (editingMarketArea) {
        const editedAreaGraphics = currentSelections.map(feature => {
          return {
            geometry: feature.geometry,
            attributes: {
              ...feature.attributes,
              marketAreaId: editingMarketArea.id
            }
          };
        });
  
        await updateFeatureStyles(
          editedAreaGraphics,
          styleSettings,
          formState.maType
        );
      }
  
      // Update visibility status
      const storedVisibleIds = localStorage.getItem(`marketAreas.${projectId}.visible`);
      let currentVisibleIds = storedVisibleIds ? JSON.parse(storedVisibleIds) : [];
      const marketAreaId = editingMarketArea?.id || savedMarketArea.id;
      
      if (!currentVisibleIds.includes(marketAreaId)) {
        currentVisibleIds.push(marketAreaId);
      }
  
      localStorage.setItem(`marketAreas.${projectId}.visible`, JSON.stringify(currentVisibleIds));
      setVisibleMarketAreaIds(currentVisibleIds);
  
      // Clear editing state
      setEditingMarketArea(null);
  
      // Close the form after a brief delay to ensure state updates
      setTimeout(() => {
        onClose?.();
      }, 100);
  
    } catch (error) {
      console.error("Error saving market area:", error);
      setError(error.message || "Error saving market area");
      toast.error(error.message || "Error saving market area");
    } finally {
      setIsSaving(false);
    }
  };

const handleCancel = useCallback(async () => {
  try {
    // Disable map selection mode
    setIsMapSelectionActive(false);

    // Store the current market areas before clearing (preserve their full state including styles)
    const existingGraphics = selectionGraphicsLayer.graphics
      .filter(g => g.attributes?.marketAreaId && g.attributes.marketAreaId !== editingMarketArea?.id)
      .toArray()
      .map(g => ({
        geometry: g.geometry,
        attributes: g.attributes,
        symbol: g.symbol // Preserve the symbol/style
      }));

    // Remove the temporary editing layer
    if (formState.maType) {
      await removeActiveLayer(formState.maType);
    }

    // Clear graphics layer
    if (selectionGraphicsLayer) {
      selectionGraphicsLayer.removeAll();
      
      // Restore existing market areas with their original styles
      const { default: Graphic } = await import("@arcgis/core/Graphic");
      existingGraphics.forEach(g => {
        const graphic = new Graphic({
          geometry: g.geometry,
          attributes: g.attributes,
          symbol: g.symbol // Restore the original symbol/style
        });
        selectionGraphicsLayer.add(graphic);
      });
    }

    if (editingMarketArea) {
      // Redraw the original market area with its original style settings
      if (editingMarketArea.ma_type === "radius" && editingMarketArea.radius_points) {
        for (const point of editingMarketArea.radius_points) {
          await drawRadius(
            point,
            {
              fillColor: editingMarketArea.style_settings.fillColor,
              fillOpacity: editingMarketArea.style_settings.fillOpacity,
              borderColor: editingMarketArea.style_settings.borderColor,
              borderWidth: editingMarketArea.style_settings.borderWidth
            },
            editingMarketArea.id,
            editingMarketArea.order
          );
        }
      } else if (editingMarketArea.locations?.length > 0) {
        const features = editingMarketArea.locations.map(loc => ({
          geometry: loc.geometry,
          attributes: {
            id: loc.id,
            marketAreaId: editingMarketArea.id,
            order: editingMarketArea.order,
            FEATURE_TYPE: editingMarketArea.ma_type
          }
        }));

        await updateFeatureStyles(
          features,
          {
            fill: editingMarketArea.style_settings.fillColor,
            fillOpacity: editingMarketArea.style_settings.fillOpacity,
            outline: editingMarketArea.style_settings.borderColor,
            outlineWidth: editingMarketArea.style_settings.borderWidth
          },
          editingMarketArea.ma_type
        );
      }
    }

    // Clear editing state
    setEditingMarketArea(null);

    // Close the form
    onClose?.();

  } catch (error) {
    console.error("Error during cancel:", error);
    toast.error("Error cleaning up. Please try again.");
  }
}, [
  clearSelection,
  removeActiveLayer,
  formState.maType,
  editingMarketArea,
  drawRadius,
  updateFeatureStyles,
  setEditingMarketArea,
  onClose,
  selectionGraphicsLayer
]);

  // Render JSX
  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      <div className="flex-1 overflow-y-auto p-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Display */}
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          {/* MA Type Selection */}
          <div>
            <label
              htmlFor="maType"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              MA Type {isLayerLoading && "(Loading...)"}
            </label>
            <select
              id="maType"
              value={formState.maType}
              onChange={handleMATypeChange}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 
                       bg-white dark:bg-gray-700 py-2 px-3 shadow-sm focus:border-green-500 
                       focus:outline-none focus:ring-1 focus:ring-green-500 dark:text-white"
              disabled={isLayerLoading || editingMarketArea}
            >
              <option value="">Select type...</option>
              {maTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Market Area Name Section */}
          <div className="space-y-4">
            <div>
              <label
                htmlFor="maName"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                MA Name
              </label>
              <input
                type="text"
                id="maName"
                value={formState.maName}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, maName: e.target.value }))
                }
                placeholder="Enter Market Area Name"
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 
                         bg-white dark:bg-gray-700 py-2 px-3 shadow-sm focus:border-green-500 
                         focus:outline-none focus:ring-1 focus:ring-green-500 dark:text-white"
                required
              />
            </div>

            <div>
              <label
                htmlFor="shortName"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Short Name (Optional)
              </label>
              <input
                type="text"
                id="shortName"
                value={formState.shortName}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    shortName: e.target.value,
                  }))
                }
                placeholder="Enter Short Name"
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 
                         bg-white dark:bg-gray-700 py-2 px-3 shadow-sm focus:border-green-500 
                         focus:outline-none focus:ring-1 focus:ring-green-500 dark:text-white"
              />
            </div>
          </div>

          {/* Style Settings */}
          <div className="space-y-4 p-4 border rounded-md">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              Style Settings
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Fill Color */}
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300">
                  Fill Color
                </label>
                <div className="flex items-center mt-1">
                  <input
                    type="color"
                    value={formState.styleSettings.fillColor}
                    onChange={(e) =>
                      handleStyleChange("fillColor", e.target.value)
                    }
                    className="h-8 w-8 rounded cursor-pointer"
                    disabled={formState.styleSettings.noFill}
                  />
                </div>
                {/* No Fill Checkbox */}
                <div className="flex items-center mt-2">
                  <input
                    type="checkbox"
                    id="noFill"
                    checked={formState.styleSettings.noFill}
                    onChange={(e) =>
                      handleStyleChange("noFill", e.target.checked)
                    }
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="noFill"
                    className="ml-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    No fill
                  </label>
                </div>
              </div>

              {/* Border Color */}
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300">
                  Border Color
                </label>
                <div className="flex items-center mt-1">
                  <input
                    type="color"
                    value={formState.styleSettings.borderColor}
                    onChange={(e) =>
                      handleStyleChange("borderColor", e.target.value)
                    }
                    className="h-8 w-8 rounded cursor-pointer"
                    disabled={formState.styleSettings.noBorder}
                  />
                </div>
                {/* No Border Checkbox */}
                <div className="flex items-center mt-2">
                  <input
                    type="checkbox"
                    id="noBorder"
                    checked={formState.styleSettings.noBorder}
                    onChange={(e) =>
                      handleStyleChange("noBorder", e.target.checked)
                    }
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="noBorder"
                    className="ml-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    No border
                  </label>
                </div>
              </div>
            </div>

            {/* Additional Fields for Transparency and Border Weight */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              {/* Transparency Percentage */}
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300">
                  Transparency %
                </label>
                <div className="flex items-center mt-1">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={(1 - formState.styleSettings.fillOpacity) * 100}
                    onChange={(e) =>
                      handleStyleChange(
                        "fillOpacity",
                        1 - Number(e.target.value) / 100
                      )
                    }
                    className="flex-1"
                    disabled={formState.styleSettings.noFill}
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={Math.round(
                      (1 - formState.styleSettings.fillOpacity) * 100
                    )}
                    onChange={(e) =>
                      handleStyleChange(
                        "fillOpacity",
                        1 - Number(e.target.value) / 100
                      )
                    }
                    className="ml-2 w-16 rounded-md border border-gray-300 dark:border-gray-600
                      bg-white dark:bg-gray-700 py-1 px-2 shadow-sm focus:border-green-500
                      focus:outline-none focus:ring-1 focus:ring-green-500 dark:text-white"
                    disabled={formState.styleSettings.noFill}
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    %
                  </span>
                </div>
              </div>

              {/* Border Weight */}
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300">
                  Border Weight
                </label>
                <div className="flex items-center mt-1">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={formState.styleSettings.borderWidth}
                    onChange={(e) =>
                      handleStyleChange("borderWidth", Number(e.target.value))
                    }
                    className="flex-1"
                    disabled={formState.styleSettings.noBorder}
                  />
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={formState.styleSettings.borderWidth}
                    onChange={(e) =>
                      handleStyleChange("borderWidth", Number(e.target.value))
                    }
                    className="ml-2 w-16 rounded-md border border-gray-300 dark:border-gray-600
                      bg-white dark:bg-gray-700 py-1 px-2 shadow-sm focus:border-green-500
                      focus:outline-none focus:ring-1 focus:ring-green-500 dark:text-white"
                    disabled={formState.styleSettings.noBorder}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Render Radius or Location Selection based on type */}
          {formState.maType === "radius" ? (
            <Radius
              onFormStateChange={(newState) =>
                setRadiusPoints(newState.radiusPoints)
              }
              styleSettings={formState.styleSettings}
              existingRadiusPoints={radiusPoints}
            />
          ) : (
            formState.maType && (
              <>
                {/* Map Selection Toggle */}
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleToggleMapSelection}
                    className={`flex items-center px-4 py-2 rounded-md border 
                               ${
                                 isMapSelectionActive
                                   ? "bg-red-500 text-white border-red-500"
                                   : "bg-green-500 text-white border-green-500"
                               } 
                               hover:bg-opacity-80 focus:outline-none`}
                  >
                    <CursorArrowRaysIcon className="h-5 w-5 mr-2" />
                    {isMapSelectionActive
                      ? "Deactivate Map Selection"
                      : "Activate Map Selection"}
                  </button>
                </div>

                {/* Location Search */}
                <div>
                  <label
                    htmlFor="locationSearch"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Search Locations {formState.isSearching && "(Searching...)"}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="locationSearch"
                      value={formState.locationSearch}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          locationSearch: e.target.value,
                        }))
                      }
                      placeholder={`Search ${formState.maType} locations...`}
                      className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 
                               bg-white dark:bg-gray-700 py-2 pl-10 pr-3 shadow-sm focus:border-green-500 
                               focus:outline-none focus:ring-1 focus:ring-green-500 dark:text-white"
                      disabled={!formState.maType || isLayerLoading}
                    />
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  </div>
                </div>

                {/* Location Selection Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Available Locations */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Available Locations
                      </label>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formState.availableLocations.length} found
                      </span>
                    </div>
                    {/* Available Locations */}
                    <div className="border rounded-md h-72 overflow-y-auto bg-white dark:bg-gray-700">
                      {formState.availableLocations.map((location) => (
                        <div
                          key={`available-${location.id}-${
                            location.feature?.attributes?.FID || ""
                          }`}
                          onClick={() => handleLocationSelect(location)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer
                                  text-sm text-gray-900 dark:text-gray-100"
                        >
                          {location.name}
                        </div>
                      ))}
                      {formState.availableLocations.length === 0 &&
                        !formState.isSearching && (
                          <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                            {formState.locationSearch.length >= 3
                              ? "No locations found"
                              : "Enter at least 3 characters to search"}
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Transfer Arrows */}
                  <div className="flex flex-col justify-center items-center">
                    <ArrowsRightLeftIcon className="h-5 w-5 text-gray-400" />
                  </div>

                  {/* Selected Locations */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Selected Locations
                      </label>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formState.selectedLocations.length} selected
                      </span>
                    </div>
                    {/* Selected Locations */}
                    <div className="border rounded-md h-72 overflow-y-auto bg-white dark:bg-gray-700">
                      {formState.selectedLocations.map((location) => (
                        <div
                          key={`selected-${location.id}-${
                            location.feature?.attributes?.FID || ""
                          }`}
                          onClick={() => handleLocationDeselect(location)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer
                                  text-sm text-gray-900 dark:text-gray-100"
                        >
                          {location.name}
                        </div>
                      ))}
                      {formState.selectedLocations.length === 0 && (
                        <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                          No locations selected
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleCancel} // Updated to use the async handleCancel
              className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700
                       hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600
                       dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500
                       focus:ring-offset-2 disabled:opacity-50"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-md border border-transparent bg-blue-600 text-white
                       hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                       disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                isSaving ||
                (formState.maType === "radius" && radiusPoints.length === 0) ||
                (formState.maType !== "radius" &&
                  formState.selectedLocations.length === 0) ||
                !formState.maName
              }
            >
              {isSaving
                ? "Saving..."
                : editingMarketArea
                ? "Update & Exit"
                : "Save & Exit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
