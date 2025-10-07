/**
 * Vessel Tracking and Centerline Extraction
 * Automatically traces vessel centerlines from seed points for accurate bifurcation analysis
 */

/**
 * Extract vessel centerline from seed points using active contour method
 * @param {ImageData} imageData - Canvas image data
 * @param {Array} seedPoints - Array of {x, y} seed points along the vessel
 * @param {number} segmentLength - Length of segment to extract (in pixels, ~0.5-1cm)
 * @returns {Array} Array of centerline points with sub-pixel accuracy
 */
export function extractVesselCenterline(imageData, seedPoints, segmentLength = 50) {
  if (seedPoints.length < 2) {
    throw new Error('At least 2 seed points required')
  }

  const centerlinePoints = []
  const { width, height, data } = imageData

  // Convert to grayscale intensity map for vessel detection
  const intensityMap = createIntensityMap(data, width, height)

  // Process each segment between seed points
  for (let i = 0; i < seedPoints.length - 1; i++) {
    const startPoint = seedPoints[i]
    const endPoint = seedPoints[i + 1]
    
    // Extract centerline segment between these points
    const segmentPoints = traceCenterlineBetweenPoints(
      intensityMap, 
      width, 
      height, 
      startPoint, 
      endPoint,
      segmentLength
    )
    
    centerlinePoints.push(...segmentPoints)
  }

  // Smooth the centerline and ensure sub-pixel accuracy
  return smoothCenterline(centerlinePoints)
}

/**
 * Create intensity map from RGBA image data
 * Vessels appear darker, so we invert for easier processing
 */
function createIntensityMap(data, width, height) {
  const intensityMap = new Float32Array(width * height)
  
  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4
    // Convert to grayscale and invert (vessels are dark)
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    intensityMap[pixelIndex] = 255 - gray // Invert so vessels are bright
  }
  
  return intensityMap
}

/**
 * Trace centerline between two seed points using gradient-based tracking
 */
function traceCenterlineBetweenPoints(intensityMap, width, height, startPoint, endPoint, maxLength) {
  const centerlinePoints = []
  const stepSize = 1.0 // Sub-pixel step size
  
  // Calculate initial direction
  const dx = endPoint.x - startPoint.x
  const dy = endPoint.y - startPoint.y
  const totalDistance = Math.sqrt(dx * dx + dy * dy)
  
  if (totalDistance === 0) return [startPoint]
  
  // Limit segment length to focus on bifurcation area
  const actualLength = Math.min(totalDistance, maxLength)
  const steps = Math.floor(actualLength / stepSize)
  
  let currentX = startPoint.x
  let currentY = startPoint.y
  
  for (let step = 0; step <= steps; step++) {
    // Find local vessel center using gradient ascent
    const centerPoint = findLocalVesselCenter(
      intensityMap, 
      width, 
      height, 
      currentX, 
      currentY,
      5 // Search radius
    )
    
    centerlinePoints.push({
      x: centerPoint.x,
      y: centerPoint.y,
      intensity: getInterpolatedIntensity(intensityMap, width, height, centerPoint.x, centerPoint.y)
    })
    
    // Move toward end point with slight correction toward vessel center
    const progress = step / steps
    const targetX = startPoint.x + dx * progress
    const targetY = startPoint.y + dy * progress
    
    // Blend target direction with local vessel direction
    const blendFactor = 0.7
    currentX = blendFactor * targetX + (1 - blendFactor) * centerPoint.x
    currentY = blendFactor * targetY + (1 - blendFactor) * centerPoint.y
    
    // Ensure we stay within image bounds
    currentX = Math.max(2, Math.min(width - 3, currentX))
    currentY = Math.max(2, Math.min(height - 3, currentY))
  }
  
  return centerlinePoints
}

/**
 * Find local vessel center using intensity-weighted centroid
 */
