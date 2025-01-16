// src/components/map/ZoomAlert.jsx
import { useMap } from '../../contexts/MapContext';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export default function ZoomAlert() {
  const { isOutsideZoomRange, zoomMessage } = useMap();

  if (!isOutsideZoomRange || !zoomMessage) return null;

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-4 py-3">
        <div className="flex items-center gap-2">
          <MagnifyingGlassIcon className="h-5 w-5 text-blue-500" />
          <p className="text-sm text-gray-700 dark:text-gray-200">
            {zoomMessage}
          </p>
        </div>
      </div>
    </div>
  );
}