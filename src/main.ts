import * as core from "@actions/core";
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