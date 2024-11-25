// src/pages/MarketAreasLayout.jsx
import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Toolbar from '../components/layout/Toolbar';
import Sidebar from '../components/layout/Sidebar';
import MapComponent from '../components/map/Map';
import { MapProvider, useMap } from '../contexts/MapContext';

function InnerLayout() {
  const { mapView } = useMap();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [sidebarContent, setSidebarContent] = React.useState('');

  const openCreateMA = () => {
    setSidebarContent('create');
    setIsSidebarOpen(true);
  };

  const openMAList = () => {
    setSidebarContent('list');
    setIsSidebarOpen(true);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
    setSidebarContent('');
  };

  const handleBack = () => {
    navigate('/');
  };

  // Handle map resizing
  useEffect(() => {
    if (!mapView) return;

    const handleResize = () => {
      if (mapView && typeof mapView.resize === 'function') {
        mapView.resize();
      }
    };

    // Initialize ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    // Observe the map container
    const mapContainer = document.getElementById('map-container');
    if (mapContainer) {
      resizeObserver.observe(mapContainer);
    }

    // Cleanup
    return () => {
      resizeObserver.disconnect();
    };
  }, [mapView]);

  return (
    <div className="min-h-screen flex flex-col">
      <Toolbar
        onCreateMA={openCreateMA}
        onToggleList={openMAList}
        onBack={handleBack}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Map Container - Now uses flex to adapt width */}
        <div 
          id="map-container" 
          className={`flex-1 transition-all duration-300 ${
            isSidebarOpen ? 'w-[60%]' : 'w-full'
          }`}
        >
          <MapComponent />
        </div>

        {/* Sidebar - Now uses absolute positioning only for small screens */}
        <div 
          className={`
            ${isSidebarOpen ? 'block' : 'hidden'}
            md:relative md:w-[40%]
            transition-transform duration-300 ease-in-out
          `}
        >
          <Sidebar
            isOpen={isSidebarOpen}
            onClose={closeSidebar}
            sidebarContent={sidebarContent}
          />
        </div>
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