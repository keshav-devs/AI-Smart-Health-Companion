"""Schemas for nearby healthcare facilities search."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class FacilityItem(BaseModel):
    """Verified healthcare facility nearby."""

    id: str
    name: str
    facility_type: Literal["hospital", "clinic", "pharmacy", "blood_bank", "other"]
    address: str | None = None
    distance_meters: float | None = None
    latitude: float | None = None
    longitude: float | None = None
    phone: str | None = None
    source: str
    attribution: str


class NearbyFacilitiesResponse(BaseModel):
    """List of verified healthcare facilities with provenance and attributions."""

    facilities: list[FacilityItem] = Field(default_factory=list)
    count: int
    search_center: dict[str, float]
    search_radius_meters: int
    retrieval_time: datetime
    source_attribution: list[str] = Field(default_factory=list)
    status: Literal["ok", "no_results", "provider_unavailable"]
    notes: str | None = None

