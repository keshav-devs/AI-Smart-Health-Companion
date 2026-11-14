import { createContext, useState, useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { type Profile, listProfiles } from "@/api/profiles";
import { useAuth } from "@/hooks/useAuth";

interface ProfileContextValue {
  profiles: Profile[];
  currentProfile: Profile | null;
  setCurrentProfile: (profile: Profile) => void;
  isLoading: boolean;
  refreshProfiles: () => Promise<void>;
}

export const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfileState] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfiles = async () => {
    try {
      setIsLoading(true);
      const data = await listProfiles(true);
      setProfiles(data);
      
      const storedProfileId = localStorage.getItem("current_profile_id");
      let selected: Profile | null = null;
      if (storedProfileId) {
        selected = data.find(p => p.id === storedProfileId) || null;
      }
      
      if (!selected && data.length > 0) {
        selected = data.find(p => p.is_default) || data[0];
      }
      
      if (selected) {
        const changed = selected.id !== storedProfileId;
        localStorage.setItem("current_profile_id", selected.id);
        setCurrentProfileState(selected);
        if (changed) {
          queryClient.invalidateQueries();
        }
      } else {
        setCurrentProfileState(null);
        localStorage.removeItem("current_profile_id");
      }
    } catch (err) {
      console.error("Failed to load profiles", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfiles();
    } else {
      setProfiles([]);
      setCurrentProfileState(null);
      localStorage.removeItem("current_profile_id");
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const setCurrentProfile = (profile: Profile) => {
    localStorage.setItem("current_profile_id", profile.id);
    setCurrentProfileState(profile);
    // Invalidate and refresh queries so the selected member's records appear without reloading the page
    queryClient.invalidateQueries();
  };

  return (
    <ProfileContext.Provider value={{ profiles, currentProfile, setCurrentProfile, isLoading, refreshProfiles: fetchProfiles }}>
      {children}
    </ProfileContext.Provider>
  );
}
