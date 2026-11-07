import { GroupStatus, Role, Weekday } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { createAccessToken } from '../auth/token.service.js';

const adminId = '80000000-0000-4000-8000-000000000101';
const teacherUserId = '80000000-0000-4000-8000-000000000102';
const foreignTeacherUserId = '80000000-0000-4000-8000-000000000103';
const suffix = Date.now().toString(36);

let adminToken = '';
let teacherToken = '';
let foreignTeacherToken = '';
let groupId = '';
let foreignGroupId = '';
let studentId = '';
let teacherId = '';
let createdTopicId = '';
let createdSubmissionId = '';

describe('Speaking Module API Integration', () => {
  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: adminId },
      update: { isActive: true },
      create: {
        id: adminId,
        login: `speaking-admin-${suffix}`,
        passwordHash: 'x',
        role: Role.SUPER_ADMIN,
      },
    });

    const teacher = await prisma.teacher.create({
      data: {
        firstName: 'Speaking',
        lastName: `Teacher ${suffix}`,
        phone: '+998901234501',
        salaryType: 'FIXED',
        fixedSalaryUzs: 1,
      },
    });
    teacherId = teacher.id;

    await prisma.user.upsert({
      where: { id: teacherUserId },
      update: { isActive: true, teacherId: teacher.id },
      create: {
        id: teacherUserId,
        login: `speaking-teacher-${suffix}`,
        passwordHash: 'x',
        role: Role.TEACHER,
        teacherId: teacher.id,
      },
    });

    const foreignTeacher = await prisma.teacher.create({
      data: {
        firstName: 'Foreign',
        lastName: `Teacher ${suffix}`,
        phone: '+998901234502',
        salaryType: 'FIXED',
        fixedSalaryUzs: 1,
      },
    });

    await prisma.user.upsert({
      where: { id: foreignTeacherUserId },
      update: { isActive: true, teacherId: foreignTeacher.id },
      create: {
        id: foreignTeacherUserId,
        login: `foreign-speaking-teacher-${suffix}`,
        passwordHash: 'x',
        role: Role.TEACHER,
        teacherId: foreignTeacher.id,
      },
    });

    const course = await prisma.course.create({
      data: {
        title: `IELTS Speaking Course ${suffix}`,
        durationMonths: 3,
        pricePerMonthUzs: 500000,
      },
    });

    const group = await prisma.group.create({
      data: {
        name: `IELTS Group ${suffix}`,
        courseId: course.id,
        teacherId: teacher.id,
        weekdays: [Weekday.MON, Weekday.WED, Weekday.FRI],
        lessonStartMinutes: 600,
        status: GroupStatus.ACTIVE,
        startDate: new Date('2026-09-01'),
      },
    });
    groupId = group.id;

    const foreignGroup = await prisma.group.create({
      data: {
        name: `Foreign IELTS Group ${suffix}`,
        courseId: course.id,
        teacherId: foreignTeacher.id,
        weekdays: [Weekday.TUE, Weekday.THU],
        lessonStartMinutes: 720,
        status: GroupStatus.ACTIVE,
        startDate: new Date('2026-09-01'),
      },
    });
    foreignGroupId = foreignGroup.id;

    const student = await prisma.student.create({
      data: {
        studentCode: `SPK${suffix.toUpperCase()}`,
        firstName: 'Bobur',
        lastName: `Karimov ${suffix}`,
      },
    });
    studentId = student.id;

    await prisma.groupStudent.create({
      data: { groupId: group.id, studentId: student.id },
    });

    adminToken = createAccessToken({
      id: adminId,
      login: `speaking-admin-${suffix}`,
      role: 'SUPER_ADMIN',
      teacherId: null,
    });

    teacherToken = createAccessToken({
      id: teacherUserId,
      login: `speaking-teacher-${suffix}`,
      role: 'TEACHER',
      teacherId: teacher.id,
    });

    foreignTeacherToken = createAccessToken({
      id: foreignTeacherUserId,
      login: `foreign-speaking-teacher-${suffix}`,
      role: 'TEACHER',
      teacherId: foreignTeacher.id,
    });
  });

  afterAll(async () => {
    await prisma.speakingSubmission.deleteMany({
      where: { studentId },
    });
    await prisma.speakingTopic.deleteMany({
      where: { groupId: { in: [groupId, foreignGroupId] } },
    });
    await prisma.groupStudent.deleteMany({ where: { groupId } });
    await prisma.student.delete({ where: { id: studentId } }).catch(() => undefined);
    await prisma.group.deleteMany({
      where: { id: { in: [groupId, foreignGroupId] } },
    });
    await prisma.course.deleteMany({ where: { title: { endsWith: suffix } } });
    await prisma.user.deleteMany({
      where: { login: { in: [`speaking-admin-${suffix}`, `speaking-teacher-${suffix}`, `foreign-speaking-teacher-${suffix}`] } },
    });
    await prisma.teacher.deleteMany({
      where: { lastName: { endsWith: suffix } },
    });
  });

  it('creates a new speaking topic successfully', async () => {
    const res = await request(createApp())
      .post('/api/v1/speaking/topics')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        groupId,
        title: 'Describe a memorable journey you took',
        description: 'You should say where you went, whom you went with, and explain why it was memorable.',
        maxScore: 9,
        deadline: '2026-11-20',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.title).toBe('Describe a memorable journey you took');
    expect(res.body.data.groupId).toBe(groupId);
    expect(res.body.data.teacherId).toBe(teacherId);
    expect(res.body.data.groupName).toContain('IELTS Group');
    createdTopicId = res.body.data.id;
  });

  it('prevents a teacher from creating a topic in another teacher’s group', async () => {
    const res = await request(createApp())
      .post('/api/v1/speaking/topics')
      .set('Authorization', `Bearer ${foreignTeacherToken}`)
      .send({
        groupId, // belongs to first teacher
        title: 'Unauthorized topic attempt',
        description: 'Should fail with 403',
      });

    expect(res.status).toBe(403);
  });

  it('lists speaking topics filtered by group and teacher role', async () => {
    const res = await request(createApp())
      .get(`/api/v1/speaking/topics?groupId=${groupId}`)
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].id).toBe(createdTopicId);
  });

  it('submits a student voice recording ready for manual teacher review when AI key is absent', async () => {
    const res = await request(createApp())
      .post('/api/v1/speaking/submissions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        topicId: createdTopicId,
        studentId,
        audioUrl: 'https://cdn.example.com/audio/sample_speaking.ogg',
        durationSeconds: 45,
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.topicId).toBe(createdTopicId);
    expect(res.body.data.studentId).toBe(studentId);
    expect(res.body.data.status).toBe('PENDING_AI');
    expect(res.body.data.transcript).toBe('');
    expect(res.body.data.aiFeedback).toBe('');
    expect(res.body.data.aiScore).toBeNull();
    createdSubmissionId = res.body.data.id;
  });

  it('lists submissions for a topic', async () => {
    const res = await request(createApp())
      .get(`/api/v1/speaking/submissions?topicId=${createdTopicId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].id).toBe(createdSubmissionId);
    expect(res.body.data[0].studentName).toContain('Bobur');
  });

  it('allows teacher to review audio, grade submission and submit comments', async () => {
    const res = await request(createApp())
      .post(`/api/v1/speaking/submissions/${createdSubmissionId}/grade`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        teacherScore: 7.0,
        teacherComment: 'Juda yaxshi nutq! So‘z boyligi va intonatsiya ajoyib.',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('GRADED_BY_TEACHER');
    expect(res.body.data.teacherScore).toBe(7.0);
    expect(res.body.data.teacherComment).toBe('Juda yaxshi nutq! So‘z boyligi va intonatsiya ajoyib.');
  });

  it('prevents foreign teacher from grading another teacher’s submission', async () => {
    const res = await request(createApp())
      .post(`/api/v1/speaking/submissions/${createdSubmissionId}/grade`)
      .set('Authorization', `Bearer ${foreignTeacherToken}`)
      .send({
        teacherScore: 5.0,
        teacherComment: 'Should be forbidden',
      });

    expect(res.status).toBe(403);
  });

  it('rejects teacher score that exceeds topic maxScore with 400 Bad Request', async () => {
    const res = await request(createApp())
      .post(`/api/v1/speaking/submissions/${createdSubmissionId}/grade`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        teacherScore: 15.0, // maxScore is 9
        teacherComment: 'Score too high',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects submission from student not enrolled in the topic group with 422', async () => {
    const nonEnrolledStudent = await prisma.student.create({
      data: {
        studentCode: `EXT${suffix.toUpperCase()}`,
        firstName: 'External',
        lastName: `Student ${suffix}`,
      },
    });

    const res = await request(createApp())
      .post('/api/v1/speaking/submissions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        topicId: createdTopicId,
        studentId: nonEnrolledStudent.id,
        audioUrl: 'https://cdn.example.com/audio/external.ogg',
        durationSeconds: 30,
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('BUSINESS_ERROR');

    await prisma.student.delete({ where: { id: nonEnrolledStudent.id } });
  });

  it('handles query with empty strings without Zod error', async () => {
    const res = await request(createApp())
      .get('/api/v1/speaking/submissions?status=&groupId=&topicId=')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('accepts base64 audio payloads larger than 1MB without 413 Payload Too Large', async () => {
    // Generate ~1.2MB base64 string
    const largeBase64 = Buffer.alloc(1.2 * 1024 * 1024, 'a').toString('base64');
    const res = await request(createApp())
      .post('/api/v1/speaking/submissions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        topicId: createdTopicId,
        studentId,
        audioUrl: 'https://cdn.example.com/audio/sample_speaking.ogg',
        durationSeconds: 60,
        audioBase64: largeBase64,
        mimeType: 'audio/ogg; codecs=opus',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.status).toBe('PENDING_AI');
  });

  it('rejects submission when both audioUrl and audioBase64 are missing or empty', async () => {
    const res = await request(createApp())
      .post('/api/v1/speaking/submissions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        topicId: createdTopicId,
        studentId,
        audioUrl: '',
        durationSeconds: 30,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates submission with Telegram file reference and ensures 0 MB base64 in DB', async () => {
    const res = await request(createApp())
      .post('/api/v1/speaking/submissions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        topicId: createdTopicId,
        studentId,
        audioUrl: 'telegram:voice_test_001',
        durationSeconds: 25,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.audioUrl).toBe('telegram:voice_test_001');

    const inDb = await prisma.speakingSubmission.findUnique({
      where: { id: res.body.data.id },
    });
    expect(inDb?.audioUrl).toBe('telegram:voice_test_001');
    expect(inDb?.audioUrl).not.toContain('base64');
  });

  it('streams audio from Telegram using fresh download link on demand', async () => {
    const sub = await prisma.speakingSubmission.create({
      data: {
        topicId: createdTopicId,
        studentId,
        audioUrl: 'telegram:voice_stream_test_123',
        durationSeconds: 15,
        status: 'PENDING_AI',
      },
    });

    const originalFetch = globalThis.fetch;
    const fakeAudioContent = Buffer.from('fake-telegram-ogg-audio-stream-data');

    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/getFile')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: {
              file_id: 'voice_stream_test_123',
              file_path: 'voice/voice_123.oga',
              file_size: fakeAudioContent.length,
            },
          }),
        } as unknown as Response;
      }
      if (urlStr.includes('/file/bot') && urlStr.includes('voice_123.oga')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({
            'content-type': 'audio/ogg',
            'content-length': String(fakeAudioContent.length),
          }),
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(fakeAudioContent));
              controller.close();
            },
          }),
        } as unknown as Response;
      }
      return originalFetch(url);
    }) as typeof fetch;

    try {
      const res = await request(createApp())
        .get(`/api/v1/speaking/submissions/${sub.id}/audio`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('audio/ogg');
      expect(res.headers['accept-ranges']).toBe('bytes');
      expect(res.body.toString()).toBe(fakeAudioContent.toString());
    } finally {
      globalThis.fetch = originalFetch;
      await prisma.speakingSubmission.delete({ where: { id: sub.id } });
    }
  });

  it('allows streaming audio using query parameter token without Authorization header', async () => {
    const sub = await prisma.speakingSubmission.create({
      data: {
        topicId: createdTopicId,
        studentId,
        audioUrl: 'telegram:voice_query_token_test',
        durationSeconds: 10,
        status: 'PENDING_AI',
      },
    });

    const originalFetch = globalThis.fetch;
    const fakeAudioContent = Buffer.from('audio-data-for-query-token');

    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/getFile')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: {
              file_id: 'voice_query_token_test',
              file_path: 'voice/query.oga',
              file_size: fakeAudioContent.length,
            },
          }),
        } as unknown as Response;
      }
      if (urlStr.includes('/file/bot') && urlStr.includes('query.oga')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({
            'content-type': 'audio/ogg',
            'content-length': String(fakeAudioContent.length),
          }),
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(fakeAudioContent));
              controller.close();
            },
          }),
        } as unknown as Response;
      }
      return originalFetch(url);
    }) as typeof fetch;

    try {
      const res = await request(createApp())
        .get(`/api/v1/speaking/submissions/${sub.id}/audio?token=${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('audio/ogg');
      expect(res.body.toString()).toBe(fakeAudioContent.toString());
    } finally {
      globalThis.fetch = originalFetch;
      await prisma.speakingSubmission.delete({ where: { id: sub.id } });
    }
  });

  it('forbids foreign teacher from streaming audio of another teacher’s submission with 403', async () => {
    const res = await request(createApp())
      .get(`/api/v1/speaking/submissions/${createdSubmissionId}/audio`)
      .set('Authorization', `Bearer ${foreignTeacherToken}`);

    expect(res.status).toBe(403);
  });

  it('rejects audio streaming request without authentication with 401', async () => {
    const res = await request(createApp())
      .get(`/api/v1/speaking/submissions/${createdSubmissionId}/audio`);

    expect(res.status).toBe(401);
  });

  it('returns 404 when streaming audio for non-existent submission', async () => {
    const res = await request(createApp())
      .get('/api/v1/speaking/submissions/00000000-0000-0000-0000-000000000000/audio')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('handles HTTP 206 Partial Content range requests when streaming from Telegram', async () => {
    const sub = await prisma.speakingSubmission.create({
      data: {
        topicId: createdTopicId,
        studentId,
        audioUrl: 'telegram:voice_range_stream_test',
        durationSeconds: 20,
        status: 'PENDING_AI',
      },
    });

    const fullContent = Buffer.from('0123456789abcdefghijklmnopqrstuvwxyz');
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes('/getFile')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: {
              file_id: 'voice_range_stream_test',
              file_path: 'voice/range.oga',
              file_size: fullContent.length,
            },
          }),
        } as unknown as Response;
      }
      if (urlStr.includes('/file/bot') && urlStr.includes('range.oga')) {
        const range = init?.headers ? (init.headers as Record<string, string>)['Range'] : undefined;
        let slice = fullContent;
        let status = 200;
        let contentRange: string | undefined;

        if (range && range.startsWith('bytes=')) {
          const [startStr, endStr] = range.slice(6).split('-');
          const start = parseInt(startStr || '0', 10);
          const end = endStr ? parseInt(endStr, 10) : fullContent.length - 1;
          slice = fullContent.subarray(start, end + 1);
          status = 206;
          contentRange = `bytes ${start}-${end}/${fullContent.length}`;
        }

        const headers = new Headers({
          'content-type': 'audio/ogg',
          'content-length': String(slice.length),
        });
        if (contentRange) {
          headers.set('content-range', contentRange);
        }

        return {
          ok: true,
          status,
          headers,
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(slice));
              controller.close();
            },
          }),
        } as unknown as Response;
      }
      return originalFetch(url, init);
    }) as typeof fetch;

    try {
      const res = await request(createApp())
        .get(`/api/v1/speaking/submissions/${sub.id}/audio`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .set('Range', 'bytes=0-9');

      expect(res.status).toBe(206);
      expect(res.headers['content-range']).toBe(`bytes 0-9/${fullContent.length}`);
      expect(res.headers['accept-ranges']).toBe('bytes');
      expect(res.headers['content-length']).toBe('10');
      expect(res.body.toString()).toBe('0123456789');
    } finally {
      globalThis.fetch = originalFetch;
      await prisma.speakingSubmission.delete({ where: { id: sub.id } });
    }
  });

  it('handles HTTP 206 Partial Content range slicing on buffered/legacy audio', async () => {
    const rawAudio = Buffer.from('LEGACY_BUFFER_AUDIO_FOR_RANGE_TEST');
    const dataUri = `data:audio/ogg;base64,${rawAudio.toString('base64')}`;

    const sub = await prisma.speakingSubmission.create({
      data: {
        topicId: createdTopicId,
        studentId,
        audioUrl: dataUri,
        durationSeconds: 12,
        status: 'PENDING_AI',
      },
    });

    try {
      const res = await request(createApp())
        .get(`/api/v1/speaking/submissions/${sub.id}/audio`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .set('Range', 'bytes=0-12');

      expect(res.status).toBe(206);
      expect(res.headers['content-range']).toBe(`bytes 0-12/${rawAudio.length}`);
      expect(res.headers['content-length']).toBe('13');
      expect(res.body.toString()).toBe('LEGACY_BUFFER');
    } finally {
      await prisma.speakingSubmission.delete({ where: { id: sub.id } });
    }
  });

  it('returns 416 Range Not Satisfiable when range start is beyond buffer length', async () => {
    const rawAudio = Buffer.from('SHORT_AUDIO');
    const dataUri = `data:audio/ogg;base64,${rawAudio.toString('base64')}`;

    const sub = await prisma.speakingSubmission.create({
      data: {
        topicId: createdTopicId,
        studentId,
        audioUrl: dataUri,
        durationSeconds: 5,
        status: 'PENDING_AI',
      },
    });

    try {
      const res = await request(createApp())
        .get(`/api/v1/speaking/submissions/${sub.id}/audio`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .set('Range', 'bytes=500-600');

      expect(res.status).toBe(416);
      expect(res.headers['content-range']).toBe(`bytes */${rawAudio.length}`);
    } finally {
      await prisma.speakingSubmission.delete({ where: { id: sub.id } });
    }
  });

  it('never stores raw base64 data in PostgreSQL even when submitted in audioUrl', async () => {
    const largeBase64 = Buffer.alloc(1024, 'z').toString('base64');
    const dataUri = `data:audio/ogg;base64,${largeBase64}`;

    const res = await request(createApp())
      .post('/api/v1/speaking/submissions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        topicId: createdTopicId,
        studentId,
        audioUrl: dataUri,
        durationSeconds: 15,
      });

    expect(res.status).toBe(201);
    const dbRecord = await prisma.speakingSubmission.findUnique({
      where: { id: res.body.data.id },
    });
    expect(dbRecord?.audioUrl).toBe('in-memory-audio');
    expect(dbRecord?.audioUrl).not.toContain(largeBase64);

    await prisma.speakingSubmission.delete({ where: { id: res.body.data.id } });
  });

  it('returns 410 GONE when attempting to access expired legacy Telegram file link', async () => {
    const sub = await prisma.speakingSubmission.create({
      data: {
        topicId: createdTopicId,
        studentId,
        audioUrl: 'https://api.telegram.org/file/botOLD_TOKEN/voice/expired.oga',
        durationSeconds: 10,
        status: 'PENDING_AI',
      },
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('expired.oga')) {
        return {
          ok: false,
          status: 404,
        } as unknown as Response;
      }
      return originalFetch(url);
    }) as typeof fetch;

    try {
      const res = await request(createApp())
        .get(`/api/v1/speaking/submissions/${sub.id}/audio`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(410);
      expect(res.body.error.code).toBe('GONE');
    } finally {
      globalThis.fetch = originalFetch;
      await prisma.speakingSubmission.delete({ where: { id: sub.id } });
    }
  });
});
