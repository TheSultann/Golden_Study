process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.REDIS_DISABLED = 'true';
process.env.REDIS_URL = 'redis://localhost:6379';

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');

const User = require('../models/User');
const Group = require('../models/Group');
const Lesson = require('../models/Lesson');

let mongoServer;

async function connectTestDb() {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
}

async function clearTestDb() {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map(collection => collection.deleteMany({})));
}

async function disconnectTestDb() {
    await mongoose.disconnect();
    if (mongoServer) {
        await mongoServer.stop();
    }
}

function authHeader(user) {
    const token = jwt.sign(
        { userId: user._id.toString(), role: user.role },
        process.env.JWT_SECRET
    );
    return `Bearer ${token}`;
}

async function createUser(overrides = {}) {
    return User.create({
        name: overrides.name || 'Test User',
        email: overrides.email || `${new mongoose.Types.ObjectId()}@example.com`,
        password: overrides.password || 'hashed-password',
        role: overrides.role || 'student',
        group: overrides.group || null,
    });
}

async function createGroup({ teacher, name = 'Group A', students = [] }) {
    return Group.create({
        name,
        teacher: teacher._id,
        students: students.map(student => student._id),
    });
}

async function createLesson({ teacher, group, assignments = [] }) {
    return Lesson.create({
        title: 'Test Lesson',
        teacher: teacher._id,
        group: group._id,
        assignments,
    });
}

module.exports = {
    app,
    authHeader,
    connectTestDb,
    clearTestDb,
    disconnectTestDb,
    createUser,
    createGroup,
    createLesson,
};
