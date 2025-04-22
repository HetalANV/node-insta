import logger from "../logger/winston.logger.js";

const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => {
      logger.error(`Unhandled Error: ${err.message}`);
      next(err);
    });
  };
};

export { asyncHandler };
