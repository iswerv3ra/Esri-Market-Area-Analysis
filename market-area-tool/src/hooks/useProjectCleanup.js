import { useCallback } from 'react';
import { useMap } from '../contexts/MapContext';
import { useMarketAreas } from '../contexts/MarketAreaContext';

export const useProjectCleanup = () => {
  const { resetMapState } = useMap();
  const { resetMarketAreas } = useMarketAreas();

  const cleanupProject = useCallback(() => {
    // Reset map state
    resetMapState();
    
    // Reset market areas context
    resetMarketAreas();
    
    // Clear project-specific storage
    localStorage.removeItem('currentProject');
    localStorage.removeItem('projectMarketAreas');
    
    console.log('[ProjectCleanup] Project state cleared successfully');
  }, [resetMapState, resetMarketAreas]);

  return cleanupProject;
};