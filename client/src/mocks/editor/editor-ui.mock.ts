import type { TeamMember, VersionRecord } from '@/models'

export const MOCK_CURRENT_VERSION_LABEL = 'Версия 5.3 - Финальная версия'
export const MOCK_SHARE_LINK = 'https://example.com/share/en-flow'
export const MOCK_CURRENT_USER_NAME = 'User'

export function createMockVersionHistory(): VersionRecord[] {
  return [
    { id: 'v5.2', label: 'Версия 5.2 - Согласовано с ИБ', date: '22.04.2025' },
    { id: 'v4.3', label: 'Версия 4.3 - Согласовано с ИБ', date: '22.04.2025' },
    { id: 'v4.2', label: 'Версия 4.2 - Согласовано с ИБ', date: '22.04.2025' },
    { id: 'v3.1', label: 'Версия 3.1 - Согласовано с ИБ', date: '22.04.2025' },
    { id: 'v2.2', label: 'Версия 2.2 - Согласовано с ИБ', date: '22.04.2025' },
  ]
}

export function createMockTeamMembers(): TeamMember[] {
  return [
    { initials: 'OP', name: 'Иванов И.И.', email: 'ivanov@mail.ru', role: 'Редактор' },
    { initials: 'OP', name: 'Петров П.П.', email: 'petrov@mail.ru', role: 'Чтение' },
    { initials: 'OP', name: 'Сидоров С.С.', email: 'sidorov@mail.ru', role: 'Админ' },
  ]
}
