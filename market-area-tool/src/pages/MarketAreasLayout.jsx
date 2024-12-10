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
        console.log("Fetched marketAreas:", marketAreas);

        // Add a slight delay before opening the list
        setTimeout(() => {
          console.log('[MarketAreasLayout] Opening MA list after delay');
          openMAList();
          initialLoadDone.current = true;
        }, 500); // 500ms delay
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
    console.log('[MarketAreasLayout] Opening MA list with areas:', marketAreas?.length);
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

  // Handle map resizing
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
      <div className="flex-none h-14">
        <Toolbar
          onCreateMA={openCreateMA}
          onToggleList={openMAList}
        />
      </div>

      <div className="flex-1 flex min-h-0">
        <div 
          id="map-container" 
          style={{ 
            width: isSidebarOpen ? 'calc(100% - 400px)' : '100%',
            transition: 'width 300ms ease-in-out'
          }}
          className="h-full"
        >
          <MapComponent />
        </div>

        {isSidebarOpen && (
          <div className="w-[500px] flex-shrink-0 h-full">
            <Sidebar
              isOpen={isSidebarOpen}
              onClose={closeSidebar}
              sidebarContent={sidebarContent}
              editingMarketArea={editingMarketArea}
              onEdit={handleEdit}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function MarketAreasLayout() {
  return (
    <MapProvider>
      <InnerLayout />
    </MapProvider>
  );
}