// Static command line interface functions

const chmodr = require('chmodr');
const commander = require('commander');
const fs = require("fs-extra");
const os = require("os");
const path = require('path');
const process = require('process');

const chain = require('./chain');
const files = require('./files');
const log = require('./log');
const runopts = require('./run-options');

const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json")));
const VERSION = packageInfo.version;

/**
 * Default chain name: used for the filename that specifies the chain's current state.
 */
const CHAIN_NAME_DEFAULT = "chain";

/**
 * Default port of the --show-browser VNC server.
 * Not available when directly running the docker image.
 */
const SHOW_BROWSER_PORT_DEFAULT = 5942;

/**
 * Default address to bind the --show-browser VNC server to.
 * Not available when directly running the docker image.
 */
const SHOW_BROWSER_BIND_DEFAULT = "127.0.0.1";

/**
 * Default width of the --show-browser virtual display in pixels.
 */
const SHOW_BROWSER_WIDTH_DEFAULT = 1366;

/**
 * Default height of the --show-browser virtual display in pixels.
 */
const SHOW_BROWSER_HEIGHT_DEFAULT = 768;

/**
 * Default password for the --show-browser virtual display (VNC server): none.
 */
const SHOW_BROWSER_PASSWORD_DEFAULT = null;

//Default configurations for Fitlayout-Puppeteer
const TAKE_SCREENSHOT_DEFAULT = true;

const CAPTURE_IMAGES_DEFAULT = true;

const CLOSE_BROWSER_DEFAULT = true;

/**
 * Parses the options for the Scriptor command line interface.
 * @param {boolean} dockerEntrypoint - Whether the options are parsed for the
 * Docker entrypoint or not
 * @returns {object} - The parsed options
 */
const parse = function(dockerEntrypoint = false) {
  const program = commander.version(VERSION);
  if (dockerEntrypoint) {
    program
      .usage('[options]')
      .description("Runs a Scriptor web user simulation script.")
      .addOption(new commander.Option('-s, --script-directory <directory>')
        .default('/script').hideHelp())
      .addOption(new commander.Option('-o, --output-directory <directory>')
        .default('/output').hideHelp())
      .option('-i, --input <specification>', 'contents of the '
        + 'config.json for this specific run')
  } else {
    program
      .usage('[options] '
        + '--output-directory <directory>')
      .description(
        "Runs a Scriptor web user simulation script in a docker container.")
      .option('-s, --script-directory <directory>', 'the directory '
        + 'containing the Script.js and other run-independent files (default: '
        + 'use the default Snapshot script (requires an input config.json with '
        + '"url" property))')
      .option('-i, --input <specification>', 'one of: (1) the directory '
        + 'containing the files for this specific run (including config.json), '
        + '(2) the contents of the config.json, or (3) "-" read the config.json '
        + 'from standard input')
      .requiredOption('-o, --output-directory <directory>', 'the directory the run '
        + 'output is written to')
      .option('-d, --docker-image-tag <tag>', 'the tag of the docker image to '
        + 'use', VERSION)
      .option('-t, --timeout <milliseconds>', 'abort the script after the '
        + 'specified number of milliseconds (applies to each run of a --chain '
        + 'separately; default: none)');
  }

  let showBrowserDescription = 'show the browser in the docker '
      + 'container, allowing to connect to it using VNC. The config is a JSON '
      + 'object with these properties (all optional):\n';
  if (!dockerEntrypoint) {
    showBrowserDescription = showBrowserDescription
        + '- port: VNC server port (default: ' + SHOW_BROWSER_PORT_DEFAULT + ')\n'
        + '- bind: IP address to bind to, thereby restricting access to the VNC '
        + 'server (default: ' + SHOW_BROWSER_BIND_DEFAULT + ')\n'
  }
  showBrowserDescription = showBrowserDescription
      + '- password: require this password to connect to the VNC server '
      + '(default: none)\n'
      + '- width: width of the virtual display in pixel (default: '
      + SHOW_BROWSER_WIDTH_DEFAULT + ')\n'
      + '- height: height of the virtual display in pixel (default: '
      + SHOW_BROWSER_HEIGHT_DEFAULT + ')';

  program
    .option('-r, --replay [mode]', 'use the WARC web archive of the script or '
      + 'input directory (prefered if exists) to answer the browser requests; '
      + 'Modes: "rw" for requesting (and adding) missing resources and "r" '
      + '(default) for restricting resources to those already in the archive')
    .option('-w, --warc-input <warcs>', 'add the specified WARC file or all '
      + 'WARC files in the specified directory to the web archive before the '
      + 'run; use this together with --replay to run scriptor on web archives')
    .option('-c, --chain [name]', 'run the script several times, using the '
      + 'output directory of a run (placed within the --output-directory) as '
      + 'the input directory of the next. The name is used as a prefix for '
      + 'the run output directories and is the name (without .json) of a '
      + 'file in the --output-directory that contains information on the '
      + 'last successful run. If this file already exists, the chain is '
      + 'continued from that state (default: ' + CHAIN_NAME_DEFAULT + ')')
    .option('-p, --proxy <address>', 'use this proxy server for connecting to '
      + 'the Internet (e.g., "http://myproxy.com:3128" or '
      + '"socks5://myproxy.com:3128")')
    .option('-x, --insecure', 'ignore HTTPS errors (only considered when '
      + '--no-warc is set and --replay is not)')
    .option('-b, --show-browser [config]', showBrowserDescription)
    .option('-u, --unrandomize', 'specifies how to overwrite Math.random: '
      + '"not" or by a "constant" (default: "constant")')
    .option('-v, --video [scale-factor]', 'store a video recording of the run, '
      + 'and optionally set its scale factor relative to viewport size')
    .option('-H, --no-har', 'do not store a HAR archive of the run')
    .option('-T, --no-tracing', 'do not store a Playwright trace of the run')
    .option('-W, --no-warc', 'do not store a WARC web archive of the run')
    .option('-O, --overwrite-output', 'deletes the output directory before '
      + 'execution if it exists (instead of failing)')
    .option('-S, --snapshot','takes snapshot of the run')
    .option('-I, --images','takes images of the run')
    .option('-C, --close-browser','closes browser after the run');
  return program.parse(process.argv).opts();
}
module.exports.parse = parse;

