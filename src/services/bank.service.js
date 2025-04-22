import axios from "axios";

export const getBankDetails = async (client_code, headers) => {
  try {

    const response = await axios.get(
      `${process.env.CONNECT_ARHAM}/v2/account-profile/bank-details?client_code=${client_code}`,
      {
        headers: {
          "authToken": headers.authtoken, // pass the token here
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data && response.data.status) {
      return response.data.data;
    } else {
      throw new Error("Bank data fetch failed");
    }
  } catch (error) {
    console.error("Error fetching bank details:", error.message);
    throw error;
  }
};

