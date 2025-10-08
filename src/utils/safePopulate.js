const mongoose = require("mongoose");

const DELETED_USER_PLACEHOLDER = {
  _id: "000000000000000000000000", // ObjectId válido pero ficticio
  username: "Usuario eliminado",
  email: "usuario@eliminado.com",
  image: "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_640.png"
};

const safePopulateUser = (field = 'creator', select = 'username email image') => {
  return {
    path: field,
    select: select,
    options: { 
      strictPopulate: false // Permite populate fallido
    }
  };
};

const applySafePopulate = async (query, populateConfig) => {
  try {
    const result = await query.populate(populateConfig);
    
    const processDoc = (doc) => {
      if (!doc) return doc;
      
      const fieldName = populateConfig.path;
      const fieldValue = doc[fieldName];
      
      if (fieldValue === null || fieldValue === undefined) {
        doc[fieldName] = DELETED_USER_PLACEHOLDER;
      } else if (mongoose.Types.ObjectId.isValid(fieldValue) && 
                 typeof fieldValue === 'object' && 
                 !fieldValue.username && 
                 !fieldValue._id) {
        doc[fieldName] = DELETED_USER_PLACEHOLDER;
      }
      
      return doc;
    };
    
    if (Array.isArray(result)) {
      return result.map(processDoc);
    } else {
      return processDoc(result);
    }
    
  } catch (error) {
    console.warn(`Safe populate failed for ${populateConfig.path}:`, error.message);
    
    let result;
    try {
      result = await query.clone().exec(); // Usar clone() para evitar "already executed"
    } catch (execError) {
      console.error(`Failed to execute cloned query:`, execError.message);
      try {
        result = await query.exec();
      } catch (originalError) {
        console.error(`Failed to execute original query:`, originalError.message);
        throw originalError;
      }
    }
    
    const addPlaceholder = (doc) => {
      if (doc && populateConfig.path) {
        doc[populateConfig.path] = DELETED_USER_PLACEHOLDER;
      }
      return doc;
    };
    
    if (Array.isArray(result)) {
      return result.map(addPlaceholder);
    } else if (result) {
      return addPlaceholder(result);
    }
    
    return result;
  }
};

const safePopulate = async (query, populateOptions) => {
  try {
    return await query.populate(populateOptions);
  } catch (error) {
    console.warn("Populate failed, using safe populate:", error.message);
    
    const docs = await query.exec();
    
    if (Array.isArray(docs)) {
      docs.forEach(doc => {
        if (populateOptions.path && !doc[populateOptions.path]) {
          doc[populateOptions.path] = DELETED_USER_PLACEHOLDER;
        }
      });
    } else if (docs && populateOptions.path && !docs[populateOptions.path]) {
      docs[populateOptions.path] = DELETED_USER_PLACEHOLDER;
    }
    
    return docs;
  }
};

const cleanupOrphanedReferences = async (Model, userField = 'creator') => {
  try {
    // Verificar si el modelo User está registrado
    let User;
    try {
      User = mongoose.model('users');
    } catch (error) {
      console.warn('User model not found:', error.message);
      return 0;
    }
    
    const docs = await Model.find({});
    const orphanedDocs = [];
    
    for (const doc of docs) {
      const userId = doc[userField];
      if (userId) {
        const userExists = await User.findById(userId);
        if (!userExists) {
          orphanedDocs.push(doc._id);
        }
      }
    }
    
    if (orphanedDocs.length > 0) {
      
      await Model.updateMany(
        { _id: { $in: orphanedDocs } }, 
        { $unset: { [userField]: 1 } }
      );
      
      console.log(`Limpieza completada: ${orphanedDocs.length} documentos actualizados en ${Model.modelName}`);
    }
    
    return orphanedDocs.length;
  } catch (error) {
    console.error(`Error limpiando referencias huérfanas en ${Model.modelName}:`, error);
    return 0;
  }
};

const applySafePopulateMultiple = async (query) => {
  try {
    const result = await query.exec();
    
    const processDoc = (doc) => {
      if (!doc) return doc;
      
      const userFields = ['creator', 'user', 'requester', 'recipient', 'owner', 'author', 'createdBy', 'updatedBy'];
      
      userFields.forEach(field => {
        if (doc[field] === null || doc[field] === undefined) {
          doc[field] = DELETED_USER_PLACEHOLDER;
        }
      });
      
      return doc;
    };
    
    if (Array.isArray(result)) {
      return result.map(processDoc);
    } else {
      return processDoc(result);
    }
    
  } catch (error) {
    console.warn('Safe populate multiple failed:', error.message);
    throw error;
  }
};

module.exports = {
  safePopulateUser,
  safePopulate,
  applySafePopulate,
  applySafePopulateMultiple,
  cleanupOrphanedReferences,
  DELETED_USER_PLACEHOLDER
};