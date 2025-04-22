import _ from "lodash";

export const getCurrentDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are zero-based
  const day = String(date.getDate()).padStart(2, "0"); // Pad day with leading zero if needed
  return `${year}-${month}-${day}`;
}


export const validateRequest = (clientCode) => {
  const errors = [];

  if (!clientCode) {
    errors.push("Client code is required");
  }

  return errors;
};

export const getObjectFromData = (input) => {
  const { COLUMNS, DATA } = input;

  const records = DATA?.map((row) => {
    return COLUMNS?.reduce((acc, column, index) => {
      acc[column] = row[index] === "" ? 0 : row[index];
      return acc;
    }, {});
  });
  return records;
};

export const toLowercaseKeys = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));
