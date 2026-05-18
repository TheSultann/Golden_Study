jest.mock('../redis-client', () => ({
    isOpen: true,
    del: jest.fn(async () => 1),
    scanIterator: jest.fn(),
}));

const redisClient = require('../redis-client');
const { clearCacheByPattern } = require('../middleware/cache.middleware');

describe('cache middleware helpers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        redisClient.isOpen = true;
    });

    test('clearCacheByPattern deletes all keys returned by scan', async () => {
        redisClient.scanIterator.mockImplementation(async function* () {
            yield 'cache:user-a:GET:/api/stats/student?';
            yield 'cache:user-b:GET:/api/stats/group/123?';
        });

        const deletedCount = await clearCacheByPattern('cache:*:GET:/api/stats*');

        expect(redisClient.scanIterator).toHaveBeenCalledWith({
            MATCH: 'cache:*:GET:/api/stats*',
            COUNT: 100,
        });
        expect(redisClient.del).toHaveBeenCalledWith([
            'cache:user-a:GET:/api/stats/student?',
            'cache:user-b:GET:/api/stats/group/123?',
        ]);
        expect(deletedCount).toBe(2);
    });

    test('clearCacheByPattern is a no-op when redis is closed', async () => {
        redisClient.isOpen = false;

        const deletedCount = await clearCacheByPattern('cache:*');

        expect(redisClient.scanIterator).not.toHaveBeenCalled();
        expect(redisClient.del).not.toHaveBeenCalled();
        expect(deletedCount).toBe(0);
    });
});
