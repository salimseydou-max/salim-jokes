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

function clampLines(lines, maxLines) {
  const limited = Array.isArray(lines) ? lines.slice(0, maxLines) : [];
  if (Array.isArray(lines) && lines.length > maxLines && limited.length) {
    limited[limited.length - 1] = `${limited[limited.length - 1].replace(/\.*$/, "")}...`;
  }
  return limited;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildJokeTextWithInlineCredit(text, handle) {
  const watermark = `@${handle}`;
  const cleaned = String(text || "")
    .replace(new RegExp(`(?:\\s|^)@?${escapeRegExp(handle)}\\b`, "gi"), " ")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!sentences.length) {
    return watermark;
  }
  if (sentences.length === 1) {
    return `${sentences[0]} ${watermark}`.trim();
  }
  return `${sentences[0]} ${watermark} ${sentences.slice(1).join(" ")}`.trim();
}

function drawLineWithInlineCredit(ctx, line, x, y, options = {}) {
  const token = String(options.token || "").trim();
  const textFont = String(options.textFont || "");
  const watermarkFont = String(options.watermarkFont || "");
  const textColor = String(options.textColor || "#f8fafc");
  const watermarkColor = String(options.watermarkColor || "rgba(226, 232, 240, 0.46)");
  const creditAlreadyDrawn = Boolean(options.creditAlreadyDrawn);

  if (!token || creditAlreadyDrawn || !String(line || "").includes(token)) {
    ctx.fillStyle = textColor;
    ctx.font = textFont;
    ctx.fillText(line, x, y);
    return creditAlreadyDrawn;
  }

  const tokenIndex = line.indexOf(token);
  const before = line.slice(0, tokenIndex);
  const after = line.slice(tokenIndex + token.length);

  ctx.fillStyle = textColor;
  ctx.font = textFont;
  if (before) {
    ctx.fillText(before, x, y);
  }
  const beforeWidth = ctx.measureText(before).width;

  ctx.fillStyle = watermarkColor;
  ctx.font = watermarkFont;
  ctx.fillText(token, x + beforeWidth, y);
  const tokenWidth = ctx.measureText(token).width;

  ctx.fillStyle = textColor;
  ctx.font = textFont;
  if (after) {
    ctx.fillText(after, x + beforeWidth + tokenWidth, y);
  }

  return true;
}

function drawSocialBadge(ctx, config = {}) {
  const x = Number(config.x) || 0;
  const y = Number(config.y) || 0;
  const width = Number(config.width) || 188;
  const height = Number(config.height) || 60;
  const label = String(config.label || "");
  const icon = String(config.icon || "");
  const iconBg = String(config.iconBg || "#0f172a");
  const iconColor = String(config.iconColor || "#f8fafc");
  const chipBg = String(config.chipBg || "rgba(2, 6, 23, 0.62)");
  const chipStroke = String(config.chipStroke || "rgba(148, 163, 184, 0.22)");

  drawRoundedRect(ctx, x, y, width, height, 20);
  ctx.fillStyle = chipBg;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = chipStroke;
  ctx.stroke();

  const iconRadius = 19;
  const iconCx = x + 27;
  const iconCy = y + height / 2;
  ctx.beginPath();
  ctx.arc(iconCx, iconCy, iconRadius, 0, Math.PI * 2);
  ctx.fillStyle = iconBg;
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = iconColor;
  ctx.font = "700 22px Inter, Segoe UI Symbol, Arial";
  ctx.fillText(icon, iconCx, iconCy + 1);

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(248, 250, 252, 0.95)";
  ctx.font = "600 23px Inter, Segoe UI, Arial";
  ctx.fillText(label, x + 54, y + height / 2 + 1);
}

function drawSocialLogosRow(ctx, canvasWidth, y) {
  const badges = [
    {
      label: "TikTok",
      icon: "♪",
      iconBg: "#0b0f1a",
      iconColor: "#25f4ee",
      chipStroke: "rgba(236, 72, 153, 0.45)",
    },
    {
      label: "X",
      icon: "X",
      iconBg: "#020617",
      iconColor: "#f8fafc",
      chipStroke: "rgba(148, 163, 184, 0.4)",
    },
    {
      label: "WhatsApp",
      icon: "☎",
      iconBg: "#22c55e",
      iconColor: "#ecfdf5",
      chipStroke: "rgba(34, 197, 94, 0.45)",
    },
    {
      label: "Instagram",
      icon: "◎",
      iconBg: "#d946ef",
      iconColor: "#ffffff",
      chipStroke: "rgba(244, 114, 182, 0.46)",
    },
  ];
  const badgeWidth = 188;
  const badgeHeight = 60;
  const gap = 14;
  const totalWidth = badges.length * badgeWidth + (badges.length - 1) * gap;
  const startX = Math.round((canvasWidth - totalWidth) / 2);
  for (let i = 0; i < badges.length; i += 1) {
    drawSocialBadge(ctx, {
      ...badges[i],
      x: startX + i * (badgeWidth + gap),
      y,
      width: badgeWidth,
      height: badgeHeight,
    });
  }
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
  const watermark = `@${handle}`;
  const displayText = buildJokeTextWithInlineCredit(text, handle);

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

  const textFont = "600 42px Inter, Segoe UI, Arial";
  const watermarkFont = "600 24px Inter, Segoe UI, Arial";
  const textWidth = canvas.width - 232;
  const startY = 286;
  const lineHeight = 52;
  const textBottomLimit = canvas.height - 258;
  const maxLines = Math.max(4, Math.floor((textBottomLimit - startY) / lineHeight));

  ctx.font = textFont;
  const wrappedLines = wrapText(ctx, displayText, textWidth);
  const visibleLines = clampLines(wrappedLines, maxLines);
  let creditDrawn = false;
  for (let i = 0; i < visibleLines.length; i += 1) {
    creditDrawn = drawLineWithInlineCredit(ctx, visibleLines[i], 116, startY + i * lineHeight, {
      token: watermark,
      textFont,
      watermarkFont,
      textColor: "#f8fafc",
      watermarkColor: "rgba(226, 232, 240, 0.52)",
      creditAlreadyDrawn: creditDrawn,
    });
  }

  if (!creditDrawn) {
    const fallbackY = Math.min(startY + visibleLines.length * lineHeight + 6, textBottomLimit - 6);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(226, 232, 240, 0.52)";
    ctx.font = watermarkFont;
    ctx.fillText(watermark, 116, fallbackY);
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(56, 189, 248, 0.98)";
  ctx.font = "700 34px Inter, Segoe UI, Arial";
  ctx.fillText(`Follow me @${handle}`, 116, canvas.height - 172);

  ctx.save();
  drawSocialLogosRow(ctx, canvas.width, canvas.height - 138);
  ctx.restore();

  /*
   * Keep a subtle embedded stamp near the border so ownership remains in exported
   * images even if people crop UI sections.
   */
  ctx.save();
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.font = watermarkFont;
  ctx.fillStyle = "rgba(226, 232, 240, 0.36)";
  ctx.fillText(watermark, canvas.width - 92, canvas.height - 30);
  ctx.restore();

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
