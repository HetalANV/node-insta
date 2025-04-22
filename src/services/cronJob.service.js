import { Op } from "sequelize";
import chalk from "chalk";
import InstaPaymentModel from "../models/instaPaymentModel.js";
import { fetchTransactionStatus, parseResponseData } from "./payment.service.js";

import { asyncHandler } from "../utils/asyncHandler.js";
import logger from "../logger/winston.logger.js";

export const checkPendingTransactions = asyncHandler(async () => {
  logger.info("🔄 Running scheduled transaction status check...");

  try {
    const pendingTransactions = await InstaPaymentModel.findAll({
      where: {
        [Op.or]: [
          { paymentStatus: 'PENDING FOR APPROVAL' },
          { paymentStatus: null, status: 'pending' }
        ],
        unique_id: { [Op.ne]: null } // Ensure unique_id exists for checking status
      }
    });


    logger.info(`📋 Found ${pendingTransactions.length} pending transactions to check`);

    for (const transaction of pendingTransactions) {
      try {
        const uniqueId = transaction.unique_id;
        const statusResponse = await fetchTransactionStatus(uniqueId);
        const parsedData = parseResponseData(statusResponse);

        if (parsedData) {

          logger.info(`✅ Updated transaction ${chalk.white.bold(uniqueId)} to ${chalk.yellow.bold(parsedData.STATUS)}`);
        } else {
          logger.info(`⚠️ No parsable data for transaction ${chalk.white.bold(uniqueId)}`);
        }

      } catch (err) {
        logger.error(`❌ Error processing ${transaction.unique_id}: ${err.message}`);
      }
    }
    logger.info(`✅ Completed transaction status check.`);
  } catch (err) {
    logger.error(`❌ Cron job error: ${err.message}`);
  }
});

