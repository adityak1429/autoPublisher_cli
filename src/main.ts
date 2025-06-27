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
//     core.info(`Set environment variable: ${name}`);
//   }
// }
import { msix_main } from "./msix_gh_action/msix_main";
import { exe_main } from "./exe_gh_action/exe_main";

(async function main() {

    // optionally we can get this info by guid.tryparse() to check if the guid is valid(i.e it is win32 id)
    if(core.getInput("type")==="packaged") {
        await msix_main();
    }
    else if(core.getInput("type")==="win32") {
        await exe_main();
    }
    else {
        throw new Error("Invalid type specified. Use 'packaged' or 'win32'.");
    }
})();