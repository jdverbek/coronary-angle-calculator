import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { CheckCircle, AlertCircle, Settings } from 'lucide-react'
import { 
  detectCorners, 
  findFrameCorners, 
  calculateHomography, 
  applyPerspectiveCorrection 
} from '../lib/imageProcessing'

const ImageProcessor = ({ image, onProcessingComplete, onError }) => {
  const [processingStep, setProcessingStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('idle')
  const [correctedImage, setCorrectedImage] = useState(null)
  const canvasRef = useRef(null)

  const processingSteps = [
    'Loading image',
    'Detecting corners',
    'Calculating perspective correction',
    'Applying transformation',
    'Finalizing corrected image'
  ]

  useEffect(() => {
    if (image && status === 'idle') {
      processImage()
    }
  }, [image])

  const processImage = async () => {
    try {
      setStatus('processing')
      setProcessingStep(0)
      setProgress(0)

      // Step 1: Load image
      setProcessingStep(0)
      setProgress(20)
      await new Promise(resolve => setTimeout(resolve, 500))

      const img = new Image()
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = image
      })

      // Step 2: Detect corners
      setProcessingStep(1)
      setProgress(40)
      await new Promise(resolve => setTimeout(resolve, 500))

      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const corners = detectCorners(imageData)
      const frameCorners = findFrameCorners(corners, img.width, img.height)

      // Step 3: Calculate perspective correction
      setProcessingStep(2)
      setProgress(60)
      await new Promise(resolve => setTimeout(resolve, 500))

      // Define target rectangle (corrected frame)
      const targetCorners = {
        topLeft: { x: 0, y: 0 },
        topRight: { x: img.width, y: 0 },
        bottomLeft: { x: 0, y: img.height },
        bottomRight: { x: img.width, y: img.height }
      }

      const homography = calculateHomography(frameCorners, targetCorners)

      // Step 4: Apply transformation
      setProcessingStep(3)
      setProgress(80)
      await new Promise(resolve => setTimeout(resolve, 500))

      const correctedCanvas = applyPerspectiveCorrection(
        canvas, 
        homography, 
        img.width, 
        img.height
      )

      // Step 5: Finalize
      setProcessingStep(4)
      setProgress(100)
      await new Promise(resolve => setTimeout(resolve, 500))

      const correctedImageUrl = correctedCanvas.toDataURL('image/png')
      setCorrectedImage(correctedImageUrl)
      setStatus('completed')

      if (onProcessingComplete) {
        onProcessingComplete(correctedImageUrl)
      }

    } catch (error) {
      console.error('Image processing error:', error)
      setStatus('error')
      if (onError) {
        onError(error.message)
      }
    }
  }

  const retryProcessing = () => {
    setStatus('idle')
    setProgress(0)
    setProcessingStep(0)
    setCorrectedImage(null)
    processImage()
  }

  if (status === 'idle' || status === 'processing') {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="mr-2 h-5 w-5" />
            Processing Image
          </CardTitle>
          <CardDescription>
            Automatically correcting perspective and tilt
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Original Image Preview */}
          {image && (
            <div className="flex justify-center">
              <img 
                src={image} 
                alt="Original" 
                className="max-w-full max-h-48 object-contain rounded-lg border"
              />
            </div>
          )}

          {/* Progress */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">
                {processingSteps[processingStep]}
              </span>
              <span className="text-sm text-gray-500">
                {progress}%
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Processing Steps */}
          <div className="space-y-2">
            {processingSteps.map((step, index) => (
              <div key={index} className="flex items-center space-x-2">
                {index < processingStep ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : index === processingStep ? (
                  <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <div className="h-4 w-4 border-2 border-gray-300 rounded-full" />
                )}
                <span className={`text-sm ${
                  index <= processingStep ? 'text-gray-900' : 'text-gray-500'
                }`}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (status === 'error') {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center text-red-600">
            <AlertCircle className="mr-2 h-5 w-5" />
            Processing Failed
          </CardTitle>
          <CardDescription>
            Unable to process the image automatically
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">
              The automatic perspective correction failed. This might happen if:
            </p>
            <ul className="list-disc list-inside text-red-700 text-sm mt-2 space-y-1">
              <li>The image frame corners are not clearly visible</li>
              <li>The image has poor contrast or lighting</li>
              <li>The perspective distortion is too severe</li>
            </ul>
          </div>
          
          <div className="flex justify-center space-x-3">
            <Button variant="outline" onClick={retryProcessing}>
              Retry Processing
            </Button>
            <Button onClick={() => onProcessingComplete && onProcessingComplete(image)}>
              Use Original Image
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (status === 'completed' && correctedImage) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center text-green-600">
            <CheckCircle className="mr-2 h-5 w-5" />
            Processing Complete
          </CardTitle>
          <CardDescription>
            Image has been automatically corrected for perspective and tilt
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Before/After Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Original Image</h3>
              <img 
                src={image} 
                alt="Original" 
                className="w-full max-h-64 object-contain rounded-lg border bg-gray-50"
              />
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Corrected Image</h3>
              <img 
                src={correctedImage} 
                alt="Corrected" 
                className="w-full max-h-64 object-contain rounded-lg border bg-gray-50"
              />
            </div>
          </div>

          {/* Processing Summary */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-800 mb-2">Processing Summary:</h4>
            <ul className="text-sm text-green-700 space-y-1">
              <li>✓ Frame corners detected and corrected</li>
              <li>✓ Perspective distortion removed</li>
              <li>✓ Image tilt corrected to 90° angles</li>
              <li>✓ Ready for accurate point measurement</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center space-x-3">
            <Button variant="outline" onClick={retryProcessing}>
              Reprocess
            </Button>
            <Button onClick={() => onProcessingComplete && onProcessingComplete(correctedImage)}>
              Use Corrected Image
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}

export default ImageProcessor
