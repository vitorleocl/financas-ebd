/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface QRCodeIconProps {
  value: string;
  size?: number;
}

/**
 * Generates an elegant, deterministic pseudocode QR pattern
 * using SVG based on a hash of the transaction string.
 */
export default function QRCodeIcon({ value, size = 100 }: QRCodeIconProps) {
  // Simple deterministic hash function
  const getHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };

  const hash = getHash(value);
  const matrixSize = 21; // 21x21 grid (QR Version 1 standard)
  
  // Create grid cells
  const cells: boolean[][] = [];
  
  // Fill cells deterministically based on hash
  for (let r = 0; r < matrixSize; r++) {
    cells[r] = [];
    for (let c = 0; c < matrixSize; c++) {
      // Draw standard QR finder patterns at top-left, top-right, bottom-left
      const isTopLeftFinder = r < 7 && c < 7;
      const isTopRightFinder = r < 7 && c >= matrixSize - 7;
      const isBottomLeftFinder = r >= matrixSize - 7 && c < 7;
      
      if (isTopLeftFinder || isTopRightFinder || isBottomLeftFinder) {
        // Build the classic concentric squares of finders:
        // Outer box (7x7), inner empty space (5x5 margin), center box (3x3)
        const localR = r < 7 ? r : r >= matrixSize - 7 ? r - (matrixSize - 7) : r;
        const localC = c < 7 ? c : c >= matrixSize - 7 ? c - (matrixSize - 7) : c;
        
        const isOuterBorder = localR === 0 || localR === 6 || localC === 0 || localC === 6;
        const isInnerFill = localR >= 2 && localR <= 4 && localC >= 2 && localC <= 4;
        cells[r][c] = isOuterBorder || isInnerFill;
      } else {
        // Pseudo-random dark/light module based on hashes and coordinate mixing
        const wave = Math.sin(r * 0.4) * Math.cos(c * 0.7);
        const cellHash = Math.abs(Math.floor((hash ^ (r * 13) ^ (c * 37)) * 1.5 + wave * 1000));
        cells[r][c] = cellHash % 2 === 0;
      }
    }
  }

  const cellSize = size / matrixSize;

  return (
    <div 
      className="bg-white p-2 rounded-lg border border-gray-200 inline-block"
      style={{ width: size + 16, height: size + 16 }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="block"
      >
        {cells.map((row, r) =>
          row.map((active, c) => (
            active ? (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize + 0.5} // slightly wider to avoid white lines in some viewers
                height={cellSize + 0.5}
                className="fill-slate-900"
              />
            ) : null
          ))
        )}
      </svg>
    </div>
  );
}
