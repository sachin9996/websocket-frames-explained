import { checkbox, handleOpChange, generateFrame } from "./ui-components.js";

const opcodes = [
  {
    value: "0",
    text: "Continuation (0x0)",
    description: "Continues a fragmented message started by a previous frame",
  },
  { value: "1", text: "Text (0x1)", description: "UTF-8 encoded text data" },
  { value: "2", text: "Binary (0x2)", description: "Binary data" },
  {
    value: "8",
    text: "Close (0x8)",
    description: "Connection close with optional code and reason",
  },
  {
    value: "9",
    text: "Ping (0x9)",
    description: "Ping (no payload)",
  },
  {
    value: "10",
    text: "Pong (0xA)",
    description: "Pong (no payload)",
  },
];

const closeCodes = [
  {
    value: "1000",
    text: "1000 Normal Closure",
    description:
      "Normal closure, meaning that the purpose for which the connection was established has been fulfilled.",
  },
  {
    value: "1001",
    text: "1001 Going Away",
    description:
      'An endpoint is "going away", such as a server going down or a browser having navigated away from a page.',
  },
  {
    value: "1002",
    text: "1002 Protocol Error",
    description:
      "An endpoint is terminating the connection due to a protocol error.",
  },
  {
    value: "1003",
    text: "1003 Unsupported Data",
    description:
      "An endpoint is terminating the connection because it has received a type of data it cannot accept.",
  },
  {
    value: "1005",
    text: "1005 No Status Received",
    description: "No status code was actually present.",
  },
  {
    value: "1006",
    text: "1006 Abnormal Closure",
    description:
      "Abnormal closure, meaning the connection was lost without a close frame being received.",
  },
  {
    value: "1007",
    text: "1007 Invalid frame payload data",
    description:
      "An endpoint is terminating the connection because it has received data within a message that was not consistent with the type of the message.",
  },
  {
    value: "1008",
    text: "1008 Policy Violation",
    description:
      'An endpoint is terminating the connection because it has received a message that "violates its policy".',
  },
  {
    value: "1009",
    text: "1009 Message too big",
    description:
      "An endpoint is terminating the connection because it has received a message that is too big for it to process.",
  },
  {
    value: "1010",
    text: "1010 Extension Required",
    description:
      "An endpoint (client) is terminating the connection because it has expected the server to negotiate one or more extension.",
  },
  {
    value: "1011",
    text: "1011 Internal Error",
    description:
      "A server is terminating the connection because it encountered an unexpected condition that prevented it from fulfilling the request.",
  },
  {
    value: "1015",
    text: "1015 TLS Handshake",
    description:
      "The connection was closed due to a failure to perform a TLS handshake.",
  },
];

const root = document.getElementById("encoder");

function createLayout() {
  const container = document.createElement("div");
  container.className = "container";
  container.id = "container";

  const leftPanel = document.createElement("div");
  leftPanel.className = "left-panel";
  leftPanel.id = "inputPanel";

  const rightPanel = document.createElement("div");
  rightPanel.className = "right-panel";
  rightPanel.id = "rightPanel";

  container.append(leftPanel);
  container.append(rightPanel);

  return { container, leftPanel, rightPanel };
}

function createInput() {
  const input = document.createElement("textarea");
  input.className = "text-input";
  input.id = "textInput";
  input.placeholder = "Your message goes here";

  return input;
}

function createOptions() {
  const options = document.createElement("div");
  options.className = "options";

  const opLabel = document.createElement("label");
  opLabel.textContent = "Frame type";
  opLabel.htmlFor = "opSelect";
  opLabel.className = "op-label";

  const opSelect = document.createElement("select");
  opSelect.className = "op-select";
  opSelect.id = opLabel.htmlFor;
  opSelect.addEventListener("change", handleOpChange);

  opcodes.forEach((op) => {
    const option = document.createElement("option");
    option.value = op.value;
    option.textContent = op.text;
    option.title = op.description;
    opSelect.append(option);
  });

  opSelect.value = "1";

  const opContainer = document.createElement("div");
  opContainer.className = "op-container";
  opContainer.id = "opContainer";
  opContainer.append(opLabel, opSelect);

  const closeCodeLabel = document.createElement("label");
  closeCodeLabel.textContent = "Close code";
  closeCodeLabel.htmlFor = "closeCodeSelect";
  closeCodeLabel.className = "close-code-label";
  closeCodeLabel.id = "closeCodeLabel";

  const closeCodeSelect = document.createElement("select");
  closeCodeSelect.className = "close-code-select";
  closeCodeSelect.id = closeCodeLabel.htmlFor;

  closeCodes.forEach((code) => {
    const option = document.createElement("option");
    option.value = code.value;
    option.textContent = code.text;
    option.title = code.description;
    closeCodeSelect.append(option);
  });

  const closeCodeContainer = document.createElement("div");
  closeCodeContainer.className = "close-code-container";
  closeCodeContainer.id = "closeCodeContainer";
  closeCodeContainer.style.display = "none";
  closeCodeContainer.append(closeCodeLabel, closeCodeSelect);

  const checkboxContainer = document.createElement("div");
  checkboxContainer.className = "checkbox-container";

  const fin = checkbox("FIN bit", true, "finCheckbox");
  const mask = checkbox("Masked frame", true, "maskCheckbox");
  const compress = checkbox("Enable compression", false, "compressCheckbox");

  checkboxContainer.append(fin.container, mask.container, compress.container);

  const generateBtn = document.createElement("button");
  generateBtn.textContent = "Generate WebSocket Frame";
  generateBtn.className = "generate-btn";
  generateBtn.onclick = generateFrame;

  options.append(opContainer);
  options.append(closeCodeContainer);
  options.append(checkboxContainer);
  options.append(generateBtn);

  return options;
}

function createOutput() {
  const output = document.createElement("div");
  output.className = "output";
  output.id = "output";

  const placeholder = document.createElement("div");
  placeholder.className = "output-placeholder";
  placeholder.textContent = "Frame bytes appear here";

  output.append(placeholder);
  return output;
}

function createDetails() {
  const details = document.createElement("div");
  details.id = "frameDetails";
  details.className = "frame-details";

  const placeholder = document.createElement("div");
  placeholder.className = "details-placeholder";
  placeholder.textContent = "Frame details appear here";

  details.append(placeholder);
  return details;
}

function init() {
  const { container, leftPanel, rightPanel } = createLayout();

  const input = createInput();
  const output = createOutput();
  const options = createOptions();
  const details = createDetails();

  leftPanel.append(input);
  leftPanel.append(options);
  leftPanel.append(output);

  rightPanel.append(details);

  root.style.padding = "10px";
  root.append(container);
}

init();
