import {MSStoreClient} from './msstore'; // Ensure msstore-cli is installed and available in PATH
const archiver = require("archiver");
const path = require("path");
const fs = require("fs");
import { uploadFileToBlob, getFilesArrayFromDirectory, readJSONFile, deepMergeSubset } from '../common_functions';
import { getFilesFromServer, sendFilesToServer } from "./dataTransfer"; // Assuming getFiles is defined in getData.ts
import express from "express";

import { BlockBlobClient } from "@azure/storage-blob";


import artifact, {UploadArtifactOptions} from '@actions/artifact'
const tmp = require('os').tmpdir();
// import * as core from "@actions/core";
import * as dotenv from "dotenv";
dotenv.config();
const core = {
  getInput(name: string): string {
    const value = process.env[name.replace(/-/g, "_").toUpperCase()];
    return value || "";
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
  },
  exportVariable(name: string, value: string): void {
    process.env[name] = value;
  }
}
let productId: string = "";
let tenantId: string  = "";
let clientId: string  = "";
let clientSecret: string  = "";
let packagePath: string = "";
let photosPath: string = "";
let command: string = "";
const msstore  = new MSStoreClient();


async function configureAction() {
  productId = core.getInput("product-id");
  tenantId = core.getInput("tenant-id");
  clientId = core.getInput("client-id");
  clientSecret = core.getInput("client-secret");
  packagePath = core.getInput("package");
  photosPath = core.getInput("photos-path");
  command = core.getInput("command");
  if (!productId || !tenantId || !clientId || !clientSecret) {
    core.setFailed("Missing required inputs");
    return;
  }

  await msstore.configure(tenantId, clientId, clientSecret);

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

function copy_visible_data_json(metadata_json: any, visible_data_json: any): any {
  
  
  
  return visible_data_json;
}


const mediaTypeResolutions: Record<string, Array<{ width: number; height: number }>> = {
  Screenshot: [
    { width: 1920, height: 1080 },
    { width: 1240, height: 720 },
    { width: 1080, height: 1080 },
  ],
  MobileScreenshot: [
    { width: 1242, height: 2208 },
    { width: 1080, height: 1920 },
    { width: 720, height: 1280 },
  ],
  XboxScreenshot: [
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 },
  ],
  SurfaceHubScreenshot: [
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 },
  ],
  HoloLensScreenshot: [
    { width: 1268, height: 720 },
    { width: 1920, height: 1080 },
  ],
  StoreLogo9x16: [
    { width: 1080, height: 1920 },
    { width: 720, height: 1280 },
  ],
  StoreLogoSquare: [
    { width: 1080, height: 1080 },
    { width: 358, height: 358 },
  ],
  Icon: [
    { width: 512, height: 512 },
    { width: 358, height: 358 },
    { width: 1080, height: 1080 },
  ],
  PromotionalArt16x9: [
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 },
    { width: 2400, height: 1350 },
  ],
  PromotionalArtwork2400X1200: [
    { width: 2400, height: 1200 },
  ],
  XboxBrandedKeyArt: [
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 },
  ],
  XboxTitledHeroArt: [
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 },
  ],
  XboxFeaturedPromotionalArt: [
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 },
  ],
  SquareIcon358X358: [
    { width: 358, height: 358 },
  ],
  BackgroundImage1000X800: [
    { width: 1000, height: 800 },
  ],
  PromotionalArtwork414X180: [
    { width: 414, height: 180 },
  ],
};


import { imageSize } from 'image-size';
function validate_media_files(mediaFiles: express.Multer.File[]): void {
    let allValid = true;

    for (const file of mediaFiles) {
        // Only check image files (png, jpg, jpeg)
        const ext = (file.originalname || file.filename || "").toLowerCase();
        if (!ext.endsWith(".png") && !ext.endsWith(".jpg") && !ext.endsWith(".jpeg")) {
            continue;
        }
        try {
            const dim = imageSize(file.buffer);
            const filename = file.originalname || file.filename;
            // Do nothing if valid, otherwise setFailed
            if (!mediaTypeResolutions[filename.split('_')[0]].some(res => res.width === dim.width && res.height === dim.height)) {
              core.warning(`Image ${filename} is invalid with dimensions ${dim.width}x${dim.height}. Expected one of: ${JSON.stringify(mediaTypeResolutions[filename.split('_')[0]])}`);
            }
        } catch (err) {
            core.warning(`Error processing image ${file.originalname || file.filename}: ${err}`);
            allValid = false;
        }
    }

    if (!allValid) {
        core.warning("Some media files failed validation for 1:1 ratio or 1080x1080 resolution.");
    } else {
        core.info("All media files passed 1:1 and 1080x1080 validation.");
    }
}

