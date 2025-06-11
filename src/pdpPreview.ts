const artifact = require('@actions/artifact');
const fs = require('fs');
const path = require('path');
const core = require('@actions/core');

export async function generate_pdp(metadata_json: any, pdpPath: string){
  return new Promise<void>((resolve, reject) => {
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Sample PDP</title>
    </head>
    <body>
      <h1>Product Display Page</h1>
      <pre>${JSON.stringify(metadata_json, null, 2)}</pre>
    </body>
    </html>
    `;

    const htmlFilePath = path.join(pdpPath || process.cwd(), "sample_pdp.html");
    fs.writeFile(htmlFilePath, htmlContent, (err:any) => {
      if (err) {
        reject(`Failed to write HTML file: ${err}`);
        return;
      }
      core.info(`Sample HTML PDP generated at: ${htmlFilePath}`);
      // Upload using artifact
      const artifactClient = artifact.create();
      artifactClient.uploadArtifact(
        "sample-pdp-html",
        [htmlFilePath],
        path.dirname(htmlFilePath)
      ).then(() => {
        core.info("Sample PDP HTML uploaded as artifact.");
        resolve();
      }).catch((uploadErr: any) => {
        core.warning(`Failed to upload artifact: ${uploadErr}`);
        resolve(); // Still resolve, as HTML was generated
      });
    });
  });
}