import axios from "axios";
import dotenv from "dotenv";
import logger from "../logger/winston.logger.js";
import { getObjectFromData, toLowercaseKeys } from "./utils.js";

dotenv.config({
  path: "./.env",
});

const getTechExcelDB = (dataYear) => {
  const yearToDatabaseMap = {
    2025: process.env.TECHEXCEL_DATABASE_25,
    2024: process.env.TECHEXCEL_DATABASE_24,
    2023: process.env.TECHEXCEL_DATABASE_23,
    2022: process.env.TECHEXCEL_DATABASE_19_22,
    2021: process.env.TECHEXCEL_DATABASE_19_22,
    2020: process.env.TECHEXCEL_DATABASE_19_22,
    2019: process.env.TECHEXCEL_DATABASE_19_22,
  };

  return yearToDatabaseMap[dataYear] || null;
};

export const makeTechExcelApiCall = async (endpoint, params, urlDataYear) => {
  const TECH_API = process.env.TECH_API_URL;

  const credentials = {
    UrlUserName: process.env.TECHEXCEL_USERNAME,
    UrlPassword: process.env.TECHEXCEL_PASSWORD,
    UrlDatabase: getTechExcelDB(urlDataYear),
    UrlDataYear: urlDataYear,
  };

  // Combine dynamic params with fixed credentials
  const allParams = { ...params, ...credentials };

  // Convert params to query string
  const queryString = Object.entries(allParams)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .join("&");

  const fullUrl = `${TECH_API}/techexcelapi/index.cfm${endpoint}?&${queryString}`;

  try {
    logger.info(`API Call URL: ${fullUrl}`);

    const response = await axios.get(fullUrl);

    // Assuming the API always returns data in the first index
    const result = response.data[0];

    const rawData = getObjectFromData(result) || [];
    logger.info(`API Call Successful: ${endpoint}`);
    return rawData.map(toLowercaseKeys);

    // Assuming you have a utility to transform the data
    // return getObjectFromData(result).map(toLowercaseKeys);
  } catch (error) {
    logger.error(`API Call Failed: ${endpoint} || ${error.message}`);
    const logMessage = `${endpoint} || ${error.status} || ${error.message
      } || ${JSON.stringify(allParams)}`;
    logger.error(logMessage);
    throw error.message || "Tech Excel API call failed";
  }
};