////////////////////////////////////////////////////////////////////////////////
// FUNCTIONS
////////////////////////////////////////////////////////////////////////////////

/**
 * Gets the run options for {@link scripts.run}.
 * @param {object} options - The parsed options
 * @returns {object} - The options to pass to {@link scripts.run}
 */
const getRunOptions = function(options) {
  const runOptions = {};
  if (options.chain !== undefined) {
    if (options.chain === true) {
      runopts.setChainName(runOptions, CHAIN_NAME_DEFAULT);
    } else {
      runopts.setChainName(runOptions, options.chain);
    }
  }
  if (options.replay !== undefined) {
    if (options.replay === true || options.replay === "r") {
      runopts.setReplayReadOnly(runOptions);
    } else if (options.replay === "rw") {
      runopts.setReplayReadWrite(runOptions);
    } else {
      throw new Error("Invalid value for --replay: '" + options.replay + "'");
    }
  } 
  if (options.warcInput !== undefined) {
    runopts.setWarcInput(runOptions, options.warcInput);
  }
  if (options.proxy !== undefined) {
    runopts.setProxy(runOptions, options.proxy);
  }
  if (options.insecure !== undefined) {
    runopts.setInsecure(runOptions);
  }
  if (options.showBrowser !== undefined) {
    const showBrowserOptions = JSON.parse(options.showBrowser);
    const width = showBrowserOptions.width === undefined
      ? SHOW_BROWSER_WIDTH_DEFAULT : showBrowserOptions.width;
    const height = showBrowserOptions.height === undefined
      ? SHOW_BROWSER_HEIGHT_DEFAULT : showBrowserOptions.height;
    const password = showBrowserOptions.password === undefined
      ? SHOW_BROWSER_PASSWORD_DEFAULT : showBrowserOptions.password;
    runopts.setShowBrowser(runOptions, width, height, password);
  }
  if (options.unrandomize !== undefined) {
    if (options.unrandomize === true || options.unrandomize === "constant") {
      runopts.setUnrandomizeByConstant(runOptions);
    } else if (options.unrandomize === "not") {
      runopts.setUnrandomizeNot(runOptions);
    } else {
      throw new Error(
        "Invalid value for --unrandomize: '" + options.unrandomize + "'");
    }
  }
  if (options.video !== undefined) {
    if (options.video === true) {
      runopts.setVideo(runOptions);
    } else {
      runopts.setVideo(runOptions, parseFloat(options.video));
    }
  }
  if (!options.har) {
    runopts.setNoHar(runOptions);
  }
  if (!options.tracing) {
    runopts.setNoTracing(runOptions);
  }
  if (!options.warc) {
    runopts.setNoWarc(runOptions);
  }
  if (!options.overwriteOutput) {
    runopts.setOverwriteOutput(runOptions);
  }
  log.info({
    options: options,
    runOptions: runOptions
  }, "cli.getRunOptions");
  return runOptions;
};
module.exports.getRunOptions = getRunOptions;

