import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMarketAreas } from "../../contexts/MarketAreaContext";
import { useMap } from "../../contexts/MapContext";
import {
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  Bars3Icon,
} from "@heroicons/react/24/outline";

const SortableItem = ({
  marketArea,
  isVisible,
  onToggleVisibility,
  onEdit,
  onDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: marketArea.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Calculate count based on market area type
  const count =
    marketArea.ma_type === "radius"
      ? marketArea.radius_points?.length || 0
      : marketArea.ma_type === "drivetime"
        ? marketArea.drive_time_points?.length || 0
        : marketArea.ma_type === "site_location"
          ? 1 // Site location typically has just one point
          : marketArea.locations?.length || 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 py-1 text-sm"
    >
      <div className="flex items-center flex-1 min-w-0">
        <div
          {...attributes}
          {...listeners}
          className="mr-2 cursor-grab text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
        >
          <Bars3Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 flex items-center space-x-2">
          <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {marketArea.name}
          </span>
          <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">
            {marketArea.ma_type}({count})
          </span>
          {marketArea.short_name && (
            <span className="text-gray-500 dark:text-gray-400 flex-shrink-0 truncate">
              {marketArea.short_name}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-2 ml-2">
        <button
          onClick={() => onToggleVisibility(marketArea)}
          className="p-1 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          title={isVisible ? "Hide area" : "Show area"}
        >
          {isVisible ? (
            <EyeIcon className="h-4 w-4" />
          ) : (
            <EyeSlashIcon className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={() => onEdit(marketArea)}
          className="p-1 text-blue-400 hover:text-blue-500"
          title="Edit area"
        >
          <PencilIcon className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDelete(marketArea)}
          className="p-1 text-red-400 hover:text-red-500"
          title="Delete area"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

// Removed onClose parameter as this component should always stay open
export default function MarketAreaList({ onEdit }) {
  const { projectId } = useParams();
  const {
    marketAreas = [],
    isLoading,
    error,
    fetchMarketAreas,
    deleteMarketArea,
    reorderMarketAreas,
  } = useMarketAreas();

  const {
    drawRadius,
    drawDriveTimePolygon,
    drawSiteLocation,
    updateFeatureStyles,
    clearSelection,
    hideAllFeatureLayers,
    clearMarketAreaGraphics,
    extractSiteLocationInfo,
  } = useMap();

  // Track editing state
  const isEditingRef = useRef(false);

  // Transformer for radius points
  const transformRadiusPoint = useMemo(() => (point, marketAreaId) => {
    try {
      if (!point.center) {
        console.error("No center found in point:", point);
        return null;
      }

      const longitude = Number(point.center.longitude || point.center.x);
      const latitude = Number(point.center.latitude || point.center.y);

      if (isNaN(longitude) || isNaN(latitude)) {
        console.error("Invalid coordinates in point:", point);
        return null;
      }

      return {
        center: {
          x: longitude,
          y: latitude,
          spatialReference: point.center.spatialReference || { wkid: 102100 }
        },
        radii: Array.isArray(point.radii)
          ? point.radii.map(Number).filter(r => !isNaN(r) && r > 0)
          : [Number(point.radius || 10)],
        units: point.units || "miles"
      };
    } catch (error) {
      console.error("Error transforming radius point:", error);
      return null;
    }
  }, []);

  // Transformer for drive time points
  const transformDriveTimePoint = useMemo(() => (point, marketAreaId) => {
    try {
      if (!point.center) {
        console.error("No center found in drive time point:", point);
        return null;
      }

      const longitude = Number(point.center.longitude || point.center.x);
      const latitude = Number(point.center.latitude || point.center.y);

      if (isNaN(longitude) || isNaN(latitude)) {
        console.error("Invalid coordinates in drive time point:", point);
        return null;
      }

      return {
        center: {
          longitude,
          latitude,
          spatialReference: point.center.spatialReference || { wkid: 4326 }
        },
        timeRanges: Array.isArray(point.timeRanges)
          ? point.timeRanges.map(Number).filter(t => !isNaN(t) && t > 0)
          : [Number(point.travelTimeMinutes || point.timeRange || 15)],
        units: point.units || "minutes",
        polygon: point.polygon || point.driveTimePolygon || null
      };
    } catch (error) {
      console.error("Error transforming drive time point:", error);
      return null;
    }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [visibleMarketAreaIds, setVisibleMarketAreaIds] = useState(() => {
    const stored = localStorage.getItem(`marketAreas.${projectId}.visible`);
    return stored ? JSON.parse(stored) : marketAreas.map(ma => ma.id);
  });

  const areAllAreasVisible =
    marketAreas.length > 0 &&
    marketAreas.every((ma) => visibleMarketAreaIds.includes(ma.id));

  const handleToggleAll = useCallback(async () => {
    try {
      if (areAllAreasVisible) {
        console.log("Hiding all market areas");
        for (const marketArea of marketAreas) {
          await clearMarketAreaGraphics(marketArea.id);
        }
        await clearMarketAreaGraphics();
        clearSelection();
        hideAllFeatureLayers();
        setVisibleMarketAreaIds([]);
        localStorage.setItem(
          `marketAreas.${projectId}.visible`,
          JSON.stringify([])
        );
      } else {
        console.log("Showing all market areas");
        await clearMarketAreaGraphics();
        clearSelection();
        hideAllFeatureLayers();

        const sortedMarketAreas = [...marketAreas]
          .sort((a, b) => a.order - b.order)
          .reverse();

        for (const marketArea of sortedMarketAreas) {
          if (marketArea.ma_type === "radius" && marketArea.radius_points) {
            for (const point of marketArea.radius_points) {
              const transformedPoint = transformRadiusPoint(point, marketArea.id);
              if (transformedPoint) {
                await drawRadius(
                  transformedPoint,
                  marketArea.style_settings,
                  marketArea.id,
                  marketArea.order
                );
              }
            }
          }
          // Handle drive time market areas
          else if (marketArea.ma_type === "drivetime" && marketArea.drive_time_points) {
            for (const point of marketArea.drive_time_points) {
              const transformedPoint = transformDriveTimePoint(point, marketArea.id);
              if (transformedPoint) {
                await drawDriveTimePolygon(
                  transformedPoint,
                  marketArea.style_settings,
                  marketArea.id,
                  marketArea.order
                );
              }
            }
          }
          // Handle site location market areas
          else if (marketArea.ma_type === "site_location") {
            const siteData = extractSiteLocationInfo(marketArea);
            if (siteData) {
              await drawSiteLocation(
                siteData,
                marketArea.style_settings,
                marketArea.id,
                marketArea.order
              );
            }
          }
          else if (marketArea.locations) {
            // Validate features before adding
            const validFeatures = marketArea.locations
              .filter(loc => loc.geometry && (loc.geometry.rings || loc.geometry.paths))
              .map((loc) => ({
                geometry: loc.geometry,
                attributes: {
                  id: loc.id,
                  marketAreaId: marketArea.id,
                  order: marketArea.order,
                },
              }));
          
            if (validFeatures.length > 0) {
              await updateFeatureStyles(
                validFeatures,
                {
                  fill: marketArea.style_settings?.fillColor || "#0078D4",
                  fillOpacity: marketArea.style_settings?.noFill ? 0 : (marketArea.style_settings?.fillOpacity || 0.35),
                  outline: marketArea.style_settings?.borderColor || "#0078D4",
                  outlineWidth: marketArea.style_settings?.noBorder ? 0 : (marketArea.style_settings?.borderWidth || 3),
                },
                marketArea.ma_type
              );
            }
          }
        }

        const allIds = marketAreas.map((ma) => ma.id);
        setVisibleMarketAreaIds(allIds);
        localStorage.setItem(
          `marketAreas.${projectId}.visible`,
          JSON.stringify(allIds)
        );
      }
    } catch (error) {
      console.error("Toggle all market areas error:", error);
    }
  }, [
    areAllAreasVisible,
    marketAreas,
    projectId,
    clearMarketAreaGraphics,
    clearSelection,
    hideAllFeatureLayers,
    transformRadiusPoint,
    transformDriveTimePoint,
    drawRadius,
    drawDriveTimePolygon,
    drawSiteLocation,
    extractSiteLocationInfo,
    updateFeatureStyles
  ]);

  // Improved handleToggleVisibility function with better state management
  const handleToggleVisibility = useCallback(async (marketArea) => {
    if (!marketArea) return;

    const { id } = marketArea;
    const isVisible = visibleMarketAreaIds.includes(id);

    try {
      // Log the toggle action
      console.log(`${isVisible ? 'Hiding' : 'Showing'} market area ${id} of type ${marketArea.ma_type}`);

      // Update state FIRST before making graphics changes
      // This ensures the visibleMarketAreaIds is updated before any drawing effects run
      const newVisibleIds = isVisible
        ? visibleMarketAreaIds.filter((currentId) => currentId !== id)
        : [...visibleMarketAreaIds, id];

      // Set new visibility state immediately to avoid race conditions
      setVisibleMarketAreaIds(newVisibleIds);
      localStorage.setItem(
        `marketAreas.${projectId}.visible`,
        JSON.stringify(newVisibleIds)
      );

      // Always fully clear graphics for this market area specifically
      await clearMarketAreaGraphics(id);

      // If hiding, we're done - don't draw anything new
      if (isVisible) {
        return;
      }

      // If showing, directly draw just this market area (don't rely on the effect)
      try {
        if (marketArea.ma_type === "radius" && marketArea.radius_points) {
          let radiusPoints;
          try {
            radiusPoints = typeof marketArea.radius_points === 'string'
              ? JSON.parse(marketArea.radius_points)
              : marketArea.radius_points;
          } catch (err) {
            console.warn("[MarketAreaList] Could not parse radius_points:", err);
            radiusPoints = marketArea.radius_points;
          }

          const points = Array.isArray(radiusPoints)
            ? radiusPoints
            : [radiusPoints].filter(Boolean);

          for (const point of points) {
            const transformedPoint = transformRadiusPoint(point, marketArea.id);
            if (transformedPoint) {
              await drawRadius(
                transformedPoint,
                {
                  fillColor: marketArea.style_settings?.fillColor || "#0078D4",
                  fillOpacity: marketArea.style_settings?.noFill ? 0 : (marketArea.style_settings?.fillOpacity || 0.35),
                  borderColor: marketArea.style_settings?.borderColor || "#0078D4",
                  borderWidth: marketArea.style_settings?.noBorder ? 0 : (marketArea.style_settings?.borderWidth || 3)
                },
                marketArea.id,
                marketArea.order || 0
              );
            }
          }
        }
        else if (marketArea.ma_type === "drivetime") {
          let driveTimePoints;
          try {
            driveTimePoints = typeof marketArea.drive_time_points === 'string'
              ? JSON.parse(marketArea.drive_time_points)
              : marketArea.drive_time_points;
          } catch (err) {
            console.warn("[MarketAreaList] Could not parse drive_time_points:", err);
            driveTimePoints = marketArea.drive_time_points;
          }

          if (!driveTimePoints && marketArea.geometry) {
            try {
              // Try to extract points from geometry
              const geo = marketArea.geometry;
              if (geo.rings && geo.rings.length > 0) {
                // Calculate a simple centroid
                const points = geo.rings[0];
                let sumX = 0, sumY = 0;

                for (const point of points) {
                  sumX += point[0];
                  sumY += point[1];
                }

                driveTimePoints = [{
                  center: {
                    longitude: sumX / points.length,
                    latitude: sumY / points.length
                  },
                  timeRanges: [15],
                  polygon: geo
                }];
              }
            } catch (error) {
              console.warn("[MarketAreaList] Error extracting points from geometry:", error);
            }
          }

          const points = Array.isArray(driveTimePoints)
            ? driveTimePoints
            : driveTimePoints ? [driveTimePoints] : [];

          for (const point of points) {
            const transformedPoint = transformDriveTimePoint(point, marketArea.id);
            if (transformedPoint) {
              // Create a clean point object that will work with drawDriveTimePolygon
              const cleanPoint = {
                center: {
                  longitude: transformedPoint.center.longitude,
                  latitude: transformedPoint.center.latitude,
                  spatialReference: transformedPoint.center.spatialReference
                },
                travelTimeMinutes: transformedPoint.travelTimeMinutes ||
                  transformedPoint.timeRanges?.[0] || 15,
                polygon: transformedPoint.polygon || point.polygon || point.driveTimePolygon
              };

              await drawDriveTimePolygon(
                cleanPoint,
                {
                  fillColor: marketArea.style_settings?.fillColor || "#0078D4",
                  fillOpacity: marketArea.style_settings?.noFill ? 0 : (marketArea.style_settings?.fillOpacity || 0.35),
                  borderColor: marketArea.style_settings?.borderColor || "#0078D4",
                  borderWidth: marketArea.style_settings?.noBorder ? 0 : (marketArea.style_settings?.borderWidth || 3)
                },
                marketArea.id,
                marketArea.order || 0
              );
            }
          }
        }
        // Handle site location market areas when toggling visibility
        else if (marketArea.ma_type === "site_location") {
          // Extract site location info from market area
          const siteData = extractSiteLocationInfo(marketArea);
          
          if (siteData) {
            await drawSiteLocation(
              siteData,
              {
                fillColor: marketArea.style_settings?.fillColor || "#FFC000",
                fillOpacity: marketArea.style_settings?.noFill ? 0 : (marketArea.style_settings?.fillOpacity || 0.8),
                borderColor: marketArea.style_settings?.borderColor || "#000000",
                borderWidth: marketArea.style_settings?.noBorder ? 0 : (marketArea.style_settings?.borderWidth || 1)
              },
              marketArea.id,
              marketArea.order || 0
            );
          } else {
            console.warn(`[MarketAreaList] Site location market area ${id} has no valid site data`);
          }
        }
        else if (marketArea.locations && marketArea.locations.length > 0) {
          // Only include locations with valid geometry to avoid the Accessor errors
          const validLocations = marketArea.locations.filter(loc =>
            loc.geometry && (loc.geometry.rings || loc.geometry.paths)
          );

          if (validLocations.length > 0) {
            const validFeatures = validLocations.map((loc) => ({
              geometry: loc.geometry,
              attributes: {
                id: loc.id,
                marketAreaId: marketArea.id,
                order: marketArea.order,
              },
            }));

            await updateFeatureStyles(
              validFeatures,
              {
                fill: marketArea.style_settings?.fillColor || "#0078D4",
                fillOpacity: marketArea.style_settings?.noFill ? 0 : (marketArea.style_settings?.fillOpacity || 0.35),
                outline: marketArea.style_settings?.borderColor || "#0078D4",
                outlineWidth: marketArea.style_settings?.noBorder ? 0 : (marketArea.style_settings?.borderWidth || 3),
              },
              marketArea.ma_type
            );
          }
        }
      } catch (drawError) {
        console.error(`[MarketAreaList] Error drawing market area ${id}:`, drawError);
      }
    } catch (error) {
      console.error("[MarketAreaList] Toggle visibility error:", error);
      // Consider adding a toast notification system
      console.error("Failed to toggle market area visibility");
    }
  }, [
    visibleMarketAreaIds,
    projectId,
    clearMarketAreaGraphics,
    transformRadiusPoint,
    transformDriveTimePoint,
    drawRadius,
    drawDriveTimePolygon,
    drawSiteLocation,
    extractSiteLocationInfo,
    updateFeatureStyles,
  ]);
  
  const handleEdit = useCallback((marketArea) => {
    if (!marketArea) return;

    // Set editing flag before calling onEdit
    isEditingRef.current = true;
    onEdit?.(marketArea);
  }, [onEdit]);

  const handleDelete = async (marketArea) => {
    if (!marketArea || !projectId) return;

    if (window.confirm("Are you sure you want to delete this market area?")) {
      try {
        clearMarketAreaGraphics(marketArea.id);
        await deleteMarketArea(projectId, marketArea.id);

        const updatedVisible = visibleMarketAreaIds.filter(id => id !== marketArea.id);
        setVisibleMarketAreaIds(updatedVisible);
        localStorage.setItem(
          `marketAreas.${projectId}.visible`,
          JSON.stringify(updatedVisible)
        );
      } catch (error) {
        console.error("Failed to delete market area:", error);
      }
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = marketAreas.findIndex((ma) => ma.id === active.id);
    const newIndex = marketAreas.findIndex((ma) => ma.id === over.id);

    const newOrder = arrayMove(marketAreas, oldIndex, newIndex).map(
      (ma) => ma.id
    );

    try {
      await reorderMarketAreas(projectId, newOrder);
    } catch (error) {
      console.error("Failed to reorder market areas:", error);
    }
  };

  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);

  useEffect(() => {
    const loadMarketAreas = async () => {
      if (!projectId || hasAttemptedFetch) return;

      try {
        await fetchMarketAreas(projectId);
        const storedVisibleIds = localStorage.getItem(`marketAreas.${projectId}.visible`);

        if (storedVisibleIds) {
          const visibleIds = JSON.parse(storedVisibleIds);
          setVisibleMarketAreaIds(visibleIds);
        } else {
          const allIds = marketAreas.map((ma) => ma.id);
          setVisibleMarketAreaIds(allIds);
          localStorage.setItem(
            `marketAreas.${projectId}.visible`,
            JSON.stringify(allIds)
          );
        }
      } finally {
        setHasAttemptedFetch(true);
      }
    };

    loadMarketAreas();
  }, [projectId, hasAttemptedFetch, fetchMarketAreas, marketAreas]);

  useEffect(() => {
    const showVisibleMarketAreas = async () => {
      // Skip if we're in edit mode or if marketAreas isn't loaded yet
      if (!marketAreas.length || isEditingRef.current) {
        return;
      }

      console.log("[MarketAreaList] Rendering visible market areas:", {
        visibleCount: visibleMarketAreaIds.length,
        visibleIds: visibleMarketAreaIds
      });

      // First, clear all market area graphics to start fresh
      await clearMarketAreaGraphics();

      // Sort by order, higher order (more recent) on top
      const sortedMarketAreas = [...marketAreas]
        .sort((a, b) => a.order - b.order)
        .reverse();

      // Process each market area, but ONLY if it's in the visibleMarketAreaIds
      for (const marketArea of sortedMarketAreas) {
        // Double-check that this market area is still supposed to be visible
        // This prevents race conditions when toggling visibility rapidly
        if (!visibleMarketAreaIds.includes(marketArea.id)) {
          console.log(`[MarketAreaList] Skipping hidden market area: ${marketArea.id}`);
          continue;
        }

        try {
          if (marketArea.ma_type === "radius" && marketArea.radius_points) {
            // Process radius points
            let radiusPoints;
            try {
              radiusPoints = typeof marketArea.radius_points === 'string'
                ? JSON.parse(marketArea.radius_points)
                : marketArea.radius_points;
            } catch (err) {
              console.warn("[MarketAreaList] Could not parse radius_points:", err);
              radiusPoints = marketArea.radius_points;
            }

            const points = Array.isArray(radiusPoints)
              ? radiusPoints
              : [radiusPoints].filter(Boolean);

            for (const point of points) {
              const drawPoint = transformRadiusPoint(point, marketArea.id);

              if (drawPoint &&
                !isNaN(drawPoint.center.x) &&
                !isNaN(drawPoint.center.y)) {
                await drawRadius(
                  drawPoint,
                  marketArea.style_settings,
                  marketArea.id,
                  marketArea.order
                );
              }
            }
          }
          // Handle drive time areas
          else if (marketArea.ma_type === "drivetime") {
            // Process drive time points
            let driveTimePoints;
            try {
              driveTimePoints = typeof marketArea.drive_time_points === 'string'
                ? JSON.parse(marketArea.drive_time_points)
                : marketArea.drive_time_points;
            } catch (err) {
              console.warn("[MarketAreaList] Could not parse drive_time_points:", err);
              driveTimePoints = marketArea.drive_time_points;
            }

            // If missing drive_time_points, try other sources like geometry
            if (!driveTimePoints && marketArea.geometry) {
              try {
                const geo = marketArea.geometry;

                if (geo.rings && geo.rings.length > 0) {
                  // Calculate a simple centroid from the first ring
                  const points = geo.rings[0];
                  let sumX = 0, sumY = 0;

                  for (const point of points) {
                    sumX += point[0];
                    sumY += point[1];
                  }

                  const centerX = sumX / points.length;
                  const centerY = sumY / points.length;

                  driveTimePoints = [{
                    center: {
                      longitude: centerX,
                      latitude: centerY
                    },
                    timeRanges: [15], // Default 15 min
                    polygon: geo
                  }];
                }
              } catch (err) {
                console.warn("[MarketAreaList] Failed to extract drive time points from geometry:", err);
              }
            }

            const points = Array.isArray(driveTimePoints)
              ? driveTimePoints
              : driveTimePoints ? [driveTimePoints] : [];

            for (const point of points) {
              const drawPoint = transformDriveTimePoint(point, marketArea.id);

              if (drawPoint &&
                !isNaN(drawPoint.center.longitude) &&
                !isNaN(drawPoint.center.latitude)) {

                // Create a copy that will work with drawDriveTimePolygon
                const cleanPoint = {
                  center: {
                    longitude: drawPoint.center.longitude,
                    latitude: drawPoint.center.latitude,
                    spatialReference: drawPoint.center.spatialReference
                  },
                  travelTimeMinutes: drawPoint.travelTimeMinutes || drawPoint.timeRanges?.[0] || 15,
                  // Include the pre-existing polygon if available
                  polygon: drawPoint.polygon || point.polygon || point.driveTimePolygon
                };

                await drawDriveTimePolygon(
                  cleanPoint,
                  {
                    fillColor: marketArea.style_settings?.fillColor || "#0078D4",
                    fillOpacity: marketArea.style_settings?.noFill ? 0 : (marketArea.style_settings?.fillOpacity || 0.35),
                    borderColor: marketArea.style_settings?.borderColor || "#0078D4",
                    borderWidth: marketArea.style_settings?.noBorder ? 0 : (marketArea.style_settings?.borderWidth || 3)
                  },
                  marketArea.id,
                  marketArea.order || 0
                );
              }
            }
          }
          // Handle site location market areas
          else if (marketArea.ma_type === "site_location") {
            console.log("[MarketAreaList] Processing site location market area:", marketArea.id);
            
            // Extract site location information
            const siteData = extractSiteLocationInfo(marketArea);
            
            if (siteData && siteData.point) {
              console.log("[MarketAreaList] Drawing site location:", {
                id: marketArea.id,
                point: siteData.point,
                size: siteData.size,
                color: siteData.color
              });
              
              await drawSiteLocation(
                siteData,
                {
                  fillColor: marketArea.style_settings?.fillColor || siteData.color || "#FFC000",
                  fillOpacity: marketArea.style_settings?.noFill ? 0 : (marketArea.style_settings?.fillOpacity || 0.8),
                  borderColor: marketArea.style_settings?.borderColor || "#000000",
                  borderWidth: marketArea.style_settings?.noBorder ? 0 : (marketArea.style_settings?.borderWidth || 1)
                },
                marketArea.id,
                marketArea.order || 0
              );
            } else {
              console.warn(`[MarketAreaList] Site location market area ${marketArea.id} has no valid site data`);
            }
          }
          else if (marketArea.locations && marketArea.locations.length > 0) {
            // Double-check geometry validity to fix the Accessor errors
            const validFeatures = marketArea.locations
              .filter(loc => loc.geometry && (loc.geometry.rings || loc.geometry.paths))
              .map((loc) => ({
                geometry: loc.geometry,
                attributes: {
                  id: loc.id,
                  marketAreaId: marketArea.id,
                  order: marketArea.order,
                },
              }));

            if (validFeatures.length > 0) {
              await updateFeatureStyles(
                validFeatures,
                {
                  fill: marketArea.style_settings?.fillColor || "#0078D4",
                  fillOpacity: marketArea.style_settings?.noFill ? 0 : (marketArea.style_settings?.fillOpacity || 0.35),
                  outline: marketArea.style_settings?.borderColor || "#0078D4",
                  outlineWidth: marketArea.style_settings?.noBorder ? 0 : (marketArea.style_settings?.borderWidth || 3),
                },
                marketArea.ma_type
              );
            }
          }
        } catch (error) {
          console.error(`[MarketAreaList] Error drawing market area ${marketArea.id}:`, error);
        }
      }
    };

    // Reset editing flag when effect runs
    isEditingRef.current = false;

    // Use a small timeout to batch visibility changes
    const timeoutId = setTimeout(showVisibleMarketAreas, 100);
    return () => clearTimeout(timeoutId);
  }, [
    marketAreas,
    visibleMarketAreaIds,
    hideAllFeatureLayers,
    clearMarketAreaGraphics,
    drawRadius,
    drawDriveTimePolygon,
    drawSiteLocation,
    updateFeatureStyles,
    transformRadiusPoint,
    transformDriveTimePoint,
    extractSiteLocationInfo,
  ]);

  useEffect(() => {
    if (projectId) {
      localStorage.setItem(
        `marketAreas.${projectId}.visible`,
        JSON.stringify(visibleMarketAreaIds)
      );
    }
  }, [visibleMarketAreaIds, projectId]);

  if (isLoading && !hasAttemptedFetch) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-600">{error}</div>;
  }

  // Added permanent display styles to ensure the component always stays open
  return (
    <div className="flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow h-full">
      <div className="p-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={handleToggleAll}
          className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
        >
          {areAllAreasVisible ? "Hide All" : "Show All"}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={marketAreas.map((ma) => ma.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {!Array.isArray(marketAreas) || marketAreas.length === 0 ? (
                <div className="text-center p-4 text-gray-500 dark:text-gray-400 text-sm">
                  No market areas defined yet
                </div>
              ) : (
                marketAreas.map((marketArea) => (
                  <SortableItem
                    key={marketArea.id}
                    marketArea={marketArea}
                    isVisible={visibleMarketAreaIds.includes(marketArea.id)}
                    onToggleVisibility={handleToggleVisibility}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}