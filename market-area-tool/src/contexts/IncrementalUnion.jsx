import * as geometryEngineAsync from "@arcgis/core/geometry/geometryEngineAsync";
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";

/**
 * Advanced border unification algorithm
 * @param {Object[]} features - Array of features to unify
 * @param {Object} options - Configuration options for unification
 * @returns {Object} Unified geometry with smoothed borders
 */
async function unifyBoundaries(features, options = {}) {
  const {
    toleranceMeters = 10,  // Tolerance for border alignment
    simplificationFactor = 0.001,  // Simplification factor
    debugMode = false
  } = options;

  if (features.length < 2) {
    return features[0]?.geometry || null;
  }

  try {
    // 1. Group features by their shared attributes
    const featureGroups = groupFeaturesBySharedAttributes(features);

    // 2. Perform border detection and alignment
    const alignedFeatures = await detectAndAlignSharedBorders(
      features, 
      toleranceMeters
    );

    // 3. Merge geometries with advanced smoothing
    const mergedGeometry = await performAdvancedMerge(
      alignedFeatures, 
      simplificationFactor
    );

    // Optional debug logging
    if (debugMode) {
      console.log('Boundary Unification Debug:', {
        inputFeatures: features.length,
        alignedFeatures: alignedFeatures.length,
        mergedGeometryType: mergedGeometry?.type
      });
    }

    return mergedGeometry;
  } catch (error) {
    console.error('Boundary Unification Error:', error);
    return null;
  }
}

/**
 * Group features that might share borders based on attributes
 * @param {Object[]} features 
 * @returns {Object} Grouped features
 */
function groupFeaturesBySharedAttributes(features) {
  const groups = {};

  features.forEach(feature => {
    const key = generateAttributeKey(feature.attributes);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(feature);
  });

  return groups;
}

/**
 * Generate a unique key for features with similar characteristics
 * @param {Object} attributes 
 * @returns {string} Attribute key
 */
function generateAttributeKey(attributes) {
  // Example: Create a key based on state and county
  return `${attributes.STATE || ''}-${attributes.COUNTY || ''}`;
}

/**
 * Detect and align shared borders between features
 * @param {Object[]} features 
 * @param {number} toleranceMeters 
 * @returns {Object[]} Aligned features
 */
async function detectAndAlignSharedBorders(features, toleranceMeters) {
  const alignedFeatures = [];

  for (let i = 0; i < features.length; i++) {
    const currentFeature = features[i];
    let alignedFeature = { ...currentFeature };

    // Check for potential border matches with other features
    for (let j = 0; j < features.length; j++) {
      if (i !== j) {
        const otherFeature = features[j];
        
        try {
          // Check if features are close enough to potentially share a border
          const proximity = await geometryEngineAsync.distance(
            currentFeature.geometry, 
            otherFeature.geometry
          );

          if (proximity <= toleranceMeters) {
            // Attempt to align borders
            const alignedGeometry = await alignGeometryBorders(
              currentFeature.geometry, 
              otherFeature.geometry
            );

            if (alignedGeometry) {
              alignedFeature.geometry = alignedGeometry;
            }
          }
        } catch (error) {
          console.warn('Border alignment error:', error);
        }
      }
    }

    alignedFeatures.push(alignedFeature);
  }

  return alignedFeatures;
}

/**
 * Align geometry borders with high precision
 * @param {Object} geometry1 
 * @param {Object} geometry2 
 * @returns {Object} Aligned geometry
 */
async function alignGeometryBorders(geometry1, geometry2) {
  try {
    // Attempt to find intersection
    const intersection = await geometryEngineAsync.intersect(
      geometry1, 
      geometry2
    );

    if (intersection) {
      // Use buffer to smooth out potential small discrepancies
      const smoothedGeometry = await geometryEngineAsync.buffer(
        intersection, 
        0.1  // Small buffer to smooth edges
      );

      return smoothedGeometry;
    }

    return geometry1;
  } catch (error) {
    console.warn('Geometry border alignment error:', error);
    return geometry1;
  }
}

/**
 * Perform advanced merge with smoothing
 * @param {Object[]} features 
 * @param {number} simplificationFactor 
 * @returns {Object} Merged and simplified geometry
 */
async function performAdvancedMerge(features, simplificationFactor) {
  try {
    // Extract geometries
    const geometries = features.map(f => f.geometry);

    // Perform union
    const unionedGeometry = await geometryEngineAsync.union(geometries);

    // Simplify the geometry
    const simplifiedGeometry = await geometryEngineAsync.simplify(
      unionedGeometry, 
      simplificationFactor
    );

    return simplifiedGeometry;
  } catch (error) {
    console.error('Advanced merge error:', error);
    return null;
  }
}

export {
  unifyBoundaries,
  detectAndAlignSharedBorders,
  groupFeaturesBySharedAttributes
};