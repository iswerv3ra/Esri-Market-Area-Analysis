import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { geodesicBuffer, simplify, union } from "@arcgis/core/geometry/geometryEngine";
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
  EyeDropperIcon, // Add this import
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

  // Count of features for display
  const count = marketArea.ma_type === "radius"
    ? (marketArea.radius_points?.length || 0)
    : (marketArea.locations?.length || 0);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 py-1 text-sm"
    >
      <div className="flex items-center flex-1 min-w-0">
        <div {...attributes} {...listeners} className="mr-2 cursor-grab text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
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
    clearMarketAreaGraphics,
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

  const areAllAreasVisible =
    marketAreas.length > 0 &&
    marketAreas.every((ma) => visibleMarketAreaIds.includes(ma.id));

  const handleToggleAll = useCallback(() => {
    if (areAllAreasVisible) {
      setVisibleMarketAreaIds([]);
      clearSelection();
    } else {
      const allIds = marketAreas.map((ma) => ma.id);
      setVisibleMarketAreaIds(allIds);
    }
  }, [areAllAreasVisible, marketAreas, clearSelection]);

  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);

  useEffect(() => {
    const loadMarketAreas = async () => {
      if (!projectId || hasAttemptedFetch) return;

      try {
        await fetchMarketAreas(projectId);

        const storedVisibleIds = localStorage.getItem(
          `marketAreas.${projectId}.visible`
        );
        if (storedVisibleIds) {
          const visibleIds = JSON.parse(storedVisibleIds);
          setVisibleMarketAreaIds(visibleIds);

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
    updateFeatureStyles,
  ]);

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

  useEffect(() => {
    const showVisibleMarketAreas = async () => {
      if (!marketAreas.length) return;

      hideAllFeatureLayers();
      clearMarketAreaGraphics();

      const sortedMarketAreas = [...marketAreas].sort((a, b) => a.order - b.order);

      for (let i = sortedMarketAreas.length - 1; i >= 0; i--) {
        const marketArea = sortedMarketAreas[i];

        if (!visibleMarketAreaIds.includes(marketArea.id)) continue;

        if (marketArea.ma_type === "radius" && Array.isArray(marketArea.radius_points)) {
          for (const point of marketArea.radius_points) {
            await drawRadius(
              point,
              marketArea.style_settings,
              marketArea.id,
              marketArea.order
            );
          }
        } else if (marketArea.locations && Array.isArray(marketArea.locations)) {
          const features = marketArea.locations.map((loc) => ({
            geometry: loc.geometry,
            attributes: {
              id: loc.id,
              marketAreaId: marketArea.id,
              order: marketArea.order
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
        } else {
          console.warn(`Unsupported or unknown marketArea type: ${marketArea.ma_type}`);
        }
      }
    };

    showVisibleMarketAreas();
  }, [
    marketAreas,
    visibleMarketAreaIds,
    hideAllFeatureLayers,
    clearMarketAreaGraphics,
    drawRadius,
    updateFeatureStyles,
  ]);

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
        const newVisibleIds = isVisible
          ? visibleMarketAreaIds.filter((currentId) => currentId !== id)
          : [...visibleMarketAreaIds, id];

        setVisibleMarketAreaIds(newVisibleIds);
        localStorage.setItem(`marketAreas.${projectId}.visible`, JSON.stringify(newVisibleIds));

        if (isVisible) {
          clearMarketAreaGraphics(id);
        } else {
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
      }
    },
    [visibleMarketAreaIds, projectId, clearMarketAreaGraphics, drawRadius, updateFeatureStyles]
  );

  const handleEdit = useCallback(
    async (marketArea) => {
      if (!marketArea) return;
      onEdit?.(marketArea);
    },
    [onEdit]
  );

  const handleDelete = async (marketArea) => {
    if (!marketArea || !projectId) return;

    if (window.confirm("Are you sure you want to delete this market area?")) {
      try {
        clearMarketAreaGraphics(marketArea.id);

        await deleteMarketArea(projectId, marketArea.id);

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
