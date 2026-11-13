import { createContext, useState, useEffect, ReactNode } from "react";
import { Profile, listProfiles } from "@/api/profiles";
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
      let selected = null;
      if (storedProfileId) {
        selected = data.find(p => p.id === storedProfileId) || null;
      }
      
      if (!selected && data.length > 0) {
        selected = data.find(p => p.is_default) || data[0];
      }
      
      if (selected) {
        setCurrentProfileState(selected);
        localStorage.setItem("current_profile_id", selected.id);
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
    setCurrentProfileState(profile);
    localStorage.setItem("current_profile_id", profile.id);
    // Reload the page to reset state of other components depending on the profile
    window.location.reload();
  };

  return (
    <ProfileContext.Provider value={{ profiles, currentProfile, setCurrentProfile, isLoading, refreshProfiles: fetchProfiles }}>
      {children}
    </ProfileContext.Provider>
  );
}
