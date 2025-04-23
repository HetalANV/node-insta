import https from "https";
import fs from "fs";
import { generateNonce } from "../utils/mTLS.js";
import logger from "../logger/winston.logger.js";

export const mtsUserfyUser = async (req, res, next) => {
  const { client_code } = req.body;

  if (!client_code) {
    return res.status(400).json({ error: "Missing client_code in request body" });
  }

  try {
    const nonce = generateNonce(client_code);

    const cert = fs.readFileSync(process.env.CLIENT_CERT);
    const key = fs.readFileSync(process.env.CLIENT_KEY);
    const ca = fs.readFileSync(process.env.CA_CERT);

    const options = {
      hostname: process.env.JAVA_API_HOST || "localhost",
      port: process.env.JAVA_API_PORT || 8443,
      path: `/payment/validate-nonce?nonce=${encodeURIComponent(nonce)}`,
      method: "GET",
      key,
      cert,
      ca,
      rejectUnauthorized: true,
    };

    console.log("\x1b[35mSending mTLS request with nonce...\x1b[0m");

    const mreq = https.request(options, (mres) => {
      let data = "";

      mres.on("data", (chunk) => (data += chunk));
      mres.on("end", () => {
        console.log("\x1b[35mResponse from Java:\x1b[0m", data);
        if (mres.statusCode === 200) {
          logger.info("mTLS nonce check successful");
          req.user = { username: client_code, nonce }; // Attach minimal user info
          next();
        } else {
          logger.error("mTLS nonce check failed:", data);
          res.status(403).json({ error: "Client verification failed via mTLS" });
        }
      });
    });

    mreq.on("error", (e) => {
      logger.error("mTLS request error:", e);
      res.status(500).json({ error: "Internal mTLS verification error" });
    });

    mreq.end();
  } catch (err) {
    console.error("Nonce middleware error:", err);
    res.status(500).json({ error: "Failed to perform mTLS verification" });
  }
};
