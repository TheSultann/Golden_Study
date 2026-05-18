const request = require('supertest');
const TuitionPayment = require('../models/TuitionPayment');
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

describe('GET /api/finance/my-payments (student endpoint)', () => {
    test('student sees only their own payments', async () => {
        const teacher = await createUser({ role: 'teacher', email: 'teacher@test.com' });
        const studentA = await createUser({ role: 'student', email: 'a@test.com' });
        const studentB = await createUser({ role: 'student', email: 'b@test.com' });
        const group = await createGroup({ teacher, students: [studentA, studentB] });

        await TuitionPayment.create([
            { student: studentA._id, group: group._id, billingPeriod: '2026-05', amountDue: 500000 },
            { student: studentA._id, group: group._id, billingPeriod: '2026-04', amountDue: 500000, status: 'paid', amountPaid: 500000 },
            { student: studentB._id, group: group._id, billingPeriod: '2026-05', amountDue: 600000 },
        ]);

        const res = await request(app)
            .get('/api/finance/my-payments')
            .set('Authorization', authHeader(studentA));

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(res.body.every(p => p.billingPeriod)).toBe(true);
        expect(res.body.every(p => p.amountDue === 500000)).toBe(true);
    });

    test('student sees correct amounts and statuses', async () => {
        const teacher = await createUser({ role: 'teacher', email: 'teacher@test.com' });
        const student = await createUser({ role: 'student', email: 'student@test.com' });
        const group = await createGroup({ teacher, students: [student] });

        await TuitionPayment.create({
            student: student._id, group: group._id,
            billingPeriod: '2026-05', amountDue: 750000, status: 'paid', amountPaid: 750000
        });

        const res = await request(app)
            .get('/api/finance/my-payments')
            .set('Authorization', authHeader(student));

        expect(res.status).toBe(200);
        expect(res.body[0].amountDue).toBe(750000);
        expect(res.body[0].amountPaid).toBe(750000);
        expect(res.body[0].status).toBe('paid');
        expect(res.body[0].groupName).toBeDefined();
    });

    test('admin cannot access student payments endpoint', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@test.com' });

        const res = await request(app)
            .get('/api/finance/my-payments')
            .set('Authorization', authHeader(admin));

        expect(res.status).toBe(403);
    });

    test('teacher cannot access student payments endpoint', async () => {
        const teacher = await createUser({ role: 'teacher', email: 'teacher@test.com' });

        const res = await request(app)
            .get('/api/finance/my-payments')
            .set('Authorization', authHeader(teacher));

        expect(res.status).toBe(403);
    });

    test('student with no payments gets empty array', async () => {
        const student = await createUser({ role: 'student', email: 'new@test.com' });

        const res = await request(app)
            .get('/api/finance/my-payments')
            .set('Authorization', authHeader(student));

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(0);
    });
});

describe('GET /api/finance/last-amounts', () => {
    test('returns last amount per group', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@test.com' });
        const teacher = await createUser({ role: 'teacher', email: 'teacher@test.com' });
        const student = await createUser({ role: 'student', email: 'student@test.com' });
        const group = await createGroup({ teacher, students: [student] });

        await TuitionPayment.create([
            { student: student._id, group: group._id, billingPeriod: '2026-04', amountDue: 400000 },
            { student: student._id, group: group._id, billingPeriod: '2026-05', amountDue: 500000 },
        ]);

        const res = await request(app)
            .get('/api/finance/last-amounts')
            .set('Authorization', authHeader(admin));

        expect(res.status).toBe(200);
        expect(res.body[group._id.toString()]).toBe(500000);
    });

    test('student cannot access last-amounts', async () => {
        const student = await createUser({ role: 'student', email: 'student@test.com' });

        const res = await request(app)
            .get('/api/finance/last-amounts')
            .set('Authorization', authHeader(student));

        expect(res.status).toBe(403);
    });
});

