"""Nearby healthcare facilities search service using Geoapify and OpenStreetMap Overpass."""

from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import settings
from app.schemas.hospitals import FacilityItem, NearbyFacilitiesResponse

logger = logging.getLogger(__name__)

GEOAPIFY_PLACES_URL = "https://api.geoapify.com/v2/places"
OVERPASS_API_URL = "https://overpass-api.de/api/interpreter"

# Confirmed valid Geoapify categories
GEOAPIFY_CATEGORY_MAP = {
    "hospital": "healthcare.hospital",
    "clinic": "healthcare.clinic_or_praxis",
    "pharmacy": "healthcare.pharmacy",
    "all": "healthcare.hospital,healthcare.clinic_or_praxis,healthcare.pharmacy",
}


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two coordinates in meters."""
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 1)


async def fetch_geoapify_facilities(
    lat: float,
    lon: float,
    radius_meters: int,
    facility_type: str,
) -> tuple[list[FacilityItem], bool]:
    """Fetch healthcare places via Geoapify Places API v2.

    Returns:
        (facilities_list, success_boolean)
    """
    if not settings.GEOAPIFY_API_KEY or not settings.GEOAPIFY_API_KEY.strip():
        logger.info("GEOAPIFY_API_KEY is not configured; skipping Geoapify search.")
        return [], False

    categories = GEOAPIFY_CATEGORY_MAP.get(facility_type, GEOAPIFY_CATEGORY_MAP["all"])
    params = {
        "categories": categories,
        "filter": f"circle:{lon},{lat},{radius_meters}",
        "bias": f"proximity:{lon},{lat}",
        "limit": 25,
        "apiKey": settings.GEOAPIFY_API_KEY,
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(GEOAPIFY_PLACES_URL, params=params)

        if resp.status_code != 200:
            logger.warning("Geoapify Places API responded with status %d: %s", resp.status_code, resp.text[:200])
            return [], False

        data = resp.json()
        features = data.get("features", [])
        results: list[FacilityItem] = []

        for f in features:
            props = f.get("properties", {})
            name = props.get("name") or props.get("address_line1")
            if not name:
                continue

            cats = props.get("categories", [])
            item_type: str = "hospital"
            if any("clinic" in c for c in cats):
                item_type = "clinic"
            elif any("pharmacy" in c or "chemist" in c for c in cats):
                item_type = "pharmacy"
            elif any("hospital" in c for c in cats):
                item_type = "hospital"
            else:
                item_type = "other"

            f_lat = props.get("lat")
            f_lon = props.get("lon")
            dist = props.get("distance")
            if dist is None and f_lat is not None and f_lon is not None:
                dist = haversine_distance(lat, lon, f_lat, f_lon)

            place_id = props.get("place_id") or f"geoapify_{f_lat}_{f_lon}_{len(results)}"
            address = props.get("formatted") or props.get("address_line2") or props.get("address_line1")
            contact_info = props.get("contact", {})
            phone_raw = contact_info.get("phone") if isinstance(contact_info, dict) else None
            phone = str(phone_raw).strip() if phone_raw is not None else None

            results.append(
                FacilityItem(
                    id=str(place_id),
                    name=str(name).strip(),
                    facility_type=item_type,
                    address=address,
                    distance_meters=float(dist) if dist is not None else None,
                    latitude=float(f_lat) if f_lat is not None else None,
                    longitude=float(f_lon) if f_lon is not None else None,
                    phone=phone,
                    source="Geoapify Places",
                    attribution="Powered by Geoapify | © OpenStreetMap contributors",
                )
            )

        return results, True

    except Exception as exc:
        logger.warning("Geoapify Places request failed: %s: %s", type(exc).__name__, exc)
        return [], False


async def fetch_overpass_blood_banks(
    lat: float,
    lon: float,
    radius_meters: int,
) -> tuple[list[FacilityItem], bool]:
    """Fetch blood bank facilities via OpenStreetMap Overpass API."""
    query = f"""[out:json][timeout:8];
