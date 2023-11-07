import crypto from 'node:crypto'

export function generateVerificationCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase()
}
