class ExcelRowParser {
  static parseSheet(sheet, type, imageMap, required = []) {
    const MAX_ROWS = 500;
    const MAX_CELL_LENGTH = 500;
    const raw = require("xlsx").utils.sheet_to_json(sheet, { header: 1 });
    const headers = raw[0];
    const toCamelCase = ExcelRowParser.toCamelCase;
    const filteredRows = raw
      .slice(1)
      .filter((row) =>
        row.some((cell) => cell !== undefined && cell !== null && cell !== "")
      );

    if (filteredRows.length > MAX_ROWS) {
      throw new Error(
        `Demasiadas filas en la hoja (máx ${MAX_ROWS}, encontradas ${filteredRows.length})`
      );
    }
    filteredRows.forEach((row, rowIdx) => {
      row.forEach((cell, colIdx) => {
        if (typeof cell === "string" && cell.length > MAX_CELL_LENGTH) {
          throw new Error(
            `Celda demasiado larga en fila ${rowIdx + 2}, columna ${
              headers[colIdx]
            } (máx ${MAX_CELL_LENGTH} caracteres)`
          );
        }
      });
    });
    return filteredRows.map((row) => {
      const obj = {};
      headers.forEach((key, idx) => {
        let finalKey = toCamelCase(key);
        obj[finalKey] = row[idx];
      });
      if (type === "creature") {
        if (obj.attack < 0 || obj.attack > 10)
          throw new Error("Attack fuera de rango");
        if (obj.defense < 1 || obj.defense > 10)
          throw new Error("Defense fuera de rango");
        if (obj.health < 0 || obj.health > 200)
          throw new Error("Health fuera de rango");
        if (obj.magic < 0 || obj.magic > 200)
          throw new Error("Magic fuera de rango");
        if (obj.stamina < 0 || obj.stamina > 200)
          throw new Error("Stamina fuera de rango");
        if (obj.territory) {
          obj.territory =
            typeof obj.territory === "string"
              ? obj.territory.split(",").map((t) => t.trim())
              : Array.isArray(obj.territory)
              ? obj.territory
              : [];
        }
        if (obj.image) {
          if (imageMap && !imageMap[obj.image])
            throw new Error(`Imagen no encontrada en comprimido: ${obj.image}`);
          if (obj.image.length > 100)
            throw new Error(`Nombre de imagen demasiado largo: ${obj.image}`);
          obj.img = obj.image;
          delete obj.image;
        }
      }
      if (obj.cost < 0 || obj.cost > 10) throw new Error("Cost fuera de rango");
      for (const field of required) {
        if (obj[field] === undefined || obj[field] === "") {
          throw new Error(`Campo obligatorio faltante: ${field}`);
        }
      }
      return obj;
    });
  }
  static toCamelCase(str) {
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, i) =>
        i === 0 ? word.toLowerCase() : word.toUpperCase()
      )
      .replace(/\s+/g, "");
  }
}

module.exports = ExcelRowParser;
