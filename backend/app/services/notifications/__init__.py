"""Notification services package."""

from __future__ import annotations

from app.services.notifications.base import (
    NotificationDeliveryProvider,
    NotificationProviderNotConfiguredError,
)
from app.services.notifications.providers import (
    ExternalSMSProvider,
    InAppNotificationProvider,
)

_default_in_app_provider = InAppNotificationProvider()
_default_external_provider = ExternalSMSProvider()


def get_notification_provider() -> InAppNotificationProvider:
    return _default_in_app_provider


def get_external_sms_provider() -> ExternalSMSProvider:
    return _default_external_provider


__all__ = [
    "NotificationDeliveryProvider",
    "NotificationProviderNotConfiguredError",
    "InAppNotificationProvider",
    "ExternalSMSProvider",
    "get_notification_provider",
    "get_external_sms_provider",
]