/**
 * Gets the tag of the Docker image to use.
 * @param {object} options - The parsed options
 * @returns {string} - The tag
 */
const getDockerImageTag = function(options) {
  return options.dockerImageTag;
}
module.exports.getDockerImageTag = getDockerImageTag;

/**
 * Gets the list of port exposings for the Docker run.
 * @param {object} options - The parsed options
 * @returns {array<string>} - The values for "-p" options
 */
const getDockerExposedPorts = function(options) {
  const exposedPorts = [];
  if (options.showBrowser !== undefined) {
    const port = options.showBrowser.port === undefined
      ? SHOW_BROWSER_PORT_DEFAULT : options.showBrowser.port;
    const bind = options.showBrowser.bind === undefined
      ? SHOW_BROWSER_BIND_DEFAULT : options.showBrowser.bind;
    exposedPorts.push(bind + ":" + port + ":5942"); // 5900 + DISPLAY
  }
  return exposedPorts;
}
module.exports.getDockerExposedPorts = getDockerExposedPorts;

/**
 * Gets the specified timeout.
 * @param {object} options - The parsed options
 * @returns {integer|null} - The timeout in milliseconds or <code>null</code> if
 * none
 */
const getTimeout = function(options) {
  // no timeout
  if (options.timeout === undefined) { return null; }
  // milliseconds
  return parseInt(options.timeout);
}
module.exports.getTimeout = getTimeout;

/**
 * Gets the script directory from the parsed command line options.
 * @param {object} options - The parsed options
 * @returns {string|null} - The script directory path or <code>null</code> if
 * none
 */
const getScriptDirectory = function(options) {
  const scriptDirectory = options.scriptDirectory;

  // no script directory
  if (scriptDirectory === undefined) { return null; }

  if (!fs.existsSync(scriptDirectory)) {
    throw new Error(
      "script directory '" + scriptDirectory + "' does not exist.");
  }
  if (!fs.statSync(scriptDirectory).isDirectory()) {
    throw new Error(
      "script directory '" + scriptDirectory + "' is not a directory.");
  }
  return scriptDirectory;
};
module.exports.getScriptDirectory = getScriptDirectory;

/**
 * Gets the input directory from the parsed command line options.
 * @param {object} options - The parsed options
 * @param {boolean} dockerEntrypoint - Whether the options are parsed for the
 * Docker entrypoint or not
 * @returns {string|null} - The input directory path or <code>null</code> if none
 */
