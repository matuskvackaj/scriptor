const fs = require("fs-extra");
const path = require('path');

const { AbstractScriptorScript, files, pages, log } = require('@webis-de/scriptor');

const NAME = "Fitlayout Puppeteer";
const VERSION = "0.1.0";

const SCRIPT_OPTION_URL = "url";                                           // Required. Set the URL to load.
const SCRIPT_OPTIONS_VIEWPORT_ADJUST = "viewportAdjust";                   // Optional. Passed to pages.adjustViewportToPage before taking the snapshot
const SCRIPT_OPTIONS_SNAPSHOT = "snapshot";                                // Optional. Passed to pages.takeSnapshot for taking the snapshot
const SCRIPT_OPTION_WAIT_EVENT = "waitEvent";                              // Optional. The event to wait for before adjusting the viewport. Use 'domcontentloaded' to *not* wait for external resources. Default: 'load'
const SCRIPT_OPTION_WAIT_NETWORK_MILLISECONDS = "waitNetworkMilliseconds"; // Optional. The number of milliseconds to wait before adjusting the viewport and (again) taking the snapshot. Default: 30000
const EVAL_TIMEOUT = 30;

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
            //await page.setViewport({ width: wwidth, height: totalHeight, deviceScaleFactor: 1 });
            await page.setViewportSize({ width: wwidth, height: totalHeight });
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

        // a task that produces the page tree
        let pageTask = page.evaluate(() => {
            /*=client.js=*/
            /**
           *
           *  JFont Checker
           *  Derek Leung
           *  Original Date: 2010.8.23
           *  Current: Feb 2016
           *  
           *  This piece of code checks for the existence of a specified font.
           *  It ultilizes the font fallback mechanism in CSS for font checking.
           *  
           *  Compatibility:
           *  Tested on Chrome, Firefox, IE9+
           *  Requires CSS and JS
           *  
           **/
            (function () {
                console.log('\n\n\nCode executes\n\n\n');
                var containerA, containerB, html = document.getElementsByTagName("html")[0],
                    filler = "random_words_#_!@#$^&*()_+mdvejreu_RANDOM_WORDS";

                function createContainers() {
                    containerA = document.createElement("span");
                    containerB = document.createElement("span");

                    containerA.textContent = filler;
                    containerB.textContent = filler;

                    var styles = {
                        margin: "0",
                        padding: "0",
                        fontSize: "32px",
                        position: "absolute",
                        zIndex: "-1"
                    };

                    for (var key in styles) {
                        if (styles.hasOwnProperty(key)) {
                            containerA.style[key] = styles[key];
                            containerB.style[key] = styles[key];
                        }
                    }

                    return function () {
                        //clean up
                        containerA.outerHTML = "";
                        containerB.outerHTML = "";
                    };
                }

                function checkDimension() {
                    return containerA.offsetWidth === containerB.offsetWidth &&
                        containerA.offsetHeight === containerB.offsetHeight;
                }

                function checkfont(font, DOM) {
                    var rootEle = html;
                    if (DOM && DOM.children && DOM.children.length) rootEle = DOM.children[0];

                    var result = null,
                        reg = /[\,\.\/\;\'\[\]\`\<\>\\\?\:\"\{\}\|\~\!\@\#\$\%\^\&\*\(\)\-\=\_\+]/g,
                        cleanUp = createContainers();

                    font = font.replace(reg, "");

                    rootEle.appendChild(containerA);
                    rootEle.appendChild(containerB);

                    //First Check
                    containerA.style.fontFamily = font + ",monospace";
                    containerB.style.fontFamily = "monospace";

                    if (checkDimension()) {
                        //Assume Arial exists, Second Check
                        containerA.style.fontFamily = font + ",Arial";
                        containerB.style.fontFamily = "Arial";
                        result = !checkDimension();
                    } else {
                        result = true;
                    }

                    cleanUp();
                    return result
                }

                this.checkfont = checkfont;
            })();

            /**
 * FitLayout puppetteer backend.
 * (c) 2020-2021 Radek Burget <burgetr@fit.vutbr.cz>
 * 
 * export.js
 * Converts the DOM tree to boxes and creates the output structure.
 */

            function fitlayoutExportBoxes() {

                const styleProps = [
                    "display",
                    "position",
                    "color",
                    "background-color",
                    "font",
                    "border-top",
                    "border-right",
                    "border-bottom",
                    "border-left",
                    "overflow",
                    "transform",
                    "visibility",
                    "opacity"
                ];

                const replacedElements = [
                    "img",
                    "svg",
                    "object",
                    "iframe"
                ];

                const replacedImages = [
                    "img",
                    "svg"
                ];

                let nextId = 0;

                /**
                 * Creates boxes for a single element.
                 * 
                 * @param {*} e the source element
                 * @param {*} style computed element style
                 * @param {*} boxOffset the index of the first rectangle of the element within the parent node
                 */
                function createBoxes(e, style, boxOffset) {
                    e.fitlayoutID = []; //box IDs for the individual boxes
                    let rects = Array.from(e.getClientRects());
                    // find the lines
                    let lineStart = 0;
                    let lastY = 0;
                    let ret = [];
                    let i = 0;
                    for (i = 0; i < rects.length; i++) {
                        const rect = rects[i];
                        // detect line breaks
                        if (i > lineStart && rect.y != lastY) {
                            createLineBox(e, style, rects, lineStart, i, boxOffset, ret);
                            // start the next line
                            lineStart = i;
                        }
                        lastY = rect.y;
                    }
                    //finish the last line
                    if (i > lineStart) {
                        createLineBox(e, style, rects, lineStart, i, boxOffset, ret);
                    }

                    return ret;
                }

                /**
                 * Creates a new box for a given sequence of rectangles that form a line
                 * and adds it to a resulting collection.
                 * 
                 * @param {*} e the source element
                 * @param {*} style computed style of the element
                 * @param {*} rects element rectangles
                 * @param {*} lineStart the index of the first rectangle to use
                 * @param {*} lineEnd the index of the first rectangle that is not included
                 * @param {*} boxOffset the index of the first rectangle of the element within the parent node
                 * @param {*} ret the results collection to add the box to
                 */
                function createLineBox(e, style, rects, lineStart, lineEnd, boxOffset, ret) {
                    // compute the bounding box for the line boxes
                    const linebox = getSuperRect(rects.slice(lineStart, lineEnd));
                    if (rects.length === 1 || (linebox.width > 0 && linebox.height > 0)) { // skip empty boxes in multi-rectangle elements
                        // create the box
                        const box = createBox(e, style, linebox, lineStart + boxOffset);
                        box.istart = lineStart;
                        box.iend = lineEnd;
                        ret.push(box);
                        // put the references to generated boxes to the source element
                        for (let j = lineStart; j < lineEnd; j++) {
                            e.fitlayoutID.push(box.id);
                        }
                    }
                }

                /**
                 * Creates a single box from a source element.
                 * 
                 * @param {*} e the source element
                 * @param {*} style computed style of the element
                 * @param {*} srect bounding 'super rectangle' of the rectangles that should be considered 
                 * @param {*} boxIndex the index of the first rectangle within the parent node
                 */
                function createBox(e, style, srect, boxIndex) {
                    let ret = {};
                    ret.id = nextId++;
                    ret.xpath = e.FLXPath;
                    ret.tagName = e.tagName;
                    ret.x = srect.x;
                    ret.y = srect.y;
                    ret.width = srect.width;
                    ret.height = srect.height;

                    if (isReplacedElement(e)) {
                        ret.replaced = true;
                    }

                    //gather text decoration info for further propagation
                    let decoration = {};
                    decoration.underline = (style['text-decoration-line'].indexOf('underline') !== -1);
                    decoration.lineThrough = (style['text-decoration-line'].indexOf('line-through') !== -1);
                    e.fitlayoutDecoration = decoration;

                    //mark the boxes that have some background images
                    ret.hasBgImage = (style['background-image'] !== 'none');

                    if (e.offsetParent === undefined) { //special elements such as <svg>
                        ret.parent = getParentId(e.parentElement, boxIndex); //use parent instead of offsetParent
                    } else if (e.offsetParent !== null) {
                        ret.parent = getParentId(e.offsetParent, boxIndex);
                    }
                    if (e.parentElement !== null) {
                        ret.domParent = getParentId(e.parentElement, boxIndex);
                        if (e.parentElement.fitlayoutDecoration !== undefined) {
                            //use the propagated text decoration if any
                            decoration.underline |= e.parentElement.fitlayoutDecoration.underline;
                            decoration.lineThrough |= e.parentElement.fitlayoutDecoration.lineThrough;
                        }
                    }

                    //encode the text decoration
                    if (decoration.underline || decoration.lineThrough) {
                        ret.decoration = '';
                        if (decoration.underline) {
                            ret.decoration += 'U';
                        }
                        if (decoration.lineThrough) {
                            ret.decoration += 'T';
                        }
                    }

                    //encode the remaining style properties
                    let css = "";
                    styleProps.forEach((name) => {
                        css += name + ":" + style[name] + ";";
                    });
                    ret.css = css;

                    //add attributes
                    if (e.hasAttributes()) {
                        let attrs = e.attributes;
                        ret.attrs = [];
                        for (let i = 0; i < attrs.length; i++) {
                            ret.attrs.push({
                                name: attrs[i].name,
                                value: attrs[i].value
                            });
                        }
                    }

                    return ret;
                }

                /**
                 * Creates a bounding rectangle from a collection of rectangles.
                 * 
                 * @param {*} rects a collection of rectangles
                 */
                function getSuperRect(rects) {
                    let x1 = 0;
                    let y1 = 0;
                    let x2 = 0;
                    let y2 = 0;
                    let first = true;
                    for (rect of rects) {
                        if (first || rect.x < x1) {
                            x1 = rect.x;
                        }
                        if (first || rect.y < y1) {
                            y1 = rect.y;
                        }
                        if (first || rect.x + rect.width > x2) {
                            x2 = rect.x + rect.width;
                        }
                        if (first || rect.y + rect.height > y2) {
                            y2 = rect.y + rect.height;
                        }
                        first = false;
                    }
                    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
                }

                /**
                 * Finds an ID of a parent box in the parent element.
                 * 
                 * @param {*} parentElem the parent element
                 * @param {*} index the box index
                 * @returns a parent box ID
                 */
                function getParentId(parentElem, index) {
                    const ids = parentElem.fitlayoutID;
                    if (ids) {
                        if (ids.length == 1) {
                            return ids[0]; //block parents
                        } else {
                            return ids[index]; //inline parents that generate multiple boxes
                        }
                    } else {
                        // this may occur for root element
                        return undefined;
                    }
                }

                function addFonts(style, fontSet) {
                    let nameStr = style['font-family'];
                    nameStr.split(',').forEach((name) => {
                        fontSet.add(name.trim().replace(/['"]+/g, ''));
                    });
                }

                function getExistingFonts(fontSet) {
                    let ret = [];
                    fontSet.forEach((name) => {
                        if (checkfont(name)) {
                            ret.push(name);
                        }
                    });
                    return ret;
                }

                function isVisibleElement(e) {
                    if (e.nodeType === Node.ELEMENT_NODE) {

                        //special type element such as <svg> -- allow only known replaced elements
                        if (e.offsetParent === undefined) {
                            return isReplacedElement(e);
                        }

                        //elements not shown such as <noscript>
                        if (e.offsetParent === null && e.offsetWidth === 0 && e.offsetHeight === 0) {
                            return false;
                        }

                        var cs = window.getComputedStyle(e, null);
                        if (cs != null && cs.display === 'none' && cs.visibility === 'visible') {
                            return false;
                        }
                        return true;
                    }
                    return false;
                }

                function isReplacedElement(e) {
                    const tag = e.tagName.toLowerCase();
                    if (replacedElements.indexOf(tag) !== -1) {
                        return true;
                    }
                    return false;
                }

                function isImageElement(e) {
                    const tag = e.tagName.toLowerCase();
                    if (replacedImages.indexOf(tag) !== -1) {
                        if (tag == 'img') {
                            return e.hasAttribute('src'); //images must have a src specified
                        } else {
                            return true;
                        }
                    }
                    return false;
                }

                function isTextElem(elem) {
                    return (elem.childNodes.length == 1 && elem.firstChild.nodeType == Node.TEXT_NODE); //a single text child
                }

                /**
                 * Processes a DOM subtree recursively, creates the boxes from elements and adds them
                 * to a specified target collection. Updates the collections of fonts and images
                 * found in the subtree.
                 * 
                 * @param {*} root the DOM subtree root 
                 * @param {*} boxOffset the index of the first rectangle generated by the root within its parent node (0 for block parents, >= 0 for inline parents)
                 * @param {*} boxList the target list of boxes
                 * @param {*} fontSet a set of known fonts that should be updated
                 * @param {*} imageList a list of images that should be updated
                 */
                function processBoxes(root, boxOffset, boxList, fontSet, imageList) {

                    if (isVisibleElement(root)) {
                        // get the style
                        const style = window.getComputedStyle(root, null);
                        addFonts(style, fontSet);
                        // generate boxes
                        const boxes = createBoxes(root, style, boxOffset);
                        if (boxes.length > 0 && isTextElem(root)) {
                            boxes[0].text = root.innerText;
                        }
                        for (box of boxes) {
                            // store the box
                            boxList.push(box);
                            // save image ids
                            if (isImageElement(root)) { //img elements
                                root.setAttribute('data-fitlayoutid', box.id);
                                let img = { id: box.id, bg: false };
                                imageList.push(img);
                            } else if (box.hasBgImage) { //background images
                                root.setAttribute('data-fitlayoutid', box.id);
                                //root.setAttribute('data-fitlayoutbg', '1');
                                let img = { id: box.id, bg: true };
                                imageList.push(img);
                            }
                        }

                        if (!isReplacedElement(root)) //do not process the contents of replaced boxes
                        {
                            const multipleBoxes = (root.getClientRects().length > 1);
                            let ofs = 0;
                            const children = root.childNodes;
                            for (let i = 0; i < children.length; i++) {
                                const boxcnt = processBoxes(children[i], ofs, boxList, fontSet, imageList);
                                if (multipleBoxes) {
                                    ofs += boxcnt; //root generates multiple boxes - track the child box offsets
                                }
                            }
                        }

                        return boxes.length;
                    } else {
                        return 0; //no boxes created
                    }
                }

                let boxes = [];
                let images = [];
                let fonts = new Set();
                processBoxes(document.body, 0, boxes, fonts, images);

                let metadata = extractJsonLd(document);

                let ret = {
                    page: {
                        width: document.body.scrollWidth,
                        height: document.body.scrollHeight,
                        title: document.title,
                        url: location.href
                    },
                    fonts: getExistingFonts(fonts),
                    boxes: boxes,
                    images: images,
                    metadata: metadata
                }

                return ret;
            }

            /*
 * fitlayout-puppeteer -- Puppeteer-based web page renderer for FitLayout
 * (c) Radek Burget 2020-2021
 *
 * fonts.js
 * Font handling functions.
 */

            /**
             * Tries to disable CSS-linked fonts.
             */
            function disableCSSFonts() {

                for (i = 0; i < document.styleSheets.length; i++) {
                    //console.log(document.styleSheets[i].href);
                    let ss = document.styleSheets[i];
                    if (typeof ss.href === 'string') {
                        if (ss.href.indexOf('fonts.googleapis.com') !== -1) {
                            ss.disabled = true;
                        }
                    }
                }
            }
            /*
             * FitLayout puppetteer backend.
             * (c) 2020-2022 Radek Burget <burgetr@fit.vutbr.cz>
             * 
             * jsonld.js
             * JSON-LD metadata extraction
             */

            function extractJsonLd(document) {

                let ret = [];
                let list = document.querySelectorAll("script[type='application/ld+json']");
                for (let item of list) {
                    ret.push({
                        type: 'application/ld+json',
                        content: item.textContent
                    });
                }
                return ret;

            }
            /**
             * FitLayout puppetteer backend.
             * (c) 2020-2021 Radek Burget <burgetr@fit.vutbr.cz>
             * 
             * lines.js
             * Text line detection in the target DOM.
             */

            /**
             * Scans current DOM document and makes the following changes in the body:
             * - All text nodes are wrapped in <XX> elements
             * - Text lines are detected in text nodes and wrapped in separate <XL> elements.  
             */
            function fitlayoutDetectLines() {

                var TEXT_CONT = "XX"; // element name to be used for wrapping the text nodes
                var LINE_CONT = "XL"; // element name to be used for wrapping the detected lines

                function markXPaths(root, rootXPath) {
                    root.FLXPath = rootXPath;
                    const children = root.childNodes;
                    let elemCnt = 0;
                    let textCnt = 0;
                    for (let i = 0; i < children.length; i++) {
                        const child = children[i];
                        let xstep = '';
                        if (child.nodeType === Node.ELEMENT_NODE) {
                            elemCnt++;
                            xstep = '*[' + elemCnt + ']';
                        } else if (child.nodeType === Node.TEXT_NODE) {
                            textCnt++;
                            xstep = 'text()[' + textCnt + ']';
                        }
                        markXPaths(child, rootXPath + '/' + xstep);
                    }
                }

                /**
                 * Finds lines in a given XX element and marks them with separate elements.
                 * @param {Element} xx the XX element to be processed.
                 */
                function createLines(xx) {
                    let rects = xx.getClientRects();
                    if (rects.length > 1) {
                        const parent = xx.parentElement;
                        lines = splitTextByLines(xx, xx.textContent, rects);
                        xx.innerText = '';
                        for (var line of lines) {
                            parent.insertBefore(line, xx);
                        }
                        parent.removeChild(xx);
                        return lines.length;
                    } else {
                        return rects.length;
                    }
                }

                /**
                 * Splits the text content of a given element based on the client rectangles.
                 * 
                 * @param {Element} parent the parent element of the text node 
                 * @param {string} text the text content to be split 
                 * @param {*} rects element client rectangles to be used for splitting 
                 */
                function splitTextByLines(parent, text, rects) {
                    var breaks = [];
                    var lastY = 0;
                    for (var i = 0; i < rects.length; i++) {
                        var rect = rects[i];
                        // TODO this is Chrome-specific; use caretPositionFromPoint in other browsers
                        var range = document.caretRangeFromPoint(rect.x + 1, rect.y + rect.height / 2); //use +1 to be sure to hit some position
                        if (range) {
                            var ofs = range.startOffset;
                            // detect line breaks
                            if (i == 0 || rect.y != lastY) {
                                breaks.push(ofs);
                                lastY = rect.y;
                            }
                        }
                    }
                    breaks.push(text.length);
                    //split to elements
                    var lines = [];
                    for (var i = 0; i < breaks.length - 1; i++) {
                        var subtext = text.substring(breaks[i], breaks[i + 1]);
                        var line = document.createElement(LINE_CONT);
                        line.FLXPath = parent.FLXPath;
                        line.appendChild(document.createTextNode(subtext));
                        lines.push(line);
                    }
                    return lines;
                }

                function isVisibleElement(e) {
                    if (e.nodeType == Node.ELEMENT_NODE) {
                        return (e.getClientRects().length > 0);
                    }
                    return false;
                }

                /**
                 * Replaces text nodes with XX elements to avoid mixed content.
                 * @param {Element} p the root element of the subtree to process.
                 */
                function unmix(p) {
                    const children = p.childNodes;
                    const isMulti = (p.getClientRects().length > 1); //preserve whitespace nodes in multi-rect elements
                    // create the elements for thext nodes
                    let replace = [];
                    for (var i = 0; i < children.length; i++) {
                        var child = children.item(i);
                        if (child.nodeType == Node.TEXT_NODE && (isMulti || child.nodeValue.trim().length > 0)) {
                            var newchild = document.createElement(TEXT_CONT);
                            newchild.FLXPath = p.FLXPath + '/node()[' + (i + 1) + ']';
                            newchild.appendChild(document.createTextNode(child.nodeValue));
                            replace.push(newchild);
                        } else {
                            replace.push(null);
                            if (isVisibleElement(child)) {
                                unmix(child);
                            }
                        }
                    }
                    // replace the text nodes with elements in DOM
                    for (var i = 0; i < replace.length; i++) {
                        if (replace[i] != null) {
                            p.replaceChild(replace[i], children.item(i));
                        }
                    }
                    // remove the text elements that are rendered as empty
                    if (isMulti) {
                        for (var i = 0; i < replace.length; i++) {
                            if (replace[i] != null && replace[i].innerText.length == 0) {
                                p.removeChild(replace[i]);
                            }
                        }
                    }
                }

                markXPaths(document.body, '//body[1]');
                unmix(document.body);
                var xxs = Array.from(document.getElementsByTagName(TEXT_CONT));
                for (var i = 0; i < xxs.length; i++) {
                    var n = createLines(xxs[i]);
                    if (n === 0) {
                        console.log(xxs[i]);
                    }
                }
            }

            fitlayoutDetectLines();
            return fitlayoutExportBoxes();
        });


        // the timer that completes after 1 minute (to interrupt evaluation)
        let timerId = 0;
        let timerTask = new Promise((resolve, reject) => {
            timerId = setTimeout(resolve, EVAL_TIMEOUT * 1000, { error: 'Evaluation timeout' });
        });
        // wait for evaluation to complete
        let pg = await Promise.race([pageTask, timerTask]);
        clearTimeout(timerId);
        //NOTE ADD SUPPORT FOR SCREENSHOT
        /*
        // add a screenshot if it was required
        //NOTE we may add this as program parameter (original implementation did)
        //if (argv.s && screenShot !== null) {
        if (screenShot !== null) {
            pg.screenshot = screenShot;
        }

        // capture the images if required
        //NOTE removed argv.I for now
        //if (argv.I && pg.images) {
    
        if (pg.images) {
            // hide the contents of the marked elemens
            await page.addStyleTag({ content: '[data-fitlayoutbg="1"] * { display: none }' });
            // take the screenshots
            for (let i = 0; i < pg.images.length; i++) {
                let img = pg.images[i];
                let selector = '*[data-fitlayoutid="' + img.id + '"]';

                try {
                    if (img.bg) {
                        // for background images switch off the contents
                        await page.$eval(selector, e => {
                            e.setAttribute('data-fitlayoutbg', '1');
                        });
                    }

                    let elem = await page.$(selector);
                    if (elem !== null) {
                        img.data = await elem.screenshot({
                            type: "png",
                            encoding: "base64"
                        });
                    }

                    if (img.bg) {
                        //for background images switch the contents on again
                        await page.$eval(selector, e => {
                            e.setAttribute('data-fitlayoutbg', '0');
                        });
                    }
                } catch (e) {
                    //console.error('Couldn\'t capture image ' + i);
                    //console.error(e);
                }
            }
        }
        */
        //NOTE add support for this parameter
        /*
        if (!argv.C) {
            await browser.close();
        }
        */
        if (lastResponse) {
            pg.status = lastResponse._status;
            pg.statusText = lastResponse._statusText;
        }
        if (lastError) {
            pg.error = lastError.toString();
        }

        process.stdout.write(JSON.stringify(pg));
    };
};

