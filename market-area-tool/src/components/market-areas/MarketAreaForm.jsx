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
import DriveTime from "./DriveTime";

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
    drawDriveTimePolygon, // Make sure this is available
    calculateDriveTimePolygon, // Make sure this is available
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


  const [driveTimePoints, setDriveTimePoints] = useState(
    editingMarketArea?.drive_time_points || []
  );

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const maTypes = [
    { value: "radius", label: "Radius" },
    { value: "drivetime", label: "Drive Time" }, // Add this line
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
    if (formState.maType === "drive_time" && driveTimePoints.length > 0) {
      console.log("Drawing drive time points from effect:", driveTimePoints);

      try {
        // Apply styling to drive time polygons
        driveTimePoints.forEach(point => {
          if (point.polygon) {
            drawDriveTimePolygon(
              point.polygon,
              {
                fillColor: formState.styleSettings.fillColor,
                fillOpacity: formState.styleSettings.noFill ? 0 : formState.styleSettings.fillOpacity,
                borderColor: formState.styleSettings.borderColor,
                borderWidth: formState.styleSettings.noBorder ? 0 : formState.styleSettings.borderWidth
              },
              editingMarketArea?.id || "temporary",
              editingMarketArea?.order || 0
            );
          }
        });
      } catch (error) {
        console.error("Error drawing drive time points in effect:", error);
        toast.error("Error displaying drive time areas. Please try again.");
      }
    }
  }, [
    driveTimePoints,
    formState.maType,
    formState.styleSettings
  ]);

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
        // Non-radius, non-drivetime area
        if (editingMarketArea.ma_type !== "radius" && editingMarketArea.ma_type !== "drivetime") {
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
                // Overwrite with the editing area's style settings,
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

            // Update map with this area's style
            await updateFeatureStyles(
              features,
              editingMarketArea.style_settings,
              editingMarketArea.ma_type
            );
          }
        }
        else if (editingMarketArea.ma_type === "drivetime") {
          // Drive Time market area
          if (editingMarketArea.drive_time_points?.length > 0) {
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

            // Set drive time points
            let points = editingMarketArea.drive_time_points;
            if (typeof points === 'string') {
              try {
                points = JSON.parse(points);
              } catch (e) {
                console.error("Error parsing drive time points:", e);
                points = [];
              }
            }

            // Ensure points is an array
            if (!Array.isArray(points)) {
              points = [points].filter(Boolean);
            }

            setDriveTimePoints(points);

            // Draw the drive time area(s)
            for (const point of points) {
              if (!point.driveTimePolygon) {
                // If polygon isn't available, calculate it
                try {
                  point.driveTimePolygon = await calculateDriveTimePolygon(point);
                } catch (err) {
                  console.error("Error calculating drive time polygon:", err);
                  continue; // Skip this point if calculation fails
                }
              }

              await drawDriveTimePolygon(
                point,
                editingMarketArea.style_settings,
                editingMarketArea.id,
                editingMarketArea.order
              );
            }
          }
        }
        else {
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
    drawDriveTimePolygon,
    calculateDriveTimePolygon,
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
      }
      else if (formState.maType === "drivetime") {
        // Clear existing drive time graphics first
        if (selectionGraphicsLayer) {
          const driveTimeGraphics = selectionGraphicsLayer.graphics.filter(
            (g) => g.attributes?.FEATURE_TYPE === "drivetime" ||
              g.attributes?.FEATURE_TYPE === "drivetime_point"
          );
          selectionGraphicsLayer.removeMany(driveTimeGraphics);
        }
      
        // Clear the tracking map when updating styles
        drawnDriveTimePointsRef.current.clear();
      
        // Re-draw all drive time areas with new style settings
        if (Array.isArray(driveTimePoints) && driveTimePoints.length > 0) {
          for (const point of driveTimePoints) {
            // Create a unique identifier for this point
            const pointId = generatePointId(point);
            
            // Skip if we've already drawn this exact point
            if (drawnDriveTimePointsRef.current.has(pointId)) {
              continue;
            }
            
            drawDriveTimePolygon(
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
            
            // Mark this point as drawn
            drawnDriveTimePointsRef.current.set(pointId, true);
          }
        }
      }
      else if (formState.selectedLocations.length > 0) {
        // Handle feature-based market areas
        const featureSelection = formState.selectedLocations.map((location) => ({
          geometry: location.geometry,
          attributes: {
            id: location.id,
            marketAreaId: editingMarketArea?.id || 'temporary',
            order: editingMarketArea?.order || 0
          }
        }));
  
        // Update the styles
        updateFeatureStyles(
          featureSelection,
          {
            fill: fillColor,
            fillOpacity: formState.styleSettings.noFill ? 0 : fillOpacity,
            outline: borderColor,
            outlineWidth: formState.styleSettings.noBorder ? 0 : borderWidth,
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
    driveTimePoints,
    updateFeatureStyles,
    drawRadius,
    drawDriveTimePolygon,
    editingMarketArea,
    selectionGraphicsLayer
  ]);


  useEffect(() => {
    updateStyles();
  }, [formState.styleSettings, radiusPoints, driveTimePoints, updateStyles]);

  const drawnDriveTimePointsRef = useRef(new Map());

  useEffect(() => {
    if (formState.maType !== "drivetime" || !Array.isArray(driveTimePoints) || driveTimePoints.length === 0) {
      return;
    }
  
    const drawDriveTimePointsOnce = async () => {
      console.log("Drawing drive time points with tracking:", driveTimePoints.length);
  
      try {
        // Clear existing drive time graphics first to avoid duplicates
        if (selectionGraphicsLayer) {
          const driveTimeGraphics = selectionGraphicsLayer.graphics.filter(
            (g) => g.attributes?.FEATURE_TYPE === "drivetime" ||
                  g.attributes?.FEATURE_TYPE === "drivetime_point"
          );
          
          if (driveTimeGraphics.length > 0) {
            console.log(`Removing ${driveTimeGraphics.length} existing drive time graphics before redrawing`);
            selectionGraphicsLayer.removeMany(driveTimeGraphics);
          }
        }
        
        // Clear the tracking map when we're redrawing all points
        drawnDriveTimePointsRef.current.clear();
  
        // Apply styling to drive time polygons - ensure noFill and noBorder are properly applied
        for (let i = 0; i < driveTimePoints.length; i++) {
          const point = driveTimePoints[i];
          
          // Create a unique identifier for this point
          const pointId = generatePointId(point);
          
          // Skip if we've already drawn this exact point in this rendering cycle
          if (drawnDriveTimePointsRef.current.has(pointId)) {
            console.log(`Skipping duplicate drive time point: ${pointId}`);
            continue;
          }
          
          // Apply the current style settings
          const effectiveStyles = {
            fillColor: formState.styleSettings.fillColor,
            fillOpacity: formState.styleSettings.noFill ? 0 : formState.styleSettings.fillOpacity,
            borderColor: formState.styleSettings.borderColor,
            borderWidth: formState.styleSettings.noBorder ? 0 : formState.styleSettings.borderWidth
          };
          
          // Draw the polygon
          await drawDriveTimePolygon(
            point,
            effectiveStyles,
            editingMarketArea?.id || "temporary",
            editingMarketArea?.order || 0
          );
          
          // Mark this point as drawn
          drawnDriveTimePointsRef.current.set(pointId, true);
          console.log(`Drew drive time point ${i+1}/${driveTimePoints.length} with ID: ${pointId}`);
        }
      } catch (error) {
        console.error("Error drawing drive time points:", error);
        toast.error("Error displaying drive time areas. Please try again.");
      }
    };
  
    drawDriveTimePointsOnce();
    
    // Return a cleanup function
    return () => {
      // When changing market area type or unmounting, clear the tracking
      if (formState.maType !== "drivetime") {
        drawnDriveTimePointsRef.current.clear();
      }
    };
  }, [
    driveTimePoints,
    formState.maType,
    formState.styleSettings,
    drawDriveTimePolygon,
    selectionGraphicsLayer,
    editingMarketArea
  ]);
  
  // Add this helper function to generate a unique ID for each drive time point
  function generatePointId(point) {
    // Get center coordinates
    const center = point.center || {};
    const lon = center.longitude || center.x || 0;
    const lat = center.latitude || center.y || 0;
    
    // Get time range (use first one if it's an array)
    const timeRange = Array.isArray(point.timeRanges) 
      ? point.timeRanges[0] 
      : (point.timeRange || point.travelTimeMinutes || 0);
    
    // Create a string ID that uniquely identifies this point
    return `dt-${lon.toFixed(6)}-${lat.toFixed(6)}-${timeRange}`;
  }

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

  const drawnPointsRef = useRef(new Set());

  useEffect(() => {
    // Enhanced function to draw radius points
    const drawRadiusPoints = async (radiusPoints, styleSettings, marketAreaId, order) => {
      if (!radiusPoints || !Array.isArray(radiusPoints) || radiusPoints.length === 0) {
        console.warn("No radius points to draw");
        return;
      }

      console.log(`Drawing ${radiusPoints.length} radius points with styles:`, styleSettings);

      // Clear existing radius graphics for this market area to avoid duplication
      if (selectionGraphicsLayer) {
        const existingRadiusGraphics = selectionGraphicsLayer.graphics.filter(
          (g) => (
            g.attributes?.FEATURE_TYPE === "radius" &&
            g.attributes?.marketAreaId === (marketAreaId || "temporary")
          )
        );

        if (existingRadiusGraphics.length > 0) {
          console.log(`Removing ${existingRadiusGraphics.length} existing radius graphics before redrawing`);
          selectionGraphicsLayer.removeMany(existingRadiusGraphics);
        }
      }

      // Use a try-catch block around the whole loop to ensure partial completion
      try {
        // Process each point sequentially to avoid race conditions
        for (let i = 0; i < radiusPoints.length; i++) {
          const point = radiusPoints[i];

          try {
            console.log(`Drawing radius point ${i + 1}/${radiusPoints.length}:`, point);

            if (!point || !point.center) {
              console.warn(`Point ${i + 1} has invalid structure:`, point);
              continue; // Skip invalid points
            }

            // Ensure we have a properly formatted point before drawing
            const normalizedPoint = await normalizeRadiusPoint(point);

            if (!normalizedPoint) {
              console.warn(`Point ${i + 1} failed normalization, skipping`);
              continue;
            }

            // Apply current style settings
            const effectiveStyles = {
              fillColor: styleSettings.fillColor,
              fillOpacity: styleSettings.noFill ? 0 : styleSettings.fillOpacity,
              borderColor: styleSettings.borderColor,
              borderWidth: styleSettings.noBorder ? 0 : styleSettings.borderWidth
            };

            // Draw the radius with the normalized point
            await drawRadius(
              normalizedPoint,
              effectiveStyles,
              marketAreaId || "temporary",
              order || 0
            );

            console.log(`Successfully drew radius point ${i + 1}`);
          } catch (err) {
            console.error(`Error drawing radius point ${i + 1}:`, err);
            // Continue with other points instead of failing completely
          }
        }
        console.log("Finished drawing all radius points");
      } catch (error) {
        console.error("Error in drawRadiusPoints:", error);
      }
    };

    // Enhanced function to update the useEffect for drawing radius points
    // This should replace the existing useEffect for drawing radius points
    const enhancedDrawRadiusPointsEffect = () => {
      useEffect(() => {
        // Only run this effect if we're in radius mode
        if (formState.maType !== "radius") {
          return; // Skip this effect entirely for non-radius types
        }

        const drawRadiusPoints = async () => {
          if (radiusPoints.length > 0) {
            console.log("Drawing radius points from effect:", radiusPoints);

            try {
              // Apply the current style settings to all points
              await drawRadiusPoints(
                radiusPoints,
                {
                  fillColor: formState.styleSettings.fillColor,
                  fillOpacity: formState.styleSettings.noFill ? 0 : formState.styleSettings.fillOpacity,
                  borderColor: formState.styleSettings.borderColor,
                  borderWidth: formState.styleSettings.noBorder ? 0 : formState.styleSettings.borderWidth
                },
                editingMarketArea?.id || "temporary",
                editingMarketArea?.order || 0
              );
            } catch (error) {
              console.error("Error drawing radius points in effect:", error);
              toast.error("Error displaying radius points. Please try again.");
            }
          }
        };

        drawRadiusPoints();
      }, [
        radiusPoints,
        formState.maType,
        formState.styleSettings
      ]);
    };

    // Helper function to debug radius graphics
    const debugRadiusGraphics = () => {
      if (!selectionGraphicsLayer) {
        console.log("Selection graphics layer not available");
        return;
      }

      const allGraphics = selectionGraphicsLayer.graphics.toArray();
      console.log(`Total graphics in layer: ${allGraphics.length}`);

      const radiusGraphics = allGraphics.filter(g => g.attributes?.FEATURE_TYPE === "radius");
      console.log(`Radius graphics: ${radiusGraphics.length}`);

      // Group by market area ID
      const groupedById = {};
      radiusGraphics.forEach(g => {
        const id = g.attributes?.marketAreaId || "unknown";
        if (!groupedById[id]) {
          groupedById[id] = [];
        }
        groupedById[id].push(g);
      });

      console.log("Radius graphics by market area ID:", Object.entries(groupedById).map(([id, graphics]) => ({
        id,
        count: graphics.length
      })));

      // Look for anomalies
      const temporaryGraphics = groupedById["temporary"] || [];
      if (temporaryGraphics.length > 0) {
        console.log(`Found ${temporaryGraphics.length} temporary radius graphics`);
      }

      return {
        total: allGraphics.length,
        radius: radiusGraphics.length,
        byId: groupedById
      };
    };

    drawRadiusPoints();

    // Clear the tracking set when changing market area type
    return () => {
      if (formState.maType !== "radius") {
        drawnPointsRef.current.clear();
      }
    };
  }, [
    radiusPoints,
    formState.maType,
    formState.styleSettings,
    drawRadius,
    editingMarketArea,
    selectionGraphicsLayer
  ]);

  // Enhanced coordinate handling for normalizeRadiusPoint
  const normalizeRadiusPoint = async (point) => {
    if (!point) return null;

    let center = null;

    try {
      // Load required ArcGIS modules for coordinate conversion
      const { default: Point } = await import("@arcgis/core/geometry/Point");
      const { webMercatorToGeographic } = await import("@arcgis/core/geometry/support/webMercatorUtils");

      if (point.center) {
        let srcPoint;
        let detectMode = "unknown";

        // Handle different center formats
        if (point.center.longitude !== undefined && point.center.latitude !== undefined) {
          detectMode = "lat/long";
          const spatialRef = point.center.spatialReference || { wkid: 4326 };

          // CRITICAL FIX: Handle the case where lat/long values are incorrectly tagged as Web Mercator
          if (spatialRef.wkid === 102100 || spatialRef.wkid === 3857) {
            console.log("Detected lat/long values with Web Mercator spatial reference - correcting");

            // Skip conversion and use the lat/long values directly with correct spatial reference
            center = {
              longitude: Number(point.center.longitude),
              latitude: Number(point.center.latitude),
              spatialReference: { wkid: 4326 } // Use WGS84 instead
            };

            console.log("Corrected coordinates:", center);

            // Skip further processing since we've already corrected the center
            const radii = Array.isArray(point.radii)
              ? point.radii.map(r => Number(r))
              : (point.radius ? [Number(point.radius)] : [10]);

            return {
              center,
              radii: radii.filter(r => !isNaN(r) && r > 0),
              units: point.units || 'miles'
            };
          }

          // Normal case - create point with lat/long
          srcPoint = new Point({
            longitude: Number(point.center.longitude),
            latitude: Number(point.center.latitude),
            spatialReference: spatialRef
          });
        } else if (point.center.x !== undefined && point.center.y !== undefined) {
          detectMode = "x/y";
          srcPoint = new Point({
            x: Number(point.center.x),
            y: Number(point.center.y),
            spatialReference: point.center.spatialReference || { wkid: 102100 }
          });
        } else if (Array.isArray(point.center)) {
          detectMode = "array";
          srcPoint = new Point({
            longitude: Number(point.center[0]),
            latitude: Number(point.center[1]),
            spatialReference: { wkid: 4326 }
          });
        } else {
          console.error("Invalid center format:", point.center);
          return null;
        }

        console.log(`Detected center format: ${detectMode}`, srcPoint);

        // Regular coordinate handling
        const spatialRefWkid = srcPoint.spatialReference?.wkid ||
          srcPoint.spatialReference?.latestWkid;

        let geoPoint = srcPoint;

        // Only convert if we're actually in Web Mercator and haven't already fixed the coordinates
        if ((spatialRefWkid === 102100 || spatialRefWkid === 3857) && center === null) {
          try {
            geoPoint = webMercatorToGeographic(srcPoint);
            console.log("Converted Web Mercator to geographic:", {
              from: {
                x: srcPoint.x,
                y: srcPoint.y,
                wkid: spatialRefWkid
              },
              to: {
                longitude: geoPoint.longitude,
                latitude: geoPoint.latitude
              }
            });
          } catch (error) {
            console.error("Error converting to geographic coordinates:", error);
          }
        }

        // If we haven't already set center in the fix
        if (center === null) {
          center = {
            longitude: Number(geoPoint.longitude),
            latitude: Number(geoPoint.latitude),
            spatialReference: { wkid: 4326 }
          };
        }
      }

      if (!center) {
        console.error("Failed to extract valid center coordinates:", point);
        return null;
      }

      const radii = Array.isArray(point.radii)
        ? point.radii.map(r => Number(r))
        : (point.radius ? [Number(point.radius)] : [10]);

      if (isNaN(center.longitude) || isNaN(center.latitude) ||
        !radii.length || radii.some(r => isNaN(r) || r <= 0)) {
        console.error("Invalid coordinates or radii:", { center, radii });
        return null;
      }

      return {
        center,
        radii,
        units: point.units || 'miles'
      };
    } catch (error) {
      console.error("Error normalizing radius point:", error);
      return null;
    }
  };


  // Add this function to normalize drive time points, similar to normalizeRadiusPoint
  const normalizeDriveTimePoint = async (point) => {
    if (!point) return null;

    let center = null;

    try {
      // Load required ArcGIS modules for coordinate conversion
      const { default: Point } = await import("@arcgis/core/geometry/Point");
      const { webMercatorToGeographic } = await import("@arcgis/core/geometry/support/webMercatorUtils");

      if (point.center) {
        let srcPoint;

        // Handle different center formats
        if (point.center.longitude !== undefined && point.center.latitude !== undefined) {
          const spatialRef = point.center.spatialReference || { wkid: 4326 };

          // Handle the case where lat/long values are incorrectly tagged as Web Mercator
          if (spatialRef.wkid === 102100 || spatialRef.wkid === 3857) {
            center = {
              longitude: Number(point.center.longitude),
              latitude: Number(point.center.latitude),
              spatialReference: { wkid: 4326 } // Use WGS84 instead
            };

            // Skip further processing since we've already corrected the center
            const timeRanges = Array.isArray(point.timeRanges)
              ? point.timeRanges.map(r => Number(r))
              : (point.timeRange ? [Number(point.timeRange)] : [5]);

            return {
              center,
              timeRanges: timeRanges.filter(r => !isNaN(r) && r > 0),
              units: point.units || 'minutes',
              polygon: point.polygon || null
            };
          }

          // Normal case - create point with lat/long
          srcPoint = new Point({
            longitude: Number(point.center.longitude),
            latitude: Number(point.center.latitude),
            spatialReference: spatialRef
          });
        } else if (point.center.x !== undefined && point.center.y !== undefined) {
          srcPoint = new Point({
            x: Number(point.center.x),
            y: Number(point.center.y),
            spatialReference: point.center.spatialReference || { wkid: 102100 }
          });
        } else if (Array.isArray(point.center)) {
          srcPoint = new Point({
            longitude: Number(point.center[0]),
            latitude: Number(point.center[1]),
            spatialReference: { wkid: 4326 }
          });
        } else {
          console.error("Invalid center format:", point.center);
          return null;
        }

        // Regular coordinate handling
        const spatialRefWkid = srcPoint.spatialReference?.wkid ||
          srcPoint.spatialReference?.latestWkid;

        let geoPoint = srcPoint;

        // Only convert if we're actually in Web Mercator and haven't already fixed the coordinates
        if ((spatialRefWkid === 102100 || spatialRefWkid === 3857) && center === null) {
          try {
            geoPoint = webMercatorToGeographic(srcPoint);
          } catch (error) {
            console.error("Error converting to geographic coordinates:", error);
          }
        }

        // If we haven't already set center in the fix
        if (center === null) {
          center = {
            longitude: Number(geoPoint.longitude),
            latitude: Number(geoPoint.latitude),
            spatialReference: { wkid: 4326 }
          };
        }
      }

      if (!center) {
        console.error("Failed to extract valid center coordinates:", point);
        return null;
      }

      const timeRanges = Array.isArray(point.timeRanges)
        ? point.timeRanges.map(r => Number(r))
        : (point.timeRange ? [Number(point.timeRange)] : [5]);

      if (isNaN(center.longitude) || isNaN(center.latitude) ||
        !timeRanges.length || timeRanges.some(r => isNaN(r) || r <= 0)) {
        console.error("Invalid coordinates or time ranges:", { center, timeRanges });
        return null;
      }

      return {
        center,
        timeRanges,
        units: point.units || 'minutes',
        polygon: point.polygon || null // Preserve the drive time polygon if available
      };
    } catch (error) {
      console.error("Error normalizing drive time point:", error);
      return null;
    }
  };

  // Add this function to handle drive time submission
  const handleDriveTimeSubmit = async (formState, driveTimePoints, editingMarketArea, styleSettings) => {
    console.group('Drive Time Market Area Submission');
    console.log("Starting drive time market area submission");
    console.log("Form state:", formState);
    console.log("Initial drive time points:", driveTimePoints);
  
    // Validate drive time points
    if (!driveTimePoints || driveTimePoints.length === 0) {
      throw new Error("No drive time points defined");
    }
  
    // Make a deep copy to avoid reference issues
    const driveTimePointsCopy = JSON.parse(JSON.stringify(driveTimePoints));
    
    const normalizedPoints = driveTimePointsCopy.map(async (point) => {
      // If polygon isn't already calculated, calculate it
      if (!point.polygon && !point.driveTimePolygon) {
        try {
          point.driveTimePolygon = await calculateDriveTimePolygon(point);
        } catch (err) {
          console.error("Failed to calculate drive time polygon:", err);
        }
      }
    
      return {
        center: point.center,
        travelTimeMinutes: Array.isArray(point.timeRanges) ? point.timeRanges[0] : 
                           (point.timeRange || point.travelTimeMinutes || 15),
        units: 'minutes',
        polygon: point.polygon || point.driveTimePolygon,
        ...(point.polygon ? { polygon: point.polygon } : {})
      };
    }).filter(point => {
      // Filter out invalid points
      return point && point.center && 
             typeof point.travelTimeMinutes === 'number' && 
             point.travelTimeMinutes > 0;
    });
  
    if (normalizedPoints.length === 0) {
      console.error("No valid drive time points after normalization");
      throw new Error("No valid drive time points to save. Check console logs for details.");
    }
  
    // Log normalized points for debugging
    console.log("Submitting normalized drive time points:", 
      JSON.stringify(normalizedPoints, null, 2));
  
      // Create market area data with validated points
      marketAreaData = {
        ma_type: "drivetime", 
        name: formState.maName,
        short_name: formState.shortName,
        style_settings: styleSettings,
        locations: [], // Drive time types don't use locations array
        drive_time_points: normalizedPoints,
        geometry: normalizedPoints[0]?.polygon || null
      };
  
    console.log("Final market area data:", marketAreaData);
    console.groupEnd();
  
    return marketAreaData;
  };

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

          const mappedResults = results
            .map((feature) => {
              const locationName = formatLocationName(feature, formState.maType);
              return {
                id: feature.attributes.FID,
                name: locationName,
                feature,
                geometry: feature.geometry,
              };
            })
            .sort((a, b) => {
              const searchTerm = formState.locationSearch.toLowerCase();
              const aStartsWith = a.name.toLowerCase().startsWith(searchTerm);
              const bStartsWith = b.name.toLowerCase().startsWith(searchTerm);

              // If both names start with the search term or neither do,
              // sort alphabetically
              if (aStartsWith === bStartsWith) {
                return a.name.localeCompare(b.name);
              }

              // Prioritize names that start with the search term
              return aStartsWith ? -1 : 1;
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

// Keep the form state's style settings updated as user picks them
const handleStyleChange = useCallback((type, value) => {
  setFormState((prev) => {
    // Handle batch update from theme selector
    if (type === "batchUpdate" || type === "completeThemeUpdate") {
      console.log('Market Area Form received batch theme update:', value);
      
      // Extract the theme data based on the update type
      const batchData = type === "completeThemeUpdate" ? value.styles : value;
      
      return {
        ...prev,
        styleSettings: {
          ...prev.styleSettings,
          ...batchData,
          // Ensure proper state for no-fill and no-border flags
          noFill: batchData.noFill !== undefined ? batchData.noFill : batchData.fillOpacity === 0,
          noBorder: batchData.noBorder !== undefined ? batchData.noBorder : batchData.borderWidth === 0,
          themeName: batchData.themeName || (type === "completeThemeUpdate" ? value.theme : 'Custom')
        }
      };
    }

    // Handle individual property updates (original code)
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

      // Clear radius points and drive time points
      setRadiusPoints([]);
      setDriveTimePoints([]);
    }
  }, [editingMarketArea, clearSelection]);


  // Update this section in the handleSubmit function for radius types
  const handleRadiusSubmit = async (formState, radiusPoints, editingMarketArea, styleSettings) => {
    console.group('Radius Market Area Submission');
    console.log("Starting radius market area submission");
    console.log("Form state:", formState);
    console.log("Initial radius points:", radiusPoints);

    // Validate radius points
    if (!radiusPoints || radiusPoints.length === 0) {
      throw new Error("No radius points defined");
    }

    // Normalize radius points before submission with enhanced logging
    console.log(`Normalizing ${radiusPoints.length} radius points...`);

    const normalizationPromises = radiusPoints.map((point, index) => {
      console.log(`Normalizing point ${index + 1}/${radiusPoints.length}`);
      return normalizeRadiusPoint(point);
    });

    const normalizedPointsWithNulls = await Promise.all(normalizationPromises);
    console.log("Normalization complete, filtering valid points");

    // Filter out invalid points
    const normalizedPoints = normalizedPointsWithNulls.filter(Boolean);
    console.log(`Found ${normalizedPoints.length} valid points out of ${radiusPoints.length} total`);

    if (normalizedPoints.length === 0) {
      console.error("No valid radius points after normalization");
      throw new Error("No valid radius points to save. Check console logs for details.");
    }

    // Log normalized points for debugging
    console.log("Submitting normalized radius points:",
      JSON.stringify(normalizedPoints, null, 2));

    // Optional: Keep temporary graphics instead of removing them
    // Comment this section out to see if it helps
    /*
    if (selectionGraphicsLayer) {
      const tempRadiusGraphics = selectionGraphicsLayer.graphics.filter(
        (g) => (
          g.attributes?.FEATURE_TYPE === "radius" && 
          (g.attributes?.marketAreaId === "temporary" || 
           g.attributes?.marketAreaId === "temp")
        )
      );
      
      if (tempRadiusGraphics.length > 0) {
        console.log(`Removing ${tempRadiusGraphics.length} temporary radius graphics before save`);
        selectionGraphicsLayer.removeMany(tempRadiusGraphics);
      }
    }
    */

    // Create market area data with validated points
    const marketAreaData = {
      ma_type: "radius",
      name: formState.maName,
      short_name: formState.shortName,
      style_settings: styleSettings,
      locations: [], // Radius types don't use locations
      radius_points: normalizedPoints,
    };

    console.log("Final market area data:", marketAreaData);
    console.groupEnd();

    return marketAreaData;
  };

  // This function integrates with your existing code to safely handle different point formats
  const safelyExtractRadiusPoints = (points) => {
    if (!points || !Array.isArray(points)) {
      console.warn("Invalid radius points data structure:", points);
      return [];
    }

    return points.map(point => {
      // Handle different potential formats
      if (!point) return null;

      try {
        // Attempt to normalize the structure
        let normalizedPoint = {
          center: null,
          radii: [],
          units: 'miles'
        };

        // Handle center property
        if (point.center) {
          // Direct object reference
          normalizedPoint.center = point.center;
        } else if (point.x !== undefined && point.y !== undefined) {
          // Points without center wrapper
          normalizedPoint.center = { x: point.x, y: point.y };
        } else if (point.longitude !== undefined && point.latitude !== undefined) {
          // Points without center wrapper
          normalizedPoint.center = {
            longitude: point.longitude,
            latitude: point.latitude
          };
        } else if (Array.isArray(point) && point.length >= 2) {
          // Array format [longitude, latitude, ...]
          normalizedPoint.center = [point[0], point[1]];
        }

        // Handle radius/radii property
        if (Array.isArray(point.radii) && point.radii.length > 0) {
          normalizedPoint.radii = point.radii;
        } else if (point.radius !== undefined) {
          normalizedPoint.radii = [Number(point.radius)];
        } else if (Array.isArray(point) && point.length > 2) {
          // Array might include radius as third element
          normalizedPoint.radii = [Number(point[2])];
        } else {
          // Default
          normalizedPoint.radii = [10];
        }

        // Handle units
        if (point.units) {
          normalizedPoint.units = point.units;
        }

        return normalizedPoint;
      } catch (e) {
        console.error("Error processing radius point:", e);
        return null;
      }
    }).filter(Boolean); // Remove any null points
  };

  // Helper function to safely draw radius points
  const safelyDrawRadiusPoints = async (radiusPoints, styleSettings, mapId, order, drawRadius) => {
    if (!radiusPoints || !Array.isArray(radiusPoints) || radiusPoints.length === 0) {
      console.warn("No radius points to draw");
      return;
    }

    console.log(`Drawing ${radiusPoints.length} radius points with styles:`, styleSettings);

    // Process each point sequentially to avoid race conditions
    for (let i = 0; i < radiusPoints.length; i++) {
      const point = radiusPoints[i];
      try {
        console.log(`Drawing radius point ${i + 1}/${radiusPoints.length}:`, point);
        await drawRadius(
          point,
          {
            fillColor: styleSettings.fillColor,
            fillOpacity: styleSettings.noFill ? 0 : styleSettings.fillOpacity,
            borderColor: styleSettings.borderColor,
            borderWidth: styleSettings.noBorder ? 0 : styleSettings.borderWidth
          },
          mapId || "temporary",
          order || 0
        );
      } catch (err) {
        console.error(`Error drawing radius point ${i + 1}:`, err);
        // Continue with other points instead of failing completely
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
  
    try {
      // Comprehensive pre-submission validation
      if (!formState.maName || formState.maName.trim() === '') {
        throw new Error("Market Area Name is required");
      }
  
      // In the handleSubmit function, ensure style settings are correctly saved:
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
        // Make sure to include these flags so they're saved with the market area
        noFill: formState.styleSettings.noFill,
        noBorder: formState.styleSettings.noBorder,
      };
  
      // If they picked "md" as a type, treat it as "place"
      // No need to map drivetime to radius anymore
      const mappedType = formState.maType === "md" ? "place" : formState.maType;
  
      // Validate market area type
      if (!formState.maType) {
        throw new Error("Market Area Type must be selected");
      }
  
      // Detailed logging of submission state
      console.group('Market Area Submission');
      console.log("Form state on submit:", formState);
  
      let marketAreaData;
  
      // Handling drive time type market areas
      if (formState.maType === "drivetime") {
        console.log("Processing drive time type market area");
        console.log("Current drive time points:", driveTimePoints);
  
        // Validate drive time points
        if (!driveTimePoints || driveTimePoints.length === 0) {
          throw new Error("No drive time points defined");
        }
  
        // Make a deep copy to avoid reference issues
        const driveTimePointsCopy = JSON.parse(JSON.stringify(driveTimePoints));
        
        // Normalize drive time points with the correct structure expected by the backend
        const normalizedPoints = driveTimePointsCopy.map(point => {
          // Extract center coordinates
          const center = point.center || point.point || point;
          const longitude = center.longitude || center.x;
          const latitude = center.latitude || center.y;
  
          // Determine time range
          const travelTimeMinutes = Array.isArray(point.timeRanges) 
            ? point.timeRanges[0] 
            : (point.timeRange || point.travelTimeMinutes || 15);
  
          // Ensure polygon is included if available
          const polygon = point.polygon || point.driveTimePolygon;
  
          return {
            center: {
              longitude,
              latitude,
              spatialReference: { wkid: 4326 }
            },
            travelTimeMinutes,
            units: point.units || 'minutes',
            polygon,
            // Include additional metadata to aid reconstruction
            metadata: {
              originalPoint: point
            }
          };
        }).filter(point => {
          // Strict validation
          return point.center && 
                 !isNaN(point.center.longitude) && 
                 !isNaN(point.center.latitude) && 
                 typeof point.travelTimeMinutes === 'number' && 
                 point.travelTimeMinutes > 0;
        });
  
        if (normalizedPoints.length === 0) {
          console.error("No valid drive time points after normalization");
          toast.error("No valid drive time points to save");
          setIsSaving(false);
          return;
        }
  
        // Create market area data with validated points
        marketAreaData = {
          ma_type: "drivetime", 
          name: formState.maName,
          short_name: formState.shortName,
          style_settings: styleSettings,
          locations: [], // Drive time types don't use locations array
          drive_time_points: normalizedPoints,
          // Include geometry for backend storage
          geometry: normalizedPoints[0]?.polygon || null
        };
  
        console.log("Final market area data for drive time type:", marketAreaData);
      }
      // Handling radius type market areas
      else if (formState.maType === "radius") {
        console.log("Processing radius type market area");
        console.log("Current radius points:", radiusPoints);
  
        // Validate radius points
        if (!radiusPoints || radiusPoints.length === 0) {
          throw new Error("No radius points defined");
        }
  
        // Make a deep copy of radius points to avoid reference issues
        const radiusPointsCopy = JSON.parse(JSON.stringify(radiusPoints));
        console.log("Working with radius points copy:", radiusPointsCopy);
  
        // Normalize radius points before submission - with enhanced error handling
        const normalizationPromises = radiusPointsCopy.map((point, index) => {
          console.log(`Normalizing point ${index + 1}/${radiusPointsCopy.length}`);
          return normalizeRadiusPoint(point);
        });
  
        const normalizedPointsWithNulls = await Promise.all(normalizationPromises);
        console.log("Normalization complete. Results:", normalizedPointsWithNulls);
  
        const normalizedPoints = normalizedPointsWithNulls.filter(point => {
          const isValid = Boolean(point);
          if (!isValid) {
            console.warn("Filtered out invalid normalized point");
          }
          return isValid;
        });
  
        if (normalizedPoints.length === 0) {
          console.error("No valid radius points after normalization");
          toast.error("No valid radius points to save");
          setIsSaving(false);
          return;
        }
  
        // Log normalized points for debugging
        console.log("Submitting normalized radius points:",
          JSON.stringify(normalizedPoints, null, 2));
  
        // Only remove temporary graphics if necessary, and do it carefully
        if (selectionGraphicsLayer) {
          const tempRadiusGraphics = selectionGraphicsLayer.graphics.filter(
            (g) => (
              g.attributes?.FEATURE_TYPE === "radius" &&
              g.attributes?.marketAreaId === "temporary" // Only remove truly temporary ones
            )
          );
  
          if (tempRadiusGraphics.length > 0) {
            console.log(`Removing ${tempRadiusGraphics.length} temporary radius graphics before save`);
            selectionGraphicsLayer.removeMany(tempRadiusGraphics);
          }
        }
  
        // Create market area data with validated normalized points
        marketAreaData = {
          ma_type: "radius",
          name: formState.maName,
          short_name: formState.shortName,
          style_settings: styleSettings,
          locations: [], // Radius types don't use locations
          radius_points: normalizedPoints,
        };
  
        console.log("Final market area data for radius type:", marketAreaData);
      } else {
        // Non-radius scenario - reuse existing code
        console.log("Processing non-radius type market area");
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
  
        marketAreaData = {
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
          drive_time_points: [], // Include empty drive time points
        };
      }
  
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
  
      console.log(`Preserving ${existingGraphics.length} existing graphics`);
  
      // Save the market area with appropriate API
      let savedMarketArea;
      if (editingMarketArea) {
        console.log(`Updating existing market area id: ${editingMarketArea.id}`);
        savedMarketArea = await updateMarketArea(
          projectId,
          editingMarketArea.id,
          marketAreaData
        );
        toast.success("Market area updated successfully");
      } else {
        console.log("Creating new market area");
        savedMarketArea = await addMarketArea(projectId, marketAreaData);
        toast.success("Market area created successfully");
      }
  
      console.log("Market area saved successfully:", savedMarketArea);
  
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
  
      // Clear radius points and drive time points
      setRadiusPoints([]);
      setDriveTimePoints([]);
  
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
  
      // Apply specific post-save handling for non-radius, non-drivetime types
      if (formState.maType !== "radius" && formState.maType !== "drivetime") {
        // For non-radius market areas, handle visualizations in the current view
        const currentSelections = formState.selectedLocations.map((loc) => ({
          geometry: loc.geometry || loc.feature?.geometry,
          attributes: {
            id: loc.id,
            marketAreaId: editingMarketArea?.id || savedMarketArea.id,
            FEATURE_TYPE: formState.maType,
            order: savedMarketArea.order,
          },
        }));
  
        // Remove active layer
        if (formState.maType) {
          await removeActiveLayer(formState.maType);
        }
  
        // Apply styles to features
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
      }
  
      // Handle visibility for all market area types
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
  
      // Common cleanup
      setEditingMarketArea(null);
      onClose?.();
      pressMAListButton();
      console.groupEnd();
    } catch (err) {
      console.error("Error saving market area:", err);
      setError(err.message || "Error saving market area");
      toast.error(err.message || "Error saving market area");
      console.groupEnd();
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
        if (editingMarketArea.ma_type === "drivetime" && editingMarketArea.drive_time_points) {
          // Redraw drive time polygons with original style
          for (const point of editingMarketArea.drive_time_points) {
            if (!point.driveTimePolygon) {
              // If polygon isn't available, calculate it
              try {
                point.driveTimePolygon = await calculateDriveTimePolygon(point);
              } catch (err) {
                console.error("Error calculating drive time polygon:", err);
                continue; // Skip this point if calculation fails
              }
            }

            await drawDriveTimePolygon(
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
        }
        else if (editingMarketArea.ma_type === "radius" && editingMarketArea.radius_points) {
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

      // Clear radius and drive time points
      setRadiusPoints([]);
      setDriveTimePoints([]);

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
    drawDriveTimePolygon,
    calculateDriveTimePolygon,
    updateFeatureStyles,
    setEditingMarketArea,
    onClose,
    selectionGraphicsLayer
  ]);

  // Update the form rendering to include DriveTime component
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
          ) : formState.maType === "drivetime" ? (
            <DriveTime
              onFormStateChange={(newState) =>
                setDriveTimePoints(newState.driveTimePoints)
              }
              styleSettings={formState.styleSettings}
              existingDriveTimePoints={driveTimePoints}
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
                    (formState.maType === "drivetime" && driveTimePoints.length === 0) || // Changed from "drive_time" to "drivetime"
                    (formState.maType !== "radius" && formState.maType !== "drivetime" &&
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