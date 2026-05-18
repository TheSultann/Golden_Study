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

describe('evaluations API', () => {
    test('teacher creates an evaluation with grade, completed assignments, and feedback', async () => {
        const teacher = await createUser({ role: 'teacher', email: 'teacher@example.com' });
        const student = await createUser({ role: 'student', email: 'student@example.com' });
        const group = await createGroup({ teacher, students: [student] });
        const lesson = await createLesson({
            teacher,
            group,
            assignments: [
                { title: 'Vocabulary', description: 'Words' },
                { title: 'Grammar', description: 'Rules' },
            ],
        });
        const [firstAssignment, secondAssignment] = lesson.assignments;

        const response = await request(app)
            .post('/api/evaluations')
            .set('Authorization', authHeader(teacher))
            .send({
                lessonId: lesson._id,
                studentId: student._id,
                grade: 88,
                feedback: 'Good progress',
                skills: [
                    {
                        assignmentId: firstAssignment._id,
                        assignmentTitle: firstAssignment.title,
                        completed: true,
                    },
                    {
                        assignmentId: secondAssignment._id,
                        assignmentTitle: secondAssignment.title,
                        completed: false,
                    },
                ],
            });

        expect(response.status).toBe(200);
        expect(response.body.grade).toBe(88);
        expect(response.body.feedback).toBe('Good progress');
        expect(response.body.skills).toHaveLength(2);
        await expect(Evaluation.countDocuments({ lesson: lesson._id, student: student._id })).resolves.toBe(1);
    });

    test('reposting an evaluation updates the existing student lesson record instead of duplicating it', async () => {
        const teacher = await createUser({ role: 'teacher', email: 'teacher@example.com' });
        const student = await createUser({ role: 'student', email: 'student@example.com' });
        const group = await createGroup({ teacher, students: [student] });
        const lesson = await createLesson({
            teacher,
            group,
            assignments: [{ title: 'Speaking', description: 'Talk' }],
        });
        const assignment = lesson.assignments[0];

        const firstPayload = {
            lessonId: lesson._id,
            studentId: student._id,
            grade: 60,
            feedback: 'Needs practice',
            skills: [{ assignmentId: assignment._id, assignmentTitle: assignment.title, completed: false }],
        };
        const secondPayload = {
            ...firstPayload,
            grade: 95,
            feedback: 'Much better',
            skills: [{ assignmentId: assignment._id, assignmentTitle: assignment.title, completed: true }],
        };

        await request(app).post('/api/evaluations').set('Authorization', authHeader(teacher)).send(firstPayload).expect(200);
        const response = await request(app).post('/api/evaluations').set('Authorization', authHeader(teacher)).send(secondPayload);

        expect(response.status).toBe(200);
        expect(response.body.grade).toBe(95);
        expect(response.body.feedback).toBe('Much better');
        await expect(Evaluation.countDocuments({ lesson: lesson._id, student: student._id })).resolves.toBe(1);
    });

    test('student can read only their own completed assignment ids for a lesson', async () => {
        const teacher = await createUser({ role: 'teacher', email: 'teacher@example.com' });
        const student = await createUser({ role: 'student', email: 'student@example.com' });
        const otherStudent = await createUser({ role: 'student', email: 'other@example.com' });
        const group = await createGroup({ teacher, students: [student, otherStudent] });
        const lesson = await createLesson({
            teacher,
            group,
            assignments: [
                { title: 'Reading', description: 'Read' },
                { title: 'Writing', description: 'Write' },
            ],
        });
        const [completedAssignment, incompleteAssignment] = lesson.assignments;
        await Evaluation.create({
            lesson: lesson._id,
            student: student._id,
            teacher: teacher._id,
            grade: 91,
            feedback: 'Strong work',
            skills: [
                { assignmentId: completedAssignment._id, assignmentTitle: completedAssignment.title, completed: true },
                { assignmentId: incompleteAssignment._id, assignmentTitle: incompleteAssignment.title, completed: false },
            ],
        });
        await Evaluation.create({
            lesson: lesson._id,
            student: otherStudent._id,
            teacher: teacher._id,
            grade: 50,
            skills: [{ assignmentId: incompleteAssignment._id, assignmentTitle: incompleteAssignment.title, completed: true }],
        });

        const response = await request(app)
            .get(`/api/evaluations/student/${lesson._id}`)
            .set('Authorization', authHeader(student));

        expect(response.status).toBe(200);
        expect(response.body.grade).toBe(91);
        expect(response.body.feedback).toBe('Strong work');
        expect(response.body.skills).toEqual([completedAssignment._id.toString()]);
    });

    test('student cannot create evaluations', async () => {
        const student = await createUser({ role: 'student', email: 'student@example.com' });

        await request(app)
            .post('/api/evaluations')
            .set('Authorization', authHeader(student))
            .send({ lessonId: '507f1f77bcf86cd799439011', studentId: student._id, grade: 100, skills: [] })
            .expect(403);
    });

    test('teacher cannot save a grade outside 0-100', async () => {
        const teacher = await createUser({ role: 'teacher', email: 'teacher@example.com' });
        const student = await createUser({ role: 'student', email: 'student@example.com' });
        const group = await createGroup({ teacher, students: [student] });
        const lesson = await createLesson({ teacher, group });

        await request(app)
            .post('/api/evaluations')
            .set('Authorization', authHeader(teacher))
            .send({
                lessonId: lesson._id,
                studentId: student._id,
                grade: 101,
                skills: [],
            })
            .expect(400);

        await request(app)
            .post('/api/evaluations')
            .set('Authorization', authHeader(teacher))
            .send({
                lessonId: lesson._id,
                studentId: student._id,
                grade: -1,
                skills: [],
            })
            .expect(400);

        await expect(Evaluation.countDocuments({ lesson: lesson._id, student: student._id })).resolves.toBe(0);
    });
});
