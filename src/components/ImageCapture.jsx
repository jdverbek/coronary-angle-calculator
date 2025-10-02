import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Camera, Upload, RotateCcw, Smartphone } from 'lucide-react'
import { isIOS, isSafari, setupIOSCameraInput, optimizeImageForMobile } from '../lib/touchUtils'

const ImageCapture = ({ title, description, onImageCapture, onBack }) => {
  const [capturedImage, setCapturedImage] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const [deviceInfo, setDeviceInfo] = useState({ isIOS: false, isSafari: false })

  useEffect(() => {
    setDeviceInfo({
      isIOS: isIOS(),
      isSafari: isSafari()
    })

    // Setup iOS camera input if available
    if (cameraInputRef.current) {
      setupIOSCameraInput(cameraInputRef.current, handleFileSelect)
    }
  }, [])

  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file && file.type.startsWith('image/')) {
      processImage(file)
    }
  }

  const processImage = async (file) => {
    setIsProcessing(true)
    
    try {
      // Optimize image for mobile devices
      const optimizedImageUrl = await optimizeImageForMobile(file, 1920, 1080, 0.85)
      
      // Load image to get dimensions
      const img = new Image()
      img.onload = () => {
        setCapturedImage({
          url: optimizedImageUrl,
          width: img.width,
          height: img.height,
          file: file,
          optimized: true
        })
        setIsProcessing(false)
      }
      img.onerror = () => {
        console.error('Failed to load optimized image')
        // Fallback to original image
        const originalUrl = URL.createObjectURL(file)
        setCapturedImage({
          url: originalUrl,
          width: 0,
          height: 0,
          file: file,
          optimized: false
        })
        setIsProcessing(false)
      }
      img.src = optimizedImageUrl
    } catch (error) {
      console.error('Error processing image:', error)
      // Fallback to original image
      try {
        const originalUrl = URL.createObjectURL(file)
        setCapturedImage({
          url: originalUrl,
          width: 0,
          height: 0,
          file: file,
          optimized: false
        })
      } catch (fallbackError) {
        console.error('Fallback failed:', fallbackError)
      }
      setIsProcessing(false)
    }
  }

  const handleUseImage = () => {
    if (capturedImage) {
      onImageCapture(capturedImage.url)
    }
  }

  const handleRetake = () => {
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage.url)
    }
    setCapturedImage(null)
    // Reset file inputs
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!capturedImage ? (
          <div className="space-y-4">
            {/* Camera Input */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              {deviceInfo.isIOS ? (
                <Smartphone className="mx-auto h-12 w-12 text-blue-500 mb-4" />
              ) : (
                <Camera className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              )}
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {deviceInfo.isIOS ? 'iPhone Camera' : 'Take Photo with Camera'}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {deviceInfo.isIOS 
                  ? 'Tap to access your iPhone camera and capture the angiographic image'
                  : 'Use your device\'s camera to capture the angiographic image'
                }
              </p>
              {deviceInfo.isIOS && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-700">
                  <p>📱 For best results on iPhone:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Hold phone steady and parallel to screen</li>
                    <li>Ensure good lighting on the monitor</li>
                    <li>Include the full image frame in the photo</li>
                  </ul>
                </div>
              )}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="camera"
                onChange={handleFileSelect}
                className="hidden"
                id="camera-input"
              />
              <Button 
                onClick={() => cameraInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full sm:w-auto"
              >
                {deviceInfo.isIOS ? (
                  <Smartphone className="mr-2 h-4 w-4" />
                ) : (
                  <Camera className="mr-2 h-4 w-4" />
                )}
                {deviceInfo.isIOS ? 'Open iPhone Camera' : 'Open Camera'}
              </Button>
            </div>

            {/* File Upload */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Upload Image File
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Select an image file from your device
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="file-input"
              />
              <Button 
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full sm:w-auto"
              >
                <Upload className="mr-2 h-4 w-4" />
                Choose File
              </Button>
            </div>

            {isProcessing && (
              <div className="text-center">
                <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-white bg-primary">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing image...
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Image Preview */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <img 
                src={capturedImage.url} 
                alt="Captured angiogram" 
                className="w-full max-h-96 object-contain rounded-lg"
              />
              <div className="mt-2 text-sm text-gray-600 text-center">
                Dimensions: {capturedImage.width} × {capturedImage.height} pixels
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                variant="outline" 
                onClick={handleRetake}
                className="flex-1 sm:flex-none"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Retake
              </Button>
              <Button 
                onClick={handleUseImage}
                className="flex-1 sm:flex-none"
              >
                Use This Image
              </Button>
            </div>
          </div>
        )}

        {/* Navigation */}
        {onBack && (
          <div className="flex justify-start pt-4 border-t">
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ImageCapture
