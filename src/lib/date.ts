import { parse, isBefore, isAfter } from "date-fns";

export const getDateRange = (dateList: string[]) => {
  let dates = dateList.map(dateString => parse(dateString));

  let start = new Date(0);
  let end = new Date();

  for (let date of dates) {
    if (isBefore(date, start)) {
      start = date;
    }
    if (isAfter(date, end)) {
      end = date;
    }
  }

  return [start, end];
};
