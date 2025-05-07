import { instaPaymentSequelize } from "../config/dbConnection.js";

export const healthCheck = async (req, res) => {
  try {
    // Check database connection
    await instaPaymentSequelize.authenticate();

    const healthData = {
      uptime: process.uptime(),
      timestamp: Date.now(),
      database: "connected",
      api: "healthy"
    };

    res.status(200).json({
      status: "success",
      message: "Health check passed",
      data: healthData
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      message: "Health check failed",
      data: {
        api: "healthy",
        database: "disconnected",
        error: error.message
      }
    });
  }
};
