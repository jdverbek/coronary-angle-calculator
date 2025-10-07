/**
 * Mathematical Validation Test Suite for Coronary Angle Calculator
 * Tests the accuracy of 3D reconstruction and angle optimization algorithms
 */

/**
 * Test 1: Known geometry validation
 * Create synthetic vessels with known 3D coordinates and verify reconstruction
 */
export function testKnownGeometry() {
  console.log('=== Testing Known Geometry ===')
  
  // Define a known 3D bifurcation in patient coordinates
  const knownBifurcation = {
    bifurcationPoint: [0, 0, 0],
    mainVessel: [
      [0, 0, 0],
      [0, 2, 0]  // 2cm anterior
    ],
    branch1: [
      [0, 0, 0],
      [1.5, 1.5, 0]  // 45° to the right
    ],
    branch2: [
      [0, 0, 0],
      [-1.5, 1.5, 0]  // 45° to the left
    ]
  }
  
  // Project to two known viewing angles
  const view1 = { raoLao: 30, cranialCaudal: 0 }  // 30° RAO
  const view2 = { raoLao: -30, cranialCaudal: 20 } // 30° LAO, 20° cranial
  
  const projection1 = projectBifurcationToImage(knownBifurcation, view1)
  const projection2 = projectBifurcationToImage(knownBifurcation, view2)
  
  console.log('Original 3D bifurcation:', knownBifurcation)
  console.log('Projection 1 (30° RAO):', projection1)
  console.log('Projection 2 (30° LAO, 20° cranial):', projection2)
  
  // TODO: Reconstruct from projections and compare with original
  
  return { knownBifurcation, projection1, projection2 }
}

/**
 * Test 2: Foreshortening validation
 * Verify that vessels parallel to viewing direction are maximally foreshortened
 */
export function testForeshorteningCalculation() {
  console.log('=== Testing Foreshortening Calculation ===')
  
  // Test vessel parallel to viewing direction (should be maximally foreshortened)
  const parallelVessel = [1, 0, 0]  // Pointing right
  const viewingRight = [1, 0, 0]    // Looking from right
  
  const parallelScore = calculateSingleVesselScore(parallelVessel, viewingRight)
  console.log('Parallel vessel score (should be ~0):', parallelScore)
  
  // Test vessel perpendicular to viewing direction (should be minimally foreshortened)
  const perpendicularVessel = [0, 1, 0]  // Pointing forward
  const perpendicularScore = calculateSingleVesselScore(perpendicularVessel, viewingRight)
  console.log('Perpendicular vessel score (should be ~1):', perpendicularScore)
  
  // Test 45° angle (should be ~0.707)
  const angledVessel = [0.707, 0.707, 0]  // 45° angle
  const angledScore = calculateSingleVesselScore(angledVessel, viewingRight)
  console.log('45° vessel score (should be ~0.707):', angledScore)
  
  return {
    parallel: parallelScore,
    perpendicular: perpendicularScore,
    angled: angledScore
  }
}

/**
 * Test 3: Angiographic coordinate system validation
 */
export function testAngiographicCoordinates() {
  console.log('=== Testing Angiographic Coordinate System ===')
  
  // Test standard angiographic views
  const testAngles = [
    { name: 'AP (0°, 0°)', raoLao: 0, cranialCaudal: 0 },
    { name: '30° RAO', raoLao: 30, cranialCaudal: 0 },
    { name: '30° LAO', raoLao: -30, cranialCaudal: 0 },
    { name: '20° Cranial', raoLao: 0, cranialCaudal: 20 },
    { name: '20° Caudal', raoLao: 0, cranialCaudal: -20 },
    { name: 'RAO 30° Cranial 20°', raoLao: 30, cranialCaudal: 20 }
  ]
  
  testAngles.forEach(angle => {
    const viewingDirection = calculateViewingDirection(angle.raoLao, angle.cranialCaudal)
    console.log(`${angle.name}: viewing direction = [${viewingDirection.map(x => x.toFixed(3)).join(', ')}]`)
  })
  
  return testAngles
}

/**
 * Test 4: Optimal angle calculation validation
 */
export function testOptimalAngleCalculation() {
  console.log('=== Testing Optimal Angle Calculation ===')
  
  // Create a known bifurcation where optimal view is obvious
  const testVessels = [
    [0, 1, 0],    // Main vessel: pointing anterior
    [0.707, 0.707, 0],  // Branch 1: 45° right-anterior
    [-0.707, 0.707, 0]  // Branch 2: 45° left-anterior
  ]
  
  // Optimal view should be approximately AP (0° RAO/LAO, 0° cranial/caudal)
  // because all vessels are in the horizontal plane
  
  const optimalAngles = findOptimalAngles(testVessels)
  console.log('Test vessels:', testVessels)
  console.log('Calculated optimal angles:', optimalAngles)
  console.log('Expected: approximately RAO/LAO = 0°, cranial/caudal = 0°')
  
  return optimalAngles
}

