
import { StoreApis, EnvVariablePrefix } from "./store_apis";
const storeApis = new StoreApis();
import { uploadFileToBlob, getFilesNamesFromDirectory, readJSONFile, deepMergeSubset } from '../common_functions';
import * as core from "@actions/core";
// import * as dotenv from "dotenv";
// dotenv.config();
// const core = {
//   getInput(name: string): string {
//     const value = process.env[name.replace(/-/g, "_").toUpperCase()];
//     return value || "";
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
//   },
//   exportVariable(name: string, value: string): void {
//     process.env[name] = value;
//   }
// }

   
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
    const listingCopy = JSON.parse(JSON.stringify(metadata_get));
    listingCopy.listings=listing;
    list_of_update_requests.push(`${JSON.stringify(listingCopy)}`)
  }



  return list_of_update_requests;
}

async function get_updated_metadata() {
  let updatedMetadata: any = {};
  let json_file_path = core.getInput("json-file-path");
  //if path to json file is provided, read the file and parse it
  //else, call json_init to get the metadata
  core.info("getting json metadata");
  let list_of_update_requests: string[] = [];
  const metadata_in_portal = await json_init();

  if(json_file_path) {
    updatedMetadata = await readJSONFile(json_file_path);

    updatedMetadata = deepMergeSubset(updatedMetadata, metadata_in_portal);
    //143 deleting since privacy policy and terms of use are not needed in the json file becuase they cant be updated
    delete updatedMetadata.properties;
    list_of_update_requests = await update_metadata_list(updatedMetadata,metadata_in_portal);

  } else {
    updatedMetadata = metadata_in_portal;
  }

  await storeApis.UpdateDraftMetadataList(list_of_update_requests);
  return updatedMetadata
}

async function generate_languageFilesMap(filesArray: { originalname: string; filePath: string }[], all_listing_langs: string[]) {
  const languageFilesMap: Record<string, { screenshots: string[]; logos: string[] }> = {};

  for (const {originalname, filePath} of filesArray) {
    const fileName = originalname.split(/[\\/]/).pop() || "";
    console.log(`Processing file: ${fileName}`);
    const match = fileName.match(/^(Screenshot|Logo)_([^_]+)_/i);
    if (match) {
      const [, type, language] = match;

      let langs: string[] = [];
      if (language.startsWith("all")) {
        // Handle "all#en,fr" - all languages except en and fr
        const excludedLangs = language.slice(4).split(",").map(l => l.trim());
        langs = all_listing_langs.filter(l => !excludedLangs.includes(l));
      }
      else{
        // Handle multiple languages, e.g., "en,fr"
        langs = language.split(",").map(l => l.trim());
        langs = langs.filter(l => all_listing_langs.includes(l));
      }

      // add the file to the languageFilesMap for each language requested by the filename
      for (const lang of langs) {
        console.log(`Adding file "${fileName}" of type "${type}" for language "${lang}"`);
        if (!languageFilesMap[lang]) {
          languageFilesMap[lang] = { screenshots: [], logos: [] };
        }
        if (type.toLowerCase() === "screenshot") {
          languageFilesMap[lang].screenshots.push(filePath);
        } else if (type.toLowerCase() === "logo") {
          languageFilesMap[lang].logos.push(filePath);
        }
        else{
          core.warning(`Unknown file type "${type}" in filename "${fileName}". Expected "Screenshot" or "Logo".`);
        }
      }

    }
  }
  return languageFilesMap;
}

