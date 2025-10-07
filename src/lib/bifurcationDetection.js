/**
 * Automatic Bifurcation Point Detection
 * Finds the optimal bifurcation point where three vessel segments converge
 */

/**
 * Find the optimal bifurcation point from three vessel centerlines
 * @param {Array} mainCenterline - Main vessel centerline points
 * @param {Array} branch1Centerline - First branch centerline points  
 * @param {Array} branch2Centerline - Second branch centerline points
 * @returns {Object} Bifurcation point and adjusted vessel segments
 */
export function detectBifurcationPoint(mainCenterline, branch1Centerline, branch2Centerline) {
  if (!mainCenterline.length || !branch1Centerline.length || !branch2Centerline.length) {
    throw new Error('All vessel centerlines must have points')
  }

  // Find the optimal bifurcation point using multiple methods
  const candidates = []
  
  // Method 1: Closest approach between vessel lines
  const closestApproach = findClosestApproachPoint(mainCenterline, branch1Centerline, branch2Centerline)
  if (closestApproach) {
    candidates.push({ ...closestApproach, method: 'closest_approach', score: closestApproach.score })
  }
  
  // Method 2: Intersection of vessel direction lines
  const intersection = findVesselIntersection(mainCenterline, branch1Centerline, branch2Centerline)
  if (intersection) {
    candidates.push({ ...intersection, method: 'intersection', score: intersection.score })
  }
  
  // Method 3: Centroid of vessel endpoints
  const centroid = findEndpointCentroid(mainCenterline, branch1Centerline, branch2Centerline)
  if (centroid) {
    candidates.push({ ...centroid, method: 'centroid', score: centroid.score })
  }
  
  if (candidates.length === 0) {
    throw new Error('Could not detect bifurcation point')
  }
  
  // Select the best candidate based on score
  const bestCandidate = candidates.reduce((best, current) => 
    current.score > best.score ? current : best
  )
  
  // Generate adjusted vessel segments from the bifurcation point
  const adjustedSegments = generateAdjustedSegments(
    bestCandidate.point,
    mainCenterline,
    branch1Centerline,
    branch2Centerline
  )
  
  return {
    bifurcationPoint: bestCandidate.point,
    method: bestCandidate.method,
    confidence: bestCandidate.score,
    adjustedSegments: adjustedSegments
  }
}

/**
 * Find bifurcation point using closest approach method
 */
function findClosestApproachPoint(mainCenterline, branch1Centerline, branch2Centerline) {
  let bestPoint = null
  let minTotalDistance = Infinity
  let bestScore = 0
  
  // Test points along each centerline as potential bifurcation points
  const allPoints = [
    ...mainCenterline.map(p => ({ ...p, vessel: 'main' })),
    ...branch1Centerline.map(p => ({ ...p, vessel: 'branch1' })),
    ...branch2Centerline.map(p => ({ ...p, vessel: 'branch2' }))
  ]
  
  for (const candidate of allPoints) {
    // Calculate distances to all three vessel centerlines
    const distToMain = getMinDistanceToLine(candidate, mainCenterline)
    const distToBranch1 = getMinDistanceToLine(candidate, branch1Centerline)
    const distToBranch2 = getMinDistanceToLine(candidate, branch2Centerline)
    
    const totalDistance = distToMain + distToBranch1 + distToBranch2
    const maxDistance = Math.max(distToMain, distToBranch1, distToBranch2)
    
    // Score based on low total distance and balanced distances
    const balanceScore = 1 / (1 + maxDistance)
    const proximityScore = 1 / (1 + totalDistance)
    const score = balanceScore * proximityScore
    
    if (totalDistance < minTotalDistance && score > bestScore) {
      minTotalDistance = totalDistance
      bestScore = score
      bestPoint = { x: candidate.x, y: candidate.y }
    }
  }
  
  return bestPoint ? { point: bestPoint, score: bestScore } : null
}

/**
 * Find bifurcation point using vessel direction intersection
 */
