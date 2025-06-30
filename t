
> mod
> esbuild src/main.ts --bundle --platform=node --outfile=dist/main.js && cd dist && node main.js

ℹ️ Starting the action...
Getting accessToken...
ℹ️ Configuration completed successfully.
Submission ID is not set, fetching current submission ID
Getting app data
Found pending submission
ℹ️ deleting existing submission if any
Submission deleted successfully, resetting submissionId
Creating a new submission...
Created new submission
ℹ️ Submission created with ID: 1152921505699488795
Got metadata for current submission with id 1152921505699488795
ℹ️ Metadata JSON file reading.
Reading JSON file for metadata
ℹ️ Metadata JSON file read successfully.
ℹ️ All media files are valid.
Sending metadata: upoaded
sendin file: Icon_all_test.png
sendin file: Screenshot_all_demo.png
sendin file: Screenshot_all_myss1.png
sendin file: Screenshot_fr_myss2.png
sendin file: TrailerImage_all_demo copy.png
sendin file: Trailer_all_demo.mp4
Sending 6 files to https://intern-project-gectfacbdbdbfndb.eastasia-01.azurewebsites.net/upload
Response status: 200
ℹ️ Files uploaded successfully. PDP URL: https://intern-project-gectfacbdbdbfndb.eastasia-01.azurewebsites.net/preview/41964cf2-7f19-4e66-8ebf-096bd316459b/render
Received file: Icon_all_test.png
Received file: Screenshot_all_demo.png
Received file: Screenshot_all_myss1.png
Received file: Screenshot_fr_myss2.png
Received file: TrailerImage_all_demo copy.png
Received file: Trailer_all_demo.mp4
Received file: metadata.json
ℹ️ Adding files to metadata...
Got metadata for current submission with id 1152921505699488795
Processing file "Icon_all_test.png" with type "Icon" and locale(s) en
Processing file "Screenshot_all_demo.png" with type "Screenshot" and locale(s) en
Processing file "Screenshot_all_myss1.png" with type "Screenshot" and locale(s) en
Processing file "Screenshot_fr_myss2.png" with type "Screenshot" and locale(s) fr
Processing file "TrailerImage_all_demo copy.png" with type "TrailerImage" and locale(s) en
Processing file "Trailer_all_demo.mp4" with type "Trailer" and locale(s) en
Adding trailer image TrailerImage_all_demo copy.png to metadata_json
looka {
  "applicationCategory": "HealthAndFitness",
  "pricing": {
    "trialPeriod": "NoFreeTrial",
    "marketSpecificPricings": {},
    "sales": [],
    "priceId": "Free",
    "isAdvancedPricingModel": true
  },
  "visibility": "Public",
  "targetPublishMode": "Immediate",
  "targetPublishDate": "1601-01-01",
  "listings": {
    "en": {
      "baseListing": {
        "title": "dupmy123",
        "description": "kyufj",
        "features": [],
        "releaseNotes": "",
        "minimumHardware": [],
        "images": [
          {
            "fileStatus": "PendingUpload",
            "fileName": "Icon_all_test.png",
            "imageType": "Icon"
          },
          {
            "fileStatus": "PendingUpload",
            "fileName": "Screenshot_all_demo.png",
            "imageType": "Screenshot"
          },
          {
            "fileStatus": "PendingUpload",
            "fileName": "Screenshot_all_myss1.png",
            "imageType": "Screenshot"
          }
        ]
      },
      "platformOverrides": {}
    }
  },
  "hardwarePreferences": [],
  "automaticBackupEnabled": false,
  "canInstallOnRemovableMedia": false,
  "isGameDvrEnabled": false,
  "gamingOptions": [
    {
      "genres": []
    }
  ],
  "hasExternalInAppProducts": false,
  "meetAccessibilityGuidelines": false,
  "notesForCertification": "",
  "packageDeliveryOptions": {
    "packageRollout": {
      "isPackageRollout": false,
      "packageRolloutPercentage": 0,
      "packageRolloutStatus": "PackageRolloutNotStarted",
      "fallbackSubmissionId": "0"
    },
    "isMandatoryUpdate": false,
    "mandatoryUpdateEffectiveDate": "1601-01-01T00:00:00.0000000Z"
  },
  "enterpriseLicensing": "None",
  "allowMicrosoftDecideAppAvailabilityToFutureDeviceFamilies": true,
  "allowTargetFutureDeviceFamilies": {
    "desktop": false,
    "mobile": false,
    "xbox": false,
    "holographic": false
  },
  "trailers": [
    {
      "videoFileName": "Trailer_all_demo.mp4",
      "trailerAssets": {
        "en": {
          "title": "Trailer_all_demo.mp4",
          "imageList": [
            {
              "fileName": "TrailerImage_all_demo copy.png",
              "description": null
            }
          ]
        }
      }
    }
  ],
  "applicationPackages": [
    {
      "fileName": "dupmy123.msixbundle",
      "fileStatus": "PendingUpload"
    }
  ]
}
{
  "applicationCategory": "HealthAndFitness",
  "pricing": {
    "trialPeriod": "NoFreeTrial",
    "marketSpecificPricings": {},
    "sales": [],
    "priceId": "Free",
    "isAdvancedPricingModel": true
  },
  "visibility": "Public",
  "targetPublishMode": "Immediate",
  "targetPublishDate": "1601-01-01",
  "listings": {
    "en": {
      "baseListing": {
        "title": "dupmy123",
        "description": "kyufj",
        "features": [],
        "releaseNotes": "",
        "minimumHardware": [],
        "images": [
          {
            "fileStatus": "PendingUpload",
            "fileName": "Icon_all_test.png",
            "imageType": "Icon"
          },
          {
            "fileStatus": "PendingUpload",
            "fileName": "Screenshot_all_demo.png",
            "imageType": "Screenshot"
          },
          {
            "fileStatus": "PendingUpload",
            "fileName": "Screenshot_all_myss1.png",
            "imageType": "Screenshot"
          }
        ]
      },
      "platformOverrides": {}
    }
  },
  "hardwarePreferences": [],
  "automaticBackupEnabled": false,
  "canInstallOnRemovableMedia": false,
  "isGameDvrEnabled": false,
  "gamingOptions": [
    {
      "genres": []
    }
  ],
  "hasExternalInAppProducts": false,
  "meetAccessibilityGuidelines": false,
  "notesForCertification": "",
  "packageDeliveryOptions": {
    "packageRollout": {
      "isPackageRollout": false,
      "packageRolloutPercentage": 0,
      "packageRolloutStatus": "PackageRolloutNotStarted",
      "fallbackSubmissionId": "0"
    },
    "isMandatoryUpdate": false,
    "mandatoryUpdateEffectiveDate": "1601-01-01T00:00:00.0000000Z"
  },
  "enterpriseLicensing": "None",
  "allowMicrosoftDecideAppAvailabilityToFutureDeviceFamilies": true,
  "allowTargetFutureDeviceFamilies": {
    "desktop": false,
    "mobile": false,
    "xbox": false,
    "holographic": false
  },
  "trailers": [
    {
      "videoFileName": "Trailer_all_demo.mp4",
      "trailerAssets": {
        "en": {
          "title": "Trailer_all_demo.mp4",
          "imageList": [
            {
              "fileName": "TrailerImage_all_demo copy.png",
              "description": null
            }
          ]
        }
      }
    }
  ],
  "applicationPackages": [
    {
      "fileName": "dupmy123.msixbundle",
      "fileStatus": "PendingUpload"
    }
  ]
}
ℹ️ Updating metadata...
Metadata updated successfully
ℹ️ Metadata updated successfully.
