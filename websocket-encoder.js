export function newMask() {
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 256));
}

export function applyMask(payload, mask) {
  return payload.map((byte, index) => byte ^ mask[index % 4]);
}

export async function compressPayload(payload) {
  try {
    if (!payload || payload.length === 0) {
      return new Uint8Array(0);
    }

    if (typeof CompressionStream !== "undefined") {
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(payload);
          controller.close();
        },
      });

      const stream = new CompressionStream("deflate");
      const compressedStream = readable.pipeThrough(stream);
      const reader = compressedStream.getReader();

      const chunks = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const compressedLength = chunks.reduce(
        (total, chunk) => total + chunk.length,
        0
      );
      const compressed = new Uint8Array(compressedLength);
      let offset = 0;
      for (const chunk of chunks) {
        compressed.set(chunk, offset);
        offset += chunk.length;
      }

      return compressed;
    } else {
      const text = new TextDecoder().decode(payload);
      if (!text || text.length === 0) {
        return new Uint8Array(0);
      }

      let compressed = "";
      let count = 1;
      let current = text[0];

      for (let i = 1; i < text.length; i++) {
        if (text[i] === current) {
          count++;
        } else {
          if (count > 1) {
            compressed += count + current;
          } else {
            compressed += current;
          }
          current = text[i];
          count = 1;
        }
      }

      if (count > 1) {
        compressed += count + current;
      } else {
        compressed += current;
      }

      return new TextEncoder().encode(compressed);
    }
  } catch (error) {
    console.warn("Compression failed, using original payload:", error);
    return payload;
  }
}

export async function decompressPayload(compressedPayload) {
  try {
    if (typeof DecompressionStream !== "undefined") {
      const ds = new DecompressionStream("deflate");
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();

      await writer.write(compressedPayload);
      await writer.close();

      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const decompressedLength = chunks.reduce(
        (total, chunk) => total + chunk.length,
        0
      );
      const decompressed = new Uint8Array(decompressedLength);
      let offset = 0;
      for (const chunk of chunks) {
        decompressed.set(chunk, offset);
        offset += chunk.length;
      }

      return decompressed;
    } else {
      // Fallback
      return compressedPayload;
    }
  } catch (error) {
    console.warn("Decompression failed:", error);
    return compressedPayload;
  }
}

export function opName(op) {
  switch (op) {
    case 0x0:
      return "Continuation";
    case 0x1:
      return "Text";
    case 0x2:
      return "Binary";
    case 0x8:
      return "Close";
    case 0x9:
      return "Ping";
    case 0xa:
      return "Pong";
    default:
      return "Unknown";
  }
}

