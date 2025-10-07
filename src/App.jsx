import { useState } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { Camera, Upload, ZoomIn, Calculator, RotateCcw } from 'lucide-react'
import ImageCapture from './components/ImageCapture.jsx'
import VesselTracker from './components/VesselTracker.jsx'
import AngleInput from './components/AngleInput.jsx'
import Bifurcation3D from './components/Bifurcation3D.jsx'
import ResultsDisplay from './components/ResultsDisplay.jsx'
import DicomCTViewer from './components/DicomCTViewer.jsx'
import './App.css'

function App() {
  const [currentStep, setCurrentStep] = useState(0)
  const [projectData, setProjectData] = useState({
    image1: null,
    image2: null,
    image1Angles: null,
    image2Angles: null,
    image1VesselData: null,
    image2VesselData: null,
    results: null,
    coronaryCTData: null
  })
  
  const [workflowMode, setWorkflowMode] = useState(null) // 'angiography' or 'ct'

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
    // CT Workflow
    if (workflowMode === 'ct') {
      return (
        <DicomCTViewer
          onCoronaryDataExtracted={(coronaryData) => {
            updateProjectData({ coronaryCTData: coronaryData })
            // Could integrate with existing angle calculation workflow
            alert('Coronary data extracted! Integration with angle calculation coming soon.')
          }}
          onBack={() => {
            setWorkflowMode(null)
            setCurrentStep(0)
          }}
        />
      )
    }
    
    // Angiographic Workflow
    switch (currentStep) {
      case 0:
        return (
          <Card className="w-full max-w-4xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-blue-600">
                Coronary Bifurcation Angle Calculator
              </CardTitle>
              <CardDescription className="text-lg mt-4">
                Calculate optimal RAO/LAO and cranial/caudal angles for coronary bifurcation procedures using advanced 3D reconstruction and foreshortening minimization algorithms.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!workflowMode ? (
                <>
                  <h3 className="text-xl font-semibold text-center mb-6">Choose Your Workflow</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Angiography Workflow */}
                    <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-300" 
                          onClick={() => setWorkflowMode('angiography')}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Camera className="h-6 w-6 text-blue-500" />
                          Angiographic Images
                        </CardTitle>
                        <CardDescription>
                          Use two existing angiographic images from different angles
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2">
                            <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">1</span>
                            Capture/upload two angiographic images
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">2</span>
                            Enter projection angles for each image
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">3</span>
                            Track vessel centerlines automatically
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">4</span>
                            Get optimal viewing angles
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* CT Workflow */}
                    <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-green-300" 
                          onClick={() => setWorkflowMode('ct')}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Upload className="h-6 w-6 text-green-500" />
                          Coronary CT (DICOM)
                        </CardTitle>
                        <CardDescription>
                          Load coronary CT angiography DICOM files for 3D analysis
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2">
                            <span className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">1</span>
                            Upload DICOM CT files
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">2</span>
                            Segment coronary arteries
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">3</span>
                            Generate simulated projections
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">4</span>
                            Plan optimal angles pre-procedure
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> Both workflows focus on the 0.5-1cm segments immediately around the bifurcation point for optimal stenting visualization.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-blue-50 rounded-lg p-6">
                    <h3 className="font-semibold text-lg mb-3">
                      Angiographic Workflow Selected
                    </h3>
                    <p className="text-sm text-gray-700">
                      You will work with two angiographic images to calculate optimal viewing angles.
                    </p>
                  </div>
                  
                  <div className="flex gap-4">
                    <Button onClick={() => setWorkflowMode(null)} variant="outline">
                      ← Change Workflow
                    </Button>
                    <Button onClick={handleNext} className="flex-1" size="lg">
                      Start Angiographic Analysis
                    </Button>
                  </div>
                </>
              )}
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
          <AngleInput
            title="First Image Projection Angles"
            description="Set the RAO/LAO and cranial/caudal angles for the first image"
            image={projectData.image1}
            initialAngles={projectData.image1Angles}
            onAnglesSet={(angles) => {
              updateProjectData({ image1Angles: angles })
              handleNext()
            }}
            onBack={handleBack}
          />
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
          <AngleInput
            title="Second Image Projection Angles"
            description="Set the RAO/LAO and cranial/caudal angles for the second image"
            image={projectData.image2}
            initialAngles={projectData.image2Angles}
            onAnglesSet={(angles) => {
              updateProjectData({ image2Angles: angles })
              handleNext()
            }}
            onBack={handleBack}
          />
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
          <Bifurcation3D
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