/**
 * Helper functions for validation
 */

function projectBifurcationToImage(bifurcation, viewAngles) {
  const raoRad = (viewAngles.raoLao * Math.PI) / 180
  const cranialRad = (viewAngles.cranialCaudal * Math.PI) / 180
  
  // Create rotation matrices
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
  
  // Project each vessel
  const projected = {}
  
  Object.keys(bifurcation).forEach(vesselName => {
    if (Array.isArray(bifurcation[vesselName][0])) {
      // This is a vessel with multiple points
      projected[vesselName] = bifurcation[vesselName].map(point => {
        const rotated = [
          R[0][0] * point[0] + R[0][1] * point[1] + R[0][2] * point[2],
          R[1][0] * point[0] + R[1][1] * point[1] + R[1][2] * point[2],
          R[2][0] * point[0] + R[2][1] * point[1] + R[2][2] * point[2]
        ]
        
        // Project to 2D (ignore Z coordinate)
        return {
          x: rotated[0] * 100 + 400,  // Scale and center
          y: -rotated[1] * 100 + 300  // Flip Y and center
        }
      })
    } else {
      // This is a single point
      const point = bifurcation[vesselName]
      const rotated = [
        R[0][0] * point[0] + R[0][1] * point[1] + R[0][2] * point[2],
        R[1][0] * point[0] + R[1][1] * point[1] + R[1][2] * point[2],
        R[2][0] * point[0] + R[2][1] * point[1] + R[2][2] * point[2]
      ]
      
      projected[vesselName] = {
        x: rotated[0] * 100 + 400,
        y: -rotated[1] * 100 + 300
      }
    }
  })
  
  return projected
}

function calculateSingleVesselScore(vesselDirection, viewingDirection) {
  // Normalize vectors
  const vesselLength = Math.sqrt(vesselDirection[0] ** 2 + vesselDirection[1] ** 2 + vesselDirection[2] ** 2)
  const viewLength = Math.sqrt(viewingDirection[0] ** 2 + viewingDirection[1] ** 2 + viewingDirection[2] ** 2)
  
  if (vesselLength === 0 || viewLength === 0) return 0
  
  const normalizedVessel = vesselDirection.map(x => x / vesselLength)
  const normalizedView = viewingDirection.map(x => x / viewLength)
  
  // Calculate dot product (cosine of angle)
  const dotProduct = normalizedVessel[0] * normalizedView[0] + 
                    normalizedVessel[1] * normalizedView[1] + 
                    normalizedVessel[2] * normalizedView[2]
  
  // Return sine of angle (projected length factor)
  return Math.sqrt(1 - dotProduct * dotProduct)
}

function calculateViewingDirection(raoLao, cranialCaudal) {
  const raoRad = (raoLao * Math.PI) / 180
  const cranialRad = (cranialCaudal * Math.PI) / 180
  
  return [
    -Math.sin(raoRad) * Math.cos(cranialRad),
    Math.cos(raoRad) * Math.cos(cranialRad),
    Math.sin(cranialRad)
  ]
}

function findOptimalAngles(vesselDirections) {
  let bestScore = -Infinity
  let bestAngles = { raoLao: 0, cranialCaudal: 0 }
  
  // Grid search
  for (let raoLao = -90; raoLao <= 90; raoLao += 5) {
    for (let cranialCaudal = -45; cranialCaudal <= 45; cranialCaudal += 5) {
      const viewingDirection = calculateViewingDirection(raoLao, cranialCaudal)
      
      let totalScore = 0
      vesselDirections.forEach((vessel, index) => {
        const score = calculateSingleVesselScore(vessel, viewingDirection)
        const weight = index === 0 ? 1.5 : 1.0
        totalScore += score * weight
      })
      
      if (totalScore > bestScore) {
        bestScore = totalScore
        bestAngles = { raoLao, cranialCaudal }
      }
    }
  }
  
  return { ...bestAngles, score: bestScore }
}

/**
 * Run all validation tests
 */
export function runAllValidationTests() {
  console.log('🧮 Running Mathematical Validation Tests...\n')
  
  const results = {
    knownGeometry: testKnownGeometry(),
    foreshortening: testForeshorteningCalculation(),
    coordinates: testAngiographicCoordinates(),
    optimalAngles: testOptimalAngleCalculation()
  }
  
  console.log('\n✅ All validation tests completed')
  console.log('Results:', results)
  
  return results
}
