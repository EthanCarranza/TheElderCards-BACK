const { HTTP_RESPONSES, HTTP_MESSAGES } = require("../models/httpResponses");
const Collection = require("../models/collection");
const CollectionInteraction = require("../models/collectionInteraction");
const mongoose = require("mongoose");
const { DELETED_USER_PLACEHOLDER } = require("../../utils/safePopulate");

const isOwner = (creatorId, userId) => {
  if (!creatorId || !userId) return false;

  const normalizeId = (id) => {
    if (!id) return "";
    if (typeof id === "string") return id;
    if (id.toString) return id.toString();
    if (id._id) return id._id.toString();
    return String(id);
  };

  const creatorIdStr = normalizeId(creatorId);
  const userIdStr = normalizeId(userId);

  return creatorIdStr === userIdStr && creatorIdStr !== "";
};

const getCollections = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort,
      user: userId,
      favorites,
      liked,
      myCollections,
      ...filters
    } = req.query;

    const query = { isPrivate: false };

    if (filters.title) query.title = { $regex: filters.title, $options: "i" };
    if (filters.creator) {
      const User = require("../models/user");
      const users = await User.find({
        $or: [
          { username: { $regex: filters.creator, $options: "i" } },
          { email: { $regex: filters.creator, $options: "i" } },
        ],
      }).select("_id");

      if (users.length > 0) {
        query.creator = { $in: users.map((u) => u._id) };
      } else {
        return res.status(HTTP_RESPONSES.OK).json({
          collections: [],
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0,
        });
      }
    }

    let collectionIds = null;
    if (favorites === "true" && userId) {
      const favoriteInteractions = await CollectionInteraction.find({
        userId,
        favorited: true,
      }).select("collectionId");
      collectionIds = favoriteInteractions.map(
        (interaction) => interaction.collectionId
      );
    }

    if (liked === "true" && userId) {
      const likedInteractions = await CollectionInteraction.find({
        userId,
        liked: true,
      }).select("collectionId");
      const likedIds = likedInteractions.map(
        (interaction) => interaction.collectionId
      );

      if (collectionIds) {
        collectionIds = collectionIds.filter((id) =>
          likedIds.some((likedId) => likedId.toString() === id.toString())
        );
      } else {
        collectionIds = likedIds;
      }
    }

    if (myCollections === "true" && userId) {
      query.creator = userId;
    }

    if (collectionIds !== null) {
      query._id = { $in: collectionIds };
    }

    if (req.user) {
      const Friendship = require("../models/friendship");
      const blockingRelationships = await Friendship.find({
        $or: [
          { recipient: req.user._id, status: "blocked" },
          { requester: req.user._id, status: "blocked" },
        ],
      }).select("requester recipient");
      const blockingUserIds = blockingRelationships.map((rel) =>
        rel.requester.toString() === req.user._id.toString()
          ? rel.recipient
          : rel.requester
      );
      query.$or = [
        { isPrivate: false, creator: { $nin: blockingUserIds } },
        { isPrivate: true, creator: req.user._id },
      ];
      delete query.isPrivate;
    }

    let sortObj = {};
    if (sort) {
      if (sort === "most_liked") {
        let matchQuery = { ...query };
        const pipeline = [
          { $match: matchQuery },
          {
            $lookup: {
              from: "collectioninteractions",
              localField: "_id",
              foreignField: "collectionId",
              as: "interactions",
            },
          },
          {
            $addFields: {
              likesCount: {
                $size: {
                  $filter: {
                    input: "$interactions",
                    cond: { $eq: ["$$this.liked", true] },
                  },
                },
              },
            },
          },
          { $sort: { likesCount: -1 } },
          { $skip: (parseInt(page) - 1) * parseInt(limit) },
          { $limit: parseInt(limit) },
        ];

        const collections = await Collection.aggregate(pipeline);
        const total = await Collection.countDocuments(matchQuery);

        const populatedCollections = await Promise.all(
          collections.map(async (collection) => {
            try {
              const populated = await Collection.findById(collection._id)
                .populate("creator", "username email")
                .populate("cards")
                .exec();
              return populated;
            } catch (error) {
              const collectionObj = await Collection.findById(collection._id);
              const obj = collectionObj.toObject();
              obj.creator = DELETED_USER_PLACEHOLDER;
              return obj;
            }
          })
        );

        return res.status(HTTP_RESPONSES.OK).json({
          collections: populatedCollections,
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        });
      } else {
        let field = sort.split("_")[0];
        let direction = sort.split("_")[1];
        if (field === "date") field = "createdAt";
        sortObj[field] = direction === "desc" ? -1 : 1;
      }
    } else {
      sortObj = { createdAt: -1 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let collections = await Collection.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .exec();

    collections = await Promise.all(
      collections.map(async (collection) => {
        let populatedCollection;
        try {
          populatedCollection = await Collection.findById(collection._id)
            .populate("creator", "username email")
            .populate("cards")
            .exec();
        } catch (error) {
          populatedCollection = collection.toObject();
          populatedCollection.creator = DELETED_USER_PLACEHOLDER;
        }
        return populatedCollection;
      })
    );

    const total = await Collection.countDocuments(query);

    return res.status(HTTP_RESPONSES.OK).json({
      collections,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error("Error al obtener colecciones:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getCollectionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de colección requerido" });
    } else if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de colección inválido" });
    }

    const collection = await Collection.findById(id);
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Colección no encontrada" });
    }

    const creatorId = collection.creator;
    if (req.user && req.user._id.toString() !== creatorId.toString()) {
      const Friendship = require("../models/friendship");
      const blockingRelationship = await Friendship.findOne({
        requester: creatorId,
        recipient: req.user._id,
        status: "blocked",
      });

      if (blockingRelationship) {
        return res
          .status(HTTP_RESPONSES.FORBIDDEN)
          .json({ message: "No tienes permiso para ver esta colección" });
      }
    }

    if (
      collection.isPrivate &&
      (!req.user || !isOwner(creatorId, req.user._id))
    ) {
      return res
        .status(HTTP_RESPONSES.FORBIDDEN)
        .json({ message: "No tienes permiso para ver esta colección privada" });
    }

    let populatedCollection;
    try {
      populatedCollection = await Collection.findById(id)
        .populate("creator", "username email")
        .populate("cards")
        .exec();
    } catch (error) {
      populatedCollection = collection.toObject();
      populatedCollection.creator = DELETED_USER_PLACEHOLDER;
    }

    return res.status(HTTP_RESPONSES.OK).json(populatedCollection);
  } catch (error) {
    console.error("Error al obtener colección por Id:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getCollectionByTitle = async (req, res, next) => {
  try {
    const { title } = req.params;
    if (!title) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Titulo faltante" });
    }
    let collection = await Collection.findOne({ title })
      .populate("cards")
      .exec();

    let populatedCollection;
    if (collection) {
      try {
        populatedCollection = await Collection.findById(collection._id)
          .populate("creator", "username email")
          .populate("cards")
          .exec();
      } catch (error) {
        populatedCollection = collection.toObject();
        populatedCollection.creator = DELETED_USER_PLACEHOLDER;
      }
    }
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Colección no encontrada" });
    }
    return res.status(HTTP_RESPONSES.OK).json(populatedCollection);
  } catch (error) {
    console.error("Error al obtener colección por título:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const createCollection = async (req, res, next) => {
  try {
    const title = (req.body.title || "").trim();
    if (!title) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Titulo faltante" });
    } else if (title.length > 40) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "El título no puede superar los 40 caracteres",
      });
    }

    const description = req.body.description || "";
    if (description.length > 1000) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "La descripción no puede superar los 1000 caracteres",
      });
    }

    const newCollection = new Collection({
      title,
      description,
      img: req.file ? req.file.path : null,
      creator: req.user._id,
      isPrivate: req.body.isPrivate === true || req.body.isPrivate === "true",
      cards: Array.isArray(req.body.cards) ? req.body.cards : [],
    });

    const collection = await newCollection.save();
    let populatedCollection;
    try {
      populatedCollection = await Collection.findById(collection._id)
        .populate("creator", "username email")
        .populate("cards")
        .exec();
    } catch (error) {
      console.warn("Error al populator creator:", error);
      populatedCollection = collection.toObject();
      populatedCollection.creator = DELETED_USER_PLACEHOLDER;
    }

    return res.status(HTTP_RESPONSES.CREATED).json(populatedCollection);
  } catch (error) {
    console.error("Error al crear colección:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const addCardToCollection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cardId } = req.body;
    if (!id || !cardId) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de colección o carta faltante" });
    } else if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de colección inválido" });
    } else if (!mongoose.Types.ObjectId.isValid(cardId)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de carta inválido" });
    }

    const collection = await Collection.findById(id);
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Colección no encontrada" });
    }
    if (
      !req.user ||
      collection.creator.toString() !== req.user._id.toString()
    ) {
      return res
        .status(HTTP_RESPONSES.FORBIDDEN)
        .json({ message: "No tienes permiso para modificar esta colección" });
    }
    const alreadyIn = collection.cards
      .map((c) => c.toString())
      .includes(cardId);
    if (alreadyIn) {
      return res
        .status(HTTP_RESPONSES.CONFLICT)
        .json({ message: "La carta ya está en la colección" });
    }
    collection.cards.push(cardId);
    await collection.save();
    const payload =
      typeof collection.toObject === "function"
        ? collection.toObject()
        : collection;
    return res
      .status(HTTP_RESPONSES.OK)
      .json({ ...payload, _meta: { added: true } });
  } catch (error) {
    console.error("Error al agregar carta a colección:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const removeCardFromCollection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cardId } = req.body;
    if (!id || !cardId) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de colección o carta faltante" });
    } else if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de colección inválido" });
    } else if (!mongoose.Types.ObjectId.isValid(cardId)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de carta inválido" });
    }

    const collection = await Collection.findById(id);
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Colección no encontrada" });
    }
    if (
      !req.user ||
      collection.creator.toString() !== req.user._id.toString()
    ) {
      return res
        .status(HTTP_RESPONSES.FORBIDDEN)
        .json({ message: "No tienes permiso para modificar esta colección" });
    }
    const wasIn = collection.cards.map((c) => c.toString()).includes(cardId);
    let removed = false;
    if (wasIn) {
      collection.cards = collection.cards.filter(
        (c) => c.toString() !== cardId
      );
      await collection.save();
      removed = true;
    }
    const payload =
      typeof collection.toObject === "function"
        ? collection.toObject()
        : collection;
    return res
      .status(HTTP_RESPONSES.OK)
      .json({ ...payload, _meta: { removed } });
  } catch (error) {
    console.error("Error al quitar carta de colección:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const updateCollection = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de colección requerido" });
    } else if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de colección inválido" });
    }

    const collection = await Collection.findById(id);
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Colección no encontrada" });
    }

    const title = (req.body.title || "").trim();
    if (title && title.length > 40) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "El título no puede superar los 40 caracteres",
      });
    }

    const description =
      req.body.description !== undefined
        ? req.body.description.trim()
        : undefined;

    if (description && description.length > 1000) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "La descripción no puede superar los 1000 caracteres",
      });
    }
    const isPrivate =
      req.body.isPrivate === true || req.body.isPrivate === "true";

    const userId = req.user._id.toString();
    if (collection.creator.toString() !== userId) {
      return res
        .status(HTTP_RESPONSES.FORBIDDEN)
        .json({ message: "No tienes permiso para editar esta colección" });
    }

    const updateData = {};
    if (title && title !== collection.title) {
      const nameExists = await Collection.findOne({ title });
      if (nameExists && nameExists._id.toString() !== id.toString()) {
        return res
          .status(HTTP_RESPONSES.CONFLICT)
          .json({ message: "Ya existe una colección con ese título" });
      }
      updateData.title = title;
    }
    if (description !== undefined) {
      updateData.description = description;
    }
    updateData.isPrivate = isPrivate;
    if (req.file && req.file.path) {
      updateData.img = req.file.path;
    }

    let updatedCollection;
    try {
      updatedCollection = await Collection.findByIdAndUpdate(id, updateData, {
        new: true,
      });
    } catch (error) {
      return res
        .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
        .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
    }

    let populatedCollection;
    try {
      populatedCollection = await Collection.findById(updatedCollection._id)
        .populate("creator", "username email")
        .populate("cards")
        .exec();
    } catch (error) {
      populatedCollection = updatedCollection.toObject();
      populatedCollection.creator = DELETED_USER_PLACEHOLDER;
    }

    return res.status(HTTP_RESPONSES.OK).json(populatedCollection);
  } catch (error) {
    console.error("Error al actualizar colección:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const deleteCollection = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de colección requerido" });
    } else if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de colección inválido" });
    }

    const collection = await Collection.findById(id);
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Colección no encontrada" });
    }

    const userId = req.user._id.toString();
    if (collection.creator.toString() !== userId) {
      return res
        .status(HTTP_RESPONSES.FORBIDDEN)
        .json({ message: "No tienes permiso para eliminar esta colección" });
    }

    await Collection.findByIdAndDelete(id);
    return res
      .status(HTTP_RESPONSES.OK)
      .json({ message: "Colección eliminada correctamente." });
  } catch (error) {
    console.error("Error al eliminar colección:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getCollectionsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de usuario invalido" });
    }
    if (req.user && req.user._id.toString() !== userId) {
      const Friendship = require("../models/friendship");
      const blockingRelationship = await Friendship.findOne({
        requester: userId,
        recipient: req.user._id,
        status: "blocked",
      });

      if (blockingRelationship) {
        return res.status(HTTP_RESPONSES.OK).json([]);
      }
    }

    let collections;
    if (req.user && isOwner(userId, req.user._id)) {
      collections = await Collection.find({ creator: userId })
        .populate("cards")
        .exec();
    } else {
      collections = await Collection.find({
        creator: userId,
        isPrivate: false,
      })
        .populate("cards")
        .exec();
    }

    collections = await Promise.all(
      collections.map(async (collection) => {
        try {
          const populated = await Collection.populate(collection, {
            path: "creator",
            select: "username email",
          });
          return populated;
        } catch (error) {
          collection.creator = DELETED_USER_PLACEHOLDER;
          return collection;
        }
      })
    );
    return res.status(HTTP_RESPONSES.OK).json(collections || []);
  } catch (error) {
    console.error("Error al obtener colecciones por usuario:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getMyCollections = async (req, res) => {
  try {
    let collections = await Collection.find({
      creator: req.user._id.toString(),
    })
      .populate("cards")
      .exec();

    collections = await Promise.all(
      collections.map(async (collection) => {
        try {
          const populated = await Collection.populate(collection, {
            path: "creator",
            select: "username email",
          });
          return populated;
        } catch (error) {
          collection.creator = DELETED_USER_PLACEHOLDER;
          return collection;
        }
      })
    );

    return res.status(HTTP_RESPONSES.OK).json(collections || []);
  } catch (error) {
    console.error("Error al obtener mis colecciones:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const addFavoriteCollection = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de colección requerido" });
    } else if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de colección inválido" });
    }

    const collection = await Collection.findById(id);
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Colección no encontrada" });
    }

    const userId = req.user.id;
    let interaction = await CollectionInteraction.findOne({
      userId,
      collectionId: id,
    });

    if (!interaction) {
      interaction = new CollectionInteraction({ userId, collectionId: id });
    }

    if (!interaction.favorited) {
      interaction.favorited = true;
      interaction.favoritedAt = new Date();
      await interaction.save();
    }

    return res.status(HTTP_RESPONSES.OK).json({ success: true });
  } catch (error) {
    console.error("Error al agregar colección a favoritos:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const removeFavoriteCollection = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de colección requerido" });
    } else if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de colección inválido" });
    }

    const interaction = await CollectionInteraction.findOne({
      userId: req.user.id,
      collectionId: id,
    });
    if (interaction && interaction.favorited) {
      interaction.favorited = false;
      interaction.favoritedAt = null;
      await interaction.save();
    }

    return res.status(HTTP_RESPONSES.OK).json({ success: true });
  } catch (error) {
    console.error("Error al quitar colección de favoritos:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getFavoriteCollections = async (req, res) => {
  return getUserFavoriteCollections(req, res);
};

const toggleLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    if (!id) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de colección requerido" });
    } else if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de colección inválido" });
    }

    const collection = await Collection.findById(id);
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Colección no encontrada" });
    }

    let interaction = await CollectionInteraction.findOne({
      userId,
      collectionId: id,
    });

    if (!interaction) {
      interaction = new CollectionInteraction({ userId, collectionId: id });
    }

    const newLikedState = !interaction.liked;
    interaction.liked = newLikedState;
    interaction.likedAt = newLikedState ? new Date() : null;

    await interaction.save();

    const stats = await getCollectionStats(id);

    return res.status(HTTP_RESPONSES.OK).json({
      liked: newLikedState,
      stats,
    });
  } catch (error) {
    console.error("Error al actualizar like de colección:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const toggleFavorite = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    if (!id) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de colección requerido" });
    } else if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de colección inválido" });
    }

    const collection = await Collection.findById(id);
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Colección no encontrada" });
    }

    let interaction = await CollectionInteraction.findOne({
      userId,
      collectionId: id,
    });

    if (!interaction) {
      interaction = new CollectionInteraction({ userId, collectionId: id });
    }

    const newFavoritedState = !interaction.favorited;
    interaction.favorited = newFavoritedState;
    interaction.favoritedAt = newFavoritedState ? new Date() : null;

    await interaction.save();

    const stats = await getCollectionStats(id);

    return res.status(HTTP_RESPONSES.OK).json({
      favorited: newFavoritedState,
      stats,
    });
  } catch (error) {
    console.error("Error al actualizar favorito de colección:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getCollectionStatistics = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de colección requerido" });
    } else if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de colección inválido" });
    }

    const stats = await getCollectionStats(id);
    return res.status(HTTP_RESPONSES.OK).json(stats);
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getUserCollectionInteraction = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    if (!id) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de colección requerido" });
    } else if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de colección inválido" });
    }

    const interaction = await CollectionInteraction.findOne({
      userId,
      collectionId: id,
    });

    return res.status(HTTP_RESPONSES.OK).json({
      liked: interaction?.liked || false,
      favorited: interaction?.favorited || false,
    });
  } catch (error) {
    console.error("Error al obtener interacción con colección:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getUserFavoriteCollections = async (req, res) => {
  try {
    const userId = req.user.id;

    let favoriteInteractions;
    try {
      favoriteInteractions = await CollectionInteraction.find({
        userId,
        favorited: true,
      })
        .populate({
          path: "collectionId",
          populate: {
            path: "cards creator",
            select: "username email",
          },
        })
        .sort({ favoritedAt: -1 });
    } catch (error) {
      console.warn(
        "Populate failed in getUserFavoriteCollections:",
        error.message
      );
      favoriteInteractions = await CollectionInteraction.find({
        userId,
        favorited: true,
      }).sort({ favoritedAt: -1 });
    }

    const collections = favoriteInteractions
      .map((interaction) => interaction.collectionId)
      .filter((collection) => collection);

    return res.status(HTTP_RESPONSES.OK).json(collections);
  } catch (error) {
    console.error("Error al obtener colecciones favoritas:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getCollectionStats = async (collectionId) => {
  const [likesCount, favoritesCount] = await Promise.all([
    CollectionInteraction.countDocuments({ collectionId, liked: true }),
    CollectionInteraction.countDocuments({ collectionId, favorited: true }),
  ]);

  return {
    likes: likesCount,
    favorites: favoritesCount,
  };
};

module.exports = {
  getCollections,
  getCollectionById,
  getCollectionByTitle,
  createCollection,
  updateCollection,
  deleteCollection,
  addCardToCollection,
  removeCardFromCollection,
  getCollectionsByUser,
  getMyCollections,
  addFavoriteCollection,
  removeFavoriteCollection,
  getFavoriteCollections,
  toggleLike,
  toggleFavorite,
  getCollectionStatistics,
  getUserCollectionInteraction,
  getUserFavoriteCollections,
};
