import low from "lowdb";
import FileSync from "lowdb/adapters/FileSync";
import { join } from "path";
import { differenceBy } from "lodash";
import { calibre } from "../lib/calibre";
import { existsSync, writeFileSync as write } from "fs";

const adapter = new FileSync(join(process.cwd(), "data", "snapshot-db.json"));
const db = low(adapter);

db.defaults({ snapshots: [] }).write();

let dotEnv = join(process.cwd(), ".env");
if (!existsSync(dotEnv)) {
  console.log("Creating env file");
  write(dotEnv, `CALIBRE_API_TOKEN=${process.env.CALIBRE_API_TOKEN}`);
}

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
