const request = require('supertest');
const User = require('../models/User');
const {
    app,
    authHeader,
    connectTestDb,
    clearTestDb,
    disconnectTestDb,
    createUser,
} = require('./testUtils');

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe('user role management API', () => {
    test('admin lists users with roles', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@example.com', name: 'Admin User' });
        const student = await createUser({ role: 'student', email: 'student@example.com', name: 'Student User' });

        const response = await request(app)
            .get('/api/user/roles')
            .set('Authorization', authHeader(admin));

        expect(response.status).toBe(200);
        expect(response.body.users).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    _id: admin._id.toString(),
                    name: 'Admin User',
                    email: 'admin@example.com',
                    role: 'admin',
                }),
                expect.objectContaining({
                    _id: student._id.toString(),
                    name: 'Student User',
                    email: 'student@example.com',
                    role: 'student',
                }),
            ])
        );
        expect(response.body.users[0]).not.toHaveProperty('password');
    });

    test('admin updates another user role', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@example.com' });
        const student = await createUser({ role: 'student', email: 'student@example.com' });

        const response = await request(app)
            .patch(`/api/user/roles/${student._id}`)
            .set('Authorization', authHeader(admin))
            .send({ role: 'teacher' });

        expect(response.status).toBe(200);
        expect(response.body.user).toEqual(expect.objectContaining({
            _id: student._id.toString(),
            role: 'teacher',
        }));
        await expect(User.findById(student._id).then(user => user.role)).resolves.toBe('teacher');
    });

    test('student cannot list or update roles', async () => {
        const student = await createUser({ role: 'student', email: 'student@example.com' });
        const otherStudent = await createUser({ role: 'student', email: 'other@example.com' });

        await request(app)
            .get('/api/user/roles')
            .set('Authorization', authHeader(student))
            .expect(403);

        await request(app)
            .patch(`/api/user/roles/${otherStudent._id}`)
            .set('Authorization', authHeader(student))
            .send({ role: 'teacher' })
            .expect(403);
    });

    test('admin cannot remove own admin role', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@example.com' });

        const response = await request(app)
            .patch(`/api/user/roles/${admin._id}`)
            .set('Authorization', authHeader(admin))
            .send({ role: 'student' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('You cannot remove your own admin role');
        await expect(User.findById(admin._id).then(user => user.role)).resolves.toBe('admin');
    });
});