function findVesselIntersection(mainCenterline, branch1Centerline, branch2Centerline) {
  // Calculate direction vectors for each vessel
  const mainDirection = calculateVesselDirection(mainCenterline)
  const branch1Direction = calculateVesselDirection(branch1Centerline)
  const branch2Direction = calculateVesselDirection(branch2Centerline)
  
  if (!mainDirection || !branch1Direction || !branch2Direction) {
    return null
  }
  
  // Find intersection points between vessel direction lines
  const intersections = []
  
  // Main-Branch1 intersection
  const int1 = findLineIntersection(
    mainCenterline[0], mainDirection,
    branch1Centerline[0], branch1Direction
  )
  if (int1) intersections.push(int1)
  
  // Main-Branch2 intersection  
  const int2 = findLineIntersection(
    mainCenterline[0], mainDirection,
    branch2Centerline[0], branch2Direction
  )
  if (int2) intersections.push(int2)
  
  // Branch1-Branch2 intersection
  const int3 = findLineIntersection(
    branch1Centerline[0], branch1Direction,
    branch2Centerline[0], branch2Direction
  )
  if (int3) intersections.push(int3)
  
  if (intersections.length === 0) {
    return null
  }
  
  // Find centroid of intersection points
  let sumX = 0, sumY = 0
  intersections.forEach(point => {
    sumX += point.x
    sumY += point.y
  })
  
  const bifurcationPoint = {
    x: sumX / intersections.length,
    y: sumY / intersections.length
  }
  
  // Score based on how well the point fits all three vessels
  const score = calculateBifurcationScore(bifurcationPoint, mainCenterline, branch1Centerline, branch2Centerline)
  
  return { point: bifurcationPoint, score }
}

/**
 * Find bifurcation point using endpoint centroid method
 */
function findEndpointCentroid(mainCenterline, branch1Centerline, branch2Centerline) {
  // Find the endpoints of each vessel that are closest to the others
  const mainEndpoints = [mainCenterline[0], mainCenterline[mainCenterline.length - 1]]
  const branch1Endpoints = [branch1Centerline[0], branch1Centerline[branch1Centerline.length - 1]]
  const branch2Endpoints = [branch2Centerline[0], branch2Centerline[branch2Centerline.length - 1]]
  
  let bestCentroid = null
  let bestScore = 0
  
  // Try all combinations of endpoints
  for (const mainEnd of mainEndpoints) {
    for (const branch1End of branch1Endpoints) {
      for (const branch2End of branch2Endpoints) {
        const centroid = {
          x: (mainEnd.x + branch1End.x + branch2End.x) / 3,
          y: (mainEnd.y + branch1End.y + branch2End.y) / 3
        }
        
        // Calculate how close this centroid is to all three endpoints
        const dist1 = distance(centroid, mainEnd)
        const dist2 = distance(centroid, branch1End)
        const dist3 = distance(centroid, branch2End)
        
        const maxDist = Math.max(dist1, dist2, dist3)
        const avgDist = (dist1 + dist2 + dist3) / 3
        
        // Score based on compactness (low max distance and low average distance)
        const score = 1 / (1 + maxDist + avgDist)
        
        if (score > bestScore) {
          bestScore = score
          bestCentroid = centroid
        }
      }
    }
  }
  
  return bestCentroid ? { point: bestCentroid, score: bestScore } : null
}

/**
 * Generate adjusted vessel segments from the detected bifurcation point
 */
function generateAdjustedSegments(bifurcationPoint, mainCenterline, branch1Centerline, branch2Centerline) {
  const segmentLength = 25 // pixels (~0.5cm)
  
  return {
    main: generateSegmentFromBifurcation(bifurcationPoint, mainCenterline, segmentLength, 'main'),
    branch1: generateSegmentFromBifurcation(bifurcationPoint, branch1Centerline, segmentLength, 'branch1'),
    branch2: generateSegmentFromBifurcation(bifurcationPoint, branch2Centerline, segmentLength, 'branch2')
  }
}

/**
 * Generate a vessel segment from the bifurcation point
 */
function generateSegmentFromBifurcation(bifurcationPoint, centerline, segmentLength, vesselType) {
  if (centerline.length < 2) {
    return [bifurcationPoint]
  }
  
  // Find the direction away from bifurcation
  const direction = findDirectionFromBifurcation(bifurcationPoint, centerline, vesselType)
  
  if (!direction) {
    return [bifurcationPoint]
  }
  
  // Generate points along the direction
  const segment = [bifurcationPoint]
  const stepSize = 2 // pixels
  const numSteps = Math.floor(segmentLength / stepSize)
  
  for (let i = 1; i <= numSteps; i++) {
    const point = {
      x: bifurcationPoint.x + direction.x * stepSize * i,
      y: bifurcationPoint.y + direction.y * stepSize * i
    }
    segment.push(point)
  }
  
  return segment
}

