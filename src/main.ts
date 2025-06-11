import {MSStoreClient} from './msstore'; // Ensure msstore-cli is installed and available in PATH
const archiver = require("archiver");
const path = require("path");
const fs = require("fs");
import { generate_pdp } from './pdpPreview'; // Ensure pdpPreview.ts is in the same directory

import { BlockBlobClient } from "@azure/storage-blob";

// import * as core from "@actions/core";
import * as dotenv from "dotenv";
dotenv.config();
const core = {
  getInput(name: string): string {
    const value = process.env[name.replace(/-/g, "_").toUpperCase()];
    if (!value) {
      this.setFailed(`Missing environment variable for ${name}`);
      process.exit(1);
    }
    return value;
  },
  setFailed(message: string): void {
    console.error(`❌ ${message}`);
  },
  info(message: string): void {
    console.info(`ℹ️ ${message}`);
  },
  warning(message: string): void {
    console.warn(`⚠️ ${message}`);
  },
  setDebug(message: string): void {
    console.debug(`🐞 ${message}`);
  }
}

let productId: string = "";
let sellerId: string  = "";
let tenantId: string  = "";
let clientId: string  = "";
let clientSecret: string  = "";
let packagePath: string = "";
let photosPath: string = "";
let command: string = "";
const msstore  = new MSStoreClient();




/**
 * Uploads a file to Azure Blob Storage with progress reporting.
 * @param blobUri The SAS URL for the blob.
 * @param localFilePath The path to the local file.
 * @param progressCallback Optional progress callback (0-100).
 * @returns The ETag of the uploaded blob.
 */
export async function uploadFileToBlob(
  blobUri: string,
  localFilePath: string,
  progressCallback?: (percent: number) => void
): Promise<string> {
  // Ensure '+' is encoded as '%2B' in blobUri (SAS token encoding issue workaround)
  const encodedUri = blobUri.replace(/\+/g, "%2B");
  const blobClient = new BlockBlobClient(encodedUri);

  const fileSize = fs.statSync(localFilePath).size;
  const fileStream = fs.createReadStream(localFilePath);

  let lastReportedPercent = -1;

  const uploadOptions = {
    blobHTTPHeaders: {
      blobContentType: "application/zip", // Adjust this if needed
    },
    onProgress: (progress: { loadedBytes: number }) => {
      const percent = Math.floor((progress.loadedBytes / fileSize) * 100);
      if (progressCallback && percent !== lastReportedPercent) {
        lastReportedPercent = percent;
        progressCallback(percent);
      }
    },
  };

  try {
    const response = await blobClient.uploadStream(
      fileStream,
      4 * 1024 * 1024, // 4MB buffer size
      20,              // Max concurrency
      uploadOptions
    );

    if (response.etag) {
      return response.etag;
    } else {
      throw new Error("Upload succeeded but ETag is missing.");
    }
  } catch (err: any) {
    throw new Error(`Upload failed: ${err.message || "Unknown error"}`);
  }
}


async function configureAction() {
  productId = core.getInput("product-id");
  sellerId = core.getInput("seller-id");
  tenantId = core.getInput("tenant-id");
  clientId = core.getInput("client-id");
  clientSecret = core.getInput("client-secret");
  packagePath = core.getInput("package-path");
  photosPath = core.getInput("photos-path");
  command = core.getInput("command");
  if (!productId || !sellerId || !tenantId || !clientId || !clientSecret) {
    core.setFailed("Missing required inputs");
    return;
  }

  msstore.configure();

  core.info("Configuration completed successfully.");
}

async function zipandUpload(uploadUrl: string) {
  core.info(`Zipping files at package path: ${packagePath}`);

  // Also include files from the "photos" path if provided
  if (photosPath && fs.existsSync(photosPath) && fs.statSync(photosPath).isDirectory()) {
    core.info(`Including photos from: ${photosPath}`);
  } else if (photosPath) {
    core.warning(`Photos path "${photosPath}" does not exist or is not a directory. Skipping.`);
  }
  const zipFilePath = path.join(process.cwd(), "package.zip");
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      core.info(`Created zip file: ${zipFilePath} (${archive.pointer()} bytes)`);
      resolve();
    });
    archive.on("error", (err: Error) => reject(err));

    archive.pipe(output);
    archive.directory(packagePath, false);
    if (photosPath && fs.existsSync(photosPath) && fs.statSync(photosPath).isDirectory()) {
      archive.directory(photosPath, false);
    }
    archive.finalize();
  });
  core.info("Files zipped successfully.");

  //upload
  core.info(`zip: ${zipFilePath}`);
  core.info(`Uploading package to ${uploadUrl}`);
  uploadFileToBlob(
    uploadUrl,
    zipFilePath,
    (progress) => core.info(`Upload progress: ${progress}%`)
  ).then((etag) => {
    core.info(`Upload complete! ETag: ${etag}`);
  }).catch(console.error);
}

async function readJSONFile(jsonFilePath: string): Promise<any> {
  core.info("Reading JSON file for metadata");
  try {
    return JSON.parse((await fs.promises.readFile(jsonFilePath, "utf-8")).replace(
      /"(?:[^"\\]|\\.)*"/g,
      (str:any) => str.replace(/(\r\n|\r|\n)/g, "\\n")
    ))
    .then(core.info("JSON file read successfully. ..."));
    
  } 
  catch (error) {
    core.warning(`Could not read/parse JSON file at ${jsonFilePath}. Skipping comparison.`);
    core.warning(error as string);
    return;// ideally exit to no check.
  }
}


