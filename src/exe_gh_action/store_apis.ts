import * as https from "https";

export const EnvVariablePrefix = "MICROSOFT_STORE_ACTION_";

class ResponseWrapper<T> {
  responseData!: T;
  isSuccess!: boolean;
  errors!: Error[];
}

class ErrorResponse {
  statusCode!: number;
  message!: string;
}

class Error {
  code!: string;
  message!: string;
  target!: string;
}

class SubmissionResponse {
  pollingUrl!: string;
  submissionId!: string;
  ongoingSubmissionId!: string;
}

enum PublishingStatus {
  INPROGRESS = "INPROGRESS",
  PUBLISHED = "PUBLISHED",
  FAILED = "FAILED",
  UNKNOWN = "UNKNOWN",
}

class ModuleStatus {
  isReady!: boolean;
  ongoingSubmissionId!: string;
}

class SubmissionStatus {
  publishingStatus!: PublishingStatus;
  hasFailed!: boolean;
}

class ListingAssetsResponse {
  listingAssets!: ListingAsset[];
}

class ImageSize {
  width!: number;
  height!: number;
}

class ListingAsset {
  language!: string;
  storeLogos!: StoreLogo[];
  screenshots!: Screenshot[];
}

class Screenshot {
  id!: string;
  assetUrl!: string;
  imageSize!: ImageSize;
}

class StoreLogo {
  id!: string;
  assetUrl!: string;
  imageSize!: ImageSize;
}

export class StoreApis {
  private static readonly microsoftOnlineLoginHost =
    "login.microsoftonline.com";
  private static readonly authOAuth2TokenSuffix = "/oauth2/v2.0/token";
  private static readonly scope = "https://api.store.microsoft.com/.default";
  private static readonly storeApiUrl = "api.store.microsoft.com";

  constructor() {
    this.LoadState();
  }

  public accessToken!: string;
  public productId!: string;
  public sellerId!: string;
  public tenantId!: string;
  public clientId!: string;
  public clientSecret!: string;

  private Delay(ms: number): Promise<unknown> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async GetAccessToken(): Promise<string> {
    const requestParameters: { [key: string]: string } = {
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: StoreApis.scope,
    };


    const formBody = [];
    for (const property in requestParameters) {
      const encodedKey = encodeURIComponent(property);
      const encodedValue = encodeURIComponent(requestParameters[property]);
      formBody.push(encodedKey + "=" + encodedValue);
    }

    const dataString = formBody.join("\r\n&");

    const options: https.RequestOptions = {
      host: StoreApis.microsoftOnlineLoginHost,
      path: `/${this.tenantId}${StoreApis.authOAuth2TokenSuffix}`,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": dataString.length,
      },
    };

    return new Promise<string>((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseString = "";

        res.on("data", (data) => {
          responseString += data;
        });

        res.on("end", function () {
          const responseObject = JSON.parse(responseString);
          if (responseObject.error) reject(responseObject);
          else resolve(responseObject.access_token);
        });
      });

      req.on("error", (e) => {
        console.error(e);
        reject(e);
      });

