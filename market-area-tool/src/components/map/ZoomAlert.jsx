// src/components/map/ZoomAlert.jsx
import React from 'react';
import { useMap } from '../../contexts/MapContext'; // Adjust path if needed

export const ZoomAlert = () => {
    // ... paste the full implementation of the ZoomAlert component here ...
    const { isOutsideZoomRange, zoomMessage } = useMap();
    if (!isOutsideZoomRange || !zoomMessage) return null;
    return (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
           {/* ... rest of JSX ... */}
        </div>
    );
};

export default ZoomAlert;