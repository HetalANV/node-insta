import dotenv from "dotenv";
import startApp from "./loader/index.loader.js";
import cron from "node-cron";
import updatePendingTransactions from "./jobs/transactionStatusUpdater.js";

// Set up cron job to run every 5 minutes
cron.schedule('*/1 * * * *', () => {
  console.log('Running transaction status check...');
  updatePendingTransactions();
});

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
