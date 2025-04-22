// services/paymentService.js
import axios from "axios";
import logger from "../logger/winston.logger.js";


export const makePayment = async (authToken, payload) => {
  const paymentType = payload.amount < 200000 ? "rtgs" : "neft";
  const url = `${process.env.INSTA_PAYMENT_API}/${paymentType}`;

  try {
    logger.info(`Making payment request to: ${url}`);
    return axios.post(url, payload, {
      headers: {
        Authorization: authToken,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    logger.error(`Payment request failed: ${error.message}`);
    throw error;
  }
};

export const fetchTransactionStatus = async (authToken, uniqueId, source) => {
  try {

    // Determine the API endpoint based on the source
    const endpoint = source === "rtgs" ? "rtgs" : "neft";
    const url = `${process.env.INSTA_PAYMENT_API}/${endpoint}/tx-status?transRefNo=${uniqueId}`;
    console.log('\x1b[36murl ==========>>>\x1b[0m', url);
    console.log('\x1b[36mSuperman🦸🏻‍♂️\x1b[0m ==========>>>', authToken);

    logger.info(`Fetching transaction status for: ${uniqueId}`);
    const response = await axios.get(url, {
      headers: {
        Authorization: authToken.authtoken,
        "Content-Type": "application/json",
      },
    });
    logger.info(`Transaction status fetched successfully: ${uniqueId}`);

    return response.data;
  } catch (error) {
    logger.error(`Error fetching transaction status: ${error.message}`);

    console.error("Error fetching transaction status:", error.message);
    throw new Error("Failed to fetch transaction status");
  }
};

/**
 * Parse the nested JSON string in the response
 * @param {Object} statusResponse - The response from the status API
 * @returns {Object|null} - Parsed data or null if parsing failed
 */

export const parseResponseData = (statusResponse) => {
  if (statusResponse.data && typeof statusResponse.data === 'string') {
    try {
      return JSON.parse(statusResponse.data.trim());
    } catch (parseError) {
      console.error('Error parsing nested JSON:', parseError);
      return null;
    }
  }
  return null;
}

