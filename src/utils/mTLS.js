import crypto from 'crypto';

const algorithm = 'aes-128-cbc'; // 16-byte key for AES-128
const iv = Buffer.alloc(16, 0);  // Initialization vector (should be random in real use)

export const encryptAES = (text, key) => {
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(key, 'utf8'), iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
};

export const decryptAES = (encrypted, key) => {
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(key, 'utf8'), iv);
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

export const generateNonce = (client_code) => {
  // You could use timestamp + client_code hash or random UUID
  return `${client_code}-${Date.now()}`;
}