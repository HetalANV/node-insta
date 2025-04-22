import express from "express";
import { getInstaPayment, processInstaPayment } from "../controllers/instaPayment.controller.js";
import { verifyUser } from "../middlewares/auth.middleware.js";


const router = express.Router();
// ✅ Define POST Route

// router.route("/pennydrop").post(verifyUser, processPennyDropPayment);
router.route("/instanet").post(verifyUser, processInstaPayment);
router.route("/").get(verifyUser, getInstaPayment);

export default router;
