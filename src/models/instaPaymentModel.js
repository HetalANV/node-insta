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
    defaultValue: instaPaymentSequelize.literal('CURRENT_TIMESTAMP'),
    allowNull: true,
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
  uuid: {
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
  tableName: 'tbl_insta_payment',
  timestamps: false,
  freezeTableName: true,
  hooks: {
    beforeFind(options) {
      if (options.where && options.where.payment_status) {
        options.where.paymentStatus = options.where.payment_status;
        delete options.where.payment_status;
      }
    }
  }
});

InstaPaymentModel.sync({ alter: false });

export default InstaPaymentModel;
