"""Notification provider implementations (In-App and External SMS stub)."""

from __future__ import annotations

import logging
import uuid

from app.services.notifications.base import (
    NotificationDeliveryProvider,
    NotificationProviderNotConfiguredError,
)

logger = logging.getLogger(__name__)


class InAppNotificationProvider(NotificationDeliveryProvider):
    """In-app reminder provider. Always available; reminders are surfaced in user dashboard/view."""

    @property
    def provider_name(self) -> str:
        return "In-App Notifications"

    def is_configured(self) -> bool:
        return True

    async def send_dose_reminder(
        self,
        user_id: uuid.UUID,
        medicine_name: str,
        scheduled_time_str: str,
        recipient_phone: str | None = None,
    ) -> bool:
        # In-app reminders are persisted via scheduled doses & dose logs queries
        logger.info(
            "In-app dose reminder registered for user %s: %s at %s",
            user_id,
            medicine_name,
            scheduled_time_str,
        )
        return True


class ExternalSMSProvider(NotificationDeliveryProvider):
    """External SMS/WhatsApp notification provider (e.g. Twilio).

    Strict rule: Never report SMS/WhatsApp as sent when credentials are unconfigured.
    """

    def __init__(self, account_sid: str | None = None, auth_token: str | None = None) -> None:
        self.account_sid = account_sid
        self.auth_token = auth_token

    @property
    def provider_name(self) -> str:
        return "External SMS / WhatsApp"

    def is_configured(self) -> bool:
        return bool(self.account_sid and self.auth_token and self.account_sid.strip())

    async def send_dose_reminder(
        self,
        user_id: uuid.UUID,
        medicine_name: str,
        scheduled_time_str: str,
        recipient_phone: str | None = None,
    ) -> bool:
        if not self.is_configured():
            raise NotificationProviderNotConfiguredError(
                "External SMS delivery is not configured. Twilio credentials are missing in backend environment."
            )

        # When credentials are provided in the future, Twilio client call goes here
        logger.info("External SMS dispatched to %s for %s", recipient_phone, medicine_name)
        return True
