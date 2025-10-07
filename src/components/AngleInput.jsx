import { useState } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Slider } from '@/components/ui/slider.jsx'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.jsx'

const AngleInput = ({ 
  title, 
  description, 
  image, 
  initialAngles = { raoLao: 0, cranialCaudal: 0 },
  onAnglesSet, 
  onBack 
}) => {
  // Separate direction and magnitude for each axis
  const [raoLaoDirection, setRaoLaoDirection] = useState(
    initialAngles.raoLao >= 0 ? 'RAO' : 'LAO'
  )
  const [raoLaoMagnitude, setRaoLaoMagnitude] = useState(
    Math.abs(initialAngles.raoLao)
  )
  
  const [cranialCaudalDirection, setCranialCaudalDirection] = useState(
    initialAngles.cranialCaudal >= 0 ? 'Cranial' : 'Caudal'
  )
  const [cranialCaudalMagnitude, setCranialCaudalMagnitude] = useState(
    Math.abs(initialAngles.cranialCaudal)
  )

  // Calculate final angles
  const finalRaoLao = raoLaoDirection === 'RAO' ? raoLaoMagnitude : -raoLaoMagnitude
  const finalCranialCaudal = cranialCaudalDirection === 'Cranial' ? cranialCaudalMagnitude : -cranialCaudalMagnitude

  const handleContinue = () => {
    if (onAnglesSet) {
      onAnglesSet({
        raoLao: finalRaoLao,
        cranialCaudal: finalCranialCaudal
      })
    }
  }

  const getAngleDescription = (direction, magnitude) => {
    if (magnitude === 0) return '0°'
    return `${magnitude}° ${direction}`
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Image Display */}
        {image && (
          <div className="flex justify-center mb-6">
            <img 
              src={image} 
              alt="Angiogram" 
              className="max-w-full max-h-64 object-contain rounded-lg border shadow-sm"
            />
          </div>
        )}

        {/* Current Angle Summary */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 text-center">
          <h3 className="font-semibold text-lg mb-2">Current Projection</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Badge variant="outline" className="text-base px-3 py-1">
                {getAngleDescription(raoLaoDirection, raoLaoMagnitude)}
              </Badge>
            </div>
            <div>
              <Badge variant="outline" className="text-base px-3 py-1">
                {getAngleDescription(cranialCaudalDirection, cranialCaudalMagnitude)}
              </Badge>
            </div>
          </div>
        </div>

        {/* RAO/LAO Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">RAO/LAO Direction</h4>
            <Badge variant="secondary">
              {finalRaoLao > 0 ? '+' : finalRaoLao < 0 ? '-' : ''}
              {Math.abs(finalRaoLao)}°
            </Badge>
          </div>
          
          <ToggleGroup 
            type="single" 
            value={raoLaoDirection} 
            onValueChange={(value) => value && setRaoLaoDirection(value)}
            className="justify-center"
          >
            <ToggleGroupItem value="LAO" className="px-8">
              LAO (Left)
            </ToggleGroupItem>
            <ToggleGroupItem value="RAO" className="px-8">
              RAO (Right)
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Magnitude</span>
              <span className="text-sm font-medium">{raoLaoMagnitude}°</span>
            </div>
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
        </div>

        {/* Cranial/Caudal Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Cranial/Caudal Direction</h4>
            <Badge variant="secondary">
              {finalCranialCaudal > 0 ? '+' : finalCranialCaudal < 0 ? '-' : ''}
              {Math.abs(finalCranialCaudal)}°
            </Badge>
          </div>
          
          <ToggleGroup 
            type="single" 
            value={cranialCaudalDirection} 
            onValueChange={(value) => value && setCranialCaudalDirection(value)}
            className="justify-center"
          >
            <ToggleGroupItem value="Caudal" className="px-8">
              Caudal (Down)
            </ToggleGroupItem>
            <ToggleGroupItem value="Cranial" className="px-8">
              Cranial (Up)
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Magnitude</span>
              <span className="text-sm font-medium">{cranialCaudalMagnitude}°</span>
            </div>
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
        </div>

        {/* Help Text */}
        <div className="bg-muted p-4 rounded-lg text-sm">
          <h5 className="font-medium mb-2">Quick Reference:</h5>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <strong>RAO:</strong> Right Anterior Oblique<br/>
              <strong>LAO:</strong> Left Anterior Oblique
            </div>
            <div>
              <strong>Cranial:</strong> Tube angled up<br/>
              <strong>Caudal:</strong> Tube angled down
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between">
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
          <Button onClick={handleContinue} className="ml-auto">
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default AngleInput
