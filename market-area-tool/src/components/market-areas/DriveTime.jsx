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
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Update parent component with the current drive time points
    onFormStateChange?.({ driveTimePoints });
  }, [driveTimePoints, onFormStateChange]);

  // Clean up event listener on unmount
  useEffect(() => {
    return () => {
      if (clickHandler) {
        try {
          clickHandler.remove();
        } catch (error) {
          console.warn('Error removing click handler:', error);
        }
      }
    };
  }, [clickHandler]);

  // Toggle pin mode (on/off)
  const togglePinMode = useCallback(() => {
    // Prevent toggling while processing
    if (isProcessing) {
      console.log('Cannot toggle pin mode while processing');
      return;
    }

    // Validate that map context is available before enabling pin mode
    if (!isPinMode && (!mapView || !drawDriveTimePolygon || !calculateDriveTimePolygon)) {
      console.error('Map context not fully initialized. Cannot enable pin mode.');
      alert('Map is not ready yet. Please wait a moment and try again.');
      return;
    }

    // If turning off, remove any existing handler
    if (isPinMode && clickHandler) {
      try {
        clickHandler.remove();
        setClickHandler(null);
      } catch (error) {
        console.warn('Error removing click handler during toggle:', error);
        setClickHandler(null); // Still clear the reference
      }
    }

    // Toggle state
    setIsPinMode(prev => !prev);
  }, [isPinMode, clickHandler, mapView, drawDriveTimePolygon, calculateDriveTimePolygon, isProcessing]);

  // Watch pin mode changes
  useEffect(() => {
    // If pin mode is turned on, add a map click handler
    if (isPinMode && mapView && !clickHandler && !isProcessing) {
      try {
        const handler = mapView.on('click', handleMapClick);
        setClickHandler(handler);
        console.log('Added map click handler for drive time placement');
      } catch (error) {
        console.error('Error adding map click handler:', error);
        setIsPinMode(false); // Reset pin mode if handler creation fails
      }
    }
    // If pin mode is turned off, remove the handler
    else if (!isPinMode && clickHandler) {
      try {
        clickHandler.remove();
        setClickHandler(null);
        console.log('Removed map click handler');
      } catch (error) {
        console.warn('Error removing click handler:', error);
        setClickHandler(null); // Still clear the reference
      }
    }
  }, [isPinMode, mapView, clickHandler, isProcessing]);

  // Handle clicking on map to place a drive time point
  const handleMapClick = async (event) => {
    // Prevent multiple simultaneous processing
    if (isProcessing) {
      console.log('Already processing a drive time point, ignoring click');
      return;
    }

    setIsProcessing(true);

    try {
      // Comprehensive validation of map context and event
      if (!mapView) {
        throw new Error('MapView is not available');
      }

      if (!event || !event.mapPoint) {
        throw new Error('Invalid map click event');
      }

      if (!drawDriveTimePolygon || !calculateDriveTimePolygon) {
        throw new Error('Map drawing functions are not available');
      }

      // Get the clicked point with validation
      const { longitude, latitude } = event.mapPoint;
      
      if (isNaN(longitude) || isNaN(latitude)) {
        throw new Error('Invalid coordinates from map click');
      }

      console.log("Processing map click for drive time at:", {
        longitude,
        latitude,
        minutes: activeDriveTime
      });

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

      // Calculate the drive time polygon with timeout protection
      const calculationPromise = calculateDriveTimePolygon(newPoint);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Drive time calculation timeout')), 30000); // 30 second timeout
      });

      const driveTimePolygon = await Promise.race([calculationPromise, timeoutPromise]);

      if (!driveTimePolygon) {
        throw new Error('Failed to calculate drive time polygon');
      }

      // Add the polygon to the point data
      newPoint.driveTimePolygon = driveTimePolygon;

      // Validate style settings
      const safeStyleSettings = {
        fillColor: styleSettings?.fillColor || "#0078D4",
        fillOpacity: styleSettings?.fillOpacity !== undefined ? styleSettings.fillOpacity : 0.35,
        borderColor: styleSettings?.borderColor || "#0078D4",
        borderWidth: styleSettings?.borderWidth !== undefined ? styleSettings.borderWidth : 3,
        noFill: styleSettings?.noFill || false,
        noBorder: styleSettings?.noBorder || false
      };

      console.log("Drawing drive time polygon with validated style settings:", safeStyleSettings);

      // Draw on the map with error handling
      try {
        await drawDriveTimePolygon(
          newPoint,
          safeStyleSettings,
          "temporary", // Using temporary ID until saved
          driveTimePoints.length
        );
      } catch (drawError) {
        console.error('Error drawing drive time polygon:', drawError);
        throw new Error(`Failed to draw on map: ${drawError.message}`);
      }

      // Add to local state
      setDriveTimePoints(prev => [...prev, newPoint]);

      console.log("Successfully added drive time point");

      // Disable point adding mode
      setIsPinMode(false);

      // If we have a click handler, remove it
      if (clickHandler) {
        try {
          clickHandler.remove();
          setClickHandler(null);
        } catch (error) {
          console.warn('Error removing click handler after successful placement:', error);
          setClickHandler(null);
        }
      }

    } catch (error) {
      console.error('Error adding drive time point:', error);
      
      // Show user-friendly error message
      let errorMessage = 'Failed to add drive time point. ';
      if (error.message.includes('MapView')) {
        errorMessage += 'Map is not ready. Please try again.';
      } else if (error.message.includes('timeout')) {
        errorMessage += 'The service took too long to respond. Please try again.';
      } else if (error.message.includes('coordinates')) {
        errorMessage += 'Invalid location selected. Please click on a valid map area.';
      } else {
        errorMessage += 'Please check your internet connection and try again.';
      }
      
      alert(errorMessage);
      
      // Always disable pin mode on error
      setIsPinMode(false);
      
      // Clean up click handler on error
      if (clickHandler) {
        try {
          clickHandler.remove();
          setClickHandler(null);
        } catch (cleanupError) {
          console.warn('Error cleaning up click handler after error:', cleanupError);
          setClickHandler(null);
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Validate drive time input
  const validateDriveTime = (e) => {
    let value = parseInt(e.target.value) || 1; // Default to 1 if invalid
    value = Math.min(Math.max(value, 1), 120); // Limit 1-120 minutes
    setActiveDriveTime(value);
  };

  // Handle removing a drive time point
  const handleRemovePoint = useCallback((index) => {
    if (isProcessing) {
      console.log('Cannot remove point while processing');
      return;
    }

    try {
      // First remove the graphics from the map
      if (selectionGraphicsLayer && !selectionGraphicsLayer.destroyed) {
        const graphicsToRemove = selectionGraphicsLayer.graphics.filter(
          g => g.attributes?.FEATURE_TYPE === 'drivetime' &&
            g.attributes?.order === index &&
            g.attributes?.marketAreaId === 'temporary'
        );

        if (graphicsToRemove.length > 0) {
          selectionGraphicsLayer.removeMany(graphicsToRemove);
          console.log(`Removed ${graphicsToRemove.length} drive time graphics from map`);
        }
      }

      // Then update state
      setDriveTimePoints(prev => prev.filter((_, i) => i !== index));
      console.log(`Removed drive time point at index ${index}`);

    } catch (error) {
      console.error('Error removing drive time point:', error);
      // Still try to update state even if map removal fails
      setDriveTimePoints(prev => prev.filter((_, i) => i !== index));
    }
  }, [selectionGraphicsLayer, isProcessing]);

  // Check if map context is ready
  const isMapReady = mapView && drawDriveTimePolygon && calculateDriveTimePolygon && !mapView.destroyed;

  return (
    <div className="space-y-4">
      <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Drive Time Settings
        </h3>

        <div className="flex flex-col space-y-4">
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
                onChange={validateDriveTime}
                disabled={isProcessing}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 
                bg-white dark:bg-gray-700 py-2 px-3 shadow-sm focus:border-blue-500 
                focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white
                disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <button
              type="button"
              onClick={togglePinMode}
              disabled={!isMapReady || isProcessing}
              className={`h-10 mt-6 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 
              font-medium rounded-md shadow-sm text-white transition-colors duration-200
              ${!isMapReady || isProcessing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : isPinMode
                    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                }
              focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50`}
            >
              <MapPinIcon className="w-5 h-5 mr-1" />
              {isProcessing ? 'Processing...' : isPinMode ? 'Cancel Pin' : 'Place Pin'}
            </button>
          </div>

          {/* Map readiness status */}
          {!isMapReady && (
            <div className="bg-yellow-50 dark:bg-yellow-900 p-3 rounded-md text-sm text-yellow-700 dark:text-yellow-300">
              Map is loading... Please wait before placing drive time points.
            </div>
          )}

          {/* Instructions */}
          {isPinMode && isMapReady && (
            <div className="bg-blue-50 dark:bg-blue-900 p-3 rounded-md text-sm text-blue-700 dark:text-blue-300">
              Click on the map to place your {activeDriveTime}-minute drive time point
            </div>
          )}

          {/* Processing indicator */}
          {isProcessing && (
            <div className="bg-blue-50 dark:bg-blue-900 p-3 rounded-md text-sm text-blue-700 dark:text-blue-300">
              Calculating drive time area... Please wait.
            </div>
          )}
        </div>
      </div>

      {/* List of drive time points */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Drive Time Points ({driveTimePoints.length})
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
                    {point.driveTimePolygon && (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        ✓ Area calculated
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePoint(index)}
                    disabled={isProcessing}
                    className="ml-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 
                    disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
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