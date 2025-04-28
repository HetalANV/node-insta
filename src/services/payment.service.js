// services/paymentService.js

import fs from "fs";
import https from "https";

import { generateJWT, generateNonce } from "../utils/mTLS.js";
import axios from "axios";
import logger from "../logger/winston.logger.js";

export const initiatePaymentWithJWT = async (payload, client_code, user) => {

  const nonce = generateNonce();
  console.log('\x1b[35mNonce generated:\x1b[0m', nonce);

  // Step 1: Create JWT
  const jwtPayload = {
    data: {
      client_code,
      username: user.username,
      user_id: user.report_to,
      user_type: user.department_name,
      user_role: user.designation,
      nonce: nonce
    }
  };

  const jwt = generateJWT(jwtPayload);

  // Step 2: Setup mTLS
  const paymentType = payload.amount < 200000 ? "rtgs" : "neft";
  const url = `${process.env.INSTA_PAYMENT_API}/${paymentType}`;

  const httpsAgent = new https.Agent({
    cert: fs.readFileSync(process.env.CLIENT_CERT),  // Your client certificate
    key: fs.readFileSync(process.env.CLIENT_KEY),   // Your private key
    ca: fs.readFileSync(process.env.CA_CERT),        // CA cert (used by Java server to verify client cert)
    rejectUnauthorized: true, // Enforce server cert validation
  });

  try {
    logger.info(`Making payment request to: ${url}`);
    return axios.post(url, payload, {
      headers: {
        Authorization: jwt,
        "Content-Type": "application/json",
      },
      httpsAgent,
    });
  } catch (error) {
    logger.error("Error while using verifying micro service:", error.message);
    throw new ApiError(500, "Unable to process your request at the moment. Please try again later.");
  }

};

export const fetchTransactionStatus = async (authToken, uniqueId, source) => {

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