async function waitForProceed(): Promise<void> {
  return new Promise<void>((resolve) => {
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (data) => {
      if (data.toString().trim().toLowerCase() === "proceed") {
        resolve();
      } else {
        core.setFailed("Did not receive 'proceed'. Exiting.");
        process.exit(1);
      }
    });
  });
}

(async function main() {
try {
    core.info("Starting the action...");

    await configureAction();
    
    if(command==="getmetadata") {
      core.info(JSON.stringify(await msstore.getMetadata(productId), null, 2));
    }

    else if (command==="json_init") {
      const metadata_json = await msstore.getMetadata(productId);
      core.info(JSON.stringify(msstore.filterFields(metadata_json),null,2));
    }

    else if(command==="publish") {
      //143 need packager too or check current msix consistent with metadata if msix provided
      //143 currenly assume msix is provided and is consistent with metadata
      await msstore.configure();

      core.info("deleting existing submission if any");

      // false means do not create a new submission if it does not exist
      await msstore.getCurrentSubmissionId(productId,false);


      await msstore.deleteSubmission(productId);

      // true means create a new submission if it does not exist
      let id = await msstore.createSubmission(productId);

      let metadata_new_json: any;
      const jsonFilePath = core.getInput("json-file-path");
      metadata_new_json = await readJSONFile(jsonFilePath);// ideally exit to no check.

      let filteredMetadata_new_json = msstore.filterFields(metadata_new_json);
      filteredMetadata_new_json = await msstore.add_files_to_metadata(filteredMetadata_new_json, packagePath, photosPath);

      await msstore.validate_json(filteredMetadata_new_json);
    
      await msstore.updateMetadata(productId,filteredMetadata_new_json);

      // Fetch the upload URL for the package
      core.info("Fetching upload URL for the package...");
      metadata_new_json = await msstore.getMetadata(productId);

      const uploadUrl = metadata_new_json.fileUploadUrl;

      await zipandUpload(uploadUrl);

      await msstore.commitSubmission(productId);


      await msstore.pollStatus(productId);

    }

    else if(command==="pdp") {
      const jsonFilePath = core.getInput("json-file-path");

      let metadata_json: any;
      metadata_json = await readJSONFile(jsonFilePath);

      await generate_pdp(metadata_json,core.getInput("pdp-path"));

    }

    // else if(command==="reserve_name") {
    //   // resrve another name for the product
    // }

    else if(command==="first_publish_1") {
      //143 need packager too or check current msix consistent with metadata if msix provided
      //143 currenly assume msix is provided and is consistent with metadata

      await msstore.configure();

      let productId = await msstore.reserve_name(core.getInput("product-name"));

      // set the productId for further operations

      // false means do not create a new submission if it does not exist
      await msstore.getCurrentSubmissionId(productId,false);

      core.info("deleting existing submission if any");
      await msstore.deleteSubmission(productId);

      // true means create a new submission if it does not exist
      let submission_id = await msstore.createSubmission(productId);

      core.info("save this metadata to json file for future use");
      let metadata_new_json = await msstore.getMetadata(productId);
      metadata_new_json = msstore.filterFields(metadata_new_json);
      if(packagePath!=""&&photosPath!="") {
        metadata_new_json = await msstore.add_files_to_metadata(metadata_new_json, packagePath, photosPath);
      }
      await msstore.validate_json(metadata_new_json);

      // const jsonFilePath = core.getInput("json-file-path");
      // core.info(`Saving metadata to JSON file at ${jsonFilePath}`);
      // await fs.promises
      //   .writeFile(jsonFilePath, JSON.stringify(metadata_new_json, null, 2));
      core.info("save and modify this.");
      core.info(metadata_new_json);

      // instruct user to visit the verification URL
      const verificationUrl = `https://partner.microsoft.com/en-us/dashboard/products/${productId}/submissions/${submission_id}/ageratings`; // Replace with your actual URL
      core.info(`Please visit the following URL to complete verification:\n${verificationUrl}`);
      core.info(`also visit https://partner.microsoft.com/en-us/dashboard/products/${productId}/submissions/${submission_id}/properties`);
      core.info("After completing the verification, run action again with command first_publish_2 or if you want to see pdp run with command pdp...");

    }
    else if(command==="first_publish_2") {

      await msstore.configure();

      const jsonFilePath = core.getInput("json-file-path");
      let metadata_new_json: any;
  
      metadata_new_json = await readJSONFile(jsonFilePath);

      let filteredMetadata_new_json = msstore.filterFields(metadata_new_json);
      filteredMetadata_new_json = await msstore.add_files_to_metadata(filteredMetadata_new_json, packagePath, photosPath);

      await msstore.validate_json(filteredMetadata_new_json);
    
      await msstore.updateMetadata(productId,filteredMetadata_new_json);


      //143 remove this and take output from updateMetadata itself
        metadata_new_json = await msstore.getMetadata(productId);
        // Fetch the upload URL for the package
        core.info("Fetching upload URL for the package...");
      const uploadUrl = metadata_new_json.fileUploadUrl;

      await zipandUpload(uploadUrl);

      await msstore.commitSubmission(productId);


      await msstore.pollStatus(productId);

    }
    else{
      core.setFailed("Invalid command. Use 'getmetadata' or 'publish' or 'json_init'.");
      return;
    }

  } catch (error: unknown) {
    core.setFailed(error as string);
  }
  })();
