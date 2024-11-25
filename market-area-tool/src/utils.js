// src/utils.js

import Point from "@arcgis/core/geometry/Point";
import Polyline from "@arcgis/core/geometry/Polyline";
import Polygon from "@arcgis/core/geometry/Polygon";
import Multipoint from "@arcgis/core/geometry/Multipoint";
import Extent from "@arcgis/core/geometry/Extent";

export const ensureValidGeometry = (geometry, spatialReference) => {
  if (!geometry) {
    console.warn('Geometry is undefined for a feature.');
    return null;
  }

  let type = geometry.type;

  if (!type) {
    // Attempt to infer geometry type
    if (geometry.rings) {
      type = 'polygon';
    } else if (geometry.paths) {
      type = 'polyline';
    } else if (geometry.points) {
      type = 'multipoint';
    } else if (geometry.x !== undefined && geometry.y !== undefined) {
      type = 'point';
    } else {
      console.warn('Unable to infer geometry type.');
      return null;
    }
    console.warn(`Inferred geometry type as ${type}`);
  } else {
    console.log(`Feature geometry type: ${type}`);
  }

  try {
    switch (type.toLowerCase()) {
      case 'point':
        return new Point({
          x: geometry.x || (geometry.coordinates && geometry.coordinates[0]),
          y: geometry.y || (geometry.coordinates && geometry.coordinates[1]),
          spatialReference
        });
      case 'polyline':
        return new Polyline({
          paths: geometry.paths || (geometry.coordinates && geometry.coordinates),
          spatialReference
        });
      case 'polygon':
        return new Polygon({
          rings: geometry.rings || (geometry.coordinates && geometry.coordinates),
          spatialReference
        });
      case 'multipoint':
        return new Multipoint({
          points: geometry.points || (geometry.coordinates && geometry.coordinates),
          spatialReference
        });
      case 'extent':
        return new Extent(geometry);
      default:
        console.warn(`Unsupported geometry type: ${type}`);
        return null;
    }
  } catch (error) {
    console.error('Error converting geometry:', error, 'Geometry:', geometry);
    return null;
  }
};