(
  node["amenity"="blood_bank"](around:{radius_meters},{lat},{lon});
  way["amenity"="blood_bank"](around:{radius_meters},{lat},{lon});
  node["healthcare"="blood_bank"](around:{radius_meters},{lat},{lon});
  way["healthcare"="blood_bank"](around:{radius_meters},{lat},{lon});
);
out center 15;"""

    osm_headers = {
        "User-Agent": "SmartHealthCompanion/1.0 (HealthcareEmergencyDirectory; health@example.com)",
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(OVERPASS_API_URL, data={"data": query}, headers=osm_headers)

        if resp.status_code != 200:
            logger.warning("Overpass API blood bank query returned status %d", resp.status_code)
            return [], False

        data = resp.json()
        elements = data.get("elements", [])
        results: list[FacilityItem] = []

        for el in elements:
            tags = el.get("tags", {})
            name = tags.get("name") or tags.get("operator") or "Blood Bank"
            f_lat = el.get("lat") or el.get("center", {}).get("lat")
            f_lon = el.get("lon") or el.get("center", {}).get("lon")

            dist = None
            if f_lat is not None and f_lon is not None:
                dist = haversine_distance(lat, lon, f_lat, f_lon)

            # Build address string from OSM address tags
            addr_parts = [
                tags.get("addr:housenumber"),
                tags.get("addr:street"),
                tags.get("addr:city") or tags.get("addr:suburb"),
            ]
            address = ", ".join(p for p in addr_parts if p) or tags.get("address")

            raw_phone = tags.get("phone") or tags.get("contact:phone")
            phone = str(raw_phone).strip() if raw_phone is not None else None

            results.append(
                FacilityItem(
                    id=f"osm_blood_bank_{el.get('id', len(results))}",
                    name=str(name).strip(),
                    facility_type="blood_bank",
                    address=address,
                    distance_meters=dist,
                    latitude=f_lat,
                    longitude=f_lon,
                    phone=phone,
                    source="OpenStreetMap Overpass",
                    attribution="Data © OpenStreetMap contributors under ODbL",
                )
            )

        return results, True

    except Exception as exc:
        logger.warning("Overpass blood bank request failed: %s: %s", type(exc).__name__, exc)
        return [], False


async def fetch_overpass_fallback_facilities(
    lat: float,
    lon: float,
    radius_meters: int,
    facility_type: str,
) -> tuple[list[FacilityItem], bool]:
    """Fallback query to OpenStreetMap Overpass when primary directory is unavailable."""
    if facility_type == "hospital":
        tag_filter = '["amenity"="hospital"]'
    elif facility_type == "clinic":
        tag_filter = '["amenity"~"clinic|doctors"]'
    elif facility_type == "pharmacy":
        tag_filter = '["amenity"="pharmacy"]'
    else:
        tag_filter = '["amenity"~"hospital|clinic|pharmacy"]'

    query = f"""[out:json][timeout:8];
