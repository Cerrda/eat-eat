const ROLE = {
  serif: 'font-display',
  sans: 'font-body',
  mono: 'font-mono',
} as const

export type FaceRole = keyof typeof ROLE

export function faceOf(_text: string, role: FaceRole) {
  return ROLE[role]
}
