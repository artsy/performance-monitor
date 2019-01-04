import { promisify } from "util";
import low from "lowdb";
import FileSync from "lowdb/adapters/FileSync";
import { chain, template } from "lodash";
import { join } from "path";
import differenceInWeeks from "date-fns/difference_in_weeks";
import format from "date-fns/format";
import { writeFile, readFile, createWriteStream } from "fs";
import repng from "repng";
import { Gauge, GaugeProps } from "../components/Gauge";
import { MetricBar, MetricBarProps } from "../components/MetricBar";
import S3 from "aws-sdk/clients/s3";
import uploadStream from "s3-stream-upload";
import { getSiteMetrics } from "../metrics";

let outputDir = "dist";
let BUCKET_FOLDER = "";
let BUCKET = "artsy-performance-dashboard";

const read = promisify(readFile);
const write = promisify(writeFile);
const s3 = new S3();

const adapter = new FileSync(join(process.cwd(), "data", "snapshot-db.json"));
const db = low(adapter);

db.defaults({ snapshots: [] }).write();

if (!(process.env.PATH || "").includes("./node_modules/.bin")) {
  process.env.PATH = `${process.env.PATH}:./node_modules/.bin`;
}

// Metrics grabbed from https://docs.google.com/spreadsheets/d/1d0n8ZHX_M0neBMIq6SIhMMITYF_mQE8I6jHhzu9hdr0/edit?usp=sharing
const METRICS = [
  {
    name: "first-contentful-paint",
    top: 0,
    mid: 2336,
    low: 4000,
    goal: 2000
  },
  {
    name: "first-meaningful-paint",
    top: 0,
    mid: 2336,
    low: 4000,
    goal: 2500
  },
  {
    name: "speed_index",
    top: 0,
    mid: 3387,
    low: 5800,
    goal: 3000
  }
];
const DOT_SIZE = 10;

const getDateRange = (weeks: number = 2) => {
  const d = (dt: string) => format(dt, "MMM D, YYYY");
  const [firstDate, ...otherDates] = db
    .get("snapshots")
    .sortBy(s => s.iid)
    .map(s => s.createdAt)
    .filter(date => differenceInWeeks(new Date(), date) < weeks)
    .value();
  const lastDate = otherDates.pop();
  return {
    firstDate,
    lastDate,
    dateRange: `${d(firstDate)}—${d(lastDate)}`
  };
};

const renderGauge = async (score: number, delta: string, filename: string) => {
  const outFile = createWriteStream(join("dist", filename));
  const size = 200;
  await repng<GaugeProps>(Gauge, {
    cssLibrary: "styled-components",
    props: {
      score,
      size,
      delta
    },
    width: size,
    height: size
  }).then((img: any) =>
    img
      .pipe(
        BUCKET
          ? uploadStream(s3, {
              Bucket: BUCKET,
              Key: BUCKET_FOLDER + filename,
              ACL: "public-read"
            })
          : outFile
      )
      .on("error", (err: Error) => {
        console.error(`Failed to upload ${filename} to S3.`, err);
      })
  );
};

// @ts-ignore
// const debug = o => console.log(o) || o;
const debug = i => i;

const renderMetricBar = (metric: any) => {
  const filename = `${metric.page}-${metric.name}.png`;
  const outFile = createWriteStream(join("dist", filename));

  repng<MetricBarProps>(
    MetricBar,
    debug({
      cssLibrary: "styled-components",
      props: {
        value: metric.average,
        range: {
          top: metric.top,
          mid: metric.mid,
          low: metric.low
        },
        goal: metric.goal,
        delta: metric.delta,
        width: 600
      },
      width: 600,
      height: 60
    })
  ).then((img: any) =>
    img
      .pipe(
        BUCKET
          ? uploadStream(s3, {
              Bucket: BUCKET,
              Key: BUCKET_FOLDER + filename,
              ACL: "public-read"
            })
          : outFile
      )
      .on("error", (err: Error) => {
        console.error(`Failed to upload ${filename} to S3.`, err);
      })
  );

  return filename;
};

// Work closure
(async () => {
  const { dateRange, firstDate, lastDate } = getDateRange();

  const f = (date: any) => format(date, "DD-MM-YYYY");
  BUCKET_FOLDER = `${f(firstDate)}_${f(lastDate)}/`;

  const mjmlTemplate = template(
    await read(join(__dirname, "email-template.mjml"), "utf-8")
  );

  const artistPage = getSiteMetrics("artist/", "mobile");
  const artworkPage = getSiteMetrics("artwork/", "mobile");
  const articlePage = getSiteMetrics("article/", "mobile");

  renderGauge(
    artistPage["lighthouse-performance-score"].average,
    artistPage["lighthouse-performance-score"].delta,
    "artist-gauge.png"
  );
  renderGauge(
    artworkPage["lighthouse-performance-score"].average,
    artworkPage["lighthouse-performance-score"].delta,
    "artwork-gauge.png"
  );
  renderGauge(
    articlePage["lighthouse-performance-score"].average,
    articlePage["lighthouse-performance-score"].delta,
    "article-gauge.png"
  );

  const formatMetrics = (page: string, pageMetrics: Array<{ name: string }>) =>
    chain(Object.values(pageMetrics))
      .filter(metric => metric.name !== "lighthouse-performance-score")
      .sortBy(["name"])
      .map((metric: any) => ({
        ...metric,
        ...METRICS.find(({ name }) => name === metric.name),
        page
      }))
      .map((metric: any) => ({
        ...metric,
        img: renderMetricBar(metric)
      }))
      .value();

  const finalTemplate = mjmlTemplate({
    url: BUCKET ? `https://s3.amazonaws.com/${BUCKET}/${BUCKET_FOLDER}` : "",
    logo: `https://s3.amazonaws.com/${BUCKET}/Artsy_Logo_Full_Black_Jpeg_Small.jpg`,
    legend: `https://s3.amazonaws.com/${BUCKET}/bar-description.jpg`,
    dateRange,
    pages: [
      {
        name: "Artist",
        img: "artist-gauge.png",
        metrics: formatMetrics("artist", artistPage),
        description: `
          The artist page is within a second of goal on two of our key metrics. <b>FMP</b> is reported as well below average,
          but this is largely do to unoptimized image loads. 
        `
      },
      {
        name: "Artwork",
        img: "artwork-gauge.png",
        metrics: formatMetrics("artwork", artworkPage),
        description: `
          The artwork page has surpassed our performance goals for <b>FCP</b> and <b>Speed index</b> for the last two weeks.
          This win is offset by the large <b>FMP</b>. Like the Artist page, the <b>FMP</b> is being pushed out due to unoptimized
          image loads. 
        `
      },
      {
        name: "Article",
        img: "article-gauge.png",
        metrics: formatMetrics("article", articlePage),
        description: `
          The article page has the most room for improvement. The <b>Speed index</b> crosses over the red threshold (meaning it's slower than
          the median site performance) at a little over 6 seconds. The <b>FCP</b> being ~3 seconds means this page in general is taking a while
          to start rendering.
        `
      }
    ]
  });

  write("dist/performance-email.mjml", finalTemplate);
})();

// console.log(renderToString(<Gauge score={50} delta="-7%" />));
