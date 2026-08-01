const PREFIX = "[SOM PRO]";

function formatMessage(message, parts) {
  if (message == null) return `${PREFIX}`;
  if (typeof message === "string") return [PREFIX, message, ...parts].join(" ");
  return [PREFIX, message, ...parts].join(" ");
}

function log(message, ...parts) {
  console.log(formatMessage(message, parts));
}

function success(message, ...parts) {
  console.log(formatMessage(message, parts));
}

function warn(message, ...parts) {
  console.warn(formatMessage(message, parts));
}

function error(message, ...parts) {
  console.error(formatMessage(message, parts));
}

function section(message) {
  console.log("");
  console.log(formatMessage(message, []));
}

module.exports = {
  error,
  log,
  section,
  success,
  warn
};
