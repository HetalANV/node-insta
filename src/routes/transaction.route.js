import express from "express";
import { getAllPayments } from "../controllers/transaction.controller.js";
import { verifyUser } from "../middlewares/auth.middleware.js";


const router = express.Router();
// router.route("/transaction-status").get(verifyUser, getTransactionStatus);
// router.route("/transaction-history").post(verifyUser, getTransactionHistory);
// router.route("/pending-transactions").get(verifyUser, processPendingTransactionsCron);
router.route("/payments").get(verifyUser, getAllPayments);


export default router;
