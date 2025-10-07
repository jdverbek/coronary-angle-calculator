import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Slider } from '@/components/ui/slider.jsx'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.jsx'
import { Eye, RotateCcw, Target, Play, Pause } from 'lucide-react'

const Bifurcation3D = ({ vesselData, onOptimalAnglesFound, onBack }) => {
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
    
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) {
      console.error('WebGL not supported')
      return
    }
    
    glRef.current = gl
    initWebGL(gl)
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])
  
  // Update 3D vessels when vessel data changes
  useEffect(() => {
    if (vesselData && vesselData.image1VesselData && vesselData.image2VesselData) {
      const vessels = reconstruct3DVessels(vesselData)
      setVessels3D(vessels)
      
      // Calculate optimal angles
      const optimal = calculateOptimalAngles(vessels)
      setOptimalAngles(optimal)
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
    const { image1VesselData, image2VesselData } = data
    
    if (!image1VesselData?.adjustedSegments || !image2VesselData?.adjustedSegments) {
      return null
    }
    
    const vessels = {}
    
    // Reconstruct each vessel segment
    ['main', 'branch1', 'branch2'].forEach(vesselName => {
      const segment1 = image1VesselData.adjustedSegments[vesselName]
      const segment2 = image2VesselData.adjustedSegments[vesselName]
      
      if (segment1 && segment2) {
        vessels[vesselName] = reconstruct3DSegment(
          segment1,
          segment2,
          image1VesselData.projectionAngles,
          image2VesselData.projectionAngles
        )
      }
    })
    
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
    // Simplified triangulation - in practice this would be more complex
    // This is a placeholder for proper stereo triangulation
    
    // Convert angles to radians
    const rao1 = (angles1.raoLao * Math.PI) / 180
    const cranial1 = (angles1.cranialCaudal * Math.PI) / 180
    const rao2 = (angles2.raoLao * Math.PI) / 180
    const cranial2 = (angles2.cranialCaudal * Math.PI) / 180
    
    // Simplified 3D reconstruction (this would need proper camera calibration)
    const x = (point1.x + point2.x) / 200 - 1 // Normalize to [-1, 1]
    const y = (point1.y + point2.y) / 200 - 1
    const z = Math.sin(rao1 - rao2) * 0.5 // Depth estimate
    
    return { x, y, z }
  }

  const calculateOptimalAngles = (vessels) => {
    if (!vessels) return null
    
    // Calculate angles that minimize foreshortening
    let bestScore = -Infinity
    let bestAngles = { raoLao: 0, cranialCaudal: 0 }
    
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
    
    return { ...bestAngles, score: bestScore }
  }

  const calculateForeshorteningScore = (vessels, raoLao, cranialCaudal) => {
    // Calculate how much the vessels would be foreshortened at these angles
    let totalScore = 0
    
    Object.values(vessels).forEach(vessel => {
      if (vessel && vessel.length > 1) {
        const projectedLength = calculateProjectedLength(vessel, raoLao, cranialCaudal)
        totalScore += projectedLength
      }
    })
    
    return totalScore
  }

  const calculateProjectedLength = (vessel, raoLao, cranialCaudal) => {
    if (vessel.length < 2) return 0
    
    // Calculate the projected length of the vessel at given angles
    const raoRad = (raoLao * Math.PI) / 180
    const cranialRad = (cranialCaudal * Math.PI) / 180
    
    let totalLength = 0
    
    for (let i = 0; i < vessel.length - 1; i++) {
      const p1 = vessel[i]
      const p2 = vessel[i + 1]
      
      // Apply rotation matrix to project the segment
      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      const dz = p2.z - p1.z
      
      // Project to 2D
      const projectedDx = dx * Math.cos(raoRad) - dy * Math.sin(raoRad)
      const projectedDy = dx * Math.sin(raoRad) * Math.cos(cranialRad) + 
                         dy * Math.cos(raoRad) * Math.cos(cranialRad) - 
                         dz * Math.sin(cranialRad)
      
      const segmentLength = Math.sqrt(projectedDx * projectedDx + projectedDy * projectedDy)
      totalLength += segmentLength
    }
    
    return totalLength
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
    
    // Translation matrix
    const translation = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, -distance, 1
    ]
    
    // Rotation matrices
    const cosRao = Math.cos(raoRad)
    const sinRao = Math.sin(raoRad)
    const cosCranial = Math.cos(cranialRad)
    const sinCranial = Math.sin(cranialRad)
    
    return new Float32Array([
      cosRao, -sinRao * cosCranial, sinRao * sinCranial, 0,
      sinRao, cosRao * cosCranial, -cosRao * sinCranial, 0,
      0, sinCranial, cosCranial, 0,
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
        {/* 3D Canvas */}
        <div className="flex justify-center">
          <div className="border rounded-lg bg-gray-50 p-4">
            <canvas
              ref={canvasRef}
              width={600}
              height={400}
              className="border rounded bg-white"
            />
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
            optimal: optimalAngles,
            vessels3D: vessels3D
          })}>
            Use These Angles
          </Button>
          
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
