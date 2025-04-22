import axios from "axios";
import InstaPayementModel from "../models/instaPaymentModel.js";
import FundPayOutMasterModel from "../models/FundPayOutMasterModel.js";
import { getBankDetails } from "../services/bank.service.js";
import { findOrCreateFundRecord } from "../services/fund.service.js";
import { makePayment } from "../services/payment.service.js";
import logger from "../logger/winston.logger.js";
import { paginate } from "../utils/pagination.js";

export const processInstaPayment = async (req, res) => {
  const username = req.user?.username;
  const { client_code, amount, bank_acno } = req.body;

  logger.info(`Processing InstaPayment for client: ${client_code}`);

  // Check if a successful payment already exists for the client
  const existingPayment = await InstaPayementModel.findOne({
    where: {
      client_code,
      BankAccNo: bank_acno,
      paymentStatus: 'success',
    },
  });

  if (existingPayment) {
    return res.status(400).json({
      success: false,
      message: "A successful payment already exists for this client and account.",
    });
  }

  // 1. Get bank details
  const bankDetails = await getBankDetails(client_code, req.headers);

  // Check if bankDetails is an array and has elements
  const bankDetail = bankDetails.find(b => b.bank_acno === bank_acno);

  if (!bankDetail) {
    return res.status(404).json({
      success: false,
      message: "No bank details found for the client",
    });
  }

  const { bank_acno: beneAccNo, ifsc_code_act: beneIFSC, client_name: beneName, micr_code, bank_name: bankName } = bankDetail;

  // 2. Create/Get Fund Master
  const fundRecord = await findOrCreateFundRecord({
    beneAccNo,
    beneIFSC,
    beneName,
    micr_code,
    bankName,
    client_code,
    amount
  });

  const rowId = fundRecord.Row_ID;

  // 3. Payment
  let paymentResponse;
  const isRTGS = amount < 200000;
  const nameField = isRTGS ? "payeeName" : "beneName";

  // Build payload accordingly
  const paymentPayload = {
    beneAccNo,
    beneIFSC,
    amount,
    [nameField]: beneName,
  };

  let uniqueId = '';
  let paymentStatus = '';

  try {

    paymentResponse = await makePayment(req.headers.authtoken, paymentPayload);
    const parsedData = JSON.parse(paymentResponse.data?.data || '{}');
    uniqueId = parsedData.UNIQUEID;
    paymentStatus = parsedData.STATUS;


  } catch (error) {
    console.error("Payment API error:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      headers: error.response?.headers,
    });

    await fundRecord.update({ paymentStatus: "failed" });

    return res.status(500).json({
      success: false,
      message: "Payment API failed",
      error: error.response?.data || error.message,
    });
  }

  const updatedStatus = paymentResponse.data?.status ? "success" : "failed";

  await fundRecord.update({ paymentStatus: updatedStatus });

  // // 4. TechExcel (only if success)
  let voucherNo = null;

  // 5. Log transaction
  try {
    const transaction = await InstaPayementModel.create({
      row_id: Number(rowId), // Ensure numeric
      amount: parseFloat(paymentResponse.data?.amount || amount), // Ensure decimal
      BankAccNo: beneAccNo.slice(0, 50), // Truncate if necessary
      BankIFSC: beneIFSC.slice(0, 20),
      beneName: beneName.slice(0, 255),
      client_code: client_code,
      response: JSON.stringify(paymentResponse.data || {}), // Ensure string
      source: amount < 200000 ? "rtgs" : "neft",
      created_by: client_code,
      updated_by: username,
      message: paymentResponse.data?.message || "Processed",
      status: updatedStatus,
      paymentStatus: paymentStatus, // Correct field name
      unique_id: uniqueId.slice(0, 100), // Truncate if necessary
      voucher_no: voucherNo ? voucherNo.slice(0, 50) : null, // Handle null
    });

    // Update FundPayOutMasterModel with instapayement_id
    await fundRecord.update({ instapayement_id: transaction.id });

    logger.info(`Payment successful for client: ${client_code}`);

    return res.status(201).json({
      success: true,
      message: "Payment successful",
      transaction: {
        amount: transaction.amount,
        BankAccNo: transaction.BankAccNo,
        BankIFSC: transaction.BankIFSC,
        beneName: transaction.beneName,
        source: transaction.source,
        status: transaction.status,
        paymentStatus: transaction.paymentStatus, // Correct field name
        client_code: transaction.client_code,
        created_by: transaction.created_by,
        updated_by: transaction.updated_by,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at,
      },
    });
  } catch (error) {
    logger.error(`Error creating transaction: ${error.message}`);
    console.error("Error creating transaction:", error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to log transaction",
      error: error.message,
    });
  }
};

