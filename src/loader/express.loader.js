import figlet from "figlet";
import { httpServer } from "../app.js";

let isServerRunning = false; // Prevent multiple instances

const startServer = () => {
  if (isServerRunning) {
    console.log("Server is already running. Skipping restart.");
    return;
  }

  const port = process.env.PORT || 8080;

  httpServer.listen(port, process.env.SERVER, () => {
    isServerRunning = true; // Mark server as running
    const body = figlet.textSync("Instapayment is live!");
    console.log(body);
    console.info(
      `📑 Visit the documentation at: http://localhost:${port}`
    );
    console.log("⚙️  Server is running on port: " + port);
  });

  httpServer.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Please free the port or use a different one.`);
      process.exit(1); // Exit the process to avoid multiple instances
    } else {
      throw err;
    }
  });
};

export default startServer;
