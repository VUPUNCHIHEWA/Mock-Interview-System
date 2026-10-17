import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:8000";
const PROFILE_UPDATED = "profile-updated";

// ---------------------------------------------------------------------------
// The app stores a name in two places:
//   1. users.name        – typed on the Sign up page (saved in localStorage
//                          "user" at log in)
//   2. profiles.full_name – typed on the Profile page
// The name shown in the app is the Profile name when it has been filled in,
// otherwise the Sign up name (ASSUMPTIONS I20).
// ---------------------------------------------------------------------------

export const readLoginUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user")) || {};
  } catch {
    return {};
  }
};

const clean = (v) => (typeof v === "string" ? v.trim() : "");

/** Call this after the Profile page saves, so the sidebar and dashboard update. */
export const notifyProfileUpdated = () => window.dispatchEvent(new Event(PROFILE_UPDATED));

/** Returns { name, email } for the logged-in student. */
export function useCurrentUser() {
  const login = readLoginUser();
  const [user, setUser] = useState({ name: clean(login.name), email: clean(login.email) });

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) return undefined;
    let cancelled = false;

    const load = () => {
      axios
        .get(`${API}/profile/${userId}`)
        .then((res) => {
          if (cancelled) return;
          const p = res.data || {};
          const base = readLoginUser();
          setUser({
            name: clean(p.full_name) || clean(base.name),
            email: clean(p.email) || clean(base.email),
          });
        })
        .catch(() => {
          // Keep the Sign up name if the profile cannot be loaded
        });
    };

    load();
    window.addEventListener(PROFILE_UPDATED, load);
    return () => {
      cancelled = true;
      window.removeEventListener(PROFILE_UPDATED, load);
    };
  }, []);

  return user;
}