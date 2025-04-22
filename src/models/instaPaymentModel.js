import { DataTypes } from 'sequelize';
import { instaPaymentSequelize } from '../config/dbConnection.js';

const InstaPaymentModel = instaPaymentSequelize.define('InstaPaymentModel', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  row_id: {
    type: DataTypes.NUMERIC(18, 0), // Foreign Key Reference
    allowNull: false,
  },
  client_code: {
    type: DataTypes.STRING, // Assuming it's a currency field
    allowNull: false,
  },
  BankAccNo: {
    type: DataTypes.STRING, // Assuming it's a currency field
    allowNull: false,
  },
  BankIFSC: {
    type: DataTypes.STRING, // Assuming it's a currency field
    allowNull: false,
  },
  beneName: {
    type: DataTypes.STRING, // Assuming it's a currency field
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(18, 2), // Assuming it's a currency field
    allowNull: false,
  },
  response: {
    type: DataTypes.JSON, // Using TEXT to store JSON (JSONB is PostgreSQL specific)
    allowNull: false,
  },
  voucher_no: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: instaPaymentSequelize.literal('CURRENT_TIMESTAMP'), // Default to current timestamp
  },
  created_by: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: "pending",
  },
  source: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  unique_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  paymentStatus: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: instaPaymentSequelize.literal('CURRENT_TIMESTAMP'), // 
    allowNull: true,
  },
  updated_by: {
    type: DataTypes.STRING,
    allowNull: true,
  }
}, {
  tableName: 'tbl_insta_payment', // Set the table name
  timestamps: false, // Enable Sequelize's automatic timestamps
});

export default InstaPaymentModel;
