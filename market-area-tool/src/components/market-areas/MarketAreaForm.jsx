// src/components/market-areas/MarketAreaForm.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useMap } from "../../contexts/MapContext";
import { useMarketAreas } from "../../contexts/MarketAreaContext";
import { toast } from "react-hot-toast";
import Radius from "./Radius";
import { FEATURE_LAYERS } from "../../contexts/MapContext";
import { StyleSettingsPanel } from "./StyleSettingsPanel";
import ThemeSelector from "./ThemeSelector";

const defaultStyleSettings = {
  fillColor: "#0078D4",
  fillOpacity: 0.35,
  borderColor: "#0078D4",
  borderWidth: 3,
  excelFill: "#ffffff",
  excelText: "#000000",
  noFill: false,
  noBorder: false,
};

export default function MarketAreaForm({ onClose, editingMarketArea = null }) {
  const { projectId } = useParams();
  const { addMarketArea, updateMarketArea, deleteMarketArea } =
    useMarketAreas();
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
      setVisibleMarketAreaIds,
      setEditingMarketArea,
      selectionGraphicsLayer,
      mapView,
      featureLayers: featureLayersRef,  // Alias featureLayers as featureLayersRef
    } = useMap();

  const initializationDone = useRef(false);
  const locationsInitialized = useRef(false);

  const mergedStyle = {
    ...defaultStyleSettings,
    ...(editingMarketArea?.style_settings || {}),
  };

  const [formState, setFormState] = useState({
    maType: editingMarketArea?.ma_type || "",
    maName: editingMarketArea?.name || "",
    shortName: editingMarketArea?.short_name || "",
    locationSearch: "",
    availableLocations: [],
    selectedLocations: [],
    isSearching: false,
    styleSettings: {
      ...mergedStyle,
      noBorder: mergedStyle.borderWidth === 0,
      noFill: mergedStyle.fillOpacity === 0,
    },
  });

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
    { value: "md", label: "Metro Division" },
  ];

  useEffect(() => {
    // Always have map selection active
    setIsMapSelectionActive(true);
  }, [setIsMapSelectionActive]);

  useEffect(() => {
    if (!editingMarketArea) clearSelection();
  }, [editingMarketArea, clearSelection]);

  // Initialize the form if we are in "edit" mode
  useEffect(() => {
    const initializeForm = async () => {
      if (!editingMarketArea || initializationDone.current) return;
      initializationDone.current = true;

      try {
        // Non-radius area
        if (editingMarketArea.ma_type !== "radius") {
          await addActiveLayer(editingMarketArea.ma_type);

          // If it has locations already
          if (
            editingMarketArea.locations?.length > 0 &&
            !locationsInitialized.current
          ) {
            locationsInitialized.current = true;

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
                (f) =>
                  formatLocationName(f, editingMarketArea.ma_type).trim() !== ""
              );

            // Update form state
            setFormState((prev) => ({
              ...prev,
              maType: editingMarketArea.ma_type,
              maName: editingMarketArea.name,
              shortName: editingMarketArea.short_name,
              styleSettings: {
                ...prev.styleSettings,
                // Overwrite with the editing area’s style settings,
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

            // Update map with this area’s style
            await updateFeatureStyles(
              features,
              editingMarketArea.style_settings,
              editingMarketArea.ma_type
            );
          }
        } else {
          // Radius area
          if (editingMarketArea.radius_points?.length > 0) {
            setFormState((prev) => ({
              ...prev,
              maType: editingMarketArea.ma_type,
              maName: editingMarketArea.name,
              shortName: editingMarketArea.short_name,
              styleSettings: {
                ...prev.styleSettings,
                ...editingMarketArea.style_settings,
                noBorder: editingMarketArea.style_settings?.borderWidth === 0,
                noFill: editingMarketArea.style_settings?.fillOpacity === 0,
              },
            }));

            setRadiusPoints(editingMarketArea.radius_points);

            // Draw the radius(es)
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
      } catch (err) {
        console.error("Error initializing form for editing:", err);
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

  const updateStyles = useCallback(() => {
    try {
      const { fillColor, fillOpacity, borderColor, borderWidth } =
        formState.styleSettings;

      if (formState.maType === "radius") {
        // Clear existing radius graphics first
        if (selectionGraphicsLayer) {
          const radiusGraphics = selectionGraphicsLayer.graphics.filter(
            (g) => g.attributes?.FEATURE_TYPE === "radius"
          );
          selectionGraphicsLayer.removeMany(radiusGraphics);
        }

        // Re-draw all radius rings with new style settings
        radiusPoints.forEach((point) => {
          drawRadius(
            point,
            {
              fillColor,
              fillOpacity: formState.styleSettings.noFill ? 0 : fillOpacity,
              borderColor,
              borderWidth: formState.styleSettings.noBorder ? 0 : borderWidth,
            },
            editingMarketArea?.id || "temporary",
            editingMarketArea?.order || 0
          );
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
    } catch (err) {
      console.error("Error updating styles:", err);
      toast.error("Failed to update visualization");
    }
  }, [
    formState.styleSettings,
    formState.selectedLocations,
    formState.maType,
    radiusPoints,
    updateFeatureStyles,
    drawRadius,
    editingMarketArea,
  ]);

  useEffect(() => {
    updateStyles();
  }, [formState.styleSettings, radiusPoints, updateStyles]);

  const handleMATypeChange = useCallback(
    async (e) => {
      const newType = e.target.value;
      console.log("Changing to type:", newType); // Debug log
      try {
        clearSelection();
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
            console.log("Adding active layer for:", newType); // Debug log
            await addActiveLayer(newType);
          } catch (err) {
            console.error(`Error initializing layer ${newType}:`, err);
            setError(
              `Failed to initialize ${newType} layer. Please try again.`
            );
          }
        }
      } catch (err) {
        console.error("Error switching market area type:", err);
        toast.error("Failed to switch market area type");
        setError(`Failed to switch to ${newType}. Please try again.`);
      }
    },
    [
      addActiveLayer,
      clearSelection,
      removeActiveLayer,
      formState.maType,
      setError,
    ]
  );

  useEffect(() => {
    const drawRadiusPoints = async () => {
      if (formState.maType === "radius" && radiusPoints.length > 0) {
        const latestPoint = radiusPoints[radiusPoints.length - 1];
        console.log("Drawing radius point:", latestPoint);
  
        try {
          // Normalize the center coordinates
          let centerCoords = {};
          if (latestPoint.center?.longitude !== undefined && latestPoint.center?.latitude !== undefined) {
            centerCoords = {
              x: Number(latestPoint.center.longitude),
              y: Number(latestPoint.center.latitude)
            };
          } else if (latestPoint.center?.x !== undefined && latestPoint.center?.y !== undefined) {
            centerCoords = {
              x: typeof latestPoint.center.x === "function" 
                ? latestPoint.center.x() 
                : Number(latestPoint.center.x),
              y: typeof latestPoint.center.y === "function" 
                ? latestPoint.center.y() 
                : Number(latestPoint.center.y)
            };
          }
  
          // Validate coordinates
          if (isNaN(centerCoords.x) || isNaN(centerCoords.y)) {
            console.error("Invalid radius point coordinates:", centerCoords);
            return;
          }
  
          // Prepare radii
          const radii = Array.isArray(latestPoint.radii) 
            ? latestPoint.radii.map(Number) 
            : [Number(latestPoint.radius || 10)];
  
          const radiusPoint = {
            center: {
              x: centerCoords.x,
              y: centerCoords.y,
              spatialReference: latestPoint.center.spatialReference || { wkid: 102100 }
            },
            radii: radii.filter(r => !isNaN(r) && r > 0),
            units: latestPoint.units || 'miles'
          };
  
          console.log("Transformed radius point for drawing:", radiusPoint);
  
          // Draw the radius
          await drawRadius(
            radiusPoint,
            formState.styleSettings,
            editingMarketArea?.id || "temporary",
            editingMarketArea?.order || 0
          );
        } catch (error) {
          console.error("Comprehensive error drawing radius point:", error);
        }
      }
    };
  
    drawRadiusPoints();
  }, [
    radiusPoints, 
    formState.maType, 
    formState.styleSettings, 
    drawRadius, 
    editingMarketArea
  ]);
  // Searching
  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      if (
        formState.locationSearch.length >= 3 &&
        formState.maType &&
        formState.maType !== "radius"
      ) {
        setFormState((prev) => ({ ...prev, isSearching: true }));
        try {
          const results = await queryFeatures(
            formState.locationSearch,
            formState.maType,
            {
              returnGeometry: true,
              outFields: ["*"],
              spatialRel: "esriSpatialRelIntersects",
              num: 100,
            }
          );

          // In the search effect, modify the mapping:
          const mappedResults = results.map((feature) => {
            const locationName = formatLocationName(feature, formState.maType);
            // Remove the extra state append
            return {
              id: feature.attributes.FID,
              name: locationName, // Just use the formatted name directly
              feature,
              geometry: feature.geometry,
            };
          });

          setFormState((prev) => ({
            ...prev,
            availableLocations: mappedResults,
            isSearching: false,
          }));
        } catch (err) {
          console.error("Search error:", err);
          toast.error("Error searching locations");
          setError("Error searching locations");
          setFormState((prev) => ({ ...prev, isSearching: false }));
        }
      } else if (formState.locationSearch.length < 3) {
        setFormState((prev) => ({
          ...prev,
          availableLocations: [],
          isSearching: false,
        }));
      }
    }, 300);

    return () => clearTimeout(searchTimer);
  }, [
    formState.locationSearch,
    formState.maType,
    formState.selectedLocations,
    queryFeatures,
    formatLocationName,
  ]);

  const handleLocationSelect = useCallback(
    async (location) => {
      try {
        await addToSelection(location.feature, formState.maType);
      } catch (err) {
        console.error("Error selecting location:", err);
        toast.error("Failed to select location");
      }
    },
    [addToSelection, formState.maType]
  );

  // Sync the “selection on the map” back into our form state
  useEffect(() => {
    if (formState.maType === "radius") return;

    const uniqueIdField =
      FEATURE_LAYERS[formState.maType]?.uniqueIdField || "FID";

    setFormState((prev) => {
      const selectedFeatureIds = new Set(
        selectedFeatures.map((f) => f.attributes[uniqueIdField])
      );
      const currentSelectedIds = new Set(
        prev.selectedLocations.map((loc) => loc.id)
      );

      // If the sets match, no update needed
      if (
        selectedFeatureIds.size === currentSelectedIds.size &&
        [...selectedFeatureIds].every((id) => currentSelectedIds.has(id))
      ) {
        return prev;
      }

      // Build final list
      const finalSelectedLocations = [...prev.selectedLocations];

      for (const feature of selectedFeatures) {
        const featureId = feature.attributes[uniqueIdField];
        if (!currentSelectedIds.has(featureId)) {
          const locationName = formatLocationName(feature, formState.maType);
          if (locationName && locationName.trim() !== "") {
            finalSelectedLocations.push({
              id: featureId,
              name: locationName, // Just use the formatted name directly
              feature,
              geometry: feature.geometry,
            });
          }
        }
      }

      const finalSelectedIds = new Set(
        finalSelectedLocations.map((loc) => loc.id)
      );
      const updatedAvailableLocations = prev.availableLocations.filter(
        (loc) => !finalSelectedIds.has(loc.id)
      );

      return {
        ...prev,
        selectedLocations: finalSelectedLocations,
        availableLocations: updatedAvailableLocations,
      };
    });
  }, [selectedFeatures, formState.maType, formatLocationName]);

  const handleLocationDeselect = useCallback(
    (location) => {
      try {
        setFormState((prev) => {
          const updatedSelectedLocations = prev.selectedLocations.filter(
            (loc) => loc.id !== location.id
          );
          return {
            ...prev,
            selectedLocations: updatedSelectedLocations,
          };
        });
        removeFromSelection(location.feature, formState.maType);
        toast.success(`Deselected: ${location.name}`);
      } catch (err) {
        console.error("Error deselecting location:", err);
        toast.error("Failed to deselect location");
      }
    },
    [removeFromSelection, formState.maType]
  );

  // Keep the form state’s style settings updated as user picks them
  const handleStyleChange = useCallback((type, value) => {
    setFormState((prev) => {
      const newStyleSettings = { ...prev.styleSettings };

      if (type === "noBorder") {
        newStyleSettings.noBorder = value;
        if (value) {
          newStyleSettings.borderWidth = 0;
        } else {
          if (newStyleSettings.borderWidth === 0) {
            newStyleSettings.borderWidth = 3;
          }
        }
      } else if (type === "noFill") {
        newStyleSettings.noFill = value;
        if (value) {
          newStyleSettings.fillOpacity = 0;
        } else {
          if (newStyleSettings.fillOpacity === 0) {
            newStyleSettings.fillOpacity = 0.35;
          }
        }
      } else if (type === "fillOpacity") {
        newStyleSettings.fillOpacity = Math.max(0, Math.min(1, value));
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

  // Helper to jump back to the MarketAreaList
  const pressMAListButton = () => {
    const maListBtn = document.getElementById("maListButton");
    if (maListBtn) {
      maListBtn.click();
    }
  };

  useEffect(() => {
    if (!editingMarketArea) {
      clearSelection();

      // Reset form state but preserve style settings
      setFormState((prev) => ({
        ...prev,
        maType: "",
        maName: "",
        shortName: "",
        locationSearch: "",
        availableLocations: [],
        selectedLocations: [],
        // Keep existing style settings instead of reverting to default
        styleSettings: {
          ...prev.styleSettings,
        },
      }));

      // Clear radius points
      setRadiusPoints([]);
    }
  }, [editingMarketArea, clearSelection]);



  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
  
    try {
      // Comprehensive pre-submission validation
      if (!formState.maName || formState.maName.trim() === '') {
        throw new Error("Market Area Name is required");
      }
  
      // Build styleSettings from user's final picks
      const styleSettings = {
        fillColor: formState.styleSettings.fillColor,
        fillOpacity: formState.styleSettings.noFill
          ? 0
          : formState.styleSettings.fillOpacity,
        borderColor: formState.styleSettings.borderColor,
        borderWidth: formState.styleSettings.noBorder
          ? 0
          : formState.styleSettings.borderWidth,
        excelFill: formState.styleSettings.excelFill,
        excelText: formState.styleSettings.excelText,
      };
  
      // If they picked "md" as a type, treat it as "place"
      const mappedType = formState.maType === "md" ? "place" : formState.maType;
  
      // Validate market area type
      if (!formState.maType) {
        throw new Error("Market Area Type must be selected");
      }
  
      // Detailed logging of submission state
      console.group('Market Area Submission');
      console.log("Form state on submit:", formState);
      console.log("Current radius points:", radiusPoints);
  
      if (formState.maType === "radius") {
        // Validate radius points
        if (!radiusPoints || radiusPoints.length === 0) {
          throw new Error("No radius points defined");
        }
  
        // Update the transformedRadiusPoints logic in handleSubmit
        const transformedRadiusPoints = radiusPoints.map((point, index) => {
          try {
            // For points with longitude/latitude
            if (point.center?.longitude !== undefined && point.center?.latitude !== undefined) {
              const longitude = Number(point.center.longitude);
              const latitude = Number(point.center.latitude);
              
              if (isNaN(longitude) || isNaN(latitude)) {
                throw new Error(`Invalid coordinates for radius point ${index}`);
              }
  
              return {
                center: {
                  longitude,
                  latitude,
                  spatialReference: point.center.spatialReference || { wkid: 102100 }
                },
                radii: Array.isArray(point.radii) ? point.radii.map(Number) : [Number(point.radius || 1)],
                units: point.units || 'miles'
              };
            }
  
            // For points with x/y coordinates
            const x = typeof point.center.x === "function" ? point.center.x() : Number(point.center.x);
            const y = typeof point.center.y === "function" ? point.center.y() : Number(point.center.y);
  
            if (isNaN(x) || isNaN(y)) {
              throw new Error(`Invalid coordinates for radius point ${index}`);
            }
  
            return {
              center: {
                x,
                y,
                spatialReference: point.center.spatialReference || { wkid: 102100 }
              },
              radii: Array.isArray(point.radii) ? point.radii.map(Number) : [Number(point.radius || 1)],
              units: point.units || 'miles'
            };
          } catch (error) {
            console.error(`Error transforming point ${index}:`, error);
            throw error;
          }
        });
  
        const marketAreaData = {
          ma_type: "radius",
          name: formState.maName,
          short_name: formState.shortName,
          style_settings: styleSettings,
          locations: [],
          radius_points: transformedRadiusPoints,
        };
  
        // Store existing graphics that we want to keep
        const existingGraphics = selectionGraphicsLayer.graphics
          .filter(
            (g) =>
              g.attributes?.marketAreaId &&
              g.attributes.marketAreaId !== editingMarketArea?.id
          )
          .toArray()
          .map((g) => ({
            geometry: g.geometry,
            attributes: g.attributes,
            symbol: g.symbol,
          }));
  
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
  
        // Turn off map selection temporarily
        setIsMapSelectionActive(false);
  
        // Clear all graphics and selection state
        selectionGraphicsLayer.removeAll();
        clearSelection();
  
        // Reset form state while preserving style settings
        setFormState((prev) => ({
          ...prev,
          maType: "",
          maName: "",
          shortName: "",
          locationSearch: "",
          availableLocations: [],
          selectedLocations: [],
          styleSettings: {
            ...prev.styleSettings,
          },
        }));
  
        // Clear radius points
        setRadiusPoints([]);
  
        // Re-add existing graphics
        const { default: Graphic } = await import("@arcgis/core/Graphic");
        existingGraphics.forEach((g) => {
          const graphic = new Graphic({
            geometry: g.geometry,
            attributes: g.attributes,
            symbol: g.symbol,
          });
          selectionGraphicsLayer.add(graphic);
        });
  
        // Draw the radius(es) with proper styles
        for (const point of marketAreaData.radius_points) {
          await drawRadius(
            point,
            styleSettings,
            savedMarketArea.id,
            savedMarketArea.order
          );
        }
  
        // Handle visibility
        const storedVisibleIds = localStorage.getItem(
          `marketAreas.${projectId}.visible`
        );
        let currentVisibleIds = storedVisibleIds
          ? JSON.parse(storedVisibleIds)
          : [];
        const marketAreaId = editingMarketArea?.id || savedMarketArea.id;
  
        if (!currentVisibleIds.includes(marketAreaId)) {
          currentVisibleIds.push(marketAreaId);
        }
  
        localStorage.setItem(
          `marketAreas.${projectId}.visible`,
          JSON.stringify(currentVisibleIds)
        );
        setVisibleMarketAreaIds(currentVisibleIds);
      } else {
        // Non-radius scenario
        const { default: Query } = await import("@arcgis/core/rest/support/Query");
        const layer = featureLayersRef[formState.maType]; // Remove .current since featureLayersRef is already the current value
  
        // Get high resolution geometries first
        const highResLocations = await Promise.all(
          formState.selectedLocations.map(async (loc) => {
            if (!layer) return loc;
  
            try {
              const query = new Query({
                where: `${layer.objectIdField || 'OBJECTID'} = ${loc.id}`,
                returnGeometry: true,
                outSpatialReference: mapView.spatialReference,
                maxAllowableOffset: 0,
                geometryPrecision: 8
              });
  
              let result;
              if (Array.isArray(layer.featureLayers)) {
                const results = await Promise.all(
                  layer.featureLayers.map(subLayer => subLayer.queryFeatures(query))
                );
                result = results.find(r => r.features.length > 0);
              } else {
                result = await layer.queryFeatures(query);
              }
  
              if (result?.features[0]) {
                return {
                  ...loc,
                  geometry: result.features[0].geometry
                };
              }
            } catch (error) {
              console.warn('Failed to get high res geometry:', error);
            }
            return loc;
          })
        );
  
        const marketAreaData = {
          ma_type: mappedType,
          name: formState.maName,
          short_name: formState.shortName,
          style_settings: styleSettings,
          locations: highResLocations.map((loc) => ({
            id: loc.id,
            name: loc.name,
            geometry: loc.geometry || loc.feature?.geometry,
          })),
          radius_points: [],
          original_type: formState.maType,
        };
  
        // Store existing graphics that we want to keep
        const existingGraphics = selectionGraphicsLayer.graphics
          .filter(
            (g) =>
              g.attributes?.marketAreaId &&
              g.attributes.marketAreaId !== editingMarketArea?.id
          )
          .toArray()
          .map((g) => ({
            geometry: g.geometry,
            attributes: g.attributes,
            symbol: g.symbol,
          }));
  
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
  
        // Turn off map selection temporarily
        setIsMapSelectionActive(false);
  
        // Prepare current selections with proper styling using high res geometries
        const currentSelections = highResLocations.map((loc) => ({
          geometry: loc.geometry || loc.feature?.geometry,
          attributes: {
            id: loc.id,
            marketAreaId: editingMarketArea?.id || savedMarketArea.id,
            FEATURE_TYPE: formState.maType,
            order: savedMarketArea.order,
          },
        }));
  
        // Remove active layer and clear selections
        if (formState.maType) {
          await removeActiveLayer(formState.maType);
        }
  
        // Clear all graphics and selection state
        selectionGraphicsLayer.removeAll();
        clearSelection();
  
        // Reset form state while preserving style settings
        setFormState((prev) => ({
          ...prev,
          maType: "",
          maName: "",
          shortName: "",
          locationSearch: "",
          availableLocations: [],
          selectedLocations: [],
          styleSettings: {
            ...prev.styleSettings,
          },
        }));
  
        // Re-add existing graphics
        const { default: Graphic } = await import("@arcgis/core/Graphic");
        existingGraphics.forEach((g) => {
          const graphic = new Graphic({
            geometry: g.geometry,
            attributes: g.attributes,
            symbol: g.symbol,
          });
          selectionGraphicsLayer.add(graphic);
        });
  
        // Immediately apply proper styles to new/updated features
        await updateFeatureStyles(
          currentSelections,
          {
            fill: styleSettings.fillColor,
            fillOpacity: styleSettings.fillOpacity,
            outline: styleSettings.borderColor,
            outlineWidth: styleSettings.borderWidth,
          },
          formState.maType,
          true
        );
  
        // Handle visibility
        const storedVisibleIds = localStorage.getItem(
          `marketAreas.${projectId}.visible`
        );
        let currentVisibleIds = storedVisibleIds
          ? JSON.parse(storedVisibleIds)
          : [];
        const marketAreaId = editingMarketArea?.id || savedMarketArea.id;
  
        if (!currentVisibleIds.includes(marketAreaId)) {
          currentVisibleIds.push(marketAreaId);
        }
  
        localStorage.setItem(
          `marketAreas.${projectId}.visible`,
          JSON.stringify(currentVisibleIds)
        );
        setVisibleMarketAreaIds(currentVisibleIds);
      }
  
      // Common cleanup
      setEditingMarketArea(null);
      onClose?.();
      pressMAListButton();
    } catch (err) {
      console.error("Error saving market area:", err);
      setError(err.message || "Error saving market area");
      toast.error(err.message || "Error saving market area");
    } finally {
      setIsSaving(false);
    }
  };


  const handleCancel = useCallback(async () => {
    try {
      // Clear active layer if exists
      if (formState.maType) {
        await removeActiveLayer(formState.maType);
      }
  
      // Store existing graphics that we want to keep (market area graphics only)
      const existingGraphics = selectionGraphicsLayer.graphics
        .filter((g) => {
          // Keep only if:
          // 1. Has a marketAreaId
          // 2. Not from the currently editing market area
          // 3. Not a temporary graphic
          return (
            g.attributes?.marketAreaId &&
            g.attributes.marketAreaId !== editingMarketArea?.id &&
            !g.attributes?.isTemporary &&
            g.attributes.marketAreaId !== "temporary" &&
            g.attributes.marketAreaId !== "temp"
          );
        })
        .toArray()
        .map((g) => ({
          geometry: g.geometry,
          attributes: g.attributes,
          symbol: g.symbol,
        }));
  
      // Clear ALL graphics first
      if (selectionGraphicsLayer) {
        selectionGraphicsLayer.removeAll();
        
        // Restore only the filtered graphics
        const { default: Graphic } = await import("@arcgis/core/Graphic");
        existingGraphics.forEach((g) => {
          const graphic = new Graphic({
            geometry: g.geometry,
            attributes: g.attributes,
            symbol: g.symbol,
          });
          selectionGraphicsLayer.add(graphic);
        });
      }
  
      // If we were editing, re-draw that area's original style
      if (editingMarketArea) {
        if (
          editingMarketArea.ma_type === "radius" &&
          editingMarketArea.radius_points
        ) {
          for (const point of editingMarketArea.radius_points) {
            await drawRadius(
              point,
              {
                fillColor: editingMarketArea.style_settings.fillColor,
                fillOpacity: editingMarketArea.style_settings.fillOpacity,
                borderColor: editingMarketArea.style_settings.borderColor,
                borderWidth: editingMarketArea.style_settings.borderWidth,
              },
              editingMarketArea.id,
              editingMarketArea.order
            );
          }
        } else if (editingMarketArea.locations?.length > 0) {
          const features = editingMarketArea.locations.map((loc) => ({
            geometry: loc.geometry,
            attributes: {
              id: loc.id,
              marketAreaId: editingMarketArea.id,
              order: editingMarketArea.order,
              FEATURE_TYPE: editingMarketArea.ma_type,
            },
          }));
          await updateFeatureStyles(
            features,
            {
              fill: editingMarketArea.style_settings.fillColor,
              fillOpacity: editingMarketArea.style_settings.fillOpacity,
              outline: editingMarketArea.style_settings.borderColor,
              outlineWidth: editingMarketArea.style_settings.borderWidth,
            },
            editingMarketArea.ma_type
          );
        }
      }
  
      // Clear form state
      setFormState((prev) => ({
        ...prev,
        selectedLocations: [],
        locationSearch: "",
        availableLocations: [],
      }));
  
      // Clear any active selections and editing state
      clearSelection();
      setEditingMarketArea(null);
      onClose?.();
  
      // Navigate back to MA list
      const maListBtn = document.getElementById("maListButton");
      if (maListBtn) {
        maListBtn.click();
      }
    } catch (err) {
      console.error("Error during cancel:", err);
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
    selectionGraphicsLayer // Changed from selectionGraphicsLayerRef
  ]);

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

          <StyleSettingsPanel
            styleSettings={formState.styleSettings}
            onStyleChange={handleStyleChange}
          />

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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      className="border rounded-md overflow-y-auto bg-white dark:bg-gray-700"
                      style={{ minHeight: "300px" }}
                    >
                      {formState.availableLocations.map((location, index) => {
                        // Fallback to index-based key if location.id is missing or null
                        const keyVal =
                          location.id != null
                            ? `available-${location.id}`
                            : `available-index-${index}`;

                        return (
                          <div
                            key={keyVal}
                            onClick={() => handleLocationSelect(location)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm text-gray-900 dark:text-gray-100"
                          >
                            {location.name}
                          </div>
                        );
                      })}
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
                      className="border rounded-md overflow-y-auto bg-white dark:bg-gray-700"
                      style={{ minHeight: "300px" }}
                    >
                      {formState.selectedLocations.map((location, index) => {
                        const keyVal =
                          location.id != null
                            ? `selected-${location.id}`
                            : `selected-index-${index}`;

                        return (
                          <div
                            key={keyVal}
                            onClick={() => handleLocationDeselect(location)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm text-gray-900 dark:text-gray-100"
                          >
                            {location.name}
                          </div>
                        );
                      })}
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
        </form>
      </div>
      {/* Right-aligned container with centered buttons */}
      <div className="sticky bottom-4 flex items-center justify-center w-full max-w-md ml-auto pr-4 gap-3 z-10">
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700
                   hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600
                   dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500
                   focus:ring-offset-2 disabled:opacity-50 shadow-lg"
          disabled={isSaving}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 rounded-md border border-transparent bg-blue-600 text-white
                   hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                   disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
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
    </div>
  );
}
