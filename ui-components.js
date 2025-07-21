import { getWebSocketFrameSections } from "./websocket-encoder.js";

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

  container.append(checkbox, label);
  return { checkbox, container };
}

export function getElementColor(element) {
  switch (element.kind) {
    case "closeCode":
      return "#dc2626";
    case "closeReason":
      return "#059669";
    case "payload":
      return "#1e3a8a";
    case "mask":
      return "#7c3aed";
    case "extendedLength":
      return "#581c87";
    case "header":
      return "#0891b2";
    case "length":
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

function createCloseCodeDetails(element) {
  const detailsContainer = document.createElement("div");
  detailsContainer.className = "details-container";

  const closeCodeDetail = document.createElement("div");
  closeCodeDetail.className = "detail-item";
  closeCodeDetail.textContent = `Close Code: ${element.details.closeCodeValue}`;
  detailsContainer.append(closeCodeDetail);

  if (element.details.masked) {
    const maskingNote = document.createElement("div");
    maskingNote.className = "detail-item";
    maskingNote.style.fontSize = "11px";
    maskingNote.style.color = "#94a3b8";
    maskingNote.style.fontStyle = "italic";
    maskingNote.textContent = "Note: The close code is masked.";
    detailsContainer.append(maskingNote);
  }

  const lengthDetail = document.createElement("div");
  lengthDetail.className = "detail-item small";
  lengthDetail.textContent = `${element.details.payloadLength} bytes`;
  detailsContainer.append(lengthDetail);

  return detailsContainer;
}

function createCloseReasonDetails(element) {
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
  reasonDetail.className = "detail-item";
  reasonDetail.textContent = `Close Reason: "${closeReason}"`;
  detailsContainer.append(reasonDetail);

  if (element.details.masked && element.details.originalBytes) {
    const maskingDetail = document.createElement("div");
    maskingDetail.className = "detail-item";
    maskingDetail.style.fontSize = "11px";
    maskingDetail.style.color = "#94a3b8";
    maskingDetail.style.fontStyle = "italic";

    const originalHex = element.details.originalBytes
      .slice(0, 4)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    const maskedHex = element.bytes
      .slice(0, 4)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");

    maskingDetail.textContent = "Note: The close reason is masked.";
    detailsContainer.append(maskingDetail);
  }

  const lengthDetail = document.createElement("div");
  lengthDetail.className = "detail-item small";
  lengthDetail.textContent = `${element.details.payloadLength} bytes`;
  detailsContainer.append(lengthDetail);

  return detailsContainer;
}

function createPayloadDetails(element) {
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
  plaintextDetail.className = "detail-item payload-plaintext";
  plaintextDetail.style.overflowX = "hidden";
  plaintextDetail.style.maxHeight = "200px";
  plaintextDetail.style.overflowY = "auto";
  plaintextDetail.textContent = `"${originalPlaintext}"`;
  detailsContainer.append(plaintextDetail);

  if (element.details.masked && element.details.originalBytes) {
    const maskingDetail = document.createElement("div");
    maskingDetail.className = "detail-item";
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

    let maskingInfo = "";

    // TODO: Fix?
    if (mask) {
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

      maskingInfo += `Original: ${originalHex}${
        element.details.originalBytes.length > 4 ? "..." : ""
      }<br>`;
      maskingInfo += `Mask:     ${maskHex}<br>`;
      maskingInfo += `Masked:   ${maskedHex}${
        element.bytes.length > 4 ? "..." : ""
      }`;
    } else {
      const originalHex = element.details.originalBytes
        .slice(0, 4)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");
      const maskedHex = element.bytes
        .slice(0, 4)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");

      maskingInfo += `Masked:   ${maskedHex}${
        element.bytes.length > 4 ? "..." : ""
      }<br>`;
      maskingInfo += `Mask:     [key not found]<br>`;
      maskingInfo += `Original: ${originalHex}${
        element.details.originalBytes.length > 4 ? "..." : ""
      }`;
    }

    maskingDetail.innerHTML = maskingInfo;
    detailsContainer.append(maskingDetail);
  }

  if (element.details.compressionInfo) {
    const compressedHex = Array.from(element.bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");

    const compressedDetail = document.createElement("div");
    compressedDetail.className = "detail-item";
    compressedDetail.textContent = `Compressed (hex): ${compressedHex}`;
    detailsContainer.append(compressedDetail);

    const lengthDetail = document.createElement("div");
    lengthDetail.className = "detail-item";
    lengthDetail.textContent = `${element.details.compressionInfo.compressedLength} bytes (${element.details.compressionInfo.compressionRatio}% compression)`;
    detailsContainer.append(lengthDetail);
  } else {
    const lengthDetail = document.createElement("div");
    lengthDetail.className = "detail-item small";
    lengthDetail.textContent = `${element.details.payloadLength} bytes`;
    detailsContainer.append(lengthDetail);
  }

  return detailsContainer;
}

function createMaskingKeyDetails(element) {
  const detailsContainer = document.createElement("div");
  detailsContainer.className = "details-container";

  const keyDetail = document.createElement("div");
  keyDetail.className = "detail-item";
  keyDetail.textContent = `${element.details.mask.join(" ")}`;
  detailsContainer.append(keyDetail);

  return detailsContainer;
}

function createFrameHeaderDetails(element) {
  const detailsContainer = document.createElement("div");
  detailsContainer.className = "details-container";

  const headerDetail = document.createElement("div");
  headerDetail.className = "detail-item";
  headerDetail.textContent = `0x${element.details.combinedByte}`;
  detailsContainer.append(headerDetail);

  const bitBreakdown = document.createElement("div");
  bitBreakdown.className = "bit-breakdown";

  const fieldLabelsRow = document.createElement("div");
  fieldLabelsRow.className = "field-labels";
  const fieldLabels = [
    "FIN",
    "RSV1",
    "RSV2",
    "RSV3",
    "Opcode",
    "Opcode",
    "Opcode",
    "Opcode",
  ];

  for (let i = 7; i >= 0; i--) {
    const fieldLabel = document.createElement("div");
    fieldLabel.className = "field-label";

    if (fieldLabels[7 - i] === "Opcode") {
      if (i === 1) {
        fieldLabel.textContent = "Opcode (4 bits)";
        fieldLabel.classList.add("op-label");
      }
    } else {
      fieldLabel.textContent = fieldLabels[7 - i];
    }
    fieldLabelsRow.append(fieldLabel);
  }
  bitBreakdown.append(fieldLabelsRow);

  const bitGrid = document.createElement("div");
  bitGrid.className = "bit-grid";
  for (let i = 7; i >= 0; i--) {
    const bitPosition = document.createElement("div");
    bitPosition.className = "bit-position";
    bitPosition.textContent = `${i}`;
    bitGrid.append(bitPosition);
  }
  bitBreakdown.append(bitGrid);

  const bitValues = document.createElement("div");
  bitValues.className = "bit-values";
  const combinedByte = parseInt(element.details.combinedByte, 16);

  for (let i = 7; i >= 0; i--) {
    const bitValue = document.createElement("div");
    bitValue.className = "bit-value";
    const bit = (combinedByte >> i) & 1;
    bitValue.textContent = `${bit}`;
    bitValue.style.backgroundColor = bit ? "#0891b2" : "#374151";
    bitValues.append(bitValue);
  }
  bitBreakdown.append(bitValues);
  detailsContainer.append(bitBreakdown);

  return detailsContainer;
}

function createLengthDetails(element) {
  const detailsContainer = document.createElement("div");
  detailsContainer.className = "details-container";

  const lengthDetail = document.createElement("div");
  lengthDetail.className = "detail-item";

  if (element.kind === "extendedLength") {
    lengthDetail.textContent = `${element.details.payloadLength} bytes (${element.details.asBytes})`;
  } else {
    lengthDetail.textContent = `${element.details.payloadLength} bytes`;
  }

  detailsContainer.append(lengthDetail);
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

    if (element.details) {
      let details;

      if (element.details.closeCode) {
        details = createCloseCodeDetails(element);
      } else if (element.details.closeReason) {
        details = createCloseReasonDetails(element);
      } else if (element.details.payload) {
        details = createPayloadDetails(element);
      } else if (element.details.mask) {
        details = createMaskingKeyDetails(element);
      } else if (element.description.includes("Frame Header")) {
        details = createFrameHeaderDetails(element);
      } else {
        details = createLengthDetails(element);
      }

      section.append(details);
    }

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
    const op = parseInt(opSelect.value) || 1;
    const isClose = op === 8;
    const isData = op < 8;

    if (isData && text.length > 10000) {
      throw new Error(
        "Plaintext input is too long. Maximum length is 10,000 characters."
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
