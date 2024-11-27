import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Toolbar from '../components/layout/Toolbar';
import Sidebar from '../components/layout/Sidebar';
import MapComponent from '../components/map/Map';
import { MapProvider, useMap } from '../contexts/MapContext';

function InnerLayout() {
  const { mapView } = useMap();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [sidebarContent, setSidebarContent] = React.useState('');
  const [editingMarketArea, setEditingMarketArea] = React.useState(null);

  const openCreateMA = () => {
    setEditingMarketArea(null); // Reset editing state
    setSidebarContent('create');
    setIsSidebarOpen(true);
  };

  const openMAList = () => {
    setEditingMarketArea(null); // Reset editing state
    setSidebarContent('list');
    setIsSidebarOpen(true);
  };

  const handleEdit = (marketArea) => {
    setEditingMarketArea(marketArea);
    setSidebarContent('create'); // Reuse create form for editing
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