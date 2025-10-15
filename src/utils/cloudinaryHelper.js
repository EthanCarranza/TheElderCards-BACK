const cloudinary = require("cloudinary").v2;

const extractPublicId = (imageUrl) => {
  try {
    if (!imageUrl) return null;

    const urlParts = imageUrl.split("/");
    const uploadIndex = urlParts.indexOf("upload");

    if (uploadIndex === -1 || uploadIndex + 2 >= urlParts.length) {
      return null;
    }

    const publicIdWithExtension = urlParts.slice(uploadIndex + 2).join("/");
    const publicId = publicIdWithExtension.split(".")[0]; // Eliminar extensión

    return publicId;
  } catch (error) {
    console.error("Error al extraer public_id de Cloudinary:", error);
    return null;
  }
};

const deleteImageFromCloudinary = async (imageUrl) => {
  try {
    const publicId = extractPublicId(imageUrl);

    if (!publicId) {
      console.warn("⚠️ No se pudo extraer public_id de la URL:", imageUrl);
      return false;
    }

    await cloudinary.uploader.destroy(publicId);
    console.log(`🗑️ Imagen eliminada de Cloudinary: ${publicId}`);
    return true;
  } catch (error) {
    console.error("❌ Error al eliminar imagen de Cloudinary:", error);
    return false;
  }
};

module.exports = {
  extractPublicId,
  deleteImageFromCloudinary,
};
