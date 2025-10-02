import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Calculator, RotateCcw, Download, Eye } from 'lucide-react'
import { 
  reconstruct3DVesselDirections, 
  calculatePlaneNormal, 
  normalVectorToProjectionAngles,
  calculateAngleFromHorizontal,
  calculateAngleBetweenVectors2D
} from '../lib/geometryCalculations'

const ResultsDisplay = ({ projectData, onRestart }) => {
  const [results, setResults] = useState(null)
  const [isCalculating, setIsCalculating] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    calculateOptimalAngles()
  }, [projectData])

  const calculateOptimalAngles = async () => {
    try {
      setIsCalculating(true)
      setError(null)

      // Validate input data
      if (!projectData.image1Points || !projectData.image2Points) {
        throw new Error('Missing point data for one or both images')
      }

      // Get image dimensions (assuming standard dimensions for now)
      const imageWidth = 800
      const imageHeight = 600

      // Prepare projection data
      const projection1 = {
        points: projectData.image1Points,
        raoLao: projectData.image1Angles.raoLao,
        cranialCaudal: projectData.image1Angles.cranialCaudal,
        imageWidth,
        imageHeight
      }

      const projection2 = {
        points: projectData.image2Points,
        raoLao: projectData.image2Angles.raoLao,
        cranialCaudal: projectData.image2Angles.cranialCaudal,
        imageWidth,
        imageHeight
      }

      // Reconstruct 3D vessel directions
      const vesselDirections = reconstruct3DVesselDirections(projection1, projection2)

      // Calculate the normal to the bifurcation plane
      const planeNormal = calculatePlaneNormal(vesselDirections.vessel1, vesselDirections.vessel2)

      // Calculate optimal projection angles
      const optimalAngles = normalVectorToProjectionAngles(planeNormal)

      // Calculate additional metrics
      const vessel1Angle1 = calculateAngleFromHorizontal(
        projectData.image1Points.vessel1.end.x - projectData.image1Points.vessel1.start.x,
        projectData.image1Points.vessel1.end.y - projectData.image1Points.vessel1.start.y
      )

      const vessel2Angle1 = calculateAngleFromHorizontal(
        projectData.image1Points.vessel2.end.x - projectData.image1Points.vessel2.start.x,
        projectData.image1Points.vessel2.end.y - projectData.image1Points.vessel2.start.y
      )

      const bifurcationAngle1 = calculateAngleBetweenVectors2D(
        projectData.image1Points.vessel1.end.x - projectData.image1Points.vessel1.start.x,
        projectData.image1Points.vessel1.end.y - projectData.image1Points.vessel1.start.y,
        projectData.image2Points.vessel2.end.x - projectData.image2Points.vessel2.start.x,
        projectData.image2Points.vessel2.end.y - projectData.image2Points.vessel2.start.y
      )

      const vessel1Angle2 = calculateAngleFromHorizontal(
        projectData.image2Points.vessel1.end.x - projectData.image2Points.vessel1.start.x,
        projectData.image2Points.vessel1.end.y - projectData.image2Points.vessel1.start.y
      )

      const vessel2Angle2 = calculateAngleFromHorizontal(
        projectData.image2Points.vessel2.end.x - projectData.image2Points.vessel2.start.x,
        projectData.image2Points.vessel2.end.y - projectData.image2Points.vessel2.start.y
      )

      const bifurcationAngle2 = calculateAngleBetweenVectors2D(
        projectData.image2Points.vessel1.end.x - projectData.image2Points.vessel1.start.x,
        projectData.image2Points.vessel1.end.y - projectData.image2Points.vessel1.start.y,
        projectData.image2Points.vessel2.end.x - projectData.image2Points.vessel2.start.x,
        projectData.image2Points.vessel2.end.y - projectData.image2Points.vessel2.start.y
      )

      setResults({
        optimal: optimalAngles,
        analysis: {
          vesselDirections,
          planeNormal,
          image1Analysis: {
            vessel1Angle: vessel1Angle1,
            vessel2Angle: vessel2Angle1,
            bifurcationAngle: bifurcationAngle1
          },
          image2Analysis: {
            vessel1Angle: vessel1Angle2,
            vessel2Angle: vessel2Angle2,
            bifurcationAngle: bifurcationAngle2
          }
        }
      })

    } catch (err) {
      console.error('Calculation error:', err)
      setError(err.message)
    } finally {
      setIsCalculating(false)
    }
  }

  const formatAngle = (angle) => {
    return `${angle >= 0 ? '+' : ''}${angle.toFixed(1)}°`
  }

  const getAngleDescription = (raoLao, cranialCaudal) => {
    const raoLaoDesc = raoLao >= 0 ? `${raoLao.toFixed(1)}° RAO` : `${Math.abs(raoLao).toFixed(1)}° LAO`
    const cranialCaudalDesc = cranialCaudal >= 0 ? `${cranialCaudal.toFixed(1)}° Cranial` : `${Math.abs(cranialCaudal).toFixed(1)}° Caudal`
    return `${raoLaoDesc}, ${cranialCaudalDesc}`
  }

  const exportResults = () => {
    if (!results) return

    const reportData = {
      timestamp: new Date().toISOString(),
      inputProjections: {
        image1: {
          raoLao: projectData.image1Angles.raoLao,
          cranialCaudal: projectData.image1Angles.cranialCaudal
        },
        image2: {
          raoLao: projectData.image2Angles.raoLao,
          cranialCaudal: projectData.image2Angles.cranialCaudal
        }
      },
      optimalProjection: results.optimal,
      analysis: results.analysis
    }

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `coronary-bifurcation-analysis-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (isCalculating) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <h3 className="text-lg font-semibold mb-2">Calculating Optimal Angles</h3>
          <p className="text-sm text-gray-600 text-center">
            Processing vessel directions and computing perpendicular projection angles...
          </p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-red-600">Calculation Error</CardTitle>
          <CardDescription>
            An error occurred while calculating the optimal angles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
          <div className="flex justify-center">
            <Button onClick={onRestart}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Start Over
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Main Results Card */}
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-green-600">
            Optimal Projection Angles Calculated
          </CardTitle>
          <CardDescription>
            Recommended angles for perpendicular bifurcation visualization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Optimal Angles Display */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 text-center">
            <h3 className="text-lg font-semibold mb-4">Recommended Projection</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-3xl font-bold text-green-600">
                  {formatAngle(results.optimal.raoLao)}
                </div>
                <div className="text-sm text-gray-600">
                  {results.optimal.raoLao >= 0 ? 'RAO' : 'LAO'}
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-blue-600">
                  {formatAngle(results.optimal.cranialCaudal)}
                </div>
                <div className="text-sm text-gray-600">
                  {results.optimal.cranialCaudal >= 0 ? 'Cranial' : 'Caudal'}
                </div>
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-700">
              {getAngleDescription(results.optimal.raoLao, results.optimal.cranialCaudal)}
            </div>
          </div>

          <Separator />

          {/* Input Summary */}
          <div>
            <h3 className="font-semibold mb-3">Input Projections</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-gray-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">First Image</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-sm space-y-1">
                    <div>RAO/LAO: {formatAngle(projectData.image1Angles.raoLao)}</div>
                    <div>Cranial/Caudal: {formatAngle(projectData.image1Angles.cranialCaudal)}</div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gray-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Second Image</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-sm space-y-1">
                    <div>RAO/LAO: {formatAngle(projectData.image2Angles.raoLao)}</div>
                    <div>Cranial/Caudal: {formatAngle(projectData.image2Angles.cranialCaudal)}</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Separator />

          {/* Analysis Details */}
          <div>
            <h3 className="font-semibold mb-3">Analysis Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">First Image Analysis</h4>
                <div className="space-y-1 text-gray-600">
                  <div>Vessel 1 angle: {formatAngle(results.analysis.image1Analysis.vessel1Angle)}</div>
                  <div>Vessel 2 angle: {formatAngle(results.analysis.image1Analysis.vessel2Angle)}</div>
                  <div>Bifurcation angle: {formatAngle(results.analysis.image1Analysis.bifurcationAngle)}</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Second Image Analysis</h4>
                <div className="space-y-1 text-gray-600">
                  <div>Vessel 1 angle: {formatAngle(results.analysis.image2Analysis.vessel1Angle)}</div>
                  <div>Vessel 2 angle: {formatAngle(results.analysis.image2Analysis.vessel2Angle)}</div>
                  <div>Bifurcation angle: {formatAngle(results.analysis.image2Analysis.bifurcationAngle)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button variant="outline" onClick={exportResults}>
              <Download className="mr-2 h-4 w-4" />
              Export Results
            </Button>
            <Button onClick={onRestart}>
              <RotateCcw className="mr-2 h-4 w-4" />
              New Calculation
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Technical Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Technical Details</CardTitle>
          <CardDescription>
            3D reconstruction and geometric analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Vessel 1 Direction (3D)</h4>
              <div className="font-mono text-xs bg-gray-100 p-2 rounded">
                [{results.analysis.vesselDirections.vessel1.map(v => v.toFixed(3)).join(', ')}]
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Vessel 2 Direction (3D)</h4>
              <div className="font-mono text-xs bg-gray-100 p-2 rounded">
                [{results.analysis.vesselDirections.vessel2.map(v => v.toFixed(3)).join(', ')}]
              </div>
            </div>
            
            <div className="md:col-span-2">
              <h4 className="font-medium mb-2">Bifurcation Plane Normal</h4>
              <div className="font-mono text-xs bg-gray-100 p-2 rounded">
                [{results.analysis.planeNormal.map(v => v.toFixed(3)).join(', ')}]
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">How it works:</h4>
            <ol className="text-sm text-blue-700 list-decimal list-inside space-y-1">
              <li>Convert 2D vessel points to 3D directions using projection matrices</li>
              <li>Calculate the normal vector to the plane containing both vessels</li>
              <li>Determine optimal viewing angles perpendicular to this plane</li>
              <li>Convert back to RAO/LAO and cranial/caudal coordinates</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ResultsDisplay
