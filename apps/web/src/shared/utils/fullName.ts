export function joinFullName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.trim().replace(/\s+/g, ' ')
}

export function splitFullName(value: string) {
  const [firstName = '', ...surnameParts] = value.trim().replace(/\s+/g, ' ').split(' ')
  return { firstName, lastName: surnameParts.join(' ') }
}
