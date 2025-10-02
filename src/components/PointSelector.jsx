import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { ZoomIn, ZoomOut, RotateCcw, Move, Target, Smartphone } from 'lucide-react'
import { 
  preventDefaultTouchBehaviors, 
  getTouchCoordinates, 
  isIOS, 
  optimizeCanvasForRetina,
  hapticFeedback 
} from '../lib/touchUtils'

const PointSelector = ({ image, title, description, onPointsSelected, onBack }) => {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [points, setPoints] = useState({
    vessel1: { start: null, end: null },
    vessel2: { start: null, end: null }
  })
  const [currentVessel, setCurrentVessel] = useState(1)
  const [currentPoint, setCurrentPoint] = useState('start')
  const [imageObj, setImageObj] = useState(null)
  const [devicePixelRatio, setDevicePixelRatio] = useState(1)
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    // Detect touch capability
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0)
    
    if (image && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      img.onload = () => {
        // Set canvas size to match container
        const container = containerRef.current
        const containerWidth = container.clientWidth
        const containerHeight = container.clientHeight
        
        // Optimize for retina displays
        const dpr = optimizeCanvasForRetina(canvas, ctx, containerWidth, containerHeight)
        setDevicePixelRatio(dpr)
        
        // Calculate initial scale to fit image
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
        
        // Setup touch prevention for iOS
        if (isIOS()) {
          preventDefaultTouchBehaviors(canvas)
        }
        
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
  }, [scale, offset, points, imageLoaded, imageObj])

  const drawCanvas = (ctx, img, currentScale, currentOffset) => {
    const canvas = ctx.canvas
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Draw image
    ctx.drawImage(
      img,
      currentOffset.x,
      currentOffset.y,
      img.width * currentScale,
      img.height * currentScale
    )
    
    // Draw points
    ctx.strokeStyle = '#ff0000'
    ctx.fillStyle = '#ff0000'
    ctx.lineWidth = 2
    
    // Draw vessel 1 points
    if (points.vessel1.start) {
      drawPoint(ctx, points.vessel1.start, currentScale, currentOffset, '#ff0000', '1S')
    }
    if (points.vessel1.end) {
      drawPoint(ctx, points.vessel1.end, currentScale, currentOffset, '#ff0000', '1E')
    }
    if (points.vessel1.start && points.vessel1.end) {
      drawLine(ctx, points.vessel1.start, points.vessel1.end, currentScale, currentOffset, '#ff0000')
    }
    
    // Draw vessel 2 points
    if (points.vessel2.start) {
      drawPoint(ctx, points.vessel2.start, currentScale, currentOffset, '#0000ff', '2S')
    }
    if (points.vessel2.end) {
      drawPoint(ctx, points.vessel2.end, currentScale, currentOffset, '#0000ff', '2E')
    }
    if (points.vessel2.start && points.vessel2.end) {
      drawLine(ctx, points.vessel2.start, points.vessel2.end, currentScale, currentOffset, '#0000ff')
    }
  }

  const drawPoint = (ctx, point, currentScale, currentOffset, color, label) => {
    const x = point.x * currentScale + currentOffset.x
    const y = point.y * currentScale + currentOffset.y
    
    ctx.fillStyle = color
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    
    // Draw circle
    ctx.beginPath()
    ctx.arc(x, y, 8, 0, 2 * Math.PI)
    ctx.fill()
    ctx.stroke()
    
    // Draw label
    ctx.fillStyle = '#ffffff'
    ctx.font = '12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(label, x, y + 4)
  }

  const drawLine = (ctx, start, end, currentScale, currentOffset, color) => {
    const startX = start.x * currentScale + currentOffset.x
    const startY = start.y * currentScale + currentOffset.y
    const endX = end.x * currentScale + currentOffset.x
    const endY = end.y * currentScale + currentOffset.y
    
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(endX, endY)
    ctx.stroke()
  }

  const handleCanvasClick = (event) => {
    if (!imageObj) return
    
    const canvas = canvasRef.current
    let x, y
    
    // Handle both mouse and touch events
    if (event.type === 'touchend') {
      const coords = getTouchCoordinates(event, canvas)
      x = coords.x
      y = coords.y
    } else {
      const rect = canvas.getBoundingClientRect()
      x = event.clientX - rect.left
      y = event.clientY - rect.top
    }
    
    // Convert canvas coordinates to image coordinates
    const imageX = (x - offset.x) / scale
    const imageY = (y - offset.y) / scale
    
    // Check if click is within image bounds
    if (imageX >= 0 && imageX <= imageObj.width && imageY >= 0 && imageY <= imageObj.height) {
      const newPoints = { ...points }
      newPoints[`vessel${currentVessel}`][currentPoint] = { x: imageX, y: imageY }
      setPoints(newPoints)
      
      // Haptic feedback for touch devices
      if (isTouch) {
        hapticFeedback('light')
      }
      
      // Auto-advance to next point
      if (currentPoint === 'start') {
        setCurrentPoint('end')
      } else {
        if (currentVessel === 1) {
          setCurrentVessel(2)
          setCurrentPoint('start')
        } else {
          // All points selected
        }
      }
    }
  }

  const handleTouchStart = (event) => {
    if (event.touches.length === 1) {
      // Single touch - prepare for point selection
      event.preventDefault()
    } else if (event.touches.length === 2) {
      // Multi-touch - prepare for pan/zoom
      setIsDragging(true)
      const coords = getTouchCoordinates(event, canvasRef.current)
      setDragStart({ x: coords.x - offset.x, y: coords.y - offset.y })
    }
  }

  const handleTouchMove = (event) => {
    if (event.touches.length === 2 && isDragging) {
      // Handle panning with two fingers
      event.preventDefault()
      const coords = getTouchCoordinates(event, canvasRef.current)
      setOffset({
        x: coords.x - dragStart.x,
        y: coords.y - dragStart.y
      })
    }
  }

  const handleTouchEnd = (event) => {
    if (event.changedTouches.length === 1 && !isDragging) {
      // Single tap - select point
      handleCanvasClick(event)
    }
    setIsDragging(false)
  }

  const handleMouseDown = (event) => {
    if (event.button === 0) { // Left mouse button
      setIsDragging(true)
      setDragStart({ x: event.clientX - offset.x, y: event.clientY - offset.y })
    }
  }

  const handleMouseMove = (event) => {
    if (isDragging) {
      setOffset({
        x: event.clientX - dragStart.x,
        y: event.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev * 1.2, 5))
  }

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev / 1.2, 0.1))
  }

  const handleReset = () => {
    if (imageObj && containerRef.current) {
      const container = containerRef.current
      const scaleX = container.clientWidth / imageObj.width
      const scaleY = container.clientHeight / imageObj.height
      const initialScale = Math.min(scaleX, scaleY, 1)
      
      setScale(initialScale)
      setOffset({
        x: (container.clientWidth - imageObj.width * initialScale) / 2,
        y: (container.clientHeight - imageObj.height * initialScale) / 2
      })
    }
  }

  const handleClearPoints = () => {
    setPoints({
      vessel1: { start: null, end: null },
      vessel2: { start: null, end: null }
    })
    setCurrentVessel(1)
    setCurrentPoint('start')
  }

  const handleContinue = () => {
    if (isComplete()) {
      onPointsSelected(points)
    }
  }

  const isComplete = () => {
    return points.vessel1.start && points.vessel1.end && 
           points.vessel2.start && points.vessel2.end
  }

  const getNextPointDescription = () => {
    if (!points.vessel1.start) return "Click on the start of the first vessel"
    if (!points.vessel1.end) return "Click on the end of the first vessel"
    if (!points.vessel2.start) return "Click on the start of the second vessel"
    if (!points.vessel2.end) return "Click on the end of the second vessel"
    return "All points marked! Click Continue to proceed."
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
            <span className="font-medium">Instructions:</span>
            <Badge variant={isComplete() ? "default" : "secondary"}>
              {isComplete() ? "Complete" : "In Progress"}
            </Badge>
          </div>
          <p className="text-sm mb-2">{getNextPointDescription()}</p>
          {isTouch && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mt-2">
              <p className="text-xs text-blue-700">
                📱 <strong>Touch Controls:</strong> Tap to select points • Use two fingers to pan • Pinch to zoom
              </p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="w-4 h-4 mr-1" />
            Zoom In
          </Button>
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="w-4 h-4 mr-1" />
            Zoom Out
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <Move className="w-4 h-4 mr-1" />
            Reset View
          </Button>
          <Button variant="outline" size="sm" onClick={handleClearPoints}>
            <RotateCcw className="w-4 h-4 mr-1" />
            Clear Points
          </Button>
        </div>

        {/* Canvas Container */}
        <div 
          ref={containerRef}
          className="relative border rounded-lg overflow-hidden bg-gray-100"
          style={{ height: '500px' }}
        >
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={isTouch ? "cursor-pointer" : "cursor-crosshair"}
            style={{ display: 'block', touchAction: 'none' }}
          />
          
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Loading image...</p>
              </div>
            </div>
          )}
        </div>

        {/* Point Status */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium text-red-600">Vessel 1 (Red)</h4>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Start point:</span>
                <span>{points.vessel1.start ? '✓' : '○'}</span>
              </div>
              <div className="flex justify-between">
                <span>End point:</span>
                <span>{points.vessel1.end ? '✓' : '○'}</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-blue-600">Vessel 2 (Blue)</h4>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Start point:</span>
                <span>{points.vessel2.start ? '✓' : '○'}</span>
              </div>
              <div className="flex justify-between">
                <span>End point:</span>
                <span>{points.vessel2.end ? '✓' : '○'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button 
            onClick={handleContinue} 
            disabled={!isComplete()}
          >
            Continue
            <Target className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default PointSelector
