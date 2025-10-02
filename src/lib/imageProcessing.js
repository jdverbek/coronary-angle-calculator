/**
 * Image Processing Utilities for Coronary Angiography
 * Handles corner detection, perspective correction, and geometric calculations
 */

/**
 * Detects corners in an image using Harris corner detection algorithm
 * @param {ImageData} imageData - The image data from canvas
 * @returns {Array} Array of corner points [{x, y}, ...]
 */
export function detectCorners(imageData) {
  const { width, height, data } = imageData;
  
  // Convert to grayscale
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  
  // Simplified Harris corner detection
  const corners = [];
  const threshold = 100;
  const windowSize = 3;
  
  // Calculate gradients
  const gradX = new Float32Array(width * height);
  const gradY = new Float32Array(width * height);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      gradX[idx] = gray[idx + 1] - gray[idx - 1];
      gradY[idx] = gray[(y + 1) * width + x] - gray[(y - 1) * width + x];
    }
  }
  
  // Calculate Harris response
  for (let y = windowSize; y < height - windowSize; y++) {
    for (let x = windowSize; x < width - windowSize; x++) {
      let Ixx = 0, Iyy = 0, Ixy = 0;
      
      // Sum over window
      for (let dy = -windowSize; dy <= windowSize; dy++) {
        for (let dx = -windowSize; dx <= windowSize; dx++) {
          const idx = (y + dy) * width + (x + dx);
          const gx = gradX[idx];
          const gy = gradY[idx];
          
          Ixx += gx * gx;
          Iyy += gy * gy;
          Ixy += gx * gy;
        }
      }
      
      // Harris response
      const det = Ixx * Iyy - Ixy * Ixy;
      const trace = Ixx + Iyy;
      const response = det - 0.04 * trace * trace;
      
      if (response > threshold) {
        corners.push({ x, y, response });
      }
    }
  }
  
  // Sort by response and return top corners
  corners.sort((a, b) => b.response - a.response);
  return corners.slice(0, 4);
}

/**
 * Finds the four corners of a rectangular frame in the image
 * @param {Array} corners - Array of detected corners
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Object} Object with topLeft, topRight, bottomLeft, bottomRight corners
 */
export function findFrameCorners(corners, width, height) {
  if (corners.length < 4) {
    // Fallback: assume corners are at image edges
    return {
      topLeft: { x: 0, y: 0 },
      topRight: { x: width - 1, y: 0 },
      bottomLeft: { x: 0, y: height - 1 },
      bottomRight: { x: width - 1, y: height - 1 }
    };
  }
  
  // Sort corners by position
  const sortedCorners = [...corners];
  
  // Find corners by quadrant
  const centerX = width / 2;
  const centerY = height / 2;
  
  let topLeft = null, topRight = null, bottomLeft = null, bottomRight = null;
  
  for (const corner of sortedCorners) {
    if (corner.x < centerX && corner.y < centerY) {
      if (!topLeft || (corner.x + corner.y) < (topLeft.x + topLeft.y)) {
        topLeft = corner;
      }
    } else if (corner.x >= centerX && corner.y < centerY) {
      if (!topRight || (corner.x - corner.y) > (topRight.x - topRight.y)) {
        topRight = corner;
      }
    } else if (corner.x < centerX && corner.y >= centerY) {
      if (!bottomLeft || (corner.y - corner.x) > (bottomLeft.y - bottomLeft.x)) {
        bottomLeft = corner;
      }
    } else {
      if (!bottomRight || (corner.x + corner.y) > (bottomRight.x + bottomRight.y)) {
        bottomRight = corner;
      }
    }
  }
  
  return {
    topLeft: topLeft || { x: 0, y: 0 },
    topRight: topRight || { x: width - 1, y: 0 },
    bottomLeft: bottomLeft || { x: 0, y: height - 1 },
    bottomRight: bottomRight || { x: width - 1, y: height - 1 }
  };
}

/**
 * Calculates homography matrix for perspective correction
 * @param {Object} srcCorners - Source corners (detected)
 * @param {Object} dstCorners - Destination corners (corrected rectangle)
 * @returns {Array} 3x3 homography matrix
 */
export function calculateHomography(srcCorners, dstCorners) {
  // Extract coordinates
  const src = [
    [srcCorners.topLeft.x, srcCorners.topLeft.y],
    [srcCorners.topRight.x, srcCorners.topRight.y],
    [srcCorners.bottomLeft.x, srcCorners.bottomLeft.y],
    [srcCorners.bottomRight.x, srcCorners.bottomRight.y]
  ];
  
  const dst = [
    [dstCorners.topLeft.x, dstCorners.topLeft.y],
    [dstCorners.topRight.x, dstCorners.topRight.y],
    [dstCorners.bottomLeft.x, dstCorners.bottomLeft.y],
    [dstCorners.bottomRight.x, dstCorners.bottomRight.y]
  ];
  
  // Build system of equations Ah = b
  const A = [];
  const b = [];
  
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    
    // First equation: u = (h00*x + h01*y + h02) / (h20*x + h21*y + h22)
    A.push([x, y, 1, 0, 0, 0, -u*x, -u*y]);
    b.push(u);
    
    // Second equation: v = (h10*x + h11*y + h12) / (h20*x + h21*y + h22)
    A.push([0, 0, 0, x, y, 1, -v*x, -v*y]);
    b.push(v);
  }
  
  // Solve using least squares (simplified)
  const h = solveLeastSquares(A, b);
  
  // Return 3x3 matrix
  return [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1]
  ];
}

