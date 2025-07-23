import { bytesToHex, getWebSocketFrameSections } from "./websocket-encoder.js";

let currentFrameDetails = null;
let highlightedElementIndex = -1;

export function checkbox(text, checked, id) {
  const container = document.createElement("div");
  container.className = "checkbox-wrapper";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = id;
  checkbox.className = "checkbox-input";
  checkbox.checked = checked;

  const label = document.createElement("label");
  label.htmlFor = id;
  label.className = "checkbox-label";
  label.textContent = text;
  label.title = "FOO";

  container.append(checkbox, label);
  return { checkbox, container };
}

export function getElementColor(element) {
  switch (element.kind) {
    case "closeCode":
      return "#dc2626";
    case "closeReason":
      return "#c756c3";
    case "payload":
      return "#059669";
    case "maskingKey":
      return "#7c3aed";
    case "extendedLengthInfo":
      return "#581c87";
    case "header":
      return "#0891b2";
    case "length":
    case "extendedLength":
      return "#ea580c";
    default:
      return "b91c1c";
  }
}

export function createHexDisplay(frameSections) {
  const container = document.createElement("div");
  container.className = "hex-display";

  frameSections.forEach((element, elementIndex) => {
    const elementWrapper = document.createElement("div");
    elementWrapper.className = "hex-element";
    elementWrapper.style.backgroundColor = "#374151";

    const hexBytes = element.bytes
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(" ");
    elementWrapper.textContent = hexBytes;

    const handleMouseEnter = () => {
      highlightedElementIndex = elementIndex;
      updateHexHighlight();
      updateFrameDetailsHighlight();
      elementWrapper.style.backgroundColor = getElementColor(element);
    };

    const handleMouseLeave = () => {
      highlightedElementIndex = -1;
      updateHexHighlight();
      updateFrameDetailsHighlight();
      elementWrapper.style.backgroundColor = "#374151";
    };

    elementWrapper.addEventListener("mouseenter", handleMouseEnter);
    elementWrapper.addEventListener("mouseleave", handleMouseLeave);

    elementWrapper.setAttribute("data-element", elementIndex);
    container.append(elementWrapper);
  });

  return { container, hexElements: container.querySelectorAll(".hex-element") };
}

export function updateHexHighlight() {
  const hexElements = document.querySelectorAll("[data-element]");
  hexElements.forEach((el) => {
    const elementIndex = parseInt(el.getAttribute("data-element"));
    const isHighlighted = highlightedElementIndex === elementIndex;

    if (
      highlightedElementIndex !== -1 &&
      currentFrameDetails &&
      currentFrameDetails.frameSections
    ) {
      if (isHighlighted) {
        const element = currentFrameDetails.frameSections[elementIndex];
        if (element) {
          el.style.backgroundColor = getElementColor(element);
          el.style.fontWeight = "bold";
          el.style.color = "#e2e8f0";
        }
      } else {
        el.style.backgroundColor = "#374151";
        el.style.fontWeight = "normal";
        el.style.color = "#e2e8f0";
      }
    } else {
      el.style.backgroundColor = "#374151";
      el.style.fontWeight = "normal";
      el.style.color = "#e2e8f0";
    }
  });
}

export function updateFrameDetailsHighlight() {
  const frameSections = document.querySelectorAll(".frame-section");
  frameSections.forEach((el, index) => {
    const isHighlighted = highlightedElementIndex === index;

    if (
      highlightedElementIndex !== -1 &&
      currentFrameDetails &&
      currentFrameDetails.frameSections
    ) {
      if (isHighlighted) {
        const element = currentFrameDetails.frameSections[index];
        if (element) {
          el.style.backgroundColor = getElementColor(element);
          el.style.border = `1px solid ${getElementColor(element)}`;
          el.style.opacity = "1";
        }
      } else {
        el.style.backgroundColor = "#374151";
        el.style.border = "1px solid #334155";
        el.style.opacity = "0.7";
      }
    } else {
      el.style.backgroundColor = "#374151";
      el.style.border = "1px solid #334155";
      el.style.opacity = "0.7";
    }
  });
}

