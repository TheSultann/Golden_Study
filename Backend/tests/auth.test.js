const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
    app,
    connectTestDb,
    clearTestDb,
    disconnectTestDb,
    createUser,
} = require('./testUtils');

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe('auth API', () => {
    test('login issues a token that lasts about 30 days by default', async () => {
        const password = 'StrongPass123!';
        await createUser({
            email: 'admin@example.com',
            password: await bcrypt.hash(password, 12),
            role: 'admin',
        });

        const response = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin@example.com', password })
            .expect(200);

        const decoded = jwt.decode(response.body.token);
        expect(decoded.role).toBe('admin');
        expect(decoded.exp - decoded.iat).toBeGreaterThanOrEqual(60 * 60 * 24 * 29);
        expect(decoded.exp - decoded.iat).toBeLessThanOrEqual(60 * 60 * 24 * 30);
    });
});
