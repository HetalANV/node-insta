import moment from "moment";

export function getFormattedDate(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

export function parseDate(date) {
  const formats = [
    "DD/MM/YYYY",
    "MMMM D, YYYY HH:mm:ss Z",
    "MMMM, D YYYY HH:mm:ss Z",
    "MMMM, DD YYYY HH:mm:ss Z",
    "YYYY-MM-DD",
    "DD-MM-YYYY",
  ];
  const parsedDate = moment(date, formats, true);

  return parsedDate.isValid() ? parsedDate.format("DD/MM/YYYY") : null;
}

export function calculateAge(birthdate) {
  const dob = moment(birthdate, "DD/MM/YYYY");
  return moment().diff(dob, "years");
}

// Function to get financial year dates
export function getFinancialYearDates(startYear) {
  const fromDate = new Date(startYear, 3, 1); // April 1 of the start year
  const currentDate = new Date(); // today's date
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  let toDate;

  // Check if we're in the same financial year range (April to March)
  if (currentYear === startYear && currentMonth >= 3) {
    // Between April and March of the same year range
    toDate = currentDate;
  } else if (currentYear === startYear + 1 && currentMonth < 3) {
    // January to March of the next year still belongs to the previous financial year
    toDate = currentDate;
  } else {
    // If it's beyond March of the next year, set to the end of the financial year
    toDate = new Date(startYear + 1, 2, 31); // March 31 of the next year
  }

  return {
    from_date: fromDate.toLocaleDateString("en-GB"), // Format as DD/MM/YYYY
    to_date: toDate.toLocaleDateString("en-GB"),
  };
}


export const getFinancialYear = () => {
  const today = new Date();
  const year = today.getFullYear();
  const isAfterMarch = today.getMonth() >= 3; // Months are 0-indexed (0 = January, 3 = April)

  const financialYear = isAfterMarch ? year : year - 1;

  return financialYear;
};