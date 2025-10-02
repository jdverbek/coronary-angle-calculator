# Coronary Bifurcation Angle Calculator

A web application for calculating optimal RAO/LAO and cranial/caudal projection angles for coronary bifurcation lesions during angiography procedures.

## 🏥 Medical Purpose

This application helps interventional cardiologists determine the ideal viewing angles for coronary bifurcation lesions by:

1. **Image Analysis**: Processing two angiographic images from different projections
2. **3D Reconstruction**: Converting 2D vessel measurements to 3D spatial relationships
3. **Angle Optimization**: Calculating perpendicular projection angles for optimal lesion visualization

## 📱 Features

### Core Functionality
- **Dual Image Processing**: Analyze two angiographic projections
- **Automatic Perspective Correction**: Corrects camera tilt and distortion
- **Interactive Point Selection**: Touch-optimized vessel endpoint marking
- **3D Geometric Calculations**: Reconstructs vessel directions in 3D space
- **Optimal Angle Calculation**: Determines ideal RAO/LAO and cranial/caudal angles

### iOS Safari Optimized
- **Native Camera Integration**: Direct access to iPhone camera
- **Touch-Friendly Interface**: Optimized for mobile interaction
- **Retina Display Support**: High-resolution canvas rendering
- **PWA Capabilities**: Can be installed as a web app on iOS
- **Haptic Feedback**: Touch feedback for better user experience

### Technical Features
- **Client-Side Processing**: All calculations performed locally (no server required)
- **Privacy-First**: Medical images never leave the device
- **Responsive Design**: Works on desktop and mobile devices
- **Modern Web Technologies**: Built with React and modern JavaScript

## 🚀 Quick Start

### For Users
1. Visit the deployed application at: [https://coronary-angle-calculator.onrender.com](https://coronary-angle-calculator.onrender.com)
2. Take or upload two angiographic images from different projections
3. Enter the RAO/LAO and cranial/caudal angles for each image
4. Mark vessel endpoints on both images
5. Get optimal projection angles for perpendicular bifurcation viewing

### For Developers

#### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm

#### Installation
```bash
git clone https://github.com/jdverbek/coronary-angle-calculator.git
cd coronary-angle-calculator
pnpm install
```

#### Development
```bash
pnpm run dev
```

#### Build for Production
```bash
pnpm run build
```

## 🏗️ Architecture

### Frontend Stack
- **React 18**: Modern React with hooks
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: High-quality UI components
- **Lucide Icons**: Beautiful icon library

### Key Components
- **ImageCapture**: Camera/file input with iOS optimization
- **PointSelector**: Interactive canvas for vessel marking
- **ImageProcessor**: Automatic perspective correction
- **ResultsDisplay**: Calculated angles and analysis

### Mathematical Libraries
- **Image Processing**: Custom corner detection and perspective correction
- **3D Geometry**: Vector mathematics and coordinate transformations
- **Touch Utilities**: iOS Safari optimizations and touch handling

## 📐 Mathematical Foundation

### Coordinate System
- **RAO/LAO**: Right/Left Anterior Oblique (rotation around patient's longitudinal axis)
- **Cranial/Caudal**: Head/Foot angulation (rotation around patient's lateral axis)

### Calculation Process
1. **2D to 3D Mapping**: Convert image coordinates to 3D vessel directions
2. **Plane Calculation**: Determine bifurcation plane from vessel vectors
3. **Normal Vector**: Calculate plane normal using cross product
4. **Optimal Angles**: Convert normal to perpendicular viewing angles

### Key Algorithms
- Harris Corner Detection for frame identification
- Homography calculation for perspective correction
- 3D vector reconstruction from multiple projections
- Spherical coordinate conversion for angle optimization

## 🔧 Configuration

### Environment Variables
No environment variables required - fully client-side application.

### Build Configuration
- **Vite Config**: Optimized for production deployment
- **Tailwind Config**: Custom design system
- **PWA Manifest**: iOS installation support

## 📱 iOS Safari Optimizations

### Camera Integration
```javascript
// Optimized camera input for iOS
<input 
  type="file" 
  accept="image/*" 
  capture="camera"
  // iOS-specific optimizations applied
/>
```

### Touch Handling
```javascript
// Multi-touch support for canvas interaction
canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
canvas.addEventListener('touchend', handleTouchEnd, { passive: false })
```

### Retina Display Support
```javascript
// High-DPI canvas optimization
const dpr = window.devicePixelRatio || 1
canvas.width = width * dpr
canvas.height = height * dpr
ctx.scale(dpr, dpr)
```

## 🚀 Deployment

### Render.com Deployment
This application is configured for automatic deployment on Render.com:

1. **Build Command**: `pnpm run build`
2. **Publish Directory**: `dist`
3. **Auto-Deploy**: Enabled on main branch pushes

### Manual Deployment
```bash
# Build the application
pnpm run build

# Deploy the dist/ folder to any static hosting service
```

## 🧪 Testing

### Local Testing
```bash
# Start development server
pnpm run dev

# Test on mobile devices using local network
pnpm run dev --host
```

### iOS Safari Testing
1. Connect iPhone to same network as development machine
2. Access app via local IP address
3. Test camera functionality and touch interactions
4. Verify PWA installation capability

## 📊 Performance

### Optimization Features
- **Image Compression**: Automatic mobile image optimization
- **Lazy Loading**: Components loaded as needed
- **Client-Side Processing**: No server round trips
- **Efficient Rendering**: Optimized canvas operations

### Browser Support
- **iOS Safari**: 14+
- **Chrome Mobile**: 90+
- **Desktop Browsers**: All modern browsers
- **PWA Support**: iOS 14.3+, Android Chrome 90+

## 🔒 Privacy & Security

### Data Handling
- **Local Processing**: All images processed on device
- **No Server Storage**: Images never uploaded to servers
- **No Tracking**: No analytics or user tracking
- **HIPAA Considerations**: Designed for medical data privacy

### Security Features
- **HTTPS Only**: Secure connection required
- **No External APIs**: Self-contained application
- **Client-Side Validation**: Input validation on device

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on iOS Safari
5. Submit a pull request

### Code Style
- **ESLint**: Configured for React best practices
- **Prettier**: Automatic code formatting
- **TypeScript**: Optional but encouraged for new features

### Medical Accuracy
- All mathematical calculations should be validated
- Clinical testing recommended before production use
- Consult with interventional cardiologists for validation

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🏥 Medical Disclaimer

This application is for educational and research purposes. Always consult with qualified medical professionals for clinical decisions. The developers are not responsible for medical outcomes based on this tool's calculations.

## 📞 Support

For technical issues or feature requests, please open an issue on GitHub.

For medical questions or clinical validation, please consult with interventional cardiology specialists.

---

**Built with ❤️ for the interventional cardiology community**
