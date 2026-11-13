"""Notification provider interface and delivery status abstractions."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod


class NotificationProviderNotConfiguredError(Exception):
    """Raised when an external notification provider is not configured."""


class NotificationDeliveryProvider(ABC):
    """Abstract interface for medicine reminder delivery."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the provider."""
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        """Return True if the provider is fully configured with valid credentials."""
        pass

    @abstractmethod
    async def send_dose_reminder(
        self,
        user_id: uuid.UUID,
        medicine_name: str,
        scheduled_time_str: str,
        recipient_phone: str | None = None,
    ) -> bool:
        """Send a reminder. Must raise NotificationProviderNotConfiguredError if unconfigured."""
        pass
