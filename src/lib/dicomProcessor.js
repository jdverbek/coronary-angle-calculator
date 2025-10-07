/**
 * DICOM CT Processor for Coronary Artery Analysis
 * Handles DICOM loading, 3D reconstruction, and coronary segmentation
 */

import * as cornerstone from 'cornerstone-core'
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader'
import * as dicomParser from 'dicom-parser'

/**
 * Initialize DICOM processing libraries
 */
export function initializeDicomProcessor() {
  // Configure cornerstone for DICOM handling
  cornerstoneWADOImageLoader.external.cornerstone = cornerstone
  cornerstoneWADOImageLoader.external.dicomParser = dicomParser
  
  // Configure WADO image loader
  const config = {
    maxWebWorkers: navigator.hardwareConcurrency || 1,
    startWebWorkersOnDemand: true,
    webWorkerPath: '/cornerstoneWADOImageLoaderWebWorker.js',
    taskConfiguration: {
      decodeTask: {
        codecsPath: '/cornerstoneWADOImageLoaderCodecs.js'
      }
    }
  }
  
  cornerstoneWADOImageLoader.webWorkerManager.initialize(config)
}

/**
 * Load and parse DICOM CT dataset
 * @param {FileList} files - DICOM files from file input
 * @returns {Promise<Object>} CT dataset with metadata and image stack
 */
export async function loadDicomCTDataset(files) {
  const imageIds = []
  const metadata = []
  
  // Process each DICOM file
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    
    try {
      // Create blob URL for the file
      const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(file)
      imageIds.push(imageId)
      
      // Load image to get metadata
      const image = await cornerstone.loadImage(imageId)
      metadata.push({
        imageId,
        instanceNumber: image.data.string('x00200013') || i,
        sliceLocation: parseFloat(image.data.string('x00201041')) || i,
        pixelSpacing: image.data.string('x00280030')?.split('\\').map(parseFloat) || [1, 1],
        sliceThickness: parseFloat(image.data.string('x00180050')) || 1,
        rows: image.rows,
        columns: image.columns,
        windowCenter: image.windowCenter,
        windowWidth: image.windowWidth
      })
    } catch (error) {
      console.warn(`Failed to load DICOM file ${file.name}:`, error)
    }
  }
  
  // Sort by slice location or instance number
  metadata.sort((a, b) => {
    return (a.sliceLocation || a.instanceNumber) - (b.sliceLocation || b.instanceNumber)
  })
  
  const sortedImageIds = metadata.map(m => m.imageId)
  
  return {
    imageIds: sortedImageIds,
    metadata: metadata,
    dimensions: {
      width: metadata[0]?.columns || 512,
      height: metadata[0]?.rows || 512,
      depth: metadata.length,
      pixelSpacing: metadata[0]?.pixelSpacing || [1, 1],
      sliceThickness: metadata[0]?.sliceThickness || 1
    }
  }
}

/**
 * Create 3D volume from DICOM stack
 * @param {Object} dataset - DICOM dataset from loadDicomCTDataset
 * @returns {Promise<Object>} 3D volume data
 */
export async function create3DVolumeFromDicom(dataset) {
  const { imageIds, metadata, dimensions } = dataset
  const { width, height, depth } = dimensions
  
  // Create 3D volume array
  const volumeData = new Int16Array(width * height * depth)
  
  // Load each slice and populate volume
  for (let i = 0; i < imageIds.length; i++) {
    try {
      const image = await cornerstone.loadImage(imageIds[i])
      const pixelData = image.getPixelData()
      
      // Copy slice data to volume
      const sliceOffset = i * width * height
      for (let j = 0; j < pixelData.length; j++) {
        volumeData[sliceOffset + j] = pixelData[j]
      }
    } catch (error) {
      console.error(`Failed to load slice ${i}:`, error)
    }
  }
  
  return {
    data: volumeData,
    dimensions,
    metadata,
    spacing: [
      dimensions.pixelSpacing[0],
      dimensions.pixelSpacing[1], 
      dimensions.sliceThickness
    ]
  }
}

/**
 * Segment coronary arteries using intensity-based region growing
 * @param {Object} volume - 3D volume from create3DVolumeFromDicom
 * @param {Array} seedPoints - Array of {x, y, z} seed points in volume coordinates
 * @param {Object} options - Segmentation parameters
 * @returns {Object} Segmented coronary tree
 */
