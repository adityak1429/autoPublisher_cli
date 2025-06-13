import { apiRequest, setHeaders } from './apiHelper';
import * as dotenv from "dotenv";
const fs = require('fs');

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

const url = 'https://manage.devcenter.microsoft.com/v1.0/my/';

const ValidImageTypes: string[] = [
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

const fieldsNeccessary = [
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

export class MSStoreClient {
    private accessToken: string | undefined;
    private submissionId: string = "";


    async configure() {
        core.info("Starting the publish process...");
        const tenantId = core.getInput('tenant-id');
        const clientId = core.getInput('client-id');
        const clientSecret = core.getInput('client-secret');
        const resource = 'https://manage.devcenter.microsoft.com';

        const url = `https://login.microsoftonline.com/${tenantId}/oauth2/token`;

        const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            resource: resource,
        }).toString();

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        };

        const tokenResponse = await apiRequest<any>({
            url,
            method: 'POST',
            body,
            headers,
        });

        this.accessToken = tokenResponse.access_token;
        setHeaders({
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
        });
        return;
    }

    async reserve_name(name: string): Promise<string>;
    async reserve_name(name: string, publisherId: string): Promise<string>;
    async reserve_name(name: string, publisherId?: string): Promise<string> {
      if (!this.accessToken) {
        core.setFailed('Access token is not set. Please run configure first.');
        return "";
      }
      // Example: use publisherId if provided, otherwise fallback
      if (publisherId) {
        // Implement logic using publisherId if needed
        return `${core.getInput('product-id')}:${publisherId}`;
      }
      return core.getInput('product-id');
    }

    async createSubmission(productId: string) {
        try {
            core.info("Creating a new submission...");
            const submissionResponse = await apiRequest<any>({
                url: `${url}applications/${productId}/submissions`,
                method: 'POST',
            });
            this.submissionId = submissionResponse.id;
            core.info('Created new submission');
            return this.submissionId;
        } catch (error) {
            core.setFailed(`Error creating new submission: ${error}`);
            return "";
        }
    }

    async getCurrentSubmissionId(productId: string, createNew: boolean): Promise<string> {
        core.info('Submission ID is not set, fetching current submission ID');
       let product_data: any;
        try {
            product_data = await apiRequest<any>({
                url: `${url}applications/${productId}`,
                method: 'GET',
            });
            core.info('Getting app data');
        } catch (error) {
            core.setFailed(`Error checking current submissions ${error}`);
            return "";
        }

        try{
        if (product_data.pendingApplicationSubmission) {
            core.info('Found pending submission');
            this.submissionId = product_data.pendingApplicationSubmission.id;
        } else if (createNew){
            core.info('No pending submission found, creating submission');
            await this.createSubmission(productId);
        }
        else {
            core.info('No pending submission found, using last published submission');
            this.submissionId = product_data.lastPublishedApplicationSubmission.id;
        }
        if (!this.submissionId) {
            console.log(JSON.stringify(product_data, null, 2));
            core.setFailed('submissionId is undefined, no submissions found');
            return "";
        }
    } catch (error) {
        core.warning(`Error getting current submission ID: ${error} ${JSON.stringify(error, null, 2)}`);
        return "";
    }

        return this.submissionId;
    }

    async getMetadata(productId: string) {

        if (!this.accessToken) {
            core.setFailed('Access token is not set. Please run configure first.');
            return;
        }

        if (!this.submissionId || this.submissionId === "") {
            this.submissionId = await this.getCurrentSubmissionId(productId,false);
        }

        let metadata: any;
        try {
            metadata = await apiRequest<any>({
                url: `${url}applications/${productId}/submissions/${this.submissionId}`,
                method: 'GET',
            });
            core.info(`Got metadata for current submission with id ${this.submissionId}`);
        } catch (error) {
            core.setFailed(`Error getting metadata for current submissions ${error}`);
            return null;
        }

        return metadata;

    }

    async updateMetadata(productId: string, metadata: any) {
        if (!this.accessToken) {
            core.setFailed('Access token is not set. Please run configure first.');
            return;
        }

        if(this.submissionId === "" || !this.submissionId) {
            // If submissionId is not set, we need to create or get the current submission 
            this.submissionId = await this.getCurrentSubmissionId(productId,true);
        }

        //submit metadata to API
        core.info(`Updating metadata for current submission with id ${this.submissionId}`);
        let res: any = {};
        try {
            res = await apiRequest<any>({
                url: `${url}applications/${productId}/submissions/${this.submissionId}`,
                method: 'PUT',
                body: JSON.stringify(metadata,null,2),
            });
            core.info('Metadata updated successfully');
        } catch (error) {
            core.setFailed(`Error updating metadata for current submission ${JSON.stringify(error,null,2)}`);
        }
        return res;
    }

    async deleteSubmission(productId: string) {
        if (!this.accessToken) {
            core.setFailed('Access token is not set. Please run configure first.');
            return;
        }

        if (!this.submissionId || this.submissionId === "") {
            // If submissionId is not set, we need to create or get the current submission
        return core.setFailed('Submission ID is not set. Please run getCurrentSubmissionId first.');
        }

        try {
            await apiRequest<any>({
                url: `${url}applications/${productId}/submissions/${this.submissionId}`,
                method: 'DELETE',
            });
            core.info('Submission deleted successfully, resetting submissionId');
            this.submissionId = ""; // Clear submissionId after deletion
        } catch (error) {
            core.warning(`Error deleting submission ${JSON.stringify(error, null, 2)}`);
        }

    }

    async getStatus(productId:string, submissionId: string) {
        if (!this.accessToken) {
            core.setFailed('Access token is not set. Please run configure first.');
            return;
        }

        if (!submissionId || submissionId === "") {
            submissionId = await this.getCurrentSubmissionId(productId, false);
        }

        let status: any;
        try {
            status = await apiRequest<any>({
                url: `${url}applications/${productId}/submissions/${submissionId}/status`,
                method: 'GET',
            });
            core.info('Got submission status successfully');
            
        } catch (error) {
            core.setFailed(`Error getting submission status ${JSON.stringify(error, null, 2)}`);
        }
        return JSON.stringify(status, null, 2);
    }

    async pollStatus(productId: string, interval: number = 5000, maxRetries: number = 60) {
        for (let i = 0; i < maxRetries; i++) {
            const status = await this.getStatus(productId,this.submissionId);
            core.info(`Current status: ${status}. Retrying in ${interval}ms...`);
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        core.setFailed('Polling timed out');
    }

    async commitSubmission(productId: string) {
        if (!this.accessToken) {
            core.setFailed('Access token is not set. Please run configure first.');
            return;
        }

        if (!this.submissionId || this.submissionId === "") {
            this.submissionId = await this.getCurrentSubmissionId(productId, false);
        }

        try {
            await apiRequest<any>({
                url: `${url}applications/${productId}/submissions/${this.submissionId}/commit`,
                method: 'POST',
            });
            core.info('Submission committed successfully');
        } catch (error) {
            core.setFailed(`Error committing submission ${JSON.stringify(error, null, 2)}`);
        }
    }

 
    /**
 * Returns a new object containing only the specified fields from the source object.
 */
 filterFields<T extends object>(source: T):any {
  const result: { [key: string]: unknown } = {};
  for (const field of fieldsNeccessary) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      result[field] = (source as any)[field];
    }
  }
  return result;
}

/**
 * Validates that all BaseListing.Images[].ImageType in each Listings locale are valid.
 * Throws an error if any invalid type is found.
 */
 validate_json(input: any): void {
        /** Expected ValidImageTypes values */
  // core.info("Validating JSON structure...");
  // if (!input || typeof input !== "object" || !input.Listings) {
  //   throw new Error("Invalid input: Listings property missing.");
  // }
  // for (const locale of Object.keys(input.Listings)) {
  //   const baseListing = input.Listings[locale]?.BaseListing;
  //   if (!baseListing || !Array.isArray(baseListing.Images)) continue;
  //   for (const img of baseListing.Images) {
  //     if (!img.ImageType || !ValidImageTypes.includes(img.ImageType)) {
  //       throw new Error(
  //         `Invalid ImageType "${img.ImageType}" in locale "${locale}". Allowed types: ${ValidImageTypes.join(", ")}`
  //       );
  //     }
  //   }
  // }
}

async add_files_to_metadata(metadata_json: any, packagePath: string, photosPath: string) {

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
        if (ValidImageTypes.includes(type)) {
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

    
}