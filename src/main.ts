import { exec } from "child_process";
import util from "util";
import {MSStoreClient} from './msstore'; // Ensure msstore-cli is installed and available in PATH
const execAsync = util.promisify(exec);
const diff = require("diff");
const archiver = require("archiver");
const path = require("path");
const axios = (require("axios")).default;
const fs = require("fs");
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
};

let productId: string = "";
let sellerId: string  = "";
let tenantId: string  = "";
let clientId: string  = "";
let clientSecret: string  = "";
let packagePath: string = "";
let photosPath: string = "";
let command: string = "";
const msstore  = new MSStoreClient();

/** Expected imageType values */
const imageType: string[] = [
  "Screenshot",
  "MobileScreenshot",
  "XboxScreenshot",
  "SurfaceHubScreenshot",
  "HoloLensScreenshot",
  "StoreLogo9x16",
  "StoreLogoSquare",
  "Icon",
  "PromotionalArt16x9",
  "PromotionalArtwork2400X1200",
  "XboxBrandedKeyArt",
  "XboxTitledHeroArt",
  "XboxFeaturedPromotionalArt",
  "SquareIcon358X358",
  "BackgroundImage1000X800",
  "PromotionalArtwork414X180",
];
 
/**
 * Validates that all BaseListing.Images[].ImageType in each Listings locale are valid.
 * Throws an error if any invalid type is found.
 */
function validate_json(input: any): void {
  if (!input || typeof input !== "object" || !input.Listings) {
    throw new Error("Invalid input: Listings property missing.");
  }
  for (const locale of Object.keys(input.Listings)) {
    const baseListing = input.Listings[locale]?.BaseListing;
    if (!baseListing || !Array.isArray(baseListing.Images)) continue;
    for (const img of baseListing.Images) {
      if (!img.ImageType || !imageType.includes(img.ImageType)) {
        throw new Error(
          `Invalid ImageType "${img.ImageType}" in locale "${locale}". Allowed types: ${imageType.join(", ")}`
        );
      }
    }
  }
}


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

/**
 * Returns a new object containing only the specified fields from the source object.
 */
function filterFields<T extends object>(source: T):any {
  const fields = [
    "ApplicationCategory",
    "Pricing",
    "Visibility",
    "TargetPublishMode",
    "TargetPublishDate",
    "Listings",
    "HardwarePreferences",
    "AutomaticBackupEnabled",
    "CanInstallOnRemovableMedia",
    "IsGameDvrEnabled",
    "GamingOptions",
    "HasExternalInAppProducts",
    "MeetAccessibilityGuidelines",
    "NotesForCertification",
    "ApplicationPackages",
    "PackageDeliveryOptions",
    "EnterpriseLicensing",
    "AllowMicrosoftDecideAppAvailabilityToFutureDeviceFamilies",
    "AllowTargetFutureDeviceFamilies",
    "Trailers",
  ];
  const result: { [key: string]: unknown } = {};
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      result[field] = (source as any)[field];
    }
  }
  return result;
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

