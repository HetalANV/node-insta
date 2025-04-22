// utils/parseVoucher.js
export const extractVoucherNo = (rawText) => {
  if (!rawText) return null;
  const match = rawText.match(/VoucherNo-([A-Z0-9]+)/);
  return match ? match[1] : null;
};
