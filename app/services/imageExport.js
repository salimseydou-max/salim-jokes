function wrapText(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (let i = 0; i < words.length; i += 1) {
    const candidate = line ? `${line} ${words[i]}` : words[i];
    const width = ctx.measureText(candidate).width;
    if (width > maxWidth && line) {
      lines.push(line);
      line = words[i];
      continue;
    }
    line = candidate;
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}

function sanitizeFilename(value) {
  return String(value || "joke")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "joke";
}

function interleaveHandle(text, handle = "lolwith_salim") {
  const sentences = String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!sentences.length) {
    return "";
  }
  if (sentences.length === 1) {
    return `${sentences[0]} @${handle}`;
  }
  return sentences.join(` @${handle} `);
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function exportJokeAsImage(joke) {
  const text = String(joke?.text || "").trim();
  if (!text) {
    throw new Error("No joke content to export.");
  }
  const handle = "lolwith_salim";
  const enhancedText = interleaveHandle(text, handle);

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not available.");
  }

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#1b2f55");
  gradient.addColorStop(0.58, "#102038");
  gradient.addColorStop(1, "#0c1629");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const emojiPattern = ["😂", "🤣", "😎", "🤪", "😆", "😹"];
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "500 56px Inter, Segoe UI Emoji, Arial";
  ctx.globalAlpha = 0.1;
  for (let y = 120; y <= canvas.height - 80; y += 160) {
    for (let x = 100; x <= canvas.width - 80; x += 150) {
      const index = Math.floor((x + y) / 130) % emojiPattern.length;
      ctx.fillText(emojiPattern[index], x, y);
    }
  }
  ctx.globalAlpha = 1;

  drawRoundedRect(ctx, 72, 72, canvas.width - 144, canvas.height - 144, 36);
  ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
  ctx.stroke();

  ctx.fillStyle = "#f8fafc";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "700 52px Inter, Segoe UI, Arial";
  ctx.fillText("😂 Voice Joke Club 🤣", 116, 172);

  ctx.fillStyle = "rgba(226, 232, 240, 0.92)";
  ctx.font = "500 30px Inter, Segoe UI, Arial";
  ctx.fillText("Fun logos • clean style • share your laugh", 116, 222);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "600 42px Inter, Segoe UI, Arial";
  const lines = wrapText(ctx, enhancedText, canvas.width - 232);
  const startY = 320;
  const lineHeight = 52;
  const maxLines = 10;
  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > maxLines && visibleLines.length) {
    visibleLines[visibleLines.length - 1] = `${visibleLines[visibleLines.length - 1]}...`;
  }
  for (let i = 0; i < visibleLines.length; i += 1) {
    ctx.fillText(visibleLines[i], 116, startY + i * lineHeight);
  }

  ctx.fillStyle = "rgba(56, 189, 248, 0.98)";
  ctx.font = "700 36px Inter, Segoe UI, Arial";
  ctx.fillText(`Follow me @${handle}`, 116, canvas.height - 128);

  ctx.fillStyle = "rgba(226, 232, 240, 0.88)";
  ctx.font = "500 28px Inter, Segoe UI, Arial";
  ctx.fillText(`Share it with friends • @${handle}`, 116, canvas.height - 82);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  if (!blob) {
    throw new Error("Image export failed.");
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitizeFilename(text.slice(0, 36))}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 500);
}
