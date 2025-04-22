import { DataTypes } from "sequelize";
import { instaPaymentSequelize } from "../config/dbConnection.js";

const FundPayOutMasterModel = instaPaymentSequelize.define(
  "FundPayOutMaster",
  {
    Row_ID: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    EntryDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: instaPaymentSequelize.literal("CURRENT_TIMESTAMP"),
    },
    UCC: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    Segment: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    BankName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    BankAccNo: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    BankIFSC: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    BankMicr: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    Amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
    },
    tech_excel_push: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ip: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    beneName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    payment_status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    instapayement_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'References the id in InstaPayementModel',
    }
  },
  {
    tableName: "tbl_fund_PayOutMaster",
    timestamps: false, // Since it's an external table
  }
);

export default FundPayOutMasterModel;
