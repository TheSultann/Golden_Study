const request = require('supertest');
const Salary = require('../models/Salary');
const Expense = require('../models/Expense');
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

describe('Accounting - Salaries', () => {
    test('admin can set salary for a teacher', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@test.com' });
        const teacher = await createUser({ role: 'teacher', email: 'teacher@test.com', name: 'Teacher A' });

        const res = await request(app)
            .post('/api/accounting/salaries')
            .set('Authorization', authHeader(admin))
            .send({ teacherId: teacher._id.toString(), period: '2026-05', amount: 3000000 });

        expect(res.status).toBe(201);
        expect(res.body.amount).toBe(3000000);
        expect(res.body.status).toBe('pending');
        expect(res.body.teacher.name).toBe('Teacher A');
    });

    test('admin can update existing salary amount', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@test.com' });
        const teacher = await createUser({ role: 'teacher', email: 'teacher@test.com' });

        await request(app)
            .post('/api/accounting/salaries')
            .set('Authorization', authHeader(admin))
            .send({ teacherId: teacher._id.toString(), period: '2026-05', amount: 3000000 });

        const res = await request(app)
            .post('/api/accounting/salaries')
            .set('Authorization', authHeader(admin))
            .send({ teacherId: teacher._id.toString(), period: '2026-05', amount: 5000000 });

        expect(res.status).toBe(201);
        expect(res.body.amount).toBe(5000000);

        // Only one record in DB
        const count = await Salary.countDocuments({ teacher: teacher._id, period: '2026-05' });
        expect(count).toBe(1);
    });

    test('admin can mark salary as paid', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@test.com' });
        const teacher = await createUser({ role: 'teacher', email: 'teacher@test.com' });

        const salary = await Salary.create({
            teacher: teacher._id, period: '2026-05', amount: 4000000, status: 'pending'
        });

        const res = await request(app)
            .patch(`/api/accounting/salaries/${salary._id}/pay`)
            .set('Authorization', authHeader(admin));

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('paid');
        expect(res.body.paymentDate).toBeDefined();
    });

    test('cannot pay salary with zero amount', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@test.com' });
        const teacher = await createUser({ role: 'teacher', email: 'teacher@test.com' });

        const salary = await Salary.create({
            teacher: teacher._id, period: '2026-05', amount: 0, status: 'pending'
        });

        const res = await request(app)
            .patch(`/api/accounting/salaries/${salary._id}/pay`)
            .set('Authorization', authHeader(admin));

        expect(res.status).toBe(400);
    });

    test('GET salaries returns all teachers with salary data', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@test.com' });
        const teacher1 = await createUser({ role: 'teacher', email: 't1@test.com', name: 'Teacher 1' });
        const teacher2 = await createUser({ role: 'teacher', email: 't2@test.com', name: 'Teacher 2' });

        await Salary.create({ teacher: teacher1._id, period: '2026-05', amount: 3000000 });

        const res = await request(app)
            .get('/api/accounting/salaries?period=2026-05')
            .set('Authorization', authHeader(admin));

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        const t1 = res.body.find(s => s.teacher.name === 'Teacher 1');
        const t2 = res.body.find(s => s.teacher.name === 'Teacher 2');
        expect(t1.amount).toBe(3000000);
        expect(t2.amount).toBe(0); // No salary set yet
    });

    test('student cannot access salaries', async () => {
        const student = await createUser({ role: 'student', email: 'student@test.com' });

        const res = await request(app)
            .get('/api/accounting/salaries?period=2026-05')
            .set('Authorization', authHeader(student));

        expect(res.status).toBe(403);
    });
});

describe('Accounting - Expenses', () => {
    test('admin can add expense', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@test.com' });

        const res = await request(app)
            .post('/api/accounting/expenses')
            .set('Authorization', authHeader(admin))
            .send({ description: 'Office rent', amount: 2000000, category: 'rent', expenseDate: '2026-05-01' });

        expect(res.status).toBe(201);
        expect(res.body.description).toBe('Office rent');
        expect(res.body.amount).toBe(2000000);
        expect(res.body.category).toBe('rent');
    });

    test('admin can delete expense', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@test.com' });

        const expense = await Expense.create({
            description: 'Test', amount: 100000, category: 'other', expenseDate: new Date()
        });

        const res = await request(app)
            .delete(`/api/accounting/expenses/${expense._id}`)
            .set('Authorization', authHeader(admin));

        expect(res.status).toBe(200);
        const count = await Expense.countDocuments();
        expect(count).toBe(0);
    });

    test('expense requires description, amount, category', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@test.com' });

        const res = await request(app)
            .post('/api/accounting/expenses')
            .set('Authorization', authHeader(admin))
            .send({ description: 'Missing fields' });

        expect(res.status).toBe(400);
    });

    test('large expense amounts stored correctly', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@test.com' });

        const res = await request(app)
            .post('/api/accounting/expenses')
            .set('Authorization', authHeader(admin))
            .send({ description: 'Big purchase', amount: 50000000, category: 'supplies', expenseDate: '2026-05-15' });

        expect(res.status).toBe(201);
        expect(res.body.amount).toBe(50000000);
    });

    test('student cannot access expenses', async () => {
        const student = await createUser({ role: 'student', email: 'student@test.com' });

        const res = await request(app)
            .get('/api/accounting/expenses')
            .set('Authorization', authHeader(student));

        expect(res.status).toBe(403);
    });
});