const getInputDirectory = function(options, dockerEntrypoint = false) {
  if (dockerEntrypoint && options.chain) {
    // Get last output directory of chain for input
    let chainName = options.chain;
    if (chainName === true) { chainName = CHAIN_NAME_DEFAULT; }
    const chainInputDirectory =
      chain.getChainInputDirectory(chainName, options.outputDirectory);
    if (chainInputDirectory !== null) {
      return chainInputDirectory;
    }
    // else: new chain, use input directory as specified otherwise
  }

  const input = options.input;

  // no input directory
  if (input === undefined) {
    if (dockerEntrypoint && fs.existsSync("/input")) {
      return "/input";
    } else {
      return null;
    }
  }

  const makeTemporaryInputDirectory = (config) => {
    const tmpInputDirectory =
      fs.mkdtempSync(path.join(os.tmpdir(), "scriptor-input-"));
    log.info({
      directory: tmpInputDirectory,
      config: JSON.parse(config)
    }, "cli.getInputDirectory.makeTemporaryInputDirectory");
    const configurationFile =
      path.join(tmpInputDirectory, files.SCRIPT_OPTIONS_FILE_NAME);
    fs.writeFileSync(configurationFile, config);
    return tmpInputDirectory;
  };

  if (input === "-") {
    // stdin
    const config = fs.readFileSync(0);
    return makeTemporaryInputDirectory(config);
  }

  if (input.startsWith("{")) {
    // direct specification
    return makeTemporaryInputDirectory(input);
  }

  // directory case
  if (!fs.existsSync(input)) {
    throw new Error("input directory '" + input + "' does not exist.");
  }
  if (!fs.statSync(input).isDirectory()) {
    throw new Error("input directory '" + input + "' is not a directory.");
  }
  return input;
};
module.exports.getInputDirectory = getInputDirectory;

/**
 * Gets the output directory from the parsed command line options.
 * @param {object} options - The parsed options
 * @returns {string} - The output directory path
 */
const getOutputDirectory = function(options) {
  let outputDirectory = options.outputDirectory;
  if (options.chain) {
    let chainName = options.chain;
    if (chainName === true) { chainName = CHAIN_NAME_DEFAULT; }
    outputDirectory = chain.getChainOutputDirectory(chainName, outputDirectory);
  }

  if (options.overwriteOutput && fs.existsSync(outputDirectory)) {
    chmodr.sync(outputDirectory, 0o666);
    for (const child of fs.readdirSync(outputDirectory)) {
      fs.rmSync(path.join(outputDirectory, child), { recursive: true, force: true });
    }
  }
  fs.mkdirSync(outputDirectory, { recursive: true });
  if (!fs.statSync(outputDirectory).isDirectory()) {
    throw new Error(
      "output directory '" + outputDirectory + "' is not a directory.");
  }
  if (fs.readdirSync(outputDirectory).length > 1) { // may contain log file
    throw new Error(
      "output directory '" + outputDirectory + "' is not empty.");
  }
  return outputDirectory;
};
module.exports.getOutputDirectory = getOutputDirectory;

/**
 * Gets the command arguments to pass to the Docker entrypoint.
 * @param {object} options - The parsed options
 * @returns {array} - The arguments to pass on
 */
const getEntrypointArgs = function(options) {
  const args = [];
  if (options.replay !== undefined) {
    args.push("--replay");
    if (options.replay !== true) { args.push(options.replay); }
  }
  if (options.warcInput !== undefined) {
    args.push("--warc-input");
    args.push("/warc-input");
  }
  if (options.chain !== undefined) {
    args.push("--chain");
    if (options.chain !== true) { args.push(options.chain); }
  }
  if (options.proxy !== undefined) {
    args.push("--proxy");
    args.push("'" + options.proxy + "'");
  }
  if (options.insecure !== undefined) { args.push("--insecure"); }
  if (options.showBrowser !== undefined) {
    args.push("--show-browser");
    if (options.showBrowser !== true) { args.push(options.showBrowser); }
  }
  if (options.unrandomize !== undefined) {
    args.push("--unrandomize");
    if (options.unrandomize !== true) { args.push("'" + options.unrandomize + "'"); }
  }
  if (options.video !== undefined) {
    args.push("--video");
    if (options.video !== true) { args.push("'" + options.video + "'"); }
  }
  if (!options.har) { args.push("--no-har"); }
  if (!options.tracing) { args.push("--no-tracing"); }
  if (!options.warc) { args.push("--no-warc"); }
  return args;
}
module.exports.getEntrypointArgs = getEntrypointArgs;

