// src/components/market-areas/MarketAreaForm.jsx

import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { ArrowsRightLeftIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useMap } from "../../contexts/MapContext";
import { useMarketAreas } from "../../contexts/MarketAreaContext";
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
    addActiveLayer, // Explicitly use addActiveLayer
    removeActiveLayer, // Explicitly use removeActiveLayer
    hideAllFeatureLayers, // Added hideAllFeatureLayers
  } = useMap();

  const { addMarketArea, updateMarketArea } = useMarketAreas();

  const [formState, setFormState] = useState({
    maType: editingMarketArea?.ma_type || "",
    maName: editingMarketArea?.name || "",
    shortName: editingMarketArea?.short_name || "",
    locationSearch: "",
    availableLocations: [],
    selectedLocations: editingMarketArea?.locations || [],
    isSearching: false,
    styleSettings: editingMarketArea?.style_settings || {
      fillColor: "#0078D4",
      fillOpacity: 0.3,
      borderColor: "#0078D4",
      borderWidth: 2,
    },
  });

  const [radiusPoints, setRadiusPoints] = useState(editingMarketArea?.radius_points || []);
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

  // Initialize form if editing
  useEffect(() => {
    const initializeForm = async () => {
      if (editingMarketArea) {
        if (editingMarketArea.ma_type === 'radius') {
          setRadiusPoints(editingMarketArea.radius_points);
        } else {
          await addActiveLayer(editingMarketArea.ma_type); // Use addActiveLayer instead of setActiveLayerType
          editingMarketArea.locations.forEach(location => {
            addToSelection({
              geometry: location.geometry,
              attributes: { id: location.id }
            });
          });
        }
      }
    };

    initializeForm();
  }, [editingMarketArea, addActiveLayer, addToSelection]);

  // Style update handler
  const updateStyles = useCallback(() => {
    const { fillColor, fillOpacity, borderColor, borderWidth } = formState.styleSettings;

    if (formState.maType === "radius") {
      clearSelection();
      radiusPoints.forEach((point) => {
        drawRadius(point, formState.styleSettings);
      });
    } else {
      const features = formState.selectedLocations.map((loc) => loc.feature);
      updateFeatureStyles(features, {
        fill: fillColor,
        fillOpacity,
        outline: borderColor,
        outlineWidth: borderWidth,
      });
    }
  }, [
    formState.styleSettings,
    formState.selectedLocations,
    radiusPoints,
    formState.maType,
    updateFeatureStyles,
    drawRadius,
    clearSelection,
  ]);

  // Handle style changes
  useEffect(() => {
    updateStyles();
  }, [formState.styleSettings, updateStyles]);

  const handleMATypeChange = async (e) => {
    const newType = e.target.value;

    setFormState((prev) => ({
      ...prev,
      maType: newType,
      locationSearch: "",
      availableLocations: [],
      selectedLocations: [],
    }));

    setRadiusPoints([]);
    setError(null);

    clearSelection();
    if (newType === "radius") {
      await removeActiveLayer(); // Remove any active layers if switching to radius
    } else {
      await addActiveLayer(newType); // Add the selected layer type
    }
  };

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
          }));

          setFormState((prev) => ({
            ...prev,
            availableLocations: mappedResults.filter(
              (loc) => !prev.selectedLocations.some((sel) => sel.id === loc.id)
            ),
          }));
        } catch (error) {
          console.error("Search error:", error);
          setError("Error searching locations");
        } finally {
          setFormState((prev) => ({ ...prev, isSearching: false }));
        }
      }
    }, 300);

    return () => clearTimeout(searchTimer);
  }, [formState.locationSearch, formState.maType, queryFeatures]);

  const formatLocationName = (feature) => {
    const attrs = feature.attributes;
    switch (formState.maType) {
      case "zip":
        return `${attrs.ZIP || ""} - ${attrs.PO_NAME || ""}`;
      case "county":
        return `${attrs.NAME} County, ${attrs.STATE_NAME || ""}`;
      case "tract":
        return `Tract ${attrs.NAME}, ${attrs.COUNTY} County, ${attrs.STATE}`;
      case "block":
        return `Block ${attrs.BLOCK}, Tract ${attrs.TRACT}, ${attrs.COUNTY} County`;
      case "blockgroup":
        return `Block Group ${attrs.BLKGRP}, Tract ${attrs.TRACT}, ${attrs.COUNTY} County`;
      case "cbsa":
        return attrs.NAME;
      case "state":
        return attrs.STATE_NAME;
      default:
        return attrs.NAME || "";
    }
  };

  const handleLocationSelect = useCallback((location) => {
    addToSelection(location.feature);
    setFormState((prev) => ({
      ...prev,
      selectedLocations: [...prev.selectedLocations, location],
      availableLocations: prev.availableLocations.filter(
        (loc) => loc.id !== location.id
      ),
    }));
    updateStyles();
  }, [addToSelection, updateStyles]);

  const handleLocationDeselect = useCallback((location) => {
    removeFromSelection(location.feature);
    setFormState((prev) => ({
      ...prev,
      availableLocations: [...prev.availableLocations, location],
      selectedLocations: prev.selectedLocations.filter(
        (loc) => loc.id !== location.id
      ),
    }));
    updateStyles();
  }, [removeFromSelection, updateStyles]);

  const handleStyleChange = useCallback((type, value) => {
    setFormState((prev) => ({
      ...prev,
      styleSettings: {
        ...prev.styleSettings,
        [type]: value,
      },
    }));
  }, []);

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
        marketAreaData.locations = formState.selectedLocations.map(
          (location) => ({
            id: location.id,
            name: location.name,
            geometry: location.feature.geometry.toJSON(),
          })
        );
        marketAreaData.geometry = {
          type: "MultiPolygon",
          coordinates: formState.selectedLocations.map((loc) =>
            loc.feature.geometry.rings || loc.feature.geometry.coordinates
          ),
        };
      }

      let savedMarketArea;
      if (editingMarketArea) {
        savedMarketArea = await updateMarketArea(
          projectId,
          editingMarketArea.id,
          marketAreaData
        );
      } else {
        savedMarketArea = await addMarketArea(projectId, marketAreaData);
      }

      // Clear existing selections but keep graphics
      clearSelection();

      // Hide all feature layers but keep graphics
      hideAllFeatureLayers();

      // Immediately display the saved market area
      if (formState.maType === "radius") {
        radiusPoints.forEach((point) => {
          drawRadius(point, formState.styleSettings);
        });
      } else {
        const features = marketAreaData.locations.map((loc) => ({
          geometry: loc.geometry,
          attributes: { id: loc.id },
        }));

        updateFeatureStyles(features, {
          fill: formState.styleSettings.fillColor,
          fillOpacity: formState.styleSettings.fillOpacity,
          outline: formState.styleSettings.borderColor,
          outlineWidth: formState.styleSettings.borderWidth,
        });
      }

      onClose();
    } catch (error) {
      console.error("Error saving market area:", error);
      setError(error.response?.data?.detail || "Error saving market area");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async () => {
    clearSelection();
    if (formState.maType !== "radius") {
      await removeActiveLayer(); // Remove the layer if not radius
    }
    onClose();
  };

  useEffect(() => {
    return () => {
      clearSelection();
    };
  }, [clearSelection]);

  const renderContent = () => {
    if (formState.maType === "radius") {
      return (
        <Radius
          onFormStateChange={(newState) => setRadiusPoints(newState.radiusPoints)}
          styleSettings={formState.styleSettings}
        />
      );
    } else {
      // Existing code for other maTypes
      return (
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
                placeholder={`Search ${formState.maType || ""} locations...`}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 
                         bg-white dark:bg-gray-700 py-2 pl-10 pr-3 shadow-sm focus:border-green-500 
                         focus:outline-none focus:ring-1 focus:ring-green-500 dark:text-white"
                disabled={!formState.maType || isLayerLoading}
              />
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            </div>
          </div>

          {/* Locations Grid */}
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
              <div
                className="border border-gray-200 dark:border-gray-700 rounded-md h-72 overflow-y-auto 
                          bg-white dark:bg-gray-700"
              >
                {formState.availableLocations.map((location) => (
                  <div
                    key={location.id}
                    onClick={() => handleLocationSelect(location)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm 
                             text-gray-900 dark:text-gray-100"
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
            <div className="flex flex-col justify-center items-center gap-2">
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
              <div
                className="border border-gray-200 dark:border-gray-700 rounded-md h-72 overflow-y-auto 
                          bg-white dark:bg-gray-700"
              >
                {formState.selectedLocations.map((location) => (
                  <div
                    key={location.id}
                    onClick={() => handleLocationDeselect(location)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm 
                             text-gray-900 dark:text-gray-100 flex justify-between items-center"
                  >
                    <span>{location.name}</span>
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
      );
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      <div className="flex-1 overflow-y-auto p-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          {/* MA Type */}
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
              disabled={isLayerLoading}
            >
              <option value="">Select type...</option>
              {maTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Basic Info */}
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

          {/* Conditional Content */}
          {renderContent()}

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleCancel}
              className={`px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 
                         dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 
                         focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                           isSaving ? "opacity-50 cursor-not-allowed" : ""
                         }`}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-4 py-2 rounded-md border border-transparent bg-blue-600 text-white hover:bg-blue-700 
                         dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 
                         focus:ring-offset-2 ${
                           isSaving ||
                           (formState.maType === "radius" && radiusPoints.length === 0) ||
                           (formState.maType !== "radius" &&
                             formState.selectedLocations.length === 0) ||
                           !formState.maName
                             ? "opacity-50 cursor-not-allowed"
                             : ""
                         }`}
              disabled={
                isSaving ||
                (formState.maType === "radius" && radiusPoints.length === 0) ||
                (formState.maType !== "radius" &&
                  formState.selectedLocations.length === 0) ||
                !formState.maName
              }
            >
              {isSaving ? "Saving..." : "Save & Exit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
