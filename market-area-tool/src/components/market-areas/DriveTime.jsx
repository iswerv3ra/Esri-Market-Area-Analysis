import { useState, useEffect } from "react";
import { useMap } from "../../contexts/MapContext";
import { toast } from 'react-hot-toast';
import { MapPinIcon, TrashIcon } from "@heroicons/react/24/outline";

export default function DriveTime({ onFormStateChange, styleSettings }) {
  const {
    mapView,
    calculateDriveTime,
    clearSelection
  } = useMap();

  const [formState, setFormState] = useState({
    driveTimePoints: [],
    currentDriveTime: 5,
    isPlacingPin: false,
    isCalculating: false
  });

  // Map click handler for placing pins
  useEffect(() => {
    if (!mapView) {
      console.log("[DriveTime] Map view not initialized");
      return;
    }

    let isCalculating = false; // Local flag to prevent multiple concurrent calculations

    const handleMapClick = async (event) => {
      // Important: Check if we're in pin placement mode and not already calculating
      if (!formState.isPlacingPin || isCalculating) {
        console.log("[DriveTime] Pin placement mode is off or calculation in progress, ignoring click");
        return;
      }

      // Prevent the click from being handled by other event listeners
      event.stopPropagation();

      // Set local calculating flag
      isCalculating = true;
      setFormState(prev => ({ ...prev, isCalculating: true }));

      try {
        const point = {
          longitude: event.mapPoint.longitude,
          latitude: event.mapPoint.latitude
        };

        console.log("[DriveTime] Map clicked:", { coordinates: point });

        const driveTimePoint = {
          center: {
            longitude: point.longitude,
            latitude: point.latitude,
            spatialReference: { wkid: 4326 }
          },
          times: [formState.currentDriveTime]
        };

        // Single attempt with longer timeout
        const success = await Promise.race([
          calculateDriveTime(
            driveTimePoint,
            formState.currentDriveTime,
            styleSettings
          ),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Calculation timeout')), 20000)
          )
        ]);

        if (success) {
          setFormState(prev => ({
            ...prev,
            driveTimePoints: [...prev.driveTimePoints, driveTimePoint],
            isPlacingPin: false,
            isCalculating: false
          }));

          onFormStateChange({
            driveTimePoints: [...formState.driveTimePoints, driveTimePoint]
          });

          toast.success('Drive time area created successfully');
        } else {
          throw new Error('Failed to calculate drive time area');
        }
      } catch (error) {
        console.error("[DriveTime] Error calculating drive time:", error);
        // Enhanced error message handling
        let errorMessage;
        if (error.message.includes('zoom')) {
          errorMessage = error.message + '\nPlease zoom in further and try again.';
        } else if (error.message.includes('Service error:')) {
          errorMessage = error.message;
        } else if (error.message.includes('timeout')) {
          errorMessage = 'The calculation timed out. Please try a location closer to a road network.';
        } else if (error.message.includes('inaccessible') || error.message.includes('road')) {
          errorMessage = 'Unable to calculate drive time. Please try:\n' +
                        '• Clicking closer to a visible road\n' +
                        '• Using a shorter drive time\n' +
                        '• Zooming in to see more roads';
        } else {
          errorMessage = 'Unable to calculate drive time. Please try clicking closer to a road.';
        }
        
        toast.error(errorMessage, { 
          duration: 7000,
          style: {
            maxWidth: '400px',
            padding: '16px',
            whiteSpace: 'pre-line'
          }
        });

        setFormState(prev => ({ 
          ...prev, 
          isCalculating: false,
          isPlacingPin: false 
        }));
      } finally {
        isCalculating = false; // Reset local calculating flag
      }
    };

    console.log("[DriveTime] Setting up map click handler");
    const clickHandler = mapView.on("click", handleMapClick);

    return () => {
      console.log("[DriveTime] Cleaning up map click handler");
      if (clickHandler) {
        clickHandler.remove();
      }
    };
  }, [mapView, formState.isPlacingPin, formState.currentDriveTime, calculateDriveTime, styleSettings, onFormStateChange]);

  // Handle adding a new drive time to the last point
  const addCurrentDriveTime = async () => {
    if (!formState.driveTimePoints.length) {
      toast.error('No points available to add drive time');
      return;
    }

    console.log("[DriveTime] Adding new drive time to last point");
    setFormState(prev => ({ ...prev, isCalculating: true }));

    const pointIndex = formState.driveTimePoints.length - 1;
    const point = formState.driveTimePoints[pointIndex];

    if (point.times.includes(formState.currentDriveTime)) {
      toast.error('This drive time already exists for this point');
      setFormState(prev => ({ ...prev, isCalculating: false }));
      return;
    }

    try {
      const success = await calculateDriveTime(
        {
          center: point.center,
          times: [...point.times, formState.currentDriveTime]
        },
        formState.currentDriveTime,
        styleSettings
      );

      if (success) {
        const updatedPoints = [...formState.driveTimePoints];
        updatedPoints[pointIndex] = {
          ...point,
          times: [...point.times, formState.currentDriveTime].sort((a, b) => a - b)
        };

        setFormState(prev => ({
          ...prev,
          driveTimePoints: updatedPoints,
          isCalculating: false
        }));

        onFormStateChange({ driveTimePoints: updatedPoints });
        toast.success('New drive time added successfully');
      } else {
        throw new Error('Failed to add new drive time');
      }
    } catch (error) {
      console.error("[DriveTime] Error adding drive time:", error);
      toast.error('Error adding drive time. Please try again.');
      setFormState(prev => ({ ...prev, isCalculating: false }));
    }
  };

  // Remove an entire point and its drive times
  const removeDriveTimePoint = (pointIndex) => {
    console.log("[DriveTime] Removing point at index:", pointIndex);
    
    const updatedPoints = formState.driveTimePoints.filter((_, i) => i !== pointIndex);
    setFormState(prev => ({
      ...prev,
      driveTimePoints: updatedPoints
    }));

    // Clear and redraw remaining points
    clearSelection();
    
    try {
      updatedPoints.forEach(point => {
        point.times.forEach(time => {
          calculateDriveTime(
            { center: point.center, times: point.times },
            time,
            styleSettings
          );
        });
      });

      onFormStateChange({ driveTimePoints: updatedPoints });
      toast.success('Point removed successfully');
    } catch (error) {
      console.error("[DriveTime] Error redrawing points after removal:", error);
      toast.error('Error redrawing remaining points');
    }
  };

  // Remove a specific drive time from a point
  const removeDriveTime = (pointIndex, timeIndex) => {
    console.log("[DriveTime] Removing drive time:", { pointIndex, timeIndex });
    
    const updatedPoints = [...formState.driveTimePoints];
    const point = updatedPoints[pointIndex];
    const newTimes = point.times.filter((_, i) => i !== timeIndex);

    try {
      if (newTimes.length === 0) {
        // If no times left, remove the entire point
        updatedPoints.splice(pointIndex, 1);
      } else {
        // Otherwise, update the times array
        updatedPoints[pointIndex] = {
          ...point,
          times: newTimes
        };
      }

      setFormState(prev => ({
        ...prev,
        driveTimePoints: updatedPoints
      }));

      // Clear and redraw remaining points
      clearSelection();
      updatedPoints.forEach(point => {
        point.times.forEach(time => {
          calculateDriveTime(
            { center: point.center, times: point.times },
            time,
            styleSettings
          );
        });
      });

      onFormStateChange({ driveTimePoints: updatedPoints });
      toast.success('Drive time removed successfully');
    } catch (error) {
      console.error("[DriveTime] Error removing drive time:", error);
      toast.error('Error removing drive time');
    }
  };

  // Toggle pin placement mode
  const togglePinPlacement = () => {
    console.log("[DriveTime] Toggling pin placement mode");
    setFormState(prev => ({
      ...prev,
      isPlacingPin: !prev.isPlacingPin
    }));

    if (!formState.isPlacingPin) {
      toast.success('Click on the map to place a drive time point');
    }
  };

  // Update drive time value
  const handleDriveTimeChange = (e) => {
    const value = parseInt(e.target.value) || 1;
    const clampedValue = Math.min(60, Math.max(1, value));
    
    setFormState(prev => ({
      ...prev,
      currentDriveTime: clampedValue
    }));
  };

  return (
    <div className="space-y-6">
      {/* Drive Time Controls */}
      <div className="space-y-4 p-4 border rounded-md">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            Drive Time Settings
          </h3>
          <button
            type="button"
            onClick={togglePinPlacement}
            disabled={formState.isCalculating}
            className={`${
              formState.isPlacingPin
                ? "bg-red-100 text-red-700 hover:bg-red-200"
                : "bg-blue-100 text-blue-700 hover:bg-blue-200"
            } inline-flex items-center px-4 py-2 rounded-md text-sm font-medium
            ${formState.isCalculating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <MapPinIcon className="h-5 w-5 mr-2" />
            {formState.isCalculating ? 'Calculating...' : 
             formState.isPlacingPin ? "Cancel Pin" : "Place Pin"}
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm text-gray-700 dark:text-gray-300">
              Drive Time (minutes)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={formState.currentDriveTime}
              onChange={handleDriveTimeChange}
              disabled={formState.isCalculating}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 
                     bg-white dark:bg-gray-700 py-2 px-3 shadow-sm focus:border-green-500 
                     focus:outline-none focus:ring-1 focus:ring-green-500 dark:text-white
                     disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <button
            type="button"
            onClick={addCurrentDriveTime}
            disabled={!formState.driveTimePoints.length || formState.isCalculating}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 
                     disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {formState.isCalculating ? 'Adding...' : 'Add Drive Time'}
          </button>
        </div>

        {formState.isPlacingPin && (
          <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900 rounded-md">
            <p className="text-sm text-blue-700 dark:text-blue-200">
              Click on the map to place a drive time point
            </p>
          </div>
        )}
      </div>

      {/* Points and Drive Times List */}
      <div className="border rounded-md overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            Defined Points and Drive Times
          </h3>
        </div>
        <div className="divide-y">
          {formState.driveTimePoints.map((point, pointIndex) => (
            <div key={pointIndex} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Point {pointIndex + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeDriveTimePoint(pointIndex)}
                  disabled={formState.isCalculating}
                  className="text-red-600 hover:text-red-700 disabled:text-gray-400
                           disabled:cursor-not-allowed inline-flex items-center"
                >
                  <TrashIcon className="h-4 w-4 mr-1" />
                  Remove Point
                </button>
              </div>
              <div className="pl-4 space-y-1">
                {point.times.map((time, timeIndex) => (
                  <div
                    key={timeIndex}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{time} minutes</span>
                    <button
                      type="button"
                      onClick={() => removeDriveTime(pointIndex, timeIndex)}
                      disabled={formState.isCalculating}
                      className="text-gray-600 hover:text-red-600 
                               disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!formState.driveTimePoints.length && (
            <div className="p-4 text-center text-gray-500">
              Place a pin on the map to define drive time points
            </div>
          )}
        </div>
      </div>
    </div>
  );
}