// src/components/MarketAreaList.jsx

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
    marketAreas, 
    isLoading, 
    error, 
    fetchMarketAreas,
    deleteMarketArea 
  } = useMarketAreas();

  const { 
    setActiveLayerType,
    drawRadius,
    updateFeatureStyles,
    clearSelection
  } = useMap();

  const [visibleAreas, setVisibleAreas] = useState(new Set());

  useEffect(() => {
    const loadAndDisplayMarketAreas = async () => {
      await fetchMarketAreas(projectId);

      // If there are visible areas, display them on the map
      visibleAreas.forEach(areaId => {
        const marketArea = marketAreas.find(ma => ma.id === areaId);
        if (marketArea) {
          if (marketArea.ma_type === 'radius' && marketArea.radius_points) {
            marketArea.radius_points.forEach(point => {
              drawRadius(point, marketArea.style_settings);
            });
          } else if (marketArea.locations) {
            const features = marketArea.locations.map(loc => ({
              geometry: loc.geometry,
              attributes: { id: loc.id }
            }));

            if (marketArea.ma_type !== 'radius') {
              setActiveLayerType(marketArea.ma_type);
            }

            updateFeatureStyles(features, {
              fill: marketArea.style_settings.fillColor,
              fillOpacity: marketArea.style_settings.fillOpacity,
              outline: marketArea.style_settings.borderColor,
              outlineWidth: marketArea.style_settings.borderWidth
            });
          }
        }
      });
    };

    loadAndDisplayMarketAreas();
  }, [
    projectId, 
    fetchMarketAreas, 
    visibleAreas, 
    drawRadius, 
    updateFeatureStyles, 
    setActiveLayerType
    // Removed 'marketAreas' from dependencies to prevent infinite loop
  ]);

  // Handle toggle visibility
  const handleToggleVisibility = async (marketArea) => {
    const newVisibleAreas = new Set(visibleAreas);
    
    if (visibleAreas.has(marketArea.id)) {
      // Hide the market area
      newVisibleAreas.delete(marketArea.id);
      if (marketArea.ma_type !== 'radius') {
        await setActiveLayerType(null);
      }
      clearSelection();
    } else {
      // Show the market area
      newVisibleAreas.add(marketArea.id);
      
      if (marketArea.ma_type === 'radius' && marketArea.radius_points) {
        marketArea.radius_points.forEach(point => {
          drawRadius(point, marketArea.style_settings);
        });
      } else if (marketArea.locations) {
        if (marketArea.ma_type !== 'radius') {
          await setActiveLayerType(marketArea.ma_type);
        }
        
        const features = marketArea.locations.map(loc => ({
          geometry: loc.geometry,
          attributes: { id: loc.id }
        }));
        
        updateFeatureStyles(features, {
          fill: marketArea.style_settings.fillColor,
          fillOpacity: marketArea.style_settings.fillOpacity,
          outline: marketArea.style_settings.borderColor,
          outlineWidth: marketArea.style_settings.borderWidth
        });
      }
    }
    
    setVisibleAreas(newVisibleAreas);
  };

  // Handle delete market area
  const handleDelete = async (marketArea) => {
    if (window.confirm('Are you sure you want to delete this market area?')) {
      try {
        await deleteMarketArea(projectId, marketArea.id);
        // Remove from visible areas if it was visible
        if (visibleAreas.has(marketArea.id)) {
          const newVisibleAreas = new Set(visibleAreas);
          newVisibleAreas.delete(marketArea.id);
          setVisibleAreas(newVisibleAreas);
          clearSelection();
        }
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
          {marketAreas.length === 0 ? (
            <div className="text-center p-4 text-gray-500 dark:text-gray-400">
              No market areas defined yet
            </div>
          ) : (
            marketAreas.map((marketArea) => (
              <div
                key={marketArea.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                      {marketArea.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {marketArea.type} • {marketArea.short_name}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleToggleVisibility(marketArea)}
                      className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                    >
                      {visibleAreas.has(marketArea.id) ? (
                        <EyeIcon className="h-5 w-5" />
                      ) : (
                        <EyeSlashIcon className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        if (typeof onEdit === 'function') {
                          onEdit(marketArea);
                        } else {
                          console.warn('onEdit prop is not a function');
                        }
                      }}
                      className="p-2 text-blue-400 hover:text-blue-500"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(marketArea)}
                      className="p-2 text-red-400 hover:text-red-500"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
