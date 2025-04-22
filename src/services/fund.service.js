// services/fundService.js
import FundPayOutMasterModel from "../models/FundPayOutMasterModel.js";

export const findOrCreateFundRecord = async ({ beneAccNo, beneIFSC, beneName, micr_code, bankName, client_code, amount }) => {
  let fund = await FundPayOutMasterModel.findOne({
    where: { BankAccNo: beneAccNo, BankIFSC: beneIFSC, beneName }
  });

  if (!fund) {
    fund = await FundPayOutMasterModel.create({
      BankAccNo: beneAccNo,
      BankIFSC: beneIFSC,
      beneName,
      Amount: amount,
      BankName: bankName,
      UCC: client_code,
      Segment: "NSE_CASH",
      BankMicr: micr_code,
    });
  }

  return fund;
};
