// ====================================================
// MODULE: SpatialGrid.ts — PHÂN VÙNG KHÔNG GIAN 2D O(1)
// ====================================================

export class SpatialGrid {
  constructor(cellSize = 30) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  _getKey(cellX, cellZ) {
    return cellX + '_' + cellZ;
  }

  _getCellCoord(val) {
    return Math.floor(val / this.cellSize);
  }

  insert(item, x, z) {
    const cx = this._getCellCoord(x);
    const cz = this._getCellCoord(z);
    const key = this._getKey(cx, cz);
    if (!this.grid.has(key)) {
      this.grid.set(key, new Set());
    }
    this.grid.get(key).add(item);
    item._gridKey = key;
    item._gridX = x;
    item._gridZ = z;
  }

  remove(item) {
    if (item._gridKey && this.grid.has(item._gridKey)) {
      this.grid.get(item._gridKey).delete(item);
      item._gridKey = null;
    }
  }

  update(item, newX, newZ) {
    const cx = this._getCellCoord(newX);
    const cz = this._getCellCoord(newZ);
    const newKey = this._getKey(cx, cz);
    if (item._gridKey !== newKey) {
      this.remove(item);
      this.insert(item, newX, newZ);
    } else {
      item._gridX = newX;
      item._gridZ = newZ;
    }
  }

  getNearby(x, z, radius) {
    const minCx = this._getCellCoord(x - radius);
    const maxCx = this._getCellCoord(x + radius);
    const minCz = this._getCellCoord(z - radius);
    const maxCz = this._getCellCoord(z + radius);
    const radSq = radius * radius;
    const results = [];

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = this._getKey(cx, cz);
        const cell = this.grid.get(key);
        if (cell) {
          for (const item of cell) {
            const dx = item._gridX - x;
            const dz = item._gridZ - z;
            if (dx * dx + dz * dz <= radSq) {
              results.push(item);
            }
          }
        }
      }
    }
    return results;
  }
}

export const worldSpatialGrid = new SpatialGrid(30);