export function segmentCoronaryArteries(volume, seedPoints, options = {}) {
  const {
    intensityThreshold = 200,  // HU threshold for contrast-enhanced vessels
    maxIntensity = 800,        // Maximum HU to avoid calcification
    regionGrowingRadius = 3,   // Radius for region growing
    minVesselLength = 10,      // Minimum vessel segment length (mm)
    maxVesselRadius = 5        // Maximum vessel radius (mm)
  } = options
  
  const { data, dimensions, spacing } = volume
  const { width, height, depth } = dimensions
  
  const segmentedVessels = []
  const visitedVoxels = new Set()
  
  // Process each seed point
  seedPoints.forEach((seedPoint, index) => {
    const vesselSegment = regionGrowingSegmentation(
      data,
      dimensions,
      seedPoint,
      intensityThreshold,
      maxIntensity,
      regionGrowingRadius,
      visitedVoxels
    )
    
    if (vesselSegment.points.length > minVesselLength) {
      // Extract centerline from segmented region
      const centerline = extractVesselCenterline3D(vesselSegment, spacing)
      
      segmentedVessels.push({
        id: `vessel_${index}`,
        seedPoint,
        centerline,
        segmentedRegion: vesselSegment,
        length: calculateVesselLength(centerline, spacing),
        volume: vesselSegment.points.length * spacing[0] * spacing[1] * spacing[2]
      })
    }
  })
  
  return {
    vessels: segmentedVessels,
    totalVessels: segmentedVessels.length,
    volume: volume
  }
}

/**
 * Region growing segmentation for vessel extraction
 */
function regionGrowingSegmentation(volumeData, dimensions, seedPoint, minThreshold, maxThreshold, radius, visitedVoxels) {
  const { width, height, depth } = dimensions
  const segmentedPoints = []
  const queue = [seedPoint]
  
  while (queue.length > 0) {
    const currentPoint = queue.shift()
    const { x, y, z } = currentPoint
    
    // Check bounds
    if (x < 0 || x >= width || y < 0 || y >= height || z < 0 || z >= depth) {
      continue
    }
    
    const voxelKey = `${x},${y},${z}`
    if (visitedVoxels.has(voxelKey)) {
      continue
    }
    
    // Get voxel intensity
    const voxelIndex = z * width * height + y * width + x
    const intensity = volumeData[voxelIndex]
    
    // Check if voxel meets criteria (contrast-enhanced vessel)
    if (intensity >= minThreshold && intensity <= maxThreshold) {
      visitedVoxels.add(voxelKey)
      segmentedPoints.push(currentPoint)
      
      // Add neighboring voxels to queue
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dz = -radius; dz <= radius; dz++) {
            if (dx === 0 && dy === 0 && dz === 0) continue
            
            const neighborPoint = {
              x: x + dx,
              y: y + dy,
              z: z + dz
            }
            
            queue.push(neighborPoint)
          }
        }
      }
    }
  }
  
  return {
    points: segmentedPoints,
    seedPoint
  }
}

/**
 * Extract vessel centerline from segmented region using distance transform
 */
function extractVesselCenterline3D(segmentedRegion, spacing) {
  const { points } = segmentedRegion
  
  if (points.length === 0) return []
  
  // Simplified centerline extraction - in practice would use skeletonization
  // For now, use a simplified approach based on point clustering
  
  // Sort points by distance from seed
  const seedPoint = segmentedRegion.seedPoint
  points.sort((a, b) => {
    const distA = Math.sqrt(
      Math.pow((a.x - seedPoint.x) * spacing[0], 2) +
      Math.pow((a.y - seedPoint.y) * spacing[1], 2) +
      Math.pow((a.z - seedPoint.z) * spacing[2], 2)
    )
    const distB = Math.sqrt(
      Math.pow((b.x - seedPoint.x) * spacing[0], 2) +
      Math.pow((b.y - seedPoint.y) * spacing[1], 2) +
      Math.pow((b.z - seedPoint.z) * spacing[2], 2)
    )
    return distA - distB
  })
  
  // Sample points along the vessel to create centerline
  const centerlinePoints = []
  const samplingInterval = 2 // Sample every 2mm
  
  for (let i = 0; i < points.length; i += Math.ceil(samplingInterval / spacing[0])) {
    centerlinePoints.push(points[i])
  }
  
  return centerlinePoints
}

/**
 * Calculate vessel length from centerline points
 */
function calculateVesselLength(centerlinePoints, spacing) {
  if (centerlinePoints.length < 2) return 0
  
  let totalLength = 0
  
  for (let i = 1; i < centerlinePoints.length; i++) {
    const p1 = centerlinePoints[i - 1]
    const p2 = centerlinePoints[i]
    
    const distance = Math.sqrt(
      Math.pow((p2.x - p1.x) * spacing[0], 2) +
      Math.pow((p2.y - p1.y) * spacing[1], 2) +
      Math.pow((p2.z - p1.z) * spacing[2], 2)
    )
    
    totalLength += distance
  }
  
  return totalLength
}