      req.write(dataString);
      req.end();
    });
  }

  public async GetCurrentDraftSubmissionPackagesData(): Promise<
    any
  > {
    return this.CreateStoreHttpRequest(
      "",
      "GET",
      `/submission/v1/product/${this.productId}/packages`
    );
  }

  private GetCurrentDraftSubmissionMetadata(
  ): Promise<ResponseWrapper<unknown>> {
    return this.CreateStoreHttpRequest(
      "",
      "GET",
      `/submission/v1/product/${this.productId}/metadata`
    );
  }

  private UpdateCurrentDraftSubmissionMetadata(
    submissionMetadata: string
  ): Promise<ResponseWrapper<unknown>> {
    return this.CreateStoreHttpRequest(
      JSON.stringify(submissionMetadata,null,2),
      "PUT",
      `/submission/v1/product/${this.productId}/metadata`
    );
  }

  private async UpdateStoreSubmissionPackages(
    submission: string
  ): Promise<ResponseWrapper<unknown>> {
    console.log("Updating store submission packages with data:", submission);
    return this.CreateStoreHttpRequest(
      submission,
      "PUT",
      `/submission/v1/product/${this.productId}/packages`
    );
  }

  private async CommitUpdateStoreSubmissionPackages(): Promise<
    ResponseWrapper<unknown>
  > {
    return this.CreateStoreHttpRequest(
      "",
      "POST",
      `/submission/v1/product/${this.productId}/packages/commit`
    );
  }

  private async GetModuleStatus(): Promise<ResponseWrapper<ModuleStatus>> {
    return this.CreateStoreHttpRequest<ModuleStatus>(
      "",
      "GET",
      `/submission/v1/product/${this.productId}/status`
    );
  }

  private async GetSubmissionStatus(
    submissionId: string
  ): Promise<ResponseWrapper<SubmissionStatus>> {
    return this.CreateStoreHttpRequest<SubmissionStatus>(
      "",
      "GET",
      `/submission/v1/product/${this.productId}/submission/${submissionId}/status`
    );
  }

  private async SubmitSubmission(): Promise<
    ResponseWrapper<SubmissionResponse>
  > {
    return this.CreateStoreHttpRequest<SubmissionResponse>(
      "",
      "POST",
      `/submission/v1/product/${this.productId}/submit`
    );
  }

  private async GetCurrentDraftListingAssets(
    listingLanguages: string
  ): Promise<ResponseWrapper<ListingAssetsResponse>> {
    return this.CreateStoreHttpRequest(
      "",
      "GET",
      `/submission/v1/product/${this.productId}/listings/assets?languages=${listingLanguages}`
    );
  }

  private async CreateStoreHttpRequest<T>(
    requestParameters: string,
    method: string,
    path: string
  ): Promise<ResponseWrapper<T>> {
    const options: https.RequestOptions = {
      host: StoreApis.storeApiUrl,
      path: path,
      method: method,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": requestParameters.length,
        Authorization: "Bearer " + this.accessToken,
        "X-Seller-Account-Id": this.sellerId,
      },
    };
    return new Promise<ResponseWrapper<T>>((resolve, reject) => {
      const req = https.request(options, (res) => {
        if (res.statusCode == 404) {
          const error = new ResponseWrapper();
          error.isSuccess = false;
          error.errors = [];
          error.errors[0] = new Error();
          error.errors[0].message = "Not found";
          reject(`404 not found - >${JSON.stringify(error)}`);
          return;
        }
        let responseString = "";

        res.on("data", (data) => {
          responseString += data;
        });

        res.on("end", function () {
          const responseObject = <ResponseWrapper<T>>JSON.parse(responseString);
          resolve(responseObject);
        });
      });

      req.on("error", (e) => {
        console.error(e);
        reject(e);
      });

      req.write(requestParameters);
      req.end();
    });
  }

  private async PollModuleStatus(): Promise<boolean> {
    let status: ModuleStatus = new ModuleStatus();
    status.isReady = false;

    while (!status.isReady) {
      const moduleStatus = await this.GetModuleStatus();
      console.log(JSON.stringify(moduleStatus));
      status = moduleStatus.responseData;
      if (!moduleStatus.isSuccess) {
        const errorResponse = moduleStatus as unknown as ErrorResponse;
        if (errorResponse.statusCode == 401) {
          console.log(
            `Access token expired. Requesting new one. (message='${errorResponse.message}')`
          );
          await this.InitAsync();
          status = new ModuleStatus();
          status.isReady = false;
          continue;
        }
        console.log("Error");
        break;
      }
      if (status.isReady) {
        console.log("Success!");
        return true;
      } else {
        if (
          moduleStatus.errors &&
          moduleStatus.errors.length > 0 &&
          moduleStatus.errors.find(
            (e) => e.target != "packages" || e.code == "packageuploaderror"
          )
        ) {
          console.log(moduleStatus.errors);
          return false;
        }
      }

      console.log("Waiting 10 seconds.");
      await this.Delay(10000);
    }

    return false;
  }

  public async InitAsync() {
    this.accessToken = await this.GetAccessToken();
  }

  public async GetExistingDraft(
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {

        this.GetCurrentDraftSubmissionMetadata()
        .then((currentDraftResponse) => {
          if (!currentDraftResponse.isSuccess) {
            reject(
              `Failed to get the existing draft. - ${JSON.stringify(
                currentDraftResponse,
                null,
                2
              )}`
            );
          } else {
            resolve(JSON.stringify(currentDraftResponse.responseData));
          }
        })
        .catch((error) => {
          reject(`Failed to get the existing draft. - ${error.errors}`);
        });
    });
  }

  public async PollSubmissionStatus(
    pollingSubmissionId: string
  ): Promise<PublishingStatus> {
    let status: SubmissionStatus = new SubmissionStatus();
    status.hasFailed = false;

    // eslint-disable-next-line no-async-promise-executor
    return new Promise<PublishingStatus>(async (resolve, reject) => {
      while (!status.hasFailed) {
        const submissionStatus = await this.GetSubmissionStatus(
          pollingSubmissionId
        );
        console.log(JSON.stringify(submissionStatus));
        status = submissionStatus.responseData;
        if (!submissionStatus.isSuccess || status.hasFailed) {
          const errorResponse = submissionStatus as unknown as ErrorResponse;
          if (errorResponse.statusCode == 401) {
            console.log(
              `Access token expired. Requesting new one. (message='${errorResponse.message}')`
            );
            await this.InitAsync();
            status = new SubmissionStatus();
            status.hasFailed = false;
            continue;
          }
          console.log("Error");
          reject("Error");
          return;
        }
        if (
          status.publishingStatus == PublishingStatus.PUBLISHED ||
          status.publishingStatus == PublishingStatus.FAILED
        ) {
          console.log(`PublishingStatus = ${status.publishingStatus}`);
          resolve(status.publishingStatus);
          return;
        }

        console.log("Waiting 10 seconds.");
        await this.Delay(10000);
      }
    });
  }

  public async UpdateSubmissionMetadata(
    submissionMetadataString: string
  ): Promise<unknown> {
    if (!(await this.PollModuleStatus())) {
      // Wait until all modules are in the ready state
      return Promise.reject("Failed to poll module status.");
    }

    const submissionMetadata = JSON.parse(submissionMetadataString);

    console.log("CHECK");
    const updateSubmissionData =
      await this.UpdateCurrentDraftSubmissionMetadata(submissionMetadata);
    console.log("bruh");

    if (!updateSubmissionData.isSuccess) {
      return Promise.reject(
        `Failed to update submission metadata - ${JSON.stringify(
          updateSubmissionData.errors
        )}`
      );
    }

    if (!(await this.PollModuleStatus())) {
      // Wait until all modules are in the ready state
      return Promise.reject("Failed to poll module status.");
    }

    return updateSubmissionData;
  }

  public async UpdateProductPackages(
    updatedProductString: string
  ): Promise<unknown> {


    const updateSubmissionData = await this.UpdateStoreSubmissionPackages(
      updatedProductString
    );

    
    if (!updateSubmissionData.isSuccess) {
      return Promise.reject(
        `Failed to update submission - ${JSON.stringify(
          updateSubmissionData.errors
        )}`
      );
    }
    console.log("Updated package data");
    
    return updateSubmissionData;
  }

  public async PublishSubmission(): Promise<string> {
    const commitResult = await this.CommitUpdateStoreSubmissionPackages();
    if (!commitResult.isSuccess) {
      return Promise.reject(
        `Failed to commit the updated submission - ${JSON.stringify(
          commitResult.errors
        )}`
      );
    }
    console.log(JSON.stringify(commitResult));

    if (!(await this.PollModuleStatus())) {
      // Wait until all modules are in the ready state
      return Promise.reject("Failed to poll module status.");
    }

    let submissionId: string | null = null;

    const submitSubmissionResponse = await this.SubmitSubmission();
    console.log(JSON.stringify(submitSubmissionResponse));
    if (submitSubmissionResponse.isSuccess) {
      if (
        submitSubmissionResponse.responseData.submissionId != null &&
        submitSubmissionResponse.responseData.submissionId.length > 0
      ) {
        submissionId = submitSubmissionResponse.responseData.submissionId;
      } else if (
        submitSubmissionResponse.responseData.ongoingSubmissionId != null &&
        submitSubmissionResponse.responseData.ongoingSubmissionId.length > 0
      ) {
        submissionId =
          submitSubmissionResponse.responseData.ongoingSubmissionId;
      }
    }

    return new Promise<string>((resolve, reject) => {
      if (submissionId == null) {
        console.log("Failed to get submission ID");
        reject("Failed to get submission ID");
      } else {
        resolve(submissionId);
      }
    });
  }

  public async GetExistingDraftListingAssets(
    listingLanguage: string
  ): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.GetCurrentDraftListingAssets(listingLanguage)
        .then((draftListingAssetsResponse) => {
          if (!draftListingAssetsResponse.isSuccess) {
            reject(
              `Failed to get the existing draft listing assets. - ${JSON.stringify(
                draftListingAssetsResponse,
                null,
                2
              )}`
            );
          } else {
            resolve(draftListingAssetsResponse.responseData);
          }
        })
        .catch((error) => {
          reject(
            `Failed to get the existing draft listing assets. - ${error.errors}`
          );
        });
    });
  }

  // my addition 
  // create listing assets and commit listing assets
  public async CreateListingAssets(language:string, num_screenshots: number, num_logos: number) {
    console.log("Creating listing assets for language:", language, "with", num_screenshots, "screenshots and", num_logos, "logos.");
    return this.CreateStoreHttpRequest(
      `
      {language: "${language}",
      createAssetRequest: {
        Screenshot: ${num_screenshots},
        Logo: ${num_logos}
    }}`,
      "POST",
      `/submission/v1/product/${this.productId}/listings/assets/create`,
    );
  }

  public async CommitListingAssets(language: string, screenshots: Array<{ id: string, primaryAssetUploadUrl: string }>, logos: Array<{ id: string, primaryAssetUploadUrl: string }>) {
    console.log("looka", language, screenshots, logos);
    return this.CreateStoreHttpRequest(
      `{listingAssets: {
      language: "${language}",
      storeLogos: [
        ${logos.map(l => `{ id: "${l.id}", assetUrl: "${l.primaryAssetUploadUrl}" }`).join(", ")}
    ],
      screenshots: [
        ${screenshots.map(s => `{ id: "${s.id}", assetUrl: "${s.primaryAssetUploadUrl}" }`).join(", ")}
      ]
    }}`,
      "PUT",
      `/submission/v1/product/${this.productId}/listings/assets/commit`
    );
  }

  public async UpdateDraftMetadataList(list_of_update_requests:string[]) {
    for (const update_request of list_of_update_requests) {
      const result = await this.UpdateCurrentDraftSubmissionMetadata(JSON.parse(update_request));
      if (!result.isSuccess) {
        console.error(`Failed to update draft metadata for request: ${JSON.stringify(result.errors,null,2)} the request was: ${update_request}`);
      }
      else
        console.log(`Draft metadata updated successfully for request: ${update_request}`);
    }
  }



  private LoadState() {
    this.productId = process.env[`${EnvVariablePrefix}product_id`] ?? "";
    this.sellerId = process.env[`${EnvVariablePrefix}seller_id`] ?? "";
    this.tenantId = process.env[`${EnvVariablePrefix}tenant_id`] ?? "";
    this.clientId = process.env[`${EnvVariablePrefix}client_id`] ?? "";
    this.clientSecret = process.env[`${EnvVariablePrefix}client_secret`] ?? "";
    this.accessToken = process.env[`${EnvVariablePrefix}access_token`] ?? "";
  }
}
