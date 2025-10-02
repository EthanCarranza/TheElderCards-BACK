import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import PageLayout from "./PageLayout";
import { apiFetch } from "./api";
import { extractErrorMessage } from "../utils/errors";

interface CardItem {
  _id: string;
  title: string;
  img?: string;
}

interface CollectionDetailData {
  _id: string;
  title: string;
  description?: string;
  img?: string;
  creator: string;
  cards: CardItem[];
}

const CollectionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [collection, setCollection] = useState<CollectionDetailData | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setError("Identificador de colección no válido");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const resp = await apiFetch<CollectionDetailData>(`/collections/${id}`);
        setCollection(resp.data);
      } catch (e: unknown) {
        setError(extractErrorMessage(e, "No se pudo cargar la colección"));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  return (
    <PageLayout contentClassName="flex-1 overflow-y-auto p-6">
      <button
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/collections"))}
        className="mb-6 rounded bg-gray-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-600"
      >
        Volver
      </button>

      {loading ? (
        <div className="text-white">Cargando colección...</div>
      ) : error ? (
        <div className="text-red-400">{error}</div>
      ) : collection ? (
        <div className="space-y-8">
          <div className="bg-white/90 text-black rounded p-4 shadow">
            {collection.img ? (
              <img src={collection.img} alt={collection.title} className="w-full max-h-[420px] object-cover rounded" />
            ) : (
              <div className="w-full h-56 bg-gray-200 rounded flex items-center justify-center text-gray-600">
                Sin imagen
              </div>
            )}
            <h1 className="mt-4 text-3xl font-bold">{collection.title}</h1>
            {collection.description && (
              <p className="mt-2 text-base text-gray-800 whitespace-pre-line">
                {collection.description}
              </p>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-semibold mb-4">Cartas</h2>
            {collection.cards?.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-visible">
                {collection.cards.map((card) => (
                  <Link
                    key={card._id}
                    to={`/cards/${card._id}`}
                    className="block bg-white/90 text-black rounded shadow hover:shadow-lg transition overflow-hidden"
                  >
                    {card.img ? (
                      <img src={card.img} alt={card.title} className="w-full h-64 object-cover rounded-t" />
                    ) : (
                      <div className="w-full h-64 bg-gray-200 rounded-t flex items-center justify-center text-gray-600">
                        Sin imagen
                      </div>
                    )}
                    <div className="p-3 font-semibold truncate">{card.title}</div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-white/90">No hay cartas en esta colección</div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-white">Colección no encontrada</div>
      )}
    </PageLayout>
  );
};

export default CollectionDetail;
