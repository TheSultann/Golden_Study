const request = require('supertest');
const Attendance = require('../models/Attendance');
const {
    app,
    authHeader,
    connectTestDb,
    clearTestDb,
    disconnectTestDb,
    createUser,
    createGroup,
    createLesson,
} = require('./testUtils');

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe('attendance API', () => {
    test('teacher marks attendance for all students and updates existing records', async () => {
        const teacher = await createUser({ role: 'teacher', email: 'teacher@example.com' });
        const studentA = await createUser({ role: 'student', email: 'a@example.com', name: 'Student A' });
        const studentB = await createUser({ role: 'student', email: 'b@example.com', name: 'Student B' });
        const group = await createGroup({ teacher, students: [studentA, studentB] });
        const lesson = await createLesson({ teacher, group });

        await request(app)
            .post(`/api/attendance/${lesson._id}`)
            .set('Authorization', authHeader(teacher))
            .send({ presentStudentIds: [studentA._id.toString()] })
            .expect(200);

        await expect(Attendance.countDocuments({ lesson: lesson._id })).resolves.toBe(2);
        await expect(Attendance.findOne({ lesson: lesson._id, student: studentA._id }).then(r => r.status)).resolves.toBe('present');
        await expect(Attendance.findOne({ lesson: lesson._id, student: studentB._id }).then(r => r.status)).resolves.toBe('absent');

        await request(app)
            .post(`/api/attendance/${lesson._id}`)
            .set('Authorization', authHeader(teacher))
            .send({ presentStudentIds: [studentB._id.toString()] })
            .expect(200);

        await expect(Attendance.countDocuments({ lesson: lesson._id })).resolves.toBe(2);
        await expect(Attendance.findOne({ lesson: lesson._id, student: studentA._id }).then(r => r.status)).resolves.toBe('absent');
        await expect(Attendance.findOne({ lesson: lesson._id, student: studentB._id }).then(r => r.status)).resolves.toBe('present');
    });

    test('teacher reads attendance statuses for lesson students', async () => {
        const teacher = await createUser({ role: 'teacher', email: 'teacher@example.com' });
        const studentA = await createUser({ role: 'student', email: 'a@example.com', name: 'Student A' });
        const studentB = await createUser({ role: 'student', email: 'b@example.com', name: 'Student B' });
        const group = await createGroup({ teacher, students: [studentA, studentB] });
        const lesson = await createLesson({ teacher, group });

        await Attendance.create({
            lesson: lesson._id,
            student: studentA._id,
            teacher: teacher._id,
            date: new Date(),
            status: 'present',
        });

        const response = await request(app)
            .get(`/api/attendance/${lesson._id}`)
            .set('Authorization', authHeader(teacher));

        expect(response.status).toBe(200);
        expect(response.body).toEqual(expect.arrayContaining([
            expect.objectContaining({ _id: studentA._id.toString(), name: 'Student A', status: 'present' }),
            expect.objectContaining({ _id: studentB._id.toString(), name: 'Student B', status: null }),
        ]));
    });

    test('student cannot read or mark attendance', async () => {
        const teacher = await createUser({ role: 'teacher', email: 'teacher@example.com' });
        const student = await createUser({ role: 'student', email: 'student@example.com' });
        const group = await createGroup({ teacher, students: [student] });
        const lesson = await createLesson({ teacher, group });

        await request(app)
            .get(`/api/attendance/${lesson._id}`)
            .set('Authorization', authHeader(student))
            .expect(403);

        await request(app)
            .post(`/api/attendance/${lesson._id}`)
            .set('Authorization', authHeader(student))
            .send({ presentStudentIds: [student._id.toString()] })
            .expect(403);

        await expect(Attendance.countDocuments({ lesson: lesson._id })).resolves.toBe(0);
    });

    test('teacher cannot manage attendance for another teacher lesson', async () => {
        const ownerTeacher = await createUser({ role: 'teacher', email: 'owner@example.com' });
        const otherTeacher = await createUser({ role: 'teacher', email: 'other@example.com' });
        const student = await createUser({ role: 'student', email: 'student@example.com' });
        const group = await createGroup({ teacher: ownerTeacher, students: [student] });
        const lesson = await createLesson({ teacher: ownerTeacher, group });

        await request(app)
            .get(`/api/attendance/${lesson._id}`)
            .set('Authorization', authHeader(otherTeacher))
            .expect(403);

        await request(app)
            .post(`/api/attendance/${lesson._id}`)
            .set('Authorization', authHeader(otherTeacher))
            .send({ presentStudentIds: [student._id.toString()] })
            .expect(403);
    });
});