export const processPennyDropPayment = async (req, res) => {
  try {
    const authorization = await verifyUser(req.headers.authorization);
    console.log("Authorization:", authorization);

    const { beneAccNo, beneIFSC, amount } = req.body;

    // Validate Required Fields
    if (!beneAccNo || !beneIFSC) {
      return res.status(400).json({
        success: false,
        message: "Missing required input parameters",
        missingFields: {
          beneAccNo: beneAccNo ? "Present" : "Missing",
          beneIFSC: beneIFSC ? "Present" : "Missing",
          amount: amount ? "Present" : "Missing",
        },
      });
    }

    // Construct request payload
    const requestPayload = {
      beneAccNo,
      beneIFSC,
      amount,
    };

    console.log("Request Payload:", requestPayload);

    let response;
    let paymentType = Number(amount) < 200000 ? "rtgs" : "neft";
    let paymentURL = `${process.env.INSTA_PAYMENT_API}/payment/pennydrop`;

    console.log("paymentURL", paymentURL);


    // Fetch Row_ID from tbl_fund_PayOutMaster using bank details
    const fundRecord = await FundPayOutMasterModel.findOne({
      where: {
        BankAccNo: beneAccNo,
        BankIFSC: beneIFSC,

      },
      attributes: ["Row_ID", "BankName"],
    });

    if (!fundRecord) {
      return res.status(404).json({
        success: false,
        message: "No matching fund record found in tbl_fund_PayOutMaster",
      });
    }

    const rowId = fundRecord.Row_ID;


    // Process payment request
    try {
      response = await axios.post(paymentURL, requestPayload, {
        headers: {
          Authorization: req.headers.authorization,
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      console.error("Payment API Error:", error.response?.data);
      console.log("error.message", error.message);


      // Update paymentStatus as failed in tbl_fund_PayOutMaster
      await FundPayOutMasterModel.update(
        { paymentStatus: "failed" },
        { where: { Row_ID: rowId } }
      );

      return res.status(500).json({
        success: false,
        message: "Payment processing failed",
        error: error.response?.data || error.message,
      });
    }

    console.log("API Response:", response.data);

    // Update tbl_fund_PayOutMaster with payment status
    const updatedStatus = response.data.status ? "success" : "failed";
    await FundPayOutMasterModel.update(
      { paymentStatus: updatedStatus },
      { where: { Row_ID: rowId } }
    );


    // Save transaction in InstaPayementModel
    const transaction = await InstaPayementModel.create({
      row_id: rowId,
      amount: 1,
      response: response.data,
      source: paymentType,
      created_by: authorization.data.username,
      message: response.data.message || "Transaction processed",
      status: updatedStatus
    });

    console.log("Transaction Record:", transaction);


    return res.status(201).json({
      success: true,
      message: "Transaction processed successfully",
      transaction: {
        fundDetails: fundRecord,
      },
    });
  } catch (error) {
    console.error("Error processing Payment: =====", error.response?.data || error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.response?.data || error.message,
    });
  }
};

export const getInstaPayment = async (req, res) => {
  logger.info("Fetching InstaPayments...");

  try {
    const { page = 1, limit = 10 } = req.query; // Default to 1 and 10 if not provided
    const parsedPage = parseInt(page, 10); // Ensure page is an integer
    const parsedLimit = parseInt(limit, 10); // Ensure limit is an integer

    if (isNaN(parsedPage) || isNaN(parsedLimit)) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters. 'page' and 'limit' must be numbers.",
      });
    }

    const query = paginate(
      {
        order: [["created_at", "DESC"]], // Sort by created_at in descending order
      },
      parsedPage,
      parsedLimit
    );

    const payments = await InstaPayementModel.findAndCountAll(query);

    // Pick only specific fields from each payment
    const formattedPayments = payments.rows.map(payment => ({
      amount: payment.amount,
      BankAccNo: payment.BankAccNo,
      BankIFSC: payment.BankIFSC,
      beneName: payment.beneName,
      source: payment.source,
      paymentStatus: payment.paymentStatus,
      created_by: payment.created_by,
      updated_by: payment.updated_by,
      created_at: payment.created_at,
      updated_at: payment.updated_at,
    }));

    logger.info("Fetched InstaPayments successfully");

    res.status(200).json({
      success: true,
      count: payments.count,
      totalPages: Math.ceil(payments.count / parsedLimit),
      currentPage: parsedPage,
      data: formattedPayments,
    });
  } catch (error) {
    logger.error(`Error fetching InstaPayments: ${error.message}`);

    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

