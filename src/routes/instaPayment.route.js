import express from "express";
import { processInstaPayment } from "../controllers/instaPayment.controller.js";
import { verifyUser } from "../middlewares/auth.middleware.js";


const router = express.Router();

// ✅ Define POST Route
router.route("/payment").post(verifyUser, processInstaPayment);

export default router;
