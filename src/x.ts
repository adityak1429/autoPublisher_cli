import * as core from "@actions/core";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

(async function main() {
  try {
    const sellerId = core.getInput("seller-id");
    const tenantId = core.getInput("tenant-id");
    const clientId = core.getInput("client-id");
    const clientSecret = core.getInput("client-secret");
    // const fileType = core.getInput("file-type"); // "flight", "msi", or "msix"
    // const filePath = core.getInput("file-path"); // generic file path
    // const flightName = core.getInput("flight-name"); // only for flight

    if (!sellerId || !tenantId || !clientId || !clientSecret) {
      throw new Error("Missing required input(s).");
    }

    let cmd = `msstore reconfigure -s ${sellerId} -t ${tenantId} -c ${clientId} -cs ${clientSecret}`

    let { stdout, stderr } = await execAsync(cmd);

    if (stdout) core.info(stdout);
    if (stderr) core.warning(stderr);

    cmd = "msstore apps list";

    ({ stdout, stderr } = await execAsync(cmd));

    if (stdout) core.info(stdout);
    if (stderr) core.warning(stderr);


  } catch (error: any) {
    core.setFailed(error?.message || String(error));
  }
})();
