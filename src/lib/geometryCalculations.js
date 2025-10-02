/**
 * 3D Geometry Calculations for Coronary Angiography
 * Handles coordinate transformations, plane calculations, and angle optimization
 */

/**
 * Converts angiographic projection angles to rotation matrices
 * @param {number} raoLao - RAO/LAO angle in degrees (positive = RAO, negative = LAO)
 * @param {number} cranialCaudal - Cranial/Caudal angle in degrees (positive = cranial, negative = caudal)
 * @returns {Array} 3x3 rotation matrix
 */
export function projectionAnglesToRotationMatrix(raoLao, cranialCaudal) {
  const raoRad = (raoLao * Math.PI) / 180;
  const cranialRad = (cranialCaudal * Math.PI) / 180;
  
  // RAO/LAO rotation around Z-axis (patient's longitudinal axis)
  const cosRao = Math.cos(raoRad);
  const sinRao = Math.sin(raoRad);
  
  // Cranial/Caudal rotation around X-axis (patient's lateral axis)
  const cosCranial = Math.cos(cranialRad);
  const sinCranial = Math.sin(cranialRad);
  
  // Combined rotation matrix: R = R_cranial * R_rao
  return [
    [cosRao, -sinRao * cosCranial, sinRao * sinCranial],
    [sinRao, cosRao * cosCranial, -cosRao * sinCranial],
    [0, sinCranial, cosCranial]
  ];
}

/**
 * Converts 2D image coordinates to 3D direction vector
 * @param {number} x1 - First point X coordinate
 * @param {number} y1 - First point Y coordinate
 * @param {number} x2 - Second point X coordinate
 * @param {number} y2 - Second point Y coordinate
 * @param {number} imageWidth - Image width in pixels
 * @param {number} imageHeight - Image height in pixels
 * @param {Array} rotationMatrix - 3x3 rotation matrix for the projection
 * @returns {Array} 3D direction vector [x, y, z]
 */
export function imageCoordinatesTo3DDirection(x1, y1, x2, y2, imageWidth, imageHeight, rotationMatrix) {
  // Normalize coordinates to [-1, 1] range
  const normX1 = (2 * x1 / imageWidth) - 1;
  const normY1 = 1 - (2 * y1 / imageHeight); // Flip Y axis
  const normX2 = (2 * x2 / imageWidth) - 1;
  const normY2 = 1 - (2 * y2 / imageHeight);
  
  // Calculate 2D direction vector in image plane
  const dx = normX2 - normX1;
  const dy = normY2 - normY1;
  
  // Normalize the 2D direction
  const length2D = Math.sqrt(dx * dx + dy * dy);
  if (length2D === 0) {
    throw new Error('Points are identical');
  }
  
  const dirX = dx / length2D;
  const dirY = dy / length2D;
  
  // Convert to 3D direction in image plane (Z = 0 in image coordinates)
  const imageDir = [dirX, dirY, 0];
  
  // Transform to world coordinates using inverse rotation matrix
  const invRotation = transposeMatrix3x3(rotationMatrix);
  return multiplyMatrixVector(invRotation, imageDir);
}

/**
 * Calculates the normal vector to the plane containing two 3D direction vectors
 * @param {Array} direction1 - First 3D direction vector [x, y, z]
 * @param {Array} direction2 - Second 3D direction vector [x, y, z]
 * @returns {Array} Normal vector to the plane [x, y, z]
 */
export function calculatePlaneNormal(direction1, direction2) {
  // Calculate cross product: normal = direction1 × direction2
  const normal = [
    direction1[1] * direction2[2] - direction1[2] * direction2[1],
    direction1[2] * direction2[0] - direction1[0] * direction2[2],
    direction1[0] * direction2[1] - direction1[1] * direction2[0]
  ];
  
  // Normalize the normal vector
  const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
  if (length === 0) {
    throw new Error('Directions are parallel - cannot determine plane');
  }
  
  return [normal[0] / length, normal[1] / length, normal[2] / length];
}

/**
 * Converts a 3D normal vector to optimal projection angles
 * The normal vector represents the direction perpendicular to the bifurcation plane.
 * The optimal incident angles are those that align the viewing direction with this normal.
 * @param {Array} normal - Normal vector [x, y, z] to the bifurcation plane
 * @returns {Object} Optimal incident angles {raoLao, cranialCaudal}
 */
export function normalVectorToProjectionAngles(normal) {
  const [nx, ny, nz] = normal;
  
  // The optimal viewing direction is along the normal vector
  // Convert this direction to RAO/LAO and Cranial/Caudal angles
  
  // RAO/LAO angle: rotation around patient's longitudinal axis (z-axis)
  // atan2(x, y) gives the angle in the xy-plane from the positive y-axis
  // Positive = RAO (right anterior oblique), Negative = LAO (left anterior oblique)
  let raoLao = Math.atan2(nx, ny) * (180 / Math.PI);
  
  // Cranial/Caudal angle: elevation angle from the xy-plane
  // asin(z/r) gives the angle from the horizontal plane
  // Positive = Cranial (toward head), Negative = Caudal (toward feet)
  const r = Math.sqrt(nx * nx + ny * ny + nz * nz);
  let cranialCaudal = Math.asin(nz / r) * (180 / Math.PI);
  
  // Normalize angles to standard angiographic ranges
  // RAO/LAO typically ranges from -90° to +90°
  if (raoLao > 90) raoLao -= 180;
  if (raoLao < -90) raoLao += 180;
  
  // Cranial/Caudal typically ranges from -45° to +45°
  cranialCaudal = Math.max(-45, Math.min(45, cranialCaudal));
  
  return {
    raoLao: Math.round(raoLao * 10) / 10, // Round to 1 decimal place
    cranialCaudal: Math.round(cranialCaudal * 10) / 10
  };
}

