function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function parseJsonText(raw) {
  if (typeof raw !== "string") {
    return {};
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }
  try {
    const parsed = JSON.parse(trimmed);
    return isPlainObject(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

async function readWebStreamBody(stream) {
  if (!stream || typeof stream.getReader !== "function") {
    return "";
  }

  const reader = stream.getReader();
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(value instanceof Uint8Array ? value : new Uint8Array(value));
      }
    }
  } catch (error) {
    return "";
  } finally {
    try {
      reader.releaseLock();
    } catch (error) {
      // Ignore lock release failures.
    }
  }

  if (!chunks.length) {
    return "";
  }
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.length;
  });
  return new TextDecoder().decode(merged);
}

async function readNodeStreamBody(req) {
  if (!req || typeof req[Symbol.asyncIterator] !== "function") {
    return "";
  }
  const chunks = [];
  try {
    for await (const chunk of req) {
      if (!chunk) {
        continue;
      }
      if (typeof chunk === "string") {
        chunks.push(Buffer.from(chunk));
      } else if (chunk instanceof Uint8Array) {
        chunks.push(Buffer.from(chunk));
      } else {
        chunks.push(Buffer.from(String(chunk)));
      }
    }
  } catch (error) {
    return "";
  }
  if (!chunks.length) {
    return "";
  }
  return Buffer.concat(chunks).toString("utf8");
}

export default async function parseBody(req) {
  const body = req?.body;

  if (isPlainObject(body)) {
    return body;
  }
  if (typeof body === "string") {
    return parseJsonText(body);
  }
  if (Buffer.isBuffer(body)) {
    return parseJsonText(body.toString("utf8"));
  }
  if (body instanceof Uint8Array) {
    return parseJsonText(Buffer.from(body).toString("utf8"));
  }
  if (body && typeof body.getReader === "function") {
    const streamText = await readWebStreamBody(body);
    return parseJsonText(streamText);
  }

  const rawBody = req?.rawBody;
  if (typeof rawBody === "string") {
    return parseJsonText(rawBody);
  }
  if (Buffer.isBuffer(rawBody)) {
    return parseJsonText(rawBody.toString("utf8"));
  }
  if (rawBody instanceof Uint8Array) {
    return parseJsonText(Buffer.from(rawBody).toString("utf8"));
  }

  const streamText = await readNodeStreamBody(req);
  if (streamText) {
    return parseJsonText(streamText);
  }
  return {};
}
