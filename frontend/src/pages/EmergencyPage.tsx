import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useProfile } from "@/hooks/useProfile";
import { fetchEmergencyInfo } from "@/api/emergency";
import {
  fetchNearbyFacilities,
  type FacilityItem,
  type FacilityType,
  type NearbyFacilitiesResponse,
} from "@/api/hospitals";

export function EmergencyPage() {
  const { currentProfile } = useProfile();
  const profileId = currentProfile?.id;

  // ── 1. Fetch Profile Emergency Info ──────────────────────────────────
  const {
    data: emergencyData,
    isLoading: isEmergencyLoading,
    isError: isEmergencyError,
  } = useQuery({
    queryKey: ["emergency-info", profileId],
    queryFn: () => fetchEmergencyInfo(profileId),
    enabled: Boolean(profileId),
  });

  // ── 2. Nearby Healthcare Search State ────────────────────────────────
  const [radius, setRadius] = useState<number>(5000);
  const [facilityType, setFacilityType] = useState<FacilityType>("all");
  const [manualMode, setManualMode] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");
  const [lastSearchedCoords, setLastSearchedCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [httpError, setHttpError] = useState<string | null>(null);
  const [isTimeout, setIsTimeout] = useState(false);

  const [nearbyResult, setNearbyResult] = useState<NearbyFacilitiesResponse | null>(null);

  const searchMutation = useMutation({
    mutationFn: fetchNearbyFacilities,
    onSuccess: (data) => {
      setNearbyResult(data);
      setHttpError(null);
      setIsTimeout(false);
      setGeoError(null);
    },
    onError: (err: any) => {
      setNearbyResult(null);
      const isTimeoutErr =
        err?.code === "ECONNABORTED" ||
        err?.message?.toLowerCase().includes("timeout") ||
        err?.detail?.toLowerCase().includes("timeout");
      setIsTimeout(isTimeoutErr);
      if (isTimeoutErr) {
        setHttpError("The request to the facility directory timed out. Please check your connection or try again.");
      } else {
        const errorMsg =
          err?.response?.data?.detail ||
          err?.detail ||
          err?.message ||
          "Could not retrieve nearby facilities due to a server or network error.";
        setHttpError(errorMsg);
      }
    },
  });

  // Geolocation trigger
  function handleUseMyLocation() {
    setGeoError(null);
    setHttpError(null);
    setIsTimeout(false);

    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser. Please enter coordinates manually.");
      setManualMode(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setManualLat(lat.toFixed(6));
        setManualLon(lon.toFixed(6));
        setLastSearchedCoords({ lat, lon });
        searchMutation.mutate({
          lat,
          lon,
          radius,
          facility_type: facilityType,
        });
      },
      (err) => {
        let msg = "Could not retrieve your location.";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "Location access was denied. Please allow location permissions in your browser or enter coordinates manually.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = "Location information is unavailable from your device/browser. Please enter coordinates manually.";
        } else if (err.code === err.TIMEOUT) {
          msg = "Location request timed out. Please try again or enter coordinates manually.";
        }
        setGeoError(msg);
        setManualMode(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function handleManualSearch(e: React.FormEvent) {
    e.preventDefault();
    setGeoError(null);
    setHttpError(null);
    setIsTimeout(false);

    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      setGeoError("Please enter a valid latitude between -90 and 90.");
      return;
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      setGeoError("Please enter a valid longitude between -180 and 180.");
      return;
    }

    setLastSearchedCoords({ lat, lon });
    searchMutation.mutate({
      lat,
      lon,
      radius,
      facility_type: facilityType,
    });
  }

  // Determine effective coordinates for fallback map search
  const effectiveLat = lastSearchedCoords?.lat ?? (manualLat ? parseFloat(manualLat) : null);
  const effectiveLon = lastSearchedCoords?.lon ?? (manualLon ? parseFloat(manualLon) : null);
  const hasValidCoords =
    effectiveLat !== null &&
    effectiveLon !== null &&
    !isNaN(effectiveLat) &&
    !isNaN(effectiveLon) &&
    effectiveLat >= -90 &&
    effectiveLat <= 90 &&
    effectiveLon >= -180 &&
    effectiveLon <= 180;

  const profile = emergencyData?.profile;
  const contacts = emergencyData?.emergency_contacts || [];
  const medicines = emergencyData?.active_medicines || [];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-8 pb-12">
        {/* ── Urgent Triage Banner (India-Focused) ───────────────────── */}
        <div className="rounded-2xl border-2 border-red-500 bg-red-50 p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white font-bold text-lg">
                !
              </span>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-red-900">
                  Medical Emergency Assistance
                </h2>
                <p className="text-sm text-red-800">
                  If you or the patient are facing an immediate life-threatening emergency, call emergency services immediately:
                </p>
              </div>
            </div>

            {/* India Emergency Hotlines */}
            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href="tel:112"
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3.5 py-2 text-sm font-bold text-white shadow-sm hover:bg-red-700 transition-colors"
                aria-label="Call 112 National Emergency"
              >
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 4V3z" />
                </svg>
                <span>112</span>
                <span className="text-xs font-normal text-red-100">· National Emergency</span>
              </a>

              <a
                href="tel:108"
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-700 transition-colors"
                aria-label="Call 108 Ambulance"
              >
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 4V3z" />
                </svg>
                <span>108</span>
                <span className="text-xs font-normal text-amber-100">· Ambulance — availability varies by state</span>
              </a>
            </div>
          </div>
        </div>

        {/* ── Page Header ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
              Emergency Mode
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Emergency profile summary, contacts, and live nearby medical facility directory for{" "}
              <strong className="text-gray-800">{currentProfile?.name || "Active Profile"}</strong>.
            </p>
          </div>
          <Link
            to="/settings"
            className="inline-flex items-center text-xs font-medium text-primary-700 hover:text-primary-800 underline"
          >
            Edit profile medical info in Settings &rarr;
          </Link>
        </div>

        {isEmergencyLoading ? (
          <div className="py-12 flex justify-center">
            <LoadingSpinner message="Loading emergency medical dossier..." />
          </div>
        ) : isEmergencyError ? (
          <ErrorMessage message="Could not load emergency information for the selected profile." />
        ) : (
          <div className="space-y-8">
            {/* ── Section 1: Vital Medical Attributes ─────────────────── */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="border-b border-gray-100 pb-4 mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span>Patient Emergency Summary</span>
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-600">
                      {profile?.relationship_type}
                    </span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Information recorded for first responders and ER personnel.
                  </p>
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-3">
                {/* Date of Birth */}
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                  <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    Date of Birth
                  </span>
                  <p className="mt-1 text-base font-semibold text-gray-900">
                    {profile?.date_of_birth ? (
                      new Date(profile.date_of_birth).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    ) : (
                      <span className="font-normal italic text-gray-400">Not provided</span>
                    )}
                  </p>
                </div>

                {/* Blood Type */}
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                  <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    Blood Type
                  </span>
                  <p className="mt-1 text-base font-semibold text-gray-900">
                    {profile?.blood_type ? (
                      <span className="inline-flex items-center rounded-md bg-red-100 px-2.5 py-0.5 text-sm font-bold text-red-800">
                        {profile.blood_type}
                      </span>
                    ) : (
                      <span className="font-normal italic text-gray-400">Not provided</span>
                    )}
                  </p>
                </div>

                {/* Allergies */}
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                  <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    Allergies & Sensitivities
                  </span>
                  <p className="mt-1 text-base font-semibold text-gray-900">
                    {profile?.allergies ? (
                      <span className="text-red-700 font-medium">{profile.allergies}</span>
                    ) : (
                      <span className="font-normal italic text-gray-400">Not provided</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-amber-50/60 border border-amber-200/60 p-3 text-xs text-amber-900">
                <strong>Clinical Guardrail:</strong> Unlisted attributes (such as allergies or conditions) must never be inferred as absent. Responders should verify with patient or emergency contacts.
              </div>
            </section>

            {/* ── Section 2: Emergency Contacts ───────────────────────── */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Emergency Contacts
                  </h2>
                  <p className="text-xs text-gray-500">
                    Primary individuals to notify in a critical situation.
                  </p>
                </div>
                <Link
                  to="/contacts"
                  className="text-xs font-medium text-primary-700 hover:text-primary-800 underline"
                >
                  Manage contacts &rarr;
                </Link>
              </div>

              {contacts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
                  <p className="text-sm font-medium text-gray-600">
                    No emergency contacts configured for {currentProfile?.name || "this profile"}.
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Add family members, guardians, or primary physicians with the "Emergency" type in Care Team.
                  </p>
                  <div className="mt-4">
                    <Link to="/contacts">
                      <Button size="sm" variant="secondary">
                        Add Emergency Contact
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {contacts.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-col justify-between rounded-xl border border-gray-200 bg-gray-50/40 p-4 hover:border-gray-300 transition-colors"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-gray-900">{c.name}</h3>
                          {c.relationship && (
                            <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                              {c.relationship}
                            </span>
                          )}
                        </div>
                        {c.address && (
                          <p className="mt-1 text-xs text-gray-500">{c.address}</p>
                        )}
                        {c.notes && (
                          <p className="mt-1 text-xs italic text-gray-600">"{c.notes}"</p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-200/60 flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900">{c.phone}</span>
                        <a
                          href={`tel:${c.phone}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 4V3z" />
                          </svg>
                          Call Now
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Section 3: Active Medications ───────────────────────── */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Active Medications & Regimen
                  </h2>
                  <p className="text-xs text-gray-500">
                    Current prescriptions for clinical drug interaction review.
                  </p>
                </div>
                <Link
                  to="/medicines"
                  className="text-xs font-medium text-primary-700 hover:text-primary-800 underline"
                >
                  View full medicine tracker &rarr;
                </Link>
              </div>

              {medicines.length === 0 ? (
                <p className="text-sm text-gray-500 italic py-2">
                  No active medicines recorded for this profile.
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {medicines.map((m) => (
                    <div key={m.id} className="py-3 flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {m.name}{" "}
                          {m.strength && (
                            <span className="text-sm font-normal text-gray-600">
                              ({m.strength})
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {m.form || "Form unspecified"} · {m.instructions || "No special instructions"}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Active
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Section 4: Live Nearby Healthcare Directory ─────────── */}
            <section className="rounded-2xl border border-primary-200 bg-white p-6 shadow-sm">
              <div className="border-b border-gray-100 pb-4 mb-5">
                <h2 className="text-xl font-bold text-gray-900">
                  Find Nearby Healthcare & Emergency Facilities
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Locate hospitals, emergency clinics, pharmacies, and blood banks near you.
                </p>
                <div className="mt-3 rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
                  <strong>Privacy Notice:</strong> Your location is only requested when you click the search button below. Coordinates are processed strictly in-memory by the backend to fetch verified nearby facilities and are <em>never</em> persisted or tracked.
                </div>
              </div>

              {/* Controls */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={handleUseMyLocation}
                    isLoading={searchMutation.isPending}
                    disabled={searchMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Find Nearby Help (Use My Location)</span>
                  </Button>

                  <button
                    type="button"
                    onClick={() => setManualMode(!manualMode)}
                    className="text-xs font-medium text-gray-600 hover:text-gray-900 underline"
                  >
                    {manualMode ? "Hide manual coordinates" : "Enter coordinates manually"}
                  </button>
                </div>

                {/* Filter and Radius selectors */}
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                    <span>Radius:</span>
                    <select
                      value={radius}
                      onChange={(e) => setRadius(parseInt(e.target.value, 10))}
                      className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 focus:border-primary-500 focus:outline-none"
                    >
                      <option value={2000}>2 km (~1.2 miles)</option>
                      <option value={5000}>5 km (~3.1 miles)</option>
                      <option value={10000}>10 km (~6.2 miles)</option>
                      <option value={25000}>25 km (~15.5 miles)</option>
                      <option value={50000}>50 km (~31.0 miles)</option>
                    </select>
                  </label>

                  <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                    <span>Facility Type:</span>
                    <select
                      value={facilityType}
                      onChange={(e) => setFacilityType(e.target.value as FacilityType)}
                      className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 focus:border-primary-500 focus:outline-none"
                    >
                      <option value="all">All Healthcare</option>
                      <option value="hospital">Hospitals Only</option>
                      <option value="clinic">Clinics & Doctors</option>
                      <option value="pharmacy">Pharmacies</option>
                      <option value="blood_bank">Blood Banks (OSM)</option>
                    </select>
                  </label>
                </div>

                {/* Manual coordinate inputs */}
                {manualMode && (
                  <form
                    onSubmit={handleManualSearch}
                    className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 space-y-3"
                  >
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Manual Coordinates Search
                    </h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs text-gray-600 block mb-1">Latitude (-90 to 90)</label>
                        <input
                          type="number"
                          step="any"
                          value={manualLat}
                          onChange={(e) => setManualLat(e.target.value)}
                          placeholder="e.g. 28.6139"
                          required
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 block mb-1">Longitude (-180 to 180)</label>
                        <input
                          type="number"
                          step="any"
                          value={manualLon}
                          onChange={(e) => setManualLon(e.target.value)}
                          placeholder="e.g. 77.2090"
                          required
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        isLoading={searchMutation.isPending}
                        disabled={searchMutation.isPending}
                      >
                        Search Coordinates
                      </Button>
                    </div>
                  </form>
                )}

                {/* Geolocation / Input Error State */}
                {geoError && <ErrorMessage message={geoError} />}
              </div>

              {/* ── Search Results & Operational States ────────────────── */}
              <div className="mt-8 space-y-4">
                {/* ── Clearly Visible Facility Directory Disclaimer ───── */}
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 shadow-sm flex items-start gap-3">
                  <svg className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h4 className="font-bold text-amber-900 mb-0.5">Facility Directory Notice</h4>
                    <p className="leading-relaxed">
                      This is a facility directory. It does not confirm current operating hours,
                      treatment availability, or live blood stock. Please call the facility to
                      confirm.
                    </p>
                  </div>
                </div>

                {/* Loading state */}
                {searchMutation.isPending && (
                  <div className="py-8 text-center">
                    <LoadingSpinner message="Searching live directory for verified healthcare facilities..." />
                  </div>
                )}

                {/* HTTP / Timeout Error State */}
                {httpError && !searchMutation.isPending && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
                      <p className="text-sm font-semibold text-red-900">
                        {isTimeout ? "Search Request Timed Out" : "Failed to Load Nearby Facilities"}
                      </p>
                      <p className="text-xs text-red-700 mt-1">
                        {httpError}
                      </p>
                      <p className="text-xs text-red-800 font-medium mt-3">
                        For immediate assistance, dial <strong>112 (National Emergency)</strong> or <strong>108 (Ambulance)</strong>.
                      </p>
                    </div>

                    {/* Manual Map Search Link on Failure */}
                    {hasValidCoords && (
                      <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                          External Map Search (User-Initiated)
                        </span>
                        <p className="text-xs text-gray-700 mt-1">
                          Our directory provider could not be reached, but you can launch a separate, user-initiated map search for healthcare facilities near your coordinates ({effectiveLat.toFixed(4)}, {effectiveLon.toFixed(4)}):
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2.5">
                          <a
                            href={`https://www.google.com/maps/search/hospital/@${effectiveLat},${effectiveLon},14z`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm hover:bg-gray-100"
                          >
                            <span>Search on Google Maps &rarr;</span>
                          </a>
                          <a
                            href={`https://www.openstreetmap.org/search?query=hospital#map=14/${effectiveLat}/${effectiveLon}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm hover:bg-gray-100"
                          >
                            <span>Search on OpenStreetMap &rarr;</span>
                          </a>
                        </div>
                        <p className="mt-2 text-[10px] text-gray-400 italic">
                          * These external map links open in a new tab. Results are provided by external map services and not verified by this application.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Successful Response Handling */}
                {nearbyResult && !searchMutation.isPending && (
                  <div className="space-y-4">
                    {/* Provenance Header */}
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-3.5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-xs text-gray-600">
                      <div>
                        <span className="font-semibold text-gray-900">
                          Found {nearbyResult.count} verified facilities
                        </span>{" "}
                        within {(nearbyResult.search_radius_meters / 1000).toFixed(1)} km
                      </div>
                      <div>
                        Retrieved at:{" "}
                        <span className="font-medium text-gray-800">
                          {new Date(nearbyResult.retrieval_time).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    {/* Safety notes */}
                    {nearbyResult.notes && (
                      <p className="text-xs text-amber-800 bg-amber-50/70 border border-amber-200/70 p-2.5 rounded-lg">
                        <strong>Notice:</strong> {nearbyResult.notes}
                      </p>
                    )}

                    {/* Provider Unavailable state */}
                    {nearbyResult.status === "provider_unavailable" && (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
                          <p className="text-sm font-semibold text-red-900">
                            Healthcare directory providers are currently unreachable.
                          </p>
                          <p className="text-xs text-red-700 mt-1">
                            If you require urgent medical attention, dial <strong>112 (National Emergency)</strong> or <strong>108 (Ambulance)</strong> immediately.
                          </p>
                        </div>

                        {/* Manual Map Search Link on Provider Unavailable */}
                        {hasValidCoords && (
                          <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                              External Map Search (User-Initiated)
                            </span>
                            <p className="text-xs text-gray-700 mt-1">
                              Our primary healthcare directory is unreachable, but you can launch a separate, user-initiated search on an external map provider around your coordinates ({effectiveLat.toFixed(4)}, {effectiveLon.toFixed(4)}):
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2.5">
                              <a
                                href={`https://www.google.com/maps/search/hospital/@${effectiveLat},${effectiveLon},14z`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm hover:bg-gray-100"
                              >
                                <span>Search on Google Maps &rarr;</span>
                              </a>
                              <a
                                href={`https://www.openstreetmap.org/search?query=hospital#map=14/${effectiveLat}/${effectiveLon}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm hover:bg-gray-100"
                              >
                                <span>Search on OpenStreetMap &rarr;</span>
                              </a>
                            </div>
                            <p className="mt-2 text-[10px] text-gray-400 italic">
                              * These external map links open in a new tab. Results are provided by external map services and are not verified or endorsed by this application.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* No results state */}
                    {(nearbyResult.status === "no_results" || (nearbyResult.status === "ok" && nearbyResult.facilities.length === 0)) && (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
                          <p className="text-sm font-semibold text-gray-700">
                            No verified healthcare facilities found.
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            No facilities matched within {(nearbyResult.search_radius_meters / 1000).toFixed(1)} km. Try expanding your search radius or selecting "All Healthcare".
                          </p>
                        </div>

                        {/* Optional external map link when 0 results found */}
                        {hasValidCoords && (
                          <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                              External Map Search (User-Initiated)
                            </span>
                            <p className="text-xs text-gray-700 mt-1">
                              You can also perform a separate, user-initiated search on an external map provider:
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2.5">
                              <a
                                href={`https://www.google.com/maps/search/hospital/@${effectiveLat},${effectiveLon},14z`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm hover:bg-gray-100"
                              >
                                <span>Search on Google Maps &rarr;</span>
                              </a>
                              <a
                                href={`https://www.openstreetmap.org/search?query=hospital#map=14/${effectiveLat}/${effectiveLon}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm hover:bg-gray-100"
                              >
                                <span>Search on OpenStreetMap &rarr;</span>
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Facility Cards (Genuine items only, never fabricated) */}
                    {nearbyResult.facilities.length > 0 && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {nearbyResult.facilities.map((f: FacilityItem) => (
                          <div
                            key={f.id}
                            className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-primary-300 transition-colors"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="font-bold text-gray-900 text-sm">{f.name}</h3>
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                                    f.facility_type === "hospital"
                                      ? "bg-red-50 text-red-700 border border-red-200"
                                      : f.facility_type === "blood_bank"
                                      ? "bg-rose-100 text-rose-800 border border-rose-300"
                                      : f.facility_type === "pharmacy"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : "bg-blue-50 text-blue-700 border border-blue-200"
                                  }`}
                                >
                                  {f.facility_type.replace("_", " ")}
                                </span>
                              </div>

                              {f.address && (
                                <p className="mt-1 text-xs text-gray-600 line-clamp-2">{f.address}</p>
                              )}

                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                {f.distance_meters !== null && f.distance_meters !== undefined && (
                                  <span className="font-medium text-gray-700">
                                    {(f.distance_meters / 1000).toFixed(2)} km away
                                  </span>
                                )}
                                {f.phone && (
                                  <a href={`tel:${f.phone}`} className="text-primary-700 hover:underline">
                                    {f.phone}
                                  </a>
                                )}
                              </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                              <span className="text-[10px] text-gray-400 truncate max-w-[50%]">
                                {f.source}
                              </span>
                              {f.latitude && f.longitude && (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${f.latitude},${f.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 font-semibold text-primary-700 hover:text-primary-800"
                                >
                                  <span>Directions</span>
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Attribution footer */}
                    {nearbyResult.source_attribution?.length > 0 && (
                      <div className="pt-2 text-center text-[10px] text-gray-400">
                        {nearbyResult.source_attribution.join(" • ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
