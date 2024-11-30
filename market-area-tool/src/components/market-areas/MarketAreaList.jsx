// src/components/market-areas/MarketAreaList.jsx

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMarketAreas } from '../../contexts/MarketAreaContext';
import { useMap } from '../../contexts/MapContext';
import { 
  PencilIcon, 
  TrashIcon,
  EyeIcon,
  EyeSlashIcon 
} from '@heroicons/react/24/outline';

export default function MarketAreaList({ onClose, onEdit }) {
  const { projectId } = useParams();
  const { 
    marketAreas = [], 
    isLoading, 
    error, 
    fetchMarketAreas,
    deleteMarketArea 
  } = useMarketAreas();

  const { 
    drawRadius, 
    updateFeatureStyles,
    clearSelection,
    hideAllFeatureLayers
  } = useMap();

  // Initialize visible IDs from localStorage or default to all visible
  const [visibleMarketAreaIds, setVisibleMarketAreaIds] = useState(() => {
    const stored = localStorage.getItem(`marketAreas.${projectId}.visible`);
    return stored ? JSON.parse(stored) : [];
  });

  // Fetch market areas when projectId changes
  useEffect(() => {
    const loadMarketAreas = async () => {
      if (!projectId) return;
      await fetchMarketAreas(projectId);
    };
    loadMarketAreas();
  }, [projectId, fetchMarketAreas]);

  // Set initial visibility state when market areas first load
  useEffect(() => {
    if (marketAreas.length > 0) {
      const stored = localStorage.getItem(`marketAreas.${projectId}.visible`);
      if (!stored) {
        const allIds = marketAreas.map(ma => ma.id);
        setVisibleMarketAreaIds(allIds);
        localStorage.setItem(
          `marketAreas.${projectId}.visible`, 
          JSON.stringify(allIds)
        );
      }
    }
  }, [marketAreas, projectId]);

  // Inside MarketAreaList.jsx
  useEffect(() => {
    const showVisibleMarketAreas = async () => {
      if (!marketAreas.length) return;

      // Clear only hidden market areas instead of all
      const hiddenAreas = marketAreas.filter(ma => !visibleMarketAreaIds.includes(ma.id));
      for (const hiddenArea of hiddenAreas) {
        // Clear graphics for hidden areas
        if (hiddenArea.ma_type === 'radius') {
          // Clear radius graphics for hidden areas
          // You might need to add a method to clear specific radius graphics
        } else if (hiddenArea.locations) {
          updateFeatureStyles([], {}, hiddenArea.ma_type);
        }
      }

      // Show visible market areas
      for (const marketArea of marketAreas) {
        if (!visibleMarketAreaIds.includes(marketArea.id)) continue;

        if (marketArea.ma_type === 'radius' && marketArea.radius_points) {
          marketArea.radius_points.forEach(point => {
            drawRadius(point, marketArea.style_settings);
          });
        } else if (marketArea.locations) {
          const features = marketArea.locations.map(loc => ({
            geometry: loc.geometry,
            attributes: { 
              id: loc.id,
              marketAreaId: marketArea.id // Add market area ID to track source
            }
          }));

          updateFeatureStyles(features, {
            fill: marketArea.style_settings?.fillColor,
            fillOpacity: marketArea.style_settings?.fillOpacity,
            outline: marketArea.style_settings?.borderColor,
            outlineWidth: marketArea.style_settings?.borderWidth
          }, marketArea.ma_type);
        }
      }
    };

    showVisibleMarketAreas();
  }, [marketAreas, visibleMarketAreaIds, hideAllFeatureLayers, drawRadius, updateFeatureStyles]);

  // Update localStorage when visibility changes
  useEffect(() => {
    if (projectId) {
      localStorage.setItem(
        `marketAreas.${projectId}.visible`,
        JSON.stringify(visibleMarketAreaIds)
      );
    }
  }, [visibleMarketAreaIds, projectId]);

  // Handle toggle visibility
  const handleToggleVisibility = (marketArea) => {
    if (!marketArea) return;

    const { id } = marketArea;
    const isVisible = visibleMarketAreaIds.includes(id);

    try {
      if (isVisible) {
        setVisibleMarketAreaIds(prev => prev.filter(currentId => currentId !== id));
        clearSelection();
      } else {
        setVisibleMarketAreaIds(prev => [...prev, id]);
      }
    } catch (error) {
      console.error('Error toggling market area visibility:', error);
    }
  };

  // Handle delete market area
  const handleDelete = async (marketArea) => {
    if (!marketArea || !projectId) return;

    if (window.confirm('Are you sure you want to delete this market area?')) {
      try {
        await deleteMarketArea(projectId, marketArea.id);
        // Remove from visible areas if it was visible
        if (visibleMarketAreaIds.includes(marketArea.id)) {
          setVisibleMarketAreaIds(prev => prev.filter(id => id !== marketArea.id));
          clearSelection();
        }
        // Update localStorage after deletion
        const updatedVisible = visibleMarketAreaIds.filter(id => id !== marketArea.id);
        localStorage.setItem(
          `marketAreas.${projectId}.visible`, 
          JSON.stringify(updatedVisible)
        );
      } catch (error) {
        console.error('Failed to delete market area:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {(!Array.isArray(marketAreas) || marketAreas.length === 0) ? (
            <div className="text-center p-4 text-gray-500 dark:text-gray-400">
              No market areas defined yet
            </div>
          ) : (
            marketAreas.map((marketArea) => {
              const isVisible = visibleMarketAreaIds.includes(marketArea.id);
              return (
                <div
                  key={marketArea?.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        {marketArea.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {marketArea.ma_type} • {marketArea.short_name}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleToggleVisibility(marketArea)}
                        className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                        title={isVisible ? "Hide area" : "Show area"}
                      >
                        {isVisible ? (
                          <EyeIcon className="h-5 w-5" />
                        ) : (
                          <EyeSlashIcon className="h-5 w-5" />
                        )}
                      </button>
                      <button
                        onClick={() => onEdit?.(marketArea)}
                        className="p-2 text-blue-400 hover:text-blue-500"
                        title="Edit area"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(marketArea)}
                        className="p-2 text-red-400 hover:text-red-500"
                        title="Delete area"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
