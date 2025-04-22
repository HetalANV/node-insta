require('dotenv').config();
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');

// AES encryption function
function encryptAES(text, key) {
  const cipher = crypto.createCipheriv('aes-128-ecb',
    key.padEnd(16).slice(0, 16), // Ensure key is exactly 16 bytes
    null // ECB mode doesn't use an IV
  );
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

// AES decryption function
function decryptAES(encrypted, key) {
  const decipher = crypto.createDecipheriv('aes-128-ecb',
    key.padEnd(16).slice(0, 16),
    null
  );
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// mTLS request function
function makeSecurePaymentRequest(paymentData) {
  return new Promise((resolve, reject) => {
    try {
      // Load certificates and keys from environment variables
      const ca = fs.readFileSync(process.env.CA_CRT);
      const cert = fs.readFileSync(process.env.NODE_CLIENT_CRT);
      const key = fs.readFileSync(process.env.NODE_CLIENT_KEY);

      // Parse the server URL from environment variables
      const serverUrl = new URL(process.env.JAVA_SERVER_URL);

      // Encrypt the payment data
      const aesKey = 'MySecretKey12345'; // Should be stored securely
      const encryptedData = encryptAES(JSON.stringify(paymentData), aesKey);

      const requestData = JSON.stringify({
        encryptedData
      });

      const options = {
        hostname: serverUrl.hostname,
        port: serverUrl.port || (serverUrl.protocol === 'https:' ? 443 : 80),
        path: serverUrl.pathname,
        method: 'POST',
        ca: ca, // CA certificate to verify the server
        key: key, // Client private key
        cert: cert, // Client certificate
        rejectUnauthorized: true, // Enforce certificate validation
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const responseBody = JSON.parse(data);

            // Decrypt the response if it's encrypted
            if (responseBody.encryptedResponse) {
              const decryptedResponse = decryptAES(responseBody.encryptedResponse, aesKey);
              responseBody.decryptedResponse = decryptedResponse;
            }

            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: responseBody
            });
          } catch (error) {
            reject(new Error(`Error parsing response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request error: ${error.message}`));
      });

      req.write(requestData);
      req.end();
    } catch (error) {
      reject(new Error(`Configuration error: ${error.message}`));
    }
  });
}

// Example usage
async function processPayment() {
  // Verify that all required environment variables are set
  const requiredEnvVars = ['CA_CRT', 'NODE_CLIENT_CRT', 'NODE_CLIENT_KEY', 'JAVA_SERVER_URL'];
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingEnvVars.length > 0) {
    console.error('Missing required environment variables:', missingEnvVars.join(', '));
    return;
  }

  const paymentData = {
    cardNumber: '4111111111111111',
    expiryDate: '12/25',
    cvv: '123',
    amount: 99.99,
    currency: 'USD',
    orderId: 'ORDER-' + Date.now()
  };

  try {
    const response = await makeSecurePaymentRequest(paymentData);
    console.log('Payment processed successfully:');
    console.log('Status code:', response.statusCode);
    console.log('Response:', response.body);

    if (response.body.decryptedResponse) {
      console.log('Decrypted response:', response.body.decryptedResponse);
    }
  } catch (error) {
    console.error('Payment processing failed:', error.message);
  }
}

// Run the payment process
processPayment();