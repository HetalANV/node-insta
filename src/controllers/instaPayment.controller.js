import axios from "axios";
import InstaPayementModel from "../models/instaPaymentModel.js";
import FundPayOutMasterModel from "../models/FundPayOutMasterModel.js";
import { getBankDetails } from "../services/bank.service.js";
import { findOrCreateFundRecord } from "../services/fund.service.js";
import { initiatePaymentWithJWT } from "../services/payment.service.js";
import logger from "../logger/winston.logger.js";
import moment from 'moment';


export const processInstaPayment = async (req, res) => {
  const username = req.user?.username;
  const { client_code, amount, bank_acno } = req.body;

  logger.info(`Processing InstaPayment for client: ${client_code}`);

  // Check if a successful payment exists for the client today
  const today = moment().startOf('day').format('YYYY-MM-DD');

  // Using Sequelize literal for proper date handling
  const existingPayment = await InstaPayementModel.findOne({
    where: {
      client_code,
      BankAccNo: bank_acno,
      paymentStatus: 'success',
      // created_at: {
      //   [Op.gte]: Sequelize.literal(`CAST('${today}' AS DATE)`)
      // }
    },
  });

  if (existingPayment) {
    return res.status(400).json({
      success: false,
      message: "A successful payment already exists for this client and account today. Please try again tomorrow.",
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
    paymentResponse = await initiatePaymentWithJWT(paymentPayload, client_code, req.user);
    console.log('\x1b[36mpaymentResponse ==========>>>\x1b[0m', paymentResponse);

    // Parse the nested response string
    const responseData = JSON.parse(paymentResponse?.data?.transactionDetails?.response || '{}');
    uniqueId = responseData.UNIQUEID;
    paymentStatus = responseData.STATUS || 'PENDING';

  } catch (error) {
    logger.error("Error while verifying micro service:");

    await fundRecord.update({ paymentStatus: "failed" });

    return res.status(500).json({
      success: false,
      message: "Payment API failed",
      error: error.response?.data || "Unable to process your request at the moment. Please try again later.",
    });
  }

  const updatedStatus = paymentResponse.data?.status ? "success" : "failed";

  await fundRecord.update({ status: updatedStatus });

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
      status: paymentResponse.data?.status,
      paymentStatus: paymentStatus,
      uuid: paymentResponse.data?.transactionDetails?.uuid,
      unique_id: uniqueId, // Truncate if necessary
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
        unique_id: uniqueId,
        paymentStatus: transaction.paymentStatus, // Correct field name
        uuid: paymentResponse.data?.transactionDetails?.uuid,
        client_code: transaction.client_code,
        created_by: transaction.created_by,
        updated_by: transaction.updated_by,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at,
      },
    });
  } catch (error) {
    logger.error(`Error creating transaction: ${error.message}`);

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


