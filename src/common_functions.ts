import { BlockBlobClient } from "@azure/storage-blob";
import * as fs from "fs";
import * as path from "path";
import * as express from "express";
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

export async function readJSONFile(jsonFilePath: string): Promise<any> {
  console.log("Reading JSON file for metadata");
  try {
    const json_read = JSON.parse((await fs.promises.readFile(jsonFilePath, "utf-8")).replace(
      /"(?:[^"\\]|\\.)*"/g,
      (str:any) => str.replace(/(\r\n|\r|\n)/g, "\\n")
    ));
    function toLowerCaseKeys(obj: any): any {
      if (Array.isArray(obj)) {
        return obj.map(toLowerCaseKeys);
      } else if (obj !== null && typeof obj === "object") {
        return Object.keys(obj).reduce((acc: any, key: string) => {
          const lowerKey = key.charAt(0).toLowerCase() + key.slice(1);
          acc[lowerKey] = toLowerCaseKeys(obj[key]);
          return acc;
        }, {});
      }
      return obj;
    }
    return toLowerCaseKeys(json_read);
  } 
  catch (error) {
    console.warn(`Could not read/parse JSON file at ${jsonFilePath}.`);
    console.warn(error as string);
    return;// ideally exit to no check.
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
  progressCallback?: (percent: number) => void,
  type: string = "application/zip" // Default content type
): Promise<string> {
  // Ensure '+' is encoded as '%2B' in blobUri (SAS token encoding issue workaround)
  const encodedUri = blobUri.replace(/\+/g, "%2B");
  const blobClient = new BlockBlobClient(encodedUri);

  const fileSize = fs.statSync(localFilePath).size;
  const fileStream = fs.createReadStream(localFilePath);

  let lastReportedPercent = -1;

  const uploadOptions = {
    blobHTTPHeaders: {
      blobContentType: type, // Adjust this if needed
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

export function getFilesNamesFromDirectory(dirPath: string): { originalname: string; filePath: string }[] {
  if (!dirPath) return [];
  const files = fs.readdirSync(dirPath);
  return files.map((file: string) => ({
    originalname: file,
    filePath: path.resolve(dirPath, file)
  }));
}

export function getFilesArrayFromDirectory(directoryPath: string): express.Multer.File[] {
  if(fs.existsSync(directoryPath) === false) {
    core.warning(`Directory does not exist: ${directoryPath}`);
    return [];
  }
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

//143 needs to be checked if the jsonFileObject is a subset of metadata_json
// Deep merge: jsonFileObject is a subset of metadata_json, but recursively for all nested objects/arrays
export function deepMergeSubset(target: any, source: any): any {
  //143 do this doubt if only listings 
  if (typeof target === "object" && typeof source === "object" && target && source && !Array.isArray(target) && !Array.isArray(source)) {
    const result: any = {};
    for (const key of Object.keys(target)) {
      // Only copy fields at depth 0: use source if present, else target
      result[key] = key in source ? source[key] : target[key];
    }
    return result;
  }
  console.error("deepMergeSubset: Both target and source must be objects.");
  return {};
}