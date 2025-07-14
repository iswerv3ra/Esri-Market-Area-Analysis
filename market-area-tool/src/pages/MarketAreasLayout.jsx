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

  // Effect to handle map resizing when sidebar changes
  useEffect(() => {
    if (!mapView) return;

    // Give the DOM time to update before resizing the map
    const timer = setTimeout(() => {
      if (mapView && typeof mapView.resize === 'function') {
        mapView.resize();
        console.log('[MarketAreasLayout] Resized map after sidebar state change');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [mapView, isSidebarOpen]);

  // Effect to handle resize observer
  useEffect(() => {
    if (!mapView) return;

    const handleResize = () => {
      if (mapView && typeof mapView.resize === 'function') {
        setTimeout(() => {
          mapView.resize();
        }, 300);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    const mapContainer = document.getElementById('map-container');
    if (mapContainer) {
      resizeObserver.observe(mapContainer);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [mapView]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none h-14 relative z-20">
        <Toolbar
          onCreateMA={openCreateMA}
          onToggleList={openMAList}
        />
      </div>

      <div className="flex-1 min-h-0 relative">
        {/* Map container always takes full size */}
        <div 
          id="map-container"
          className="absolute inset-0"
          style={{
            // Updated sidebar width from 350px to 440px
            '--sidebar-width': isSidebarOpen ? '440px' : '0px'
          }}
        >
          <MapComponent 
            sidebarOpen={isSidebarOpen} 
            sidebarWidth={440} // Updated from 350 to 440
            adjustEditorPosition={true}
          />
        </div>

        {/* Market Areas sidebar - increased width from 350px to 440px (25% increase) */}
        <div 
          className={`
            absolute right-0 top-[63.5px] w-[440px] h-[calc(100%-54px)]
            bg-[#1a202c]
            shadow-lg
            transition-transform duration-300 ease-in-out z-30
            ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
            border-t border-gray-700
            pt-4
          `}
          style={{
            pointerEvents: 'auto' // Ensure click events work
          }}
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