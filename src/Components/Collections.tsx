import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageLayout from "./PageLayout";
import { apiFetch } from "./api";
import { useAuth } from "../contexts/AuthContext";
import { extractErrorMessage } from "../utils/errors";

interface CardSummary {
  _id: string;
  title: string;
  img?: string;
}

interface CollectionItem {
  _id: string;
  title: string;
  description?: string;
  img?: string;
  creator: string;
  cards: CardSummary[];
}

const Collections: React.FC = () => {
  const { user } = useAuth();
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [form, setForm] = useState({ title: "", description: "" });
  const [image, setImage] = useState<File | null>(null);

  const canCreate = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const listResp = await apiFetch<CollectionItem[]>("/collections");
        setCollections(listResp.data || []);
      } catch (e: unknown) {
        setCollections([]);
        const msg = extractErrorMessage(e, "");
        if (msg) setError(msg);
      } finally {
        setLoading(false);
      }

      if (user) {
        try {
          const favResp = await apiFetch<CollectionItem[]>(
            "/collections/favorites/mine",
            {
              headers: { Authorization: `Bearer ${user.token}` },
            }
          );
          setFavorites((favResp.data || []).map((c) => c._id));
        } catch (e) {
          // ignorar
        }
      } else {
        setFavorites([]);
      }
    };
    void load();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");
    setCreating(true);
    try {
      if (!user) throw new Error("Debes iniciar sesión");
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("description", form.description);
      if (image) fd.append("img", image);
      const resp = await apiFetch<CollectionItem>("/collections", {
        method: "POST",
        body: fd,
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setCollections((prev) => [resp.data, ...prev]);
      setForm({ title: "", description: "" });
      setImage(null);
      setCreateSuccess("Colección creada");
    } catch (e: unknown) {
      setCreateError(extractErrorMessage(e, "Error al crear colección"));
    } finally {
      setCreating(false);
    }
  };

  const toggleFavorite = async (collectionId: string, isFav: boolean) => {
    if (!user) return;
    try {
      if (!isFav) {
        await apiFetch(`/collections/${collectionId}/favorite`, {
          method: "POST",
          headers: { Authorization: `Bearer ${user.token}` },
        });
        setFavorites((prev) => [...prev, collectionId]);
      } else {
        await apiFetch(`/collections/${collectionId}/favorite`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${user.token}` },
        });
        setFavorites((prev) => prev.filter((id) => id !== collectionId));
      }
    } catch (e) {
      // ignorar
    }
  };

  return (
    <PageLayout contentClassName="flex-1 overflow-y-auto p-6">
      <h1 className="text-3xl font-bold mb-2">Colecciones</h1>
      {error && <div className="mb-4 text-red-400 text-sm">{error}</div>}

      {canCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-8 bg-gray-800 p-4 rounded text-white flex flex-col gap-3 max-w-xl"
        >
          <h2 className="text-2xl font-semibold">Crear colección</h2>
          <input
            className="p-2 rounded text-black"
            placeholder="Nombre de la colección"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
            maxLength={60}
          />
          <textarea
            className="p-2 rounded text-black"
            placeholder="Descripción"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
          />
          <input
            type="file"
            accept="image/*"
            className="text-sm"
            onChange={(e) => setImage(e.target.files?.[0] || null)}
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={creating}
              className="rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {creating ? "Creando..." : "Crear colección"}
            </button>
            {createSuccess && (
              <span className="text-green-400 text-sm">{createSuccess}</span>
            )}
            {createError && (
              <span className="text-red-400 text-sm">{createError}</span>
            )}
          </div>
        </form>
      )}

      {loading ? (
        <div>Cargando colecciones...</div>
      ) : collections.length === 0 ? (
        <div>No hay colecciones</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {collections.map((col) => {
            const isFav = favorites.includes(col._id);
            const isOwner = user?.userId && col.creator === user.userId;
            return (
              <Link
                key={col._id}
                to={`/collections/${col._id}`}
                className="group block rounded bg-white/90 text-black shadow p-3 relative hover:shadow-lg transition"
                aria-label={`Abrir colección ${col.title}`}
              >
                <div className="relative">
                  {col.img ? (
                    <img
                      src={col.img}
                      alt={col.title}
                      className="w-full h-40 object-cover rounded"
                    />
                  ) : (
                    <div className="w-full h-40 bg-gray-200 rounded flex items-center justify-center text-gray-600">
                      Sin imagen
                    </div>
                  )}
                  {user && !isOwner && (
                    <button
                      title={isFav ? "Quitar de favoritos" : "Marcar como favorito"}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void toggleFavorite(col._id, isFav);
                      }}
                      className={`absolute top-2 right-2 rounded-full p-2 ${
                        isFav ? "bg-yellow-400 text-black" : "bg-black/60 text-white"
                      }`}
                    >
                      ★
                    </button>
                  )}
                </div>
                <div className="mt-2">
                  <div className="font-semibold group-hover:underline">{col.title}</div>
                  {col.description && (
                    <div className="text-sm text-gray-700 line-clamp-2">{col.description}</div>
                  )}
                  <div className="mt-2 text-xs text-gray-600">
                    {col.cards?.length || 0} cartas
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
};

export default Collections;

