import { getAllSiteMetrics } from "../metrics";
import { writeFile } from "fs";
import { promisify } from "util";
import { join } from "path";
import { getDateRange } from "../lib/date";
import { format } from "date-fns";
import { calibre } from "../lib/calibre";

const write = promisify(writeFile);

const metrics = getAllSiteMetrics();

// @ts-ignore
metrics.dateRange = getDateRange(metrics.desktop.map(m => m.createdAt))
  .map(date => format(date, "MMM D"))
  .join("–");

console.log("date range", metrics.dateRange);
interface Page {
  uuid: string;
  name: string;
  url: string;
  canonical: boolean;
}
(calibre("site pages") as Promise<Page[]>).then(pages => {
  metrics.pages = pages;

  write(
    join(__dirname, "dashboard-data.json"),
    JSON.stringify(metrics, null, 2)
  );
});
