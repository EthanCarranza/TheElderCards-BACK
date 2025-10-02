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
 * @param {string} creator - Nombre del creador que se mostrara en la carta.
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
  creator,
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
  const typeBarHeight = 32;
  const footerHeight = 68;
  const descY = imageHeight + titleBarHeight + typeBarHeight;
  const defenseHeight = 38; // Altura del recuadro de ataque/defensa
  const defenseMargin = 8; // Margen adicional para separación
  const availableDescHeight = Math.max(
    canvasHeight - border - descY - defenseHeight - defenseMargin,
    0
  );
  const descHeight = availableDescHeight; // Usar todo el espacio disponible
  const footerY = canvasHeight - border - footerHeight;
  const normalizedCreator =
    creator && creator !== "undefined" && creator.trim().length > 0
      ? creator.trim()
      : "Anónimo";

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

  // Franja del titulo
  ctx.save();
  ctx.fillStyle = "#c6c6c6";
  ctx.fillRect(border, imageHeight, canvasWidth - 2 * border, titleBarHeight);
  ctx.fillStyle = "#222";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title, canvasWidth / 2, imageHeight + titleBarHeight / 2);
  ctx.restore();

  // Franja del tipo
  ctx.save();
  ctx.fillStyle = "#dadada";
  ctx.fillRect(
    border,
    imageHeight + titleBarHeight,
    canvasWidth - 2 * border,
    typeBarHeight
  );
  ctx.fillStyle = "#333";
  ctx.font = "600 18px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    type,
    canvasWidth / 2,
    imageHeight + titleBarHeight + typeBarHeight / 2
  );
  ctx.restore();
  if (descHeight > 0) {
    ctx.save();
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(border, descY, canvasWidth - 2 * border, descHeight);
    ctx.fillStyle = "#333";
    ctx.font = "18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const lineHeight = 22;
    const descBoxWidth = canvasWidth - 2 * border - 32;
    const maxLines = Math.floor(descHeight / lineHeight);
    const lines = [];

    const words = description.split(" ");
    let currentLine = "";

    for (const word of words) {
      // Si la palabra es más larga que el ancho disponible, cortarla
      if (ctx.measureText(word).width > descBoxWidth) {
        // Si hay una línea actual, añadirla primero
        if (currentLine) {
          lines.push(currentLine);
          if (lines.length >= maxLines) break;
          currentLine = "";
        }

        // Cortar la palabra larga en pedazos
        let remainingWord = word;
        while (remainingWord && lines.length < maxLines) {
          let i = remainingWord.length;
          let chunk = remainingWord;

          // Reducir el tamaño del chunk hasta que quepa
          while (ctx.measureText(chunk).width > descBoxWidth && i > 0) {
            i--;
            chunk = remainingWord.substring(0, i);
          }

          if (i > 0) {
            lines.push(chunk);
            remainingWord = remainingWord.substring(i);
          } else {
            // Si ni siquiera un carácter cabe, forzar al menos uno
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

    // Dibujar las líneas centradas verticalmente
    const totalLines = Math.min(lines.length, maxLines);
    const totalTextHeight = totalLines * lineHeight;
    const fixedPadding = 16; // Padding fijo arriba y abajo
    const availableHeight = descHeight - fixedPadding * 2;
    const extraSpace = Math.max(availableHeight - totalTextHeight, 0);
    const startY = descY + fixedPadding + extraSpace / 2;

    lines.slice(0, maxLines).forEach((line, index) => {
      const y = startY + index * lineHeight;
      ctx.fillText(line, canvasWidth / 2, y);
    });
    ctx.restore();
  }
  // Pie con nombre del creador
  ctx.save();
  const footerLabelFont = 12;
  const footerNameFont = 14;
  const footerGap = 4;
  const footerPaddingBottom = 12;
  const footerBaseline = footerY + footerHeight - footerPaddingBottom;
  const footerLabel = "Created by:";
  const footerName = normalizedCreator;
  const footerLabelFontStr = "400 " + footerLabelFont + "px sans-serif";
  const footerNameFontStr = "600 " + footerNameFont + "px sans-serif";
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
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `${attack} / ${defense}`,
      rectX + rectW / 2,
      rectY + rectH / 2
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
