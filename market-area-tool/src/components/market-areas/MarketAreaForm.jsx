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

export default function MarketAreaForm({ onClose, editingMarketArea = null }) {
  const { projectId } = useParams();
  const {
    isLayerLoading,
    queryFeatures,
    addToSelection,
    removeFromSelection,
    clearSelection,
    hideAllFeatureLayers,
    updateFeatureStyles,
    drawRadius,
    addActiveLayer,
    removeActiveLayer,
    selectedFeatures,
    isMapSelectionActive,
    setIsMapSelectionActive,
    formatLocationName,
  } = useMap();

  const { addMarketArea, updateMarketArea } = useMarketAreas();

  const initializationDone = useRef(false);
  const locationsInitialized = useRef(false);

  const [formState, setFormState] = useState({
    maType: editingMarketArea?.ma_type || "",
    maName: editingMarketArea?.name || "",
    shortName: editingMarketArea?.short_name || "",
    locationSearch: "",
    availableLocations: [],
    selectedLocations: [],
    isSearching: false,
    styleSettings: {
      ...editingMarketArea?.style_settings || {
        fillColor: "#0078D4",
        fillOpacity: 0.3,
        borderColor: "#0078D4",
        borderWidth: 2,
      },
      noBorder:
        editingMarketArea?.style_settings?.borderWidth === -1 || false,
      noFill:
        editingMarketArea?.style_settings?.fillOpacity === 0 || false,
    },
  });

  const [radiusPoints, setRadiusPoints] = useState([]);
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

  // Watch for selected features from map clicks
  useEffect(() => {
    if (!selectedFeatures.length || formState.maType === "radius") return;
  
    setFormState((prev) => {
      const deselectedLocations = [];
      const remainingSelectedLocations = [];
  
      prev.selectedLocations.forEach((loc) => {
        const isDeselected = selectedFeatures.some(
          (feature) => feature.attributes.FID === loc.id
        );
  
        if (isDeselected) {
          deselectedLocations.push(loc);
        } else {
          remainingSelectedLocations.push(loc);
        }
      });
  
      const newSelectedLocations = selectedFeatures
        .filter(
          (feature) =>
            !prev.selectedLocations.some(
              (loc) => loc.id === feature.attributes.FID
            )
        )
        .map((feature) => ({
          id: feature.attributes.FID,
          name: formatLocationName(feature, formState.maType),
          feature: feature,
          geometry: feature.geometry,
        }));
  
      return {
        ...prev,
        selectedLocations: [...remainingSelectedLocations, ...newSelectedLocations],
        availableLocations: [
          ...prev.availableLocations,
          ...deselectedLocations,
        ].sort((a, b) => a.name.localeCompare(b.name)), // Sort optional
      };
    });
  
    // Update the map visuals
    selectedFeatures.forEach((feature) => {
      const featureId = feature.attributes.FID;
      const isDeselected = formState.selectedLocations.some(
        (loc) => loc.id === featureId
      );
  
      if (isDeselected) {
        removeFromSelection(feature, formState.maType);
        toast.success(
          `Deselected: ${formatLocationName(feature, formState.maType)}`
        );
      } else {
        addToSelection(feature, formState.maType);
        toast.success(
          `Selected: ${formatLocationName(feature, formState.maType)}`
        );
      }
    });
  }, [
    selectedFeatures,
    formState.maType,
    addToSelection,
    removeFromSelection,
    formatLocationName,
  ]);
  

  // Enhanced initialization effect for editing
  useEffect(() => {
    const initializeForm = async () => {
      // Skip if already initialized or no editing market area
      if (!editingMarketArea || initializationDone.current) return;
  
      console.log("Initializing form with:", editingMarketArea);
  
      try {
        // Mark as initialized immediately
        initializationDone.current = true;
  
        // Clear existing selections and hide all layers
        clearSelection();
        hideAllFeatureLayers();
  
        if (editingMarketArea.ma_type !== "radius") {
          await addActiveLayer(editingMarketArea.ma_type);
  
          if (
            editingMarketArea.locations?.length > 0 &&
            !locationsInitialized.current
          ) {
            locationsInitialized.current = true;
  
            // Create proper feature objects from saved locations
            const features = editingMarketArea.locations
              .map((loc) => ({
                geometry: loc.geometry,
                attributes: {
                  FID: loc.id,
                  NAME: loc.name,
                },
              }))
              .filter(
                (feature) =>
                  formatLocationName(feature, editingMarketArea.ma_type).trim() !== ""
              ); // Filter out invalid features
  
            // Update form state first
            setFormState((prev) => ({
              ...prev,
              maType: editingMarketArea.ma_type,
              maName: editingMarketArea.name,
              shortName: editingMarketArea.short_name,
              styleSettings: {
                ...editingMarketArea.style_settings,
                noBorder:
                  editingMarketArea.style_settings?.borderWidth === -1,
                noFill:
                  editingMarketArea.style_settings?.fillOpacity === 0,
              },
              selectedLocations: editingMarketArea.locations
                .filter(
                  (loc) =>
                    loc.name && loc.name.trim() !== ""
                )
                .map((loc) => ({
                  id: loc.id,
                  name: loc.name,
                  geometry: loc.geometry,
                  feature: {
                    geometry: loc.geometry,
                    attributes: {
                      FID: loc.id,
                      NAME: loc.name,
                    },
                  },
                })),
            }));
  
            // Then update visuals in a single batch
            await updateFeatureStyles(
              features,
              editingMarketArea.style_settings,
              editingMarketArea.ma_type
            );
  
            // Finally add to selection only valid features
            features.forEach((feature) => {
              const name = formatLocationName(
                feature,
                editingMarketArea.ma_type
              );
              if (name && name.trim() !== "") {
                addToSelection(feature, editingMarketArea.ma_type);
              }
            });
          }
        }
        // Handle "radius" type if necessary
        else if (editingMarketArea.ma_type === "radius") {
          // Implement radius-specific initialization if needed
          if (
            editingMarketArea.radius_points &&
            editingMarketArea.radius_points.length > 0
          ) {
            editingMarketArea.radius_points.forEach((point) => {
              drawRadius(point, editingMarketArea.style_settings);
              setRadiusPoints((prev) => [...prev, point]);
            });
          }
        }
      } catch (error) {
        console.error("Error initializing form for editing:", error);
        toast.error("Failed to load market area for editing");
      }
    };
  
    initializeForm();
  
    // No cleanup function needed
  }, [
    editingMarketArea?.id,
    addActiveLayer,
    clearSelection,
    hideAllFeatureLayers,
    updateFeatureStyles,
    addToSelection,
    formatLocationName,
    drawRadius,
  ]);


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setIsMapSelectionActive(false);
      clearSelection();
      hideAllFeatureLayers();
      removeActiveLayer();
    };
  }, [clearSelection, hideAllFeatureLayers, removeActiveLayer, setIsMapSelectionActive]);

  // Style update handler with better error handling
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
        const features = formState.selectedLocations.map((loc) => ({
          geometry: loc.geometry || loc.feature?.geometry,
          attributes: {
            FID: loc.id, // Use "FID" as unique identifier
            name: loc.name,
          },
        }));

        updateFeatureStyles(
          features,
          {
            fill: fillColor,
            fillOpacity,
            outline: borderColor,
            outlineWidth: borderWidth, // Corrected from 'outlineWidth' to 'borderWidth'
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
  ]);

  // Apply style changes when they are updated
  useEffect(() => {
    updateStyles();
  }, [formState.styleSettings, updateStyles]);

  // Enhanced MA Type change handler
  const handleMATypeChange = useCallback(
    async (e) => {
      const newType = e.target.value;

      try {
        setIsMapSelectionActive(false); // Disable map selection first
        clearSelection();
        hideAllFeatureLayers();
        removeActiveLayer();

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
            await addActiveLayer(newType);
          } catch (error) {
            console.error(`Error initializing layer ${newType}:`, error);
            setError(`Failed to initialize ${newType} layer. Please try again.`);
          }
        }
      } catch (error) {
        console.error(`Error switching market area type:`, error);
        toast.error(`Failed to switch market area type`);
        setError(`Failed to switch to ${newType}. Please try again.`);
      }
    },
    [addActiveLayer, clearSelection, hideAllFeatureLayers, removeActiveLayer, setIsMapSelectionActive]
  );

  // Enhanced search handler
  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      if (
        formState.locationSearch.length >= 3 &&
        formState.maType &&
        formState.maType !== "radius"
      ) {
        setFormState((prev) => ({ ...prev, isSearching: true }));
        try {
          const results = await queryFeatures(formState.locationSearch);
          const mappedResults = results
            .map((feature) => ({
              id: feature.attributes.FID, // Use "FID"
              name: formatLocationName(feature, formState.maType),
              feature: feature,
              geometry: feature.geometry,
            }))
            .filter((loc) => loc.name && loc.name.trim() !== ""); // Filter out invalid names

            setFormState((prev) => ({
              ...prev,
              availableLocations: mappedResults.filter(
                (loc) => !prev.selectedLocations.some((sel) => sel.id === loc.id)
              ),
              isSearching: false,
            }));
          console.log(`[MarketAreaForm] Search results updated:`, mappedResults);
        } catch (error) {
          console.error("Search error:", error);
          toast.error("Error searching locations");
          setError("Error searching locations");
          setFormState((prev) => ({ ...prev, isSearching: false }));
        }
      }
    }, 300);

    return () => clearTimeout(searchTimer);
  }, [formState.locationSearch, formState.maType, queryFeatures, formatLocationName, formState.selectedLocations]);

  // Enhanced location handling
  const handleLocationSelect = useCallback(
    (location) => {
      console.log(`[MarketAreaForm] Selecting location:`, location);
      try {
        addToSelection(location.feature, formState.maType); // Pass layerType
        toast.success(`Selected: ${location.name}`);
      } catch (error) {
        console.error("Error selecting location:", error);
        toast.error("Failed to select location");
      }
    },
    [addToSelection, formState.maType]
  );

  const handleLocationDeselect = useCallback(
    (location) => {
      console.log(`[MarketAreaForm] Deselecting location:`, location);
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

  const handleStyleChange = useCallback(
    (type, value) => {
      setFormState((prev) => {
        const newStyleSettings = { ...prev.styleSettings };

        if (type === "noBorder") {
          newStyleSettings.noBorder = value;
          newStyleSettings.borderWidth = value ? -1 : 2;
        } else if (type === "noFill") {
          newStyleSettings.noFill = value;
          if (value) {
            newStyleSettings.fillOpacity = 0;
            // Optionally, reset fillColor or keep as is
          } else {
            newStyleSettings.fillOpacity = 0.3;
          }
        } else if (type === "fillOpacity") {
          // Ensure value is between 0 and 1
          newStyleSettings.fillOpacity = Math.max(0, Math.min(1, value));
          // If opacity is being set, ensure noFill is false
          if (value > 0) {
            newStyleSettings.noFill = false;
          }
        } else {
          newStyleSettings[type] = value;
        }

        // Immediately trigger style update for the map
        if (formState.maType === "radius") {
          clearSelection();
          radiusPoints.forEach((point) => {
            drawRadius(point, newStyleSettings);
          });
        } else if (formState.selectedLocations.length > 0) {
          const features = formState.selectedLocations.map((loc) => ({
            geometry: loc.geometry || loc.feature?.geometry,
            attributes: {
              FID: loc.id,
              name: loc.name,
            },
          }));

          updateFeatureStyles(
            features,
            {
              fill: newStyleSettings.fillColor,
              fillOpacity: newStyleSettings.fillOpacity,
              outline: newStyleSettings.borderColor,
              outlineWidth: newStyleSettings.borderWidth,
            },
            formState.maType
          );
        }

        return {
          ...prev,
          styleSettings: newStyleSettings,
        };
      });
    },
    [
      formState.maType,
      formState.selectedLocations,
      radiusPoints,
      clearSelection,
      drawRadius,
      updateFeatureStyles,
    ]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const styleSettings = {
        fillColor: formState.styleSettings.fillColor,
        fillOpacity: formState.styleSettings.noFill
          ? 0
          : formState.styleSettings.fillOpacity,
        borderColor: formState.styleSettings.borderColor,
        borderWidth: formState.styleSettings.noBorder
          ? -1
          : formState.styleSettings.borderWidth,
      };

      const marketAreaData = {
        ma_type: formState.maType,
        name: formState.maName,
        short_name: formState.shortName,
        style_settings: styleSettings,
        locations: formState.selectedLocations.map((loc) => ({
          id: loc.id,
          name: loc.name,
          geometry: loc.geometry,
        })),
        radius_points:
          formState.maType === "radius"
            ? radiusPoints.map((point) => ({
                center: point.center,
                radius: point.radius,
                geometry: point.geometry,
              }))
            : null,
        geometry:
          formState.maType === "radius"
            ? {
                type: "MultiPolygon",
                coordinates: radiusPoints.map((point) =>
                  point.geometry?.rings ? point.geometry.rings : []
                ),
              }
            : {
                type: "MultiPolygon",
                coordinates: formState.selectedLocations.map((loc) =>
                  loc.geometry?.rings || []
                ),
              },
      };

      if (
        (formState.maType === "radius" &&
          (!marketAreaData.radius_points ||
            marketAreaData.radius_points.length === 0)) ||
        (formState.maType !== "radius" &&
          (!marketAreaData.locations ||
            marketAreaData.locations.length === 0))
      ) {
        throw new Error("No valid locations to save");
      }

      let savedMarketArea;
      if (editingMarketArea) {
        savedMarketArea = await updateMarketArea(
          projectId,
          editingMarketArea.id,
          marketAreaData
        );
        toast.success("Market area updated successfully");
      } else {
        savedMarketArea = await addMarketArea(projectId, marketAreaData);
        toast.success("Market area created successfully");
      }

      setIsMapSelectionActive(false);
      clearSelection();
      hideAllFeatureLayers();
      removeActiveLayer();

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

  const handleCancel = useCallback(() => {
    try {
      setIsMapSelectionActive(false);
      clearSelection();
      hideAllFeatureLayers();
      removeActiveLayer();
      setFormState((prev) => ({
        ...prev,
        maType: "",
        locationSearch: "",
        availableLocations: [],
        selectedLocations: [],
      }));
      setRadiusPoints([]);
      setError(null);
      setTimeout(() => {
        onClose?.();
      }, 100);
    } catch (error) {
      console.error("Error during cancel:", error);
      toast.error("Error cleaning up. Please try again.");
    }
  }, [clearSelection, hideAllFeatureLayers, removeActiveLayer, setIsMapSelectionActive]);

  // Cleanup on unmount
  useEffect(() => {
    // Cleanup when component unmounts
    return () => {
      setIsMapSelectionActive(false);
      clearSelection();
      hideAllFeatureLayers();
      removeActiveLayer();
    };
  }, [clearSelection, hideAllFeatureLayers, removeActiveLayer, setIsMapSelectionActive]);

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
                  <h3 className="text-sm font-medium text-red-800">
                    {error}
                  </h3>
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

          <div className="space-y-4 p-4 border rounded-md">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              Style Settings
            </h3>
            <div className="grid grid-cols-2 gap-4">
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
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formState.styleSettings.fillOpacity * 100}
                    onChange={(e) =>
                      handleStyleChange(
                        "fillOpacity",
                        Number(e.target.value) / 100
                      )
                    }
                    className="ml-2 flex-1"
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
                  <input
                    type="range"
                    min="-1"
                    max="5"
                    value={formState.styleSettings.borderWidth}
                    onChange={(e) =>
                      handleStyleChange("borderWidth", Number(e.target.value))
                    }
                    className="ml-2 flex-1"
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
          </div>

          {/* Render Radius or Location Selection based on type */}
          {formState.maType === "radius" ? (
            <Radius
              onFormStateChange={(newState) =>
                setRadiusPoints(newState.radiusPoints)
              }
              styleSettings={formState.styleSettings}
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
                    <div className="border rounded-md h-72 overflow-y-auto bg-white dark:bg-gray-700">
                      {formState.availableLocations.map((location) => (
                        <div
                          key={location.id}
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
                    <div className="border rounded-md h-72 overflow-y-auto bg-white dark:bg-gray-700">
                      {formState.selectedLocations.map((location) => (
                        <div
                          key={location.id}
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
              onClick={handleCancel}
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
