import { useState, useEffect, useMemo } from "react";
import { MapPinIcon } from "@heroicons/react/24/outline";
import { useMap } from "../../contexts/MapContext";
import { toast } from "react-hot-toast";

export default function Radius({
  onFormStateChange,
  styleSettings,
  existingRadiusPoints = []
}) {
  const { mapView, clearSelection, drawRadius } = useMap();

  // Use useMemo to normalize points only when existingRadiusPoints changes
  const normalizedPoints = useMemo(() => {
    const normalizePoint = (point) => {
      if (!point) return null;
      
      const center = point.center ? {
        longitude: Number(point.center.longitude || point.center.x || point.center[0]),
        latitude: Number(point.center.latitude || point.center.y || point.center[1]),
        spatialReference: point.center.spatialReference || { wkid: 4326 }
      } : null;
      
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
    };

    return existingRadiusPoints.map(normalizePoint).filter(Boolean);
  }, [existingRadiusPoints]);

  const [formState, setFormState] = useState({
    radiusPoints: normalizedPoints,
    currentRadius: normalizedPoints.length > 0 
      ? (normalizedPoints[0].radii[0]?.toString() || "1")
      : "10",
    selectedPinIndex: normalizedPoints.length > 0 ? 0 : null,
    isPlacingPin: false,
  });


  useEffect(() => {
    if (!mapView) return;

    const handleMapClick = (event) => {
      if (!formState.isPlacingPin) return;

      const parsedRadius = parseFloat(formState.currentRadius);
      if (isNaN(parsedRadius) || parsedRadius <= 0) {
        toast.error("Please enter a valid positive radius");
        return;
      }

      const point = {
        center: {
          longitude: event.mapPoint.longitude,
          latitude: event.mapPoint.latitude,
          spatialReference: event.mapPoint.spatialReference
        },
        radii: [parsedRadius],
        units: 'miles'
      };

      // Instead of drawing, update the state and let parent handle drawing
      setFormState(prev => {
        const newPoints = [point];
        
        // Notify parent about state change
        onFormStateChange({ radiusPoints: newPoints });
        
        return {
          ...prev,
          radiusPoints: newPoints,
          isPlacingPin: false,
          selectedPinIndex: 0,
          currentRadius: parsedRadius.toString()
        };
      });

      toast.success("Pin placed successfully");
    };

    const clickHandler = mapView.on("click", handleMapClick);
    return () => clickHandler.remove();
  }, [mapView, formState.isPlacingPin, formState.currentRadius, onFormStateChange]);

  const updateRadius = async (pointIndex, newRadius) => {
    const parsedRadius = parseFloat(newRadius);
    if (isNaN(parsedRadius) || parsedRadius <= 0) {
      toast.error("Please enter a valid positive radius");
      return;
    }

    setFormState(prev => {
      const updatedPoints = [...prev.radiusPoints];
      const existingPoint = updatedPoints[pointIndex];
      
      const updatedPoint = {
        ...existingPoint,
        radii: [parsedRadius]
      };

      updatedPoints[pointIndex] = updatedPoint;
      
      // Notify parent about state change
      onFormStateChange({ radiusPoints: updatedPoints });

      return {
        ...prev,
        radiusPoints: updatedPoints,
        currentRadius: parsedRadius.toString()
      };
    });

    toast.success("Radius updated successfully");
  };

  const removeRadiusPoint = async () => {
    try {
      // Clear all points
      setFormState(prev => ({
        ...prev,
        radiusPoints: [],
        selectedPinIndex: null,
        currentRadius: "10"
      }));

      // Clear selection and graphics
      clearSelection();

      onFormStateChange({ radiusPoints: [] });
      toast.success("Point removed successfully");
    } catch (error) {
      console.error("Error removing radius point:", error);
      toast.error("Failed to remove radius point");
    }
  };

  const togglePinPlacement = () => {
    setFormState(prev => ({
      ...prev,
      isPlacingPin: !prev.isPlacingPin,
      selectedPinIndex: null,
    }));

    if (!formState.isPlacingPin) {
      toast.success("Click on the map to place a new pin");
    }
  };

  const handleRadiusChange = (e) => {
    const value = e.target.value;
    setFormState(prev => ({
      ...prev,
      currentRadius: value,
    }));
  };

  const handleRadiusUpdate = async () => {
    // Since we now always have a single point or no point, update the existing point
    if (formState.radiusPoints.length > 0) {
      await updateRadius(0, formState.currentRadius);
    }
  };

  // Redraw points when style changes
  useEffect(() => {
    const redrawPoints = async () => {
      if (formState.radiusPoints.length === 0) return;

      try {
        clearSelection();
        
        for (const point of formState.radiusPoints) {
          await drawRadius(
            point, 
            styleSettings, 
            null, 
            0
          );
        }
      } catch (error) {
        console.error("Error redrawing points:", error);
        toast.error("Failed to redraw some points");
      }
    };

    redrawPoints();
  }, [styleSettings, clearSelection, formState.radiusPoints, drawRadius]);

  const formatCoordinates = (center) => {
    if (!center) return "N/A";
    return `(${Number(center.longitude).toFixed(6)}, ${Number(center.latitude).toFixed(6)})`;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4 p-4 border rounded-md">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            Radius Settings
          </h3>
          <button
            type="button"
            onClick={togglePinPlacement}
            className={`${
              formState.isPlacingPin
                ? "bg-red-100 text-red-700 hover:bg-red-200"
                : "bg-blue-100 text-blue-700 hover:bg-blue-200"
            } inline-flex items-center px-4 py-2 rounded-md text-sm font-medium`}
          >
            <MapPinIcon className="h-5 w-5 mr-2" />
            {formState.isPlacingPin ? "Cancel Pin" : "Place Pin"}
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm text-gray-700 dark:text-gray-300">
              Radius (miles)
            </label>
            <input
              type="text"
              value={formState.currentRadius}
              onChange={handleRadiusChange}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 
                bg-white dark:bg-gray-700 py-2 px-3 shadow-sm focus:border-green-500 
                focus:outline-none focus:ring-1 focus:ring-green-500 dark:text-white"
              placeholder="Enter radius in miles"
            />
          </div>
          <button
            type="button"
            onClick={handleRadiusUpdate}
            disabled={formState.radiusPoints.length === 0}
            className={`px-4 py-2 text-white rounded-md whitespace-nowrap
              ${
                formState.radiusPoints.length === 0
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700"
              }`}
          >
            Update Selected Point
          </button>
        </div>
      </div>

      <div className="border rounded-md overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            Defined Points
          </h3>
        </div>
        <div className="divide-y">
          {formState.radiusPoints.map((point, pointIndex) => (
            <div
              key={pointIndex}
              className="p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Point {pointIndex + 1} (Selected)
                </span>
                <button
                  type="button"
                  onClick={removeRadiusPoint}
                  className="text-red-600 hover:text-red-700"
                >
                  Remove Point
                </button>
              </div>
              <div className="pl-4">
                <div className="text-sm">
                  Radius: {point.radii[0]} miles
                </div>
                <div className="text-xs text-gray-500">
                  Coordinates: {formatCoordinates(point.center)}
                </div>
              </div>
            </div>
          ))}
          {!formState.radiusPoints.length && (
            <div className="p-4 text-center text-gray-500">
              Place a pin on the map to define radius points
            </div>
          )}
        </div>
      </div>
    </div>
  );
}