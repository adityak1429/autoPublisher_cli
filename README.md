Note: checkout microsoft/msstore-cli because it seems convinient too
# autoPublisher

**autoPublisher** is a GitHub Action that automates publishing updates to your apps in the Microsoft Store.

---

## 🚀 Prerequisites

- [Associate an Azure AD application with your Partner Center account](https://learn.microsoft.com/en-us/windows/apps/publish/store-submission-api#how-to-associate-an-azure-ad-application-with-your-partner-center-account) to obtain your `client-id`, `client-secret`, and `tenant-id`.
- Find your `seller-id` in Partner Center.

**Example repository:**  
[adityak1429/dummy_repo](https://github.com/adityak1429/dummy_repo/)

> **Note:**  
> Do not modify `applicationpackages` or `listings > ... > images` in the JSON file. These are handled automatically by the action (for MSIX).

This action assumes you already have a packaged MSIX or signed EXE. It deploys the package, listing assets (screenshots, icon, etc.), and metadata to Partner Center.

---

## 🎬 Demo

> **Note:**  
> In this demonstration, an MSIX package is already associated with the product name, metadata has been initialized (by running the action with `json_init`), and several sample media files are prepared.

<p align="center">
  <img src="first_publish.gif" alt="Demo Video" width="500"/>
</p>

---

## ⚙️ Inputs

| Name             | Description                                                                                                                                                                                                                                         | Required | Default   |
|------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|-----------|
| `command`        | The command to execute. Available commands: `getmetadata`, `json_init`, `publish`                                                                                                                            | Yes      | publish   |
| `product-id`     | Product ID                                                                                                                                                                                                                                          | Yes      |           |
| `seller-id`      | Seller ID                                                                                                                                                                                                                                           | Yes      |           |
| `tenant-id`      | Azure AD Tenant ID                                                                                                                                                                                                                                 | Yes      |           |
| `client-id`      | App Client ID                                                                                                                                                                                                                                       | Yes      |           |
| `client-secret`  | App Client Secret                                                                                                                                                                                                                                   | Yes      |           |
| `package`        | Path to the app directory to upload. For MSIX, the action uploads all packages found in this path. For EXE, provide the package JSON file (see format by running the command for type `win32` and `package_json_init`). | No       |           |
| `photos-path`    | Path to the photos directory to upload. Uploads all photos in the directory. Prefix image names with the correct tag (e.g., `Screenshot_myss1.png`).                                                          | No       |           |
| `json-file-path` | Path to the JSON file containing app metadata. Run the action with command `json_init` first to get the template JSON.                                                                                       | No       |           |
| `interactive`    | `true`/`false` — Returns a URL where you can upload media/update metadata interactively.                                                                               | No       |           |
| `download`       | `true`/`false` — If `true`, uploaded media files and updated metadata from the interactive URL are available to download as an artifact.                                | No       |           |
| `append`         | `true`/`false` — If `true`, existing media assets are not deleted.                                                                                                     | No       |           |
| `type`           | `win32`/`msix` — The type of product to interact with.                                                                                                                 | Yes      |           |

---

## 🖼️ Valid Media Prefixes

**For EXE/MSI:**  
- `Screenshot`
- `Logo`

**For MSIX:**  
- `Screenshot`
- `MobileScreenshot`
- `XboxScreenshot`
- `SurfaceHubScreenshot`
- `HoloLensScreenshot`
- `StoreLogo9x16`
- `StoreLogoSquare`
- `Icon`
- `PromotionalArt16x9`
- `PromotionalArtwork2400X1200`
- `XboxBrandedKeyArt`
- `XboxTitledHeroArt`
- `XboxFeaturedPromotionalArt`
- `SquareIcon358X358`
- `BackgroundImage1000X800`
- `PromotionalArtwork414X180`

---

The `package` argument in the Win32 flow is the package JSON object, which can be obtained by running the action with the command `package_json_init`. You can add or remove packages from this array, which will be PUT using the API.

> **Note:**  
> Interactive mode for Win32 is under development.

---

## 📝 Example Workflow

Below is an example workflow file (`myUpdate.yml`):

```yaml
name: myUpdate
on:
  workflow_dispatch:
    inputs:
      command:
        description: 'Command to run with MSStore CLI'
        required: true
        default: 'publish'
      interactive:
        description: 'Interactive mode'
        required: true
        default: 'true'
      download:
        description: 'Download mode'
        required: true
        default: 'true'

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v3

      - name: Run AutoPublisher
        uses: adityak1429/autopublisher_cli@main
        with:
          tenant-id: ${{ secrets.AZURE_AD_TENANT_ID }}
          client-id: ${{ secrets.AZURE_AD_APPLICATION_CLIENT_ID }}
          client-secret: ${{ secrets.AZURE_AD_APPLICATION_SECRET }}
          seller-id: ${{ secrets.SELLER_ID }}
          command: ${{ github.event.inputs.command }}
          interactive: ${{ github.event.inputs.interactive }}
          download: ${{ github.event.inputs.download }}
          product-id: 9NP0T3QQXL70
          type: msix
          package: "${{ github.workspace }}/dir/apps"
          photos-path: "${{ github.workspace }}/dir/Photos"
          json-file-path: "${{ github.workspace }}/dir/metadata.json"
```