async function updateMetadataAndUpload(first_time=false): Promise<void> {
  let metadata_json: any;
  let filteredMetadata_json : any;
  const jsonFilePath = core.getInput("json-file-path") || "";
  metadata_json = await msstore.getMetadata(productId);
  if (jsonFilePath!==""){
    core.info("Metadata JSON file reading.");
    const jsonFileObject = await readJSONFile(jsonFilePath);// ideally exit to no check.



    if (jsonFileObject && typeof jsonFileObject === "object") {
      metadata_json = deepMergeSubset(metadata_json, jsonFileObject);
    }
    core.info("Metadata JSON file read successfully.");
  }
  let mediaFiles = getFilesArrayFromDirectory(photosPath);
  validate_media_files(mediaFiles);
  let packageFiles = getFilesArrayFromDirectory(packagePath);
  filteredMetadata_json = msstore.filterFields(metadata_json);

  // changes mediaFiles and filteredMetadata_json to be used in interactive mode
  if(core.getInput("interactive") === "true" || first_time) {
    let previewUrl = await sendFilesToServer(mediaFiles,filteredMetadata_json);
    if(first_time) {
      core.info(`visit this url for further processing ${previewUrl}/submission?submission_id=${await msstore.getCurrentSubmissionId(productId,true)}&&product_id=${productId}`);
    }
    else{
      core.info(`Files uploaded successfully. PDP URL: ${previewUrl}/render`);
    }
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
  
    if(core.getInput("download") === "true") {
      const artifactFiles: string[] = [];

      const artifactDir = path.join(tmp, `media_artifact_${Date.now()}`);
      fs.mkdirSync(artifactDir, { recursive: true });

      // Write media files to artifact directory
      for (const file of mediaFiles) {
        const filePath = path.join(artifactDir, file.originalname || file.filename);
        fs.writeFileSync(filePath, file.buffer);
        artifactFiles.push(filePath);
      }

      // Write filteredMetadata_json to artifact directory
      const metadataPath = path.join(artifactDir, 'filteredMetadata.json');
      fs.writeFileSync(metadataPath, JSON.stringify(filteredMetadata_json, null, 2));
      artifactFiles.push(metadataPath);

      // Upload artifact
      await artifact.uploadArtifact(
        'mediaFiles_and_metadata',
        artifactFiles,
        artifactDir
      );
      core.info(`Uploaded artifact: mediaFiles_and_metadata`);
    }
  
  }

  filteredMetadata_json = await msstore.add_files_to_metadata(productId,filteredMetadata_json, packageFiles, mediaFiles, core.getInput("append")=== "true");
  
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

export async function msix_main() {
try {
    core.info("Starting the action...");

    await configureAction();
    
    if(command==="getmetadata") {
      core.info(JSON.stringify(await msstore.getMetadata(productId), null, 2));
    }

    else if (command==="json_init") {
      // we run this to make sure we get a json back even if there was never a submission for this product
      // this is useful for the first time when we want to create a new submission
      await msstore.getCurrentSubmissionId(productId, true);
      const metadata_json = await msstore.getMetadata(productId);
      core.info(JSON.stringify(msstore.filterFields(metadata_json),null,2));
    }

    else if(command==="publish") {
      //143 need packager too or check current msix consistent with metadata if msix provided
      //143 currenly assume msix is provided and is consistent with metadata
      // false means do not create a new submission if it does not exist
      await msstore.getCurrentSubmissionId(productId,false);
      
      
      core.info("deleting existing submission if any");
      await msstore.deleteSubmission(productId);

      // true means create a new submission if it does not exist
      let id = await msstore.createSubmission(productId);
      core.info(`Submission created with ID: ${id}`);
      
      await updateMetadataAndUpload();

    }

    // else if(command==="reserve_name") {
      // // reserve another name for the product
    // }

    else if(command==="first_publish") {

      // let productId = await msstore.reserve_name(core.getInput("product-name"));

      // set the productId for further operations

      // true creates a new submission.
      let submission_id = await msstore.getCurrentSubmissionId(productId, true);
      
      // instruct user to visit the verification URL

      // take interative input then proceed
      // non need above since pdp doesnt change


      await updateMetadataAndUpload(true);

    }
    else{
      core.setFailed("Invalid command. Use 'getmetadata' or 'publish' or 'json_init'.");
      return;
    }

  } catch (error: unknown) {
    core.setFailed(error as string);
  }
  }
