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

describe('finance API', () => {
    test('admin generates unpaid invoices only for students in selected groups', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@example.com' });
        const teacher = await createUser({ role: 'teacher', email: 'teacher@example.com' });
        const studentA = await createUser({ role: 'student', email: 'a@example.com' });
        const studentB = await createUser({ role: 'student', email: 'b@example.com' });
        const studentOther = await createUser({ role: 'student', email: 'other@example.com' });
        const groupA = await createGroup({ teacher, students: [studentA, studentB] });
        const groupB = await createGroup({ teacher, name: 'Group B', students: [studentOther] });

        await studentA.updateOne({ group: groupA._id });
        await studentB.updateOne({ group: groupA._id });
        await studentOther.updateOne({ group: groupB._id });

        const response = await request(app)
            .post('/api/finance/generate')
            .set('Authorization', authHeader(admin))
            .send({
                billingPeriod: '2026-05',
                groupAmounts: { [groupA._id.toString()]: 750000 },
            });

        expect(response.status).toBe(201);
        expect(response.body.createdCount).toBe(2);

        const payments = await TuitionPayment.find({ billingPeriod: '2026-05' }).lean();
        expect(payments).toHaveLength(2);
        expect(payments.map(payment => payment.student.toString()).sort()).toEqual(
            [studentA._id.toString(), studentB._id.toString()].sort()
        );
        expect(payments.every(payment => payment.amountDue === 750000)).toBe(true);
        expect(payments.every(payment => payment.status === 'unpaid')).toBe(true);
    });

    test('admin cannot generate duplicate invoices for the same student and period', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@example.com' });
        const teacher = await createUser({ role: 'teacher', email: 'teacher@example.com' });
        const student = await createUser({ role: 'student', email: 'student@example.com' });
        const group = await createGroup({ teacher, students: [student] });
        await student.updateOne({ group: group._id });

        const payload = {
            billingPeriod: '2026-05',
            groupAmounts: { [group._id.toString()]: 500000 },
        };

        await request(app)
            .post('/api/finance/generate')
            .set('Authorization', authHeader(admin))
            .send(payload)
            .expect(201);

        const duplicateResponse = await request(app)
            .post('/api/finance/generate')
            .set('Authorization', authHeader(admin))
            .send(payload);

        expect(duplicateResponse.status).toBe(200);
        expect(duplicateResponse.body.createdCount).toBe(0);
        await expect(TuitionPayment.countDocuments({ billingPeriod: '2026-05' })).resolves.toBe(1);
    });

    test('admin marks an invoice as paid with the exact due amount and payment date', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@example.com' });
        const teacher = await createUser({ role: 'teacher', email: 'teacher@example.com' });
        const student = await createUser({ role: 'student', email: 'student@example.com' });
        const group = await createGroup({ teacher, students: [student] });
        const payment = await TuitionPayment.create({
            student: student._id,
            group: group._id,
            billingPeriod: '2026-05',
            amountDue: 900000,
        });

        const response = await request(app)
            .patch(`/api/finance/${payment._id}/pay`)
            .set('Authorization', authHeader(admin));

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('paid');
        expect(response.body.amountPaid).toBe(900000);
        expect(new Date(response.body.paymentDate).toString()).not.toBe('Invalid Date');
    });

    test('student cannot generate invoices or mark payments as paid', async () => {
        const student = await createUser({ role: 'student', email: 'student@example.com' });
        const teacher = await createUser({ role: 'teacher', email: 'teacher@example.com' });
        const group = await createGroup({ teacher, students: [student] });
        const payment = await TuitionPayment.create({
            student: student._id,
            group: group._id,
            billingPeriod: '2026-05',
            amountDue: 900000,
        });

        await request(app)
            .post('/api/finance/generate')
            .set('Authorization', authHeader(student))
            .send({ billingPeriod: '2026-05', groupAmounts: { [group._id.toString()]: 900000 } })
            .expect(403);

        await request(app)
            .patch(`/api/finance/${payment._id}/pay`)
            .set('Authorization', authHeader(student))
            .expect(403);
    });
});
