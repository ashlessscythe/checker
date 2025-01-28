/**
 * Implements enhanced barcode verification with multiple checks
 * @param barcode - The barcode to verify
 * @returns boolean indicating if barcode is valid
 */
export function verifyBarcode(barcode: string): boolean {
  // Check if barcode is exactly 20 characters
  if (barcode.length !== 20) {
    return false;
  }

  // Check if barcode contains only valid characters (alphanumeric excluding similar looking chars)
  // Excluded: 0/O, 1/I/l, 2/Z, 5/S, 8/B
  const validChars = "346789ACDEFGHJKLMNPQRTUVWXY";
  if (!new RegExp(`^[${validChars}]+$`).test(barcode)) {
    return false;
  }

  // Convert characters to numbers for Luhn and Damm algorithms
  const charToNum = Object.fromEntries(
    validChars.split("").map((char, i) => [char, i])
  );

  // Check Luhn
  if (!verifyLuhn(barcode, charToNum)) {
    return false;
  }

  // Check Damm
  if (!verifyDamm(barcode, charToNum)) {
    return false;
  }

  // Check for potential off-by-one errors using character distance
  return !hasOffByOneError(barcode, validChars);
}

/**
 * Verifies barcode using Luhn algorithm
 */
function verifyLuhn(
  barcode: string,
  charToNum: Record<string, number>
): boolean {
  let sum = 0;
  let isEven = false;

  // Loop from right to left
  for (let i = barcode.length - 1; i >= 0; i--) {
    let num = charToNum[barcode[i]];

    if (isEven) {
      num *= 2;
      if (num > 9) {
        num -= 9;
      }
    }

    sum += num;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Verifies barcode using Damm algorithm to catch transpositions
 */
function verifyDamm(
  barcode: string,
  charToNum: Record<string, number>
): boolean {
  // Damm algorithm matrix
  const matrix = [
    [0, 3, 1, 7, 5, 9, 8, 6, 4, 2],
    [7, 0, 9, 2, 1, 5, 4, 8, 6, 3],
    [4, 2, 0, 6, 8, 7, 1, 3, 5, 9],
    [1, 7, 5, 0, 9, 8, 3, 4, 2, 6],
    [6, 1, 2, 3, 0, 4, 5, 9, 7, 8],
    [3, 6, 7, 4, 2, 0, 9, 5, 8, 1],
    [5, 8, 6, 9, 7, 2, 0, 1, 3, 4],
    [8, 9, 4, 5, 3, 6, 2, 0, 1, 7],
    [9, 4, 3, 8, 6, 1, 7, 2, 0, 5],
    [2, 5, 8, 1, 4, 3, 6, 7, 9, 0],
  ];

  let interim = 0;
  for (let i = 0; i < barcode.length; i++) {
    const num = charToNum[barcode[i]] % 10;
    interim = matrix[interim][num];
  }

  return interim === 0;
}

/**
 * Checks for potential off-by-one errors by calculating character distances
 */
function hasOffByOneError(barcode: string, validChars: string): boolean {
  for (let i = 0; i < barcode.length - 1; i++) {
    const char1 = barcode[i];
    const char2 = barcode[i + 1];
    const idx1 = validChars.indexOf(char1);
    const idx2 = validChars.indexOf(char2);

    // Check if characters are adjacent in the valid character set
    if (Math.abs(idx1 - idx2) === 1) {
      return true;
    }
  }
  return false;
}

/**
 * Generates a valid 20-character barcode that passes all verifications
 * @returns string - A valid 20-character barcode
 */
export function generateValidBarcode(): string {
  const validChars = "346789ACDEFGHJKLMNPQRTUVWXY";
  const charToNum = Object.fromEntries(
    validChars.split("").map((char, i) => [char, i])
  );

  while (true) {
    // Generate first 18 characters randomly
    let barcode = "";
    for (let i = 0; i < 18; i++) {
      const randomIndex = Math.floor(Math.random() * validChars.length);
      barcode += validChars[randomIndex];
    }

    // Try all possible combinations for last 2 check digits
    for (let i = 0; i < validChars.length; i++) {
      for (let j = 0; j < validChars.length; j++) {
        const candidate = barcode + validChars[i] + validChars[j];
        if (verifyBarcode(candidate)) {
          return candidate;
        }
      }
    }
  }
}
