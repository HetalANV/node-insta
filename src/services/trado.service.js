import axios from "axios";
import { ApiResponse } from "../utils/ApiResponse.js";

export const verifyTradoToken = async (token) => {
  try {
    const URL = `${process.env.XTS_URL}/interactive/user/profile`;

    const config = {
      headers: {
        Authorization: token,
      },
    };

    const { data: profileData } = await axios.get(URL, config);
    if (profileData && profileData.result && profileData.result.ClientId) {
      console.log("in");

      return profileData.result;
    } else {
      return res.status(400).json(new ApiResponse(400, null, "Invalid token"));
    }
  } catch (error) {
    console.error("Error while verifying Tado token:", error);
    throw new ApiError(500, "Internal server error");
  }
};
