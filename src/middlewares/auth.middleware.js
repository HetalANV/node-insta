import { verifyERPToken } from "../services/erp.service.js";
import { verifyTradoToken } from "../services/trado.service.js";
import { decryptWithJwt } from "../utils/encryption.js";
import logger from "../logger/winston.logger.js";

export async function verifyUser(req, res, next) {
  logger.info("Verifying user authentication...");
  try {
    const authToken = req.headers["authToken"] || req.headers["auth-token"] || req.headers["authtoken"];
    const correlationId = req.headers["x-request-id"] || "";
    if (!authToken) {
      return res.status(401).json({ message: "Authorization token missing" });
    }

    let payload;
    try {
      if (req.query.source === "connect") {
        // when source is connect token is decrypted here
        payload = decryptWithJwt(authToken);
      } else if (req.query.source === "erp") {
        // when source is erp token is verified here
        payload = await verifyERPToken(authToken);
      } else if (req.query.source === "trado") {
        // when source is trado token is verified here
        payload = await verifyTradoToken(authToken);
      }
      req.user = payload;
      logger.info("User authenticated successfully");
      next();
    } catch (error) {
      logger.error(`Authentication failed: ${error.message}`);
      return res.status(403).json({ message: "Invalid or expired token" });
    }
  } catch (error) {
    if (error.response) {
      return res.status(error.response.status).json({
        message: error.response.data.message || "Authorization failed",
      });
    } else if (error.message) {
      return res
        .status(500)
        .json({ error_message: "No response from authorization server" });
    } else {
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }
}
