// src/components/market-areas/Radius.jsx
import { useState, useEffect } from "react";
import { MapPinIcon } from "@heroicons/react/24/outline";
import { useMap } from "../../contexts/MapContext";

export default function Radius({ onFormStateChange, styleSettings }) {
  const {
    mapView,
    drawRadius,
    clearSelection
  } = useMap();

  const [formState, setFormState] = useState({
    radiusPoints: [], // Array of {center: Point, radii: number[]} objects
    currentRadius: 1, // Default 1-mile radius
    selectedPinIndex: null, // For tracking selected pin
    isPlacingPin: false
  });

  // Map click handler for placing pins
  useEffect(() => {
    if (!mapView) return;

    const handleMapClick = async (event) => {
      if (!formState.isPlacingPin) return;

      try {
        const point = {
          center: event.mapPoint,
          radii: [formState.currentRadius]
        };

        await drawRadius(point, styleSettings);

        setFormState(prev => ({
          ...prev,
          radiusPoints: [...prev.radiusPoints, point],
          isPlacingPin: false
        }));

        // Notify parent of state change
        onFormStateChange({
          radiusPoints: [...formState.radiusPoints, point]
        });
      } catch (error) {
        console.error("Error handling map click:", error);
      }
    };

    const clickHandler = mapView.on("click", handleMapClick);

    return () => {
      clickHandler.remove();
    };
  }, [mapView, formState.isPlacingPin, formState.currentRadius, formState.radiusPoints, drawRadius, styleSettings, onFormStateChange]);

  // Add radius to selected or last point
  const addCurrentRadius = () => {
    if (!formState.radiusPoints.length) return;

    const updatedPoints = [...formState.radiusPoints];
    const targetIndex = formState.selectedPinIndex !== null
      ? formState.selectedPinIndex
      : updatedPoints.length - 1;
    const targetPoint = updatedPoints[targetIndex];

    if (!targetPoint.radii.includes(formState.currentRadius)) {
      targetPoint.radii.push(formState.currentRadius);
      targetPoint.radii.sort((a, b) => a - b);

      drawRadius(
        {
          center: targetPoint.center,
          radii: [formState.currentRadius]
        },
        styleSettings
      );

      setFormState(prev => ({
        ...prev,
        radiusPoints: updatedPoints
      }));

      // Notify parent of state change
      onFormStateChange({ radiusPoints: updatedPoints });
    }
  };

  // Remove an entire point and its radii
  const removeRadiusPoint = (pointIndex) => {
    const updatedPoints = formState.radiusPoints.filter((_, i) => i !== pointIndex);
    
    setFormState(prev => ({
      ...prev,
      radiusPoints: updatedPoints,
      selectedPinIndex: null
    }));

    // Clear and redraw remaining points
    clearSelection();
    updatedPoints.forEach(point => {
      drawRadius(point, styleSettings);
    });

    // Notify parent of state change
    onFormStateChange({ radiusPoints: updatedPoints });
  };

  // Remove a specific radius from a point
  const removeRadius = (pointIndex, radiusIndex) => {
    const updatedPoints = [...formState.radiusPoints];
    const point = updatedPoints[pointIndex];
    const newRadii = point.radii.filter((_, i) => i !== radiusIndex);

    if (newRadii.length === 0) {
      // If no radii left, remove the entire point
      updatedPoints.splice(pointIndex, 1);
      setFormState(prev => ({
        ...prev,
        radiusPoints: updatedPoints,
        selectedPinIndex: null
      }));
    } else {
      // Update the radii array
      updatedPoints[pointIndex] = {
        ...point,
        radii: newRadii
      };
      setFormState(prev => ({
        ...prev,
        radiusPoints: updatedPoints
      }));
    }

    // Clear and redraw remaining points
    clearSelection();
    updatedPoints.forEach(point => {
      drawRadius(point, styleSettings);
    });

    // Notify parent of state change
    onFormStateChange({ radiusPoints: updatedPoints });
  };

  // Handle pin selection
  const handlePinSelect = (pointIndex) => {
    setFormState(prev => ({
      ...prev,
      selectedPinIndex: prev.selectedPinIndex === pointIndex ? null : pointIndex,
      isPlacingPin: false
    }));
  };

  // Toggle pin placement mode
  const togglePinPlacement = () => {
    setFormState(prev => ({
      ...prev,
      isPlacingPin: !prev.isPlacingPin,
      selectedPinIndex: null // Clear selection when placing new pin
    }));
  };

  // Update radius value
  const handleRadiusChange = (e) => {
    const value = parseFloat(e.target.value) || 0;
    setFormState(prev => ({
      ...prev,
      currentRadius: Math.max(0.1, value)
    }));
  };

  // Redraw points when style changes
  useEffect(() => {
    if (formState.radiusPoints.length > 0) {
      clearSelection();
      formState.radiusPoints.forEach(point => {
        drawRadius(point, styleSettings);
      });
    }
  }, [styleSettings, clearSelection, drawRadius]);

  return (
    <div className="space-y-6">
      {/* Radius Controls */}
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
              type="number"
              min="0.1"
              step="0.1"
              value={formState.currentRadius}
              onChange={handleRadiusChange}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 
                bg-white dark:bg-gray-700 py-2 px-3 shadow-sm focus:border-green-500 
                focus:outline-none focus:ring-1 focus:ring-green-500 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={addCurrentRadius}
            disabled={
              !formState.radiusPoints.length ||
              (formState.selectedPinIndex === null && formState.isPlacingPin)
            }
            className={`px-4 py-2 text-white rounded-md whitespace-nowrap
              ${
                !formState.radiusPoints.length ||
                (formState.selectedPinIndex === null && formState.isPlacingPin)
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700"
              }`}
          >
            {formState.selectedPinIndex !== null
              ? `Add Radius to Point ${formState.selectedPinIndex + 1}`
              : "Add Radius to Last Point"}
          </button>
        </div>
      </div>

      {/* Pins and Radii List */}
      <div className="border rounded-md overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            Defined Points and Radii
          </h3>
        </div>
        <div className="divide-y">
          {formState.radiusPoints.map((point, pointIndex) => (
            <div
              key={pointIndex}
              className={`p-4 space-y-2 cursor-pointer ${
                formState.selectedPinIndex === pointIndex
                  ? "bg-blue-50 dark:bg-blue-900"
                  : "hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
              onClick={() => handlePinSelect(pointIndex)}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Point {pointIndex + 1} {" "}
                  {formState.selectedPinIndex === pointIndex && "(Selected)"}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRadiusPoint(pointIndex);
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  Remove Point
                </button>
              </div>
              <div className="pl-4 space-y-1">
                {point.radii.map((radius, radiusIndex) => (
                  <div
                    key={radiusIndex}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{radius} miles</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRadius(pointIndex, radiusIndex);
                      }}
                      className="text-gray-600 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
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