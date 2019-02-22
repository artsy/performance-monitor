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

/**
 * The number of weeks that the email covers
 */
const WEEKS_TO_MEASURE = 4;

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

enum METRIC {
  FCP = "first-contentful-paint",
  FMP = "first-meaningful-paint",
  SI = "speed_index"
}

// Metrics grabbed from https://docs.google.com/spreadsheets/d/1d0n8ZHX_M0neBMIq6SIhMMITYF_mQE8I6jHhzu9hdr0/edit?usp=sharing
const METRICS = [
  {
    name: METRIC.FCP,
    top: 0,
    mid: 2336,
    low: 4000,
    goal: 2000
  },
  {
    name: METRIC.FMP,
    top: 0,
    mid: 2336,
    low: 4000,
    goal: 2500
  },
  {
    name: METRIC.SI,
    top: 0,
    mid: 3387,
    low: 5800,
    goal: 3000
  }
];

const getDateRange = (weeks: number = WEEKS_TO_MEASURE) => {
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

const renderMetricBar = (metric: any, deltaOverride?: string) => {
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
        delta: deltaOverride || metric.delta,
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

  const formatMetrics = (
    page: string,
    pageMetrics: Array<{ name: string }>,
    deltaOverrides?: { [metric in METRIC]?: string }
  ) =>
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
        img: renderMetricBar(
          metric,
          deltaOverrides ? deltaOverrides[metric.name as METRIC] : undefined
        )
      }))
      .value();

  const finalTemplate = mjmlTemplate({
    url: BUCKET ? `https://s3.amazonaws.com/${BUCKET}/${BUCKET_FOLDER}` : "",
    logo: `https://s3.amazonaws.com/${BUCKET}/Artsy_Logo_Full_Black_Jpeg_Small.jpg`,
    legend: `https://s3.amazonaws.com/${BUCKET}/bar-description-2.jpg`,
    dateRange,
    intro: `
      Welcome to Artsy's web performance report. The purpose of this communication is to provide transparency around 
      the state of performance at Artsy. This report has been extended to coincide with the start of Q1.       
      <br/><br/>
      All the data in this report is from a mid-tier mobile device on a 3G network. We're using this as a baseline to 
      match Google's current performance recommendations. Performance on 4G networks with upper tier devices and desktop
      significantly outperform the below results. 
      <br/><br/>
      The deltas listed in this report (green or red numbers) cover a month long period and aren't expected to align
      with numbers from the last report. If you have questions about these metrics or about performance in
      general please join us in the <b>#performance</b> slack channel. 
    `,
    pageSummary: `
      The metrics below are Google's <a href="https://developers.google.com/web/tools/lighthouse/v3/scoring#perf">Lighthouse performance score</a> for each
      of the associated page types. This score goes from 0 (being the worst) to 100 (being the best). It's an aggregate of multiple weighted
      metrics that gives a rough indication of the overall performance health of a webpage. 
    `,
    pages: [
      {
        name: "Artist",
        img: "artist-gauge.png",
        metrics: formatMetrics("artist", artistPage),
        description: `
          Artist page has remained relatively stable over the last month. We're still underperforming relative to our goals. The deltas
          from this report is based on the last month of data, not just the period covered by the last report.         `
      },
      {
        name: "Artwork",
        img: "artwork-gauge.png",
        metrics: formatMetrics("artwork", artworkPage),
        description: `
          We've seen a performance degradation in the last month relating to the release of the responsive
          (and completely rebuilt) artwork page. Mobile 4G and desktop haven't seen the same level of performance degradations.
          These numbers may be slightly skewed due to ongoing intermittent elasticsearch issues. We'll continue to
          investigate and optimize artwork page performance.
        `
      },
      {
        name: "Article",
        img: "article-gauge.png",
        metrics: formatMetrics("article", articlePage),
        description: `
          Article page performance remained relatively stable over the last two months. More analysis is required for the increase
        `
      }
    ]
  });

  write("dist/performance-email.mjml", finalTemplate);
})();

// console.log(renderToString(<Gauge score={50} delta="-7%" />));