/**
 * Find the direction from bifurcation point along a vessel
 */
function findDirectionFromBifurcation(bifurcationPoint, centerline, vesselType) {
  if (centerline.length < 2) return null
  
  // For main vessel, direction is typically toward the first point (proximal)
  // For branches, direction is typically away from bifurcation (distal)
  
  let targetPoint
  if (vesselType === 'main') {
    // Find the centerline point furthest from bifurcation (proximal direction)
    targetPoint = centerline.reduce((furthest, point) => {
      const distToBif = distance(point, bifurcationPoint)
      const distFurthest = distance(furthest, bifurcationPoint)
      return distToBif > distFurthest ? point : furthest
    })
  } else {
    // For branches, find the point furthest from bifurcation (distal direction)
    targetPoint = centerline.reduce((furthest, point) => {
      const distToBif = distance(point, bifurcationPoint)
      const distFurthest = distance(furthest, bifurcationPoint)
      return distToBif > distFurthest ? point : furthest
    })
  }
  
  const dx = targetPoint.x - bifurcationPoint.x
  const dy = targetPoint.y - bifurcationPoint.y
  const length = Math.sqrt(dx * dx + dy * dy)
  
  if (length === 0) return null
  
  return {
    x: dx / length,
    y: dy / length
  }
}

/**
 * Helper functions
 */

function getMinDistanceToLine(point, centerline) {
  let minDistance = Infinity
  
  for (let i = 0; i < centerline.length - 1; i++) {
    const dist = distanceToLineSegment(point, centerline[i], centerline[i + 1])
    minDistance = Math.min(minDistance, dist)
  }
  
  return minDistance
}

function distanceToLineSegment(point, lineStart, lineEnd) {
  const A = point.x - lineStart.x
  const B = point.y - lineStart.y
  const C = lineEnd.x - lineStart.x
  const D = lineEnd.y - lineStart.y
  
  const dot = A * C + B * D
  const lenSq = C * C + D * D
  
  if (lenSq === 0) {
    return distance(point, lineStart)
  }
  
  let param = dot / lenSq
  param = Math.max(0, Math.min(1, param))
  
  const closestPoint = {
    x: lineStart.x + param * C,
    y: lineStart.y + param * D
  }
  
  return distance(point, closestPoint)
}

function calculateVesselDirection(centerline) {
  if (centerline.length < 2) return null
  
  const start = centerline[0]
  const end = centerline[centerline.length - 1]
  
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.sqrt(dx * dx + dy * dy)
  
  if (length === 0) return null
  
  return {
    x: dx / length,
    y: dy / length
  }
}

function findLineIntersection(point1, dir1, point2, dir2) {
  // Find intersection of two lines defined by point + direction
  const det = dir1.x * dir2.y - dir1.y * dir2.x
  
  if (Math.abs(det) < 1e-10) {
    return null // Lines are parallel
  }
  
  const dx = point2.x - point1.x
  const dy = point2.y - point1.y
  
  const t = (dx * dir2.y - dy * dir2.x) / det
  
  return {
    x: point1.x + t * dir1.x,
    y: point1.y + t * dir1.y
  }
}

function calculateBifurcationScore(point, mainCenterline, branch1Centerline, branch2Centerline) {
  const distToMain = getMinDistanceToLine(point, mainCenterline)
  const distToBranch1 = getMinDistanceToLine(point, branch1Centerline)
  const distToBranch2 = getMinDistanceToLine(point, branch2Centerline)
  
  const totalDistance = distToMain + distToBranch1 + distToBranch2
  const maxDistance = Math.max(distToMain, distToBranch1, distToBranch2)
  
  // Higher score for lower distances
  return 1 / (1 + totalDistance + maxDistance)
}

function distance(p1, p2) {
  const dx = p1.x - p2.x
  const dy = p1.y - p2.y
  return Math.sqrt(dx * dx + dy * dy)
}
