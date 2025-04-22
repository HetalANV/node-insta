// import https from "https";
// import fs from "fs";
// import jwt from "jsonwebtoken";
// import { generateNonce } from "../utils/mTLS.js"; // Assuming you have a nonce generator utility
// import { verifyERPToken } from "../services/erp.service.js";
// import logger from "../logger/winston.logger.js";

// export const verifyUser = async (req, res, next) => {
//   const authHeader = req.headers.authorization;
//   if (!authHeader || !authHeader.startsWith("Bearer ")) {
//     return res.status(401).json({ error: "Missing or invalid token" });
//   }

//   const token = authHeader.split(" ")[1];
//   try {
//     // Replace 'your-secret-key' with your actual JWT secret or use public key
//     const decoded = await verifyERPToken(token, "your-secret-key");
//     console.log('\x1b[36mdecoded ==========>>>\x1b[0m', decoded);
//     const username = decoded.username;
//     const nonce = generateNonce(username); // your own logic
//     console.log('\x1b[36mnonce ==========>>>\x1b[0m', nonce);
//     const CERT = process.env.CLIENT_CRT;
//     const KEY = process.env.CLIENT_KEY;
//     const CA = process.env.CA_CRT;

//     const options = {
//       hostname: "localhost",
//       port: 8080,
//       path: `/payment/pennydrop`, // Your Java API
//       method: "GET",
//       key: fs.readFileSync(CERT),
//       cert: fs.readFileSync(KEY),
//       ca: fs.readFileSync(CA),
//       rejectUnauthorized: true,
//     };

//     console.log("\x1b[35mSending mTLS request...\x1b[0m");

//     const mreq = http.request(options, (mres) => {
//       console.log("\x1b[35mGot response from Java server\x1b[0m");
//       let data = "";

//       mres.on("data", (chunk) => (data += chunk));
//       mres.on("end", () => {
//         console.log("\x1b[35mResponse from Java:\x1b[0m", data);
//         if (mres.statusCode === 200) {
//           logger.info("mTLS authentication successful");
//           req.user = decoded;
//           next();
//         } else {
//           logger.error("mTLS authentication failed:", data);
//           res.status(403).json({ error: "User verification failed" });
//         }
//       });
//     });


//     mreq.on("error", (e) => {
//       console.error("mTLS call error:", e);
//       logger.error("mTLS call error:", e);
//       res.status(500).json({ error: "Internal authentication error" });
//     });

//     mreq.end();

//   } catch (err) {
//     res.status(401).json({ error: "Invalid token" });
//   }
// };


import https from "https";
import fs from "fs";
import { generateNonce } from "../utils/mTLS.js";
import { verifyERPToken } from "../services/erp.service.js";
import logger from "../logger/winston.logger.js";

export const mtsUserfyUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = await verifyERPToken(token, process.env.JWT_SECRET_KEY);
    const username = decoded.username;
    const nonce = generateNonce(username);
    // Read certificates for mTLS
    const cert = fs.readFileSync(process.env.CLIENT_CERT);
    const key = fs.readFileSync(process.env.CLIENT_KEY);
    const ca = fs.readFileSync(process.env.CA_CERT);



    const options = {
      hostname: process.env.JAVA_API_HOST || "localhost",
      port: process.env.JAVA_API_PORT || 8443, // Use proper HTTPS port
      path: `/payment/validate-nonce?nonce=${encodeURIComponent(nonce)}`,
      method: "GET",
      key: key,
      cert: cert,
      ca: ca,
      rejectUnauthorized: true,
    };

    console.log("\x1b[35mSending mTLS request...\x1b[0m");

    const mreq = https.request(options, (mres) => {
      console.log("\x1b[35mGot response from Java server\x1b[0m");
      let data = "";

      mres.on("data", (chunk) => (data += chunk));
      mres.on("end", () => {
        console.log("\x1b[35mResponse from Java:\x1b[0m", data);
        if (mres.statusCode === 200) {
          logger.info("mTLS authentication successful");
          req.user = decoded;
          // Store nonce in user object for later use
          req.user.nonce = nonce;
          next();
        } else {
          logger.error("mTLS authentication failed:", data);
          res.status(403).json({ error: "User verification failed" });
        }
      });
    });

    mreq.on("error", (e) => {
      console.error("mTLS call error:", e);
      logger.error("mTLS call error:", e);
      res.status(500).json({ error: "Internal authentication error" });
    });

    mreq.end();

  } catch (err) {
    console.error("Token verification error:", err);
    res.status(401).json({ error: "Invalid token" });
  }
};