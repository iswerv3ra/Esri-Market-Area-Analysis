import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowsRightLeftIcon,
  MagnifyingGlassIcon,
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
    updateFeatureStyles,
    drawRadius,
    addActiveLayer,
    removeActiveLayer,
    hideAllFeatureLayers,
    featureLayers,
  } = useMap();

  const { addMarketArea, updateMarketArea } = useMarketAreas();

  // Initialize form state with proper structure for both new and edited market areas
  const [formState, setFormState] = useState({
    maType: editingMarketArea?.ma_type || "",
    maName: editingMarketArea?.name || "",
    shortName: editingMarketArea?.short_name || "",
    locationSearch: "",
    availableLocations: [],
    selectedLocations: [], // Will be populated in useEffect for editing
    isSearching: false,
    styleSettings: editingMarketArea?.style_settings || {
      fillColor: "#0078D4",
      fillOpacity: 0.3,
      borderColor: "#0078D4",
      borderWidth: 2,
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

  // Enhanced initialization effect for editing
  useEffect(() => {
    const initializeForm = async () => {
      if (!editingMarketArea) return;

      try {
        // Clear any existing state
        await clearSelection();
        await hideAllFeatureLayers();

        if (editingMarketArea.ma_type === "radius") {
          setRadiusPoints(
            editingMarketArea.radius_points.map((point) => ({
              ...point,
              center: {
                ...point.center,
                spatialReference: { wkid: 4326 },
              },
            }))
          );
        } else {
          // For non-radius types, initialize the feature layer and selections
          await addActiveLayer(editingMarketArea.ma_type);

          // Transform locations into the correct format for the form
          const transformedLocations = editingMarketArea.locations.map(
            (location) => ({
              id: location.id,
              name: location.name,
              geometry: location.geometry,
              // Create a feature-like structure for compatibility
              feature: {
                geometry: location.geometry,
                attributes: {
                  id: location.id,
                  name: location.name,
                },
              },
            })
          );

          setFormState((prev) => ({
            ...prev,
            selectedLocations: transformedLocations,
          }));

          // Visualize the existing locations
          const features = transformedLocations.map((loc) => ({
            geometry: loc.geometry,
            attributes: { id: loc.id },
          }));

          updateFeatureStyles(
            features,
            editingMarketArea.style_settings,
            editingMarketArea.ma_type
          );
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
    clearSelection,
    hideAllFeatureLayers,
    updateFeatureStyles,
  ]);
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
            id: loc.id,
            name: loc.name,
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
  ]);

  // Apply style changes when they are updated
  useEffect(() => {
    updateStyles();
  }, [formState.styleSettings, updateStyles]);

  // Enhanced MA Type change handler
  const handleMATypeChange = async (e) => {
    const newType = e.target.value;
    
    try {
      // First hide all feature layers and clear selections
      await clearSelection();
      await hideAllFeatureLayers();
      await removeActiveLayer(); // Make sure to remove any active layer first
      
      setFormState((prev) => ({
        ...prev,
        maType: newType,
        locationSearch: "",
        availableLocations: [],
        selectedLocations: [],
      }));
      
      setRadiusPoints([]);
      setError(null);
  
      // Only add and show the new layer if it's not a radius type and a type is selected
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
  };

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
          const mappedResults = results.map((feature) => ({
            id: feature.attributes.OBJECTID || feature.attributes.FID,
            name: formatLocationName(feature),
            feature: feature,
            geometry: feature.geometry,
          }));

          setFormState((prev) => ({
            ...prev,
            availableLocations: mappedResults.filter(
              (loc) => !prev.selectedLocations.some((sel) => sel.id === loc.id)
            ),
            isSearching: false,
          }));
        } catch (error) {
          console.error("Search error:", error);
          toast.error("Error searching locations");
          setError("Error searching locations");
          setFormState((prev) => ({ ...prev, isSearching: false }));
        }
      }
    }, 300);

    return () => clearTimeout(searchTimer);
  }, [formState.locationSearch, formState.maType, queryFeatures]);

  // Enhanced location handling
  const handleLocationSelect = useCallback(
    (location) => {
      try {
        addToSelection(location.feature);
        setFormState((prev) => ({
          ...prev,
          selectedLocations: [
            ...prev.selectedLocations,
            {
              ...location,
              geometry: location.feature.geometry,
            },
          ],
          availableLocations: prev.availableLocations.filter(
            (loc) => loc.id !== location.id
          ),
        }));
        updateStyles();
      } catch (error) {
        console.error("Error selecting location:", error);
        toast.error("Failed to select location");
      }
    },
    [addToSelection, updateStyles]
  );

  const handleLocationDeselect = useCallback(
    (location) => {
      try {
        removeFromSelection(location.feature);
        setFormState((prev) => ({
          ...prev,
          availableLocations: [...prev.availableLocations, location],
          selectedLocations: prev.selectedLocations.filter(
            (loc) => loc.id !== location.id
          ),
        }));
        updateStyles();
      } catch (error) {
        console.error("Error deselecting location:", error);
        toast.error("Failed to deselect location");
      }
    },
    [removeFromSelection, updateStyles]
  );

  // Style change handler
  const handleStyleChange = useCallback((type, value) => {
    setFormState((prev) => ({
      ...prev,
      styleSettings: {
        ...prev.styleSettings,
        [type]: value,
      },
    }));
  }, []);
  // Enhanced submit handler with better error handling
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const marketAreaData = {
        ma_type: formState.maType,
        name: formState.maName,
        short_name: formState.shortName,
        style_settings: formState.styleSettings,
        locations: null,
        radius_points: null,
        geometry: null,
      };

      if (formState.maType === "radius") {
        marketAreaData.radius_points = radiusPoints;
        marketAreaData.geometry = {
          type: "MultiPolygon",
          coordinates: radiusPoints.map((point) => point.geometry.rings),
        };
      } else {
        // Handle both new and edited locations
        marketAreaData.locations = formState.selectedLocations.map(
          (location) => ({
            id: location.id,
            name: location.name,
            geometry: location.geometry || location.feature.geometry.toJSON(),
          })
        );

        marketAreaData.geometry = {
          type: "MultiPolygon",
          coordinates: marketAreaData.locations.map((loc) => {
            const geom = loc.geometry.rings || loc.geometry.coordinates;
            return Array.isArray(geom) ? geom : [geom];
          }),
        };
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

      // Clear existing selections but keep graphics
      clearSelection();
      hideAllFeatureLayers();

      // Display the saved market area
      if (formState.maType === "radius") {
        radiusPoints.forEach((point) => {
          drawRadius(point, formState.styleSettings);
        });
      } else {
        const features = marketAreaData.locations.map((loc) => ({
          geometry: loc.geometry,
          attributes: { id: loc.id },
        }));

        updateFeatureStyles(
          features,
          {
            fill: formState.styleSettings.fillColor,
            fillOpacity: formState.styleSettings.fillOpacity,
            outline: formState.styleSettings.borderColor,
            outlineWidth: formState.styleSettings.borderWidth,
          },
          formState.maType
        );
      }

      onClose();
    } catch (error) {
      console.error("Error saving market area:", error);
      const errorMessage =
        error.response?.data?.detail ||
        error.message ||
        "Error saving market area";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async () => {
    try {
      await clearSelection();
      await hideAllFeatureLayers();
      await removeActiveLayer(); // Make sure to remove the active layer
      onClose();
    } catch (error) {
      console.error("Error during cancel:", error);
      toast.error("Error cleaning up. Please try again.");
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    // Cleanup function when component unmounts
    return () => {
      clearSelection();
      hideAllFeatureLayers();
      removeActiveLayer();
    };
  }, [clearSelection, hideAllFeatureLayers, removeActiveLayer]);

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

          {/* Style Controls */}
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
                  />
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
                  />
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={formState.styleSettings.borderWidth}
                    onChange={(e) =>
                      handleStyleChange("borderWidth", Number(e.target.value))
                    }
                    className="ml-2 flex-1"
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
            />
          ) : (
            formState.maType && (
              <>
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
