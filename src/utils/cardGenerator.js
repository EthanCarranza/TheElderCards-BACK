const sharp = require("sharp");
const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;

/**
 * Genera una carta vertical con marco de color, esquinas recortadas, imagen arriba, título-tipo, descripción y ataque/defensa si corresponde.
 * @param {string} inputImagePath - Ruta de la imagen subida
 * @param {string} title - Título de la carta
 * @param {string} type - Tipo de carta
 * @param {string} description - Descripción
 * @param {string} frameColor - Color del marco (ej: '#ff0000')
 * @param {number} [attack] - Valor de ataque (solo si type es 'Creature')
 * @param {number} [defense] - Valor de defensa (solo si type es 'Creature')
 * @returns {Promise<string>} Ruta del archivo de salida
 */
async function generateFramedImage(
  inputImagePath,
  title,
  type,
  cost,
  description,
  frameColor,
  attack,
  defense
) {
  // Tamaño estándar vertical
  const canvasWidth = 400;
  const canvasHeight = 600;
  const border = 12;
  const cutSize = 48;
  const imageHeight = Math.floor(canvasHeight / 2); // Ocupa la mitad de la carta
  const titleBarHeight = 56;
  const descHeight = 180;
  const descY = imageHeight + titleBarHeight;

  // Crear canvas
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext("2d");

  // Dibuja marco con esquinas recortadas
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

  // Fondo interior blanco
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

  // Imagen principal arriba
  const inputIsRemote =
    typeof inputImagePath === "string" && /^https?:\/\//.test(inputImagePath);
  let imageInput = inputImagePath;
  // Si es una URL remota, descargar como buffer
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
  // Recorte de la imagen superior con esquinas recortadas
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

  // Círculo de coste en la esquina superior izquierda
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
  ctx.font = "bold 28px sans-serif";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(cost), costX, costY);
  ctx.restore();

  // Franja título-tipo
  ctx.save();
  ctx.fillStyle = "#e0e0e0";
  ctx.fillRect(border, imageHeight, canvasWidth - 2 * border, titleBarHeight);
  ctx.fillStyle = "#222";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    `${title} - ${type}`,
    canvasWidth / 2,
    imageHeight + titleBarHeight / 2
  );
  ctx.restore();

  // Descripción
  ctx.save();
  ctx.fillStyle = "#f0f0f0";
  ctx.fillRect(border, descY, canvasWidth - 2 * border, descHeight);
  ctx.fillStyle = "#333";
  ctx.font = "18px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  // Ajustar texto multilinea centrado
  const words = description.split(" ");
  let line = "";
  let y = descY + 16;
  const lineHeight = 24;
  const descBoxWidth = canvasWidth - 2 * border - 24;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > descBoxWidth && n > 0) {
      ctx.fillText(line.trim(), canvasWidth / 2, y);
      line = words[n] + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), canvasWidth / 2, y);
  ctx.restore();

  // Ataque/defensa si es Creature
  if (type === "Creature" && attack !== undefined && defense !== undefined) {
    const rectW = 80,
      rectH = 38;
    ctx.save();
    ctx.fillStyle = "#222";
    ctx.globalAlpha = 0.85;
    ctx.fillRect(
      canvasWidth - border - rectW,
      canvasHeight - border - rectH,
      rectW,
      rectH
    );
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `${attack} / ${defense}`,
      canvasWidth - border - rectW / 2,
      canvasHeight - border - rectH / 2
    );
    ctx.restore();
  }

  // Guardar imagen temporalmente
  const outputDir = path.join("output");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
  const outputPath = path.join(outputDir, `${Date.now()}.png`);
  const out = fs.createWriteStream(outputPath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  await new Promise((resolve) => out.on("finish", resolve));

  // Subir a Cloudinary usando la misma configuracion que el resto del backend
  let cloudinaryUrl = null;
  try {
    const uploadResult = await cloudinary.uploader.upload(outputPath, {
      folder: "Cards",
      resource_type: "image",
    });
    cloudinaryUrl = uploadResult.secure_url;
  } catch (err) {
    console.error("Error subiendo a Cloudinary:", err);
    throw err;
  } finally {
    try {
      if (!inputIsRemote && typeof inputImagePath === "string") {
        await fs.promises.unlink(inputImagePath);
      }
    } catch (unlinkErr) {
      console.warn("No se pudo eliminar la imagen de entrada:", unlinkErr);
    }
    try {
      await fs.promises.unlink(outputPath);
    } catch (unlinkErr) {
      console.warn("No se pudo eliminar la imagen generada:", unlinkErr);
    }
  }

  return cloudinaryUrl;
}

module.exports = {
  generateFramedImage,
};
