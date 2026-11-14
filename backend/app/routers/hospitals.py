"""Hospitals and nearby healthcare facilities router."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.hospitals import NearbyFacilitiesResponse
from app.services.places_service import search_nearby_facilities

router = APIRouter(prefix="/hospitals", tags=["hospitals"])


@router.get("", response_model=NearbyFacilitiesResponse)
async def get_nearby_hospitals(
    lat: float = Query(
        ...,
        ge=-90.0,
        le=90.0,
        description="Latitude of the search center point (-90 to 90)",
    ),
    lon: float = Query(
        ...,
        ge=-180.0,
        le=180.0,
        description="Longitude of the search center point (-180 to 180)",
    ),
    radius: int = Query(
        default=5000,
        ge=500,
        le=50000,
        description="Search radius in meters (500m to 50km). Defaults to 5000m (5km).",
    ),
    facility_type: Literal["all", "hospital", "clinic", "pharmacy", "blood_bank"] = Query(
        default="all",
        description="Filter by healthcare facility type",
    ),
    _current_user: User = Depends(get_current_user),
) -> NearbyFacilitiesResponse:
    """Search for verified nearby healthcare facilities (hospitals, clinics, pharmacies, blood banks).

    Requires authentication. Uses Geoapify Places as primary directory with OpenStreetMap Overpass
    for blood banks and best-effort fallback. All results are real and include source attribution.
    """
    return await search_nearby_facilities(
        latitude=lat,
        longitude=lon,
        radius_meters=radius,
        facility_type=facility_type,
    )

