// src/data/mockData.js

// === ДАННЫЕ ДЛЯ СТРАНИЦЫ УЧЕНИКА "ANNA" ===

export const studentData = {
    name: "Anna",
    lessons: [
        {
            id: 1,
            title: "Lesson 1: Introduction",
            assignment: "Learn 10 new words",
            dueDate: "Apr 24",
            score: 80,
            teacher: {
                name: "David Smith",
                avatar: "/images/teacher-avatar.png" // Добавь любую картинку учителя в public/images
            }
        },
        {
            id: 2,
            title: "Lesson 2: Past Simple",
            assignment: "Write 10 sentences",
            dueDate: "Apr 30",
            score: 50,
            teacher: {
                name: "David Smith",
                avatar: "/images/teacher-avatar.png"
            }
        },
        {
            id: 3,
            title: "Lesson 3: Future Tenses",
            assignment: "Conversation practice",
            dueDate: "May 5",
            score: null, // null означает, что оценка еще не выставлена
            teacher: {
                name: "David Smith",
                avatar: "/images/teacher-avatar.png"
            }
        }
    ],
    progress: {
        averageScore: 65,
        chartData: [
            { week: 'W1', score: 70 },
            { week: 'W2', score: 85 },
            { week: 'W3', score: 60 },
            { week: 'W4', score: 65 },
            { week: 'W5', score: 50 },
        ],
    },
    skills: {
        vocabulary: 85,
        grammar: 60,
        pronunciation: 75,
    },
    rankings: {
        position: 3,
        totalStudents: 15,
        topStudents: [
            { name: "Student C", score: 92 },
            { name: "Student A", score: 88 },
            { name: "Student E", score: 75 },
            { name: "Anna", score: 65 }, // Наш ученик
        ]
    },
    weeklyGoal: {
        title: "Goal: Complete 3 assignments with 80%+ progress",
        progress: 66, // 2 из 3 заданий выполнены для цели
    }
};




// Добавь это в конец файла src/data/mockData.js

// === ДАННЫЕ ДЛЯ СТРАНИЦЫ УЧИТЕЛЯ ===

export const teacherData = {
    name: "David Smith",
    // Список уроков, созданных учителем
    lessons: [
        {
            id: 1,
            title: "Lesson 1: Introduction",
            assignments: 2,
            studentsSubmitted: 15
        },
        {
            id: 2,
            title: "Lesson 2: Past Simple",
            assignments: 1,
            studentsSubmitted: 12
        },
        {
            id: 3,
            title: "Lesson 3: Future Tenses",
            assignments: 3,
            studentsSubmitted: 8
        },
    ],
    // Данные для оценки по конкретному уроку (Lesson 1)
    gradingData: {
        lessonTitle: "Lesson 1: Introduction",
        students: [
            { name: "Student C", score: 78, skills: ["Vocabulary"] },
            { name: "Student A", score: 92, skills: ["Vocabulary", "Grammar"] },
            { name: "Student B", score: 83, skills: ["Pronunciation"] },
        ]
    },
    // Общая статистика для правой панели
    statistics: {
        averagePerformance: "78%",
        topStudents: [
            { name: "Student A", score: "92%" },
            { name: "Student B", score: "83%" },
        ],
        performanceOverview: [
            { week: 'W1', score: 70 },
            { week: 'W2', score: 85 },
            { week: 'W3', score: 60 },
            { week: 'W4', score: 78 },
        ]
    }
};