function createCloseCodePart(element) {
  const detailsContainer = document.createElement("div");
  detailsContainer.className = "details-container";

  const closeCodeDetail = document.createElement("div");
  closeCodeDetail.className = "frame-part";
  closeCodeDetail.textContent = `Close Code: ${element.details.closeCodeValue}`;
  detailsContainer.append(closeCodeDetail);

  if (element.details.masked) {
    const maskingNote = document.createElement("div");
    maskingNote.className = "frame-part";
    maskingNote.style.fontSize = "11px";
    maskingNote.style.color = "#94a3b8";
    maskingNote.style.fontStyle = "italic";
    maskingNote.textContent = "Note: The close code is masked.";
    detailsContainer.append(maskingNote);
  }

  const lengthDetail = document.createElement("div");
  lengthDetail.className = "frame-part small";
  lengthDetail.textContent = `${element.details.payloadLength} ${
    element.details.payloadLength === 1 ? "byte" : "bytes"
  }`;
  detailsContainer.append(lengthDetail);

  return detailsContainer;
}

function createCloseReasonPart(element) {
  const detailsContainer = document.createElement("div");
  detailsContainer.className = "details-container";

  let closeReason = "";
  try {
    closeReason = new TextDecoder().decode(
      Uint8Array.from(element.details.originalBytes || element.bytes)
    );
  } catch (error) {
    console.error("Failed to decode close reason:", error);
    closeReason = "[Invalid UTF-8]";
  }

  const reasonDetail = document.createElement("div");
  reasonDetail.className = "frame-part";
  reasonDetail.textContent = `Close Reason: "${closeReason}"`;
  detailsContainer.append(reasonDetail);

  if (element.details.masked && element.details.originalBytes) {
    const maskingDetail = document.createElement("div");
    maskingDetail.className = "frame-part";
    maskingDetail.style.fontSize = "11px";
    maskingDetail.style.color = "#94a3b8";
    maskingDetail.style.fontStyle = "italic";

    maskingDetail.textContent = "Note: The close reason is masked.";
    detailsContainer.append(maskingDetail);
  }

  const lengthDetail = document.createElement("div");
  lengthDetail.className = "frame-part small";
  lengthDetail.textContent = `${element.details.payloadLength} bytes`;
  detailsContainer.append(lengthDetail);

  return detailsContainer;
}

