import dotenv from "dotenv";
import startApp from "./loader/index.loader.js";
// import cron from "node-cron";
// import { checkPendingTransactions } from "./services/cronJob.service.js";
// import TransactionHistoryModel from "./models/TransactionHistoryModel.js";

// Set up cron job to run every 5 minutes
// cron.schedule('*/1 * * * *', () => {
//   console.log('Running transaction status check...');
//   checkPendingTransactions();
// });

// Database sync function
// async function syncDatabase() {
//   try {
//     // Sync the models to create tables if they don't exist
//     await TransactionHistoryModel.sync();
//     console.log('Transaction History table synchronized');
//   } catch (error) {
//     console.error('Error syncing database:', error);
//   }
// }

dotenv.config({
  path: "./.env",
});

const PORT = process.env.PORT || 8003; // Use port from .env or fallback to 8003

try {
  // syncDatabase();
  startApp(PORT); // Pass the port to the startApp function
} catch (error) {
  console.error("Error starting the application:", error.message);
  console.error("Stack trace:", error.stack);
  throw error;
}