describe('GET /api/finance (admin list with pagination)', () => {
    test('returns paginated payments for period', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@test.com' });
        const teacher = await createUser({ role: 'teacher', email: 'teacher@test.com' });
        const student = await createUser({ role: 'student', email: 'student@test.com' });
        const group = await createGroup({ teacher, students: [student] });

        await TuitionPayment.create({
            student: student._id, group: group._id,
            billingPeriod: '2026-05', amountDue: 500000
        });

        const res = await request(app)
            .get('/api/finance?periodStart=2026-05&periodEnd=2026-05')
            .set('Authorization', authHeader(admin));

        expect(res.status).toBe(200);
        expect(res.body.payments).toHaveLength(1);
        expect(res.body.total).toBe(1);
        expect(res.body.page).toBe(1);
        expect(res.body.totalPages).toBe(1);
    });

    test('filters by group', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@test.com' });
        const teacher = await createUser({ role: 'teacher', email: 'teacher@test.com' });
        const studentA = await createUser({ role: 'student', email: 'a@test.com' });
        const studentB = await createUser({ role: 'student', email: 'b@test.com' });
        const groupA = await createGroup({ teacher, students: [studentA] });
        const groupB = await createGroup({ teacher, name: 'Group B', students: [studentB] });
        await studentA.updateOne({ group: groupA._id });
        await studentB.updateOne({ group: groupB._id });

        await TuitionPayment.create([
            { student: studentA._id, group: groupA._id, billingPeriod: '2026-05', amountDue: 500000 },
            { student: studentB._id, group: groupB._id, billingPeriod: '2026-05', amountDue: 600000 },
        ]);

        const res = await request(app)
            .get(`/api/finance?periodStart=2026-05&periodEnd=2026-05&groupId=${groupA._id}`)
            .set('Authorization', authHeader(admin));

        expect(res.status).toBe(200);
        expect(res.body.payments).toHaveLength(1);
        expect(res.body.payments[0].amountDue).toBe(500000);
    });

    test('returns empty for period with no invoices', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@test.com' });

        const res = await request(app)
            .get('/api/finance?periodStart=2030-01&periodEnd=2030-01')
            .set('Authorization', authHeader(admin));

        expect(res.status).toBe(200);
        expect(res.body.payments).toHaveLength(0);
        expect(res.body.total).toBe(0);
    });

    test('requires periodStart and periodEnd', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@test.com' });

        const res = await request(app)
            .get('/api/finance')
            .set('Authorization', authHeader(admin));

        expect(res.status).toBe(400);
    });

    test('student cannot access admin finance list', async () => {
        const student = await createUser({ role: 'student', email: 'student@test.com' });

        const res = await request(app)
            .get('/api/finance?periodStart=2026-05&periodEnd=2026-05')
            .set('Authorization', authHeader(student));

        expect(res.status).toBe(403);
    });
});

describe('finance amounts integrity', () => {
    test('amountPaid equals amountDue after marking paid', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@test.com' });
        const teacher = await createUser({ role: 'teacher', email: 'teacher@test.com' });
        const student = await createUser({ role: 'student', email: 'student@test.com' });
        const group = await createGroup({ teacher, students: [student] });

        const payment = await TuitionPayment.create({
            student: student._id, group: group._id,
            billingPeriod: '2026-06', amountDue: 1500000
        });

        const res = await request(app)
            .patch(`/api/finance/${payment._id}/pay`)
            .set('Authorization', authHeader(admin));

        expect(res.body.amountPaid).toBe(1500000);
        expect(res.body.amountDue).toBe(1500000);
        expect(res.body.status).toBe('paid');

        // Verify in DB
        const dbPayment = await TuitionPayment.findById(payment._id).lean();
        expect(dbPayment.amountPaid).toBe(1500000);
    });

    test('large amounts are stored correctly (10M+ UZS)', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@test.com' });
        const teacher = await createUser({ role: 'teacher', email: 'teacher@test.com' });
        const student = await createUser({ role: 'student', email: 'student@test.com' });
        const group = await createGroup({ teacher, students: [student] });
        await student.updateOne({ group: group._id });

        const res = await request(app)
            .post('/api/finance/generate')
            .set('Authorization', authHeader(admin))
            .send({
                billingPeriod: '2026-07',
                groupAmounts: { [group._id.toString()]: 15000000 },
            });

        expect(res.status).toBe(201);
        const payment = await TuitionPayment.findOne({ billingPeriod: '2026-07' }).lean();
        expect(payment.amountDue).toBe(15000000);
    });
});