async function create_and_commit_listing_assets(languageFilesMap: Record<string, { screenshots: string[]; logos: string[] }>) {
  let draft_listing_assets:any = {};
  if(core.getInput("append") === "true") {
    draft_listing_assets = (await storeApis.GetExistingDraftListingAssets(""));
  }
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
          (progress) => core.info(`Upload progress for ${logo}: ${progress}%`),
          "image/png"
        );
        core.info(`Uploaded logo: ${logo} with ETag: ${logoEtag}`);
      }

      // commit the listing assets for the language
      let screenshotsToCommit = (create_response.responseData.listingAssets.screenshots || []).map(
        (screenshot: { id: string; primaryAssetUploadUrl: string; secondaryAssetUploadUrl?: string }) => ({
          id: screenshot.id,
          assetUrl: screenshot.primaryAssetUploadUrl,
        })
      );
      let logosToCommit = (create_response.responseData.listingAssets.storeLogos || []).map(
        (screenshot: { id: string; primaryAssetUploadUrl: string; secondaryAssetUploadUrl?: string }) => ({
          id: screenshot.id,
          assetUrl: screenshot.primaryAssetUploadUrl,
        })
      );;
      if (core.getInput("append") === "true") {
        if (draft_listing_assets && draft_listing_assets.listingAssets) {
          // If append is true, merge existing screenshots and logos with new ones
          screenshotsToCommit = [
            ...(draft_listing_assets.listingAssets.find((obj: any) => obj.language === language)?.screenshots || []),
            ...screenshotsToCommit
          ];
          // there can only be one storeLogo per language
          if(logosToCommit.length < 1) {
            //if no logos are provided, use the existing ones
            logosToCommit = draft_listing_assets.listingAssets.find((obj: any) => obj.language === language)?.storeLogos || [];
          }
        }
      }
      console.log(`Committing listing assets for language: ${language}`);
      console.log(`Screenshots to commit: ${(screenshotsToCommit.length)}`);
      console.log(`Logos to commit: ${(logosToCommit.length)}`);
      // Commit the listing assets
      const status_code =  (await storeApis.CommitListingAssets(language, screenshotsToCommit, logosToCommit));
      core.info(`Committed listing assets for language: ${language} with status code: ${status_code}`);
      console.log(JSON.stringify(status_code));
  }
}
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
        const metadata = await json_init();
        delete metadata.properties; // since privacy policy and terms of use are not needed in the json file becuase they cant be updated
        core.info(JSON.stringify(metadata, null, 2));
        break;
      }

      case "package_json_init": {
        await setEnvVariables();
        const packages_array = (await storeApis.GetCurrentDraftSubmissionPackagesData()).responseData;
        // Ensure each package has a genericDocUrl; set a default if missing (not sure if this is needed)
        //Required if packageType is exe Link to document containing details of custom error codes for the EXE type installer
        for (const pkg of packages_array.packages) {
          if (!pkg.genericDocUrl) {
            // for demo purposes, we set a default URL if genericDocUrl is not present
            // In a real scenario, you might want to ask the user to provide this URL
            console.warn(`Package ${pkg.name} does not have a genericDocUrl. Setting default.`);
            pkg.genericDocUrl = "https://docs.contoso.com/doclink";
          }
        }
        core.info(JSON.stringify(packages_array));
        break;
      }

      case "publish": {
        await setEnvVariables();

        //get_updated_metadata gets returns metadata from the json file and MAKES THE UPDATES to portal and returns the updated metadata
        const updatedMetadata = await get_updated_metadata();
        const all_listing_langs = updatedMetadata.listings.map((listing: any) => listing.language);

        
        const filesArray = getFilesNamesFromDirectory(core.getInput("photos-path"));
        // Create a map to hold language-specific files to make it easier to manage screenshots and logos
        const languageFilesMap: Record<string, { screenshots: string[]; logos: string[] }> = await generate_languageFilesMap(filesArray, all_listing_langs);

        // Iterate over the languageFilesMap to create listing assets and upload files and commit them too
        await create_and_commit_listing_assets(languageFilesMap);
        console.log(`Created and committed listing assets for languages: ${Object.keys(languageFilesMap).join(", ")}\n now updating product packages...`);

        
        // updates if product string is provided else it is still useful since it waits till all modules ready
        const updateSubmissionData = await storeApis.UpdateProductPackages(core.getInput("package"));
        core.info(`Updated product packages: ${JSON.stringify(updateSubmissionData)}`);
        const submissionId = await storeApis.PublishSubmission();
        core.info(`Submission ID: ${submissionId}`);
        // const publishingStatus = await storeApis.PollSubmissionStatus(
        //   submissionId
        // );
        // core.info(`submission-status: ${publishingStatus}`);
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
