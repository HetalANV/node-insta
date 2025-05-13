import fs from "fs";
import https from "https";

import { generateJWT, generateNonce } from "../utils/mTLS.js";
import axios from "axios";
import logger from "../logger/winston.logger.js";

export const initiatePaymentWithJWT = async (payload, client_code, user) => {
  const nonce = generateNonce();
  const jwtPayload = {
    data: {
      client_code,
      user: user.username,
      uid: user.report_to,
      user_type: user.department_name,
      user_role: user.designation,
      nonce: nonce
    }
  };

  const jwt = generateJWT(jwtPayload);

  // Setup mTLS
  const paymentType = payload.amount < 200000 ? "rtgs" : "neft";
  const url = `${process.env.INSTA_PAYMENT_API}/${paymentType}`;

  const httpsAgent = new https.Agent({
    cert: fs.readFileSync(process.env.CLIENT_CERT),
    key: fs.readFileSync(process.env.CLIENT_KEY),
    ca: fs.readFileSync(process.env.CA_CERT),
    rejectUnauthorized: true,
  });

  try {
    logger.info(`Making payment request to: ${url}`);
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: jwt,
        "Content-Type": "application/json",
      },
      httpsAgent,
    });

    logger.info(`Payment response received: ${JSON.stringify(response.data)}`);

    // Handle response data
    if (response.data) {
      // Return the response directly if it's already in the correct format
      if (typeof response.data === 'object' && response.data.data) {
        return {
          data: {
            status: response.data.status,
            message: response.data.message,
            transactionDetails: response.data.data
          }
        };
      }

      // If the response needs parsing
      try {
        const parsedData = typeof response.data === 'string'
          ? JSON.parse(response.data)
          : response.data;

        return {
          data: {
            status: parsedData.status || 'success',
            message: parsedData.message || 'Payment processed',
            transactionDetails: parsedData.data || {}
          }
        };
      } catch (parseError) {
        logger.error(`Error parsing response data: ${parseError.message}`);
        logger.debug(`Raw response data: ${JSON.stringify(response.data)}`);

        // If parsing fails but we still have a response, wrap it in an object
        return {
          data: {
            status: 'success',
            message: 'Payment processed',
            transactionDetails: {}
          }
        };
      }
    }

    // If no data property exists
    throw new Error('Invalid response format from payment service');

  } catch (error) {
    logger.error(`Error while verifying micro service: ${error.message}`);
    logger.error(`Full error object: ${JSON.stringify(error.response || error)}`);

    // If it's an Axios error with a response
    if (error.response) {
      throw new Error(`Payment service error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }

    // For network errors or other issues
    throw new Error(`Unable to process your request at the moment: ${error.message}`);
  }
};

export const fetchTransactionStatus = async (authToken, uniqueId, source) => {
  console.log('\x1b[36mSuperman🦸🏻‍♂️\x1b[0m ==========>>>', authToken);


  const httpsAgent = new https.Agent({
    cert: fs.readFileSync(process.env.CLIENT_CERT),  // Your client certificate
    key: fs.readFileSync(process.env.CLIENT_KEY),   // Your private key
    ca: fs.readFileSync(process.env.CA_CERT),        // CA cert (used by Java server to verify client cert)
    rejectUnauthorized: true, // Enforce server cert validation
  });


  try {

    // Determine the API endpoint based on the source
    const endpoint = source === "rtgs" ? "rtgs" : "neft";
    const url = `${process.env.INSTA_PAYMENT_API}/${endpoint}/tx-status?transRefNo=${uniqueId}`;

    logger.info(`Fetching transaction status for: ${uniqueId}`);
    const response = await axios.get(url, {
      headers: {
        Authorization: authToken.authtoken,
        "Content-Type": "application/json",
      },
      httpsAgent
    });
    logger.info(`Transaction status fetched successfully: ${uniqueId}`);

    return response.data;
  } catch (error) {
    logger.error(`Error fetching transaction status: ${error.message}`);
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

