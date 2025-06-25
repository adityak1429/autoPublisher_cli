import * as core from "@actions/core";
import { StoreApis, EnvVariablePrefix } from "./store_apis";
import { get } from "http";
const storeApis = new StoreApis();

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
        core.setSecret(storeApis.productId);
        core.setSecret(storeApis.sellerId);
        core.setSecret(storeApis.tenantId);
        core.setSecret(storeApis.clientId);
        core.setSecret(storeApis.clientSecret);
        core.setSecret(storeApis.accessToken);
}

async function getMetadata() {
        const moduleName = core.getInput("module-name");
        const listingLanguage = core.getInput("listing-language");
        const draftSubmission = await storeApis.GetExistingDraft(
          moduleName,
          listingLanguage
        );
        return JSON.stringify(draftSubmission, null, 2);
}

async function update_metadata() {
  const updatedMetadataString = core.getInput("metadata-update");
  const updatedProductString = core.getInput("product-update");
  if (!updatedMetadataString && !updatedProductString) {
    core.setFailed(
      `Nothing to update. Both product-update and metadata-update are null.`
    );
    return;
  }

  if (updatedMetadataString) {
    const updateSubmissionMetadata =
      await storeApis.UpdateSubmissionMetadata(updatedMetadataString);
    console.log(updateSubmissionMetadata);
  }

  if (updatedProductString) {
    const updateSubmissionData = await storeApis.UpdateProductPackages(
      updatedProductString
    );
    console.log(updateSubmissionData);
  }
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
        let metadata = JSON.parse(await getMetadata());
        delete metadata.code;
        delete metadata.errors;
        delete metadata.isSucess;
        delete metadata.responseData;
        delete metadata.target;
        core.info(JSON.stringify(metadata, null, 2));
        break;
      }

      case "publish": {
        await setEnvVariables();
        await update_metadata();
        const submissionId = await storeApis.PublishSubmission();
        await poll_submission(submissionId);
        break;
      }

      default: {
        core.setFailed(`Unknown command - ("${command}").`);

        break;
      }
    }
  } catch (error: unknown) {
    core.setFailed(error as string);
  }
}