function findLocalVesselCenter(intensityMap, width, height, x, y, radius) {
  let weightedX = 0
  let weightedY = 0
  let totalWeight = 0
  
  const centerX = Math.round(x)
  const centerY = Math.round(y)
  
  // Sample points in circular neighborhood
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance > radius) continue
      
      const sampleX = centerX + dx
      const sampleY = centerY + dy
      
      if (sampleX < 0 || sampleX >= width || sampleY < 0 || sampleY >= height) continue
      
      const intensity = intensityMap[sampleY * width + sampleX]
      
      // Weight by intensity and distance (closer and brighter = higher weight)
      const weight = intensity * Math.exp(-distance * distance / (radius * radius))
      
      weightedX += sampleX * weight
      weightedY += sampleY * weight
      totalWeight += weight
    }
  }
  
  if (totalWeight === 0) {
    return { x, y }
  }
  
  return {
    x: weightedX / totalWeight,
    y: weightedY / totalWeight
  }
}

/**
 * Get interpolated intensity at sub-pixel coordinates
 */
function getInterpolatedIntensity(intensityMap, width, height, x, y) {
  const x1 = Math.floor(x)
  const y1 = Math.floor(y)
  const x2 = Math.min(x1 + 1, width - 1)
  const y2 = Math.min(y1 + 1, height - 1)
  
  if (x1 < 0 || y1 < 0 || x2 >= width || y2 >= height) {
    return 0
  }
  
  const fx = x - x1
  const fy = y - y1
  
  const i11 = intensityMap[y1 * width + x1]
  const i21 = intensityMap[y1 * width + x2]
  const i12 = intensityMap[y2 * width + x1]
  const i22 = intensityMap[y2 * width + x2]
  
  // Bilinear interpolation
  const i1 = i11 * (1 - fx) + i21 * fx
  const i2 = i12 * (1 - fx) + i22 * fx
  
  return i1 * (1 - fy) + i2 * fy
}

/**
 * Smooth centerline using moving average filter
 */
function smoothCenterline(points, windowSize = 3) {
  if (points.length < windowSize) return points
  
  const smoothedPoints = []
  const halfWindow = Math.floor(windowSize / 2)
  
  for (let i = 0; i < points.length; i++) {
    let sumX = 0, sumY = 0, count = 0
    
    const start = Math.max(0, i - halfWindow)
    const end = Math.min(points.length - 1, i + halfWindow)
    
    for (let j = start; j <= end; j++) {
      sumX += points[j].x
      sumY += points[j].y
      count++
    }
    
    smoothedPoints.push({
      x: sumX / count,
      y: sumY / count,
      intensity: points[i].intensity || 0
    })
  }
  
  return smoothedPoints
}

/**
 * Calculate 3D vessel direction from centerline points and projection angles
 * @param {Array} centerlinePoints - Array of centerline points
 * @param {number} raoLao - RAO/LAO angle in degrees
 * @param {number} cranialCaudal - Cranial/caudal angle in degrees
 * @param {number} imageWidth - Image width in pixels
 * @param {number} imageHeight - Image height in pixels
 * @returns {Array} 3D direction vector [x, y, z]
 */