export function bytesToHex(bytes) {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

export async function getWebSocketFrameSections(options) {
  const {
    payload,
    opcode = 1,
    fin = true,
    rsv1 = false,
    rsv2 = false,
    rsv3 = false,
    masked = true,
    compressed = false,
    closeCode = null,
  } = options;

  if (!payload) {
    throw new Error("Payload is required");
  }

  if (payload.length > Number.MAX_SAFE_INTEGER) {
    throw new Error("Payload too large for JavaScript");
  }

  let finalPayload = payload;
  let compressionInfo = null;
  const isData = opcode === 0x1 || opcode === 0x2;

  if (compressed && isData) {
    const originalLength = payload.length;
    finalPayload = await compressPayload(payload);
    const compressedLength = finalPayload.length;

    compressionInfo = {
      originalLength,
      compressedLength,
      compressionRatio: (
        ((originalLength - compressedLength) / originalLength) *
        100
      ).toFixed(1),
    };
  }

  const frame = [];
  const frameSections = [];

  const finBit = fin ? 0x80 : 0x00;
  const rsv1Bit = rsv1 ? 0x40 : 0x00;
  const rsv2Bit = rsv2 ? 0x20 : 0x00;
  const rsv3Bit = rsv3 ? 0x10 : 0x00;
  const opcodeBits = opcode & 0x0f;

  frame.push(finBit | rsv1Bit | rsv2Bit | rsv3Bit | opcodeBits);
  frameSections.push({
    kind: "header",
    bytes: [finBit | rsv1Bit | rsv2Bit | rsv3Bit | opcodeBits],
    description: "Frame Header",
    details: {
      fin,
      rsv1,
      rsv2,
      rsv3,
      opcode,
      finBit: fin ? "1" : "0",
      rsv1Bit: rsv1 ? "1" : "0",
      rsv2Bit: rsv2 ? "1" : "0",
      rsv3Bit: rsv3 ? "1" : "0",
      opcodeBits: opcode.toString(2).padStart(4, "0"),
      opcodeName: opName(opcode),
      combinedByte: (finBit | rsv1Bit | rsv2Bit | rsv3Bit | opcodeBits)
        .toString(16)
        .padStart(2, "0"),
    },
  });

  const isControl = opcode >= 8;
  let secondByte = finalPayload.length;
  if (masked) secondByte |= 0x80;

  if (finalPayload.length < 126) {
    frame.push(secondByte);
    frameSections.push({
      kind: "length",
      bytes: [secondByte],
      description: "Payload Length",
      details: {
        masked,
        payloadLength: finalPayload.length,
        lengthBits: finalPayload.length.toString(2).padStart(7, "0"),
      },
    });
  } else if (finalPayload.length < 65536) {
    frame.push(126);
    frame.push((finalPayload.length >> 8) & 0xff);
    frame.push(finalPayload.length & 0xff);
    const lengthBytes = [
      (finalPayload.length >> 8) & 0xff,
      finalPayload.length & 0xff,
    ];
    frameSections.push({
      kind: "extendedLength",
      bytes: [126, ...lengthBytes],
      description: "Extended Payload Length (16 bits)",
      details: {
        masked,
        payloadLength: finalPayload.length,
        asBytes: bytesToHex(lengthBytes),
      },
    });
  } else {
    frame.push(127);
    const length = BigInt(finalPayload.length);
    const lengthBytes = [];
    for (let i = 7; i >= 0; i--) {
      const byte = Number((length >> BigInt(i * 8)) & 0xffn);
      frame.push(byte);
      lengthBytes.push(byte);
    }
    frameSections.push({
      kind: "extendedLength",
      bytes: [127, ...lengthBytes],
      description: isControl
        ? "Extended Control Frame Length (64-bit)"
        : "Extended Payload Length (64-bit)",
      details: {
        masked,
        payloadLength: finalPayload.length,
        asBytes: "64-bit",
      },
    });
  }

  let mask = null;
  if (masked) {
    mask = newMask();
    frame.push(...mask);
    frameSections.push({
      kind: "mask",
      bytes: mask,
      description: "Masking Key",
      details: {
        masked: true,
        mask: mask.map((b) => b.toString(16).padStart(2, "0")),
      },
    });
  }

  const isCloseFrame = opcode === 8;
  if ((!isControl || isCloseFrame) && finalPayload.length > 0) {
    let finalPayloadBytes = Array.from(finalPayload);
    if (masked) {
      finalPayloadBytes = applyMask(finalPayloadBytes, mask);
    }

    if (isCloseFrame && closeCode) {
      const closeCodeBytes = finalPayloadBytes.slice(0, 2);
      const reasonBytes = finalPayloadBytes.slice(2);

      frame.push(...closeCodeBytes);
      frameSections.push({
        kind: "closeCode",
        bytes: closeCodeBytes,
        originalBytes: Array.from(finalPayload.slice(0, 2)),
        description: "Close Code",
        details: {
          closeCode: true,
          closeCodeValue: closeCode,
          payloadLength: closeCodeBytes.length,
          masked,
        },
      });

      if (reasonBytes.length > 0) {
        frame.push(...reasonBytes);
        frameSections.push({
          kind: "closeReason",
          bytes: reasonBytes,
          originalBytes: Array.from(finalPayload.slice(2)),
          description: "Close Reason",
          details: {
            closeReason: true,
            payloadLength: reasonBytes.length,
            originalBytes: Array.from(payload.slice(2)),
            masked,
          },
        });
      }
    } else {
      frame.push(...finalPayloadBytes);
      frameSections.push({
        kind: "payload",
        bytes: finalPayloadBytes,
        originalBytes: Array.from(finalPayload),
        description: "Payload",
        details: {
          payload: true,
          payloadLength: finalPayloadBytes.length,
          originalLength: payload.length,
          originalBytes: Array.from(payload),
          masked,
          compressionInfo,
        },
      });
    }
  } else if (isControl) {
    // For control frames, ensure no payload bytes are added to the frame
    // The frame should end after the masking key (if present)
  }

  return {
    frame,
    frameSections,
    details: {
      fin,
      rsv1,
      rsv2,
      rsv3,
      opcode,
      masked,
      mask,
      payloadLength: finalPayload.length,
      originalPayloadLength: payload.length,
      compressed: compressed && opcode === 1,
    },
  };
}
