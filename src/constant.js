export const APP = "instapayement microservices";
export const PORT = process.env.PORT || 3000;
export const SERVER = process.env.SERVER || "localhost";

export const authErrorMessages = {
  // Authentication Errors
  LOGIN_INVALID_CREDENTIALS: "Invalid username or password.",
  USER_NOT_FOUND: "User account not found. Please contact support.",
  ACCOUNT_CLOSED:
    "This account has been closed. Please contact customer support.",

  // API and System Errors
  SYSTEM_ERROR:
    "We're experiencing technical difficulties. Please try again later.",
  NETWORK_ERROR: "Unable to connect. Please check your internet connection.",

  // Specific Service Errors
  CLIENT_DETAILS_NOT_FOUND:
    "Unable to retrieve client information. Please try again.",
  DORMANT_ACCOUNT_CHECK_FAILED:
    "Unable to verify account status. Please contact support.",

  // Validation Errors
  INVALID_INPUT: "Invalid input. Please check your information.",
  MISSING_CREDENTIALS: "Please provide both username and password.",
  INVALID_TOKEN: "Session has expired. Please login again.",
};

// ######### HTTP STATUS CODE ##########
export const httpServerCode = {

  HC_OK: 200,
  HC_CREATED: 201,
  HC_BAD_REQUEST: 400,
  HC_UNAUTHORISED: 401,
  HC_FORBIDDEN: 403,
  HC_NOT_FOUND: 404,
  HC_TOO_MANY_REQUESTS: 429,
  HC_INTERNAL_SERVER_ERROR: 500,

}
