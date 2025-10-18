const sharp = require("sharp");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");
const { uploadImageToCloudinary } = require("./cloudinaryHelper");

const FONT_FAMILY = "Cyrodiil";
const FONT_FILES = ["Cyrodiil.otf", "Cyrodiil-Bold.otf"];

let fontRegistered = false;
const missingFontFiles = [];

for (const fontFile of FONT_FILES) {
  const fontPath = path.join(__dirname, "..", "..", "fonts", fontFile);
  if (!fs.existsSync(fontPath)) {
    missingFontFiles.push(fontPath);
    continue;
  }

  const registered = GlobalFonts.registerFromPath(fontPath, FONT_FAMILY);
  if (registered) {
    fontRegistered = true;
  } else {
    console.warn(`GlobalFonts failed to register Cyrodiil font at ${fontPath}`);
  }
}

if (missingFontFiles.length) {
  console.warn(
    `Cyrodiil font files not found at: ${missingFontFiles.join(", ")}`
  );
}

if (!fontRegistered) {
  console.warn("Unable to register any Cyrodiil font variant.");
}

async function generateFramedImage(
  inputImagePath,
  title,
  type,
  cost,
  description,
  frameColor,
  creator,
  attack,
  defense
) {
  const canvasWidth = 400;
  const canvasHeight = 600;
  const border = 12;
  const cutSize = 48;
  const imageHeight = Math.floor(canvasHeight / 2);
  const titleBarHeight = 56;
  const typeBarHeight = 32;
  const footerHeight = 68;
  const descY = imageHeight + titleBarHeight + typeBarHeight;
  const defenseHeight = 38;
  const defenseMargin = 8;
  const availableDescHeight = Math.max(
    canvasHeight - border - descY - defenseHeight - defenseMargin,
    0
  );
  const descHeight = availableDescHeight;
  const footerY = canvasHeight - border - footerHeight;
  const normalizedCreator =
    creator && creator !== "undefined" && creator.trim().length > 0
      ? creator.trim()
      : "Anónimo";

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext("2d");

  // Esquinas recortadas
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(canvasWidth - cutSize, 0);
  ctx.lineTo(canvasWidth, cutSize);
  ctx.lineTo(canvasWidth, canvasHeight);
  ctx.lineTo(cutSize, canvasHeight);
  ctx.lineTo(0, canvasHeight - cutSize);
  ctx.closePath();
  ctx.fillStyle = frameColor;
  ctx.fill();
  ctx.restore();

  // Fondo interior
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(border, border);
  ctx.lineTo(canvasWidth - cutSize, border);
  ctx.lineTo(canvasWidth - border, cutSize);
  ctx.lineTo(canvasWidth - border, canvasHeight - border);
  ctx.lineTo(cutSize, canvasHeight - border);
  ctx.lineTo(border, canvasHeight - cutSize);
  ctx.closePath();
  ctx.fillStyle = "#f0f0f0";
  ctx.fill();
  ctx.restore();

  // Imagen principal
  const inputIsRemote =
    typeof inputImagePath === "string" && /^https?:\/\//.test(inputImagePath);
  let imageInput = inputImagePath;

  if (inputIsRemote) {
    const axios = require("axios");
    const response = await axios({
      url: inputImagePath,
      responseType: "arraybuffer",
    });
    imageInput = Buffer.from(response.data, "binary");
  }
  const resizedImage = await sharp(imageInput)
    .resize({
      width: canvasWidth - 2 * border,
      height: imageHeight,
      fit: "cover",
    })
    .toBuffer();
  const img = await loadImage(resizedImage);
  // Recorte de la imagen con esquinas recortadas
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(border, border);
  ctx.lineTo(canvasWidth - cutSize, border);
  ctx.lineTo(canvasWidth - border, cutSize);
  ctx.lineTo(canvasWidth - border, imageHeight + border);
  ctx.lineTo(cutSize, imageHeight + border);
  ctx.lineTo(border, imageHeight + cutSize);
  ctx.closePath();
  ctx.clip();
  const imgX = border;
  const imgY =
    Math.floor(
      (imageHeight - (canvasWidth - 2 * border) * (img.height / img.width)) / 2
    ) + border;
  const drawWidth = canvasWidth - 2 * border;
  ctx.drawImage(img, imgX, imgY, drawWidth, imageHeight);
  ctx.restore();

  // Coste
  ctx.save();
  const costRadius = 28;
  const extraMargin = 2;
  const costX = border + costRadius + extraMargin;
  const costY = border + costRadius + extraMargin;
  ctx.beginPath();
  ctx.arc(costX, costY, costRadius, 0, 2 * Math.PI);
  ctx.fillStyle = "#222";
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.font = `bold 28px "${FONT_FAMILY}"`;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(cost), costX, costY);
  ctx.restore();

  // Titulo
  ctx.save();
  ctx.fillStyle = "#c6c6c6";
  ctx.fillRect(border, imageHeight, canvasWidth - 2 * border, titleBarHeight);
  ctx.fillStyle = "#222";
  ctx.font = `bold 24px "${FONT_FAMILY}"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title, canvasWidth / 2, imageHeight + titleBarHeight / 2);
  ctx.restore();

  // Tipo
  ctx.save();
  ctx.fillStyle = "#dadada";
  ctx.fillRect(
    border,
    imageHeight + titleBarHeight,
    canvasWidth - 2 * border,
    typeBarHeight
  );
  ctx.fillStyle = "#333";
  ctx.font = `600 18px "${FONT_FAMILY}"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    type,
    canvasWidth / 2,
    imageHeight + titleBarHeight + typeBarHeight / 2
  );
  ctx.restore();

  // Descripción
  if (descHeight > 0) {
    ctx.save();
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(border, descY, canvasWidth - 2 * border, descHeight);
    ctx.fillStyle = "#333";
    ctx.font = `18px "${FONT_FAMILY}"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const lineHeight = 22;
    const descBoxWidth = canvasWidth - 2 * border - 32;
    const maxLines = Math.floor(descHeight / lineHeight);
    const lines = [];

    const words = description.split(" ");
    let currentLine = "";

    for (const word of words) {
      if (ctx.measureText(word).width > descBoxWidth) {
        if (currentLine) {
          lines.push(currentLine);
          if (lines.length >= maxLines) break;
          currentLine = "";
        }

        let remainingWord = word;
        while (remainingWord && lines.length < maxLines) {
          let i = remainingWord.length;
          let chunk = remainingWord;

          while (ctx.measureText(chunk).width > descBoxWidth && i > 0) {
            i--;
            chunk = remainingWord.substring(0, i);
          }

          if (i > 0) {
            lines.push(chunk);
            remainingWord = remainingWord.substring(i);
          } else {
            lines.push(remainingWord[0]);
            remainingWord = remainingWord.substring(1);
          }
        }
      } else {
        const testLine = currentLine + (currentLine ? " " : "") + word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width <= descBoxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            lines.push(currentLine);
            if (lines.length >= maxLines) break;
          }
          currentLine = word;
        }
      }
    }

    if (currentLine && lines.length < maxLines) {
      lines.push(currentLine);
    }

    const totalLines = Math.min(lines.length, maxLines);
    const totalTextHeight = totalLines * lineHeight;
    const fixedPadding = 16;
    const availableHeight = descHeight - fixedPadding * 2;
    const extraSpace = Math.max(availableHeight - totalTextHeight, 0);
    const startY = descY + fixedPadding + extraSpace / 2;

    lines.slice(0, maxLines).forEach((line, index) => {
      const y = startY + index * lineHeight;
      ctx.fillText(line, canvasWidth / 2, y);
    });
    ctx.restore();
  }
  // Nombre del creador
  ctx.save();
  const footerLabelFont = 12;
  const footerNameFont = 14;
  const footerGap = 4;
  const footerPaddingBottom = 12;
  const footerBaseline = footerY + footerHeight - footerPaddingBottom;
  const footerLabel = "Created by:";
  const footerName = normalizedCreator;
  const footerLabelFontStr = `400 ${footerLabelFont}px "${FONT_FAMILY}"`;
  const footerNameFontStr = `600 ${footerNameFont}px "${FONT_FAMILY}"`;
  ctx.fillStyle = "#222";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = footerLabelFontStr;
  const labelWidth = ctx.measureText(footerLabel).width;
  ctx.font = footerNameFontStr;
  const nameWidth = ctx.measureText(footerName).width;
  const totalWidth = labelWidth + footerGap + nameWidth;
  const footerStartX = (canvasWidth - totalWidth) / 2;
  ctx.font = footerLabelFontStr;
  ctx.fillText(footerLabel, footerStartX, footerBaseline);
  ctx.font = footerNameFontStr;
  ctx.fillText(
    footerName,
    footerStartX + labelWidth + footerGap,
    footerBaseline
  );
  ctx.restore();

  // Ataque/defensa si es Creature
  if (type === "Creature" && attack !== undefined && defense !== undefined) {
    const rectW = 80;
    const rectH = 38;
    const rectX = canvasWidth - border - rectW;
    const rectY = canvasHeight - border - rectH;
    ctx.save();
    ctx.fillStyle = "#222";
    ctx.globalAlpha = 0.85;
    ctx.fillRect(rectX, rectY, rectW, rectH);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff";
    ctx.font = `bold 20px "${FONT_FAMILY}"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `${attack} / ${defense}`,
      rectX + rectW / 2,
      rectY + rectH / 2
    );
    ctx.restore();
  }

  const pngBuffer = await canvas.encode("png");
  let cloudinaryUrl = null;
  try {
    const base64Image = `data:image/png;base64,${pngBuffer.toString("base64")}`;
    cloudinaryUrl = await uploadImageToCloudinary(base64Image, {
      folder: "Cards",
      resource_type: "image",
    });
  } catch (error) {
    console.error(
      `Error subiendo imagen ${pngBuffer.img} a Cloudinary:`,
      error
    );
    throw error;
  }
  return cloudinaryUrl;
}

module.exports = {
  generateFramedImage,
};
