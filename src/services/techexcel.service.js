// services/techexcelService.js

import moment from "moment";
import { makeTechExcelApiCall } from "../utils/techExcel.js";

export const entryPayementTechExcel = async (
  client_code,
  amount,
  utrNumber // Add utrNumber as a parameter
) => {

  const UrlDataYear = moment().format("YYYY");
  const voucherDate = moment().format("DD/MM/YYYY");
  const postCOCDdata = "NSE_CASH";
  const bank_Codedata = "ICICI 1596";
  const narration = "PAID TO CLIENT"

  const records = await makeTechExcelApiCall(
    "/PaymentNormal/PaymentNormal",
    {
      AccountCode: client_code,
      VoucherDate: voucherDate,
      PostCOCDdata: postCOCDdata,
      Bank_Codedata: bank_Codedata,
      Amount: amount,
      Chequeno: '',
      NARRATION: narration,
      ReferanceNo: utrNumber, // Use utrNumber as ReferanceNo
      LiveExport: '',
      RecoDate: '',
      CHEQUE_CAN: '',
    },
    UrlDataYear
  );

  return records;
};