/**
 * Calculates the angle between two 2D vectors
 * @param {number} x1 - First vector X component
 * @param {number} y1 - First vector Y component
 * @param {number} x2 - Second vector X component
 * @param {number} y2 - Second vector Y component
 * @returns {number} Angle in degrees
 */
export function calculateAngleBetweenVectors2D(x1, y1, x2, y2) {
  // Calculate dot product
  const dot = x1 * x2 + y1 * y2;
  
  // Calculate magnitudes
  const mag1 = Math.sqrt(x1 * x1 + y1 * y1);
  const mag2 = Math.sqrt(x2 * x2 + y2 * y2);
  
  if (mag1 === 0 || mag2 === 0) {
    return 0;
  }
  
  // Calculate angle
  const cosAngle = dot / (mag1 * mag2);
  const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))); // Clamp to avoid numerical errors
  
  return (angle * 180) / Math.PI;
}

/**
 * Calculates the angle of a vector relative to the horizontal axis
 * @param {number} dx - X component of the vector
 * @param {number} dy - Y component of the vector
 * @returns {number} Angle in degrees (-180 to 180)
 */
export function calculateAngleFromHorizontal(dx, dy) {
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  return Math.round(angle * 10) / 10; // Round to 1 decimal place
}

/**
 * Reconstructs 3D vessel directions from two angiographic projections
 * @param {Object} projection1 - First projection data
 * @param {Object} projection2 - Second projection data
 * @returns {Object} Reconstructed 3D directions for both vessels
 */
export function reconstruct3DVesselDirections(projection1, projection2) {
  const { points: points1, raoLao: rao1, cranialCaudal: cc1, imageWidth: w1, imageHeight: h1 } = projection1;
  const { points: points2, raoLao: rao2, cranialCaudal: cc2, imageWidth: w2, imageHeight: h2 } = projection2;
  
  // Get rotation matrices for both projections
  const rotation1 = projectionAnglesToRotationMatrix(rao1, cc1);
  const rotation2 = projectionAnglesToRotationMatrix(rao2, cc2);
  
  // Calculate 3D directions for vessel 1 from both projections
  const vessel1Dir1 = imageCoordinatesTo3DDirection(
    points1.vessel1.start.x, points1.vessel1.start.y,
    points1.vessel1.end.x, points1.vessel1.end.y,
    w1, h1, rotation1
  );
  
  const vessel1Dir2 = imageCoordinatesTo3DDirection(
    points2.vessel1.start.x, points2.vessel1.start.y,
    points2.vessel1.end.x, points2.vessel1.end.y,
    w2, h2, rotation2
  );
  
  // Calculate 3D directions for vessel 2 from both projections
  const vessel2Dir1 = imageCoordinatesTo3DDirection(
    points1.vessel2.start.x, points1.vessel2.start.y,
    points1.vessel2.end.x, points1.vessel2.end.y,
    w1, h1, rotation1
  );
  
  const vessel2Dir2 = imageCoordinatesTo3DDirection(
    points2.vessel2.start.x, points2.vessel2.start.y,
    points2.vessel2.end.x, points2.vessel2.end.y,
    w2, h2, rotation2
  );
  
  // Average the directions from both projections for better accuracy
  const vessel1Direction = [
    (vessel1Dir1[0] + vessel1Dir2[0]) / 2,
    (vessel1Dir1[1] + vessel1Dir2[1]) / 2,
    (vessel1Dir1[2] + vessel1Dir2[2]) / 2
  ];
  
  const vessel2Direction = [
    (vessel2Dir1[0] + vessel2Dir2[0]) / 2,
    (vessel2Dir1[1] + vessel2Dir2[1]) / 2,
    (vessel2Dir1[2] + vessel2Dir2[2]) / 2
  ];
  
  // Normalize the averaged directions
  const normalizeVector = (vec) => {
    const length = Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2]);
    return length > 0 ? [vec[0] / length, vec[1] / length, vec[2] / length] : [0, 0, 0];
  };
  
  return {
    vessel1: normalizeVector(vessel1Direction),
    vessel2: normalizeVector(vessel2Direction)
  };
}

/**
 * Matrix multiplication: matrix × vector
 * @param {Array} matrix - 3x3 matrix
 * @param {Array} vector - 3D vector
 * @returns {Array} Result vector
 */
function multiplyMatrixVector(matrix, vector) {
  return [
    matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2],
    matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2],
    matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2]
  ];
}

/**
 * Transposes a 3x3 matrix
 * @param {Array} matrix - 3x3 matrix
 * @returns {Array} Transposed matrix
 */
function transposeMatrix3x3(matrix) {
  return [
    [matrix[0][0], matrix[1][0], matrix[2][0]],
    [matrix[0][1], matrix[1][1], matrix[2][1]],
    [matrix[0][2], matrix[1][2], matrix[2][2]]
  ];
}
