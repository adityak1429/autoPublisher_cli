import * as core from "@actions/core";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

(async function main() {
  try {
const sellerId = process.env['INPUT_SELLER_ID'];
const tenantId = process.env['INPUT_TENANT_ID'];
const clientId = process.env['INPUT_CLIENT_ID'];
const clientSecret = process.env['INPUT_CLIENT_SECRET'];
    // const fileType = core.getInput("file-type"); // "flight", "msi", or "msix"
    // const filePath = core.getInput("file-path"); // generic file path
    // const flightName = core.getInput("flight-name"); // only for flight
    console.log("sellerId", core.getInput("seller-id"));
    console.log("tenantId", core.getInput("tenant-id"));  
    console.log("clientId", clientId);
    console.log("clientSecret", clientSecret);
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
