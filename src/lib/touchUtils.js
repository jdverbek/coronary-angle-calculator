/**
 * Touch and iOS Safari Utilities
 * Handles touch interactions, gesture recognition, and iOS-specific behaviors
 */

/**
 * Prevents default touch behaviors that interfere with canvas interaction
 * @param {HTMLElement} element - Element to apply touch prevention
 */
export function preventDefaultTouchBehaviors(element) {
  if (!element) return

  // Prevent scrolling and zooming on touch
  element.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) {
      e.preventDefault() // Prevent pinch zoom
    }
  }, { passive: false })

  element.addEventListener('touchmove', (e) => {
    e.preventDefault() // Prevent scrolling
  }, { passive: false })

  element.addEventListener('touchend', (e) => {
    e.preventDefault()
  }, { passive: false })

  // Prevent context menu on long press
  element.addEventListener('contextmenu', (e) => {
    e.preventDefault()
  })
}

/**
 * Gets touch coordinates relative to an element
 * @param {TouchEvent} event - Touch event
 * @param {HTMLElement} element - Target element
 * @returns {Object} Coordinates {x, y}
 */
export function getTouchCoordinates(event, element) {
  const rect = element.getBoundingClientRect()
  const touch = event.touches[0] || event.changedTouches[0]
  
  return {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top
  }
}

/**
 * Detects if the device is iOS
 * @returns {boolean} True if iOS device
 */
export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/**
 * Detects if the browser is Safari
 * @returns {boolean} True if Safari browser
 */
export function isSafari() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
}

/**
 * Handles file input for iOS camera access
 * @param {HTMLInputElement} input - File input element
 * @param {Function} callback - Callback function for file selection
 */
export function setupIOSCameraInput(input, callback) {
  if (!input) return

  // iOS-specific attributes for better camera access
  input.setAttribute('accept', 'image/*')
  input.setAttribute('capture', 'camera')
  
  // Handle file selection
  input.addEventListener('change', (event) => {
    const file = event.target.files[0]
    if (file && file.type.startsWith('image/')) {
      callback(file)
    }
  })
}

/**
 * Optimizes canvas for high DPI displays (Retina)
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Desired width
 * @param {number} height - Desired height
 */
export function optimizeCanvasForRetina(canvas, ctx, width, height) {
  const devicePixelRatio = window.devicePixelRatio || 1
  
  // Set actual size in memory (scaled up for retina)
  canvas.width = width * devicePixelRatio
  canvas.height = height * devicePixelRatio
  
  // Scale the canvas back down using CSS
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'
  
  // Scale the drawing context so everything draws at the correct size
  ctx.scale(devicePixelRatio, devicePixelRatio)
  
  return devicePixelRatio
}

/**
 * Handles orientation change events
 * @param {Function} callback - Callback function for orientation change
 */
export function handleOrientationChange(callback) {
  const handleChange = () => {
    // Delay to allow for orientation change to complete
    setTimeout(callback, 100)
  }
  
  window.addEventListener('orientationchange', handleChange)
  window.addEventListener('resize', handleChange)
  
  // Return cleanup function
  return () => {
    window.removeEventListener('orientationchange', handleChange)
    window.removeEventListener('resize', handleChange)
  }
}

/**
 * Prevents iOS Safari from bouncing when scrolling
 * @param {HTMLElement} element - Element to prevent bouncing
 */
export function preventIOSBounce(element = document.body) {
  let startY = 0
  
  element.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY
  }, { passive: true })
  
  element.addEventListener('touchmove', (e) => {
    const currentY = e.touches[0].clientY
    const scrollTop = element.scrollTop
    const scrollHeight = element.scrollHeight
    const clientHeight = element.clientHeight
    
    // Prevent overscroll
    if ((scrollTop <= 0 && currentY > startY) || 
        (scrollTop >= scrollHeight - clientHeight && currentY < startY)) {
      e.preventDefault()
    }
  }, { passive: false })
}

/**
 * Creates a vibration feedback for touch interactions (iOS)
 * @param {string} type - Type of vibration ('light', 'medium', 'heavy')
 */
export function hapticFeedback(type = 'light') {
  if (window.navigator && window.navigator.vibrate) {
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30]
    }
    window.navigator.vibrate(patterns[type] || patterns.light)
  }
}

/**
 * Handles safe area insets for iPhone X and newer
 * @returns {Object} Safe area insets {top, right, bottom, left}
 */
export function getSafeAreaInsets() {
  const style = getComputedStyle(document.documentElement)
  
  return {
    top: parseInt(style.getPropertyValue('--sat') || style.getPropertyValue('env(safe-area-inset-top)') || '0'),
    right: parseInt(style.getPropertyValue('--sar') || style.getPropertyValue('env(safe-area-inset-right)') || '0'),
    bottom: parseInt(style.getPropertyValue('--sab') || style.getPropertyValue('env(safe-area-inset-bottom)') || '0'),
    left: parseInt(style.getPropertyValue('--sal') || style.getPropertyValue('env(safe-area-inset-left)') || '0')
  }
}

/**
 * Optimizes image loading for mobile devices
 * @param {File} file - Image file
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<string>} Optimized image data URL
 */
export function optimizeImageForMobile(file, maxWidth = 1920, maxHeight = 1080, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width *= ratio
        height *= ratio
      }
      
      // Set canvas size
      canvas.width = width
      canvas.height = height
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height)
      
      // Convert to data URL with compression
      const dataURL = canvas.toDataURL('image/jpeg', quality)
      resolve(dataURL)
    }
    
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}