export function calculate3DVesselDirection(centerlinePoints, raoLao, cranialCaudal, imageWidth, imageHeight) {
  if (centerlinePoints.length < 2) {
    throw new Error('At least 2 centerline points required')
  }
  
  // Calculate 2D direction from first to last point
  const firstPoint = centerlinePoints[0]
  const lastPoint = centerlinePoints[centerlinePoints.length - 1]
  
  // Normalize to [-1, 1] coordinate system (standard angiographic coordinates)
  const dx = (2 * (lastPoint.x - firstPoint.x) / imageWidth)
  const dy = -(2 * (lastPoint.y - firstPoint.y) / imageHeight) // Flip Y for screen coordinates
  
  // Normalize 2D direction
  const length2D = Math.sqrt(dx * dx + dy * dy)
  if (length2D === 0) {
    throw new Error('Vessel direction is zero length')
  }
  
  const normalizedDx = dx / length2D
  const normalizedDy = dy / length2D
  
  // Convert projection angles to proper angiographic rotation matrices
  const raoRad = (raoLao * Math.PI) / 180
  const cranialRad = (cranialCaudal * Math.PI) / 180
  
  // Standard angiographic coordinate system transformations
  const cosRao = Math.cos(raoRad)
  const sinRao = Math.sin(raoRad)
  const cosCranial = Math.cos(cranialRad)
  const sinCranial = Math.sin(cranialRad)
  
  // Inverse transformation from image plane to 3D world coordinates
  // This accounts for the angiographic viewing geometry
  
  // RAO/LAO inverse rotation (around Z-axis)
  const invRaoMatrix = [
    [cosRao, sinRao, 0],
    [-sinRao, cosRao, 0],
    [0, 0, 1]
  ]
  
  // Cranial/Caudal inverse rotation (around X-axis)
  const invCranialMatrix = [
    [1, 0, 0],
    [0, cosCranial, sinCranial],
    [0, -sinCranial, cosCranial]
  ]
  
  // Combined inverse transformation: inv(R_cranial * R_rao) = inv(R_rao) * inv(R_cranial)
  const invRotation = multiplyMatrices3x3(invRaoMatrix, invCranialMatrix)
  
  // 2D image direction (assuming vessel lies in image plane initially)
  const imageDirection = [normalizedDx, normalizedDy, 0]
  
  // Transform to 3D world coordinates
  const worldDirection = [
    invRotation[0][0] * imageDirection[0] + invRotation[0][1] * imageDirection[1] + invRotation[0][2] * imageDirection[2],
    invRotation[1][0] * imageDirection[0] + invRotation[1][1] * imageDirection[1] + invRotation[1][2] * imageDirection[2],
    invRotation[2][0] * imageDirection[0] + invRotation[2][1] * imageDirection[1] + invRotation[2][2] * imageDirection[2]
  ]
  
  // Normalize the 3D direction vector
  const length3D = Math.sqrt(worldDirection[0] * worldDirection[0] + worldDirection[1] * worldDirection[1] + worldDirection[2] * worldDirection[2])
  
  if (length3D === 0) {
    throw new Error('3D direction calculation resulted in zero vector')
  }
  
  return [
    worldDirection[0] / length3D,
    worldDirection[1] / length3D,
    worldDirection[2] / length3D
  ]
}

/**
 * Matrix multiplication helper for 3x3 matrices
 */
function multiplyMatrices3x3(A, B) {
  const result = Array(3).fill().map(() => Array(3).fill(0))
  
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        result[i][j] += A[i][k] * B[k][j]
      }
    }
  }
  
  return result
}

/**
 * Calculate optimal viewing angles that minimize foreshortening
 * @param {Array} vesselDirections - Array of 3D vessel direction vectors
 * @returns {Object} Optimal RAO/LAO and cranial/caudal angles
 */
export function calculateOptimalViewingAngles(vesselDirections) {
  if (vesselDirections.length !== 3) {
    throw new Error('Exactly 3 vessel directions required (main + 2 branches)')
  }
  
  let bestAngles = { raoLao: 0, cranialCaudal: 0 }
  let bestScore = -Infinity
  
  // Grid search over possible angles
  for (let raoLao = -90; raoLao <= 90; raoLao += 2) {
    for (let cranialCaudal = -45; cranialCaudal <= 45; cranialCaudal += 2) {
      const score = calculateForeshorteningScore(vesselDirections, raoLao, cranialCaudal)
      
      if (score > bestScore) {
        bestScore = score
        bestAngles = { raoLao, cranialCaudal }
      }
    }
  }
  
  // Refine search around best angles
  const refinedAngles = refineOptimalAngles(vesselDirections, bestAngles, 2, 0.5)
  
  return {
    raoLao: Math.round(refinedAngles.raoLao * 10) / 10,
    cranialCaudal: Math.round(refinedAngles.cranialCaudal * 10) / 10,
    score: bestScore
  }
}

/**
 * Calculate foreshortening score for given viewing angles
 * Higher score = less foreshortening (better view)
 */
