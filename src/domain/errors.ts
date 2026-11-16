export class DomainError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'DomainError'
    this.code = code
  }
}

export class ValidationError extends DomainError {
  readonly errors: string[]

  constructor(errors: string[]) {
    super(errors[0] ?? 'invalid')
    this.name = 'ValidationError'
    this.errors = errors
  }
}