/**
 * Applies perspective transformation to correct image distortion
 * @param {HTMLCanvasElement} canvas - Source canvas
 * @param {Array} homography - 3x3 homography matrix
 * @param {number} outputWidth - Output image width
 * @param {number} outputHeight - Output image height
 * @returns {HTMLCanvasElement} Corrected canvas
 */
export function applyPerspectiveCorrection(canvas, homography, outputWidth, outputHeight) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // Create output canvas
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;
  const outputCtx = outputCanvas.getContext('2d');
  const outputImageData = outputCtx.createImageData(outputWidth, outputHeight);
  
  // Inverse homography for backward mapping
  const invH = invertMatrix3x3(homography);
  
  for (let y = 0; y < outputHeight; y++) {
    for (let x = 0; x < outputWidth; x++) {
      // Apply inverse transformation
      const srcCoords = applyHomography(invH, x, y);
      const srcX = Math.round(srcCoords.x);
      const srcY = Math.round(srcCoords.y);
      
      // Check bounds
      if (srcX >= 0 && srcX < canvas.width && srcY >= 0 && srcY < canvas.height) {
        const srcIdx = (srcY * canvas.width + srcX) * 4;
        const dstIdx = (y * outputWidth + x) * 4;
        
        // Copy pixel
        outputImageData.data[dstIdx] = imageData.data[srcIdx];
        outputImageData.data[dstIdx + 1] = imageData.data[srcIdx + 1];
        outputImageData.data[dstIdx + 2] = imageData.data[srcIdx + 2];
        outputImageData.data[dstIdx + 3] = imageData.data[srcIdx + 3];
      }
    }
  }
  
  outputCtx.putImageData(outputImageData, 0, 0);
  return outputCanvas;
}

/**
 * Applies homography transformation to a point
 * @param {Array} H - 3x3 homography matrix
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {Object} Transformed coordinates {x, y}
 */
function applyHomography(H, x, y) {
  const w = H[2][0] * x + H[2][1] * y + H[2][2];
  return {
    x: (H[0][0] * x + H[0][1] * y + H[0][2]) / w,
    y: (H[1][0] * x + H[1][1] * y + H[1][2]) / w
  };
}

/**
 * Inverts a 3x3 matrix
 * @param {Array} matrix - 3x3 matrix
 * @returns {Array} Inverted 3x3 matrix
 */
function invertMatrix3x3(matrix) {
  const [[a, b, c], [d, e, f], [g, h, i]] = matrix;
  
  const det = a*(e*i - f*h) - b*(d*i - f*g) + c*(d*h - e*g);
  
  if (Math.abs(det) < 1e-10) {
    throw new Error('Matrix is not invertible');
  }
  
  return [
    [(e*i - f*h)/det, (c*h - b*i)/det, (b*f - c*e)/det],
    [(f*g - d*i)/det, (a*i - c*g)/det, (c*d - a*f)/det],
    [(d*h - e*g)/det, (b*g - a*h)/det, (a*e - b*d)/det]
  ];
}

/**
 * Solves least squares problem Ax = b
 * @param {Array} A - Matrix A
 * @param {Array} b - Vector b
 * @returns {Array} Solution vector x
 */
function solveLeastSquares(A, b) {
  // Simplified implementation using normal equations: (A^T A) x = A^T b
  const m = A.length;
  const n = A[0].length;
  
  // Calculate A^T A
  const AtA = Array(n).fill().map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < m; k++) {
        AtA[i][j] += A[k][i] * A[k][j];
      }
    }
  }
  
  // Calculate A^T b
  const Atb = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < m; k++) {
      Atb[i] += A[k][i] * b[k];
    }
  }
  
  // Solve using Gaussian elimination (simplified)
  return gaussianElimination(AtA, Atb);
}

/**
 * Solves linear system using Gaussian elimination
 * @param {Array} A - Coefficient matrix
 * @param {Array} b - Right-hand side vector
 * @returns {Array} Solution vector
 */
function gaussianElimination(A, b) {
  const n = A.length;
  const augmented = A.map((row, i) => [...row, b[i]]);
  
  // Forward elimination
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k;
      }
    }
    
    // Swap rows
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
    
    // Make all rows below this one 0 in current column
    for (let k = i + 1; k < n; k++) {
      const factor = augmented[k][i] / augmented[i][i];
      for (let j = i; j <= n; j++) {
        augmented[k][j] -= factor * augmented[i][j];
      }
    }
  }
  
  // Back substitution
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = augmented[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= augmented[i][j] * x[j];
    }
    x[i] /= augmented[i][i];
  }
  
  return x;
}
