const request = require('supertest');
const Evaluation = require('../models/Evaluation');
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

describe('overview API', () => {
    test('admin sees teacher groups with rounded average grades and overall performance', async () => {
        const admin = await createUser({ role: 'admin', email: 'admin@example.com' });
        const teacher = await createUser({ role: 'teacher', email: 'teacher@example.com', name: 'Teacher One' });
        const studentA = await createUser({ role: 'student', email: 'a@example.com' });
        const studentB = await createUser({ role: 'student', email: 'b@example.com' });
        const groupA = await createGroup({ teacher, name: 'Group A', students: [studentA] });
        const groupB = await createGroup({ teacher, name: 'Group B', students: [studentB] });
        const lessonA1 = await createLesson({ teacher, group: groupA });
        const lessonA2 = await createLesson({ teacher, group: groupA });
        const lessonB = await createLesson({ teacher, group: groupB });

        await Evaluation.create([
            { lesson: lessonA1._id, student: studentA._id, teacher: teacher._id, grade: 80, skills: [] },
            { lesson: lessonA2._id, student: studentA._id, teacher: teacher._id, grade: 100, skills: [] },
            { lesson: lessonB._id, student: studentB._id, teacher: teacher._id, grade: 60, skills: [] },
        ]);

        const response = await request(app)
            .get('/api/overview/teachers')
            .set('Authorization', authHeader(admin));

        expect(response.status).toBe(200);
        const teacherStats = response.body.find(item => item._id === teacher._id.toString());
        expect(teacherStats).toEqual(expect.objectContaining({
            name: 'Teacher One',
            groupCount: 2,
            totalStudents: 2,
            overallAverageGrade: 75,
        }));
        expect(teacherStats.groups).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: 'Group A', studentCount: 1, averageGrade: 90 }),
            expect.objectContaining({ name: 'Group B', studentCount: 1, averageGrade: 60 }),
        ]));
    });

    test('student cannot access admin overview', async () => {
        const student = await createUser({ role: 'student', email: 'student@example.com' });

        await request(app)
            .get('/api/overview/teachers')
            .set('Authorization', authHeader(student))
            .expect(403);
    });
});
