import { spawn } from "child_process";

const defaultCalibreOptions: CalibreOptions = {
  json: true,
  site: "artsy-net"
};
interface CalibreOptions {
  json?: boolean;
  site?: string;
}
export const calibre = (
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
        console.error(results);
        reject(error);
      } else {
        try {
          JSON.parse(results);
        } catch {
          console.log("cmd failed", cmd);
          console.log(results);
          return;
        }
        resolve(json ? JSON.parse(results) : results);
      }
    });
  });
