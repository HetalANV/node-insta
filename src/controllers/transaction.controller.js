import { Op, Sequelize } from "sequelize";
import moment from 'moment';
import TransactionHistoryModel from "../models/TransactionHistoryModel.js";
import logger from "../logger/winston.logger.js";
import { fetchTransactionStatus } from "../services/payment.service.js";

import InstaPaymentModel from "../models/instaPaymentModel.js";
import { entryPayementTechExcel } from "../services/techexcel.service.js";

// Helper function to format date for SQL Server using moment
const formatDateForSQLServer = (dateStr) => {
  if (!dateStr) return null;
  const date = moment(dateStr, 'YYYY-MM-DD', true);
  return date.isValid() ? date.format('YYYY-MM-DD') : null;
};

const getFormattedDateTime = () => {
  return moment().format('YYYY-MM-DD HH:mm:ss.SSS');
};

export const getAllPayments = async (req, res) => {
  try {
    const { page = 1, limit = 50, client_code, type, start_date, end_date } = req.query;
    logger.info(`getAllPayments called with params: ${JSON.stringify({ page, limit, client_code, type, start_date, end_date })}`);

    const pageInt = parseInt(page, 10);
    const limitInt = parseInt(limit, 10);
    const offset = (pageInt - 1) * limitInt;

    const whereClause = {};
    if (type && type.trim() !== "") {
      whereClause.source = type.trim();
    }
    if (client_code && client_code.trim() !== "") {
      whereClause.client_code = client_code.trim();
    }

    // Format dates using moment and use literal SQL for date comparison
    const formattedStartDate = formatDateForSQLServer(start_date);
    const formattedEndDate = formatDateForSQLServer(end_date);
    logger.debug(`Formatted dates - Start: ${formattedStartDate}, End: ${formattedEndDate}`);

    if (formattedStartDate && formattedEndDate) {
      whereClause.created_at = {
        [Op.and]: [
          Sequelize.literal(`CAST(created_at AS DATE) >= CAST('${formattedStartDate}' AS DATE)`),
          Sequelize.literal(`CAST(created_at AS DATE) <= CAST('${formattedEndDate}' AS DATE)`)
        ]
      };
    } else if (formattedStartDate) {
      whereClause.created_at = Sequelize.literal(`CAST(created_at AS DATE) >= CAST('${formattedStartDate}' AS DATE)`);
    } else if (formattedEndDate) {
      whereClause.created_at = Sequelize.literal(`CAST(created_at AS DATE) <= CAST('${formattedEndDate}' AS DATE)`);
    }

    logger.debug(`Query conditions: ${JSON.stringify(whereClause)}`);
    const { count, rows: payments } = await InstaPaymentModel.findAndCountAll({
      where: whereClause,
      limit: limitInt,
      offset: offset,
      order: [["created_at", "DESC"]],
      attributes: { exclude: ['response'] }
    });

    logger.info(`Found ${count} total records`);

    // Check and update status for pending payments
    const pendingPayments = payments.filter(p => p.paymentStatus === 'PENDING FOR APPROVAL');
    logger.info(`Processing ${pendingPayments.length} pending payments`);

    const updatedPayments = await Promise.all(
      payments.map(async (payment) => {
        const paymentJson = payment.toJSON();

        if (payment.paymentStatus === 'PENDING FOR APPROVAL') {
          logger.debug(`Processing pending payment ID: ${payment.id}, unique_id: ${payment.unique_id}`);
          try {
            const authToken = {
              authtoken: req.headers["authToken"] || req.headers["auth-token"] || req.headers["authtoken"],
            };

            const statusResponse = await fetchTransactionStatus(
              authToken,
              payment.unique_id,
              payment.source
            );

            // Check if payment is successful 
            if (statusResponse?.data?.STATUS === 'SUCCESS' && statusResponse?.data?.UTRNUMBER) {
              logger.info(`Payment successful for ID: ${payment.id}, UTR: ${statusResponse?.data?.UTRNUMBER}`);
              // Call TechExcel API 
              const techexcelResponse = await entryPayementTechExcel(
                payment.client_code,
                payment.amount,
                statusResponse?.data?.UTRNUMBER
              );

              const voucherNo = techexcelResponse?.[0]?.returnvalue || null;

              // Update payment with status and voucher number
              await InstaPaymentModel.update(
                {
                  paymentStatus: 'SUCCESS',
                  voucher_no: voucherNo,
                  utr_number: statusResponse.data.UTRNUMBER
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
                created_by: "system-api"
              });

              return {
                ...paymentJson,
                paymentStatus: 'SUCCESS',
                UTR_Number: statusResponse.data.UTRNUMBER,
                voucher_no: voucherNo
              };
            }

            // For other statuses, just update the status
            await InstaPaymentModel.update(
              {
                paymentStatus: statusResponse.data.STATUS,
                updated_at: Sequelize.literal('GETDATE()'),
                utr_number: statusResponse.data?.UTRNUMBER || null
              },
              { where: { unique_id: payment.unique_id } }
            );

            return {
              ...paymentJson,
              paymentStatus: statusResponse.data.STATUS,
              UTR_Number: statusResponse.data?.UTRNUMBER || null
            };
          } catch (error) {
            logger.error(`Error updating payment status for ${payment.unique_id}: ${error.message}`);
            return paymentJson;
          }
        }
        return {
          ...paymentJson,
          UTR_Number: payment.utr_number || null
        };
      })
    );

    logger.info(`Successfully processed ${updatedPayments.length} payments`);
    res.status(200).json({
      status: 'success',
      message: 'Payment records retrieved successfully',
      data: updatedPayments,
      pagination: {
        totalRecords: count,
        totalPages: Math.ceil(count / limitInt),
        currentPage: pageInt,
        recordsPerPage: limitInt
      },
      filters: {
        client_code: client_code || null,
        type: type || null,
        start_date: start_date || null,
        end_date: end_date || null
      }
    });
  } catch (error) {
    logger.error("getAllPayments failed:", error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};