function createPayloadPart(element) {
  const detailsContainer = document.createElement("div");
  detailsContainer.className = "details-container";

  let originalPlaintext = "";
  try {
    originalPlaintext = new TextDecoder().decode(
      Uint8Array.from(
        element.details.originalBytes || element.originalBytes || element.bytes
      )
    );
  } catch (error) {
    console.warn("Failed to decode payload:", error);
    originalPlaintext = "[Invalid UTF-8]";
  }

  const plaintextDetail = document.createElement("div");
  plaintextDetail.className = "frame-part payload-plaintext";
  plaintextDetail.style.overflowX = "hidden";
  plaintextDetail.style.maxHeight = "200px";
  plaintextDetail.style.overflowY = "auto";
  plaintextDetail.textContent = originalPlaintext;
  detailsContainer.append(plaintextDetail);

  if (element.details.masked && element.details.originalBytes) {
    const maskingDetail = document.createElement("div");
    maskingDetail.className = "frame-part";
    maskingDetail.style.fontSize = "11px";
    maskingDetail.style.color = "#94a3b8";
    maskingDetail.style.fontStyle = "italic";

    let mask = null;
    if (currentFrameDetails?.frameSections) {
      const keyElement = currentFrameDetails.frameSections.find(
        (el) => el.details?.mask
      );
      if (keyElement) {
        mask = keyElement.details.mask;
      }
    }

    if (!mask) throw new Error("mask not found");

    const originalHex = element.details.originalBytes
      .slice(0, 4)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    const maskedHex = element.bytes
      .slice(0, 4)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    const maskHex = mask
      .slice(0, 4)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");

    const originalLine = document.createElement("div");
    originalLine.textContent = `Original: ${originalHex}${
      element.details.originalBytes.length > 4 ? "..." : ""
    }`;

    const maskLine = document.createElement("div");
    maskLine.textContent = `Masking key: ${maskHex}`;

    const maskedLine = document.createElement("div");
    maskedLine.textContent = `Masked: ${maskedHex}${
      element.bytes.length > 4 ? "..." : ""
    }`;

    maskingDetail.append(originalLine, maskLine, maskedLine);

    detailsContainer.append(maskingDetail);
  }

  if (element.details.compressionInfo) {
    const compressedHex = Array.from(element.bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");

    const compressedDetail = document.createElement("div");
    compressedDetail.className = "frame-part";
    compressedDetail.textContent = `Compressed (hex): ${compressedHex}`;
    detailsContainer.append(compressedDetail);

    const lengthDetail = document.createElement("div");
    lengthDetail.className = "frame-part";
    lengthDetail.textContent = `${element.details.compressionInfo.compressedLength} bytes (${element.details.compressionInfo.compressionRatio}% compression)`;
    detailsContainer.append(lengthDetail);
  } else {
    const lengthDetail = document.createElement("div");
    lengthDetail.className = "frame-part small";
    lengthDetail.textContent = `${element.details.payloadLength} bytes`;
    detailsContainer.append(lengthDetail);
  }

  return detailsContainer;
}

function createMaskingKeyPart(element) {
  const detailsContainer = document.createElement("div");
  detailsContainer.className = "details-container";

  const keyDetail = document.createElement("div");
  keyDetail.className = "frame-part";
  keyDetail.textContent = `${element.details.mask.join(" ")}`;
  detailsContainer.append(keyDetail);

  return detailsContainer;
}

function createFrameHeaderPart(element) {
  const headerDetail = document.createElement("div");
  headerDetail.className = "frame-part";
  headerDetail.textContent = `0x${element.details.byteString}`;

  const bitBreakdown = document.createElement("div");
  bitBreakdown.className = "bit-breakdown";

  const labelsRow = document.createElement("div");
  labelsRow.className = "field-labels";
  const labels = ["FIN", "RSV1", "RSV2", "RSV3", "", "", "OPCODE (4 bits)", ""];

  for (let i = 7; i >= 0; i--) {
    const labelElement = document.createElement("div");
    labelElement.className = "field-label";
    labelElement.textContent = labels[7 - i];

    if (labels[7 - i] === "OPCODE (4 bits)") {
      labelElement.classList.add("opcode");
    }

    labelsRow.append(labelElement);
  }

  const bitGrid = document.createElement("div");
  bitGrid.className = "bit-grid";
  for (let i = 7; i >= 0; i--) {
    const bitPosition = document.createElement("div");
    bitPosition.className = "bit-position";
    bitPosition.textContent = `${i}`;
    bitGrid.append(bitPosition);
  }

  const bitValues = document.createElement("div");
  bitValues.className = "bit-values";
  const byteString = parseInt(element.details.byteString, 16);

  for (let i = 7; i >= 0; i--) {
    const bitValue = document.createElement("div");
    bitValue.className = "bit-value";
    const bit = (byteString >> i) & 1;
    bitValue.textContent = `${bit}`;
    bitValue.style.backgroundColor = bit ? "#0891b2" : "#374151";
    bitValues.append(bitValue);
  }

  bitBreakdown.append(labelsRow, bitGrid, bitValues);

  const textPart = document.createElement("div");
  textPart.className = "frame-part";
  const finLine = document.createElement("div");
  finLine.textContent = `FIN: ${element.details.fin}`;
  const rsv1Line = document.createElement("div");
  rsv1Line.textContent = `RSV1: ${element.details.rsv1}`;
  const rsv2Line = document.createElement("div");
  rsv2Line.textContent = `RSV1: ${element.details.rsv2}`;
  const rsv3Line = document.createElement("div");
  rsv3Line.textContent = `RSV1: ${element.details.rsv3}`;
  const opcodeLine = document.createElement("div");
  opcodeLine.textContent = `Opcode: ${element.details.opcodeBits} (${element.details.opcodeName})`;
  textPart.append(finLine, rsv1Line, rsv2Line, rsv3Line, opcodeLine);

  const detailsContainer = document.createElement("div");
  detailsContainer.className = "details-container";
  detailsContainer.append(headerDetail, bitBreakdown, textPart);

  return detailsContainer;
}

function createLengthPart(element) {
  const lengthDetail = document.createElement("div");
  lengthDetail.className = "frame-part";
  lengthDetail.textContent = `0x${element.details.byteString}`;

  const bitBreakdown = document.createElement("div");
  bitBreakdown.className = "bit-breakdown";

  const labelsRow = document.createElement("div");
  labelsRow.className = "field-labels";
  const labels = ["MASK", "", "", "LENGTH (7 bits)", "", "", "", ""];

  for (let i = 7; i >= 0; i--) {
    const labelElement = document.createElement("div");
    labelElement.className = "field-label";
    labelElement.textContent = labels[7 - i];

    if (labels[7 - i] === "LENGTH (7 bits)") {
      labelElement.style.width = "80px";
      labelElement.style.marginRight = "-30px";
    }

    labelsRow.append(labelElement);
  }

  const bitGrid = document.createElement("div");
  bitGrid.className = "bit-grid";
  for (let i = 7; i >= 0; i--) {
    const bitPosition = document.createElement("div");
    bitPosition.className = "bit-position";
    bitPosition.textContent = `${i}`;
    bitGrid.append(bitPosition);
  }

  const bitValues = document.createElement("div");
  bitValues.className = "bit-values";

  for (let i = 7; i >= 0; i--) {
    const bitValue = document.createElement("div");
    bitValue.className = "bit-value";
    const bit = (element.bytes[0] >> i) & 1;
    bitValue.textContent = `${bit}`;
    bitValue.style.backgroundColor = bit ? "#ea580c" : "#374151";

    bitValues.append(bitValue);
  }

  bitBreakdown.append(labelsRow, bitGrid, bitValues);

  const detailsContainer = document.createElement("div");
  detailsContainer.className = "details-container";

  const textPart = document.createElement("div");
  textPart.className = "frame-part";
  const maskLine = document.createElement("div");
  maskLine.textContent = `Masked: ${element.details.masked}`;
  const lengthLine = document.createElement("div");
  lengthLine.textContent = `Length: ${element.details.payloadLength} ${
    element.details.payloadLength === 1 ? "byte" : "bytes"
  }`;
  textPart.append(maskLine, lengthLine);

  detailsContainer.append(lengthDetail, bitBreakdown, textPart);

  return detailsContainer;
}

function createExtendedLengthPart(element) {
  const textPart = document.createElement("div");
  textPart.className = "frame-part";
  const length = document.createElement("div");
  length.textContent = `Length: ${element.details.payloadLength} bytes`;
  textPart.append(length);

  const detailsContainer = document.createElement("div");
  detailsContainer.className = "details-container";
  detailsContainer.append(textPart);

  return detailsContainer;
}

function createExtendedLengthInfoPart(element) {
  const lengthDetail = document.createElement("div");
  lengthDetail.className = "frame-part";
  lengthDetail.textContent = `0x${element.details.byteString}`;

  const bitBreakdown = document.createElement("div");
  bitBreakdown.className = "bit-breakdown";

  const labelsRow = document.createElement("div");
  labelsRow.className = "field-labels";
  const labels = ["MASK", "", "", "LENGTH INDICATOR (7 bits)", "", "", "", ""];

  for (let i = 7; i >= 0; i--) {
    const labelElement = document.createElement("div");
    labelElement.className = "field-label";
    labelElement.textContent = labels[7 - i];

    if (labels[7 - i] === "LENGTH INDICATOR (7 bits)") {
      labelElement.style.width = "160px";
    }

    labelsRow.append(labelElement);
  }

  const bitGrid = document.createElement("div");
  bitGrid.className = "bit-grid";
  for (let i = 7; i >= 0; i--) {
    const bitPosition = document.createElement("div");
    bitPosition.className = "bit-position";
    bitPosition.textContent = `${i}`;
    bitGrid.append(bitPosition);
  }

  const bitValues = document.createElement("div");
  bitValues.className = "bit-values";

  for (let i = 7; i >= 0; i--) {
    const bitValue = document.createElement("div");
    bitValue.className = "bit-value";
    const bit = (element.bytes[0] >> i) & 1;
    bitValue.textContent = `${bit}`;
    bitValue.style.backgroundColor = bit ? "#581c87" : "#374151";

    bitValues.append(bitValue);
  }

  bitBreakdown.append(labelsRow, bitGrid, bitValues);

  const detailsContainer = document.createElement("div");
  detailsContainer.className = "details-container";

  const textPart = document.createElement("div");
  textPart.className = "frame-part";
  const maskLine = document.createElement("div");
  maskLine.textContent = `Masked: ${element.details.masked}`;
  const lengthLine = document.createElement("div");
  lengthLine.textContent = `Length of payload length: ${
    element.details.firstSevenLenBits === 126 ? "16 bits" : "64 bits"
  }`;
  const explanationLine = document.createElement("div");
  explanationLine.style.fontStyle = "italic";
  explanationLine.style.color = "#94a3b8";
  explanationLine.textContent = `This comes from the lower 7 bits being ${element.details.firstSevenLenBits}`;
  textPart.append(maskLine, lengthLine, explanationLine);

  detailsContainer.append(lengthDetail, bitBreakdown, textPart);

  return detailsContainer;
}

export function updateFrameDetails(frameSections) {
  const details = document.getElementById("frameDetails");
  if (!details) return;

  details.innerHTML = "";

  frameSections.forEach((element, index) => {
    const section = document.createElement("div");
    section.className = "frame-section";
    section.setAttribute("data-frame-section", index);

    section.style.backgroundColor = "#374151";
    section.style.border = "1px solid #334155";
    section.style.opacity = "0.7";

    const elementTitle = document.createElement("div");
    elementTitle.className = "frame-section-title";
    elementTitle.textContent = element.description;
    section.append(elementTitle);

    section.addEventListener("mouseenter", () => {
      highlightedElementIndex = index;
      updateHexHighlight();
      updateFrameDetailsHighlight();
    });

    section.addEventListener("mouseleave", () => {
      highlightedElementIndex = -1;
      updateHexHighlight();
      updateFrameDetailsHighlight();
    });

    let part;
    switch (element.kind) {
      case "closeCode":
        part = createCloseCodePart(element);
        break;
      case "closeReason":
        part = createCloseReasonPart(element);
        break;
      case "payload":
        part = createPayloadPart(element);
        break;
      case "maskingKey":
        part = createMaskingKeyPart(element);
        break;
      case "header":
        part = createFrameHeaderPart(element);
        break;
      case "length":
        part = createLengthPart(element);
        break;
      case "extendedLength":
        part = createExtendedLengthPart(element);
        break;
      case "extendedLengthInfo":
        part = createExtendedLengthInfoPart(element);
        break;
      default:
        throw new Error(`Unexpected kind ${element.kind}`);
    }

    section.append(part);

    details.append(section);
  });
}

export function handleOpChange() {
  const opSelect = document.getElementById("opSelect");
  const textInput = document.getElementById("textInput");
  const compressCheckbox = document.getElementById("compressCheckbox");
  const closeCodeContainer = document.getElementById("closeCodeContainer");

  if (!opSelect || !textInput || !compressCheckbox || !closeCodeContainer) {
    return;
  }

  const op = parseInt(opSelect.value);
  const isControl = op >= 8;
  const isClose = op === 8;

  closeCodeContainer.style.display = isClose ? "flex" : "none";

  if (isControl && !isClose) {
    textInput.disabled = true;
    textInput.classList.add("disabled");
    textInput.placeholder = "Ping/Pong frames don't have a payload";
    textInput.value = "";
    compressCheckbox.disabled = true;
    compressCheckbox.parentElement.classList.add("disabled");

    const finCheckbox = document.getElementById("finCheckbox");
    if (finCheckbox) {
      finCheckbox.checked = true;
      finCheckbox.disabled = true;
      finCheckbox.parentElement.classList.add("disabled");
    }
  } else {
    textInput.disabled = false;
    textInput.classList.remove("disabled");
    if (isClose) {
      textInput.placeholder = "Close reason (optional)";
      textInput.value = "";
    } else {
      textInput.placeholder = "Your message goes here";
      textInput.value = "";
    }
    compressCheckbox.disabled = false;
    compressCheckbox.parentElement.classList.remove("disabled");

    const finCheckbox = document.getElementById("finCheckbox");
    if (finCheckbox) {
      finCheckbox.disabled = false;
      finCheckbox.parentElement.classList.remove("disabled");
    }
  }
}

export async function generateFrame() {
  const input = document.getElementById("textInput");
  const output = document.getElementById("output");
  const details = document.getElementById("frameDetails");
  const opSelect = document.getElementById("opSelect");
  const closeCodeSelect = document.getElementById("closeCodeSelect");
  const finCheckbox = document.getElementById("finCheckbox");
  const maskedCheckbox = document.getElementById("maskCheckbox");
  const compressCheckbox = document.getElementById("compressCheckbox");

  if (
    !input ||
    !opSelect ||
    !finCheckbox ||
    !maskedCheckbox ||
    !compressCheckbox ||
    !output
  ) {
    console.error("UI elements not found");
    return;
  }

  details.innerHTML = "";

  try {
    const text = input.value || "";
    const op = parseInt(opSelect.value);
    const isClose = op === 8;
    const isData = op < 8;

    if (isData && text.length > 100000) {
      throw new Error(
        "Plaintext input is too long. Maximum length is 100,000 characters."
      );
    }

    let payload;
    let closeCode = null;

    if (isClose) {
      closeCode = parseInt(closeCodeSelect.value) || 1000;

      if (closeCode < 1000 || closeCode > 1015) {
        throw new Error("Invalid close code. Must be between 1000-1015.");
      }

      const closeCodeBytes = new Uint8Array(2);
      closeCodeBytes[0] = (closeCode >> 8) & 0xff;
      closeCodeBytes[1] = closeCode & 0xff;

      if (text !== "") {
        const reasonBytes = new TextEncoder().encode(text);
        payload = new Uint8Array(2 + reasonBytes.length);
        payload.set(closeCodeBytes, 0);
        payload.set(reasonBytes, 2);
      } else {
        payload = closeCodeBytes;
      }
    } else if (isData) {
      payload = new TextEncoder().encode(text);
    } else {
      payload = new Uint8Array(0);
    }

    const options = {
      payload,
      opcode: op,
      fin: finCheckbox.checked,
      rsv1: compressCheckbox.checked,
      rsv2: false,
      rsv3: false,
      masked: maskedCheckbox.checked,
      compressed: compressCheckbox.checked,
      closeCode: closeCode,
    };

    const result = await getWebSocketFrameSections(options);
    currentFrameDetails = result;

    output.innerHTML = "";
    const hexDisplay = createHexDisplay(result.frameSections);
    output.append(hexDisplay.container);
    updateFrameDetails(result.frameSections);
  } catch (err) {
    const errEl = document.createElement("div");
    errEl.className = "error-message";
    errEl.textContent = err.message;
    details.append(errEl);
  }
}
