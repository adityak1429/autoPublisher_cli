import {MSStoreClient} from './msstore'; // Ensure msstore-cli is installed and available in PATH
const archiver = require("archiver");
const path = require("path");
const fs = require("fs");
import { getFilesFromServer, sendFilesToServer } from "./dataTransfer"; // Assuming getFiles is defined in getData.ts
import express from "express";

import { BlockBlobClient } from "@azure/storage-blob";

import * as core from "@actions/core";
// import * as dotenv from "dotenv";
// dotenv.config();
// const core = {
//   getInput(name: string): string {
//     const value = process.env[name.replace(/-/g, "_").toUpperCase()];
//     if (!value) {
//       this.setFailed(`Missing environment variable for ${name}`);
//       process.exit(1);
//     }
//     return value;
//   },
//   setFailed(message: string): void {
//     console.error(`❌ ${message}`);
//   },
//   info(message: string): void {
//     console.info(`ℹ️ ${message}`);
//   },
//   warning(message: string): void {
//     console.warn(`⚠️ ${message}`);
//   },
//   setDebug(message: string): void {
//     console.debug(`🐞 ${message}`);
//   }
// }

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

  await msstore.configure();

  core.info("Configuration completed successfully.");
}

async function zipandUpload(uploadUrl: string, files: any) {
  core.info("Zipping files...");
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

    // Add each file individually using getFilesArrayFromDirectory
    for (const file of files) {
      try{
        archive.append(file.buffer, { name: file.originalname || file.filename });
      }
      catch (error) {
        core.warning(`Skipping file ${file.originalname} or $ due to error: ${error}`);
        continue; // Skip this file and continue with the next
      }
    }

    archive.finalize();
  });
  core.info("Files zipped successfully.");

  // Upload
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
    ));    
  } 
  catch (error) {
    core.warning(`Could not read/parse JSON file at ${jsonFilePath}.`);
    core.warning(error as string);
    return;// ideally exit to no check.
  }
}

function getFilesArrayFromDirectory(directoryPath: string): express.Multer.File[] {
    const files: express.Multer.File[] = [];
    const fileNames = fs.readdirSync(directoryPath);

    for (const fileName of fileNames) {
        const filePath = path.join(directoryPath, fileName);
        if (fs.statSync(filePath).isFile()) {
            files.push({
                originalname: fileName,
                buffer: fs.readFileSync(filePath),
            } as express.Multer.File);
        }
    }
    return files;
}

function copy_visible_data_json(metadata_json: any, visible_data_json: any): any {
  return visible_data_json;
}

async function updateMetadataAndUpload(): Promise<void> {
  let metadata_json: any;
  let filteredMetadata_json : any;
  const jsonFilePath = core.getInput("json-file-path") || "";
  if (jsonFilePath==="") {
    metadata_json = await msstore.getMetadata(productId);
    core.warning("JSON file path is not provided edit it in pdp.");
  }
  else{
    metadata_json = await readJSONFile(jsonFilePath);// ideally exit to no check.
    core.info("Metadata JSON file read and filtered successfully.");
  }
  let mediaFiles = getFilesArrayFromDirectory(photosPath);
  let packageFiles = getFilesArrayFromDirectory(packagePath);
  filteredMetadata_json = msstore.filterFields(metadata_json);

  // changes mediaFiles and filteredMetadata_json to be used in interactive mode
  if(core.getInput("interactive") === "true") {
    let previewUrl = await sendFilesToServer(mediaFiles,filteredMetadata_json);
    core.info(`Files uploaded successfully. PDP URL: http://localhost:3000${previewUrl}`);
    let files_with_metadata = await getFilesFromServer();

    const filteredMetadata_json_buffer = files_with_metadata.find(
      (file: any) => file.filename === "metadata.json"
    );
    if (!filteredMetadata_json_buffer) {
      core.setFailed("Metadata file not found in files_with_metadata.");
      return;
    }
    // Remove the file named 'metadata.json' from files_with_metadata
    mediaFiles = files_with_metadata
      .filter((file: express.Multer.File) => file.filename !== "metadata.json");
    filteredMetadata_json = copy_visible_data_json(filteredMetadata_json,JSON.parse(filteredMetadata_json_buffer.buffer.toString("utf-8")));
  }

  filteredMetadata_json = await msstore.add_files_to_metadata(productId,filteredMetadata_json, packageFiles, mediaFiles);
  
  console.log("Filtered metadata JSON:", JSON.stringify(filteredMetadata_json, null, 2));
  try {
    metadata_json = await msstore.updateMetadata(productId,filteredMetadata_json);
  } catch (error: unknown) {
    core.setFailed(`Failed to update metadata`);
    core.setFailed(error as string);
    return;
  }

  // Fetch the upload URL for the package
  core.info("Fetching upload URL for the package...");
  const uploadUrl = metadata_json.fileUploadUrl;
  if(!uploadUrl) {
    core.setFailed("Upload URL not found in metadata JSON.");
    return;
  }

  // Concatenate mediaFiles from packagePath to the mediaFiles buffer
  const files = mediaFiles.concat(packageFiles);
  await zipandUpload(uploadUrl, files);

  await msstore.commitSubmission(productId);

  await msstore.pollStatus(productId);

}

(async function main() {
try {
    core.info("Starting the action...");

    await configureAction();
    
    if(command==="getmetadata") {
      core.info(JSON.stringify(await msstore.getMetadata(productId), null, 2));
    }

    else if (command==="json_init") {
      await msstore.getCurrentSubmissionId(productId, true);
      const metadata_json = await msstore.getMetadata(productId);
      core.info(JSON.stringify(msstore.filterFields(metadata_json),null,2));
    }

    else if(command==="publish") {
      //143 need packager too or check current msix consistent with metadata if msix provided
      //143 currenly assume msix is provided and is consistent with metadata
      await msstore.configure();

      
      // false means do not create a new submission if it does not exist
      await msstore.getCurrentSubmissionId(productId,false);
      
      
      core.info("deleting existing submission if any");
      await msstore.deleteSubmission(productId);

      // true means create a new submission if it does not exist
      let id = await msstore.createSubmission(productId);
      core.info(`Submission created with ID: ${id}`);
      
      await updateMetadataAndUpload();

    }

    else if(command==="pdp") {
      await msstore.configure();
      await msstore.getCurrentSubmissionId(productId, true);
      core.info(`also visit https://partner.microsoft.com/en-us/dashboard/products/${productId}/submissions/${submission_id}/properties`);
      updateMetadataAndUpload();
    }

    // else if(command==="reserve_name") {
    //   // resrve another name for the product
    // }

    else if(command==="first_publish") {

      await msstore.configure();

      let productId = await msstore.reserve_name(core.getInput("product-name"));

      // set the productId for further operations

      // true creates a new submission.
      let submission_id = await msstore.getCurrentSubmissionId(productId, true);

      // instruct user to visit the verification URL
      const verificationUrl = `https://partner.microsoft.com/en-us/dashboard/products/${productId}/submissions/${submission_id}/ageratings`; // Replace with your actual URL
      core.info(`Please visit the following URL to complete verification:\n${verificationUrl}`);
      core.info(`also visit https://partner.microsoft.com/en-us/dashboard/products/${productId}/submissions/${submission_id}/properties`);

      // take interative input then proceed
      // non need above since pdp doesnt change

      await updateMetadataAndUpload();

    }
    else{
      core.setFailed("Invalid command. Use 'getmetadata' or 'publish' or 'json_init'.");
      return;
    }

  } catch (error: unknown) {
    core.setFailed(error as string);
  }
  })();
