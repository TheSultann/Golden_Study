import { ApiError } from './apiError'

const errorMap: Record<string, string> = {
  // Groups
  'Group name already exists': 'Bunday nomli guruh allaqachon mavjud',
  'Concurrent schedule change': 'Dars jadvalida to‘qnashuv yuz berdi. Tanlangan vaqt yoki xona band bo‘lishi mumkin.',
  'Teacher schedule conflict': 'Tanlangan vaqtda o‘qituvchi band',
  'Room schedule conflict': 'Tanlangan vaqtda xona band',
  'Active course required': 'Tanlangan kurs faol holatda bo‘lishi kerak',
  'Active teacher required': 'Tanlangan o‘qituvchi faol holatda bo‘lishi kerak',
  'Active room required': 'Tanlangan xona faol holatda bo‘lishi kerak',
  'Group not found': 'Guruh topilmadi',

  // Students
  'Student code allocation conflict': 'O‘quvchi kodini yaratishda xatolik yuz berdi. Qayta urinib ko‘ring.',
  'Student must be ACTIVE': 'O‘quvchi holati faol bo‘lishi kerak',
  'Student must be FROZEN': 'O‘quvchi holati muzlatilgan bo‘lishi kerak',
  'Student already archived': 'O‘quvchi allaqachon arxivlangan',
  'Active group required': 'Tanlangan guruh faol holatda bo‘lishi kerak',
  'Active student required': 'Tanlangan o‘quvchi faol holatda bo‘lishi kerak',
  'Active membership exists': 'O‘quvchi allaqachon ushbu guruhga a’zo qilingan',
  'Active membership not found': 'O‘quvchining ushbu guruhda faol a’zoligi topilmadi',
  'Student not found': 'O‘quvchi topilmadi',

  // Common
  'Access denied': 'Ruxsat berilmadi',
  'Internal server error': 'Tizimda ichki xatolik yuz berdi',
  'Validation error': 'Ma’lumotlarni kiritishda xatolik yuz berdi',
  'Invalid request': 'Ma’lumotlarni kiritishda xatolik yuz berdi',
  'Invalid login or password': 'Login yoki parol noto‘g‘ri',
  'Invalid current password': 'Hozirgi parol noto‘g‘ri',
  'Failed to fetch': 'Serverga ulanib bo‘lmadi. Backend API ishlayotganini tekshiring.',
  'NetworkError when attempting to fetch resource.': 'Serverga ulanib bo‘lmadi. Backend API ishlayotganini tekshiring.',
}

const fieldNames: Record<string, string> = {
  name: 'Nomi',
  course: 'Kurs',
  teacher: 'O‘qituvchi',
  room: 'Xona',
  time: 'Vaqt',
  startDate: 'Boshlanish sanasi',
  duration: 'Davomiyligi',
  weekdays: 'Hafta kunlari',
  fullName: 'Ism familiya',
  birthDate: 'Tug‘ilgan sana',
  phone: 'Telefon raqami',
  parentName: 'Ota-ona ismi',
  parentPhone: 'Ota-ona telefon raqami',
  address: 'Manzil',
}

function translateZodIssue(path: string[], message: string): string {
  const translatedPath = path.map((p) => fieldNames[p] ?? p).join('.')
  let translatedMessage = message

  const lowerMsg = message.toLowerCase()
  if (lowerMsg === 'required' || lowerMsg === 'kiritish majburiy') {
    translatedMessage = 'kiritilishi shart'
  } else if (lowerMsg.includes('invalid phone') || lowerMsg.includes('phone number')) {
    translatedMessage = 'noto‘g‘ri formatda'
  } else if (lowerMsg.includes('too short')) {
    translatedMessage = 'juda qisqa'
  } else if (lowerMsg.includes('invalid date') || lowerMsg.includes('date')) {
    translatedMessage = 'sana noto‘g‘ri formatda'
  }

  return translatedPath ? `${translatedPath}: ${translatedMessage}` : translatedMessage
}

export function translateErrorMessage(message: string): string {
  const trimmed = message.trim()
  return errorMap[trimmed] ?? trimmed
}

export function formatApiError(err: unknown, fallbackMessage: string): string {
  if (err instanceof ApiError) {
    if (err.code === 'VALIDATION_ERROR' && Array.isArray(err.details) && err.details.length > 0) {
      return (err.details as Array<{ path: string[]; message: string }>)
        .map((issue) => translateZodIssue(issue.path, issue.message))
        .join(', ')
    }

    const translated = translateErrorMessage(err.message)
    if (translated !== err.message) {
      return translated
    }

    // Try fallback translations by error code if message wasn't translated
    if (err.code === 'FORBIDDEN') return 'Ruxsat berilmadi'
    if (err.code === 'NOT_FOUND') return 'Ma’lumot topilmadi'
    if (err.code === 'CONFLICT') return 'Ma’lumotlar to‘qnashuvi yuz berdi'

    return translated
  }

  if (err instanceof Error) {
    return translateErrorMessage(err.message)
  }

  return fallbackMessage
}
