import low from "lowdb";
import FileSync from "lowdb/adapters/FileSync";
import { join } from "path";
import { differenceBy } from "lodash";
import { spawn } from "child_process";

const adapter = new FileSync(join(process.cwd(), "data", "snapshot-db.json"));
const db = low(adapter);

db.defaults({ snapshots: [] }).write();

interface CalibreSnapshotStatus {
  iid: number;
  htmlUrl: string;
  client: string;
  createdAt: string;
  status: string;
}

interface CalibreSnapshotData {
  snapshot: {
    tests: Array<{ testProfile: { id: string } }>;
  };
  testProfiles: Array<{ id: string }>;
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
  new Promise((resolve, reject) => {
    const cmd = `run.env calibre ${args} --site ${site} ${
      json ? "--json" : ""
    }`.split(" ");

    const calibreProcess = spawn(cmd[0], cmd.slice(1), {
      cwd: process.cwd(),
      env: process.env
    });

    let results = "";
    let error = "";

    calibreProcess.stdout.on("data", data => {
      results += data;
    });

    calibreProcess.stderr.on("data", data => {
      error += data;
    });

    calibreProcess.on("close", code => {
      if (code !== 0 || error.length > 0) {
        console.error(cmd, "failed with ", code, error);
        reject(error);
      } else {
        resolve(json ? JSON.parse(results) : results);
      }
    });
  });

const fetchSnapshots = () =>
  calibre(`site snapshots`) as Promise<CalibreSnapshotStatus[]>;

const fetchSnapshotData = (snapshotId: number) =>
  calibre(`site get-snapshot-metrics --snapshot ${snapshotId}`) as Promise<
    CalibreSnapshotData
  >;

(async () => {
  console.log("fetching new snapshots...");
  const newSnapshots = (differenceBy(
    await fetchSnapshots(),
    db.get("snapshots").value(),
    "iid"
  ) as unknown) as CalibreSnapshotStatus[];
  console.log(`Found ${newSnapshots.length} new snapshots`);

  await Promise.all(
    newSnapshots.map(async snapshot => {
      let snapshotData: CalibreSnapshotData;
      try {
        snapshotData = await fetchSnapshotData(snapshot.iid);
      } catch (err) {
        console.error(`Failed to fetch snapshot ${snapshot.iid}`, err);
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
})();
