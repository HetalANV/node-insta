import { Op } from "sequelize";
import InstaPayementModel from "../models/instaPaymentModel.js";
import TransactionHistoryModel from "../models/TransactionHistoryModel.js";
import { paginate } from "../utils/pagination.js";
import logger from "../logger/winston.logger.js";
import { fetchTransactionStatus } from "../services/payment.service.js";
import fs from 'fs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import https from 'https';
import axios from 'axios';
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
    const { startDate, endDate, page = 1, limit = 10 } = req.body;

    const currentDate = new Date().toISOString().split("T")[0];
    const start = startDate || currentDate;
    const end = endDate || currentDate;

    const conditions = {
      payment_status: 'PENDING FOR APPROVAL',
      created_at: {
        [Op.between]: [new Date(`${start}T00:00:00Z`), new Date(`${end}T23:59:59Z`)],
      },
    };

    const query = paginate(
      {
        attributes: { exclude: ['raw_response', 'urn'] },
        where: conditions,
        order: [['created_at', 'DESC']],
      },
      page,
      limit
    );

    const historyRecords = await TransactionHistoryModel.findAndCountAll(query);

    if (historyRecords.rows.length === 0) {
      return res.status(200).json({
        status: 'error',
        message: 'No records found for the given criteria',
      });
    }

    // === NEW LOGIC: Loop and update status from API ===
    for (const record of historyRecords.rows) {
      const { unique_id: uniqueId } = record;
      const paymentEntry = await InstaPayementModel.findOne({ where: { unique_id: uniqueId } });

      if (!paymentEntry) continue;

      const { source, client_code, amount } = paymentEntry;

      try {
        const statusResponse = await fetchTransactionStatus(req.headers, uniqueId, source);
        const parsedData = parseResponseData(statusResponse);

        if (parsedData) {
          // Update Transaction Table
          await updateTransaction(paymentEntry, parsedData, statusResponse);

          // Update History Table
          await TransactionHistoryModel.update(
            {
              payment_status: parsedData.STATUS || 'pending',
              utr_number: parsedData.UTRNUMBER || null,
              urn: parsedData.URN || null,
              raw_response: JSON.stringify(statusResponse),
            },
            { where: { unique_id: uniqueId } }
          );

          // Call stored procedure
          await instaPaymentSequelize.query(
            "EXEC UpdateUTRDetails :uniqueId, :utrNumber, :status, :urn",
            {
              replacements: {
                uniqueId,
                utrNumber: parsedData.UTRNUMBER || null,
                status: parsedData.STATUS || null,
                urn: parsedData.URN || null,
              },
            }
          );

          if (parsedData.STATUS === "success" && parsedData.UTRNUMBER) {
            try {
              console.log("parsedData.UTRNUMBER ==========>>>\x1b[0m", parsedData.STATUS, parsedData.UTRNUMBER);

              // const techexcelResponse = await entryPayementTechExcel(client_code, amount, parsedData.UTRNUMBER);
              // const voucherNo = extractVoucherNo(techexcelResponse?.[0]?.returnvalue);

              await TransactionHistoryModel.update(
                { raw_response: JSON.stringify(techexcelResponse) },
                { where: { unique_id: uniqueId } }
              );

              await InstaPayementModel.update(
                { voucher_no: voucherNo },
                { where: { unique_id: uniqueId } }
              );
            } catch (te) {
              logger.warn(`TechExcel call failed: ${te.message}`);
            }
          }
        }
      } catch (err) {
        logger.error(`Failed to update status for ${uniqueId}: ${err.message}`);
      }
    }

    // Re-fetch updated data after potential changes
    const updatedRecords = await TransactionHistoryModel.findAndCountAll(query);

    return res.status(200).json({
      status: 'success',
      count: updatedRecords.count,
      totalPages: Math.ceil(updatedRecords.count / limit),
      currentPage: parseInt(page, 10),
      data: updatedRecords.rows,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

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

export const payAPI = async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount) {
      return res.status(400).send('Amount and User ID are required');
    }

    const privateKey = fs.readFileSync(process.env.PRIVATE_KEY, 'utf8');
    if (!privateKey) {
      throw new Error('Private key not found');
    }
    const nonce = crypto.randomBytes(16).toString('hex');
    const iat = Math.floor(Date.now() / 1000);

    const payload = {
      iss: 'main-node-service',
      sub: 'initiate-payment',
      aud: 'payment-service',
      iat,
      exp: iat + 60,
      nonce,
      user_id: 123,
      scope: 'payment:process'
    };

    const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });
    console.log('\x1b[36mtoken ==========>>>\x1b[0m', token);

    const agent = new https.Agent({
      cert: fs.readFileSync(process.env.CLIENT_CRT),
      key: fs.readFileSync(process.env.CLIENT_KEY),
      ca: fs.readFileSync(process.env.CA_PEM),
      rejectUnauthorized: true
    });

    const response = axios.post(process.env.JAVA_SERVER_URL, payload, {
      headers: { Authorization: `Bearer ${token}` },
      httpsAgent: agent
    });

    // console.log('\x1b[36mSuperman🦸🏻‍♂️\x1b[0m ==========>>>', response.data);
    return res.status(200).json({
      status: 'success',
      message: 'Payment initiated successfully',
      data: response.data
    });
  } catch (err) {
    console.error('❌ Payment error:', err.message);
    res.status(500).send('Payment failed: ' + err.message);
  }
};





