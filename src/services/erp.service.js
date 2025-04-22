import axios from "axios";

export const verifyERPToken = async (token) => {
  try {
    const baseURL = process.env.ERP_TOKEN_URL;
    if (!baseURL) {
      throw new Error("ERP_TOKEN_URL is not defined in .env");
    }

    const URL = `${baseURL}/v1/user/verify-user`;

    const config = {
      headers: {
        authToken: token,
      },
    };

    const response = await axios.get(URL, config);
    console.log("Response from ERP Token verification:", response.data);


    if (response.data.status !== "success") {
      throw new Error(`ERP token verification failed: ${response.data.message}`);
    }

    return response.data.data;
  } catch (error) {
    console.error("Error while verifying ERP token:", error.response?.data || error.message);
    throw new Error("Failed to verify ERP token");
  }
};