/**
 * Generate simulated angiographic projection from 3D volume
 * @param {Object} volume - 3D CT volume
 * @param {Object} vessels - Segmented coronary vessels
 * @param {number} raoLao - RAO/LAO angle in degrees
 * @param {number} cranialCaudal - Cranial/caudal angle in degrees
 * @param {Object} options - Projection parameters
 * @returns {Object} Simulated angiographic projection
 */
export function generateSimulatedProjection(volume, vessels, raoLao, cranialCaudal, options = {}) {
  const {
    projectionWidth = 512,
    projectionHeight = 512,
    sourceDistance = 100,  // cm
    detectorDistance = 30, // cm
    contrastWindow = [200, 800] // HU window for vessel visualization
  } = options
  
  // Create projection matrix for the specified angles
  const projectionMatrix = createAngiographicProjectionMatrix(raoLao, cranialCaudal, sourceDistance, detectorDistance)
  
  // Initialize projection image
  const projectionData = new Float32Array(projectionWidth * projectionHeight)
  
  // Ray casting through volume
  for (let py = 0; py < projectionHeight; py++) {
    for (let px = 0; px < projectionWidth; px++) {
      // Convert pixel coordinates to world coordinates
      const worldCoords = pixelToWorldCoordinates(px, py, projectionWidth, projectionHeight)
      
      // Cast ray through volume
      const rayValue = castRayThroughVolume(volume, worldCoords, projectionMatrix, contrastWindow)
      
      projectionData[py * projectionWidth + px] = rayValue
    }
  }
  
  // Project vessel centerlines
  const projectedVessels = vessels.vessels.map(vessel => {
    const projectedCenterline = vessel.centerline.map(point => {
      return projectPointToImage(point, projectionMatrix, projectionWidth, projectionHeight)
    })
    
    return {
      ...vessel,
      projectedCenterline
    }
  })
  
  return {
    imageData: projectionData,
    width: projectionWidth,
    height: projectionHeight,
    vessels: projectedVessels,
    angles: { raoLao, cranialCaudal },
    projectionMatrix
  }
}

/**
 * Create angiographic projection matrix
 */
function createAngiographicProjectionMatrix(raoLao, cranialCaudal, sourceDistance, detectorDistance) {
  const raoRad = (raoLao * Math.PI) / 180
  const cranialRad = (cranialCaudal * Math.PI) / 180
  
  // Standard angiographic rotations
  const cosRao = Math.cos(raoRad)
  const sinRao = Math.sin(raoRad)
  const cosCranial = Math.cos(cranialRad)
  const sinCranial = Math.sin(cranialRad)
  
  // Combined rotation matrix
  const R = [
    [cosRao * cosCranial, -sinRao, cosRao * sinCranial],
    [sinRao * cosCranial, cosRao, sinRao * sinCranial],
    [-sinCranial, 0, cosCranial]
  ]
  
  // Camera position
  const totalDistance = sourceDistance + detectorDistance
  const cameraPos = [0, 0, totalDistance]
  
  // Apply rotation to camera position
  const rotatedCamera = [
    R[0][0] * cameraPos[0] + R[0][1] * cameraPos[1] + R[0][2] * cameraPos[2],
    R[1][0] * cameraPos[0] + R[1][1] * cameraPos[1] + R[1][2] * cameraPos[2],
    R[2][0] * cameraPos[0] + R[2][1] * cameraPos[1] + R[2][2] * cameraPos[2]
  ]
  
  // Create 3x4 projection matrix
  const t = [
    -R[0][0] * rotatedCamera[0] - R[0][1] * rotatedCamera[1] - R[0][2] * rotatedCamera[2],
    -R[1][0] * rotatedCamera[0] - R[1][1] * rotatedCamera[1] - R[1][2] * rotatedCamera[2],
    -R[2][0] * rotatedCamera[0] - R[2][1] * rotatedCamera[1] - R[2][2] * rotatedCamera[2]
  ]
  
  return [
    [R[0][0], R[0][1], R[0][2], t[0]],
    [R[1][0], R[1][1], R[1][2], t[1]],
    [R[2][0], R[2][1], R[2][2], t[2]]
  ]
}

/**
 * Cast ray through volume for projection
 */
