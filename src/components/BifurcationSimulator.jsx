import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Slider } from '@/components/ui/slider.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { RotateCcw, Eye, Settings } from 'lucide-react'

const BifurcationSimulator = ({ vesselData, onOptimalAnglesFound, onBack }) => {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  
  // Viewing angles
  const [raoLao, setRaoLao] = useState(0) // -90 to +90 degrees
  const [cranialCaudal, setCranialCaudal] = useState(0) // -45 to +45 degrees
  
  // 3D vessel segments (from bifurcation point)
  const [vessels, setVessels] = useState({
    main: { direction: [0, 1, 0], length: 100, color: '#ef4444' }, // Red - main vessel
    branch1: { direction: [-0.5, 0.5, 0.3], length: 80, color: '#3b82f6' }, // Blue - branch 1
    branch2: { direction: [0.5, 0.5, -0.2], length: 75, color: '#10b981' } // Green - branch 2
  })
  
  // Canvas settings
  const canvasWidth = 600
  const canvasHeight = 400
  const centerX = canvasWidth / 2
  const centerY = canvasHeight / 2
  const scale = 100

  useEffect(() => {
    if (vesselData) {
      // Update vessel directions based on input data
      updateVesselDirections(vesselData)
    }
  }, [vesselData])

  useEffect(() => {
    drawBifurcation()
  }, [raoLao, cranialCaudal, vessels])

  const updateVesselDirections = (data) => {
    // Convert the measured vessel data to 3D directions
    // This would use the actual measurements from the point selection
    if (data.vessel1Direction && data.vessel2Direction && data.mainDirection) {
      setVessels(prev => ({
        main: { ...prev.main, direction: data.mainDirection },
        branch1: { ...prev.branch1, direction: data.vessel1Direction },
        branch2: { ...prev.branch2, direction: data.vessel2Direction }
      }))
    }
  }

  const drawBifurcation = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    // Set up 3D to 2D projection matrix
    const projectionMatrix = createProjectionMatrix(raoLao, cranialCaudal)

    // Draw coordinate system
    drawCoordinateSystem(ctx, projectionMatrix)

    // Draw bifurcation point
    const bifurcationPoint = [0, 0, 0]
    const projectedCenter = project3DTo2D(bifurcationPoint, projectionMatrix)
    
    ctx.fillStyle = '#fbbf24'
    ctx.beginPath()
    ctx.arc(projectedCenter.x, projectedCenter.y, 6, 0, 2 * Math.PI)
    ctx.fill()

    // Draw vessel segments
    Object.entries(vessels).forEach(([name, vessel]) => {
      drawVesselSegment(ctx, vessel, projectionMatrix, name)
    })

    // Draw angle indicators
    drawAngleIndicators(ctx)

    // Calculate and display optimal angles
    const optimalAngles = calculateOptimalViewingAngles()
    displayOptimalAngles(ctx, optimalAngles)
  }

  const createProjectionMatrix = (raoLaoDeg, cranialCaudalDeg) => {
    const raoLaoRad = (raoLaoDeg * Math.PI) / 180
    const cranialCaudalRad = (cranialCaudalDeg * Math.PI) / 180

    // RAO/LAO rotation around Z-axis (patient's longitudinal axis)
    const cosRao = Math.cos(raoLaoRad)
    const sinRao = Math.sin(raoLaoRad)

    // Cranial/Caudal rotation around X-axis (patient's lateral axis)  
    const cosCranial = Math.cos(cranialCaudalRad)
    const sinCranial = Math.sin(cranialCaudalRad)

    // Combined rotation matrix: R = R_cranial * R_rao
    return [
      [cosRao, -sinRao * cosCranial, sinRao * sinCranial],
      [sinRao, cosRao * cosCranial, -cosRao * sinCranial],
      [0, sinCranial, cosCranial]
    ]
  }

  const project3DTo2D = (point3D, projectionMatrix) => {
    // Apply rotation matrix
    const rotated = [
      projectionMatrix[0][0] * point3D[0] + projectionMatrix[0][1] * point3D[1] + projectionMatrix[0][2] * point3D[2],
      projectionMatrix[1][0] * point3D[0] + projectionMatrix[1][1] * point3D[1] + projectionMatrix[1][2] * point3D[2],
      projectionMatrix[2][0] * point3D[0] + projectionMatrix[2][1] * point3D[1] + projectionMatrix[2][2] * point3D[2]
    ]

    // Project to 2D (orthographic projection)
    return {
      x: centerX + rotated[0] * scale,
      y: centerY - rotated[1] * scale // Flip Y for screen coordinates
    }
  }

  const drawVesselSegment = (ctx, vessel, projectionMatrix, name) => {
    const startPoint = [0, 0, 0] // Bifurcation point
    const endPoint = [
      vessel.direction[0] * vessel.length,
      vessel.direction[1] * vessel.length,
      vessel.direction[2] * vessel.length
    ]

    const projectedStart = project3DTo2D(startPoint, projectionMatrix)
    const projectedEnd = project3DTo2D(endPoint, projectionMatrix)

    // Draw vessel as thick line
    ctx.strokeStyle = vessel.color
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(projectedStart.x, projectedStart.y)
    ctx.lineTo(projectedEnd.x, projectedEnd.y)
    ctx.stroke()

    // Draw vessel label
    ctx.fillStyle = vessel.color
    ctx.font = '12px sans-serif'
    ctx.fillText(
      name.charAt(0).toUpperCase() + name.slice(1),
      projectedEnd.x + 10,
      projectedEnd.y - 10
    )

    // Draw direction arrow
    drawArrow(ctx, projectedStart, projectedEnd, vessel.color)
  }

  const drawArrow = (ctx, start, end, color) => {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const length = Math.sqrt(dx * dx + dy * dy)
    
    if (length < 20) return

    const unitX = dx / length
    const unitY = dy / length
    
    const arrowLength = 15
    const arrowWidth = 8
    
    const arrowX = end.x - unitX * 20
    const arrowY = end.y - unitY * 20
    
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(end.x, end.y)
    ctx.lineTo(
      arrowX - unitY * arrowWidth,
      arrowY + unitX * arrowWidth
    )
    ctx.lineTo(
      arrowX + unitY * arrowWidth,
      arrowY - unitX * arrowWidth
    )
    ctx.closePath()
    ctx.fill()
  }

  const drawCoordinateSystem = (ctx, projectionMatrix) => {
    const axisLength = 50
    const axes = [
      { direction: [1, 0, 0], color: '#dc2626', label: 'X' }, // Red
      { direction: [0, 1, 0], color: '#16a34a', label: 'Y' }, // Green
      { direction: [0, 0, 1], color: '#2563eb', label: 'Z' }  // Blue
    ]

    axes.forEach(axis => {
      const start = project3DTo2D([0, 0, 0], projectionMatrix)
      const end = project3DTo2D([
        axis.direction[0] * axisLength,
        axis.direction[1] * axisLength,
        axis.direction[2] * axisLength
      ], projectionMatrix)

      ctx.strokeStyle = axis.color
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = axis.color
      ctx.font = 'bold 14px sans-serif'
      ctx.fillText(axis.label, end.x + 5, end.y - 5)
    })
  }

  const drawAngleIndicators = (ctx) => {
    // Draw current viewing angles
    ctx.fillStyle = '#374151'
    ctx.font = '14px sans-serif'
    ctx.fillText(`RAO/LAO: ${raoLao.toFixed(1)}°`, 10, 30)
    ctx.fillText(`Cranial/Caudal: ${cranialCaudal.toFixed(1)}°`, 10, 50)
  }

  const calculateOptimalViewingAngles = () => {
    // Calculate the plane normal from the three vessel directions
    const mainDir = vessels.main.direction
    const branch1Dir = vessels.branch1.direction
    const branch2Dir = vessels.branch2.direction

    // Calculate two vectors in the bifurcation plane
    const vec1 = subtractVectors(branch1Dir, mainDir)
    const vec2 = subtractVectors(branch2Dir, mainDir)

    // Calculate plane normal using cross product
    const normal = crossProduct(vec1, vec2)
    const normalizedNormal = normalizeVector(normal)

    // Convert normal to optimal viewing angles
    const optimalRaoLao = Math.atan2(normalizedNormal[0], normalizedNormal[1]) * (180 / Math.PI)
    const optimalCranialCaudal = Math.asin(normalizedNormal[2]) * (180 / Math.PI)

    return {
      raoLao: Math.max(-90, Math.min(90, optimalRaoLao)),
      cranialCaudal: Math.max(-45, Math.min(45, optimalCranialCaudal))
    }
  }

  const displayOptimalAngles = (ctx, optimalAngles) => {
    // Highlight optimal angles
    ctx.fillStyle = '#059669'
    ctx.font = 'bold 14px sans-serif'
    ctx.fillText('Optimal Angles:', canvasWidth - 200, 30)
    ctx.fillText(`RAO/LAO: ${optimalAngles.raoLao.toFixed(1)}°`, canvasWidth - 200, 50)
    ctx.fillText(`Cranial/Caudal: ${optimalAngles.cranialCaudal.toFixed(1)}°`, canvasWidth - 200, 70)

    // Show difference from current
    const diffRaoLao = Math.abs(raoLao - optimalAngles.raoLao)
    const diffCranialCaudal = Math.abs(cranialCaudal - optimalAngles.cranialCaudal)
    
    ctx.fillStyle = diffRaoLao < 5 && diffCranialCaudal < 5 ? '#059669' : '#dc2626'
    ctx.font = '12px sans-serif'
    ctx.fillText(`Diff: ${diffRaoLao.toFixed(1)}°, ${diffCranialCaudal.toFixed(1)}°`, canvasWidth - 200, 90)
  }

  const subtractVectors = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

  const crossProduct = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ]

  const normalizeVector = (v) => {
    const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
    return length > 0 ? [v[0] / length, v[1] / length, v[2] / length] : [0, 0, 0]
  }

  const resetView = () => {
    setRaoLao(0)
    setCranialCaudal(0)
  }

  const goToOptimalView = () => {
    const optimal = calculateOptimalViewingAngles()
    setRaoLao(optimal.raoLao)
    setCranialCaudal(optimal.cranialCaudal)
  }

  const useCurrentAngles = () => {
    const optimal = calculateOptimalViewingAngles()
    if (onOptimalAnglesFound) {
      onOptimalAnglesFound({
        current: { raoLao, cranialCaudal },
        optimal: optimal,
        vessels: vessels
      })
    }
  }

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Eye className="mr-2 h-5 w-5" />
          3D Bifurcation Simulator
        </CardTitle>
        <CardDescription>
          Interactive 3D visualization of coronary bifurcation with adjustable viewing angles
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 3D Canvas */}
        <div className="flex justify-center">
          <div className="border rounded-lg bg-gray-50 p-4">
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              className="border rounded"
              style={{ background: 'white' }}
            />
          </div>
        </div>

        {/* Angle Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* RAO/LAO Slider */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="font-medium">RAO/LAO Angle</label>
              <Badge variant="outline">{raoLao.toFixed(1)}°</Badge>
            </div>
            <Slider
              value={[raoLao]}
              onValueChange={(value) => setRaoLao(value[0])}
              min={-90}
              max={90}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>90° LAO</span>
              <span>0°</span>
              <span>90° RAO</span>
            </div>
          </div>

          {/* Cranial/Caudal Slider */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="font-medium">Cranial/Caudal Angle</label>
              <Badge variant="outline">{cranialCaudal.toFixed(1)}°</Badge>
            </div>
            <Slider
              value={[cranialCaudal]}
              onValueChange={(value) => setCranialCaudal(value[0])}
              min={-45}
              max={45}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>45° Caudal</span>
              <span>0°</span>
              <span>45° Cranial</span>
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex flex-wrap gap-3 justify-center">
          <Button variant="outline" onClick={resetView}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset View
          </Button>
          <Button variant="outline" onClick={goToOptimalView}>
            <Eye className="mr-2 h-4 w-4" />
            Go to Optimal
          </Button>
          <Button onClick={useCurrentAngles}>
            Use These Angles
          </Button>
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
        </div>

        {/* Legend */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium mb-3">Vessel Legend</h4>
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
        </div>
      </CardContent>
    </Card>
  )
}

export default BifurcationSimulator
