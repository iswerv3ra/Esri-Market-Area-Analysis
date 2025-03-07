// src/components/market-areas/DriveTime.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { PlusCircleIcon, TrashIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { useMap } from '../../contexts/MapContext';

export default function DriveTime({ onFormStateChange, styleSettings, existingDriveTimePoints = [] }) {
  const {
    mapView,
    drawDriveTimePolygon,
    calculateDriveTimePolygon,
    selectionGraphicsLayer
  } = useMap();

  const [driveTimePoints, setDriveTimePoints] = useState(existingDriveTimePoints || []);
  const [isPinMode, setIsPinMode] = useState(false);
  const [activeDriveTime, setActiveDriveTime] = useState(15); // Default 15 minutes
  const [clickHandler, setClickHandler] = useState(null);

  useEffect(() => {
    // Update parent component with the current drive time points
    onFormStateChange?.({ driveTimePoints });
  }, [driveTimePoints, onFormStateChange]);

  // Clean up event listener on unmount
  useEffect(() => {
    return () => {
      if (clickHandler) {
        clickHandler.remove();
      }
    };
  }, [clickHandler]);

  // Toggle pin mode (on/off)
  const togglePinMode = useCallback(() => {
    // If turning off, remove any existing handler
    if (isPinMode && clickHandler) {
      clickHandler.remove();
      setClickHandler(null);
    }

    // Toggle state
    setIsPinMode(prev => !prev);
  }, [isPinMode, clickHandler]);

  // Watch pin mode changes
  useEffect(() => {
    // If pin mode is turned on, add a map click handler
    if (isPinMode && mapView && !clickHandler) {
      const handler = mapView.on('click', handleMapClick);
      setClickHandler(handler);
    }
    // If pin mode is turned off, remove the handler
    else if (!isPinMode && clickHandler) {
      clickHandler.remove();
      setClickHandler(null);
    }
  }, [isPinMode, mapView]);

  // Handle clicking on map to place a drive time point
  const handleMapClick = async (event) => {
    try {
      // Get the clicked point
      const { longitude, latitude } = event.mapPoint;

      // Prepare the drive time point
      const newPoint = {
        center: {
          longitude,
          latitude,
          spatialReference: { wkid: 4326 } // WGS84
        },
        travelTimeMinutes: activeDriveTime
      };

      console.log("Calculating drive time polygon for map click at:", {
        longitude: newPoint.center.longitude,
        latitude: newPoint.center.latitude,
        minutes: newPoint.travelTimeMinutes
      });

      // Calculate the drive time polygon
      const driveTimePolygon = await calculateDriveTimePolygon(newPoint);

      // Add the polygon to the point data
      newPoint.driveTimePolygon = driveTimePolygon;

      // Draw on the map
      await drawDriveTimePolygon(
        newPoint,
        styleSettings,
        "temporary", // Using temporary ID until saved
        driveTimePoints.length
      );

      // Add to local state
      setDriveTimePoints(prev => [...prev, newPoint]);

      // Disable point adding mode
      setIsPinMode(false);

      // If we have a click handler, remove it
      if (clickHandler) {
        clickHandler.remove();
        setClickHandler(null);
      }
    } catch (error) {
      console.error('Error adding drive time point:', error);
      setIsPinMode(false);
    }
  };

  // Validate drive time input
  const validateDriveTime = (e) => {
    let value = parseInt(e.target.value) || 0;
    value = Math.min(Math.max(value, 1), 120); // Limit 1-120 minutes
    setActiveDriveTime(value);
  };

  // Handle removing a drive time point
  const handleRemovePoint = useCallback((index) => {
    // First remove the graphics from the map
    if (selectionGraphicsLayer) {
      const graphicsToRemove = selectionGraphicsLayer.graphics.filter(
        g => g.attributes?.FEATURE_TYPE === 'drivetime' &&
          g.attributes?.order === index &&
          g.attributes?.marketAreaId === 'temporary'
      );

      selectionGraphicsLayer.removeMany(graphicsToRemove);
    }

    // Then update state
    setDriveTimePoints(prev => prev.filter((_, i) => i !== index));
  }, [selectionGraphicsLayer]);

  return (
    <div className="space-y-4">
      <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Drive Time Settings
        </h3>

        <div className="flex flex-col space-y-4">
          {/* Drive time controls */}
          {/* Drive time controls */}
          <div className="flex items-center space-x-4">
            <div className="flex-grow">
              <label htmlFor="driveTimeMinutes" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Drive Time (minutes)
              </label>
              <input
                id="driveTimeMinutes"
                type="number"
                min="1"
                max="120"
                value={activeDriveTime}
                onChange={(e) => validateDriveTime(e)}
                // Removed the disabled property so users can set value before placing pin
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 
                bg-white dark:bg-gray-700 py-2 px-3 shadow-sm focus:border-blue-500 
                focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
              />
            </div>

            <button
              type="button"
              onClick={togglePinMode}
              className={`h-10 mt-6 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 
              font-medium rounded-md shadow-sm text-white 
              ${isPinMode
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                }
              focus:outline-none focus:ring-2 focus:ring-offset-2`}
            >
              <MapPinIcon className="w-5 h-5 mr-1" />
              {isPinMode ? 'Cancel Pin' : 'Place Pin'}
            </button>
          </div>

          {/* Instructions */}
          {isPinMode && (
            <div className="bg-blue-50 dark:bg-blue-900 p-3 rounded-md text-sm text-blue-700 dark:text-blue-300">
              Click on the map to place your drive time point
            </div>
          )}
        </div>
      </div>

      {/* List of drive time points */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Drive Time Points
        </h3>

        <div className="border rounded-md overflow-y-auto bg-white dark:bg-gray-700 max-h-60">
          {driveTimePoints.length === 0 ? (
            <p className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
              No drive time points added. Click "Place Pin" and select a location on the map.
            </p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-600">
              {driveTimePoints.map((point, index) => (
                <li key={index} className="px-4 py-3 flex justify-between items-center">
                  <div className="text-sm">
                    <p className="font-medium text-gray-700 dark:text-gray-300">
                      {point.travelTimeMinutes} Minute Drive Time
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      ({point.center.longitude.toFixed(4)}, {point.center.latitude.toFixed(4)})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePoint(index)}
                    className="ml-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}