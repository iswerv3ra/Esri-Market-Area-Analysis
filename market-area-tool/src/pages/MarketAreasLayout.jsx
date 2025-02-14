import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Toolbar from '../components/layout/Toolbar';
import Sidebar from '../components/layout/Sidebar';
import MapComponent from '../components/map/Map';
import { MapProvider, useMap } from '../contexts/MapContext';
import { useMarketAreas } from '../contexts/MarketAreaContext';

function InnerLayout() {
  const { projectId } = useParams();
  const { mapView } = useMap();
  const { marketAreas, fetchMarketAreas } = useMarketAreas();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarContent, setSidebarContent] = useState('');
  const [editingMarketArea, setEditingMarketArea] = useState(null);
  const initialLoadDone = useRef(false);

  // Initial fetch and auto-open list
  useEffect(() => {
    const initializeMarketAreas = async () => {
      if (!projectId || !mapView || initialLoadDone.current) return;

      try {
        console.log('[MarketAreasLayout] Starting initial market areas fetch');
        const areas = await fetchMarketAreas(projectId);
        console.log('[MarketAreasLayout] Fetch complete, got areas:', areas?.length);

        setTimeout(() => {
          console.log('[MarketAreasLayout] Opening MA list after delay');
          openMAList();
          initialLoadDone.current = true;
        }, 500);
      } catch (error) {
        console.error('[MarketAreasLayout] Error fetching market areas:', error);
      }
    };

    initializeMarketAreas();
  }, [projectId, mapView, fetchMarketAreas]);

  const openCreateMA = () => {
    setEditingMarketArea(null);
    setSidebarContent('create');
    setIsSidebarOpen(true);
  };

  const openMAList = () => {
    setEditingMarketArea(null);
    setSidebarContent('list');
    setIsSidebarOpen(true);
  };

  const handleEdit = (marketArea) => {
    setEditingMarketArea(marketArea);
    setSidebarContent('create');
    setIsSidebarOpen(true);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
    setSidebarContent('');
    setEditingMarketArea(null);
  };

  useEffect(() => {
    if (!mapView) return;

    const handleResize = () => {
      if (mapView && typeof mapView.resize === 'function') {
        setTimeout(() => {
          mapView.resize();
        }, 300);
      }
    };

    handleResize();

    const resizeObserver = new ResizeObserver(handleResize);
    const mapContainer = document.getElementById('map-container');
    if (mapContainer) {
      resizeObserver.observe(mapContainer);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [mapView, isSidebarOpen]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none h-14 relative z-20">
        <Toolbar
          onCreateMA={openCreateMA}
          onToggleList={openMAList}
        />
      </div>

      <div className="flex-1 min-h-0 relative">
        <div 
          id="map-container"
          className="absolute inset-0 transition-all duration-300 ease-in-out"
          style={{
            clipPath: isSidebarOpen 
              ? 'polygon(0 0, 100% 0, 100% 55px, calc(100% - 500px) 55px, calc(100% - 500px) 100%, 0 100%)'
              : 'polygon(0 0, 100% 0, 100% 100%, 0 100%)'
          }}
        >
          <MapComponent />
        </div>

        <div 
          className={`
            absolute right-0 top-[52px] w-[500px] h-[calc(100%-55px)]
            bg-white dark:bg-gray-800
            transition-transform duration-300 ease-in-out z-10
            ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
          `}
        >
          {isSidebarOpen && (
            <Sidebar
              isOpen={isSidebarOpen}
              onClose={closeSidebar}
              sidebarContent={sidebarContent}
              editingMarketArea={editingMarketArea}
              onEdit={handleEdit}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function MarketAreasLayout() {
  return <InnerLayout />;
}