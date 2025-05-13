import { generateToken } from "../utils/mTLS.js";
import logger from "../logger/winston.logger.js";
import { getAllPayments } from "../controllers/transaction.controller.js";

const updatePendingTransactions = async () => {
  try {
    logger.info('Starting cron job for pending transactions');

    // Generate and format auth token
    const tokenResponse = await generateToken();
    const authToken = tokenResponse?.access_token || tokenResponse?.token || tokenResponse;

    if (!authToken || typeof authToken !== 'string') {
      logger.error('Invalid token format:', authToken);
      throw new Error('Invalid authentication token format');
    }

    // Create mock req and res objects
    const mockReq = {
      query: {
        page: 1,
        limit: 100,  // Process more records in cron job
      },
      headers: {
        authtoken: authToken
      }
    };

    const mockRes = {
      status: (code) => ({
        json: (data) => {
          if (code === 200) {
            logger.info(`Cron job processed ${data.data.length} payments successfully`);
          } else {
            logger.error('Cron job failed:', data.message);
          }
        }
      })
    };

    // Call getAllPayments with mock objects
    await getAllPayments(mockReq, mockRes);

    logger.info('Completed cron job execution');
  } catch (error) {
    logger.error('Cron job failed:', error);
  }
};

export default updatePendingTransactions;
