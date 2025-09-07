// Unit tests for FIFO allocation logic
import { jest } from '@jest/globals';

// Mock FIFO allocation function (extracted from your controller logic)
class FIFOAllocator {
  static allocateInventory(availableBatches, requestedQuantity) {
    const allocations = [];
    const batchUpdates = [];
    let remainingToAllocate = requestedQuantity;

    // Sort batches by purchase date (FIFO)
    const sortedBatches = [...availableBatches]
      .filter(batch => batch.remainingQuantity > 0)
      .sort((a, b) => new Date(a.purchaseDate) - new Date(b.purchaseDate));

    for (const batch of sortedBatches) {
      if (remainingToAllocate <= 0) break;

      const allocatedFromBatch = Math.min(remainingToAllocate, batch.remainingQuantity);
      
      allocations.push({
        batchId: batch._id,
        quantity: allocatedFromBatch,
        buyPrice: batch.buyPrice,
        batchNumber: batch.batchNumber
      });

      batchUpdates.push({
        batchId: batch._id,
        newRemainingQuantity: batch.remainingQuantity - allocatedFromBatch
      });

      remainingToAllocate -= allocatedFromBatch;
    }

    return {
      allocations,
      batchUpdates,
      totalAllocated: requestedQuantity - remainingToAllocate,
      fullyAllocated: remainingToAllocate === 0
    };
  }
}

describe('FIFO Allocation Logic', () => {
  let mockBatches;

  beforeEach(() => {
    mockBatches = [
      {
        _id: 'batch1',
        batchNumber: 'BATCH-20240101-001',
        buyPrice: 1000,
        remainingQuantity: 5,
        purchaseDate: '2024-01-01T00:00:00Z'
      },
      {
        _id: 'batch2',
        batchNumber: 'BATCH-20240115-002',
        buyPrice: 1200,
        remainingQuantity: 5,
        purchaseDate: '2024-01-15T00:00:00Z'
      },
      {
        _id: 'batch3',
        batchNumber: 'BATCH-20240201-003',
        buyPrice: 1100,
        remainingQuantity: 3,
        purchaseDate: '2024-02-01T00:00:00Z'
      }
    ];
  });

  describe('Basic FIFO Allocation', () => {
    test('should allocate from oldest batch first', () => {
      const result = FIFOAllocator.allocateInventory(mockBatches, 3);

      expect(result.fullyAllocated).toBe(true);
      expect(result.totalAllocated).toBe(3);
      expect(result.allocations).toHaveLength(1);
      expect(result.allocations[0]).toEqual({
        batchId: 'batch1',
        quantity: 3,
        buyPrice: 1000,
        batchNumber: 'BATCH-20240101-001'
      });
    });

    test('should span multiple batches when needed', () => {
      const result = FIFOAllocator.allocateInventory(mockBatches, 7);

      expect(result.fullyAllocated).toBe(true);
      expect(result.totalAllocated).toBe(7);
      expect(result.allocations).toHaveLength(2);
      
      // First allocation from oldest batch
      expect(result.allocations[0]).toEqual({
        batchId: 'batch1',
        quantity: 5,
        buyPrice: 1000,
        batchNumber: 'BATCH-20240101-001'
      });
      
      // Second allocation from next oldest batch
      expect(result.allocations[1]).toEqual({
        batchId: 'batch2',
        quantity: 2,
        buyPrice: 1200,
        batchNumber: 'BATCH-20240115-002'
      });
    });

    test('should handle exact batch quantity', () => {
      const result = FIFOAllocator.allocateInventory(mockBatches, 5);

      expect(result.fullyAllocated).toBe(true);
      expect(result.allocations).toHaveLength(1);
      expect(result.batchUpdates[0].newRemainingQuantity).toBe(0);
    });
  });

  describe('Insufficient Stock Scenarios', () => {
    test('should handle insufficient total stock', () => {
      const result = FIFOAllocator.allocateInventory(mockBatches, 20);

      expect(result.fullyAllocated).toBe(false);
      expect(result.totalAllocated).toBe(13); // 5 + 5 + 3
      expect(result.allocations).toHaveLength(3);
    });

    test('should handle empty batches', () => {
      const emptyBatches = mockBatches.map(batch => ({
        ...batch,
        remainingQuantity: 0
      }));

      const result = FIFOAllocator.allocateInventory(emptyBatches, 5);

      expect(result.fullyAllocated).toBe(false);
      expect(result.totalAllocated).toBe(0);
      expect(result.allocations).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero quantity request', () => {
      const result = FIFOAllocator.allocateInventory(mockBatches, 0);

      expect(result.fullyAllocated).toBe(true);
      expect(result.totalAllocated).toBe(0);
      expect(result.allocations).toHaveLength(0);
    });

    test('should handle single batch with partial allocation', () => {
      const singleBatch = [mockBatches[0]];
      const result = FIFOAllocator.allocateInventory(singleBatch, 3);

      expect(result.fullyAllocated).toBe(true);
      expect(result.batchUpdates[0].newRemainingQuantity).toBe(2);
    });

    test('should maintain FIFO order with same purchase dates', () => {
      const sameDateBatches = [
        {
          _id: 'batch_a',
          batchNumber: 'BATCH-A',
          buyPrice: 1000,
          remainingQuantity: 2,
          purchaseDate: '2024-01-01T00:00:00Z'
        },
        {
          _id: 'batch_b',
          batchNumber: 'BATCH-B',
          buyPrice: 1100,
          remainingQuantity: 3,
          purchaseDate: '2024-01-01T00:00:00Z'
        }
      ];

      const result = FIFOAllocator.allocateInventory(sameDateBatches, 4);

      expect(result.allocations).toHaveLength(2);
      expect(result.allocations[0].batchId).toBe('batch_a');
      expect(result.allocations[1].batchId).toBe('batch_b');
    });
  });

  describe('Batch Updates Validation', () => {
    test('should generate correct batch updates', () => {
      const result = FIFOAllocator.allocateInventory(mockBatches, 7);

      expect(result.batchUpdates).toHaveLength(2);
      expect(result.batchUpdates[0]).toEqual({
        batchId: 'batch1',
        newRemainingQuantity: 0
      });
      expect(result.batchUpdates[1]).toEqual({
        batchId: 'batch2',
        newRemainingQuantity: 3
      });
    });

    test('should not update untouched batches', () => {
      const result = FIFOAllocator.allocateInventory(mockBatches, 3);

      expect(result.batchUpdates).toHaveLength(1);
      expect(result.batchUpdates[0].batchId).toBe('batch1');
    });
  });
});