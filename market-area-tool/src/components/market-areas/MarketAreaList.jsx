import { useEffect, useState, useCallback } from "react";
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center flex-1">
          <div {...attributes} {...listeners} className="mr-3 cursor-grab">
            <Bars3Icon className="h-5 w-5 text-gray-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {marketArea.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {marketArea.ma_type} • {marketArea.short_name}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onToggleVisibility(marketArea)}
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
            onClick={() => onEdit(marketArea)}
            className="p-2 text-blue-400 hover:text-blue-500"
            title="Edit area"
          >
            <PencilIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => onDelete(marketArea)}
            className="p-2 text-red-400 hover:text-red-500"
            title="Delete area"
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default function MarketAreaList({ onClose, onEdit }) {
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
    updateFeatureStyles,
    clearSelection,
    hideAllFeatureLayers,
    clearMarketAreaGraphics, // Add this
  } = useMap();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize visible IDs from localStorage or default to all visible
  const [visibleMarketAreaIds, setVisibleMarketAreaIds] = useState(() => {
    const stored = localStorage.getItem(`marketAreas.${projectId}.visible`);
    return stored ? JSON.parse(stored) : [];
  });

  // Computed property to determine if all areas are visible
  const areAllAreasVisible =
    marketAreas.length > 0 &&
    marketAreas.every((ma) => visibleMarketAreaIds.includes(ma.id));

  // Handle toggling all areas visibility
  const handleToggleAll = useCallback(() => {
    if (areAllAreasVisible) {
      // Hide all areas
      setVisibleMarketAreaIds([]);
      clearSelection();
    } else {
      // Show all areas
      const allIds = marketAreas.map((ma) => ma.id);
      setVisibleMarketAreaIds(allIds);
    }
  }, [areAllAreasVisible, marketAreas, clearSelection]);

  // Fetch market areas when projectId changes
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);

