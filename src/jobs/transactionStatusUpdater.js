import InstaPayementModel from "../models/instaPaymentModel.js";

import { fetchTransactionStatus, parseResponseData } from "../services/payment.service.js";
import { updateTransaction } from "../services/transaction.service.js";
import { extractVoucherNo } from "../utils/parseVoucher.js";
import { instaPaymentSequelize } from "../config/dbConnection.js";
import { entryPayementTechExcel } from "../services/techexcel.service.js";
import logger from "../logger/winston.logger.js";
import TransactionHistoryModel from "../models/TransactionHistoryModel.js";
import { getTransactionHistory } from "../controllers/transaction.controller.js";


const updatePendingTransactions = async () => {
  try {
    console.log('Starting to process pending transactions...');

    // You can adjust the startDate and endDate as needed (for example, to process the last 5 minutes of data)
    const startDate = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    const endDate = new Date();

    // Manually call the `getTransactionHistory` function and pass necessary arguments
    // Passing `req`, `res` mock objects because it's an API call and we don't need actual HTTP request/response objects
    const req = {
      body: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        clientCode: '', // optional, or set specific client code
        page: 1,
        limit: 10,
      },
      headers: {},
    };

    const res = {
      status: (statusCode) => ({
        json: (data) => {
          console.log(`Cron job completed with status: ${statusCode}`);
          console.log('Response data:', data);
        },
      }),
    };

    // Call your getTransactionHistory function
    await getTransactionHistory(req, res);
  } catch (error) {
    console.error('Error in cron job execution:', error.message);
  }
  // try {
  //   // Fetch all transactions with "PENDING FOR APPROVAL" status
  //   const pendingTransactions = await InstaPayementModel.findAll({
  //     where: { paymentStatus: 'PENDING FOR APPROVAL' },
  //   });

  //   for (const transaction of pendingTransactions) {
  //     const { unique_id: uniqueId, source, client_code, amount } = transaction;
  //     logger.info(`Processing transaction with uniqueId: ${uniqueId}`);

  //     try {
  //       // Fetch status from external API

  //       const statusResponse = await fetchTransactionStatus(authToken, uniqueId, source);
  //       const parsedData = parseResponseData(statusResponse);
  //       console.log('parsedData ==========>>>\x1b[0m', parsedData);

  //       if (parsedData) {
  //         // Update transaction and add history record
  //         await updateTransaction(transaction, parsedData, statusResponse);

  //         // Insert or update the transaction history
  //         await TransactionHistoryModel.create({
  //           unique_id: uniqueId,
  //           payment_status: parsedData.STATUS || 'pending',
  //           utr_number: parsedData.UTRNUMBER || null,
  //           urn: parsedData.URN || null,
  //           raw_response: JSON.stringify(statusResponse),
  //           created_at: new Date(),
  //         });

  //         // Update the history table with the latest status
  //         await TransactionHistoryModel.update(
  //           {
  //             payment_status: parsedData.STATUS || 'pending',
  //             utr_number: parsedData.UTRNUMBER || null,
  //             urn: parsedData.URN || null,
  //             raw_response: JSON.stringify(statusResponse),
  //           },
  //           { where: { unique_id: uniqueId } }
  //         );

  //         // Call the UpdateUTRDetails procedure
  //         await instaPaymentSequelize.query(
  //           "EXEC UpdateUTRDetails :uniqueId, :utrNumber, :status, :urn",
  //           {
  //             replacements: {
  //               uniqueId,
  //               utrNumber: parsedData.UTRNUMBER || null,
  //               status: parsedData.STATUS || null,
  //               urn: parsedData.URN || null,
  //             },
  //           }
  //         );

  //         if (parsedData.STATUS === "success" && parsedData.UTRNUMBER) {
  //           try {
  //             const techexcelResponse = await entryPayementTechExcel(client_code, amount, parsedData.UTRNUMBER);
  //             const voucherNo = extractVoucherNo(techexcelResponse?.[0]?.returnvalue);

  //             // Update the history table with TechExcel response
  //             await TransactionHistoryModel.update(
  //               { raw_response: JSON.stringify(techexcelResponse) },
  //               { where: { unique_id: uniqueId } }
  //             );

  //             // Update the InstaPayementModel with TechExcel response
  //             await InstaPayementModel.update(
  //               { voucher_no: voucherNo },
  //               { where: { unique_id: uniqueId } }
  //             );

  //             logger.info(`VoucherNo extracted and updated: ${voucherNo}`);
  //           } catch (err) {
  //             logger.warn("TechExcel API call failed:", err.message);
  //           }
  //         }

  //         logger.info(`Transaction updated successfully for uniqueId: ${uniqueId}`);
  //       }
  //     } catch (error) {
  //       logger.error(`Error processing transaction with uniqueId ${uniqueId}: ${error.message}`);
  //       console.error(`Error processing transaction with uniqueId ${uniqueId}:`, error);
  //     }
  //   }
  // } catch (error) {
  //   logger.error("Error updating pending transactions:", error.message);
  //   console.error("Error updating pending transactions:", error); // Add detailed error logging
  // }
};

export default updatePendingTransactions;
