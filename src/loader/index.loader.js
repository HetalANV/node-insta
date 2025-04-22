import connectDB from "./db.loader.js";
import startServer from "./express.loader.js";

const startApp = async () => {
  try {
    await connectDB();
    startServer();
  } catch (err) {
    console.error("Error starting the application:", err);
    process.exit(1);
  }
};

export default startApp;