// Also update the useEffect that handles initial visibility
useEffect(() => {
  const loadMarketAreas = async () => {
    if (!projectId || hasAttemptedFetch) return;

    try {
      await fetchMarketAreas(projectId);
      
      // After fetching, check localStorage for visibility state
      const storedVisibleIds = localStorage.getItem(`marketAreas.${projectId}.visible`);
      if (storedVisibleIds) {
        const visibleIds = JSON.parse(storedVisibleIds);
        setVisibleMarketAreaIds(visibleIds);
        
        // Render all visible market areas
        for (const marketArea of marketAreas) {
          if (visibleIds.includes(marketArea.id)) {
            if (marketArea.ma_type === "radius" && marketArea.radius_points) {
              for (const point of marketArea.radius_points) {
                await drawRadius(
                  point, 
                  marketArea.style_settings, 
                  marketArea.id,
                  marketArea.order
                );
              }
            } else if (marketArea.locations) {
              const features = marketArea.locations.map((loc) => ({
                geometry: loc.geometry,
                attributes: {
                  id: loc.id,
                  marketAreaId: marketArea.id,
                  order: marketArea.order,
                },
              }));

              await updateFeatureStyles(
                features,
                {
                  fill: marketArea.style_settings?.fillColor,
                  fillOpacity: marketArea.style_settings?.fillOpacity,
                  outline: marketArea.style_settings?.borderColor,
                  outlineWidth: marketArea.style_settings?.borderWidth,
                },
                marketArea.ma_type
              );
            }
          }
        }
      } else {
        // If no stored visibility state, show all market areas by default
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
}, [
  projectId, 
  hasAttemptedFetch, 
  fetchMarketAreas, 
  marketAreas, 
  drawRadius, 
  updateFeatureStyles
]);


  // Set initial visibility state when market areas first load
  useEffect(() => {
    if (marketAreas.length > 0) {
      const stored = localStorage.getItem(`marketAreas.${projectId}.visible`);
      if (!stored) {
        const allIds = marketAreas.map((ma) => ma.id);
        setVisibleMarketAreaIds(allIds);
        localStorage.setItem(
          `marketAreas.${projectId}.visible`,
          JSON.stringify(allIds)
        );
      }
    }
  }, [marketAreas, projectId]);

  // Handle map display of market areas
  useEffect(() => {
    const showVisibleMarketAreas = async () => {
      if (!marketAreas.length) return;

      // Clear all market areas first
      hideAllFeatureLayers();

      // Show visible market areas in reverse order (so first items appear on top)
      for (let i = marketAreas.length - 1; i >= 0; i--) {
        const marketArea = marketAreas[i];
        if (!visibleMarketAreaIds.includes(marketArea.id)) continue;

        if (marketArea.ma_type === "radius" && marketArea.radius_points) {
          marketArea.radius_points.forEach((point) => {
            drawRadius(point, marketArea.style_settings);
          });
        } else if (marketArea.locations) {
          const features = marketArea.locations.map((loc) => ({
            geometry: loc.geometry,
            attributes: {
              id: loc.id,
              marketAreaId: marketArea.id,
            },
          }));

          updateFeatureStyles(
            features,
            {
              fill: marketArea.style_settings?.fillColor,
              fillOpacity: marketArea.style_settings?.fillOpacity,
              outline: marketArea.style_settings?.borderColor,
              outlineWidth: marketArea.style_settings?.borderWidth,
            },
            marketArea.ma_type
          );
        }
      }
    };

    showVisibleMarketAreas();
  }, [
    marketAreas,
    visibleMarketAreaIds,
    hideAllFeatureLayers,
    drawRadius,
    updateFeatureStyles,
  ]);

  // Update localStorage when visibility changes
  useEffect(() => {
    if (projectId) {
      localStorage.setItem(
        `marketAreas.${projectId}.visible`,
        JSON.stringify(visibleMarketAreaIds)
      );
    }
  }, [visibleMarketAreaIds, projectId]);

  const handleToggleVisibility = useCallback(
    async (marketArea) => {
      if (!marketArea) return;
  
      const { id } = marketArea;
      const isVisible = visibleMarketAreaIds.includes(id);
  
      try {
        // Update visibility state first
        const newVisibleIds = isVisible
          ? visibleMarketAreaIds.filter((currentId) => currentId !== id)
          : [...visibleMarketAreaIds, id];
        
        // Update local state
        setVisibleMarketAreaIds(newVisibleIds);
        
        // Update localStorage
        localStorage.setItem(
          `marketAreas.${projectId}.visible`,
          JSON.stringify(newVisibleIds)
        );
  
        if (isVisible) {
          // If hiding, clear this specific market area's graphics
          clearMarketAreaGraphics(id);
        } else {
          // If showing, redraw this specific market area
          if (marketArea.ma_type === "radius" && marketArea.radius_points) {
            for (const point of marketArea.radius_points) {
              await drawRadius(
                point, 
                marketArea.style_settings, 
                marketArea.id,
                marketArea.order
              );
            }
          } else if (marketArea.locations) {
            const features = marketArea.locations.map((loc) => ({
              geometry: loc.geometry,
              attributes: {
                id: loc.id,
                marketAreaId: marketArea.id,
                order: marketArea.order,
              },
            }));
  
            await updateFeatureStyles(
              features,
              {
                fill: marketArea.style_settings?.fillColor,
                fillOpacity: marketArea.style_settings?.fillOpacity,
                outline: marketArea.style_settings?.borderColor,
                outlineWidth: marketArea.style_settings?.borderWidth,
              },
              marketArea.ma_type
            );
          }
        }
      } catch (error) {
        console.error("Error toggling market area visibility:", error);
        toast.error("Failed to toggle market area visibility");
      }
    },
    [
      visibleMarketAreaIds, 
      projectId, 
      clearMarketAreaGraphics, 
      drawRadius, 
      updateFeatureStyles
    ]
  );
  

  const handleEdit = useCallback(
    async (marketArea) => {
      if (!marketArea) return;
      
      // Don't clear selection or hide layers when transitioning to edit mode
      // Instead, just pass the market area to edit
      onEdit?.(marketArea);
    },
    [onEdit]
  );

  const handleDelete = async (marketArea) => {
    if (!marketArea || !projectId) return;

    if (window.confirm("Are you sure you want to delete this market area?")) {
      try {
        // Clear all graphics associated with this market area
        clearMarketAreaGraphics(marketArea.id);

        // Delete the market area from the backend
        await deleteMarketArea(projectId, marketArea.id);

        // Update visible market areas state and localStorage
        const updatedVisible = visibleMarketAreaIds.filter(
          (id) => id !== marketArea.id
        );
        setVisibleMarketAreaIds(updatedVisible);
        localStorage.setItem(
          `marketAreas.${projectId}.visible`,
          JSON.stringify(updatedVisible)
        );
      } catch (error) {
        console.error("Failed to delete market area:", error);
        toast.error("Failed to delete market area");
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

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      <div className="flex-1 overflow-y-auto p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={marketAreas.map((ma) => ma.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {!Array.isArray(marketAreas) || marketAreas.length === 0 ? (
                <div className="text-center p-4 text-gray-500 dark:text-gray-400">
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