function castRayThroughVolume(volume, worldCoords, projectionMatrix, contrastWindow) {
  const { data, dimensions, spacing } = volume
  const { width, height, depth } = dimensions
  
  // Simplified ray casting - maximum intensity projection (MIP)
  let maxIntensity = -1000 // Start with very low HU value
  
  // Sample along ray through volume
  const numSamples = Math.max(width, height, depth)
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / numSamples
    
    // Calculate 3D position along ray
    const x = Math.round(worldCoords.x + t * (width - worldCoords.x))
    const y = Math.round(worldCoords.y + t * (height - worldCoords.y))
    const z = Math.round(worldCoords.z + t * (depth - worldCoords.z))
    
    // Check bounds
    if (x >= 0 && x < width && y >= 0 && y < height && z >= 0 && z < depth) {
      const voxelIndex = z * width * height + y * width + x
      const intensity = data[voxelIndex]
      
      // Only consider intensities in contrast window (vessels)
      if (intensity >= contrastWindow[0] && intensity <= contrastWindow[1]) {
        maxIntensity = Math.max(maxIntensity, intensity)
      }
    }
  }
  
  return maxIntensity > -1000 ? maxIntensity : 0
}

/**
 * Convert pixel coordinates to world coordinates
 */
function pixelToWorldCoordinates(px, py, width, height) {
  return {
    x: (px / width) * 512,  // Assuming 512x512 volume
    y: (py / height) * 512,
    z: 0
  }
}

/**
 * Project 3D point to 2D image coordinates
 */
function projectPointToImage(point3D, projectionMatrix, imageWidth, imageHeight) {
  // Apply projection matrix
  const homogeneous = [
    projectionMatrix[0][0] * point3D.x + projectionMatrix[0][1] * point3D.y + projectionMatrix[0][2] * point3D.z + projectionMatrix[0][3],
    projectionMatrix[1][0] * point3D.x + projectionMatrix[1][1] * point3D.y + projectionMatrix[1][2] * point3D.z + projectionMatrix[1][3],
    projectionMatrix[2][0] * point3D.x + projectionMatrix[2][1] * point3D.y + projectionMatrix[2][2] * point3D.z + projectionMatrix[2][3]
  ]
  
  // Convert to 2D coordinates
  if (homogeneous[2] !== 0) {
    return {
      x: (homogeneous[0] / homogeneous[2]) * imageWidth / 2 + imageWidth / 2,
      y: (homogeneous[1] / homogeneous[2]) * imageHeight / 2 + imageHeight / 2
    }
  }
  
  return { x: 0, y: 0 }
}

/**
 * Detect bifurcations in segmented coronary tree
 * @param {Object} vessels - Segmented coronary vessels
 * @returns {Array} Detected bifurcation points
 */
export function detectCoronaryBifurcations(vessels) {
  const bifurcations = []
  
  // Simple bifurcation detection based on vessel proximity
  vessels.vessels.forEach((vessel1, i) => {
    vessels.vessels.forEach((vessel2, j) => {
      if (i >= j) return
      
      // Check if vessels are close enough to form a bifurcation
      const bifurcationPoint = findVesselIntersection(vessel1.centerline, vessel2.centerline)
      
      if (bifurcationPoint) {
        bifurcations.push({
          id: `bifurcation_${i}_${j}`,
          point: bifurcationPoint,
          vessel1: vessel1.id,
          vessel2: vessel2.id,
          confidence: calculateBifurcationConfidence(vessel1, vessel2, bifurcationPoint)
        })
      }
    })
  })
  
  return bifurcations
}

/**
 * Find intersection point between two vessel centerlines
 */
function findVesselIntersection(centerline1, centerline2) {
  const proximityThreshold = 5 // mm
  
  for (const point1 of centerline1) {
    for (const point2 of centerline2) {
      const distance = Math.sqrt(
        Math.pow(point1.x - point2.x, 2) +
        Math.pow(point1.y - point2.y, 2) +
        Math.pow(point1.z - point2.z, 2)
      )
      
      if (distance < proximityThreshold) {
        return {
          x: (point1.x + point2.x) / 2,
          y: (point1.y + point2.y) / 2,
          z: (point1.z + point2.z) / 2
        }
      }
    }
  }
  
  return null
}

/**
 * Calculate confidence score for bifurcation detection
 */
function calculateBifurcationConfidence(vessel1, vessel2, bifurcationPoint) {
  // Simple confidence based on vessel lengths and proximity
  const minLength = Math.min(vessel1.length, vessel2.length)
  const maxLength = Math.max(vessel1.length, vessel2.length)
  
  // Higher confidence for longer vessels
  const lengthScore = Math.min(minLength / 20, 1) // Normalize to 20mm
  
  // Higher confidence for more balanced vessel lengths
  const balanceScore = minLength / maxLength
  
  return (lengthScore + balanceScore) / 2
}
