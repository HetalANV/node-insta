import { DataTypes } from "sequelize";
import { instaPaymentSequelize } from "../config/dbConnection.js";

const TransactionHistoryModel = instaPaymentSequelize.define('TransactionHistoryModel', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  payment_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'References the id in tbl_insta_payment'
  },
  unique_id: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Transaction reference number'
  },
  client_code: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  bank_acc_no: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  bank_ifsc: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  bene_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  payment_status: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  raw_response: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Full API response as JSON string'
  },
  urn: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  utr_number: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: instaPaymentSequelize.literal('CURRENT_TIMESTAMP'), // 
    allowNull: true,
  },
  created_by: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'system-cron'
  },
}, {
  tableName: 'tbl_transaction_history',
  timestamps: false,
});

export default TransactionHistoryModel;