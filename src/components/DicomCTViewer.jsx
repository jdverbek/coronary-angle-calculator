/**
 * DICOM CT Viewer Component
 * Provides 3D CT visualization, coronary segmentation, and simulated projections
 */

import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Slider } from '@/components/ui/slider.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.jsx'
import { 
  Upload, 
  Play, 
  Pause, 
  RotateCcw, 
  Target, 
  Eye, 
  Layers,
  Heart,
  Zap,
  Settings
} from 'lucide-react'

import {
  initializeDicomProcessor,
  loadDicomCTDataset,
  create3DVolumeFromDicom,
  segmentCoronaryArteries,
  generateSimulatedProjection,
  detectCoronaryBifurcations
} from '@/lib/dicomProcessor.js'

const DicomCTViewer = ({ onCoronaryDataExtracted, onBack }) => {
  // State management
  const [ctDataset, setCTDataset] = useState(null)
  const [volume3D, setVolume3D] = useState(null)
  const [segmentedVessels, setSegmentedVessels] = useState(null)
  const [bifurcations, setBifurcations] = useState([])
  const [currentProjection, setCurrentProjection] = useState(null)
  
  const [isLoading, setIsLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingMessage, setLoadingMessage] = useState('')
  
  // Viewing parameters
  const [currentSlice, setCurrentSlice] = useState(0)
  const [windowLevel, setWindowLevel] = useState(400)
  const [windowWidth, setWindowWidth] = useState(1000)
  
  // Segmentation parameters
  const [seedPoints, setSeedPoints] = useState([])
  const [segmentationParams, setSegmentationParams] = useState({
    intensityThreshold: 200,
    maxIntensity: 800,
    regionGrowingRadius: 3
  })
  
  // Projection parameters
  const [raoLaoDirection, setRaoLaoDirection] = useState('RAO')
  const [raoLaoMagnitude, setRaoLaoMagnitude] = useState(30)
  const [cranialCaudalDirection, setCranialCaudalDirection] = useState('Cranial')
  const [cranialCaudalMagnitude, setCranialCaudalMagnitude] = useState(20)
  const [autoRotate, setAutoRotate] = useState(false)
  
  // Canvas refs
  const ctCanvasRef = useRef(null)
  const projectionCanvasRef = useRef(null)
  const volume3DCanvasRef = useRef(null)
  
  // Initialize DICOM processor on mount
  useEffect(() => {
    initializeDicomProcessor()
  }, [])
  
  // Handle DICOM file upload
  const handleDicomUpload = async (event) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    
    setIsLoading(true)
    setLoadingMessage('Loading DICOM files...')
    setLoadingProgress(10)
    
    try {
      // Load DICOM dataset
      const dataset = await loadDicomCTDataset(files)
      setCTDataset(dataset)
      setLoadingProgress(30)
      setLoadingMessage('Creating 3D volume...')
      
      // Create 3D volume
      const volume = await create3DVolumeFromDicom(dataset)
      setVolume3D(volume)
      setLoadingProgress(60)
      setLoadingMessage('Initializing visualization...')
      
      // Initialize viewing parameters
      setCurrentSlice(Math.floor(dataset.metadata.length / 2))
      setWindowLevel(dataset.metadata[0]?.windowCenter || 400)
      setWindowWidth(dataset.metadata[0]?.windowWidth || 1000)
      
      setLoadingProgress(100)
      setLoadingMessage('Ready!')
      
      // Render initial CT slice
      renderCTSlice(volume, Math.floor(dataset.metadata.length / 2))
      
    } catch (error) {
      console.error('Error loading DICOM files:', error)
      alert(`Error loading DICOM files: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }
  
  // Render CT slice
  const renderCTSlice = (volume, sliceIndex) => {
    const canvas = ctCanvasRef.current
    if (!canvas || !volume) return
    
    const ctx = canvas.getContext('2d')
    const { data, dimensions } = volume
    const { width, height } = dimensions
    
    // Set canvas size
    canvas.width = width
    canvas.height = height
    
    // Create image data
    const imageData = ctx.createImageData(width, height)
    const sliceOffset = sliceIndex * width * height
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = y * width + x
        const volumeIndex = sliceOffset + pixelIndex
        const intensity = data[volumeIndex]
        
        // Apply window/level
        let displayValue = ((intensity - windowLevel) / windowWidth + 0.5) * 255
        displayValue = Math.max(0, Math.min(255, displayValue))
        
        const imageIndex = pixelIndex * 4
        imageData.data[imageIndex] = displayValue     // R
        imageData.data[imageIndex + 1] = displayValue // G
        imageData.data[imageIndex + 2] = displayValue // B
        imageData.data[imageIndex + 3] = 255          // A
      }
    }
    
    ctx.putImageData(imageData, 0, 0)
    
    // Draw seed points on current slice
    drawSeedPointsOnSlice(ctx, sliceIndex)
  }
  
  // Draw seed points on CT slice
  const drawSeedPointsOnSlice = (ctx, sliceIndex) => {
    seedPoints.forEach((point, index) => {
      if (Math.abs(point.z - sliceIndex) <= 2) { // Show points within 2 slices
        ctx.fillStyle = 'red'
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 2
        
        ctx.beginPath()
        ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI)
        ctx.fill()
        ctx.stroke()
        
        // Label
        ctx.fillStyle = 'white'
        ctx.font = '12px Arial'
        ctx.fillText(`${index + 1}`, point.x + 8, point.y - 8)
      }
    })
  }
  
  // Handle canvas click to add seed points
  const handleCanvasClick = (event) => {
    const canvas = ctCanvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = Math.round((event.clientX - rect.left) * (canvas.width / rect.width))
    const y = Math.round((event.clientY - rect.top) * (canvas.height / rect.height))
    
    const newSeedPoint = { x, y, z: currentSlice }
    setSeedPoints(prev => [...prev, newSeedPoint])
    
    // Re-render slice with new seed point
    if (volume3D) {
      renderCTSlice(volume3D, currentSlice)
    }
  }
  
  // Segment coronary arteries
  const handleSegmentation = async () => {
    if (!volume3D || seedPoints.length === 0) {
      alert('Please load CT data and place seed points first')
      return
    }
    
    setIsLoading(true)
    setLoadingMessage('Segmenting coronary arteries...')
    setLoadingProgress(0)
    
    try {
      // Perform segmentation
      const vessels = segmentCoronaryArteries(volume3D, seedPoints, segmentationParams)
      setSegmentedVessels(vessels)
      setLoadingProgress(50)
      
      // Detect bifurcations
      const detectedBifurcations = detectCoronaryBifurcations(vessels)
      setBifurcations(detectedBifurcations)
      setLoadingProgress(100)
      
      // Generate initial projection
      generateProjection()
      
    } catch (error) {
      console.error('Segmentation error:', error)
      alert(`Segmentation failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }
  
  // Generate simulated angiographic projection
  const generateProjection = () => {
    if (!volume3D || !segmentedVessels) return
    
    const finalRaoLao = raoLaoDirection === 'RAO' ? raoLaoMagnitude : -raoLaoMagnitude
    const finalCranialCaudal = cranialCaudalDirection === 'Cranial' ? cranialCaudalMagnitude : -cranialCaudalMagnitude
    
    const projection = generateSimulatedProjection(
      volume3D,
      segmentedVessels,
      finalRaoLao,
      finalCranialCaudal
    )
    
    setCurrentProjection(projection)
    renderProjection(projection)
  }
  
  // Render simulated projection
  const renderProjection = (projection) => {
    const canvas = projectionCanvasRef.current
    if (!canvas || !projection) return
    
    const ctx = canvas.getContext('2d')
    const { imageData, width, height, vessels } = projection
    
    canvas.width = width
    canvas.height = height
    
    // Create grayscale image
    const canvasImageData = ctx.createImageData(width, height)
    
    for (let i = 0; i < imageData.length; i++) {
      const intensity = Math.max(0, Math.min(255, imageData[i]))
      const pixelIndex = i * 4
      
      canvasImageData.data[pixelIndex] = intensity     // R
      canvasImageData.data[pixelIndex + 1] = intensity // G
      canvasImageData.data[pixelIndex + 2] = intensity // B
      canvasImageData.data[pixelIndex + 3] = 255       // A
    }
    
    ctx.putImageData(canvasImageData, 0, 0)
    
    // Draw projected vessel centerlines
    vessels.forEach((vessel, index) => {
      const colors = ['red', 'blue', 'green', 'yellow', 'purple']
      ctx.strokeStyle = colors[index % colors.length]
      ctx.lineWidth = 2
      
      if (vessel.projectedCenterline && vessel.projectedCenterline.length > 1) {
        ctx.beginPath()
        ctx.moveTo(vessel.projectedCenterline[0].x, vessel.projectedCenterline[0].y)
        
        for (let i = 1; i < vessel.projectedCenterline.length; i++) {
          ctx.lineTo(vessel.projectedCenterline[i].x, vessel.projectedCenterline[i].y)
        }
        
        ctx.stroke()
      }
    })
  }
  
  // Update slice and re-render
  useEffect(() => {
    if (volume3D) {
      renderCTSlice(volume3D, currentSlice)
    }
  }, [currentSlice, windowLevel, windowWidth])
  
  // Update projection when angles change
  useEffect(() => {
    if (volume3D && segmentedVessels) {
      generateProjection()
    }
  }, [raoLaoDirection, raoLaoMagnitude, cranialCaudalDirection, cranialCaudalMagnitude])
  
  // Auto-rotation effect
  useEffect(() => {
    let interval
    if (autoRotate) {
      interval = setInterval(() => {
        setRaoLaoMagnitude(prev => (prev + 2) % 180)
      }, 100)
    }
    return () => clearInterval(interval)
  }, [autoRotate])
  
  // Clear seed points
  const clearSeedPoints = () => {
    setSeedPoints([])
    if (volume3D) {
      renderCTSlice(volume3D, currentSlice)
    }
  }
  
  // Export coronary data for angle calculation
  const exportCoronaryData = () => {
    if (!segmentedVessels || !bifurcations) {
      alert('Please complete segmentation first')
      return
    }
    
    const coronaryData = {
      vessels: segmentedVessels.vessels,
      bifurcations: bifurcations,
      volume: volume3D,
      projectionAngles: {
        raoLao: raoLaoDirection === 'RAO' ? raoLaoMagnitude : -raoLaoMagnitude,
        cranialCaudal: cranialCaudalDirection === 'Cranial' ? cranialCaudalMagnitude : -cranialCaudalMagnitude
      }
    }
    
    if (onCoronaryDataExtracted) {
      onCoronaryDataExtracted(coronaryData)
    }
  }
  
  const finalRaoLao = raoLaoDirection === 'RAO' ? raoLaoMagnitude : -raoLaoMagnitude
  const finalCranialCaudal = cranialCaudalDirection === 'Cranial' ? cranialCaudalMagnitude : -cranialCaudalMagnitude
  
  return (
    <Card className="w-full max-w-7xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-6 w-6 text-red-500" />
          DICOM CT Coronary Analysis
        </CardTitle>
        <CardDescription>
          Load coronary CT, segment arteries, and generate simulated angiographic projections
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Loading State */}
        {isLoading && (
          <div className="text-center space-y-4">
            <Progress value={loadingProgress} className="w-full" />
            <p className="text-sm text-gray-600">{loadingMessage}</p>
          </div>
        )}
        
        {/* File Upload */}
        {!ctDataset && !isLoading && (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Upload DICOM CT Files</h3>
            <p className="text-gray-600 mb-4">
              Select multiple DICOM files from a coronary CT angiography study
            </p>
            <input
              type="file"
              multiple
              accept=".dcm,.dicom"
              onChange={handleDicomUpload}
              className="hidden"
              id="dicom-upload"
            />
            <label htmlFor="dicom-upload">
              <Button className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" />
                Choose DICOM Files
              </Button>
            </label>
          </div>
        )}
        
        {/* Main Interface */}
        {ctDataset && !isLoading && (
          <Tabs defaultValue="ct-viewer" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ct-viewer">
                <Layers className="mr-2 h-4 w-4" />
                CT Viewer
              </TabsTrigger>
              <TabsTrigger value="segmentation">
                <Target className="mr-2 h-4 w-4" />
                Segmentation
              </TabsTrigger>
              <TabsTrigger value="projection">
                <Eye className="mr-2 h-4 w-4" />
                Projection
              </TabsTrigger>
            </TabsList>
            
            {/* CT Viewer Tab */}
            <TabsContent value="ct-viewer" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* CT Slice Viewer */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">CT Slice Viewer</h3>
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <canvas
                      ref={ctCanvasRef}
                      className="border rounded bg-black cursor-crosshair max-w-full h-auto"
                      onClick={handleCanvasClick}
                    />
                  </div>
                  
                  {/* Slice Controls */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Slice: {currentSlice + 1} / {ctDataset.metadata.length}
                    </label>
                    <Slider
                      value={[currentSlice]}
                      onValueChange={([value]) => setCurrentSlice(value)}
                      max={ctDataset.metadata.length - 1}
                      step={1}
                      className="w-full"
                    />
                  </div>
                </div>
                
                {/* Window/Level Controls */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Display Settings</h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Window Level: {windowLevel}
                      </label>
                      <Slider
                        value={[windowLevel]}
                        onValueChange={([value]) => setWindowLevel(value)}
                        min={-1000}
                        max={1000}
                        step={10}
                        className="w-full"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Window Width: {windowWidth}
                      </label>
                      <Slider
                        value={[windowWidth]}
                        onValueChange={([value]) => setWindowWidth(value)}
                        min={100}
                        max={2000}
                        step={50}
                        className="w-full"
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setWindowLevel(400)
                          setWindowWidth(1000)
                        }}
                      >
                        Default
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setWindowLevel(300)
                          setWindowWidth(600)
                        }}
                      >
                        Vessels
                      </Button>
                    </div>
                  </div>
                  
                  {/* Dataset Info */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Dataset Information</h4>
                    <div className="text-sm space-y-1">
                      <p>Slices: {ctDataset.metadata.length}</p>
                      <p>Dimensions: {ctDataset.dimensions.width} × {ctDataset.dimensions.height}</p>
                      <p>Pixel Spacing: {ctDataset.dimensions.pixelSpacing.join(' × ')} mm</p>
                      <p>Slice Thickness: {ctDataset.dimensions.sliceThickness} mm</p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            {/* Segmentation Tab */}
            <TabsContent value="segmentation" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Seed Point Placement</h3>
                  <p className="text-sm text-gray-600">
                    Click on the CT image to place seed points along coronary arteries
                  </p>
                  
                  <div className="flex gap-2">
                    <Badge variant="outline">
                      Seed Points: {seedPoints.length}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearSeedPoints}
                    >
                      Clear Points
                    </Button>
                  </div>
                  
                  {/* Segmentation Parameters */}
                  <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold">Segmentation Parameters</h4>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Intensity Threshold: {segmentationParams.intensityThreshold} HU
                      </label>
                      <Slider
                        value={[segmentationParams.intensityThreshold]}
                        onValueChange={([value]) => 
                          setSegmentationParams(prev => ({ ...prev, intensityThreshold: value }))
                        }
                        min={100}
                        max={500}
                        step={10}
                        className="w-full"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Max Intensity: {segmentationParams.maxIntensity} HU
                      </label>
                      <Slider
                        value={[segmentationParams.maxIntensity]}
                        onValueChange={([value]) => 
                          setSegmentationParams(prev => ({ ...prev, maxIntensity: value }))
                        }
                        min={500}
                        max={1200}
                        step={10}
                        className="w-full"
                      />
                    </div>
                  </div>
                  
                  <Button
                    onClick={handleSegmentation}
                    disabled={seedPoints.length === 0}
                    className="w-full"
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    Segment Coronary Arteries
                  </Button>
                </div>
                
                {/* Segmentation Results */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Segmentation Results</h3>
                  
                  {segmentedVessels && (
                    <div className="space-y-4">
                      <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="font-semibold mb-2">Detected Vessels</h4>
                        <div className="space-y-2">
                          {segmentedVessels.vessels.map((vessel, index) => (
                            <div key={vessel.id} className="flex justify-between items-center">
                              <span className="text-sm">Vessel {index + 1}</span>
                              <Badge variant="secondary">
                                {vessel.length.toFixed(1)} mm
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {bifurcations.length > 0 && (
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <h4 className="font-semibold mb-2">Detected Bifurcations</h4>
                          <div className="space-y-2">
                            {bifurcations.map((bifurcation, index) => (
                              <div key={bifurcation.id} className="flex justify-between items-center">
                                <span className="text-sm">Bifurcation {index + 1}</span>
                                <Badge variant="secondary">
                                  {(bifurcation.confidence * 100).toFixed(0)}% confidence
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            
            {/* Projection Tab */}
            <TabsContent value="projection" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Simulated Projection */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Simulated Angiographic Projection</h3>
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <canvas
                      ref={projectionCanvasRef}
                      className="border rounded bg-black max-w-full h-auto"
                    />
                  </div>
                  
                  {/* Current Angles Display */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 text-center">
                    <h4 className="font-semibold mb-2">Current Projection</h4>
                    <div className="flex justify-center gap-4">
                      <Badge variant="secondary" className="text-lg px-3 py-1">
                        {finalRaoLao > 0 ? 'RAO' : 'LAO'} {Math.abs(finalRaoLao)}°
                      </Badge>
                      <Badge variant="secondary" className="text-lg px-3 py-1">
                        {finalCranialCaudal > 0 ? 'Cranial' : 'Caudal'} {Math.abs(finalCranialCaudal)}°
                      </Badge>
                    </div>
                  </div>
                </div>
                
                {/* Projection Controls */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Projection Controls</h3>
                  
                  {/* RAO/LAO Controls */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium">RAO/LAO Angle</label>
                    <ToggleGroup
                      type="single"
                      value={raoLaoDirection}
                      onValueChange={(value) => value && setRaoLaoDirection(value)}
                      className="justify-start"
                    >
                      <ToggleGroupItem value="LAO" className="px-6">LAO</ToggleGroupItem>
                      <ToggleGroupItem value="RAO" className="px-6">RAO</ToggleGroupItem>
                    </ToggleGroup>
                    <div className="space-y-2">
                      <label className="text-sm text-gray-600">
                        Magnitude: {raoLaoMagnitude}°
                      </label>
                      <Slider
                        value={[raoLaoMagnitude]}
                        onValueChange={([value]) => setRaoLaoMagnitude(value)}
                        max={90}
                        step={1}
                        className="w-full"
                      />
                    </div>
                  </div>
                  
                  {/* Cranial/Caudal Controls */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Cranial/Caudal Angle</label>
                    <ToggleGroup
                      type="single"
                      value={cranialCaudalDirection}
                      onValueChange={(value) => value && setCranialCaudalDirection(value)}
                      className="justify-start"
                    >
                      <ToggleGroupItem value="Caudal" className="px-6">Caudal</ToggleGroupItem>
                      <ToggleGroupItem value="Cranial" className="px-6">Cranial</ToggleGroupItem>
                    </ToggleGroup>
                    <div className="space-y-2">
                      <label className="text-sm text-gray-600">
                        Magnitude: {cranialCaudalMagnitude}°
                      </label>
                      <Slider
                        value={[cranialCaudalMagnitude]}
                        onValueChange={([value]) => setCranialCaudalMagnitude(value)}
                        max={45}
                        step={1}
                        className="w-full"
                      />
                    </div>
                  </div>
                  
                  {/* Control Buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setAutoRotate(!autoRotate)}
                    >
                      {autoRotate ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                      {autoRotate ? 'Stop' : 'Auto Rotate'}
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRaoLaoDirection('RAO')
                        setRaoLaoMagnitude(30)
                        setCranialCaudalDirection('Cranial')
                        setCranialCaudalMagnitude(20)
                      }}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                  </div>
                  
                  {/* Export Button */}
                  {segmentedVessels && (
                    <Button
                      onClick={exportCoronaryData}
                      className="w-full"
                    >
                      <Target className="mr-2 h-4 w-4" />
                      Use for Angle Calculation
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
        
        {/* Back Button */}
        {onBack && (
          <div className="flex justify-start">
            <Button variant="outline" onClick={onBack}>
              ← Back to Main Menu
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default DicomCTViewer
