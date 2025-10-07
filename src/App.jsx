import { useState } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { Camera, Upload, ZoomIn, Calculator, RotateCcw } from 'lucide-react'
import ImageCapture from './components/ImageCapture'
import ImageProcessor from './components/ImageProcessor'
import VesselTracker from './components/VesselTracker'
import BifurcationSimulator from './components/BifurcationSimulator'
import ResultsDisplay from './components/ResultsDisplay'
import './App.css'

function App() {
  const [currentStep, setCurrentStep] = useState(0)
  const [projectData, setProjectData] = useState({
    image1: null,
    image1Angles: { raoLao: 0, cranialCaudal: 0 },
    image1VesselData: null,
    image2: null,
    image2Angles: { raoLao: 0, cranialCaudal: 0 },
    image2VesselData: null,
    results: null
  })

  const steps = [
    { title: 'Welcome', icon: Camera, description: 'Get started with bifurcation angle calculation' },
    { title: 'First Image', icon: Upload, description: 'Capture or upload first angiogram' },
    { title: 'First Angles', icon: Calculator, description: 'Enter projection angles for first image' },
    { title: 'First Tracking', icon: ZoomIn, description: 'Track vessel centerlines on first image' },
    { title: 'Second Image', icon: Upload, description: 'Capture or upload second angiogram' },
    { title: 'Second Angles', icon: Calculator, description: 'Enter projection angles for second image' },
    { title: 'Second Tracking', icon: ZoomIn, description: 'Track vessel centerlines on second image' },
    { title: '3D Simulator', icon: ZoomIn, description: 'Interactive 3D bifurcation visualization' },
    { title: 'Results', icon: Calculator, description: 'View optimal projection angles' }
  ]

  const progress = ((currentStep + 1) / steps.length) * 100

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleRestart = () => {
    setCurrentStep(0)
    setProjectData({
      image1: null,
      image1Angles: { raoLao: 0, cranialCaudal: 0 },
      image1VesselData: null,
      image2: null,
      image2Angles: { raoLao: 0, cranialCaudal: 0 },
      image2VesselData: null,
      results: null
    })
  }

  const updateProjectData = (updates) => {
    setProjectData(prev => ({ ...prev, ...updates }))
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-primary">
                Coronary Bifurcation Angle Calculator
              </CardTitle>
              <CardDescription className="text-lg mt-4">
                Calculate optimal RAO/LAO and cranial/caudal projection angles for coronary bifurcation lesions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted p-6 rounded-lg">
                <h3 className="font-semibold mb-3">How it works:</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Take two photos of angiographic images from different projections</li>
                  <li>Enter the RAO/LAO and cranial/caudal angles for each image</li>
                  <li>Click along vessels - algorithm automatically extracts centerlines</li>
                  <li>Focus on 0.5-1cm segments around the bifurcation point</li>
                  <li>Get optimal angles that minimize foreshortening for stenting</li>
                </ol>
              </div>
              <div className="flex justify-center">
                <Button onClick={handleNext} size="lg" className="px-8">
                  Get Started
                  <Camera className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      case 1:
        return (
          <ImageCapture
            title="First Angiographic Image"
            description="Take a photo or upload the first angiographic image"
            onImageCapture={(image) => {
              updateProjectData({ image1: image })
              handleNext()
            }}
          />
        )

      case 2:
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>First Image Projection Angles</CardTitle>
              <CardDescription>
                Enter the RAO/LAO and cranial/caudal angles for the first image
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {projectData.image1 && (
                <div className="flex justify-center mb-6">
                  <img 
                    src={projectData.image1} 
                    alt="First angiogram" 
                    className="max-w-full max-h-64 object-contain rounded-lg border"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rao-lao-1">RAO/LAO Angle (°)</Label>
                  <Input
                    id="rao-lao-1"
                    type="number"
                    placeholder="e.g., 30 (RAO) or -30 (LAO)"
                    value={projectData.image1Angles.raoLao}
                    onChange={(e) => updateProjectData({
                      image1Angles: { 
                        ...projectData.image1Angles, 
                        raoLao: parseFloat(e.target.value) || 0 
                      }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cranial-caudal-1">Cranial/Caudal Angle (°)</Label>
                  <Input
                    id="cranial-caudal-1"
                    type="number"
                    placeholder="e.g., 20 (cranial) or -20 (caudal)"
                    value={projectData.image1Angles.cranialCaudal}
                    onChange={(e) => updateProjectData({
                      image1Angles: { 
                        ...projectData.image1Angles, 
                        cranialCaudal: parseFloat(e.target.value) || 0 
                      }
                    })}
                  />
                </div>
              </div>
              <div className="bg-muted p-4 rounded-lg text-sm">
                <p><strong>Note:</strong> Positive values = RAO/Cranial, Negative values = LAO/Caudal</p>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={handleBack}>Back</Button>
                <Button onClick={handleNext}>Continue</Button>
              </div>
            </CardContent>
          </Card>
        )

      case 3:
        return (
          <VesselTracker
            image={projectData.image1}
            title="Track Vessels - First Image"
            description="Click along each vessel to place seed points. Algorithm will extract centerlines automatically."
            projectionAngles={projectData.image1Angles}
            onVesselDataExtracted={(vesselData) => {
              updateProjectData({ image1VesselData: vesselData })
              handleNext()
            }}
            onBack={handleBack}
          />
        )

      case 4:
        return (
          <ImageCapture
            title="Second Angiographic Image"
            description="Take a photo or upload the second angiographic image from a different projection"
            onImageCapture={(image) => {
              updateProjectData({ image2: image })
              handleNext()
            }}
            onBack={handleBack}
          />
        )

      case 5:
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Second Image Projection Angles</CardTitle>
              <CardDescription>
                Enter the RAO/LAO and cranial/caudal angles for the second image
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {projectData.image2 && (
                <div className="flex justify-center mb-6">
                  <img 
                    src={projectData.image2} 
                    alt="Second angiogram" 
                    className="max-w-full max-h-64 object-contain rounded-lg border"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rao-lao-2">RAO/LAO Angle (°)</Label>
                  <Input
                    id="rao-lao-2"
                    type="number"
                    placeholder="e.g., -45 (LAO)"
                    value={projectData.image2Angles.raoLao}
                    onChange={(e) => updateProjectData({
                      image2Angles: { 
                        ...projectData.image2Angles, 
                        raoLao: parseFloat(e.target.value) || 0 
                      }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cranial-caudal-2">Cranial/Caudal Angle (°)</Label>
                  <Input
                    id="cranial-caudal-2"
                    type="number"
                    placeholder="e.g., -25 (caudal)"
                    value={projectData.image2Angles.cranialCaudal}
                    onChange={(e) => updateProjectData({
                      image2Angles: { 
                        ...projectData.image2Angles, 
                        cranialCaudal: parseFloat(e.target.value) || 0 
                      }
                    })}
                  />
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={handleBack}>Back</Button>
                <Button onClick={handleNext}>Continue</Button>
              </div>
            </CardContent>
          </Card>
        )

      case 6:
        return (
          <VesselTracker
            image={projectData.image2}
            title="Track Vessels - Second Image"
            description="Click along each vessel to place seed points. Algorithm will extract centerlines automatically."
            projectionAngles={projectData.image2Angles}
            onVesselDataExtracted={(vesselData) => {
              updateProjectData({ image2VesselData: vesselData })
              handleNext()
            }}
            onBack={handleBack}
          />
        )

      case 7:
        return (
          <BifurcationSimulator
            vesselData={{
              image1VesselData: projectData.image1VesselData,
              image2VesselData: projectData.image2VesselData,
              image1Angles: projectData.image1Angles,
              image2Angles: projectData.image2Angles
            }}
            onOptimalAnglesFound={(results) => {
              updateProjectData({ results })
              handleNext()
            }}
            onBack={handleBack}
          />
        )

      case 8:
        return (
          <ResultsDisplay
            projectData={projectData}
            onRestart={handleRestart}
          />
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Coronary Bifurcation Angle Calculator
          </h1>
          
          {/* Progress Bar */}
          <div className="max-w-2xl mx-auto mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-600">
                Step {currentStep + 1} of {steps.length}
              </span>
              <span className="text-sm font-medium text-gray-600">
                {Math.round(progress)}% Complete
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step Indicator */}
          <div className="flex justify-center items-center space-x-2 mb-8">
            {steps.map((step, index) => {
              const StepIcon = step.icon
              const isActive = index === currentStep
              const isCompleted = index < currentStep
              
              return (
                <div key={index} className="flex items-center">
                  <div className={`
                    flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                    ${isActive ? 'bg-primary border-primary text-primary-foreground' : 
                      isCompleted ? 'bg-green-500 border-green-500 text-white' : 
                      'bg-white border-gray-300 text-gray-400'}
                  `}>
                    <StepIcon className="w-5 h-5" />
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-8 h-0.5 mx-2 ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex justify-center">
          {renderStepContent()}
        </div>

        {/* Restart Button (always visible) */}
        {currentStep > 0 && (
          <div className="fixed bottom-4 left-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRestart}
              className="bg-white shadow-lg"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restart
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
