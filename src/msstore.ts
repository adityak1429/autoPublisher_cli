import { apiRequest, setHeaders } from './apiHelper';

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
// };

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
              "applicationCategory",
              "pricing",
              "visibility",
              "targetPublishMode",
              "targetPublishDate",
              "listings",
              "hardwarePreferences",
              "automaticBackupEnabled",
              "canInstallOnRemovableMedia",
              "isGameDvrEnabled",
              "gamingOptions",
              "hasExternalInAppProducts",
              "meetAccessibilityGuidelines",
              // "applicationPackages",
              "notesForCertification",
              "packageDeliveryOptions",
              "enterpriseLicensing",
              "allowMicrosoftDecideAppAvailabilityToFutureDeviceFamilies",
              "allowTargetFutureDeviceFamilies",
              "trailers",
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
            core.setFailed(`Error creating new submission: ${JSON.stringify(error, null, 2)}`);
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
            core.setFailed(`Error checking current submissions get on ${url}applications/${productId} ${JSON.stringify(error, null, 2)}`);
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
        return this.toLowerCaseKeys(metadata);
    }
    /**
     * Recursively converts the first letter of all JSON object keys to lower case.
     */
    toLowerCaseKeys(obj: any): any {
      if (Array.isArray(obj)) {
        return obj.map(item => this.toLowerCaseKeys(item));
      } else if (obj !== null && typeof obj === 'object') {
        const newObj: any = {};
        for (const key of Object.keys(obj)) {
          const newKey = key.charAt(0).toLowerCase() + key.slice(1);
          newObj[newKey] = this.toLowerCaseKeys(obj[key]);
        }
        return newObj;
      }
      return obj;
    }

    async updateMetadata(productId: string, metadata: any) {
        metadata = this.toLowerCaseKeys(metadata);

        // validate_json(metadata, fieldsNeccessary);

        if (!this.accessToken) {
            core.setFailed('Access token is not set. Please run configure first.');
            return;
        }

        if(this.submissionId === "" || !this.submissionId) {
            // If submissionId is not set, we need to create or get the current submission 
            this.submissionId = await this.getCurrentSubmissionId(productId,true);
        }

        //submit metadata to API
        core.info(`Updating metadata for current submission with id ${this.submissionId} with metadata: ${JSON.stringify(metadata, null, 2)}`);
        let res: any = {};
        try {
            res = await apiRequest<any>({
                url: `${url}applications/${productId}/submissions/${this.submissionId}`,
                method: 'PUT',
                body: JSON.stringify(metadata, null, 2),
            });
            core.info('Metadata updated successfully');
        } catch (error) {
            core.setFailed(`Error updating metadata for current submission ${JSON.stringify(error, null, 2)}`);
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
         core.setFailed('Submission ID is not set. Please run getCurrentSubmissionId first.');
         return;
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
 filterFields<T extends object>(source: T): any {
        const result: { [key: string]: unknown } = {};
        const sourceKeys = Object.keys(source).reduce((acc, key) => {
            acc[key] = key;
            return acc;
        }, {} as Record<string, string>);

        for (const field of fieldsNeccessary) {
            if (sourceKeys[field]) {
                const originalKey = sourceKeys[field];
                result[field] = (source as any)[originalKey];
            }
        }
        // Remove images from baseListing in listings locales
        if (result.listings && typeof result.listings === "object") {
            const listings = result.listings as { [key: string]: any };
            for (const locale of Object.keys(listings)) {
                if (
                    listings[locale] &&
                    listings[locale].baseListing &&
                    "images" in listings[locale].baseListing
                ) {
                    delete listings[locale].baseListing.images;
                }
            }
        }
        if (
          (!result.allowTargetFutureDeviceFamilies || Object.keys(result.allowTargetFutureDeviceFamilies).length === 0)
        ) {
          result.allowTargetFutureDeviceFamilies = {
            Desktop: false,
            Mobile: false,
            Xbox: false,
            Holographic: false
          };
        }
        return result;
    }

    async add_files_to_metadata(productId: string, metadata_json: any, packageFiles: any, mediaFiles: any) {
        // Ensure applicationPackages exists and is an array
        if (!Array.isArray(metadata_json.applicationPackages)) {
            metadata_json.applicationPackages = [];
        }

        // Ensure listings exists and each locale has baseListing.images as an array
        if (metadata_json.listings && typeof metadata_json.listings === "object") {
            for (const locale of Object.keys(metadata_json.listings)) {
                if (
                    !metadata_json.listings[locale].baseListing ||
                    typeof metadata_json.listings[locale].baseListing !== "object"
                ) {
                    metadata_json.listings[locale].baseListing = {};
                }
                if (!Array.isArray(metadata_json.listings[locale].baseListing.images)) {
                    metadata_json.listings[locale].baseListing.images = [];
                }
            }
        }

        // Ensure trailers exists and is an array
        if (!Array.isArray(metadata_json.trailers)) {
            metadata_json.trailers = [];
        }

        metadata_json.trailers = []; // Reinitialize trailers 

        let metadata_in_portal = await this.getMetadata(productId);
        core.info("Metadata JSON in portal: " + JSON.stringify(metadata_in_portal, null, 2));
        if (metadata_in_portal) {
            // Copy applicationPackages from portal to metadata_json
            if (Array.isArray(metadata_in_portal.applicationPackages)) {
                metadata_json.applicationPackages = metadata_in_portal.applicationPackages;
            }
            
            // Copy images for each locale in listings from portal to metadata_json
            if (
                metadata_in_portal.listings &&
                typeof metadata_in_portal.listings === "object" &&
                metadata_json.listings &&
                typeof metadata_json.listings === "object"
            ) {
                for (const locale of Object.keys(metadata_json.listings)) {
                    if (
                        metadata_in_portal.listings[locale] &&
                        metadata_in_portal.listings[locale].baseListing &&
                        Array.isArray(metadata_in_portal.listings[locale].baseListing.images)
                    ) {
                        if (
                            metadata_json.listings[locale] &&
                            metadata_json.listings[locale].baseListing
                        ) {
                            metadata_json.listings[locale].baseListing.images = JSON.parse(
                                JSON.stringify(metadata_in_portal.listings[locale].baseListing.images)
                            );
                        }
                    }
                }
            }
        }


        if (!metadata_json.listings || Object.keys(metadata_json.listings).length === 0) {
          core.warning("No listings found in metadata_json, skipping file/media addition.");
          return metadata_json;
        }

        // Set fileStatus to "PendingDelete" for all packages 
        if (metadata_json.applicationPackages && Array.isArray(metadata_json.applicationPackages)) {
            for (const pkg of metadata_json.applicationPackages) {
                pkg.fileStatus = "PendingDelete";
            }
        }

        // Set fileStatus to "PendingDelete" for all images 
        const listings = metadata_json?.listings;
        if (listings && typeof listings === "object") {
            for (const locale of Object.keys(listings)) {
                const images = listings[locale]?.baseListing?.images;
                if (Array.isArray(images)) {
                    for (const img of images) {
                        img.fileStatus = "PendingDelete";
                    }
                }
            }
        }

        // PendingUpload for all packages
        // Add entries for each file in packagePath directory to applicationPackages
        for (const packEntry of packageFiles) {
            const fileName = packEntry.filename || packEntry.originalname;
            const entry = {
                fileName: fileName,
                fileStatus: "PendingUpload",
            };
            metadata_json.applicationPackages.push(entry);
        }

        // PendingUpload all photos and trailers
        for (const file of mediaFiles) {
            const fileName = file.filename || file.originalname;
            if (!fileName) {
                core.warning("File name is missing, skipping this file.");
                continue;
            }
            // Parse type and locale from naming convention: Screenshot_en_fasdf.png or Screenshot_all_gs.png
            // Example: Screenshot_en_fasdf.png -> type=Screenshot, locale=en
            // Example: Screenshot_all_gs.png -> type=Screenshot, locale=all
            const nameParts = fileName.split("_");
            const type = nameParts[0];
            const locale = nameParts.length > 1 ? nameParts[1] : null;

            if (ValidImageTypes.includes(type) && locale) {
                if (locale === "all") {
                    // Add to all locales
                    for (const loc of Object.keys(metadata_json.listings)) {
                        if (
                            metadata_json.listings[loc] &&
                            metadata_json.listings[loc].baseListing &&
                            Array.isArray(metadata_json.listings[loc].baseListing.images)
                        ) {
                            metadata_json.listings[loc].baseListing.images.push({
                                fileStatus: "PendingUpload",
                                fileName: fileName,
                                ImageType: type
                            });
                        }
                    }
                } else if (metadata_json.listings[locale]) {
                    // Add the image entry to the specific locale in listings
                    if (
                        metadata_json.listings[locale] &&
                        metadata_json.listings[locale].baseListing &&
                        Array.isArray(metadata_json.listings[locale].baseListing.images)
                    ) {
                        metadata_json.listings[locale].baseListing.images.push({
                            fileStatus: "PendingUpload",
                            fileName: fileName,
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
                let imageListJson: { [loc: string]: { title: string; imageList: any[] } } = {};
                for (const loc of Object.keys(metadata_json.listings)) {
                    imageListJson[loc] = { title: "", imageList: [] };
                }
                metadata_json.trailers.push({ videoFileName: fileName, trailerAssets: imageListJson });
            }
            else {
                core.warning(`Unknown media type "${type}" in file "${fileName}" check the prefix. Skipping.`);
                continue;
            }
        }

    // Add all trailer images to metadata
    for (const file of mediaFiles) {
        const fileName = file.filename || file.originalname;
        const nameParts = fileName.split("_");
        const type = nameParts[0];
        const locale = nameParts.length > 1 ? nameParts[1] : null;
        if (!fileName || !type || !locale) {
            core.warning(`File name "${fileName}" is missing type or locale, skipping this file.`);
            continue;
        }
        if(type === "TrailerImage" ) {
            for (const trailer of metadata_json.trailers) {
                const videoBaseName = trailer.videoFileName.split("_")[2]?.split(".")[0];
                const fileBaseName = fileName.split("_")[2]?.split(".")[0];
                if (videoBaseName === fileBaseName) {
                    // For the matching locale in trailerAssets, add the TrailerImage to imageList
                    if (locale === "all") {
                        // Add to all locales
                        for (const loc of Object.keys(trailer.trailerAssets)) {
                            if (trailer.trailerAssets[loc] && Array.isArray(trailer.trailerAssets[loc].imageList)) {
                                trailer.trailerAssets[loc].title = trailer.trailerAssets[loc].title || videoBaseName;
                                trailer.trailerAssets[loc].imageList.push({
                                    fileName: fileName,
                                    description: null
                                });
                            }
                        }
                      }
                    else if (trailer.trailerAssets[locale] && Array.isArray(trailer.trailerAssets[locale].imageList)) {
                        trailer.trailerAssets[locale].title = trailer.trailerAssets[locale].title || videoBaseName;
                        trailer.trailerAssets[locale].imageList.push({
                            fileName: fileName,
                            description: null
                        });
                    }
                }
            }
        }
    }
    return metadata_json;
}

    
}