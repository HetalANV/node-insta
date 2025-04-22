// utils/tokenProvider.js
import { verifyERPToken } from "../services/erp.service.js";
import { verifyTradoToken } from "../services/trado.service.js";

export const getAuthTokenForSource = async (source) => {
  if (source === "connect") {
    // If connect uses encrypted token, you’ll need to decrypt or fetch it here
    throw new Error("Connect source token handling not implemented in cron");
  }

  if (source === "erp") {
    const token = process.env.ERP_AUTH_TOKEN;
    await verifyERPToken(token); // Optionally verify it's valid
    return token;
  }

  if (source === "trado") {
    const token = process.env.TRADO_AUTH_TOKEN;
    await verifyTradoToken(token); // Optionally verify it's valid
    return token;
  }

  throw new Error(`Unknown source: ${source}`);
};
