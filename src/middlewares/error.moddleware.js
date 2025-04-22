import { ConnectionError, DatabaseError, ForeignKeyConstraintError, Sequelize, TimeoutError, UniqueConstraintError, ValidationError } from "sequelize";
import logger from "../logger/winston.logger.js";
import { ApiError } from "../utils/ApiError.js";

const errorHandler = (err, req, res, next) => {
  let error = err;
  console.log("errorHandler", error);

  const username = req.user?.username || "anonymous";

  if (!(error instanceof ApiError)) {
    const statusCode =
      error.statusCode || error instanceof Sequelize.Error ? 400 : 500;

    const message = error.message || "Something went wrong";
    error = new ApiError(statusCode, message, error?.errors || [], error.stack);
  }

  const response = {
    ...error,
    message: error.message,
    stack: error.stack,
    ...(process.env.NODE_ENV === "development" ? { stack: error.stack } : {}),
  };

  const logMessage = [
    req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress,
    "||",
    username,
    "||",
    req.method,
    "||",
    req.originalUrl,
    "||",
    error.statusCode,
    "||",
    error.message,
  ].join(" ");

  logger.error(logMessage);

  if (
    err instanceof DatabaseError ||
    err instanceof ForeignKeyConstraintError ||
    err instanceof UniqueConstraintError ||
    err instanceof ConnectionError ||
    err instanceof TimeoutError ||
    err instanceof ValidationError
  ) {
    const message = "Something went wrong. Please try again later.";
    return res.status(500).json({ message });
  }

  return res.status(error.statusCode).json(response);
};

export { errorHandler };
