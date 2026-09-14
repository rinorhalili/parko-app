import { useEffect, useState } from "react";
import { listFavorites, type Favorites } from "../api/favoritesService";
import { EmptyState } from "../components/EmptyState";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
import { ProtectedRoute } from "../components/ProtectedRoute";

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorites | null>(null);
  useEffect(() => {
    void listFavorites().then(setFavorites).catch(() => setFavorites({ parkingIds: [], postIds: [] }));
  }, []);
  return (
    <Layout title="Të ruajtura">
      <ProtectedRoute>
        {!favorites ? <LoadingState /> : favorites.parkingIds.length + favorites.postIds.length === 0 ? <EmptyState title="Nuk ke ruajtur ende asgjë" /> : (
          <section>
            <h2>Parkingje</h2>
            {favorites.parkingIds.map((id) => <a className="parking-card" href={`/parking/${id}`} key={id}>{id}</a>)}
            <h2>Postime</h2>
            {favorites.postIds.map((id) => <a className="parking-card" href={`/community?post=${id}`} key={id}>{id}</a>)}
          </section>
        )}
      </ProtectedRoute>
    </Layout>
  );
}
