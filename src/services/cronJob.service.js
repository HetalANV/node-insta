import { Op } from "sequelize";
import chalk from "chalk";
import InstaPaymentModel from "../models/instaPaymentModel.js";
import { fetchTransactionStatus, parseResponseData } from "./payment.service.js";
import TransactionHistoryModel from "../models/TransactionHistoryModel.js";
import { entryPayementTechExcel } from "./techexcel.service.js";

import { asyncHandler } from "../utils/asyncHandler.js";
import logger from "../logger/winston.logger.js";
import { generateToken } from "../utils/mTLS.js";

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

export const checkPendingPayments = async () => {
  try {
    const tokenResponse = await generateToken();
    logger.info('Token response:', tokenResponse);

    logger.info('Starting cron job for pending payments check');

    const pendingPayments = await InstaPaymentModel.findAll({
      where: { paymentStatus: 'PENDING FOR APPROVAL' }
    });

    logger.info(`Found ${pendingPayments.length} pending payments to process`);

    for (const payment of pendingPayments) {
      try {
        const statusResponse = await fetchTransactionStatus(
          { authtoken: process.env.AUTH_TOKEN },
          payment.unique_id,
          payment.source
        );

        if (statusResponse?.data?.STATUS === 'SUCCESS' && statusResponse?.data?.UTRNUMBER) {
          // Call TechExcel API
          // const techexcelResponse = await entryPayementTechExcel(
          //   payment.client_code,
          //   payment.amount,
          //   statusResponse?.data?.UTRNUMBER
          // );

          // const voucherNo = techexcelResponse?.[0]?.returnvalue || null;

          // Update payment status
          await InstaPaymentModel.update(
            {
              paymentStatus: 'SUCCESS',
              voucher_no: voucherNo,
            },
            { where: { unique_id: statusResponse.data.UNIQUEID } }
          );

          // Create history record
          await TransactionHistoryModel.create({
            payment_id: payment.id,
            unique_id: payment.unique_id,
            client_code: payment.client_code,
            bank_acc_no: payment.BankAccNo,
            bank_ifsc: payment.BankIFSC,
            bene_name: payment.beneName,
            amount: payment.amount,
            status: 'SUCCESS',
            payment_status: 'SUCCESS',
            raw_response: JSON.stringify(statusResponse),
            utr_number: statusResponse.data.UTRNUMBER,
            voucher_no: voucherNo,
            created_by: "system-cron"
          });

          logger.info(`Successfully processed payment ${payment.unique_id}`);
        }
      } catch (error) {
        logger.error(`Error processing payment ${payment.unique_id}:`, error);
      }
    }

    logger.info('Completed pending payments check');
  } catch (error) {
    logger.error('Cron job error:', error);
  }
};

