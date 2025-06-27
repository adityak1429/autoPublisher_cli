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
import { StoreApis, EnvVariablePrefix } from "./store_apis";
const storeApis = new StoreApis();
import { uploadFileToBlob, getFilesNamesFromDirectory, readJSONFile } from '../common_functions';

/**
 *  Sample usage:
 *   uploadFileToBlob(
     uploadUrl,
     zipFilePath,
     (progress) => core.info(`Upload progress: ${progress}%`)
   ).then((etag) => {
     core.info(`Upload complete! ETag: ${etag}`);
   }).catch(console.error);
 */

   
async function setEnvVariables() {
        storeApis.productId = core.getInput("product-id");
        storeApis.sellerId = core.getInput("seller-id");
        storeApis.tenantId = core.getInput("tenant-id");
        storeApis.clientId = core.getInput("client-id");
        storeApis.clientSecret = core.getInput("client-secret");

        await storeApis.InitAsync();

        core.exportVariable(
          `${EnvVariablePrefix}product_id`,
          storeApis.productId
        );
        core.exportVariable(
          `${EnvVariablePrefix}seller_id`,
          storeApis.sellerId
        );
        core.exportVariable(
          `${EnvVariablePrefix}tenant_id`,
          storeApis.tenantId
        );
        core.exportVariable(
          `${EnvVariablePrefix}client_id`,
          storeApis.clientId
        );
        core.exportVariable(
          `${EnvVariablePrefix}client_secret`,
          storeApis.clientSecret
        );
        core.exportVariable(
          `${EnvVariablePrefix}access_token`,
          storeApis.accessToken
        );
}




async function getMetadata() {
        const draftSubmission = await storeApis.GetExistingDraft(
        );
        return draftSubmission;
}

async function update_metadata(updatedMetadataString:string,updatedProductString:string) {
  if (!updatedMetadataString && !updatedProductString) {
    core.warning(
      `Nothing to update. Both product-update and metadata-update are null.`
    );
    return;
  }

  core.info(`Updating metadata and product packages...`);

  if (updatedMetadataString) {
    const updateSubmissionMetadata =
      await storeApis.UpdateSubmissionMetadata(updatedMetadataString);
    console.log(updateSubmissionMetadata);
    core.info(`Updated metadata.`);
  }

  if (updatedProductString) {
    const updateSubmissionData = await storeApis.UpdateProductPackages(
      updatedProductString
    );
    console.log(updateSubmissionData);
    core.info(`Updated product packages.`);
  }
  core.info(`done update_metadata.`);
}

async function poll_submission(pollingSubmissionId: string) {

  if (!pollingSubmissionId) {
    core.setFailed(`polling-submission-id parameter cannot be empty.`);
    return;
  }

  const publishingStatus = await storeApis.PollSubmissionStatus(
    pollingSubmissionId
  );
  core.info(`submission-status: ${publishingStatus}`);
}

async function json_init() {
        const metadataString = await getMetadata();
        let metadata;
        try {
          metadata = JSON.parse(metadataString);
        } catch (e) {
          core.setFailed(`Failed to parse metadata as JSON: ${e}`);
          return {};
        }
        delete metadata.errors;
        delete metadata.isSucess;
        return metadata;
}


async function update_metadata_list(metadata_get: any, metadata_in_portal: any) {
  let list_of_update_requests: string[] = [];
  if (!metadata_get || !metadata_in_portal) {
    core.setFailed(`metadata_get or metadata_in_portal is null.`);
    return list_of_update_requests;
  }
  let langs_needed: string[] = [];
  let langs_present: string[] = [];
  if (metadata_get && Array.isArray(metadata_get.listings)) {
    langs_needed = metadata_get.listings
      .map((listing: any) => listing.language)
  }
  if (metadata_get && Array.isArray(metadata_get.listings)) {
    langs_present = metadata_in_portal.listings
      .map((listing: any) => listing.language)
  }
  const listingsToAdd: string[] = [];
  const listingsToRemove: string[] = [];

  for (const lang of langs_needed) {
    if (!langs_present.includes(lang)) {
      listingsToAdd.push(lang);
    }
  }

  for (const lang of langs_present) {
    if (!langs_needed.includes(lang)) {
      listingsToRemove.push(lang);
    }
  }

  list_of_update_requests.push(`{
    "listingsToAdd": [${(listingsToAdd.map(lang => `"${lang}"`).join(", "))}],
    "listingsToRemove": [${(listingsToRemove.map(lang => `"${lang}"`).join(", "))}]
  }`);

  for (const listing of metadata_get.listings) {
    const listingCopy = JSON.parse(JSON.stringify(listing));
    listingCopy.listings=listing;
    list_of_update_requests.push(`${JSON.stringify(listingCopy)}`)
  }



  return list_of_update_requests;
}