(
  node{tag_filter}(around:{radius_meters},{lat},{lon});
  way{tag_filter}(around:{radius_meters},{lat},{lon});
);
out center 25;"""

    osm_headers = {
        "User-Agent": "SmartHealthCompanion/1.0 (HealthcareEmergencyDirectory; health@example.com)",
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(OVERPASS_API_URL, data={"data": query}, headers=osm_headers)

        if resp.status_code != 200:
            return [], False

        data = resp.json()
        elements = data.get("elements", [])
        results: list[FacilityItem] = []

        for el in elements:
            tags = el.get("tags", {})
            name = tags.get("name")
            if not name:
                continue

            amenity = tags.get("amenity", "")
            f_type: str = "hospital"
            if "clinic" in amenity or "doctors" in amenity:
                f_type = "clinic"
            elif "pharmacy" in amenity:
                f_type = "pharmacy"
            elif "hospital" in amenity:
                f_type = "hospital"
            else:
                f_type = "other"

            f_lat = el.get("lat") or el.get("center", {}).get("lat")
            f_lon = el.get("lon") or el.get("center", {}).get("lon")

            dist = None
            if f_lat is not None and f_lon is not None:
                dist = haversine_distance(lat, lon, f_lat, f_lon)

            addr_parts = [
                tags.get("addr:housenumber"),
                tags.get("addr:street"),
                tags.get("addr:city"),
            ]
            address = ", ".join(p for p in addr_parts if p) or tags.get("address")
            raw_phone = tags.get("phone") or tags.get("contact:phone")
            phone = str(raw_phone).strip() if raw_phone is not None else None

            results.append(
                FacilityItem(
                    id=f"osm_{el.get('id', len(results))}",
                    name=str(name).strip(),
                    facility_type=f_type,
                    address=address,
                    distance_meters=dist,
                    latitude=f_lat,
                    longitude=f_lon,
                    phone=phone,
                    source="OpenStreetMap Overpass",
                    attribution="Data © OpenStreetMap contributors under ODbL",
                )
            )

        return results, True

    except Exception as exc:
        logger.warning("Overpass fallback request failed: %s: %s", type(exc).__name__, exc)
        return [], False


async def search_nearby_facilities(
    latitude: float,
    longitude: float,
    radius_meters: int = 5000,
    facility_type: str = "all",
) -> NearbyFacilitiesResponse:
    """Orchestrate verified healthcare facilities search with provenance and fallback handling.

    Rules:
    - Never fabricates facilities.
    - Uses Geoapify Places as primary provider for hospitals, clinics, and pharmacies.
    - Uses OpenStreetMap Overpass for blood banks and as a best-effort public fallback.
    - Handles timeouts and provider failures gracefully.
    - Includes source attribution and retrieval timestamp.
    """
    facilities: list[FacilityItem] = []
    attributions: list[str] = []
    geoapify_ok = False
    overpass_ok = False

    # 1. Primary Search via Geoapify (unless exclusively blood_bank was requested)
    if facility_type != "blood_bank":
        geo_results, geo_success = await fetch_geoapify_facilities(
            lat=latitude,
            lon=longitude,
            radius_meters=radius_meters,
            facility_type=facility_type,
        )
        if geo_success:
            geoapify_ok = True
            facilities.extend(geo_results)
            attributions.append("Geoapify Places (OpenStreetMap data)")

    # 2. Blood banks via Overpass API (when facility_type is 'all' or 'blood_bank')
    if facility_type in ("all", "blood_bank"):
        bb_results, bb_success = await fetch_overpass_blood_banks(
            lat=latitude,
            lon=longitude,
            radius_meters=radius_meters,
        )
        if bb_success:
            overpass_ok = True
            facilities.extend(bb_results)
            if "OpenStreetMap contributors (Overpass API)" not in attributions:
                attributions.append("OpenStreetMap contributors (Overpass API)")

    # 3. If primary Geoapify failed or was unconfigured, use Overpass as public fallback
    if not geoapify_ok and facility_type != "blood_bank":
        logger.info("Geoapify unavailable; engaging OpenStreetMap Overpass public fallback...")
        fallback_results, fallback_success = await fetch_overpass_fallback_facilities(
            lat=latitude,
            lon=longitude,
            radius_meters=radius_meters,
            facility_type=facility_type,
        )
        if fallback_success:
            overpass_ok = True
            facilities.extend(fallback_results)
            if "OpenStreetMap contributors (Overpass API)" not in attributions:
                attributions.append("OpenStreetMap contributors (Overpass API)")

    # 4. Deduplicate facilities by name and approximate location
    seen_keys: set[str] = set()
    deduped: list[FacilityItem] = []
    for item in facilities:
        approx_lat = round(item.latitude, 3) if item.latitude is not None else 0.0
        approx_lon = round(item.longitude, 3) if item.longitude is not None else 0.0
        norm_name = item.name.lower().strip()
        key = f"{norm_name}_{approx_lat}_{approx_lon}"
        if key not in seen_keys:
            seen_keys.add(key)
            deduped.append(item)

    # 5. Sort by distance ascending
    deduped.sort(key=lambda x: (x.distance_meters is None, x.distance_meters or 0))

    # 6. Determine status
    if deduped:
        status_val = "ok"
        notes = (
            "Facility operational status, emergency readiness, and resource inventory "
            "(such as blood availability) are not verified in real time. "
            "Contact facilities directly or call emergency medical services."
        )
    elif geoapify_ok or overpass_ok:
        status_val = "no_results"
        notes = f"No verified healthcare facilities found within a {radius_meters / 1000:g} km radius."
    else:
        status_val = "provider_unavailable"
        notes = (
            "Healthcare directory providers are currently unreachable. "
            "If you are experiencing a medical emergency, call your local emergency services (e.g. 911 / 112) immediately."
        )

    return NearbyFacilitiesResponse(
        facilities=deduped,
        count=len(deduped),
        search_center={"latitude": latitude, "longitude": longitude},
        search_radius_meters=radius_meters,
        retrieval_time=datetime.now(timezone.utc),
        source_attribution=attributions or ["OpenStreetMap contributors"],
        status=status_val,
        notes=notes,
    )