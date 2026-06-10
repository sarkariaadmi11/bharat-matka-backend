describe('revertBatch service (revert-all & bid history)', () => {
  let service;
  let mocks;
  let mockMongoSession;

  const mockSession = {
    _id: 'session-1',
    marketId: 'market-1',
    resultRevision: 3,
    openResultDeclared: true,
    currentResult: { openPana: '128', closePana: null },
  };

  const mockBet = {
    _id: 'bet-1',
    userId: { _id: 'user-1', username: 'alice' },
    sessionId: 'session-1',
    amount: 1000,
    betMode: 'open',
    selection: '123',
    status: 'pending',
    gameTypeCodeSnapshot: 'PANA',
    createdAt: new Date('2026-04-24T09:00:00.000Z'),
  };

  beforeEach(() => {
    jest.resetModules();

    mockMongoSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };

    mocks = {
      betRepository: {
        countEligibleForRevert: jest.fn(),
        findChunkForRevert: jest.fn(),
        findBySessionWithUser: jest.fn(),
        atomicMarkReverted: jest.fn(),
      },
      revertBatchRepository: {
        findByIdempotencyKey: jest.fn(),
        findActiveBySession: jest.fn(),
        findById: jest.fn(),
        create: jest.fn(),
        markProcessing: jest.fn(),
        saveChunkProgress: jest.fn(),
        markCompleted: jest.fn(),
        markFailed: jest.fn(),
        findBySession: jest.fn(),
      },
      gameSessionRepository: {
        findById: jest.fn(),
        findLeanById: jest.fn(),
      },
      walletRepository: {
        releaseBetExposure: jest.fn(),
      },
      transactionRepository: {
        recordRefund: jest.fn(),
      },
      marketRepository: {
        findLeanById: jest.fn(),
      },
      EventTaskRegistry: {
        scheduleTask: jest.fn(),
      },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      mongoose: {
        startSession: jest.fn().mockResolvedValue(mockMongoSession),
      },
    };

    jest.doMock('mongoose', () => mocks.mongoose);
    jest.doMock('@utils/logger', () => mocks.logger);
    jest.doMock('@infra/database', () => ({
      RepositoryFactory: {
        getRepository: (name) => {
          const repoMap = {
            Bet: mocks.betRepository,
            RevertBatch: mocks.revertBatchRepository,
            GameSession: mocks.gameSessionRepository,
            Wallet: mocks.walletRepository,
            Transaction: mocks.transactionRepository,
            Market: mocks.marketRepository,
          };
          return repoMap[name];
        },
      },
    }));
    jest.doMock('@infra/queue/eventTaskRegistry', () => mocks.EventTaskRegistry);

    service = require('@modules/admin/results/revertBatch.service');
  });

  describe('getBidHistory', () => {
    test('returns paginated bid items with mapped fields', async () => {
      mocks.gameSessionRepository.findLeanById.mockResolvedValue(mockSession);
      mocks.betRepository.findBySessionWithUser.mockResolvedValue({
        items: [mockBet],
        total: 1,
      });

      const result = await service.getBidHistory('session-1', 1, 20);

      expect(mocks.gameSessionRepository.findLeanById).toHaveBeenCalledWith('session-1');
      expect(mocks.betRepository.findBySessionWithUser).toHaveBeenCalledWith('session-1', 1, 20);
      expect(result.items[0]).toMatchObject({
        betId: 'bet-1',
        username: 'alice',
        gameType: 'PANA',
        points: 1000,
        betMode: 'open',
      });
      expect(result.pagination.total).toBe(1);
    });

    test('throws NotFoundError for missing session', async () => {
      mocks.gameSessionRepository.findLeanById.mockResolvedValue(null);

      await expect(service.getBidHistory('nonexistent', 1, 20))
        .rejects.toThrow('Session not found');
    });
  });

  describe('createRevertAllBatch', () => {
    test('creates batch and counts all eligible bets regardless of betMode', async () => {
      mocks.gameSessionRepository.findById.mockResolvedValue(mockSession);
      mocks.revertBatchRepository.findActiveBySession.mockResolvedValue(null);
      mocks.betRepository.countEligibleForRevert.mockResolvedValue(10);
      mocks.revertBatchRepository.findByIdempotencyKey.mockResolvedValue(null);
      mocks.revertBatchRepository.create.mockResolvedValue({
        _id: 'batch-1',
        sessionId: 'session-1',
        status: 'pending',
        matchedCount: 10,
        eligibleCount: 10,
      });

      const { replayed } = await service.createRevertAllBatch({
        sessionId: 'session-1',
        reason: 'Full session revert',
        idempotencyKey: 'key-12345678',
        adminUserId: 'admin-1',
      });

      expect(mocks.gameSessionRepository.findById).toHaveBeenCalledWith('session-1');
      expect(mocks.revertBatchRepository.findActiveBySession).toHaveBeenCalledWith('session-1');
      expect(mocks.betRepository.countEligibleForRevert).toHaveBeenCalledWith('session-1', null);
      expect(mocks.revertBatchRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-1',
          status: 'pending',
        }),
      );
      expect(replayed).toBe(false);
    });

    test('rejects when no eligible bets exist', async () => {
      mocks.gameSessionRepository.findById.mockResolvedValue(mockSession);
      mocks.revertBatchRepository.findActiveBySession.mockResolvedValue(null);
      mocks.betRepository.countEligibleForRevert.mockResolvedValue(0);

      await expect(service.createRevertAllBatch({
        sessionId: 'session-1',
        reason: 'Test',
        idempotencyKey: 'key-12345678',
        adminUserId: 'admin-1',
      })).rejects.toThrow('No eligible pending bets found');
    });

    test('rejects concurrent active batch', async () => {
      mocks.gameSessionRepository.findById.mockResolvedValue(mockSession);
      mocks.revertBatchRepository.findActiveBySession.mockResolvedValue({ _id: 'existing-batch' });

      await expect(service.createRevertAllBatch({
        sessionId: 'session-1',
        reason: 'Test',
        idempotencyKey: 'key-12345678',
        adminUserId: 'admin-1',
      })).rejects.toThrow('already active');
    });

    test('rejects idempotent replay with different payload (hash mismatch)', async () => {
      const differentHash = 'a'.repeat(64);
      mocks.gameSessionRepository.findById.mockResolvedValue(mockSession);
      mocks.revertBatchRepository.findActiveBySession.mockResolvedValue(null);
      mocks.betRepository.countEligibleForRevert.mockResolvedValue(10);
      mocks.revertBatchRepository.findByIdempotencyKey.mockResolvedValue({
        _id: 'existing-batch',
        payloadHash: differentHash,
        status: 'completed',
      });

      await expect(service.createRevertAllBatch({
        sessionId: 'session-1',
        reason: 'Different reason',
        idempotencyKey: 'key-12345678',
        adminUserId: 'admin-1',
      })).rejects.toThrow('idempotencyKey was already used with a different revert batch payload');
    });

    test('handles idempotency with matching hash', async () => {
      const hash = require('crypto')
        .createHash('sha256')
        .update(JSON.stringify({ sessionId: 'session-1', reason: 'Test', note: '' }))
        .digest('hex');

      mocks.gameSessionRepository.findById.mockResolvedValue(mockSession);
      mocks.revertBatchRepository.findActiveBySession.mockResolvedValue(null);
      mocks.betRepository.countEligibleForRevert.mockResolvedValue(10);
      mocks.revertBatchRepository.findByIdempotencyKey.mockResolvedValue({
        _id: 'existing-batch',
        payloadHash: hash,
        status: 'pending',
        sessionId: 'session-1',
        reason: 'Test',
        note: null,
        idempotencyKey: 'key-12345678',
        requestedBy: 'admin-1',
        filters: {},
        resultRevisionObserved: 3,
        matchedCount: 10,
        eligibleCount: 10,
        processedCount: 0,
        refundedCount: 0,
        refundedAmount: 0,
        skippedCount: 0,
        failedCount: 0,
        lastProcessedCursor: null,
        startedAt: null,
        completedAt: null,
        failedAt: null,
        failureReason: null,
        createdAt: new Date(),
      });

      const { batch, replayed } = await service.createRevertAllBatch({
        sessionId: 'session-1',
        reason: 'Test',
        idempotencyKey: 'key-12345678',
        adminUserId: 'admin-1',
      });

      expect(replayed).toBe(true);
      expect(batch._id).toBe('existing-batch');
    });
  });

  describe('scheduleAsyncBatchProcessing', () => {
    test('schedules a PROCESS_REVERT_BATCH task with batchId payload', async () => {
      mocks.EventTaskRegistry.scheduleTask.mockResolvedValue({ _id: 'task-1' });

      await service.scheduleAsyncBatchProcessing('batch-1');

      expect(mocks.EventTaskRegistry.scheduleTask).toHaveBeenCalledWith({
        type: 'PROCESS_REVERT_BATCH',
        scheduledAt: expect.any(Date),
        payload: { batchId: 'batch-1' },
        priority: 2,
        maxAttempts: 3,
      });
    });
  });

  describe('createRevertAllBatch does not check result declaration', () => {
    test('creates batch even if results are already declared', async () => {
      mocks.gameSessionRepository.findById.mockResolvedValue({
        ...mockSession,
        openResultDeclared: true,
        currentResult: { ...mockSession.currentResult, closePana: '235' },
      });
      mocks.revertBatchRepository.findActiveBySession.mockResolvedValue(null);
      mocks.betRepository.countEligibleForRevert.mockResolvedValue(5);
      mocks.revertBatchRepository.findByIdempotencyKey.mockResolvedValue(null);
      mocks.revertBatchRepository.create.mockResolvedValue({
        _id: 'batch-1',
        status: 'pending',
      });

      const { batch } = await service.createRevertAllBatch({
        sessionId: 'session-1',
        reason: 'Full revert',
        idempotencyKey: 'key-full-12345678',
        adminUserId: 'admin-1',
      });

      expect(batch).toBeDefined();
    });
  });
});