export async function exe_main() {

  try {
    const command = core.getInput("command");
    switch (command) {


      case "getmetadata": {
        await setEnvVariables();
        core.info(await getMetadata());
        break;
      }

      case "json_init": {
        await setEnvVariables();
        core.info(JSON.stringify(await json_init(), null, 2));
        break;
      }

      case "package_json_init": {
        await setEnvVariables();
        core.info(JSON.stringify(await storeApis.GetCurrentDraftSubmissionPackagesData(), null, 2));
        break;
      }

      case "publish": {
        await setEnvVariables();
        let json_file_path = core.getInput("json-file-path");
        let updatedMetadata: string;



        const filesArray = getFilesNamesFromDirectory(core.getInput("photos-path"));

        // Create a map to hold language-specific files to make it easier to manage screenshots and logos
        const languageFilesMap: Record<string, { screenshots: string[]; logos: string[] }> = {};

        for (const {originalname, filePath} of filesArray) {
          const fileName = originalname.split(/[\\/]/).pop() || "";
          const match = fileName.match(/^(Screenshot|Logo)_(\w+)_/i);
          if (match) {
            const [, type, language] = match;
            if (!languageFilesMap[language]) {
              languageFilesMap[language] = { screenshots: [], logos: [] };
            }
            if (type.toLowerCase() === "screenshot") {
              languageFilesMap[language].screenshots.push(filePath);
            } else if (type.toLowerCase() === "logo") {
              languageFilesMap[language].logos.push(filePath);
            }
          }
        }

        // Iterate over the languageFilesMap to create listing assets and upload files and commit them too
        for (const [language, files] of Object.entries(languageFilesMap)) {
          let create_response:any;
          if (files.screenshots.length > 0 || files.logos.length > 0) {
            //get asset upload urls for the language
            create_response = await storeApis.CreateListingAssets(language, files.screenshots.length, files.logos.length);
            core.info(`Created listing assets for language: ${language}`);
            // Upload screenshots for the language
            for (const [index, screenshot] of files.screenshots.entries()) {
              const screenshotEtag = await uploadFileToBlob(
                create_response.responseData.listingAssets.screenshots[index].primaryAssetUploadUrl,
                screenshot,
                (progress) => core.info(`Upload progress for ${screenshot}: ${progress}%`),
                "image/png"
              );
              core.info(`Uploaded screenshot: ${screenshot} with ETag: ${screenshotEtag}`);
            }

            // Upload logos for the language
            for (const [index, logo] of files.logos.entries()) {
              const logoEtag = await uploadFileToBlob(
                create_response.responseData.listingAssets.storeLogos[index].primaryAssetUploadUrl,
                logo,
                (progress) => core.info(`Upload progress for ${logo}: ${progress}%`)
              );
              core.info(`Uploaded logo: ${logo} with ETag: ${logoEtag}`);
            }

            // commit the listing assets for the language
            console.log(await storeApis.CommitListingAssets(language, create_response.responseData.listingAssets.screenshots || [], create_response.responseData.listingAssets.storeLogos || []));
            core.info(`Committed listing assets for language: ${language}`);
        }
      }

        //if path to json file is provided, read the file and parse it
        //else, call json_init to get the metadata
        core.info("getting json metadata");
        let list_of_update_requests: string[] = [];
        const metadata_in_portal = await json_init();
        if(json_file_path) {
          updatedMetadata = await readJSONFile(json_file_path);
          list_of_update_requests = await update_metadata_list(updatedMetadata,metadata_in_portal);
        } else {
          updatedMetadata = metadata_in_portal;
        }
        await storeApis.UpdateDraftMetadataList(list_of_update_requests);
        const updatedProductString = core.getInput("package");
        
        // updates if product string is provided else it is still useful since it waits till all modules ready
        await update_metadata("", updatedProductString);
        return;
        const submissionId = await storeApis.PublishSubmission();
        core.info(`Submission ID: ${submissionId}`);
        await poll_submission(submissionId);
        break;
      }

      default: {
        core.setFailed(`Unknown command - ("${command}").`);

        break;
      }
    }
  } catch (error: unknown) {
    core.setFailed(`Caught error -> ${JSON.stringify(error)}`);
    return;
  }
}
