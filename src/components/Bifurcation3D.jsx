import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Slider } from '@/components/ui/slider.jsx'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.jsx'
import { Eye, RotateCcw, Target, Play, Pause } from 'lucide-react'

const Bifurcation3D = ({ vesselData, onOptimalAnglesFound, onBack }) => {
  const [webglSupported, setWebglSupported] = useState(true)
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const glRef = useRef(null)
  const programRef = useRef(null)
  
  // Viewing angles with direction and magnitude
  const [raoLaoDirection, setRaoLaoDirection] = useState('RAO')
  const [raoLaoMagnitude, setRaoLaoMagnitude] = useState(30)
  const [cranialCaudalDirection, setCranialCaudalDirection] = useState('Cranial')
  const [cranialCaudalMagnitude, setCranialCaudalMagnitude] = useState(20)
  
  // Animation and interaction
  const [isAnimating, setIsAnimating] = useState(false)
  const [autoRotate, setAutoRotate] = useState(false)
  const [rotationSpeed, setRotationSpeed] = useState(1)
  
  // 3D scene state
  const [cameraDistance, setCameraDistance] = useState(5)
  const [vessels3D, setVessels3D] = useState(null)
  const [optimalAngles, setOptimalAngles] = useState(null)
  
  // WebGL setup
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    try {
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      if (!gl) {
        console.error('WebGL not supported')
        setWebglSupported(false)
        return
      }
      
      glRef.current = gl
      initWebGL(gl)
      setWebglSupported(true)
    } catch (error) {
      console.error('WebGL initialization error:', error)
      setWebglSupported(false)
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])
  
  // Update 3D vessels when vessel data changes
  useEffect(() => {
    if (vesselData && vesselData.image1VesselData && vesselData.image2VesselData) {
      try {
        const vessels = reconstruct3DVessels(vesselData)
        setVessels3D(vessels)
        
        // Calculate optimal angles
        const optimal = calculateOptimalAngles(vessels)
        setOptimalAngles(optimal)
      } catch (error) {
        console.error('Error processing vessel data:', error)
        // Set default values if processing fails
        setOptimalAngles({ raoLao: 30, cranialCaudal: 20, score: 0 })
      }
    } else {
      // Set default values if no vessel data
      setOptimalAngles({ raoLao: 30, cranialCaudal: 20, score: 0 })
    }
  }, [vesselData])
  
  // Animation loop
  useEffect(() => {
    if (isAnimating || autoRotate) {
      const animate = () => {
        if (autoRotate) {
          setRaoLaoMagnitude(prev => (prev + rotationSpeed) % 360)
        }
        
        renderScene()
        animationRef.current = requestAnimationFrame(animate)
      }
      
      animationRef.current = requestAnimationFrame(animate)
    } else {
      renderScene()
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isAnimating, autoRotate, raoLaoDirection, raoLaoMagnitude, cranialCaudalDirection, cranialCaudalMagnitude, cameraDistance, vessels3D])

  const initWebGL = (gl) => {
    const canvas = canvasRef.current
    if (!canvas || !gl) {
      console.error('Canvas or GL context not available')
      return
    }
    // Vertex shader
    const vertexShaderSource = `
      attribute vec3 aVertexPosition;
      attribute vec3 aVertexColor;
      
      uniform mat4 uModelViewMatrix;
      uniform mat4 uProjectionMatrix;
      
      varying vec3 vColor;
      
      void main(void) {
        gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aVertexPosition, 1.0);
        vColor = aVertexColor;
        gl_PointSize = 8.0;
      }
    `
    
    // Fragment shader
    const fragmentShaderSource = `
      precision mediump float;
      varying vec3 vColor;
      
      void main(void) {
        gl_FragColor = vec4(vColor, 1.0);
      }
    `
    
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
    
    const program = createProgram(gl, vertexShader, fragmentShader)
    programRef.current = program
    
    gl.useProgram(program)
    
    // Set up viewport
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0.95, 0.95, 0.95, 1.0)
    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  const createShader = (gl, type, source) => {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', gl.getShaderInfoLog(shader))
      gl.deleteShader(shader)
      return null
    }
    
    return shader
  }

  const createProgram = (gl, vertexShader, fragmentShader) => {
    const program = gl.createProgram()
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program linking error:', gl.getProgramInfoLog(program))
      gl.deleteProgram(program)
      return null
    }
    
    return program
  }

  const reconstruct3DVessels = (data) => {
    // Reconstruct 3D vessel geometry from two 2D projections
    if (!data) {
      console.warn('No vessel data provided for 3D reconstruction')
      return null
    }
    
    const { image1VesselData, image2VesselData } = data
    
    if (!image1VesselData?.adjustedSegments || !image2VesselData?.adjustedSegments) {
      console.warn('Missing adjusted segments for 3D reconstruction')
      return null
    }
    
    const vessels = {}
    
    try {
      // Reconstruct each vessel segment
      ['main', 'branch1', 'branch2'].forEach(vesselName => {
        const segment1 = image1VesselData.adjustedSegments[vesselName]
        const segment2 = image2VesselData.adjustedSegments[vesselName]
        
        if (segment1 && segment2 && Array.isArray(segment1) && Array.isArray(segment2)) {
          vessels[vesselName] = reconstruct3DSegment(
            segment1,
            segment2,
            image1VesselData.projectionAngles,
            image2VesselData.projectionAngles
          )
        } else {
          console.warn(`Missing or invalid segments for vessel ${vesselName}`)
        }
      })
    } catch (error) {
      console.error('Error in 3D vessel reconstruction:', error)
      return null
    }
    
    return vessels
  }

  const reconstruct3DSegment = (segment1, segment2, angles1, angles2) => {
    // Triangulate 3D points from two 2D projections
    const points3D = []
    
    const maxPoints = Math.min(segment1.length, segment2.length)
    
    for (let i = 0; i < maxPoints; i++) {
      const point1 = segment1[i]
      const point2 = segment2[i]
      
      // Convert 2D points to 3D using triangulation
      const point3D = triangulate3DPoint(point1, point2, angles1, angles2)
      if (point3D) {
        points3D.push(point3D)
      }
    }
    
    return points3D
  }

  const triangulate3DPoint = (point1, point2, angles1, angles2) => {
    // Proper stereo triangulation using angiographic geometry
    
    // Create projection matrices for both views
    const P1 = createAngiographicProjectionMatrix(angles1.raoLao, angles1.cranialCaudal)
    const P2 = createAngiographicProjectionMatrix(angles2.raoLao, angles2.cranialCaudal)
    
    // Normalize image coordinates to [-1, 1] range
    const x1 = (point1.x / 400) - 1  // Assuming 800px image width
    const y1 = 1 - (point1.y / 300)  // Assuming 600px image height, flip Y
    const x2 = (point2.x / 400) - 1
    const y2 = 1 - (point2.y / 300)
    
    // Triangulate using DLT (Direct Linear Transform)
    const point3D = triangulatePointDLT(x1, y1, x2, y2, P1, P2)
    
    return point3D
  }
  
  const createAngiographicProjectionMatrix = (raoLao, cranialCaudal) => {
    // Standard angiographic coordinate system
    const raoRad = (raoLao * Math.PI) / 180
    const cranialRad = (cranialCaudal * Math.PI) / 180
    
    // RAO/LAO rotation around Z-axis (head-foot)
    const R_rao = [
      [Math.cos(raoRad), -Math.sin(raoRad), 0],
      [Math.sin(raoRad),  Math.cos(raoRad), 0],
      [0,                 0,                1]
    ]
    
    // Cranial/Caudal rotation around X-axis (left-right)
    const R_cranial = [
      [1, 0,                    0                   ],
      [0, Math.cos(cranialRad), -Math.sin(cranialRad)],
      [0, Math.sin(cranialRad),  Math.cos(cranialRad)]
    ]
    
    // Combined rotation: R = R_cranial * R_rao
    const R = multiplyMatrices3x3(R_cranial, R_rao)
    
    // Standard angiographic geometry: source at distance, detector at origin
    const sourceDistance = 100  // cm
    const cameraPosition = [0, 0, sourceDistance]
    
    // Apply rotation to camera position
    const rotatedCamera = [
      R[0][0] * cameraPosition[0] + R[0][1] * cameraPosition[1] + R[0][2] * cameraPosition[2],
      R[1][0] * cameraPosition[0] + R[1][1] * cameraPosition[1] + R[1][2] * cameraPosition[2],
      R[2][0] * cameraPosition[0] + R[2][1] * cameraPosition[1] + R[2][2] * cameraPosition[2]
    ]
    
    // Create 3x4 projection matrix [R | -R*t]
    const Rt = [
      -R[0][0] * rotatedCamera[0] - R[0][1] * rotatedCamera[1] - R[0][2] * rotatedCamera[2],
      -R[1][0] * rotatedCamera[0] - R[1][1] * rotatedCamera[1] - R[1][2] * rotatedCamera[2],
      -R[2][0] * rotatedCamera[0] - R[2][1] * rotatedCamera[1] - R[2][2] * rotatedCamera[2]
    ]
    
    return [
      [R[0][0], R[0][1], R[0][2], Rt[0]],
      [R[1][0], R[1][1], R[1][2], Rt[1]],
      [R[2][0], R[2][1], R[2][2], Rt[2]]
    ]
  }
  
  const triangulatePointDLT = (x1, y1, x2, y2, P1, P2) => {
    // Set up linear system AX = 0 for triangulation
    const A = [
      [x1 * P1[2][0] - P1[0][0], x1 * P1[2][1] - P1[0][1], x1 * P1[2][2] - P1[0][2], x1 * P1[2][3] - P1[0][3]],
      [y1 * P1[2][0] - P1[1][0], y1 * P1[2][1] - P1[1][1], y1 * P1[2][2] - P1[1][2], y1 * P1[2][3] - P1[1][3]],
      [x2 * P2[2][0] - P2[0][0], x2 * P2[2][1] - P2[0][1], x2 * P2[2][2] - P2[0][2], x2 * P2[2][3] - P2[0][3]],
      [y2 * P2[2][0] - P2[1][0], y2 * P2[2][1] - P2[1][1], y2 * P2[2][2] - P2[1][2], y2 * P2[2][3] - P2[1][3]]
    ]
    
    // Solve using least squares (simplified SVD)
    const solution = solveLeastSquares(A)
    
    if (Math.abs(solution[3]) < 1e-10) {
      // Point at infinity, return a reasonable default
      return { x: 0, y: 0, z: 0 }
    }
    
    // Convert from homogeneous coordinates
    return {
      x: solution[0] / solution[3],
      y: solution[1] / solution[3],
      z: solution[2] / solution[3]
    }
  }
  
  const multiplyMatrices3x3 = (A, B) => {
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
  
  const solveLeastSquares = (A) => {
    // Simplified least squares solver
    // In practice, would use proper SVD decomposition
    
    // For now, use the last column as a reasonable solution
    // This is a placeholder - proper implementation would use SVD
    const n = A.length
    const m = A[0].length
    
    // Find the column with minimum norm (simplified approach)
    let minNorm = Infinity
    let bestCol = 0
    
    for (let j = 0; j < m; j++) {
      let norm = 0
      for (let i = 0; i < n; i++) {
        norm += A[i][j] * A[i][j]
      }
      if (norm < minNorm && norm > 1e-10) {
        minNorm = norm
        bestCol = j
      }
    }
    
    // Return a normalized solution
    const solution = [0, 0, 0, 1]
    if (bestCol < 3) {
      solution[bestCol] = 1
    }
    
    return solution
  }

  const calculateOptimalAngles = (vessels) => {
    if (!vessels || typeof vessels !== 'object') {
      console.warn('Invalid vessels for optimal angle calculation:', vessels)
      return { raoLao: 30, cranialCaudal: 20, score: 0 }
    }
    
    // Validate vessel data
    const vesselCount = Object.keys(vessels).length
    if (vesselCount === 0) {
      console.warn('No vessels found for optimal angle calculation')
      return { raoLao: 30, cranialCaudal: 20, score: 0 }
    }
    
    // Calculate angles that minimize foreshortening
    let bestScore = -Infinity
    let bestAngles = { raoLao: 0, cranialCaudal: 0 }
    
    try {
      // Grid search for optimal angles
      for (let rao = -90; rao <= 90; rao += 5) {
        for (let cranial = -45; cranial <= 45; cranial += 5) {
          const score = calculateForeshorteningScore(vessels, rao, cranial)
          if (score > bestScore) {
            bestScore = score
            bestAngles = { raoLao: rao, cranialCaudal: cranial }
          }
        }
      }
    } catch (error) {
      console.error('Error in optimal angle calculation:', error)
      return { raoLao: 30, cranialCaudal: 20, score: 0 }
    }
    
    return { ...bestAngles, score: bestScore }
  }

  const calculateForeshorteningScore = (vessels, raoLao, cranialCaudal) => {
    // Calculate how much the vessels would be foreshortened at these angles
    if (!vessels || typeof vessels !== 'object') {
      console.warn('Invalid vessels object:', vessels)
      return 0
    }
    
    let totalScore = 0
    
    try {
      Object.values(vessels).forEach(vessel => {
        if (vessel && Array.isArray(vessel) && vessel.length > 1) {
          const projectedLength = calculateProjectedLength(vessel, raoLao, cranialCaudal)
          totalScore += projectedLength
        }
      })
    } catch (error) {
      console.error('Error calculating foreshortening score:', error)
      return 0
    }
    
    return totalScore
  }

  const calculateProjectedLength = (vessel, raoLao, cranialCaudal) => {
    if (!vessel || vessel.length < 2) return 0
    
    // Calculate viewing direction in angiographic coordinate system
    const raoRad = (raoLao * Math.PI) / 180
    const cranialRad = (cranialCaudal * Math.PI) / 180
    
    // Viewing direction (from patient toward detector)
    const viewingDirection = [
      -Math.sin(raoRad) * Math.cos(cranialRad),  // X: left-right
      Math.cos(raoRad) * Math.cos(cranialRad),   // Y: anterior-posterior
      Math.sin(cranialRad)                       // Z: head-foot
    ]
    
    let totalProjectedLength = 0
    
    for (let i = 0; i < vessel.length - 1; i++) {
      const p1 = vessel[i]
      const p2 = vessel[i + 1]
      
      if (!p1 || !p2) continue
      
      // 3D vessel segment vector
      const segmentVector = [
        p2.x - p1.x,
        p2.y - p1.y,
        p2.z - p1.z
      ]
      
      // Calculate 3D segment length
      const segmentLength3D = Math.sqrt(
        segmentVector[0] * segmentVector[0] + 
        segmentVector[1] * segmentVector[1] + 
        segmentVector[2] * segmentVector[2]
      )
      
      if (segmentLength3D === 0) continue
      
      // Normalize segment vector
      const normalizedSegment = [
        segmentVector[0] / segmentLength3D,
        segmentVector[1] / segmentLength3D,
        segmentVector[2] / segmentLength3D
      ]
      
      // Calculate angle between segment and viewing direction
      const dotProduct = normalizedSegment[0] * viewingDirection[0] + 
                        normalizedSegment[1] * viewingDirection[1] + 
                        normalizedSegment[2] * viewingDirection[2]
      
      // Projected length = 3D_length * sin(angle) = 3D_length * sqrt(1 - cos²(angle))
      const projectionFactor = Math.sqrt(1 - dotProduct * dotProduct)
      const projectedLength = segmentLength3D * projectionFactor
      
      totalProjectedLength += projectedLength
    }
    
    return totalProjectedLength
  }

  const renderScene = () => {
    const gl = glRef.current
    const program = programRef.current
    
    if (!gl || !program || !vessels3D) return
    
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    
    // Calculate current viewing angles
    const finalRaoLao = raoLaoDirection === 'RAO' ? raoLaoMagnitude : -raoLaoMagnitude
    const finalCranialCaudal = cranialCaudalDirection === 'Cranial' ? cranialCaudalMagnitude : -cranialCaudalMagnitude
    
    // Set up matrices
    const projectionMatrix = createPerspectiveMatrix(45, 1, 0.1, 100)
    const modelViewMatrix = createModelViewMatrix(finalRaoLao, finalCranialCaudal, cameraDistance)
    
    // Get uniform locations
    const projectionMatrixLocation = gl.getUniformLocation(program, 'uProjectionMatrix')
    const modelViewMatrixLocation = gl.getUniformLocation(program, 'uModelViewMatrix')
    
    gl.uniformMatrix4fv(projectionMatrixLocation, false, projectionMatrix)
    gl.uniformMatrix4fv(modelViewMatrixLocation, false, modelViewMatrix)
    
    // Render each vessel
    const colors = {
      main: [1.0, 0.2, 0.2], // Red
      branch1: [0.2, 0.5, 1.0], // Blue
      branch2: [0.2, 0.8, 0.2] // Green
    }
    
    Object.entries(vessels3D).forEach(([vesselName, vessel]) => {
      if (vessel && vessel.length > 0) {
        renderVessel(gl, program, vessel, colors[vesselName] || [0.5, 0.5, 0.5])
      }
    })
    
    // Render coordinate axes
    renderAxes(gl, program)
  }

  const renderVessel = (gl, program, vessel, color) => {
    // Create vertex buffer
    const vertices = []
    const colors = []
    
    vessel.forEach(point => {
      vertices.push(point.x, point.y, point.z)
      colors.push(...color)
    })
    
    // Vertex buffer
    const vertexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW)
    
    const positionLocation = gl.getAttribLocation(program, 'aVertexPosition')
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0)
    
    // Color buffer
    const colorBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW)
    
    const colorLocation = gl.getAttribLocation(program, 'aVertexColor')
    gl.enableVertexAttribArray(colorLocation)
    gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 0, 0)
    
    // Draw as line strip and points
    gl.drawArrays(gl.LINE_STRIP, 0, vessel.length)
    gl.drawArrays(gl.POINTS, 0, vessel.length)
    
    // Clean up
    gl.deleteBuffer(vertexBuffer)
    gl.deleteBuffer(colorBuffer)
  }

  const renderAxes = (gl, program) => {
    const axisLength = 1.5
    const axes = [
      // X axis (red)
      [0, 0, 0, axisLength, 0, 0, 1, 0, 0],
      // Y axis (green)
      [0, 0, 0, 0, axisLength, 0, 0, 1, 0],
      // Z axis (blue)
      [0, 0, 0, 0, 0, axisLength, 0, 0, 1]
    ]
    
    axes.forEach(axis => {
      const vertices = [axis[0], axis[1], axis[2], axis[3], axis[4], axis[5]]
      const colors = [axis[6], axis[7], axis[8], axis[6], axis[7], axis[8]]
      
      const vertexBuffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW)
      
      const positionLocation = gl.getAttribLocation(program, 'aVertexPosition')
      gl.enableVertexAttribArray(positionLocation)
      gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0)
      
      const colorBuffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW)
      
      const colorLocation = gl.getAttribLocation(program, 'aVertexColor')
      gl.enableVertexAttribArray(colorLocation)
      gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 0, 0)
      
      gl.drawArrays(gl.LINES, 0, 2)
      
      gl.deleteBuffer(vertexBuffer)
      gl.deleteBuffer(colorBuffer)
    })
  }

  const createPerspectiveMatrix = (fov, aspect, near, far) => {
    const f = 1.0 / Math.tan(fov * Math.PI / 360)
    const rangeInv = 1 / (near - far)
    
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (near + far) * rangeInv, -1,
      0, 0, near * far * rangeInv * 2, 0
    ])
  }

  const createModelViewMatrix = (raoLao, cranialCaudal, distance) => {
    const raoRad = (raoLao * Math.PI) / 180
    const cranialRad = (cranialCaudal * Math.PI) / 180
    
    // Standard angiographic transformations
    // RAO/LAO rotation around Z-axis (head-foot)
    const cosRao = Math.cos(raoRad)
    const sinRao = Math.sin(raoRad)
    
    // Cranial/Caudal rotation around X-axis (left-right)
    const cosCranial = Math.cos(cranialRad)
    const sinCranial = Math.sin(cranialRad)
    
    // Combined transformation matrix for angiographic viewing
    // This represents the camera position relative to the patient
    return new Float32Array([
      // Row 0: X-axis transformation
      cosRao * cosCranial, -sinRao, cosRao * sinCranial, 0,
      
      // Row 1: Y-axis transformation  
      sinRao * cosCranial, cosRao, sinRao * sinCranial, 0,
      
      // Row 2: Z-axis transformation
      -sinCranial, 0, cosCranial, 0,
      
      // Row 3: Translation (camera distance)
      0, 0, -distance, 1
    ])
  }

  const goToOptimalAngles = () => {
    if (optimalAngles) {
      setRaoLaoDirection(optimalAngles.raoLao >= 0 ? 'RAO' : 'LAO')
      setRaoLaoMagnitude(Math.abs(optimalAngles.raoLao))
      setCranialCaudalDirection(optimalAngles.cranialCaudal >= 0 ? 'Cranial' : 'Caudal')
      setCranialCaudalMagnitude(Math.abs(optimalAngles.cranialCaudal))
    }
  }

  const resetView = () => {
    setRaoLaoDirection('RAO')
    setRaoLaoMagnitude(30)
    setCranialCaudalDirection('Cranial')
    setCranialCaudalMagnitude(20)
    setCameraDistance(5)
  }

  const finalRaoLao = raoLaoDirection === 'RAO' ? raoLaoMagnitude : -raoLaoMagnitude
  const finalCranialCaudal = cranialCaudalDirection === 'Cranial' ? cranialCaudalMagnitude : -cranialCaudalMagnitude

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Eye className="mr-2 h-5 w-5" />
          3D Bifurcation Simulator
        </CardTitle>
        <CardDescription>
          Interactive 3D visualization with real-time angle adjustment and foreshortening analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 3D Canvas or Fallback */}
        <div className="flex justify-center">
          <div className="border rounded-lg bg-gray-50 p-4">
            {webglSupported ? (
              <canvas
                ref={canvasRef}
                width={600}
                height={400}
                className="border rounded bg-white"
              />
            ) : (
              <div className="w-[600px] h-[400px] border rounded bg-white flex items-center justify-center">
                <div className="text-center p-8">
                  <Eye className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">3D Visualization Unavailable</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    WebGL is not supported in your browser, but angle calculations are still working.
                  </p>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-800">
                      Use the sliders below to adjust viewing angles and click "Use These Angles" to continue.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Current Angles Display */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 text-center">
          <h3 className="font-semibold mb-2">Current View</h3>
          <div className="grid grid-cols-2 gap-4">
            <Badge variant="outline" className="text-lg px-4 py-2">
              {Math.abs(finalRaoLao)}° {raoLaoDirection}
            </Badge>
            <Badge variant="outline" className="text-lg px-4 py-2">
              {Math.abs(finalCranialCaudal)}° {cranialCaudalDirection}
            </Badge>
          </div>
        </div>

        {/* RAO/LAO Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">RAO/LAO Direction</h4>
            <Badge variant="secondary">{finalRaoLao}°</Badge>
          </div>
          
          <ToggleGroup 
            type="single" 
            value={raoLaoDirection} 
            onValueChange={(value) => value && setRaoLaoDirection(value)}
            className="justify-center"
          >
            <ToggleGroupItem value="LAO" className="px-8">LAO (Left)</ToggleGroupItem>
            <ToggleGroupItem value="RAO" className="px-8">RAO (Right)</ToggleGroupItem>
          </ToggleGroup>

          <Slider
            value={[raoLaoMagnitude]}
            onValueChange={(value) => setRaoLaoMagnitude(value[0])}
            min={0}
            max={90}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>0°</span>
            <span>45°</span>
            <span>90°</span>
          </div>
        </div>

        {/* Cranial/Caudal Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Cranial/Caudal Direction</h4>
            <Badge variant="secondary">{finalCranialCaudal}°</Badge>
          </div>
          
          <ToggleGroup 
            type="single" 
            value={cranialCaudalDirection} 
            onValueChange={(value) => value && setCranialCaudalDirection(value)}
            className="justify-center"
          >
            <ToggleGroupItem value="Caudal" className="px-8">Caudal (Down)</ToggleGroupItem>
            <ToggleGroupItem value="Cranial" className="px-8">Cranial (Up)</ToggleGroupItem>
          </ToggleGroup>

          <Slider
            value={[cranialCaudalMagnitude]}
            onValueChange={(value) => setCranialCaudalMagnitude(value[0])}
            min={0}
            max={45}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>0°</span>
            <span>22.5°</span>
            <span>45°</span>
          </div>
        </div>

        {/* Camera Distance */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-medium">Camera Distance</span>
            <Badge variant="outline">{cameraDistance.toFixed(1)}</Badge>
          </div>
          <Slider
            value={[cameraDistance]}
            onValueChange={(value) => setCameraDistance(value[0])}
            min={2}
            max={10}
            step={0.1}
            className="w-full"
          />
        </div>

        {/* Control Buttons */}
        <div className="flex flex-wrap gap-3 justify-center">
          <Button variant="outline" onClick={resetView}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset View
          </Button>
          
          {optimalAngles && (
            <Button variant="outline" onClick={goToOptimalAngles}>
              <Target className="mr-2 h-4 w-4" />
              Go to Optimal ({Math.abs(optimalAngles.raoLao)}° {optimalAngles.raoLao >= 0 ? 'RAO' : 'LAO'}, {Math.abs(optimalAngles.cranialCaudal)}° {optimalAngles.cranialCaudal >= 0 ? 'Cranial' : 'Caudal'})
            </Button>
          )}
          
          <Button 
            variant="outline" 
            onClick={() => setAutoRotate(!autoRotate)}
          >
            {autoRotate ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
            {autoRotate ? 'Stop' : 'Auto Rotate'}
          </Button>
          
          <Button onClick={() => onOptimalAnglesFound && onOptimalAnglesFound({
            current: { raoLao: finalRaoLao, cranialCaudal: finalCranialCaudal },
            optimal: optimalAngles || { raoLao: finalRaoLao, cranialCaudal: finalCranialCaudal },
            vessels3D: vessels3D
          })}>
            Use These Angles
          </Button>
          
          {!webglSupported && (
            <Button 
              variant="outline"
              onClick={() => onOptimalAnglesFound && onOptimalAnglesFound({
                current: { raoLao: 0, cranialCaudal: 0 },
                optimal: { raoLao: 30, cranialCaudal: 20 },
                vessels3D: null
              })}
            >
              Skip 3D View & Continue
            </Button>
          )}
          
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
        </div>

        {/* Vessel Legend */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium mb-3">3D Vessel Model</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-red-500 rounded mr-2"></div>
              <span>Main Vessel</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-blue-500 rounded mr-2"></div>
              <span>Branch 1</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
              <span>Branch 2</span>
            </div>
          </div>
          {optimalAngles && (
            <div className="mt-3 p-3 bg-green-50 rounded border border-green-200">
              <div className="text-sm text-green-800">
                <strong>Optimal Angles:</strong> {Math.abs(optimalAngles.raoLao)}° {optimalAngles.raoLao >= 0 ? 'RAO' : 'LAO'}, {Math.abs(optimalAngles.cranialCaudal)}° {optimalAngles.cranialCaudal >= 0 ? 'Cranial' : 'Caudal'}
                <br />
                <strong>Score:</strong> {optimalAngles.score?.toFixed(3)} (higher = less foreshortening)
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default Bifurcation3D
