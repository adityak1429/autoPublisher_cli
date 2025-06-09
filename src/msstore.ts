import { apiRequest, setHeaders } from './apiHelper';
import * as dotenv from "dotenv";

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

export class MSStoreClient {
    private accessToken: string | undefined;
    private submissionId: string = "";


    async configure() {
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

    async createSubmission(productId: string) {
        try {
            const submissionResponse = await apiRequest<any>({
                url: `${url}applications/${productId}/submissions`,
                method: 'POST',
            });
            this.submissionId = submissionResponse.id;
            return this.submissionId;
            core.info('Created new submission');
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
}