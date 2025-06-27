import { BlockBlobClient } from "@azure/storage-blob";
import * as fs from "fs";
import * as path from "path";
import * as express from "express";

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