function calculateForeshorteningScore(vesselDirections, raoLao, cranialCaudal) {
  const raoRad = (raoLao * Math.PI) / 180
  const cranialRad = (cranialCaudal * Math.PI) / 180
  
  // Calculate viewing direction in standard angiographic coordinate system
  // This is the direction from the patient toward the detector
  const viewingDirection = [
    -Math.sin(raoRad) * Math.cos(cranialRad),  // X: left-right (negative for RAO)
    Math.cos(raoRad) * Math.cos(cranialRad),   // Y: anterior-posterior
    Math.sin(cranialRad)                       // Z: head-foot (positive for cranial)
  ]
  
  // Normalize viewing direction (should already be normalized, but ensure it)
  const viewLength = Math.sqrt(viewingDirection[0] * viewingDirection[0] + 
                              viewingDirection[1] * viewingDirection[1] + 
                              viewingDirection[2] * viewingDirection[2])
  
  if (viewLength === 0) return 0
  
  const normalizedView = [
    viewingDirection[0] / viewLength,
    viewingDirection[1] / viewLength,
    viewingDirection[2] / viewLength
  ]
  
  let totalScore = 0
  
  // Calculate projected length for each vessel
  vesselDirections.forEach((vesselDir, index) => {
    // Ensure vessel direction is normalized
    const vesselLength = Math.sqrt(vesselDir[0] * vesselDir[0] + 
                                  vesselDir[1] * vesselDir[1] + 
                                  vesselDir[2] * vesselDir[2])
    
    if (vesselLength === 0) return
    
    const normalizedVessel = [
      vesselDir[0] / vesselLength,
      vesselDir[1] / vesselLength,
      vesselDir[2] / vesselLength
    ]
    
    // Dot product gives cosine of angle between vessel and viewing direction
    const dotProduct = normalizedVessel[0] * normalizedView[0] + 
                      normalizedVessel[1] * normalizedView[1] + 
                      normalizedVessel[2] * normalizedView[2]
    
    // Clamp dot product to [-1, 1] to avoid numerical errors
    const clampedDot = Math.max(-1, Math.min(1, dotProduct))
    
    // Projected length factor = sin(angle) = sqrt(1 - cos²(angle))
    // This represents how much of the vessel length is visible (not foreshortened)
    const projectedLengthFactor = Math.sqrt(1 - clampedDot * clampedDot)
    
    // Weight vessels: main vessel gets higher priority
    const weight = index === 0 ? 1.5 : 1.0  // Increased main vessel weight
    
    totalScore += projectedLengthFactor * weight
  })
  
  return totalScore
}

/**
 * Refine optimal angles using gradient descent
 */
function refineOptimalAngles(vesselDirections, initialAngles, searchRadius, stepSize) {
  let currentAngles = { ...initialAngles }
  let currentScore = calculateForeshorteningScore(vesselDirections, currentAngles.raoLao, currentAngles.cranialCaudal)
  
  const maxIterations = 20
  const tolerance = 0.01
  
  for (let iter = 0; iter < maxIterations; iter++) {
    let improved = false
    
    // Try small steps in each direction
    const directions = [
      { draoLao: stepSize, dcranialCaudal: 0 },
      { draoLao: -stepSize, dcranialCaudal: 0 },
      { draoLao: 0, dcranialCaudal: stepSize },
      { draoLao: 0, dcranialCaudal: -stepSize }
    ]
    
    for (const dir of directions) {
      const testRaoLao = Math.max(-90, Math.min(90, currentAngles.raoLao + dir.draoLao))
      const testCranialCaudal = Math.max(-45, Math.min(45, currentAngles.cranialCaudal + dir.dcranialCaudal))
      
      const testScore = calculateForeshorteningScore(vesselDirections, testRaoLao, testCranialCaudal)
      
      if (testScore > currentScore + tolerance) {
        currentAngles.raoLao = testRaoLao
        currentAngles.cranialCaudal = testCranialCaudal
        currentScore = testScore
        improved = true
        break
      }
    }
    
    if (!improved) {
      break
    }
  }
  
  return currentAngles
}
