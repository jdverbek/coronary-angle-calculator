import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Slider } from '@/components/ui/slider.jsx'
import { ZoomIn, ZoomOut, RotateCcw, Target, Wand2, Trash2 } from 'lucide-react'
import { 
  preventDefaultTouchBehaviors, 
  getTouchCoordinates, 
  isIOS, 
  optimizeCanvasForRetina,
  hapticFeedback 
} from '../lib/touchUtils'
import { 
  extractVesselCenterline, 
  calculate3DVesselDirection,
  calculateOptimalViewingAngles 
} from '../lib/vesselTracking'

const VesselTracker = ({ image, title, description, projectionAngles, onVesselDataExtracted, onBack }) => {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  
  // Canvas state
  const [imageLoaded, setImageLoaded] = useState(false)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  
  // Vessel tracking state
  const [vessels, setVessels] = useState({
    main: { seedPoints: [], centerline: [], color: '#ef4444' },
    branch1: { seedPoints: [], centerline: [], color: '#3b82f6' },
    branch2: { seedPoints: [], centerline: [], color: '#10b981' }
  })
  const [currentVessel, setCurrentVessel] = useState('main')
  const [trackingMode, setTrackingMode] = useState('seed') // 'seed' or 'review'
  const [segmentLength, setSegmentLength] = useState(50) // pixels (~0.5-1cm)
  
  // Image processing
  const [imageObj, setImageObj] = useState(null)
  const [imageData, setImageData] = useState(null)
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0)
    
    if (image && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      img.onload = () => {
        const container = containerRef.current
        const containerWidth = container.clientWidth
        const containerHeight = container.clientHeight
        
        optimizeCanvasForRetina(canvas, ctx, containerWidth, containerHeight)
        
        const scaleX = containerWidth / img.width
        const scaleY = containerHeight / img.height
        const initialScale = Math.min(scaleX, scaleY, 1)
        
        setScale(initialScale)
        setOffset({
          x: (containerWidth - img.width * initialScale) / 2,
          y: (containerHeight - img.height * initialScale) / 2
        })
        
        setImageObj(img)
        setImageLoaded(true)
        
        if (isIOS()) {
          preventDefaultTouchBehaviors(canvas)
        }
        
        // Extract image data for vessel tracking
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = img.width
        tempCanvas.height = img.height
        const tempCtx = tempCanvas.getContext('2d')
        tempCtx.drawImage(img, 0, 0)
        setImageData(tempCtx.getImageData(0, 0, img.width, img.height))
        
        drawCanvas(ctx, img, initialScale, {
          x: (containerWidth - img.width * initialScale) / 2,
          y: (containerHeight - img.height * initialScale) / 2
        })
      }
      
      img.src = image
    }
  }, [image])

  useEffect(() => {
    if (imageLoaded && imageObj && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      drawCanvas(ctx, imageObj, scale, offset)
    }
  }, [imageLoaded, scale, offset, vessels, currentVessel])

  const drawCanvas = (ctx, img, currentScale, currentOffset) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    
    // Draw image
    ctx.drawImage(
      img,
      currentOffset.x,
      currentOffset.y,
      img.width * currentScale,
      img.height * currentScale
    )
    
    // Draw vessels
    Object.entries(vessels).forEach(([vesselName, vessel]) => {
      const isActive = vesselName === currentVessel
      const alpha = isActive ? 1.0 : 0.7
      
      // Draw seed points
      vessel.seedPoints.forEach((point, index) => {
        drawSeedPoint(ctx, point, currentScale, currentOffset, vessel.color, alpha, index + 1)
      })
      
      // Draw centerline
      if (vessel.centerline.length > 1) {
        drawCenterline(ctx, vessel.centerline, currentScale, currentOffset, vessel.color, alpha)
      }
      
      // Draw connections between seed points
      if (vessel.seedPoints.length > 1) {
        drawSeedConnections(ctx, vessel.seedPoints, currentScale, currentOffset, vessel.color, alpha)
      }
    })
    
    // Draw instructions
    drawInstructions(ctx)
  }

  const drawSeedPoint = (ctx, point, currentScale, currentOffset, color, alpha, number) => {
    const x = point.x * currentScale + currentOffset.x
    const y = point.y * currentScale + currentOffset.y
    
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    
    // Draw circle
    ctx.beginPath()
    ctx.arc(x, y, 8, 0, 2 * Math.PI)
    ctx.fill()
    ctx.stroke()
    
    // Draw number
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(number.toString(), x, y + 4)
    
    ctx.globalAlpha = 1.0
  }

  const drawCenterline = (ctx, centerline, currentScale, currentOffset, color, alpha) => {
    if (centerline.length < 2) return
    
    ctx.globalAlpha = alpha
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    ctx.beginPath()
    const firstPoint = centerline[0]
    ctx.moveTo(
      firstPoint.x * currentScale + currentOffset.x,
      firstPoint.y * currentScale + currentOffset.y
    )
    
    centerline.slice(1).forEach(point => {
      ctx.lineTo(
        point.x * currentScale + currentOffset.x,
        point.y * currentScale + currentOffset.y
      )
    })
    
    ctx.stroke()
    
    // Draw centerline points
    centerline.forEach(point => {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(
        point.x * currentScale + currentOffset.x,
        point.y * currentScale + currentOffset.y,
        2, 0, 2 * Math.PI
      )
      ctx.fill()
    })
    
    ctx.globalAlpha = 1.0
  }

  const drawSeedConnections = (ctx, seedPoints, currentScale, currentOffset, color, alpha) => {
    if (seedPoints.length < 2) return
    
    ctx.globalAlpha = alpha * 0.5
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.setLineDash([5, 5])
    
    ctx.beginPath()
    const firstPoint = seedPoints[0]
    ctx.moveTo(
      firstPoint.x * currentScale + currentOffset.x,
      firstPoint.y * currentScale + currentOffset.y
    )
    
    seedPoints.slice(1).forEach(point => {
      ctx.lineTo(
        point.x * currentScale + currentOffset.x,
        point.y * currentScale + currentOffset.y
      )
    })
    
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1.0
  }

  const drawInstructions = (ctx) => {
    const vessel = vessels[currentVessel]
    let instruction = ''
    
    if (trackingMode === 'seed') {
      if (vessel.seedPoints.length === 0) {
        instruction = `Click along the ${getVesselDisplayName(currentVessel)} to place seed points`
      } else {
        instruction = `Continue clicking along the ${getVesselDisplayName(currentVessel)} (${vessel.seedPoints.length} points)`
      }
    } else {
      instruction = 'Review and adjust centerlines, then continue'
    }
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(10, 10, 400, 30)
    ctx.fillStyle = '#ffffff'
    ctx.font = '14px sans-serif'
    ctx.fillText(instruction, 15, 30)
  }

  const getVesselDisplayName = (vesselName) => {
    switch (vesselName) {
      case 'main': return 'main vessel'
      case 'branch1': return 'first branch'
      case 'branch2': return 'second branch'
      default: return vesselName
    }
  }

  const handleCanvasClick = (event) => {
    if (!imageObj || trackingMode !== 'seed') return
    
    const canvas = canvasRef.current
    let x, y
    
    if (event.type === 'touchend') {
      const coords = getTouchCoordinates(event, canvas)
      x = coords.x
      y = coords.y
    } else {
      const rect = canvas.getBoundingClientRect()
      x = event.clientX - rect.left
      y = event.clientY - rect.top
    }
    
    // Convert to image coordinates
    const imageX = (x - offset.x) / scale
    const imageY = (y - offset.y) / scale
    
    if (imageX >= 0 && imageX <= imageObj.width && imageY >= 0 && imageY <= imageObj.height) {
      const newVessels = { ...vessels }
      newVessels[currentVessel].seedPoints.push({ x: imageX, y: imageY })
      setVessels(newVessels)
      
      if (isTouch) {
        hapticFeedback('light')
      }
    }
  }

  const extractCenterlines = async () => {
    if (!imageData) return
    
    const newVessels = { ...vessels }
    
    try {
      // Extract centerlines for each vessel with seed points
      for (const [vesselName, vessel] of Object.entries(vessels)) {
        if (vessel.seedPoints.length >= 2) {
          const centerline = extractVesselCenterline(
            imageData,
            vessel.seedPoints,
            segmentLength
          )
          newVessels[vesselName].centerline = centerline
        }
      }
      
      setVessels(newVessels)
      setTrackingMode('review')
    } catch (error) {
      console.error('Error extracting centerlines:', error)
      alert('Error extracting vessel centerlines. Please try adjusting your seed points.')
    }
  }

  const calculateOptimalAngles = () => {
    try {
      const vesselDirections = []
      
      // Calculate 3D directions for each vessel
      const vesselOrder = ['main', 'branch1', 'branch2']
      for (const vesselName of vesselOrder) {
        const vessel = vessels[vesselName]
        if (vessel.centerline.length < 2) {
          throw new Error(`${getVesselDisplayName(vesselName)} centerline not extracted`)
        }
        
        const direction = calculate3DVesselDirection(
          vessel.centerline,
          projectionAngles.raoLao,
          projectionAngles.cranialCaudal,
          imageObj.width,
          imageObj.height
        )
        
        vesselDirections.push(direction)
      }
      
      // Calculate optimal viewing angles
      const optimalAngles = calculateOptimalViewingAngles(vesselDirections)
      
      // Prepare vessel data for next step
      const vesselData = {
        vessels: vessels,
        vesselDirections: vesselDirections,
        optimalAngles: optimalAngles,
        projectionAngles: projectionAngles,
        imageSize: { width: imageObj.width, height: imageObj.height }
      }
      
      if (onVesselDataExtracted) {
        onVesselDataExtracted(vesselData)
      }
    } catch (error) {
      console.error('Error calculating optimal angles:', error)
      alert(`Error calculating optimal angles: ${error.message}`)
    }
  }

  const clearCurrentVessel = () => {
    const newVessels = { ...vessels }
    newVessels[currentVessel] = {
      ...newVessels[currentVessel],
      seedPoints: [],
      centerline: []
    }
    setVessels(newVessels)
  }

  const resetAll = () => {
    setVessels({
      main: { seedPoints: [], centerline: [], color: '#ef4444' },
      branch1: { seedPoints: [], centerline: [], color: '#3b82f6' },
      branch2: { seedPoints: [], centerline: [], color: '#10b981' }
    })
    setCurrentVessel('main')
    setTrackingMode('seed')
  }

  const isComplete = () => {
    return Object.values(vessels).every(vessel => vessel.centerline.length >= 2)
  }

  const hasAnySeedPoints = () => {
    return Object.values(vessels).some(vessel => vessel.seedPoints.length > 0)
  }

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Instructions */}
        <div className="bg-muted p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Vessel Tracking:</span>
            <Badge variant={isComplete() ? "default" : "secondary"}>
              {trackingMode === 'seed' ? 'Placing Seeds' : 'Review Mode'}
            </Badge>
          </div>
          <p className="text-sm mb-2">
            Click along each vessel to place seed points. The algorithm will automatically extract the centerline 
            focusing on 0.5-1cm segments around the bifurcation.
          </p>
          {isTouch && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mt-2">
              <p className="text-xs text-blue-700">
                📱 <strong>Touch Controls:</strong> Tap to place seed points • Use two fingers to pan • Pinch to zoom
              </p>
            </div>
          )}
        </div>

        {/* Vessel Selection */}
        {trackingMode === 'seed' && (
          <div className="flex flex-wrap gap-2 justify-center">
            {Object.entries(vessels).map(([vesselName, vessel]) => (
              <Button
                key={vesselName}
                variant={currentVessel === vesselName ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentVessel(vesselName)}
                className="flex items-center"
              >
                <div 
                  className="w-3 h-3 rounded-full mr-2" 
                  style={{ backgroundColor: vessel.color }}
                />
                {getVesselDisplayName(vesselName)}
                <Badge variant="secondary" className="ml-2">
                  {vessel.seedPoints.length}
                </Badge>
              </Button>
            ))}
          </div>
        )}

        {/* Segment Length Control */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="font-medium">Segment Length (pixels)</label>
            <Badge variant="outline">{segmentLength}px</Badge>
          </div>
          <Slider
            value={[segmentLength]}
            onValueChange={(value) => setSegmentLength(value[0])}
            min={20}
            max={100}
            step={5}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>20px (~0.2cm)</span>
            <span>100px (~1cm)</span>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          className="relative border rounded-lg overflow-hidden bg-gray-100"
          style={{ height: '500px' }}
        >
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className={isTouch ? "cursor-pointer" : "cursor-crosshair"}
            style={{ display: 'block', touchAction: 'none' }}
          />
          
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 justify-center">
          {trackingMode === 'seed' && (
            <>
              <Button 
                variant="outline" 
                onClick={clearCurrentVessel}
                disabled={vessels[currentVessel].seedPoints.length === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear {getVesselDisplayName(currentVessel)}
              </Button>
              <Button 
                onClick={extractCenterlines}
                disabled={!hasAnySeedPoints()}
              >
                <Wand2 className="mr-2 h-4 w-4" />
                Extract Centerlines
              </Button>
            </>
          )}
          
          {trackingMode === 'review' && (
            <>
              <Button 
                variant="outline" 
                onClick={() => setTrackingMode('seed')}
              >
                <Target className="mr-2 h-4 w-4" />
                Adjust Seeds
              </Button>
              <Button 
                onClick={calculateOptimalAngles}
                disabled={!isComplete()}
              >
                <ZoomIn className="mr-2 h-4 w-4" />
                Calculate Optimal Angles
              </Button>
            </>
          )}
          
          <Button variant="outline" onClick={resetAll}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset All
          </Button>
          
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
        </div>

        {/* Vessel Status */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          {Object.entries(vessels).map(([vesselName, vessel]) => (
            <div key={vesselName} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center mb-2">
                <div 
                  className="w-3 h-3 rounded-full mr-2" 
                  style={{ backgroundColor: vessel.color }}
                />
                <span className="font-medium">{getVesselDisplayName(vesselName)}</span>
              </div>
              <div className="text-xs text-gray-600">
                <div>Seeds: {vessel.seedPoints.length}</div>
                <div>Centerline: {vessel.centerline.length} points</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default VesselTracker
