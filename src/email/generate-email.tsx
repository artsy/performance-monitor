import React from "react";
import { promisify } from "util";
import { exec as execSync } from "child_process";
import low from "lowdb";
import FileSync from "lowdb/adapters/FileSync";
import { differenceBy, chain, template } from "lodash";
import { join, relative } from "path";
import differenceInWeeks from "date-fns/difference_in_weeks";
import format from "date-fns/format";
import getTime from "date-fns/get_time";
import mjml from "mjml";
import { writeFile, readFile, createWriteStream } from "fs";
import repng from "repng";
import Stats from "moving-average";
import { Color } from "@artsy/palette";
import { Gauge, GaugeProps } from "../components/Gauge";
import { MetricBar, MetricBarProps } from "../components/MetricBar";

const read = promisify(readFile);
const write = promisify(writeFile);

const adapter = new FileSync(join(process.cwd(), "data", "snapshot-db.json"));
const db = low(adapter);

db.defaults({ snapshots: [] }).write();

const exec = promisify(execSync);

if (!(process.env.PATH || "").includes("./node_modules/.bin")) {
  process.env.PATH = `${process.env.PATH}:./node_modules/.bin`;
}

const METRICS = [
  {
    name: "speed_index",
    top: 0,
    mid: 2200,
    low: 5500
  },
  {
    name: "first-meaningful-paint",
    top: 0,
    mid: 2350,
    low: 4000
  },
  {
    name: "first-contentful-paint",
    top: 0,
    mid: 2350,
    low: 4000
  }
];
const DOT_SIZE = 10;

interface CalibreSnapshotStatus {
  iid: number;
  htmlUrl: string;
  client: string;
  createdAt: string;
  status: string;
}

const defaultCalibreOptions: CalibreOptions = {
  json: true,
  site: "artsy-net"
};
interface CalibreOptions {
  json?: boolean;
  site?: string;
}
const calibre = (
  args: string,
  { json, site }: CalibreOptions = defaultCalibreOptions
) =>
  exec(
    ["run.env", "calibre", args, "--site", site, json ? "--json" : ""].join(
      " "
    ),
    {
      cwd: process.cwd(),
      env: process.env
    }
  ).then(({ stdout }) => (json ? JSON.parse(stdout) : stdout));

const fetchSnapshots = () => calibre(`site snapshots`);

const fetchSnapshotData = (snapshotId: number) =>
  calibre(`site get-snapshot-metrics --snapshot ${snapshotId}`);

const fetchResults = (page: string) => {
  return db
    .get("snapshots")
    .sortBy(s => s.iid)
    .map(s =>
      s.tests
        .filter((t: any) => t.page.url.includes(page))
        .map((t: any) => {
          t.createdAt = s.createdAt;
          return t;
        })
    )
    .filter(s => s.length > 0)
    .flatten()
    .filter(s => differenceInWeeks(new Date(), new Date(s.createdAt)) <= 2)
    .value();
};

const calculateAverage = (results: any, device: "desktop" | "mobile") => {
  const firstDate = results[0].createdAt;
  const deviceString = device === "desktop" ? "desktop" : "3g";
  return chain(results)
    .map(r =>
      r.measurements.map((m: any) => ({
        ...m,
        createdAt: r.createdAt,
        page: r.page.url,
        device: r.testProfile.name
      }))
    )
    .flatten()
    .filter(m => m.device.toLowerCase().includes(deviceString))
    .groupBy("name")
    .map(measurements => {
      const { name, label } = measurements[0];
      const period = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      const offset = getTime(firstDate);
      const stats = Stats(period);
      measurements.forEach(m =>
        stats.push(getTime(m.createdAt) - offset, m.value)
      );
      return {
        name,
        label,
        average: Math.round(stats.movingAverage()),
        device
      };
    })
    .value();
};

const filterByMetricsWeCareAbout = (avgMeasurements: any) => {
  const metrics = [
    "speed_index",
    "lighthouse-performance-score",
    "first-meaningful-paint",
    "first-contentful-paint"
  ];
  return avgMeasurements
    .filter((m: any) => metrics.includes(m.name))
    .reduce(
      (curr: any, prev: any) => ({
        ...curr,
        [prev.name]: prev
      }),
      {}
    );
};

