/**
 * 图片相似度比较工具
 * Image similarity comparison utilities for card validation
 * 
 * Uses perceptual hashing (pHash) algorithm to compare card images
 * with pre-computed hashes for valid/invalid card states
 */

const sharp = require('sharp');

/**
 * Device-specific configuration for image comparison
 * Contains pre-computed perceptual hashes for known card states
 * 
 * Structure:
 * - hashSize: Size of the hash grid (16x16 or 24x24)
 * - maxDistance: Maximum Hamming distance threshold for match
 * - hashes: Array of known valid/invalid card image hashes
 */
const diff = {
  mobile: {
    hashSize: 16,
    maxDistance: 10n,
    hashes: [
      [
        18446482250388209655n,
        18444773723101855716n,
        18438018078845501392n,
        18410996206199176960n
      ],
      [
        17294376727123853312n,
        1152921504606846976n,
        0n,
        32769n
      ]
    ]
  },
  desktop: {
    hashSize: 24,
    maxDistance: 23n,
    hashes: [
      [
        9223373677532315136n,
        35465848038621184n,
        0n,
        0n,
        0n,
        0n,
        0n,
        0n,
        8388609n
      ],
      [
        18446744073239764958n,
        18410750185113116671n,
        18442240473662750704n,
        18446730879568052223n,
        13979172697897148671n,
        18374967951443885592n,
        18446182223204909052n,
        72053200286138623n,
        18158795138191587328n
      ]
    ]
  }
};

/**
 * Generate perceptual hash for an image
 * 
 * Algorithm:
 * 1. Resize image to hashSize x hashSize
 * 2. Convert to grayscale
 * 3. Calculate average pixel value
 * 4. Generate hash: bit = 1 if pixel > avg, else 0
 * 5. Pack bits into BigInt array (64 bits per element)
 * 
 * @param {Buffer} input - Image buffer
 * @param {number} hashSize - Size of hash grid (16 or 24)
 * @returns {Promise<Array<BigInt>>} Perceptual hash as BigInt array
 */
async function generateHash(input, hashSize = 16) {
  const buffer = await sharp(input)
    .resize(hashSize, hashSize, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();

  let total = 0;
  for (let i = 0; i < buffer.length; i++) {
    total += buffer[i];
  }
  const avg = total / buffer.length;

  const bits = hashSize * hashSize;
  const bigintCount = Math.ceil(bits / 64);
  const hash = Array(bigintCount).fill(0n);

  for (let i = 0; i < buffer.length; i++) {
    const bit = buffer[i] > avg ? 1n : 0n;
    const idx = Math.floor(i / 64);
    const pos = BigInt(63 - (i % 64));
    hash[idx] = hash[idx] | (bit << pos);
  }

  return hash;
}

/**
 * Calculate Hamming distance between two hashes
 * Counts number of differing bits using XOR and bit counting
 * 
 * @param {Array<BigInt>} hash1 - First hash
 * @param {Array<BigInt>} hash2 - Second hash
 * @returns {number} Hamming distance (number of different bits)
 */
function hammingDistance(hash1, hash2) {
  let dist = 0;
  for (let i = 0; i < Math.min(hash1.length, hash2.length); i++) {
    let x = hash1[i] ^ hash2[i];
    while (x) {
      dist++;
      x &= x - 1n; // Clear lowest set bit
    }
  }
  return dist;
}

/**
 * Compare card image buffer with pre-computed hashes for card validation
 * 
 * Used in CheckliveOperations to validate card images after color validation:
 * - Detects if card display matches expected valid/invalid patterns
 * - Compares against device-specific (mobile/desktop) hash templates
 * - Returns validation result with distances to all known patterns
 * 
 * @param {Buffer} buffer - Card image screenshot buffer
 * @param {string} device - Device type ('mobile' or 'desktop')
 * @returns {Promise<Object>} Validation result
 *   - valid: 0 if match found (within maxDistance), 1 if no match
 *   - distances: Array of Hamming distances to each template
 */
async function utilBufferSimilar(buffer, device) {
  const distances = [];
  const newHash = await generateHash(buffer, diff[device].hashSize);
  const targetHashes = diff[device].hashes;
  const maxDist = Number(diff[device].maxDistance);

  for (const existingHash of targetHashes) {
    const dist = hammingDistance(newHash, existingHash);
    distances.push(dist);
    
    if (dist <= maxDist) {
      return { valid: 0, distances };
    }
  }

  return { valid: 1, distances };
}

module.exports = {
  generateHash,
  utilBufferSimilar,
  // Export device templates for reference
  DEVICE_TEMPLATES: diff
};
