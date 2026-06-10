class AppError extends Error {
  constructor(message, statusOrOptions = {}) {
    const options = typeof statusOrOptions === 'number'
      ? { statusCode: statusOrOptions }
      : statusOrOptions;
    const {
      code = 'APP_ERROR',
      statusCode = 500,
      details = null,
      cause,
    } = options;
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.cause = cause;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null, options = {}) {
    super(message, {
      code: options.code || 'VALIDATION_ERROR',
      statusCode: options.statusCode || 400,
      details,
    });
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details = null) {
    super(message, { code: 'UNAUTHORIZED', statusCode: 401, details });
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Not found', details = null) {
    super(message, { code: 'NOT_FOUND', statusCode: 404, details });
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict', details = null) {
    super(message, { code: 'CONFLICT', statusCode: 409, details });
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests', details = null) {
    super(message, { code: 'RATE_LIMIT', statusCode: 429, details });
  }
}

class InternalServerError extends AppError {
  constructor(message = 'Internal server error', details = null) {
    super(message, { code: 'INTERNAL_ERROR', statusCode: 500, details });
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalServerError,
};