async function add_files_to_metadata(metadata_json: any, packagePath: string, photosPath: string) {
  metadata_json.Trailers = []; // Reinitialize Trailers 

  // Set FileStatus to "PendingDelete" for all packages 
  if (metadata_json.ApplicationPackages && Array.isArray(metadata_json.ApplicationPackages)) {
    for (const pkg of metadata_json.ApplicationPackages) {
      pkg.Status = "PendingDelete";
    }
  }

  // Set FileStatus to "PendingDelete" for all images 
  const listings = metadata_json?.Listings;
  if (listings && typeof listings === "object") {
  for (const locale of Object.keys(listings)) {
    const images = listings[locale]?.BaseListing?.Images;
    if (Array.isArray(images)) {
    for (const img of images) {
      img.FileStatus = "PendingDelete";
    }
    }
  }
  }



  // PendingUpload for all packages
  // Add entries for each file in packagePath directory to ApplicationPackages
  const packageFiles = fs.readdirSync(packagePath);
  for (const packEntry of packageFiles) {
  const entry = {
    FileName: packEntry,
    FileStatus: "PendingUpload",
  };
  metadata_json.ApplicationPackages.push(entry);
  }


  // PendingUpload all photos and trailers
  const photoFiles: string[] = [];
  if (photosPath && fs.existsSync(photosPath) && fs.statSync(photosPath).isDirectory()) {
    for (const file of fs.readdirSync(photosPath)) {
      // Infer image type from filename prefix (e.g., Screenshot_abc.png)
      let type = file.split("_")[0];
      // Add the image entry to all locales in Listings
        if (imageType.includes(type)) {
          for (const locale of Object.keys(metadata_json.Listings)) {
            if (
              metadata_json.Listings[locale] &&
              metadata_json.Listings[locale].BaseListing &&
              Array.isArray(metadata_json.Listings[locale].BaseListing.Images)
            ) {
              metadata_json.Listings[locale].BaseListing.Images.push({
              FileStatus: "PendingUpload",
              FileName: file,
              ImageType: type
              });
            }
        }
      }
      else if (type === "TrailerImage") {
        // Trailer images are handled separately
        continue;
      }
      else if (type === "Trailer") {
        let imageListJson: { [locale: string]: { Title: string; ImageList: any[] } } = {};
        for (const locale of Object.keys(metadata_json.Listings)) {
          imageListJson[locale] = { Title: "", ImageList: [] };
        }

        metadata_json.Trailers.push({ VideoFileName: file, TrailerAssets: imageListJson });
      }
      else {
        core.warning(`Unknown media type "${type}" in file "${file}" check the prefix. Skipping.`);
        continue;
      }
    }

    // add all trailer images to metadata
    for (const file of fs.readdirSync(photosPath)) {
      // Infer image type from filename prefix (e.g., Screenshot_abc.png)
      let type = file.split("_")[0];
      // Add the image entry to all locales in Listings
      if(type==="TrailerImage"){
        for (const trailer of metadata_json.Trailers) {
          const videoBaseName = trailer.VideoFileName.split("_")[1]?.split(".")[0];
          const fileBaseName = file.split("_")[1]?.split(".")[0];
          if (videoBaseName === fileBaseName) {
            // For each locale in TrailerAssets, add the TrailerImage to ImageList
            for (const locale of Object.keys(trailer.TrailerAssets)) {
              if (Array.isArray(trailer.TrailerAssets[locale].ImageList)) {
                trailer.TrailerAssets[locale].Title = trailer.TrailerAssets[locale].Title || videoBaseName;
                trailer.TrailerAssets[locale].ImageList.push({
                  FileName: file,
                  Description: null
                });
              }
            }
          }
        }
      }
    }
  }
  return metadata_json;
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
      core.info(JSON.stringify(filterFields(metadata_json),null,2));
    }

    else if(command==="publish") {
      //143 need packager too or check current msix consistent with metadata if msix provided
      //143 currenly assume msix is provided and is consistent with metadata
      core.info("Starting the publish process...");

      await msstore.configure();

      core.info("deleting existing submission if any");

      // false means do not create a new submission if it does not exist
      await msstore.getCurrentSubmissionId(productId,false);


      await msstore.deleteSubmission(productId);

      // true means create a new submission if it does not exist
      core.info("Creating a new submission...");
      let id = await msstore.createSubmission(productId);

      const jsonFilePath = core.getInput("json-file-path");
      let metadata_new_json: any;
  
      core.info("Reading JSON file for metadata");
      try {
        metadata_new_json = JSON.parse((await fs.promises.readFile(jsonFilePath, "utf-8")).replace(
          /"(?:[^"\\]|\\.)*"/g,
          (str:any) => str.replace(/(\r\n|\r|\n)/g, "\\n")
        ));
        core.info("JSON file read successfully. ...");
      } 
      catch (error) {
        core.warning(`Could not read/parse JSON file at ${jsonFilePath}. Skipping comparison.`);
        core.warning(error as string);
        return;// ideally exit to no check.
      }

      let filteredMetadata_new_json = filterFields(metadata_new_json);
      filteredMetadata_new_json = await add_files_to_metadata(filteredMetadata_new_json, packagePath, photosPath);

      try {
        await validate_json(filteredMetadata_new_json);
      
        await msstore.updateMetadata(productId,filteredMetadata_new_json);
      }
      catch (error) {
        core.setFailed(`Failed to update metadata: ${error}`);
        return; //ideally exit to no check?.
      }

      // Fetch the upload URL for the package
      core.info("Fetching upload URL for the package...");
      metadata_new_json = await msstore.getMetadata(productId);

      const uploadUrl = metadata_new_json.fileUploadUrl;

      await zipandUpload(uploadUrl);

      await msstore.commitSubmission(productId);


      await msstore.pollStatus(productId);

    }
    else if(command==="first_publish") {
      //143 need packager too or check current msix consistent with metadata if msix provided
      //143 currenly assume msix is provided and is consistent with metadata
      core.info("Starting the publish process...");

      await msstore.configure();

      core.info("deleting existing submission if any");

      // false means do not create a new submission if it does not exist
      await msstore.getCurrentSubmissionId(productId,false);


      await msstore.deleteSubmission(productId);

      // true means create a new submission if it does not exist
      core.info("Creating a new submission...");
      let submission_id = await msstore.createSubmission(productId);


      const verificationUrl = `https://partner.microsoft.com/en-us/dashboard/products/${productId}/submissions/${submission_id}/ageratings`; // Replace with your actual URL
      core.info(`Please visit the following URL to complete verification:\n${verificationUrl}`);
      core.info(`also visit https://partner.microsoft.com/en-us/dashboard/products/${productId}/submissions/${submission_id}/properties`);
      core.info("After completing the verification, type 'proceed' and press Enter to continue...");

      await new Promise<void>((resolve) => {
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

      const jsonFilePath = core.getInput("json-file-path");
      let metadata_new_json: any;
  
      core.info("Reading JSON file for metadata");
      try {
        metadata_new_json = JSON.parse((await fs.promises.readFile(jsonFilePath, "utf-8")).replace(
          /"(?:[^"\\]|\\.)*"/g,
          (str:any) => str.replace(/(\r\n|\r|\n)/g, "\\n")
        ));
        core.info("JSON file read successfully. ...");
      } 
      catch (error) {
        core.warning(`Could not read/parse JSON file at ${jsonFilePath}. Skipping comparison.`);
        core.warning(error as string);
        return;// ideally exit to no check.
      }

      let filteredMetadata_new_json = filterFields(metadata_new_json);
      filteredMetadata_new_json = await add_files_to_metadata(filteredMetadata_new_json, packagePath, photosPath);




      try {
        await validate_json(filteredMetadata_new_json);
      
        await msstore.updateMetadata(productId,filteredMetadata_new_json);
      }
      catch (error) {
        core.setFailed(`Failed to update metadata: ${error}`);
        return; //ideally exit to no check?.
      }




      // Fetch the upload URL for the package
      core.info("Fetching upload URL for the package...");
      metadata_new_json = await msstore.getMetadata(productId);

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
