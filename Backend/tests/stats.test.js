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

describe('stats API', () => {
    test('teacher gets ranked group stats and exact group average', async () => {
        const teacher = await createUser({ role: 'teacher', email: 'teacher@example.com' });
        const studentA = await createUser({ role: 'student', email: 'a@example.com', name: 'Student A' });
        const studentB = await createUser({ role: 'student', email: 'b@example.com', name: 'Student B' });
        const group = await createGroup({ teacher, students: [studentA, studentB] });
        const lesson1 = await createLesson({ teacher, group });
        const lesson2 = await createLesson({ teacher, group });

        await studentA.updateOne({ group: group._id });
        await studentB.updateOne({ group: group._id });

        await Evaluation.create([
            { lesson: lesson1._id, student: studentA._id, teacher: teacher._id, grade: 80, skills: [] },
            { lesson: lesson2._id, student: studentA._id, teacher: teacher._id, grade: 100, skills: [] },
            { lesson: lesson1._id, student: studentB._id, teacher: teacher._id, grade: 60, skills: [] },
        ]);

        const response = await request(app)
            .get(`/api/stats/group/${group._id}`)
            .set('Authorization', authHeader(teacher));

        expect(response.status).toBe(200);
        expect(response.body.groupAverage).toBe(80);
        expect(response.body.studentStats).toEqual([
            expect.objectContaining({
                studentId: studentA._id.toString(),
                studentName: 'Student A',
                averageGrade: 90,
                lessonCount: 2,
                rank: 1,
            }),
            expect.objectContaining({
                studentId: studentB._id.toString(),
                studentName: 'Student B',
                averageGrade: 60,
                lessonCount: 1,
                rank: 2,
            }),
        ]);
    });

    test('student gets own grades and full group ranking', async () => {
        const teacher = await createUser({ role: 'teacher', email: 'teacher@example.com' });
        const studentA = await createUser({ role: 'student', email: 'a@example.com', name: 'Student A' });
        const studentB = await createUser({ role: 'student', email: 'b@example.com', name: 'Student B' });
        const group = await createGroup({ teacher, students: [studentA, studentB] });
        const lesson1 = await createLesson({ teacher, group });
        const lesson2 = await createLesson({ teacher, group });

        await studentA.updateOne({ group: group._id });
        await studentB.updateOne({ group: group._id });

        await Evaluation.create([
            { lesson: lesson1._id, student: studentA._id, teacher: teacher._id, grade: 70, skills: [] },
            { lesson: lesson2._id, student: studentA._id, teacher: teacher._id, grade: 90, skills: [] },
            { lesson: lesson1._id, student: studentB._id, teacher: teacher._id, grade: 100, skills: [] },
        ]);

        const response = await request(app)
            .get('/api/stats/student')
            .set('Authorization', authHeader(studentA));

        expect(response.status).toBe(200);
        expect(response.body.myEvaluations).toHaveLength(2);
        expect(response.body.rating.groupAverage).toBe(90);
        expect(response.body.rating.totalStudents).toBe(2);
        expect(response.body.rating.myRank).toEqual(expect.objectContaining({
            studentId: studentA._id.toString(),
            averageGrade: 80,
            rank: 2,
        }));
        expect(response.body.rating.fullRanking).toEqual([
            expect.objectContaining({ studentId: studentB._id.toString(), averageGrade: 100, rank: 1, isCurrentUser: false }),
            expect.objectContaining({ studentId: studentA._id.toString(), averageGrade: 80, rank: 2, isCurrentUser: true }),
        ]);
    });
});
