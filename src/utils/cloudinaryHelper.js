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
    const publicId = publicIdWithExtension.split(".")[0];

    return publicId;
  } catch (error) {
    console.error("Error al extraer public_id de Cloudinary:", error);
    return null;
  }
};

const getImagesInFolder = async (folder, maxResults) => {
  try {
    const { resources } = await cloudinary.api.resources({
      type: "upload",
      prefix: folder,
      max_results: maxResults,
    });
    return resources;
  } catch (error) {
    console.error(`Error al obtener imágenes en folder ${folder}:`, error);
    return [];
  }
};

const uploadImageToCloudinary = async (base64Image, options = {}) => {
  try {
    const uploadResult = await cloudinary.uploader.upload(base64Image, options);
    return uploadResult.secure_url;
  } catch (error) {
    console.error("Error subiendo imagen a Cloudinary:", error);
    throw error;
  }
};

const renameImageInCloudinary = async (publicId, newPublicId) => {
  try {
    await cloudinary.uploader.rename(publicId, newPublicId);
    console.log(
      `Imagen renombrada en Cloudinary: ${publicId} -> ${newPublicId}`
    );
    return true;
  } catch (error) {
    console.error(
      `Error al renombrar imagen en Cloudinary (${publicId} -> ${newPublicId}):`,
      error
    );
    return false;
  }
};

const deleteImageFromCloudinary = async (imageUrl) => {
  try {
    const publicId = extractPublicId(imageUrl);

    if (!publicId) {
      console.warn("No se pudo extraer public_id de la URL:", imageUrl);
      return false;
    }

    await cloudinary.uploader.destroy(publicId);
    console.log(`Imagen eliminada de Cloudinary: ${publicId}`);
    return true;
  } catch (error) {
    console.error("Error al eliminar imagen de Cloudinary:", error);
    return false;
  }
};

module.exports = {
  extractPublicId,
  deleteImageFromCloudinary,
  renameImageInCloudinary,
  getImagesInFolder,
  uploadImageToCloudinary,
};
