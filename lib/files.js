const fs = require("fs-extra");
const path = require("path");

////////////////////////////////////////////////////////////////////////////////
// CONSTANTS
////////////////////////////////////////////////////////////////////////////////

/**
 * Name of the directory in the script, input, or output directories that
 * contains serialized data for each browser context.
 *
 * The directory contains one directory for each available browser context,
 * with the name of that directory being the context name.
 * @readonly
 * @memberof files
 */
const BROWSER_CONTEXTS_DIRECTORY = "browserContexts";
module.exports.BROWSER_CONTEXTS_DIRECTORY = BROWSER_CONTEXTS_DIRECTORY;

/**
 * Browser context name that is used if no browser context has been declared.
 * @readonly
 * @memberof files
 */
const BROWSER_CONTEXT_DEFAULT = "default";
module.exports.BROWSER_CONTEXT_DEFAULT = BROWSER_CONTEXT_DEFAULT;

/**
 * Name of the JSON file in a browser context directory that contains the
 * browser context options used by Playwright.
 * @readonly
 * @memberof files
 */
const BROWSER_CONTEXT_OPTIONS_FILE_NAME = "browser.json";
module.exports.BROWSER_CONTEXT_OPTIONS_FILE_NAME = BROWSER_CONTEXT_OPTIONS_FILE_NAME;

/**
 * Name of the ID file in the input and output directory.
 * @memberof files
 */
const ID_FILE_NAME = "id.txt";
module.exports.ID_FILE_NAME = ID_FILE_NAME;

/**
 * Name of the file in the output directory that is a copy of the input
 * directory's ID file.
 * @memberof files
 */
const INPUT_ID_FILE_NAME = "input-id.txt";
module.exports.INPUT_ID_FILE_NAME = INPUT_ID_FILE_NAME;

/**
 * Name of the main script options file in the input directory.
 * @memberof files
 */
const SCRIPT_OPTIONS_FILE_NAME = "config.json";
module.exports.SCRIPT_OPTIONS_FILE_NAME = SCRIPT_OPTIONS_FILE_NAME;

/**
 * Name of the directory to store log files that are not browser context
 * dependent.
 * @readonly
 * @memberof files
 */
const LOGS_DIRECTORY = "logs";
module.exports.LOGS_DIRECTORY = LOGS_DIRECTORY;

////////////////////////////////////////////////////////////////////////////////
// BASE DIRECTORIES
////////////////////////////////////////////////////////////////////////////////

/**
 * Gets the paths of all existing files with the specified file name in each of
 * the the base directories (or the respective browser context directory).
 * @param {string} fileName - Name of the file to check for
 * @param {(string[]|string)} baseDirectories - The directories to check for
 * the file
 * @param {(string|Null)} [contextName] - Either `null` to check in
 * the base directories directly or a `string` to check in the
 * browser context directory with the specified name
 * @returns {string[]} - The paths of the existing files
 * @see {@link #filesgetcontextdirectory|getContextDirectory}
 * @memberof files
 */
const getExisting = function(fileName, baseDirectories, contextName = null) {
  if (!Array.isArray(baseDirectories)) {
    return getExisting(fileName, [baseDirectories], contextName);
  }

  if (typeof(fileName) !== "string") {
    throw new Error(
      "Not a file name (string) but a " + typeof(fileName) + ": " + fileName);
  }

  return baseDirectories.map(baseDirectory => {
    if (baseDirectory === null) { return null; }
    if (typeof(baseDirectory) !== "string") {
      throw new Error(
        "Not a path (string) but a " + typeof(baseDirectory) + ": " + baseDirectory);
    }
    const file = contextName === null
      ? path.join(baseDirectory, fileName)
      : path.join(getContextDirectory(contextName, baseDirectory), fileName);
    if (fs.existsSync(file)) {
      return file;
    } else {
      return null;
    }
  }).filter(file => file !== null);
};
module.exports.getExisting = getExisting;

////////////////////////////////////////////////////////////////////////////////
// BROWSER CONTEXT DIRECTORIES
////////////////////////////////////////////////////////////////////////////////

