import { apiRequest, setHeaders } from './apiHelper';
/**
 * MSStoreClient class provides methods to interact with the Microsoft Store API for app submission and management.
 * It allows configuring the client with OAuth credentials, reserving app names (in progress), creating submissions,
 * updating metadata, committing submissions, and checking submission status.
 */
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
    private tenant_id: string = "";
    private client_id: string = "";
    private client_secret: string = "";


    async configure(tenantId: string, clientId: string, clientSecret: string): Promise<void> {
        console.log("Getting accessToken...");
        
        tenantId = tenantId.trim();
        clientId = clientId.trim();
        clientSecret = clientSecret.trim();
        this.tenant_id = tenantId;
        this.client_id = clientId;
        this.client_secret = clientSecret;
        
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

        this.accessToken = tokenResponse.data.access_token;
        setHeaders({
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
        });
        return;
    }

    async sendRequest(url: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body: string =  "") {

        try {
            const response = await apiRequest({
                url,
                method,
                body: body,
            });
            if (response.status === 403 || response.status === 401) {
                // Try to refresh token and resend once
                await this.configure(this.tenant_id, this.client_id, this.client_secret);
                return await apiRequest({
                    url,
                    method,
                    body: body ,
                });
            }
            return response.data;
        } catch (error) {
            console.error(`Error in sendRequest: ${JSON.stringify(error, null, 2)}`);
            throw error;
        }
    }

    async reserve_name(name: string): Promise<string>;
    async reserve_name(name: string, product_id: string): Promise<string>;
    async reserve_name(name: string, product_id?: string): Promise<string> {
      if (!this.accessToken) {
        console.error('Access token is not set. Please run configure first.');
    }
    return "";
    
      //work in progress
    }

    async createSubmission(productId: string) {
        try {
            console.log("Creating a new submission...");
            const submissionResponse = await this.sendRequest(`${url}applications/${productId}/submissions`, 'POST');

            this.submissionId = submissionResponse.id;
            console.log('Created new submission');
            return this.submissionId;
        } catch (error) {
            console.error(`Error creating new submission: ${JSON.stringify(error, null, 2)}`);
            return "";
        }
    }

    async getCurrentSubmissionId(productId: string, createNew: boolean): Promise<string> {
        console.log('Submission ID is not set, fetching current submission ID');
       let product_data: any;
        try {
            console.log('Getting app data');
            product_data = await this.sendRequest(`${url}applications/${productId}`, 'GET');
        } catch (error) {
            console.error(`Error checking current submissions get on ${url}applications/${productId} ${JSON.stringify(error, null, 2)}`);
            return "";
        }

        try{
        if (product_data.pendingApplicationSubmission) {
            console.log('Found pending submission');
            this.submissionId = product_data.pendingApplicationSubmission.id;
        } else if (createNew){
            console.log('No pending submission found, creating submission');
            await this.createSubmission(productId);
        }
        else {
            console.log('No pending submission found, using last published submission');
            this.submissionId = product_data.lastPublishedApplicationSubmission.id;
        }
        if (!this.submissionId) {
            console.log(JSON.stringify(product_data, null, 2));
            console.error('submissionId is undefined, no submissions found');
            return "";
        }
    } catch (error) {
        console.warn(`Error getting current submission ID: ${error} ${JSON.stringify(error, null, 2)}`);
        return "";
    }

        return this.submissionId;
    }

    async getMetadata(productId: string) {

        if (!this.accessToken) {
            console.error('Access token is not set. Please run configure first.');
            return;
        }

        if (!this.submissionId || this.submissionId === "") {
            this.submissionId = await this.getCurrentSubmissionId(productId,false);
        }

        let metadata: any;
        try {
            metadata = await this.sendRequest(`${url}applications/${productId}/submissions/${this.submissionId}`, 'GET');
            console.log(`Got metadata for current submission with id ${this.submissionId}`);
        } catch (error) {
            console.error(`Error getting metadata for current submissions ${error}`);
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
    
    /**
     * Validates the structure and content of a metadata JSON object according to the app_resource format.
     * Throws an error with a descriptive message if validation fails.
     * Returns true if validation passes.
     */
    async validate_json(json: any) {
        // 1. Top-level object check
        if (typeof json !== "object" || json === null) {
            throw new Error("Input must be a non-null object.");
        }

        // 2. applicationCategory: required, string, must be valid
        const validCategories = [
            "BooksAndReference", "Business", "DeveloperTools", "Education", "Entertainment",
            "FamilyAndKids", "FoodAndDining", "GovernmentAndPolitics", "HealthAndFitness",
            "Lifestyle", "Medical", "Music", "NavigationAndMaps", "NewsAndWeather",
            "PersonalFinance", "PhotoAndVideo", "Productivity", "Security", "Shopping",
            "Social", "Sports", "Travel", "Utilities", "Weather", "Other"
        ];
        if (typeof json.applicationCategory !== "string" || !json.applicationCategory) {
            throw new Error("Missing or invalid applicationCategory (must be a non-empty string).");
        }
        if (!validCategories.includes(json.applicationCategory)) {
            throw new Error(`Invalid applicationCategory: ${json.applicationCategory}`);
        }

        // 3. applicationPackages: required, non-empty array, each with fileName and fileStatus
        if (!Array.isArray(json.applicationPackages) || json.applicationPackages.length === 0) {
            throw new Error("applicationPackages must be a non-empty array.");
        }
        for (const [i, pkg] of json.applicationPackages.entries()) {
            if (typeof pkg !== "object" || pkg === null) {
                throw new Error(`applicationPackages[${i}] must be an object.`);
            }
            if (typeof pkg.fileName !== "string" || !pkg.fileName) {
                throw new Error(`applicationPackages[${i}].fileName must be a non-empty string.`);
            }
            if (typeof pkg.fileStatus !== "string" || !pkg.fileStatus) {
                throw new Error(`applicationPackages[${i}].fileStatus must be a non-empty string.`);
            }
        }

        // 4. listings: required, object, at least one locale
        if (typeof json.listings !== "object" || json.listings === null) {
            throw new Error("listings must be a non-null object.");
        }
        const locales = Object.keys(json.listings);
        if (locales.length === 0) {
            throw new Error("listings must have at least one locale.");
        }
        for (const locale of locales) {
            const listing = json.listings[locale];
            if (typeof listing !== "object" || listing === null) {
                throw new Error(`listings.${locale} must be an object.`);
            }
            // baseListing required
            if (!listing.baseListing || typeof listing.baseListing !== "object") {
                throw new Error(`listings.${locale}.baseListing is required and must be an object.`);
            }
            // baseListing.images: array of images
            if (!Array.isArray(listing.baseListing.images)) {
                throw new Error(`listings.${locale}.baseListing.images must be an array.`);
            }
            for (const [j, img] of listing.baseListing.images.entries()) {
                if (typeof img !== "object" || img === null) {
                    throw new Error(`listings.${locale}.baseListing.images[${j}] must be an object.`);
                }
                if (typeof img.fileName !== "string" || !img.fileName) {
                    throw new Error(`listings.${locale}.baseListing.images[${j}].fileName must be a non-empty string.`);
                }
                if (typeof img.fileStatus !== "string" || !img.fileStatus) {
                    throw new Error(`listings.${locale}.baseListing.images[${j}].fileStatus must be a non-empty string.`);
                }
                if (typeof img.imageType !== "string" || !img.imageType) {
                    throw new Error(`listings.${locale}.baseListing.images[${j}].imageType must be a non-empty string.`);
                }
            }
        }

        // 5. trailers: required, array, each with videoFileName and trailerAssets
        if (!Array.isArray(json.trailers)) {
            throw new Error("trailers must be an array.");
        }
        for (const [i, trailer] of json.trailers.entries()) {
            if (typeof trailer !== "object" || trailer === null) {
                throw new Error(`trailers[${i}] must be an object.`);
            }
            if (typeof trailer.videoFileName !== "string" || !trailer.videoFileName) {
                throw new Error(`trailers[${i}].videoFileName must be a non-empty string.`);
            }
            if (typeof trailer.trailerAssets !== "object" || trailer.trailerAssets === null) {
                throw new Error(`trailers[${i}].trailerAssets must be an object.`);
            }
            // Each locale in trailerAssets
            for (const locale of Object.keys(trailer.trailerAssets)) {
                const asset = trailer.trailerAssets[locale];
                if (typeof asset !== "object" || asset === null) {
                    throw new Error(`trailers[${i}].trailerAssets.${locale} must be an object.`);
                }
                if (typeof asset.title !== "string") {
                    throw new Error(`trailers[${i}].trailerAssets.${locale}.title must be a string.`);
                }
                if (!Array.isArray(asset.imageList)) {
                    throw new Error(`trailers[${i}].trailerAssets.${locale}.imageList must be an array.`);
                }
                for (const [k, img] of asset.imageList.entries()) {
                    if (typeof img !== "object" || img === null) {
                        throw new Error(`trailers[${i}].trailerAssets.${locale}.imageList[${k}] must be an object.`);
                    }
                    if (typeof img.fileName !== "string" || !img.fileName) {
                        throw new Error(`trailers[${i}].trailerAssets.${locale}.imageList[${k}].fileName must be a non-empty string.`);
                    }
                }
            }
        }

        // 6. Optionally, check for other required top-level fields as per your schema
        // e.g. pricing, visibility, etc.

        // If all checks pass
        return true;
    }


    async updateMetadata(productId: string, metadata: any) {
        
        if (!this.accessToken) {
            console.error('Access token is not set. Please run configure first.');
            return;
        }
        
        if(this.submissionId === "" || !this.submissionId) {
            // If submissionId is not set, we need to create or get the current submission 
            this.submissionId = await this.getCurrentSubmissionId(productId,true);
        }
        
        metadata = this.toLowerCaseKeys(metadata);

        await this.validate_json(metadata);
        //submit metadata to API
        // console.log(`Updating metadata for current submission with id ${this.submissionId} with metadata: ${JSON.stringify(metadata, null, 2)}`);
        let res: any = {};
        try {
            res = await this.sendRequest(`${url}applications/${productId}/submissions/${this.submissionId}`, 'PUT', JSON.stringify(metadata, null, 2));
            console.log('Metadata updated successfully');
        } catch (error) {
            console.error(`Error updating metadata for current submission ${JSON.stringify(error, null, 2)}`);
        }
        return res;
    }

    async deleteSubmission(productId: string) {
        if (!this.accessToken) {
            console.error('Access token is not set. Please run configure first.');
            return;
        }

        if (!this.submissionId || this.submissionId === "") {
            // If submissionId is not set, we need to create or get the current submission
         console.error('Submission ID is not set. Please run getCurrentSubmissionId first.');
         return;
        }

        try {
            await this.sendRequest(`${url}applications/${productId}/submissions/${this.submissionId}`, 'DELETE');
            console.log('Submission deleted successfully, resetting submissionId');
            this.submissionId = ""; // Clear submissionId after deletion
        } catch (error) {
            console.warn(`Error deleting submission ${JSON.stringify(error, null, 2)}`);
        }

    }

    async getStatus(productId:string, submissionId: string): Promise<string> {
        if (!this.accessToken) {
            console.error('Access token is not set. Please run configure first.');
            return "";
        }

        if (!submissionId || submissionId === "") {
            submissionId = await this.getCurrentSubmissionId(productId, false);
        }

        let status: any;
        try {
            status = await this.sendRequest(`${url}applications/${productId}/submissions/${submissionId}/status`, 'GET');
            // console.log('Got submission status successfully');
            
        } catch (error) {
            console.error(`Error getting submission status ${JSON.stringify(error, null, 2)}`);
        }
        return JSON.stringify(status, null, 2);
    }

    async pollStatus(productId: string, interval: number = 5000, maxRetries: number = 60) {
        let prev_status = "";
        for (let i = 0; i < maxRetries; i++) {
            const status = await this.getStatus(productId,this.submissionId);
            if(status === prev_status) {
                console.log(`Status has not changed, waiting for ${interval}ms...`);
                await new Promise(resolve => setTimeout(resolve, interval));
            }
            else{
                console.log(`Current status: ${status}. Retrying in ${interval}ms...`);
                prev_status = status;
                if(JSON.parse(status).status !== "CommitStarted") {
                    return; // Exit loop if status is not "InProgress"
                }
                await new Promise(resolve => setTimeout(resolve, interval));
            }
        }
        console.error('Polling timed out');
    }

    

    async commitSubmission(productId: string) {
        if (!this.accessToken) {
            console.error('Access token is not set. Please run configure first.');
            return;
        }

        if (!this.submissionId || this.submissionId === "") {
            this.submissionId = await this.getCurrentSubmissionId(productId, false);
        }

        try {
            await this.sendRequest(`${url}applications/${productId}/submissions/${this.submissionId}/commit`, 'POST');
            console.log('Submission committed successfully');
        } catch (error) {
            console.error(`Error committing submission ${JSON.stringify(error, null, 2)}`);
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

    
    async add_files_to_metadata(productId: string, metadata_json: any, packageFiles: any, mediaFiles: any, append: boolean = false): Promise<any> {
        
        function list_from_locale(locale: string): string[] {
            if (locale.startsWith("all")) {
                // Exclude locales listed after 'all', e.g., all_en,fr
                const excludeList = locale.length > 3 ? locale.slice(4).split(",") : [];
                return Object.keys(metadata_json.listings).filter(loc => !excludeList.includes(loc));
            } else {
                return locale.split(",");
            }
        }
        
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
          console.warn("No listings found in metadata_json, skipping file/media addition.");
          return metadata_json;
        }
        
        
        // If append is true, we do not delete existing images
        if(!append){
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

        
        //143 todo pending delete existing trailer video/ trailer image if it already exists in metadata_json in same listing
        // PendingUpload all photos and trailers
        for (const file of mediaFiles) {
            const fileName = file.filename || file.originalname;
            if (!fileName) {
                console.warn("File name is missing, skipping this file.");
                continue;
            }
            // Parse type and locale from naming convention: Screenshot_en_fasdf.png or Screenshot_all_gs.png
            // Example: Screenshot_en_fasdf.png -> type=Screenshot, locale=en
            // Example: Screenshot_all_gs.png -> type=Screenshot, locale=all
            const match = fileName.match(/^([^_]+)_([^_]+)_/);
            if (!match) {
                console.warn(`File name "${fileName}" does not match expected format. Skipping.`);
                continue;
            }
            const [, type, locale] = match;
            const langs = list_from_locale(locale);

            if (ValidImageTypes.includes(type)) {
                for (const loc of langs) {
                    if (
                        metadata_json.listings[loc] &&
                        metadata_json.listings[loc].baseListing
                    ) {
                        if (!metadata_json.listings[loc].baseListing.images) metadata_json.listings[loc].baseListing.images=[];

                        if (type === "Icon") {
                            // If the icon or trailer image already exists, set its fileStatus to PendingDelete
                            const existingImage = metadata_json.listings[loc].baseListing.images.find(img => img.imageType === type);
                            if (existingImage) {
                                existingImage.fileStatus = "PendingDelete";
                            }
                        }

                        metadata_json.listings[loc].baseListing.images.push({
                            fileStatus: "PendingUpload",
                            fileName: fileName,
                            imageType: type
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
                // Parse the locale from the file name
                for (const loc of langs) {
                    if (!imageListJson[loc]) {
                        imageListJson[loc] = { title: fileName, imageList: [] };
                    }
                }
                metadata_json.trailers.push({ videoFileName: fileName, trailerAssets: imageListJson });
            }
            else {
                console.warn(`Unknown media type "${type}" in file "${fileName}" check the prefix. Skipping.`);
                continue;
            }
        }


        // Add all trailer images to metadata
    for (const file of mediaFiles) {
        const fileName = file.filename || file.originalname;
        const nameParts = fileName.split("_");
        const type = nameParts[0];
        const locale = nameParts.length > 1 ? nameParts[1] : null;

        if(type === "TrailerImage" ) {
            console.log(`Adding trailer image ${fileName} to metadata_json`);
            const langs = list_from_locale(locale);
            for (const trailer of metadata_json.trailers) {
                for (const loc of langs) {
                if (trailer.trailerAssets && trailer.trailerAssets[loc]) {
                    // remove existing Trailer image since only one image is allowed per locale
                    trailer.trailerAssets[loc].imageList=[];
                    trailer.trailerAssets[loc].imageList.push({
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