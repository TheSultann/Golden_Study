const request = require('supertest');
const {
    app,
    authHeader,
    connectTestDb,
    clearTestDb,
    disconnectTestDb,
    createUser,
    createGroup,
} = require('./testUtils');

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe('GET /api/groups/unassigned - cache invalidation on registration', () => {
    test('newly registered student appears in unassigned list without waiting for cache expiry', async () => {
        const teacher = await createUser({ role: 'teacher', email: 'teacher@example.com', name: 'Teacher' });
        await createGroup({ teacher, name: 'Group A' });

        // First call — should be empty (no students yet)
        const res1 = await request(app)
            .get('/api/groups/unassigned')
            .set('Authorization', authHeader(teacher));

        expect(res1.status).toBe(200);
        expect(res1.body).toHaveLength(0);

        // Register a new student via the auth endpoint
        const regRes = await request(app)
            .post('/api/auth/register')
            .send({ name: 'New Student', email: 'newstudent@example.com', password: 'password123' });

        expect(regRes.status).toBe(201);

        // Second call — new student must appear immediately (cache was invalidated)
        const res2 = await request(app)
            .get('/api/groups/unassigned')
            .set('Authorization', authHeader(teacher));

        expect(res2.status).toBe(200);
        expect(res2.body).toHaveLength(1);
        expect(res2.body[0]).toMatchObject({
            name: 'New Student',
            email: 'newstudent@example.com',
            role: 'student',
        });
    });

    test('student assigned to a group does not appear in unassigned list', async () => {
        const teacher = await createUser({ role: 'teacher', email: 'teacher@example.com', name: 'Teacher' });
        const student = await createUser({ role: 'student', email: 'student@example.com', name: 'Student' });
        const group = await createGroup({ teacher, name: 'Group B', students: [student] });

        // Update user's group field to match assignment
        student.group = group._id;
        await student.save();

        const res = await request(app)
            .get('/api/groups/unassigned')
            .set('Authorization', authHeader(teacher));

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(0);
    });
});
