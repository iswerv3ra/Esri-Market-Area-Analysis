// src/components/map/ZoomTool.js

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook that provides zoom tool functionality for ArcGIS MapView
 * Allows users to draw a rectangle on the map to zoom to a specific area
 * 
 * @param {Object} mapView - ArcGIS MapView instance
 * @param {Object} mapRef - React ref for the map container DOM element
 * @returns {Object} - Zoom tool state and control functions
 */
export function useZoomTool(mapView, mapRef) {
  // State for zoom tool activation
  const [isZoomToolActive, setIsZoomToolActive] = useState(false);
  const isZoomToolActiveRef = useRef(false);
  
  // Drawing state for rectangle
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStartPoint, setDrawStartPoint] = useState(null);
  const [drawEndPoint, setDrawEndPoint] = useState(null);
  
  // Refs for tracking drawing state
  const rectangleRef = useRef(null);
  const isDrawingRef = useRef(false);
  const drawStartPointRef = useRef(null);
  const drawEndPointRef = useRef(null);
  const activeDrawButtonRef = useRef(null);
  const pointerIdRef = useRef(null);
  const captureElementRef = useRef(null);
  
  // Disable mouseleave cancellation when in pointer capture mode
  const ignoreMouseLeaveRef = useRef(false);
  
  // Reference to store timeout ID for mouseleave handler
  const leaveTimeoutIdRef = useRef(null);

  // New logging function with timestamps
  const logWithTimestamp = (type, message, data = null) => {
    const timestamp = new Date().toISOString();
    const prefix = `[ZoomTool][${timestamp}][${type}]`;
    
    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  };

  /**
   * Diagnostic function to identify ArcGIS version and available navigation methods
   * Logs detailed information about the MapView's navigation capabilities
   */
  const logNavigationCapabilities = useCallback((view) => {
    if (!view) {
      logWithTimestamp("DIAGNOSTIC", "Cannot log navigation capabilities - view is null");
      return;
    }

    try {
      // Version info if available
      let versionInfo = "Unknown";
      if (view.version) {
        versionInfo = view.version;
      } else if (window.esri && window.esri.version) {
        versionInfo = window.esri.version;
      }
      
      logWithTimestamp("DIAGNOSTIC", `ArcGIS JS API Version: ${versionInfo}`);
      
      // Navigation interfaces available
      const interfaces = {
        "navigationManager exists": !!view.navigationManager,
        "navigation object exists": !!view.navigation,
        "dragEnabled property exists": typeof view.navigation?.dragEnabled !== 'undefined',
        "browserTouchPanEnabled exists": typeof view.navigation?.browserTouchPanEnabled !== 'undefined',
        "mouseWheelZoomEnabled exists": typeof view.navigation?.mouseWheelZoomEnabled !== 'undefined',
        "keyboardNavigationEnabled exists": typeof view.navigation?.keyboardNavigationEnabled !== 'undefined',
        "actionMap exists": !!view.navigation?.actionMap,
        "view-level dragEnabled exists": typeof view.dragEnabled !== 'undefined',
        "interactionMode exists": typeof view.interactionMode !== 'undefined',
        "constraints exists": !!view.constraints
      };
      
      logWithTimestamp("DIAGNOSTIC", "Navigation interfaces available:", interfaces);
      
      // Current state of navigation
      if (view.navigation) {
        const navigationState = {
          dragEnabled: view.navigation.dragEnabled,
          browserTouchPanEnabled: view.navigation.browserTouchPanEnabled,
          mouseWheelZoomEnabled: view.navigation.mouseWheelZoomEnabled,
          keyboardNavigationEnabled: view.navigation.keyboardNavigationEnabled,
          momentumEnabled: view.navigation.momentumEnabled
        };
        
        logWithTimestamp("DIAGNOSTIC", "Current navigation state:", navigationState);
        
        // ActionMap configuration if present
        if (view.navigation.actionMap) {
          const actionMapState = {
            dragPrimary: view.navigation.actionMap.dragPrimary,
            dragSecondary: view.navigation.actionMap.dragSecondary,
            dragTertiary: view.navigation.actionMap.dragTertiary,
            mouseWheel: view.navigation.actionMap.mouseWheel
          };
          
          logWithTimestamp("DIAGNOSTIC", "ActionMap configuration:", actionMapState);
        }
      }
      
      if (view.navigationManager) {
        logWithTimestamp("DIAGNOSTIC", "NavigationManager state:", {
          viewPaused: view.navigationManager.viewPausedVal,
          isNavigationAllowed: view.navigationManager.isNavigationAllowed
        });
      }
      
    } catch (error) {
      logWithTimestamp("ERROR", "Error logging navigation capabilities:", error);
    }
  }, []);

  /**
   * Disables all map navigation methods using multiple aggressive techniques
   * Prevents the map from responding to any user input during drawing
   */
  const disableMapNavigation = useCallback((view) => {
    if (!view) {
      logWithTimestamp("ERROR", "Cannot disable navigation: view is null");
      return false;
    }
    
    logWithTimestamp("NAVIGATION", "Disabling map navigation with maximum aggressiveness");
    
    try {
      // Store original state for restoration - be explicit with defaults
      const originalState = {
        viewPausedVal: view.navigationManager?.viewPausedVal || false,
        interactionMode: view.interactionMode || "auto",
        dragEnabled: typeof view.navigation?.dragEnabled !== 'undefined' ? view.navigation.dragEnabled : true,
        browserTouchPanEnabled: typeof view.navigation?.browserTouchPanEnabled !== 'undefined' ? view.navigation.browserTouchPanEnabled : true,
        mouseWheelZoomEnabled: typeof view.navigation?.mouseWheelZoomEnabled !== 'undefined' ? view.navigation.mouseWheelZoomEnabled : true,
        keyboardNavigationEnabled: typeof view.navigation?.keyboardNavigationEnabled !== 'undefined' ? view.navigation.keyboardNavigationEnabled : true,
        momentumEnabled: typeof view.navigation?.momentumEnabled !== 'undefined' ? view.navigation.momentumEnabled : true
      };
      
      logWithTimestamp("NAVIGATION", "Saved original navigation state:", originalState);
      view._zoomToolOriginalState = originalState;

      // 1. Disable ESRI navigation properties
      if (view.navigation) {
        view.navigation.dragEnabled = false;
        view.navigation.browserTouchPanEnabled = false;
        view.navigation.mouseWheelZoomEnabled = false;
        view.navigation.momentumEnabled = false;
        
        // Handle keyboardNavigation property variants
        if (typeof view.navigation.keyboardNavigationEnabled !== 'undefined') {
          view.navigation.keyboardNavigationEnabled = false;
        } else if (typeof view.navigation.keyboardNavigation !== 'undefined') {
          view.navigation.keyboardNavigation = false;
        }
        
        // Disable action map configurations
        if (view.navigation.actionMap) {
          // Save original action map settings
          view._zoomToolOriginalActionMap = {
            dragPrimary: view.navigation.actionMap.dragPrimary,
            dragSecondary: view.navigation.actionMap.dragSecondary,
            dragTertiary: view.navigation.actionMap.dragTertiary,
            mouseWheel: view.navigation.actionMap.mouseWheel
          };
          
          // Disable all drag actions
          if (typeof view.navigation.actionMap.dragPrimary !== 'undefined') {
            view.navigation.actionMap.dragPrimary = "none";
          }
          if (typeof view.navigation.actionMap.dragSecondary !== 'undefined') {
            view.navigation.actionMap.dragSecondary = "none";
          }
          if (typeof view.navigation.actionMap.dragTertiary !== 'undefined') {
            view.navigation.actionMap.dragTertiary = "none";
          }
          if (typeof view.navigation.actionMap.mouseWheel !== 'undefined') {
            view.navigation.actionMap.mouseWheel = "none";
          }
        }
        
        logWithTimestamp("NAVIGATION", "Standard navigation properties disabled");
      }
      
      // 2. Apply CSS overrides to prevent default behaviors
      if (view.container) {
        // Save original styles
        if (!view._zoomToolOriginalStyles) {
          view._zoomToolOriginalStyles = {
            touchAction: view.container.style.touchAction,
            pointerEvents: view.container.style.pointerEvents,
            userSelect: view.container.style.userSelect,
            cursor: view.container.style.cursor
          };
        }
        
        // Apply styles that prevent map movement
        view.container.style.touchAction = "none";
        view.container.style.pointerEvents = "auto";
        view.container.style.userSelect = "none";
        
        // Add custom classes
        view.container.classList.add("navigation-disabled");
        view.container.classList.add("zoom-tool-active");
        
        logWithTimestamp("NAVIGATION", "Applied CSS overrides to container");
      }
      
      // 3. Implement comprehensive event interception
      const interceptHandler = (e) => {
        if (isZoomToolActiveRef.current) {
          // Important: The mousemove event should be allowed when drawing is active
          if (isDrawingRef.current && (e.type === 'mousemove' || e.type === 'pointermove')) {
            // For move events, let the mousemove handler take over
            return;
          }
          
          e.stopPropagation();
          e.stopImmediatePropagation();
          if (e.cancelable) {
            e.preventDefault();
          }
          return false;
        }
      };
      
      // Define all events to intercept
      const mouseEvents = ['mousedown', 'click', 'dblclick', 'contextmenu'];
      const pointerEvents = ['pointerdown', 'pointercancel', 'gotpointercapture', 'lostpointercapture'];
      const touchEvents = ['touchstart', 'touchcancel'];
      const dragEvents = ['dragstart', 'drag', 'dragend', 'dragenter', 'dragover', 'dragleave', 'drop'];
      const wheelEvents = ['wheel', 'mousewheel', 'DOMMouseScroll'];
      
      // Combine all event types
      const allEvents = [
        ...mouseEvents,
        ...pointerEvents, 
        ...touchEvents,
        ...dragEvents,
        ...wheelEvents
      ];
      
      // Store handlers for cleanup
      if (!view._zoomToolEventHandlers) {
        view._zoomToolEventHandlers = {
          intercept: interceptHandler,
          mouseEventNames: allEvents,
          handlers: []
        };
        
        // Apply to document and container (if available)
        const targets = [document];
        if (view.container) targets.push(view.container);
        if (view.canvas) targets.push(view.canvas);
        
        targets.forEach(target => {
          if (!target) return;
          
          allEvents.forEach(eventName => {
            try {
              target.addEventListener(eventName, interceptHandler, { capture: true, passive: false });
              
              view._zoomToolEventHandlers.handlers.push({
                target: target,
                event: eventName,
                handler: interceptHandler,
                options: { capture: true, passive: false }
              });
            } catch (e) {
              // Silently continue if event type not supported
            }
          });
        });
        
        logWithTimestamp("NAVIGATION", "Added comprehensive event interceptors");
      }
      
      // 4. Set flags on the view
      view._zoomToolActive = true;
      view._zoomToolDrawingEnabled = true;
      
      // 5. Create a transparent overlay to intercept events
      if (!document.getElementById('zoom-tool-overlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'zoom-tool-overlay';
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'transparent';
        overlay.style.zIndex = '9999';
        overlay.style.pointerEvents = 'none'; // Changed to none - we'll handle events directly
        
        // Add to view container
        if (view.container) {
          view.container.appendChild(overlay);
          view._zoomToolOverlay = overlay;
          logWithTimestamp("NAVIGATION", "Created event intercepting overlay");
        }
      }
      
      // 6. PAUSE NAVIGATION MANAGER if available
      if (view.navigationManager) {
        view.navigationManager.pause();
        logWithTimestamp("NAVIGATION", "Paused navigationManager");
      }
      
      logWithTimestamp("NAVIGATION", "Navigation disabled with maximum aggressiveness");
      return true;
    } catch (error) {
      logWithTimestamp("ERROR", "Error in aggressive navigation disabling:", error);
      return false;
    }
  }, [isZoomToolActiveRef]);

  /**
   * Restores all map navigation methods and removes event interception
   */
  const restoreMapNavigation = useCallback((view) => {
    if (!view) {
      logWithTimestamp("ERROR", "Cannot restore navigation: view is null");
      return false;
    }
    
    logWithTimestamp("NAVIGATION", "Restoring map navigation and removing event interception");
    
    try {
      // 1. Remove all flags
      view._zoomToolActive = false;
      view._zoomToolDrawing = false;
      view._zoomToolDrawingEnabled = false;
      
      // 2. Restore ESRI navigation properties
      if (view.navigation) {
        // Critical: Always restore dragEnabled first
        view.navigation.dragEnabled = true;
        logWithTimestamp("NAVIGATION", "Restored view.navigation.dragEnabled = true");
        
        // Restore from saved state if available
        if (view._zoomToolOriginalState) {
          view.navigation.browserTouchPanEnabled = view._zoomToolOriginalState.browserTouchPanEnabled;
          view.navigation.momentumEnabled = view._zoomToolOriginalState.momentumEnabled || true;
          
          if (typeof view.navigation.mouseWheelZoomEnabled !== 'undefined') {
            view.navigation.mouseWheelZoomEnabled = view._zoomToolOriginalState.mouseWheelZoomEnabled;
          }
          
          if (typeof view.navigation.keyboardNavigationEnabled !== 'undefined') {
            view.navigation.keyboardNavigationEnabled = view._zoomToolOriginalState.keyboardNavigationEnabled;
          } else if (typeof view.navigation.keyboardNavigation !== 'undefined') {
            view.navigation.keyboardNavigation = view._zoomToolOriginalState.keyboardNavigationEnabled;
          }
        } else {
          // No saved state, use defaults
          view.navigation.browserTouchPanEnabled = true;
          view.navigation.momentumEnabled = true;
          
          if (typeof view.navigation.mouseWheelZoomEnabled !== 'undefined') {
            view.navigation.mouseWheelZoomEnabled = true;
          }
          
          if (typeof view.navigation.keyboardNavigationEnabled !== 'undefined') {
            view.navigation.keyboardNavigationEnabled = true;
          } else if (typeof view.navigation.keyboardNavigation !== 'undefined') {
            view.navigation.keyboardNavigation = true;
          }
        }
        
        // Restore action map configurations
        if (view.navigation.actionMap) {
          // Restore from saved state if available
          if (view._zoomToolOriginalActionMap) {
            if (typeof view.navigation.actionMap.dragPrimary !== 'undefined') {
              view.navigation.actionMap.dragPrimary = view._zoomToolOriginalActionMap.dragPrimary || "pan";
            }
            if (typeof view.navigation.actionMap.dragSecondary !== 'undefined') {
              view.navigation.actionMap.dragSecondary = view._zoomToolOriginalActionMap.dragSecondary || "rotate";
            }
            if (typeof view.navigation.actionMap.dragTertiary !== 'undefined') {
              view.navigation.actionMap.dragTertiary = view._zoomToolOriginalActionMap.dragTertiary || null;
            }
            if (typeof view.navigation.actionMap.mouseWheel !== 'undefined') {
              view.navigation.actionMap.mouseWheel = view._zoomToolOriginalActionMap.mouseWheel || "zoom";
            }
            
            // Clear saved state
            view._zoomToolOriginalActionMap = null;
          } else {
            // No saved state, restore defaults
            if (typeof view.navigation.actionMap.dragPrimary !== 'undefined' && 
                view.navigation.actionMap.dragPrimary === "none") {
              view.navigation.actionMap.dragPrimary = "pan";
            }
            
            if (typeof view.navigation.actionMap.dragSecondary !== 'undefined' && 
                view.navigation.actionMap.dragSecondary === "none") {
              view.navigation.actionMap.dragSecondary = "rotate";
            }
            
            if (typeof view.navigation.actionMap.mouseWheel !== 'undefined' && 
                view.navigation.actionMap.mouseWheel === "none") {
              view.navigation.actionMap.mouseWheel = "zoom";
            }
          }
        }
        
        logWithTimestamp("NAVIGATION", "Standard navigation properties restored");
      }
      
      // 3. Restore CSS styles
      if (view.container) {
        // Restore original styles if saved
        if (view._zoomToolOriginalStyles) {
          view.container.style.touchAction = view._zoomToolOriginalStyles.touchAction;
          view.container.style.pointerEvents = view._zoomToolOriginalStyles.pointerEvents;
          view.container.style.userSelect = view._zoomToolOriginalStyles.userSelect;
          
          // Clear saved state
          view._zoomToolOriginalStyles = null;
        } else {
          // Otherwise clear styles
          view.container.style.touchAction = "";
          view.container.style.pointerEvents = "";
          view.container.style.userSelect = "";
        }
        
        // Remove added classes
        view.container.classList.remove("navigation-disabled");
        view.container.classList.remove("zoom-tool-active");
        
        logWithTimestamp("NAVIGATION", "Removed CSS overrides from container");
      }
      
      // 4. Remove event interception
      if (view._zoomToolEventHandlers) {
        // Remove all registered event handlers
        view._zoomToolEventHandlers.handlers.forEach(handlerInfo => {
          try {
            if (handlerInfo.target && handlerInfo.event && handlerInfo.handler) {
              handlerInfo.target.removeEventListener(
                handlerInfo.event, 
                handlerInfo.handler, 
                handlerInfo.options
              );
            }
          } catch (e) {
            // Ignore errors during cleanup
          }
        });
        
        // Clear references
        view._zoomToolEventHandlers.handlers = [];
        view._zoomToolEventHandlers = null;
        logWithTimestamp("NAVIGATION", "Removed event interceptors");
      }
      
      // 5. Remove overlay
      if (view._zoomToolOverlay && view._zoomToolOverlay.parentNode) {
        try {
          view._zoomToolOverlay.parentNode.removeChild(view._zoomToolOverlay);
        } catch (e) {
          logWithTimestamp("WARNING", "Error removing overlay:", e);
        }
        view._zoomToolOverlay = null;
        logWithTimestamp("NAVIGATION", "Removed event intercepting overlay");
      }
      
      // 6. Resume navigation manager if available
      if (view.navigationManager) {
        view.navigationManager.resume();
        logWithTimestamp("NAVIGATION", "Resumed navigationManager");
      }
      
      // Extra safety - force multiple attempts at restoring dragEnabled
      setTimeout(() => {
        if (view && view.navigation) {
          view.navigation.dragEnabled = true;
          logWithTimestamp("NAVIGATION", "Forced dragEnabled = true after delay");
        }
      }, 100);
      
      setTimeout(() => {
        if (view && view.navigation) {
          view.navigation.dragEnabled = true;
          logWithTimestamp("NAVIGATION", "Forced dragEnabled = true after longer delay");
        }
      }, 500);
      
      logWithTimestamp("NAVIGATION", "Navigation restored and event interception removed");
      return true;
    } catch (error) {
      logWithTimestamp("ERROR", "Error in restoring navigation:", error);
      return false;
    }
  }, []);

  /**
   * Forces restoration of map navigation with multiple attempts
   * This ensures navigation is restored even if some methods fail
   */
  const forceRestoreMapNavigation = useCallback(() => {
    if (!mapView) {
      logWithTimestamp("ERROR", "Cannot force restore: mapView is null");
      return false;
    }
    
    logWithTimestamp("NAVIGATION", "Forcing comprehensive navigation restoration");
    
    // First restoration attempt
    const result = restoreMapNavigation(mapView);
    
    // Additional targeted restoration for critical properties
    try {
      // Release any captured pointers
      if (captureElementRef.current && pointerIdRef.current) {
        try {
          captureElementRef.current.releasePointerCapture(pointerIdRef.current);
          logWithTimestamp("NAVIGATION", "Force restore: Released pointer capture");
        } catch (e) {
          // Ignore errors - pointer might have already been released
        }
        
        captureElementRef.current = null;
        pointerIdRef.current = null;
      }
      
      // Reset ignore mouse leave flag
      ignoreMouseLeaveRef.current = false;
      
      // Ensure critical property is always set
      if (mapView.navigation && typeof mapView.navigation.dragEnabled !== 'undefined') {
        mapView.navigation.dragEnabled = true;
        logWithTimestamp("NAVIGATION", "Force restore: Explicitly set dragEnabled to true");
      } else {
        logWithTimestamp("WARNING", "Force restore: Cannot set dragEnabled - property not available");
      }
      
      // Ensure navigationManager is resumed
      if (mapView.navigationManager) {
        mapView.navigationManager.resume();
        logWithTimestamp("NAVIGATION", "Force restore: Explicitly resumed navigationManager");
      } else {
        logWithTimestamp("NAVIGATION", "Force restore: navigationManager not available");
      }
      
      // Capture current state for diagnostic
      const currentState = mapView.navigation ? {
        dragEnabled: mapView.navigation.dragEnabled,
        browserTouchPanEnabled: mapView.navigation.browserTouchPanEnabled,
        mouseWheelZoomEnabled: mapView.navigation.mouseWheelZoomEnabled
      } : "Navigation object not available";
      
      logWithTimestamp("DIAGNOSTIC", "Current navigation state after initial force restore:", currentState);
      
      // Schedule additional attempts with small delays for robustness
      setTimeout(() => {
        if (mapView && mapView.navigation) {
          logWithTimestamp("NAVIGATION", "Force restore: 50ms delayed restoration check");
          if (mapView.navigation.dragEnabled !== true) {
            logWithTimestamp("WARNING", "Force restore: dragEnabled still not true after 50ms!");
            mapView.navigation.dragEnabled = true;
            logWithTimestamp("NAVIGATION", "Force restore: Re-setting dragEnabled to true");
          } else {
            logWithTimestamp("NAVIGATION", "Force restore: dragEnabled correctly set to true");
          }
        }
      }, 50);
      
      setTimeout(() => {
        if (mapView && mapView.navigation) {
          logWithTimestamp("NAVIGATION", "Force restore: 150ms delayed restoration check");
          // Double-check dragEnabled is still true (could be reset by other code)
          if (mapView.navigation.dragEnabled !== true) {
            logWithTimestamp("WARNING", "Force restore: dragEnabled STILL not true after 150ms!");
            mapView.navigation.dragEnabled = true;
            logWithTimestamp("NAVIGATION", "Force restore: Re-setting dragEnabled to true (again)");
          } else {
            logWithTimestamp("NAVIGATION", "Force restore: dragEnabled correctly maintained as true");
          }
          
          // Reset any drag actions that might have been set to "none"
          if (mapView.navigation.actionMap) {
            if (mapView.navigation.actionMap.dragPrimary === "none") {
              logWithTimestamp("NAVIGATION", "Force restore: Found dragPrimary still set to 'none', resetting to 'pan'");
              mapView.navigation.actionMap.dragPrimary = "pan";
            }
          }
        }
      }, 150);
      
      // Final verification check after all restoration attempts
      setTimeout(() => {
        if (!mapView || !mapView.navigation) return;
        
        logWithTimestamp("VERIFICATION", "=== FINAL RESTORATION VERIFICATION ===");
        const finalState = {
          dragEnabled: mapView.navigation.dragEnabled,
          browserTouchPanEnabled: mapView.navigation.browserTouchPanEnabled,
          mouseWheelZoomEnabled: mapView.navigation.mouseWheelZoomEnabled,
          actionMap: mapView.navigation.actionMap ? {
            dragPrimary: mapView.navigation.actionMap.dragPrimary,
            dragSecondary: mapView.navigation.actionMap.dragSecondary,
            mouseWheel: mapView.navigation.actionMap.mouseWheel
          } : "not available"
        };
        
        logWithTimestamp("VERIFICATION", "Final navigation state:", finalState);
        
        if (finalState.dragEnabled !== true) {
          logWithTimestamp("ERROR", "⚠️⚠️⚠️ CRITICAL: dragEnabled is STILL not true after multiple restore attempts!");
          
          // Last desperate attempt
          if (mapView && mapView.navigation) {
            mapView.navigation.dragEnabled = true;
          }
        }
        
        if (mapView.navigationManager) {
          const managerState = {
            viewPausedVal: mapView.navigationManager.viewPausedVal,
            isNavigationAllowed: mapView.navigationManager.isNavigationAllowed
          };
          logWithTimestamp("VERIFICATION", "Final navigationManager state:", managerState);
          
          if (managerState.viewPausedVal === true) {
            logWithTimestamp("ERROR", "⚠️⚠️⚠️ CRITICAL: navigationManager is still paused after multiple resume attempts!");
            
            // Last desperate attempt
            if (mapView.navigationManager) {
              mapView.navigationManager.resume();
            }
          }
        }
      }, 250);
    } catch (error) {
      logWithTimestamp("ERROR", "Error during additional restoration:", error);
    }
    
    return result;
  }, [mapView, restoreMapNavigation]);

  /**
   * Helper function to cancel drawing operation
   * Resets drawing state and restores map navigation
   */
  const cancelDrawing = useCallback(() => {
    logWithTimestamp("DRAWING", "cancelDrawing called");
    
    // Reset drawing state variables
    if (leaveTimeoutIdRef.current) {
      logWithTimestamp("DRAWING", "Clearing mouseleave timeout");
      clearTimeout(leaveTimeoutIdRef.current);
      leaveTimeoutIdRef.current = null;
    }
    
    // Release any pointer captures
    if (captureElementRef.current && pointerIdRef.current) {
      try {
        captureElementRef.current.releasePointerCapture(pointerIdRef.current);
        logWithTimestamp("DRAWING", "Released pointer capture");
      } catch (e) {
        // Ignore errors - pointer might already be released
      }
      
      captureElementRef.current = null;
      pointerIdRef.current = null;
    }
    
    // Reset mouse leave handling
    ignoreMouseLeaveRef.current = false;
    
    logWithTimestamp("DRAWING", "Resetting drawing state refs and React state");
    isDrawingRef.current = false;
    drawStartPointRef.current = null;
    drawEndPointRef.current = null;
    activeDrawButtonRef.current = null;
    
    // Update React state
    setIsDrawing(false);
    setDrawStartPoint(null);
    setDrawEndPoint(null);
  
    // Hide drawing rectangle
    if (rectangleRef.current) {
      logWithTimestamp("DRAWING", "Hiding drawing rectangle");
      rectangleRef.current.style.display = "none";
    } else {
      logWithTimestamp("WARNING", "Rectangle element ref is null when trying to hide it");
    }
    
    // Restore cursor style
    if (mapView?.container) {
      mapView.container.style.cursor = isZoomToolActiveRef.current ? 'crosshair' : 'default';
      logWithTimestamp("DRAWING", `Setting cursor to ${isZoomToolActiveRef.current ? 'crosshair' : 'default'}`);
    } else {
      logWithTimestamp("WARNING", "Map container is not available, cannot restore cursor");
    }
    
    // Remove drawing flag if exists
    if (mapView) {
      mapView._zoomToolDrawing = false;
    }
    
    // Restore map navigation
    logWithTimestamp("DRAWING", "Calling forceRestoreMapNavigation from cancelDrawing");
    forceRestoreMapNavigation();
    logWithTimestamp("DRAWING", "cancelDrawing completed");
  }, [mapView, forceRestoreMapNavigation]);

  /**
   * Initializes drawing tools for the ArcGIS MapView 
   * Creates event handlers for mousedown, mousemove, mouseup, and other events
   */
  const initializeDrawingTools = useCallback((view) => {
    logWithTimestamp("INIT", "Initializing drawing tools");
    
    // Check if view is valid
    if (!view) {
      logWithTimestamp("ERROR", "Cannot initialize drawing tools: view is null");
      return;
    }
    
    // Check if mapRef is valid
    if (!mapRef || !mapRef.current) {
      logWithTimestamp("ERROR", "Cannot initialize drawing tools: mapRef or mapRef.current is null");
      return;
    }
    
    // Create rectangle element if it doesn't exist
    if (!rectangleRef.current) {
      logWithTimestamp("INIT", "Creating draw rectangle DOM element");
      const rect = document.createElement("div");
      rect.className = "draw-rectangle"; // For potential CSS styling
      rect.style.position = "absolute";
      rect.style.border = "2px dashed #0078fa"; // Example: blue dashed border
      rect.style.backgroundColor = "rgba(0, 120, 250, 0.1)"; // Example: light blue semi-transparent fill
      rect.style.pointerEvents = "none"; // Ensures it doesn't interfere with map events
      rect.style.display = "none"; // Initially hidden
      rect.style.zIndex = "10000"; // Ensure it's above EVERYTHING including the overlay
  
      try {
        mapRef.current.appendChild(rect);
        rectangleRef.current = rect;
        logWithTimestamp("INIT", "Draw rectangle DOM element created and added to map container");
      } catch (error) {
        logWithTimestamp("ERROR", "Failed to append draw rectangle to map container:", error);
        return; // Cannot proceed without a map container
      }
    } else {
      logWithTimestamp("INIT", "Draw rectangle DOM element already exists");
    }
  
    // Track drawing state
    let stableDrawingState = false;
  
    // Store event handlers for proper cleanup
    const handlers = {
      // Handle mouse down / pointer down event to start drawing
      mousedown: (e) => {
        logWithTimestamp("EVENT", `Mousedown event fired: button=${e.button}, clientX=${e.clientX}, clientY=${e.clientY}`);
        
        // Skip if tool not active or not left mouse button
        if (!isZoomToolActiveRef.current || e.button !== 0) {
          logWithTimestamp("EVENT", `Ignoring mousedown: tool active=${isZoomToolActiveRef.current}, button=${e.button}`);
          return;
        }
        
        try {
          // Immediately prevent default browser behavior
          e.preventDefault();
          
          // Stop event propagation
          e.stopPropagation();
          e.stopImmediatePropagation();
          
          // CRITICAL: Set flag to ignore mouseleave events
          ignoreMouseLeaveRef.current = true;
          
          // IMPORTANT: Capture pointer if available
          if (e.target && typeof e.target.setPointerCapture === 'function' && e.pointerId) {
            try {
              e.target.setPointerCapture(e.pointerId);
              pointerIdRef.current = e.pointerId;
              captureElementRef.current = e.target;
              logWithTimestamp("EVENT", `Captured pointer ${e.pointerId}`);
            } catch (captureErr) {
              logWithTimestamp("WARNING", "Failed to capture pointer:", captureErr);
            }
          }
          
          // Disable map navigation
          logWithTimestamp("EVENT", "Calling disableMapNavigation from mousedown");
          const disableResult = disableMapNavigation(view);
          logWithTimestamp("EVENT", `disableMapNavigation result: ${disableResult}`);
          
          // Get container bounds for coordinate calculation
          const rect = view.container.getBoundingClientRect();
          
          // Calculate point relative to container
          const startPoint = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
          };
          
          logWithTimestamp("DRAWING", `Setting drawing start point: x=${startPoint.x}, y=${startPoint.y}`);
          
          // Update all state variables
          isDrawingRef.current = true;
          drawStartPointRef.current = startPoint;
          drawEndPointRef.current = startPoint;
          activeDrawButtonRef.current = e.button;
          
          // Set view flag for active drawing
          view._zoomToolDrawing = true;
          
          // Update React state
          setIsDrawing(true);
          setDrawStartPoint(startPoint);
          setDrawEndPoint(startPoint);
          
          // Initialize and show rectangle
          const rectEl = rectangleRef.current;
          if (rectEl) {
            logWithTimestamp("DRAWING", "Positioning and showing rectangle element");
            rectEl.style.left = `${startPoint.x}px`;
            rectEl.style.top = `${startPoint.y}px`;
            rectEl.style.width = "0px";
            rectEl.style.height = "0px";
            rectEl.style.display = "block"; // Make it visible
          } else {
            logWithTimestamp("WARNING", "Rectangle element ref is null when trying to show it");
          }
          
          // Set crosshair cursor
          if (view.container) {
            logWithTimestamp("DRAWING", "Setting cursor to crosshair");
            view.container.style.cursor = 'crosshair';
          } else {
            logWithTimestamp("WARNING", "View container is null, cannot set cursor");
          }
          
          // Short delay before enabling drawing state stabilization
          stableDrawingState = false;
          setTimeout(() => {
            stableDrawingState = true;
            logWithTimestamp("DRAWING", "Drawing state stabilized after timeout");
          }, 100);
        } catch (err) {
          logWithTimestamp("ERROR", "Error in mousedown handler:", err);
          
          // Reset all state on error
          isDrawingRef.current = false;
          drawStartPointRef.current = null;
          drawEndPointRef.current = null;
          activeDrawButtonRef.current = null;
          pointerIdRef.current = null;
          captureElementRef.current = null;
          ignoreMouseLeaveRef.current = false;
          setIsDrawing(false);
          
          // Hide rectangle
          if (rectangleRef.current) {
            rectangleRef.current.style.display = "none";
          }
          
          // Restore navigation
          logWithTimestamp("ERROR", "Forcing navigation restoration after mousedown error");
          forceRestoreMapNavigation();
          
          // Reset cursor
          if (view.container) {
            view.container.style.cursor = 'default';
          }
        }
      },
  
      // Handle context menu to prevent right-click menu
      contextmenu: (e) => {
        if (isZoomToolActiveRef.current || isDrawingRef.current) {
          logWithTimestamp("EVENT", "Suppressing context menu");
          e.stopPropagation();
          e.preventDefault();
        }
        
        if (isDrawingRef.current) {
          logWithTimestamp("EVENT", "Cancelling drawing due to context menu");
          cancelDrawing();
        }
      },
  
      // Handle mouse movement for drawing the rectangle
      mousemove: (e) => {
        // Only process if actively drawing
        if (!isDrawingRef.current || !drawStartPointRef.current) {
          return;
        }
        
        // Prevent default behavior and stop propagation
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Calculate current point relative to container
        const rect = view.container.getBoundingClientRect();
        const currentPoint = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        
        // Update state with current point
        drawEndPointRef.current = currentPoint;
        setDrawEndPoint(currentPoint);
  
        // Update rectangle size and position
        const rectEl = rectangleRef.current;
        if (rectEl) {
          const start = drawStartPointRef.current;
          
          // Calculate rectangle bounds
          const left = Math.min(start.x, currentPoint.x);
          const top = Math.min(start.y, currentPoint.y);
          const width = Math.abs(currentPoint.x - start.x);
          const height = Math.abs(currentPoint.y - start.y);
  
          // Apply to element
          rectEl.style.left = `${left}px`;
          rectEl.style.top = `${top}px`;
          rectEl.style.width = `${width}px`;
          rectEl.style.height = `${height}px`;
        }
      },
  
      // Handle mouse up to complete drawing
      mouseup: async (e) => {
        logWithTimestamp("EVENT", `Mouseup event fired: button=${e.button}, clientX=${e.clientX}, clientY=${e.clientY}`);
        
        // Skip if not drawing or wrong button
        if (!isDrawingRef.current || activeDrawButtonRef.current !== 0) {
          logWithTimestamp("EVENT", `Ignoring mouseup: drawing=${isDrawingRef.current}, activeButton=${activeDrawButtonRef.current}`);
          return;
        }
        
        logWithTimestamp("EVENT", "Processing mouseup for active drawing");
        
        // Prevent default behavior and stop propagation
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      
        // Reset mouse leave flag
        ignoreMouseLeaveRef.current = false;
        
        // Release any captured pointers
        if (captureElementRef.current && pointerIdRef.current) {
          try {
            captureElementRef.current.releasePointerCapture(pointerIdRef.current);
            logWithTimestamp("EVENT", `Released pointer ${pointerIdRef.current}`);
          } catch (releaseErr) {
            logWithTimestamp("WARNING", "Failed to release pointer capture:", releaseErr);
          }
          
          captureElementRef.current = null;
          pointerIdRef.current = null;
        }
      
        // Clear any leave timeout
        stableDrawingState = false;
        if (leaveTimeoutIdRef.current) {
          logWithTimestamp("DRAWING", "Clearing mouseleave timeout");
          clearTimeout(leaveTimeoutIdRef.current);
          leaveTimeoutIdRef.current = null;
        }
      
        // Get the current start and end points
        const startPoint = drawStartPointRef.current;
        
        // Calculate current endpoint relative to container
        const rect = view.container.getBoundingClientRect();
        const currentPoint = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        
        // Use the current mouse position if no end point is set yet
        const endPoint = drawEndPointRef.current || currentPoint;
        logWithTimestamp("DRAWING", `Drawing end point: x=${endPoint.x}, y=${endPoint.y}`);
        
        // Reset all drawing state
        isDrawingRef.current = false;
        drawStartPointRef.current = null;
        drawEndPointRef.current = null;
        activeDrawButtonRef.current = null;
        
        // Reset view flag
        if (view) {
          view._zoomToolDrawing = false;
        }
        
        // Update React state
        setIsDrawing(false);
        setDrawStartPoint(null);
        setDrawEndPoint(null);
      
        // Hide rectangle
        if (rectangleRef.current) {
          logWithTimestamp("DRAWING", "Hiding rectangle element");
          rectangleRef.current.style.display = "none";
        } else {
          logWithTimestamp("WARNING", "Rectangle element ref is null when trying to hide it");
        }
        
        // Check if the rectangle is too small
        const width = Math.abs(endPoint.x - (startPoint?.x || endPoint.x));
        const height = Math.abs(endPoint.y - (startPoint?.y || endPoint.y));
        const minDragSize = 10; // Minimum size to be considered a valid zoom rectangle
      
        if (!startPoint || width < minDragSize || height < minDragSize) {
          logWithTimestamp("DRAWING", `Rectangle too small (${width}x${height}) or startPoint missing, aborting zoom`);
          logWithTimestamp("DRAWING", "Deactivating zoom tool due to small rectangle");
          setIsZoomToolActive(false);
          return;
        }
  
        try {
          // Calculate screen coordinates for the zoom rectangle
          logWithTimestamp("DRAWING", "Calculating screen coordinates for zoom rectangle");
          const screenTopLeft = {
            x: Math.min(startPoint.x, endPoint.x),
            y: Math.min(startPoint.y, endPoint.y)
          };
          const screenBottomRight = {
            x: Math.max(startPoint.x, endPoint.x),
            y: Math.max(startPoint.y, endPoint.y)
          };
          
          // Convert screen coordinates to map coordinates
          logWithTimestamp("DRAWING", "Converting screen coordinates to map coordinates");
          const mapTopLeft = view.toMap(screenTopLeft);
          const mapBottomRight = view.toMap(screenBottomRight);
  
          // Validate the map coordinates
          if (!mapTopLeft || !mapBottomRight || 
              isNaN(mapTopLeft.x) || isNaN(mapTopLeft.y) || 
              isNaN(mapBottomRight.x) || isNaN(mapBottomRight.y)) {
            logWithTimestamp("ERROR", "Could not convert screen to valid map coordinates");
            logWithTimestamp("ERROR", "Screen points:", { screenTopLeft, screenBottomRight });
            logWithTimestamp("ERROR", "Map points:", { mapTopLeft, mapBottomRight });
            setIsZoomToolActive(false);
            return;
          }
  
          // Create extent for zoom operation
          logWithTimestamp("DRAWING", "Creating extent for zoom operation");
          const { default: Extent } = await import("@arcgis/core/geometry/Extent");
          const targetExtent = new Extent({
            xmin: Math.min(mapTopLeft.x, mapBottomRight.x),
            ymin: Math.min(mapTopLeft.y, mapBottomRight.y),
            xmax: Math.max(mapTopLeft.x, mapBottomRight.x),
            ymax: Math.max(mapTopLeft.y, mapBottomRight.y),
            spatialReference: view.spatialReference 
          });
  
          logWithTimestamp("DRAWING", "Zooming to extent:", targetExtent.toJSON());
          
          // Cancel any in-progress goTo operations
          if (view.goTo && typeof view.goTo.cancel === 'function') {
            logWithTimestamp("DRAWING", "Cancelling any previous goTo operations");
            view.goTo.cancel();
          }
  
          // Execute the zoom operation
          logWithTimestamp("DRAWING", "Executing goTo operation");
          await view.goTo(targetExtent, { 
            animate: true, 
            duration: 250, 
            easing: "ease-in-out" 
          });
  
          logWithTimestamp("DRAWING", "Zoom operation completed");
          
        } catch (error) {
          logWithTimestamp("ERROR", "Error during zoom to extent operation:", error);
        } finally {
          // Always deactivate the zoom tool after operation
          logWithTimestamp("DRAWING", "Deactivating zoom tool after zoom operation");
          setIsZoomToolActive(false);
        }
      },
  
      // Handle mouse leave to cancel drawing if mouse leaves map area
      mouseleave: (e) => {
        // Skip if not drawing, not in stable state, or ignoring mouse leave
        if (!isDrawingRef.current || !stableDrawingState || ignoreMouseLeaveRef.current) {
          return;
        }
        
        logWithTimestamp("EVENT", "Mouse leave event detected during active drawing");
        
        // Don't cancel if we have pointer capture - it's expected to go outside container
        if (captureElementRef.current && pointerIdRef.current) {
          logWithTimestamp("EVENT", "Ignoring mouseleave because pointer is captured");
          return;
        }
        
        // Clear any existing timeout
        if (leaveTimeoutIdRef.current) {
          logWithTimestamp("DRAWING", "Clearing existing mouseleave timeout");
          clearTimeout(leaveTimeoutIdRef.current);
        }
        
        // Set a new timeout
        logWithTimestamp("DRAWING", "Setting mouseleave timeout");
        leaveTimeoutIdRef.current = setTimeout(() => {
          if (isDrawingRef.current) { 
            logWithTimestamp("DRAWING", "Mouse left map area during draw, cancelling operation (after timeout)");
            cancelDrawing();
          }
          leaveTimeoutIdRef.current = null;
        }, 100);
      }
    };

    // Remove old handlers if they exist
    if (view.drawingHandlers) {
      try {
        logWithTimestamp("INIT", "Removing old drawing event listeners");
        const oldHandlers = view.drawingHandlers;
        
        // Remove mouse events
        view.container.removeEventListener("mousedown", oldHandlers.mousedown, { capture: true });
        view.container.removeEventListener("contextmenu", oldHandlers.contextmenu, { capture: true });
        view.container.removeEventListener("mousemove", oldHandlers.mousemove, { capture: true });
        view.container.removeEventListener("mouseup", oldHandlers.mouseup, { capture: true });
        view.container.removeEventListener("mouseleave", oldHandlers.mouseleave, { capture: true });
        
        // Remove pointer events
        try {
          view.container.removeEventListener("pointerdown", oldHandlers.mousedown, { capture: true });
          view.container.removeEventListener("pointermove", oldHandlers.mousemove, { capture: true });
          view.container.removeEventListener("pointerup", oldHandlers.mouseup, { capture: true });
        } catch (e) {
          // Ignore errors for unsupported event types
        }
        
        logWithTimestamp("INIT", "Old drawing event listeners removed successfully");
      } catch (err) {
        logWithTimestamp("ERROR", "Error removing old drawing event listeners:", err);
      }
    }
  
    // Add new event handlers with capture option
    logWithTimestamp("INIT", "Adding new drawing event listeners with capture option");
    
    // Add mouse and pointer event listeners with options
    const addListener = (target, type, handler) => {
      try {
        target.addEventListener(type, handler, { capture: true, passive: false });
      } catch (e) {
        logWithTimestamp("WARNING", `Failed to add ${type} listener:`, e);
      }
    };
    
    // Add all event handlers
    addListener(view.container, "mousedown", handlers.mousedown);
    addListener(view.container, "contextmenu", handlers.contextmenu);
    addListener(view.container, "mousemove", handlers.mousemove);
    addListener(view.container, "mouseup", handlers.mouseup);
    addListener(view.container, "mouseleave", handlers.mouseleave);
    
    // Add pointer events for touch devices
    addListener(view.container, "pointerdown", handlers.mousedown);
    addListener(view.container, "pointermove", handlers.mousemove);
    addListener(view.container, "pointerup", handlers.mouseup);
    addListener(view.container, "pointercancel", handlers.mouseup);
  
    // Store handlers for cleanup
    view.drawingHandlers = handlers;
    
    // Log current navigation state
    logWithTimestamp("INIT", "Drawing tools initialized successfully");
    logNavigationCapabilities(view);
  }, [mapRef, disableMapNavigation, forceRestoreMapNavigation, cancelDrawing, logNavigationCapabilities]);

  // Effect to synchronize isZoomToolActive state with ref
  useEffect(() => {
    isZoomToolActiveRef.current = isZoomToolActive;
    logWithTimestamp("STATE", `Zoom tool active state changed to: ${isZoomToolActive}`);
    
    // Update cursor style
    if (mapView?.container) {
      mapView.container.style.cursor = isZoomToolActive ? 'crosshair' : 'default';
      logWithTimestamp("STATE", `Setting cursor to ${isZoomToolActive ? 'crosshair' : 'default'}`);
    } else if (mapView) {
      logWithTimestamp("WARNING", "MapView container is null, cannot set cursor");
    }

    // Handle deactivation
    if (!isZoomToolActive) {
      // Reset ignore mouse leave flag
      ignoreMouseLeaveRef.current = false;
      
      // Cancel any active drawing
      if (isDrawingRef.current) {
        logWithTimestamp("STATE", "Zoom tool deactivated while drawing active, cancelling active draw");
        
        // Release any captured pointers
        if (captureElementRef.current && pointerIdRef.current) {
          try {
            captureElementRef.current.releasePointerCapture(pointerIdRef.current);
            logWithTimestamp("STATE", `Released pointer ${pointerIdRef.current} on deactivation`);
          } catch (e) {
            // Ignore errors
          }
          
          captureElementRef.current = null;
          pointerIdRef.current = null;
        }
        
        // Reset drawing state
        isDrawingRef.current = false;
        drawStartPointRef.current = null;
        drawEndPointRef.current = null;
        activeDrawButtonRef.current = null;
        setIsDrawing(false);
        setDrawStartPoint(null);
        setDrawEndPoint(null);
        
        // Hide rectangle
        if (rectangleRef.current) {
          rectangleRef.current.style.display = "none";
        } else {
          logWithTimestamp("WARNING", "Rectangle element ref is null when trying to hide it");
        }
      }
      
      // Restore navigation with multiple attempts
      if (mapView) {
        logWithTimestamp("STATE", "Ensuring navigation capabilities are restored after tool deactivation");
        
        // Initial restoration
        forceRestoreMapNavigation();
        
        // Schedule additional attempts
        const restorationAttempts = [300, 800, 1500];
        restorationAttempts.forEach(delay => {
          setTimeout(() => {
            if (!isZoomToolActiveRef.current && mapView) {
              logWithTimestamp("STATE", `Scheduled restoration attempt at ${delay}ms`);
              forceRestoreMapNavigation();
            }
          }, delay);
        });
      }
    } else {
      // Tool activated - initialize drawing tools
      if (mapView) {
        logWithTimestamp("STATE", "Zoom tool activated, initializing drawing tools");
        initializeDrawingTools(mapView);
      } else {
        logWithTimestamp("WARNING", "MapView is null when trying to initialize drawing tools");
      }
    }
  }, [isZoomToolActive, mapView, forceRestoreMapNavigation, initializeDrawingTools]);

  // Effect to initialize drawing tools when mapView becomes available
  useEffect(() => {
    if (mapView && isZoomToolActive) {
      logWithTimestamp("INIT", "MapView became available while zoom tool active, initializing drawing tools");
      initializeDrawingTools(mapView);
    } else if (mapView) {
      logWithTimestamp("INIT", "MapView became available, but zoom tool not active");
    }
  }, [mapView, isZoomToolActive, initializeDrawingTools]);

  // Effect for cleanup when component unmounts
  useEffect(() => {
    return () => {
      logWithTimestamp("CLEANUP", "Component unmounting, performing cleanup");
      
      // Release any captured pointers
      if (captureElementRef.current && pointerIdRef.current) {
        try {
          captureElementRef.current.releasePointerCapture(pointerIdRef.current);
          logWithTimestamp("CLEANUP", `Released pointer ${pointerIdRef.current} on unmount`);
        } catch (e) {
          // Ignore errors
        }
        
        captureElementRef.current = null;
        pointerIdRef.current = null;
      }
      
      // Reset ignore mouse leave flag
      ignoreMouseLeaveRef.current = false;
      
      // Clean up drawing rectangle DOM element
      if (rectangleRef.current && mapRef.current?.contains(rectangleRef.current)) {
        logWithTimestamp("CLEANUP", "Removing rectangle DOM element");
        mapRef.current.removeChild(rectangleRef.current);
        rectangleRef.current = null;
      }

      // Clean up event listeners
      if (mapView?.drawingHandlers && mapView.container) {
        logWithTimestamp("CLEANUP", "Removing drawing event listeners");
        
        try {
          const viewContainer = mapView.container;
          const drawingHandlers = mapView.drawingHandlers;

          // Remove all event listeners
          const removeListener = (target, type, handler) => {
            try {
              target.removeEventListener(type, handler, { capture: true });
            } catch (e) {
              // Ignore errors
            }
          };
          
          // Remove mouse events
          removeListener(viewContainer, "mousedown", drawingHandlers.mousedown);
          removeListener(viewContainer, "contextmenu", drawingHandlers.contextmenu);
          removeListener(viewContainer, "mousemove", drawingHandlers.mousemove);
          removeListener(viewContainer, "mouseup", drawingHandlers.mouseup);
          removeListener(viewContainer, "mouseleave", drawingHandlers.mouseleave);
          
          // Remove pointer events
          removeListener(viewContainer, "pointerdown", drawingHandlers.mousedown);
          removeListener(viewContainer, "pointermove", drawingHandlers.mousemove);
          removeListener(viewContainer, "pointerup", drawingHandlers.mouseup);
          removeListener(viewContainer, "pointercancel", drawingHandlers.mouseup);

          // Clear references
          delete mapView.drawingHandlers;
          
          logWithTimestamp("CLEANUP", "Drawing tool event listeners removed on unmount");
        } catch (err) {
          logWithTimestamp("ERROR", "Error removing event listeners:", err);
        }
      }

      // Clear any timeouts
      if (leaveTimeoutIdRef.current) {
        logWithTimestamp("CLEANUP", "Clearing any active timeouts");
        clearTimeout(leaveTimeoutIdRef.current);
        leaveTimeoutIdRef.current = null;
      }

      // Restore navigation
      logWithTimestamp("CLEANUP", "Ensuring navigation is restored during unmount");
      forceRestoreMapNavigation();
    };
  }, [mapView, mapRef, forceRestoreMapNavigation]);

  // Return values and functions needed by the consuming component
  return {
    isZoomToolActive,
    setIsZoomToolActive,
    isDrawing,
    drawStartPoint,
    drawEndPoint,
    forceRestoreMapNavigation,
    cancelDrawing,
    logNavigationCapabilities
  };
}