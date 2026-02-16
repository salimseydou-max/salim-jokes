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

export async function exportJokeAsImage(joke) {
  const text = String(joke?.text || "").trim();
  if (!text) {
    throw new Error("No joke content to export.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not available.");
  }

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#1d3358");
  gradient.addColorStop(0.52, "#14223f");
  gradient.addColorStop(1, "#0f172a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(56, 189, 248, 0.14)";
  ctx.fillRect(64, 64, canvas.width - 128, canvas.height - 128);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "600 56px Inter, Segoe UI, Arial";
  ctx.fillText("Voice Joke Club", 96, 140);

  ctx.font = "500 44px Inter, Segoe UI, Arial";
  const lines = wrapText(ctx, text, canvas.width - 192);
  const startY = 280;
  const lineHeight = 62;
  const maxLines = 14;
  for (let i = 0; i < Math.min(lines.length, maxLines); i += 1) {
    ctx.fillText(lines[i], 96, startY + i * lineHeight);
  }

  ctx.fillStyle = "rgba(195, 207, 223, 0.9)";
  ctx.font = "400 34px Inter, Segoe UI, Arial";
  ctx.fillText("Share the laugh | voicejokeclub", 96, canvas.height - 120);

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