/**
 * Gets the directory that contains all browser context directories.
 * @param {string} baseDirectory - The base directory (script, input, or output)
 * that contains the browser context directory
 * @returns {string} - The path of the respective browser contexts directory
 * (may not exist)
 * @memberof files
 */
const getContextsDirectory = function(baseDirectory) {
  console.log('files.getsCOntextDirectory baseDirectory: ' + baseDirectory + ' BROWSER_CONTEXTS_DIRECTORY: ' + BROWSER_CONTEXTS_DIRECTORY);
  return path.join(baseDirectory, BROWSER_CONTEXTS_DIRECTORY);
};
module.exports.getContextsDirectory = getContextsDirectory;

/**
 * Gets the browser context directory for a specific browser context.
 * @param {string} contextName - The name of the browser context
 * @param {string} baseDirectory - The base directory (script, input, or output)
 * that contains the browser context directory
 * @returns {string} - The path of the respective browser context directory
 * (may not exist)
 * @memberof files
 */
const getContextDirectory = function(contextName, baseDirectory) {
  return path.join(getContextsDirectory(baseDirectory), contextName);
};
module.exports.getContextDirectory = getContextDirectory;

/**
 * Gets the union of the names of each browser context directory.
 * @param {(string[]|string)} baseDirectories - The directories to check for
 * browser context directories
 * @returns {string[]} - The unique names
 * @memberof files
 */
const getContextDirectoryNames = function(baseDirectories) {
  if (!Array.isArray(baseDirectories)) {
    return getContextDirectoryNames([baseDirectories]);
  }

  const contextNames = new Set();
  for (const baseDirectory of baseDirectories) {
    if (baseDirectory !== null) {
      if (typeof(baseDirectory) !== "string") {
        throw new Error(
          "Not a path (string) but a " + typeof(baseDirectory) + ": " + baseDirectory);
      } else {
        const contextsDirectory = getContextsDirectory(baseDirectory);
        if (fs.existsSync(contextsDirectory)) {
          fs.readdirSync(contextsDirectory, { withFileTypes: true })
            .filter(contextDirectory => contextDirectory.isDirectory())
            .forEach(contextDirectory => {
              contextNames.add(contextDirectory.name);
            });
        }
      }
    }
  }
  return Array.from(contextNames);
};
module.exports.getContextDirectoryNames = getContextDirectoryNames;

////////////////////////////////////////////////////////////////////////////////
// OPTIONS
////////////////////////////////////////////////////////////////////////////////

/**
 * Reads and combines options (objects) from JSON files.
 *
 * A typical code sequence to read the options for a script is:
 * @example
 * const defaultScriptOptions = { ... };
 * const requiredScriptOptions = [ ... ];
 * const scriptOptions = files.readOptions(files.getExisting(
 *     files.SCRIPT_OPTIONS_FILE_NAME, [ scriptDirectory, inputDirectory ]),
 *   defaultScriptOptions, requiredScriptOptions);
 * @param {(string[]|string)} paths - The path(s) of the file(s) to read,
 * with properties in later files overwriting properties from earlier files or
 * the defaults
 * @param {Object} [defaults = {}] - The default options that are returned if not
 * (property-wise) overwritten from the files
 * @param {string[]} [required = []] - A list of options (property names) that
 * must be set either in the defaults or the files to not trigger an error
 * @returns {Object} - The options
 * @memberof files
 */
const readOptions = function(paths, defaults = {}, required = []) {
  if (!Array.isArray(paths)) {
    return readOptions([paths], defaults, required);
  }

  const options = Object.assign({}, defaults);
  for (const filePath of paths) {
    if (typeof(filePath) !== "string") {
      throw new Error("Not a path (string) but a " + typeof(filePath) + ": " + filePath);
    }
    const fileContent = fs.readFileSync(filePath, "utf8");
    const fileObject = JSON.parse(fileContent);
    Object.assign(options, fileObject);
  }

  for (const req of required) {
    if (typeof(req) !== "string") {
      throw new Error(
        "Not a required property (string) but a " + typeof(req) + ": " + req);
    }
    if (!(req in options)) {
      throw new Error("Missing required option '" + req + "' in : " + paths);
    }
  }

  return options;
};
module.exports.readOptions = readOptions;

