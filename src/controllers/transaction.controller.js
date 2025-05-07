import { Op } from "sequelize";
import InstaPayementModel from "../models/instaPaymentModel.js";
import TransactionHistoryModel from "../models/TransactionHistoryModel.js";
import logger from "../logger/winston.logger.js";
import { fetchTransactionStatus, parseResponseData } from "../services/payment.service.js";

import InstaPaymentModel from "../models/instaPaymentModel.js";
import { entryPayementTechExcel } from "../services/techexcel.service.js";
import { generateJWT, generateToken } from "../utils/mTLS.js";
/**
 * API endpoint to fetch transaction history
 */
export const getTransactionStatus = async (req, res) => {
  try {
    const { uniqueId } = req.query;

    // Validate uniqueId
    if (!uniqueId) {
      return res.status(400).json({
        status: 'error',
        message: 'Transaction uniqueId is required',
      });
    }

    // Check if the transaction exists in the database
    const transaction = await InstaPayementModel.findOne({
      where: { unique_id: uniqueId },
    });

    if (!transaction) {
      return res.status(404).json({
        status: 'error',
        message: 'Transaction not found',
      });
    }

    // Get history records for this transaction
    const historyRecords = await TransactionHistoryModel.findAll({
      where: { unique_id: uniqueId },
      order: [['created_at', 'DESC']],
    });

    // Return the history records
    res.status(200).json({
      status: 'success',
      message: 'Transaction history fetched successfully',
      statusHistory: historyRecords,
    });
  } catch (error) {
    console.error("Error fetching transaction history:", error.message);
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

export const getTransactionHistory = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      clientCode,
      page = 1,
      limit = 10,
    } = req.body;

    const offset = (page - 1) * limit;


    // Safely convert to Date objects
    const start = new Date(startDate || new Date());
    const end = new Date(endDate || new Date());

    // Make sure they are valid dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid date format provided',
      });
    }

    // Normalize to start and end of day
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    // Now use in where clause
    const whereClause = {
      paymentStatus: "PENDING FOR APPROVAL",
    };

    // Only add client_code filter if it exists
    if (clientCode && clientCode.trim() !== "") {
      whereClause.client_code = clientCode;
    }


    // Fetch total count for pagination
    const totalCount = await InstaPaymentModel.count({ where: whereClause });

    const pendingTransactions = await InstaPaymentModel.findAll({
      where: whereClause,
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    if (!pendingTransactions.length) {
      return res.status(200).json({
        message: "No pending transactions found.",
        count: 0,
        totalPages: 0,
        currentPage: page,
        data: [],
      });
    }

    const authToken = {
      authtoken:
        req.headers["authToken"] ||
        req.headers["auth-token"] ||
        req.headers["authtoken"],
    };

    await Promise.all(
      pendingTransactions.map(async (transaction) => {
        try {
          const result = await fetchTransactionStatus(
            authToken,
            transaction.unique_id,
            transaction.source
          );

          // Update main table
          transaction.paymentStatus = result.paymentStatus;
          transaction.utrn = result.utrn;
          transaction.updated_at = new Date();
          await transaction.save();

          // Log to history
          await TransactionHistoryModel.create({
            payment_id: transaction.id,
            unique_id: transaction.unique_id,
            client_code: transaction.client_code,
            bank_acc_no: transaction.BankAccNo,
            bank_ifsc: transaction.BankIFSC,
            bene_name: transaction.beneName,
            amount: transaction.amount,
            status: transaction.status,
            payment_status: result.paymentStatus,
            raw_response: JSON.stringify(result),
            urn: result.urn || null,
            utr_number: result.utrn || null,
            created_by: "system-api",
          });



          // If payment is successful, call TechExcel API
          // If the payment status is SUCCESS, call the TechExcel API
          if (result.paymentStatus === "COMPLETED") {
            const techexcelResponse = await entryPayementTechExcel(
              transaction.client_code,
              transaction.amount,
              result.utrn
            );
            const voucherNo = extractVoucherNo(techexcelResponse?.[0]?.returnvalue);
            console.log('\x1b[36mvoucherNo ==========>>>\x1b[0m', voucherNo);

            // Update the transaction with the voucher number
            await InstaPaymentModel.update(
              { voucher_no: voucherNo },
              { where: { unique_id: transaction.unique_id } }
            );
          }
        } catch (error) {
          logger.error(
            `Error processing transaction ${transaction.unique_id}: ${error.message}`
          );
        }
      })
    );

    // Refetch updated list after processing
    const updatedRecords = await InstaPaymentModel.findAll({
      attributes: { exclude: ['response'] },
      where: whereClause,
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({
      status: "success",
      message: "Processed all pending transactions.",
      count: totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page, 10),
      data: updatedRecords,
    });
  } catch (error) {
    logger.error("getTransactionHistory error: ", error.message);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const processPendingTransactionsCron = async () => {
  try {
    const start = new Date();
    const end = new Date();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const whereClause = {
      paymentStatus: "PENDING FOR APPROVAL",
    };

    const pendingTransactions = await InstaPaymentModel.findAll({
      where: whereClause,
      order: [["created_at", "DESC"]],
    });

    if (!pendingTransactions.length) {
      console.log("No pending transactions found.");
      return;
    }

    await Promise.all(
      pendingTransactions.map(async (transaction) => {
        try {
          logger.info(`Processing transaction with uniqueId: ${transaction.client_code}`);
          // Generate token here (if Java API still needs it temporarily)
          const token = await generateToken(transaction.client_code); // implement as needed
          console.log('\x1b[36mtoken ==========>>>\x1b[0m', token);

          const result = await fetchTransactionStatus(
            { authtoken: token },
            transaction.unique_id,
            transaction.source
          );

          // Update main table
          transaction.paymentStatus = result.paymentStatus;
          transaction.utrn = result.utrn;
          transaction.updated_at = new Date();
          await transaction.save();

          // Log to history
          await TransactionHistoryModel.create({
            payment_id: transaction.id,
            unique_id: transaction.unique_id,
            client_code: transaction.client_code,
            bank_acc_no: transaction.BankAccNo,
            bank_ifsc: transaction.BankIFSC,
            bene_name: transaction.beneName,
            amount: transaction.amount,
            status: transaction.status,
            payment_status: result.paymentStatus,
            raw_response: JSON.stringify(result),
            urn: result.urn || null,
            utr_number: result.utrn || null,
            created_by: "system-cronjob",
          });

          if (result.paymentStatus === "COMPLETED") {
            const techexcelResponse = await entryPayementTechExcel(
              transaction.client_code,
              transaction.amount,
              result.utrn
            );
            const voucherNo = extractVoucherNo(techexcelResponse?.[0]?.returnvalue);
            console.log('\x1b[36mVoucher No:\x1b[0m', voucherNo);

            await InstaPaymentModel.update(
              { voucher_no: voucherNo },
              { where: { unique_id: transaction.unique_id } }
            );
          }
        } catch (error) {
          logger.error(`Error processing transaction ${transaction.unique_id}: ${error.message}`);
        }
      })
    );

    console.log("Cron job completed: All pending transactions processed.");
  } catch (error) {
    logger.error("Cron job error in processPendingTransactionsCron:", error.message);
  }
};



// export const getTransactionHistory = async (req, res) => {
//   try {
//     const { startDate, endDate, page = 1, limit = 10 } = req.body;

//     const currentDate = new Date().toISOString().split("T")[0];
//     const start = startDate || currentDate;
//     const end = endDate || currentDate;

//     // const conditions = {
//     //   paymentStatus: 'PENDING FOR APPROVAL',
//     //   created_at: {
//     //     [Op.and]: Sequelize.literal(`CAST(created_at AS DATETIME) BETWEEN '${start}' AND '${end}'`),
//     //   },
//     // };


//     // const query = paginate(
//     //   {
//     //     attributes: { exclude: ['raw_response', 'urn'] },
//     //     where: conditions,
//     //     order: [['created_at', 'DESC']],
//     //   },
//     //   page,
//     //   limit
//     // );
//     // console.log('\x1b[36mSuperman🦸🏻‍♂️\x1b[0m ==========>>>', query);


//     // const historyRecords = await InstaPayementModel.findAll(query);

//     const pendingTransactions = await InstaPaymentModel.findAll({
//       where: { paymentStatus: "PENDING FOR APPROVAL" },
//     });

//     if (!pendingTransactions.length) {
//       return res.status(200).json({ message: "No pending transactions found." });
//     }

//     const authToken = {
//       authtoken: req.headers["authToken"] || req.headers["auth-token"] || req.headers["authtoken"],
//     };

//     console.log("pendingTransactions", pendingTransactions);


//     await Promise.all(pendingTransactions.map(async (transaction) => {
//       try {
//         const result = await fetchTransactionStatus(authToken, transaction.unique_id, transaction.source);
//         console.log('\x1b[36mTransaction result ==========>>>\x1b[0m', result);

//         // Update the InstaPayment record
//         transaction.paymentStatus = result.paymentStatus;
//         transaction.utrn = result.utrn;
//         transaction.updated_at = new Date();
//         await transaction.save();

//         // Log to history
//         await TransactionHistoryModel.create({
//           payment_id: transaction.id,
//           unique_id: transaction.unique_id,
//           client_code: transaction.client_code,
//           bank_acc_no: transaction.BankAccNo,
//           bank_ifsc: transaction.BankIFSC,
//           bene_name: transaction.beneName,
//           amount: transaction.amount,
//           status: transaction.status,
//           payment_status: result.paymentStatus,
//           raw_response: JSON.stringify(result),
//           urn: result.urn || null,
//           utr_number: result.utrn || null,
//           created_by: 'system-api',
//         });

//         // If payment is successful, call TechExcel API
//         if (result.paymentStatus === "SUCCESS") {
//           await callTechExcelAPI(transaction);
//         }

//       } catch (error) {
//         logger.error(`Error processing transaction ${transaction.unique_id}: ${error.message}`);
//       }
//     }));

//     return res.status(200).json({ message: "Processed all pending transactions." });
//     // if (!Array.isArray(historyRecords.rows)) {
//     //   return res.status(500).json({
//     //     status: 'error',
//     //     message: 'Unexpected data format for history records',
//     //   });
//     // }

//     // === NEW LOGIC: Loop and update status from API ===
//     // for (const record of historyRecords.rows) {
//     //   const { unique_id: uniqueId } = record;
//     //   const paymentEntry = await InstaPayementModel.findOne({ where: { unique_id: uniqueId } });

//     //   if (!paymentEntry) continue;

//     //   const { source, client_code, amount } = paymentEntry;

//     //   try {
//     //     const statusResponse = await fetchTransactionStatus(req.headers, uniqueId, source);
//     //     const parsedData = parseResponseData(statusResponse);

//     //     if (parsedData) {
//     //       // Update Transaction Table
//     //       await updateTransaction(paymentEntry, parsedData, statusResponse);

//     //       // Update History Table
//     //       await TransactionHistoryModel.update(
//     //         {
//     //           payment_status: parsedData.STATUS || 'pending',
//     //           utr_number: parsedData.UTRNUMBER || null,
//     //           urn: parsedData.URN || null,
//     //           raw_response: JSON.stringify(statusResponse),
//     //         },
//     //         { where: { unique_id: uniqueId } }
//     //       );

//     //       // Call stored procedure
//     //       await instaPaymentSequelize.query(
//     //         "EXEC UpdateUTRDetails :uniqueId, :utrNumber, :status, :urn",
//     //         {
//     //           replacements: {
//     //             uniqueId,
//     //             utrNumber: parsedData.UTRNUMBER || null,
//     //             status: parsedData.STATUS || null,
//     //             urn: parsedData.URN || null,
//     //           },
//     //         }
//     //       );

//     //       if (parsedData.STATUS === "success" && parsedData.UTRNUMBER) {
//     //         try {
//     //           console.log("parsedData.UTRNUMBER ==========>>>\x1b[0m", parsedData.STATUS, parsedData.UTRNUMBER);

//     //           // const techexcelResponse = await entryPayementTechExcel(client_code, amount, parsedData.UTRNUMBER);
//     //           // const voucherNo = extractVoucherNo(techexcelResponse?.[0]?.returnvalue);

//     //           await TransactionHistoryModel.update(
//     //             { raw_response: JSON.stringify(techexcelResponse) },
//     //             { where: { unique_id: uniqueId } }
//     //           );

//     //           await InstaPayementModel.update(
//     //             { voucher_no: voucherNo },
//     //             { where: { unique_id: uniqueId } }
//     //           );
//     //         } catch (te) {
//     //           logger.warn(`TechExcel call failed: ${te.message}`);
//     //         }
//     //       }
//     //     }
//     //   } catch (err) {
//     //     logger.error(`Failed to update status for ${uniqueId}: ${err.message}`);
//     //   }
//     // }

//     // Re-fetch updated data after potential changes
//     // const updatedRecords = await TransactionHistoryModel.findAndCountAll(query);

//     // return res.status(200).json({
//     //   status: 'success',
//     //   count: updatedRecords.count,
//     //   totalPages: Math.ceil(updatedRecords.count / limit),
//     //   currentPage: parseInt(page, 10),
//     //   data: updatedRecords.rows,
//     // });
//   } catch (error) {
//     res.status(500).json({
//       status: 'error',
//       message: error.message,
//     });
//   }
// };

/**
 * API endpoint to view all pending transactions
 */
export const pandingTransactions = async (req, res) => {
  try {
    const pendingTransactions = await InstaPayementModel.findAll({
      where: {
        [Op.or]: [
          { paymentStatus: 'PENDING FOR APPROVAL' },
          { paymentStatus: null, status: 'pending' }
        ]
      }
    });

    res.status(200).json({
      status: 'success',
      count: pendingTransactions.length,
      data: pendingTransactions
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};





