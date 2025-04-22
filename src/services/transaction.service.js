import TransactionHistoryModel from "../models/TransactionHistoryModel.js";
import logger from "../logger/winston.logger.js";

/**
 * Update transaction status in the database
 * @param {Object} transaction - InstaPayment transaction record
 * @param {Object} parsedData - Parsed status response data
 * @param {Object} rawResponse - Raw API response
 * @returns {Promise<Object>} Updated transaction
 */
export const updateTransaction = async (transaction, parsedData, rawResponse) => {
  try {
    logger.info(`Updating transaction: ${transaction.id}`);

    // Format the date for SQL Server
    const now = new Date();

    // Prepare the update payload
    const updatePayload = {
      paymentStatus: parsedData.STATUS,
      response: JSON.stringify(parsedData),
    };

    // If the status is no longer pending, update the main status
    if (parsedData.STATUS !== 'PENDING FOR APPROVAL') {
      updatePayload.status = parsedData.RESPONSE === 'SUCCESS' ? 'completed' : 'failed';
    }

    console.log('\x1b[36mSuperman🦸🏻‍♂️\x1b[0m ==========>>>', updatePayload);

    // Update the transaction
    await transaction.update(updatePayload);
    logger.info(`Transaction updated successfully: ${transaction.id}`);
    console.log('Transaction updated successfully:', transaction);

    // Add history record
    await addTransactionHistory(transaction, parsedData, rawResponse);

    return transaction;
  } catch (error) {
    logger.error(`Error updating transaction: ${error.message}`);
    console.error('Error updating transaction:', error);
    throw error;
  }
};

/**
 * Add transaction status history record
 * @param {Object} transaction - InstaPayment transaction record
 * @param {Object} parsedData - Parsed status response data
 * @param {Object} rawResponse - Raw API response
 * @returns {Promise<Object>} Created history record
 */
export const addTransactionHistory = async (transaction, parsedData, rawResponse) => {
  console.log('transaction ==========>>>71', transaction);
  try {
    logger.info(`Creating transaction history for: ${transaction.id}`);
    return await TransactionHistoryModel.create({
      payment_id: transaction.id,
      unique_id: transaction.unique_id,
      client_code: transaction.client_code,
      bank_acc_no: transaction.BankAccNo,
      bank_ifsc: transaction.BankIFSC,
      bene_name: transaction.beneName,
      amount: transaction.amount,
      status: transaction.status,
      payment_status: parsedData.STATUS,
      raw_response: JSON.stringify(rawResponse),
      urn: parsedData.URN || null,
      utr_number: parsedData.UTRNUMBER || null,
      created_by: 'system-cron'
    });
  } catch (error) {
    logger.error(`Error creating history record: ${error.message}`);
    console.error('Error creating history record:', error);
    throw error;
  }
};
