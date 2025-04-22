import { instaPaymentSequelize } from "../config/dbConnection.js";

const instaPayementDB = async () => {
  try {
    await instaPaymentSequelize.authenticate();
    console.log("💽 CONNECT_ARHAM DB Connection has been established successfully.");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }

  return { instaPaymentSequelize };
};

export default instaPayementDB;
