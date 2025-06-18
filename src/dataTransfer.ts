import express from "express";
import multer from "multer";
import http from "http";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";

let pollUrl: string = "";
const host_url =  "https://intern-project-gectfacbdbdbfndb.eastasia-01.azurewebsites.net/";

/**
 * Sends files and metadata.json to a remote server via POST and returns the poll URL.
 * @param files Array of files to send.
 * @param uploadUrl The remote server URL to POST to.
 * @returns The URL (string) to poll for the files.
 */
export async function sendFilesToServer(
    files: express.Multer.File[] = [],
    metadata_json: any = {},
    uploadUrl: string = host_url + "/upload"
): Promise<string> {
    const form = new FormData();

    form.append("metadata", JSON.stringify(metadata_json, null, 2), {
        contentType: "application/json",
    });
    console.log(`Sending metadata: upoaded`);
    // Attach files, but only if buffer is defined
    for (const file of files) {
        if (file && file.buffer && file.originalname) {
            form.append("files", file.buffer, { filename: file.originalname });
            console.log(`sendin file: ${file.originalname}`);
        } else {
            // Optionally log or warn about skipped files
            console.log(`Skipping file: ${file?.originalname || "unknown"} (buffer missing)`);
        }
    }

    console.log(`Sending ${files.length} files to ${uploadUrl}`);
    const response = await axios.post(uploadUrl, form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
    });

    console.log(`Response status: ${response.status}`);
    // Expect the server to respond with a URL to poll for the files
    if (response.data && response.data.pollUrl && response.data.previewUrl) {
        pollUrl = host_url+response.data.pollUrl;
        console.log(`Files uploaded successfully. Poll URL: ${pollUrl}`);
        return host_url+response.data.previewUrl;
    } else {
        console.log("Unexpected response from server:", response.data);
        throw new Error("one or both wanted URLs missing in response from server.");
    }
}

/**
 * Polls the given URL until files are available or timeout is reached.
 * Returns an array of objects similar to express.Multer.File (with buffer and originalname).
 * @param pollUrl The URL to poll for files.
 * @param timeoutMs Maximum time to wait (default 10 minutes).
 * @param pollIntervalMs Polling interval (default 5 seconds).
 * @returns Array of file-like objects: { originalname: string, buffer: Buffer }
 */
export async function getFilesFromServer(
    pollIntervalMs: number = 10000
): Promise<{ filename: string, buffer: Buffer }[]> {
    const start = Date.now();
    let retries = 0;
    while (retries < 2000) {
        try {
            const response = await axios.get(pollUrl, { responseType: "json" });
            if (response.status === 200 && Array.isArray(response.data)) {
                // Expecting an array of { filename, data (base64) }
                return response.data.map((file: any) => {
                        console.log(`Received file: ${file.filename}`);
                        return {
                            filename: file.filename,
                            buffer: Buffer.from(file.data, "base64")
                        };
                });
            }
        } catch (err: any) {
            // If 404 or not ready, just continue polling
            if (err.response && err.response.status !== 404) {
                throw err;
            }
        }
        await new Promise((r) => setTimeout(r, pollIntervalMs));
        retries++;
    }
    throw new Error("Timeout waiting for files from server.");
}