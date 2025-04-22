import express from "express";
import { createServer } from "http";
import cors from "cors";
import { errorHandler } from "./middlewares/error.moddleware.js";
import { APP } from "./constant.js";
import instaPaymentRoutes from "./routes/instaPayment.route.js";
import transactionRoutes from "./routes/transaction.route.js";
import { verifyUser } from "./middlewares/mtls-client.middleware.js";
import dotenv from "dotenv";

dotenv.config();
const app = express(); // Keep only this declaration
const httpServer = createServer(app);

app.use(
  cors({
    origin: "*", // Allow all origins temporarily
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.send(`Welcome to App ${APP}`);
});

app.get("/new", (req, res) => {
  res.send(`Welcome to App ${APP}`);
});

app.use("/v1/payment", instaPaymentRoutes);
app.use("/v1", transactionRoutes);

app.get("/secure-api", verifyUser, (req, res) => {
  res.json({ message: `Hello ${req.user.username}, you're verified via mTLS.` });
});

app.use(errorHandler);

export { httpServer };
