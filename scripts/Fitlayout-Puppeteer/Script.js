const fs = require("fs-extra");
const path = require('path');
//NOTE
const puppeteer = require('puppeteer');

const { AbstractScriptorScript, files, pages, log } = require('@webis-de/scriptor');

const NAME = "Fitlayout Puppeteer";
const VERSION = "0.1.0";

const SCRIPT_OPTION_URL = "url";                                           // Required. Set the URL to load.
const SCRIPT_OPTIONS_VIEWPORT_ADJUST = "viewportAdjust";                   // Optional. Passed to pages.adjustViewportToPage before taking the snapshot
const SCRIPT_OPTIONS_SNAPSHOT = "snapshot";                                // Optional. Passed to pages.takeSnapshot for taking the snapshot
const SCRIPT_OPTION_WAIT_EVENT = "waitEvent";                              // Optional. The event to wait for before adjusting the viewport. Use 'domcontentloaded' to *not* wait for external resources. Default: 'load'
const SCRIPT_OPTION_WAIT_NETWORK_MILLISECONDS = "waitNetworkMilliseconds"; // Optional. The number of milliseconds to wait before adjusting the viewport and (again) taking the snapshot. Default: 30000

module.exports = class extends AbstractScriptorScript {

    constructor() {
        super(NAME, VERSION);
    }

    async run(browserContexts, scriptDirectory, inputDirectory, outputDirectory) {


        const browserContext = browserContexts[files.BROWSER_CONTEXT_DEFAULT];

        // Define script options
        const requiredScriptOptions = [SCRIPT_OPTION_URL];
        const defaultScriptOptions = {};
        defaultScriptOptions[SCRIPT_OPTIONS_VIEWPORT_ADJUST] = {}
        defaultScriptOptions[SCRIPT_OPTION_WAIT_EVENT] = 'load';
        defaultScriptOptions[SCRIPT_OPTION_WAIT_NETWORK_MILLISECONDS] = 30000;

        // Get script options
        const scriptOptions = files.readOptions(files.getExisting(
            files.SCRIPT_OPTIONS_FILE_NAME, [scriptDirectory, inputDirectory]),
            defaultScriptOptions, requiredScriptOptions);
        log.info({ options: scriptOptions }, "script.options");
        fs.writeJsonSync( // store options for provenance
            path.join(outputDirectory, files.SCRIPT_OPTIONS_FILE_NAME), scriptOptions);
        const url = scriptOptions[SCRIPT_OPTION_URL];
        const optionsViewportAdjust = scriptOptions[SCRIPT_OPTIONS_VIEWPORT_ADJUST];
        const optionsSnapshot = Object.assign(
            { path: path.join(outputDirectory, "snapshot") },
            scriptOptions[SCRIPT_OPTIONS_SNAPSHOT]);
        const waitEvent = scriptOptions[SCRIPT_OPTION_WAIT_EVENT];
        const waitNetworkMilliseconds =
            scriptOptions[SCRIPT_OPTION_WAIT_NETWORK_MILLISECONDS];

        const page = await browserContext.newPage();
        page.setDefaultTimeout(0); // disable timeouts


        //code from fitlayout-puppeteer
        async function scrollDown(page, maxIterations) {
            return await page.evaluate(async () => {
                let totalHeight = 0;
                await new Promise((resolve, reject) => {
                    let iteration = 0;
                    const distance = window.innerHeight / 2; // div 2 is for scrolling slower and let everything load
                    var timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy({ top: distance, left: 0, behavior: 'auto' });
                        totalHeight += distance;
                        iteration++;

                        if (totalHeight >= scrollHeight || iteration > maxIterations) {
                            totalHeight = scrollHeight; // for returning the maximal height in all cases
                            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
                            clearInterval(timer);
                            resolve();
                        }
                    }, 100);
                });
                return totalHeight;
            });
        }
        //NOTE from fitlayout
        let lastResponse = null;
        let lastError = null;
        //NOTE from fitlayout
        let scrollPages = 20;
        //NOTE from fitlayout
        let wwidth = 1200;
        //NOTE waitOptions from FLP default option (can be changed via CLI)
        let waitOptions = { waitUntil: 'load', timeout: 15000 };
        //store the last http response
        page.on('response', resp => {
            lastResponse = resp;
        });
        //go to the page
        //NOTE renamed targetUrl to url
        try {
            await page.goto(url, waitOptions);
            let totalHeight = await scrollDown(page, scrollPages);
            log.info('MK Parameters: width: ' + wwidth + ' height: ' + totalHeight);
            await page.setViewport({ width: wwidth, height: totalHeight, deviceScaleFactor: 1 });
            //await page.waitForNavigation(waitOptions);
        } catch (e) {
            //NOTE changed consolelog from FLP to lib call
            //console.error(e);
            log.info(e);
            lastError = e;
        }
        //page.on('console', msg => console.log('PAGE LOG:', msg.text() + '\n'));

        //always take a screenshot in order to get the whole page into the viewport
        let screenShot = await page.screenshot({
            type: "png",
            fullPage: true,
            encoding: "base64"
        });

        /*
        // Load page
        log.info({
            url: url,
            waitEvent: waitEvent,
            waitNetworkMilliseconds: waitNetworkMilliseconds
          }, "script.pageLoad");
        await page.goto(url, {waitUntil: waitEvent});
        log.info("script.pageLoaded");
        await pages.waitForNetworkIdleMax(page, waitNetworkMilliseconds);
    
        // Adjust viewport height to scroll height
        log.info({optionsViewportAdjust: optionsViewportAdjust}, "script.pageAdjust");
        await pages.adjustViewportToPage(page, optionsViewportAdjust);
        await page.waitForTimeout(1000);
        log.info("script.pageAdjusted");
        await pages.waitForNetworkIdleMax(page, waitNetworkMilliseconds);
    
        // Take snapshot
        await pages.takeSnapshot(page, optionsSnapshot);
        log.info("script.done");
        return true;
        */
    }
};