const getDateRange = (weeks: number = 2) => {
  const d = (dt: string) => format(dt, "MMM D, YYYY");
  const [firstDate, ...otherDates] = db
    .get("snapshots")
    .sortBy(s => s.iid)
    .map(s => s.createdAt)
    .filter(date => differenceInWeeks(new Date(), date) < weeks)
    .value();
  console.log("first date", firstDate);
  console.log("lastDate", otherDates.slice(-1)[0]);
  return `${d(firstDate)}—${d(otherDates.slice(-1)[0])}`;
};

const getSiteMetrics = (sitePattern: string, device: "desktop" | "mobile") => {
  const results = fetchResults(sitePattern);
  return filterByMetricsWeCareAbout(calculateAverage(results, device));
};

const renderGauge = async (score: number, filename: string) => {
  const outFile = createWriteStream(join("dist", filename));
  const size = 200;
  await repng<GaugeProps>(Gauge, {
    cssLibrary: "styled-components",
    props: {
      score,
      size
    },
    width: size,
    height: size
  }).then((img: any) => img.pipe(outFile));
};

// @ts-ignore
const debug = o => console.log(o) || o;

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
        width: 600
      },
      width: 600,
      height: 40
    })
  ).then((img: any) => img.pipe(outFile));

  return filename;
};

// Work closure
(async () => {
  const newSnapshots = (differenceBy(
    await fetchSnapshots(),
    db.get("snapshots").value(),
    "iid"
  ) as unknown) as CalibreSnapshotStatus[];

  await Promise.all(
    newSnapshots.map(async snapshot => {
      let snapshotData: {
        snapshot: {
          tests: Array<{ testProfile: { id: string } }>;
        };
        testProfiles: Array<{ id: string }>;
      };

      try {
        snapshotData = await fetchSnapshotData(snapshot.iid);
      } catch {
        console.error(`Failed to fetch snapshot ${snapshot.iid}`);
        return;
      }

      const tests = snapshotData.snapshot.tests.map(test => {
        // @ts-ignore
        test.testProfile = snapshotData.testProfiles.find(
          profile => profile.id === test.testProfile.id
        );
        return test;
      });

      db.get("snapshots")
        .push({ ...snapshot, tests })
        .write();
    })
  );

  const dateRange = getDateRange();

  const mjmlTemplate = template(
    await read(join(__dirname, "email-template.mjml"), "utf-8")
  );

  const artistPage = getSiteMetrics("artist/", "mobile");
  const artworkPage = getSiteMetrics("artwork/", "mobile");
  const articlePage = getSiteMetrics("article/", "mobile");

  console.log("SCORE", artistPage);
  // artistPage["lighthouse-performance-score"].average
  renderGauge(
    artistPage["lighthouse-performance-score"].average,
    "artist-gauge.png"
  );
  renderGauge(
    artworkPage["lighthouse-performance-score"].average,
    "artwork-gauge.png"
  );
  renderGauge(
    articlePage["lighthouse-performance-score"].average,
    "article-gauge.png"
  );

  console.log(artistPage);

  const formatMetrics = (page: string, pageMetrics: Array<{ name: string }>) =>
    Object.values(pageMetrics)
      .filter(metric => metric.name !== "lighthouse-performance-score")
      .map(metric => ({
        page,
        ...metric,
        ...METRICS.find(({ name }) => name === metric.name)
      }))
      .map(metric => ({
        ...metric,
        img: renderMetricBar(metric)
      }));

  const finalTemplate = mjmlTemplate({
    logo: join(
      relative(join(process.cwd(), "dist"), join(__dirname, "../assets")),
      "Artsy_Logo_Full_Black_Jpeg_Small.jpg"
    ),
    redDot: "red-dot.png",
    greenDot: "green-dot.png",
    yellowDot: "yellow-dot.png",
    dotSize: DOT_SIZE,
    dateRange,
    pages: [
      {
        name: "Artist",
        img: "artist-gauge.png",
        metrics: formatMetrics("artist", artistPage)
      },
      {
        name: "Artwork",
        img: "artwork-gauge.png",
        metrics: formatMetrics("artwork", artworkPage)
      },
      {
        name: "Article",
        img: "article-gauge.png",
        metrics: formatMetrics("article", articlePage)
      }
    ]
  });

  write("dist/performance-email.mjml", finalTemplate);
})();

// console.log(renderToString(<Gauge score={50} delta="-7%" />));
