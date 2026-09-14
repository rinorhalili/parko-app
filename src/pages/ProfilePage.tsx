import { useState } from "react";
import type { FormEvent } from "react";
import { logout } from "../api/authService";
import { updateProfile } from "../api/userService";
import { Layout } from "../components/Layout";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { useAuthContext } from "../context/AuthContext";
import defaultAvatar from "../assets/default-avatar.png";

function ProfileForm() {
  const { user } = useAuthContext();
  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [message, setMessage] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault();
    await updateProfile({ name, username, bio });
    setMessage("Profili u përditësua.");
  }

  return (
    <>
      <section className="profile-header">
        <img className="profile-avatar" src={user?.avatar ?? defaultAvatar} alt="" />
        <div>
          <h2>{user?.name}</h2>
          <p>@{user?.username} • {user?.reputationScore} pikë</p>
        </div>
      </section>
      <form className="profile-form" onSubmit={save}>
        <label>Emri<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} /></label>
        <label>Bio<textarea value={bio} onChange={(event) => setBio(event.target.value)} /></label>
        <button>Ruaj</button>
        {message && <p>{message}</p>}
      </form>
      <button className="profile-logout-button" onClick={() => void logout()}>Dil nga llogaria</button>
    </>
  );
}

export default function ProfilePage() {
  return (
    <Layout title="Profili">
      <ProtectedRoute>
        <ProfileForm />
      </ProtectedRoute>
    </Layout>
  );
}
