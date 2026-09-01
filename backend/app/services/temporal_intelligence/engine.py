"""Leakage-safe rolling-window temporal intelligence."""

from __future__ import annotations

from bisect import bisect_left, bisect_right
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from statistics import fmean
from typing import Any

from app.services.entity_resolution.models import RelationshipGraph
from app.services.synthetic_data.dataset import SyntheticDataset

from .config import TemporalIntelligenceConfig
from .models import (
    TemporalFeatureVector,
    TemporalIntelligenceResult,
    TemporalIntelligenceSummary,
)


@dataclass(frozen=True, slots=True)
class _ApplicationEvent:
    application_id: str
    customer_id: str
    dealer_id: str
    submitted_at: datetime
    device_ids: tuple[str, ...]
    account_ids: tuple[str, ...]


class _EventIndex:
    def __init__(self, events_by_key: dict[str, list[_ApplicationEvent]]) -> None:
        self.events_by_key: dict[str, tuple[_ApplicationEvent, ...]] = {}
        self.timestamps_by_key: dict[str, tuple[datetime, ...]] = {}
        for key, events in events_by_key.items():
            ordered = tuple(
                sorted(events, key=lambda item: (item.submitted_at, item.application_id))
            )
            self.events_by_key[key] = ordered
            self.timestamps_by_key[key] = tuple(event.submitted_at for event in ordered)

    def between(self, key: str, start: datetime, end: datetime) -> tuple[_ApplicationEvent, ...]:
        timestamps = self.timestamps_by_key.get(key, ())
        events = self.events_by_key.get(key, ())
        left = bisect_left(timestamps, start)
        right = bisect_right(timestamps, end)
        return events[left:right]


class TemporalIntelligenceEngine:
    """Calculate application-time velocity, growth, burst, and recency features."""

    def __init__(self, config: TemporalIntelligenceConfig | None = None) -> None:
        self.config = config or TemporalIntelligenceConfig()

    def analyze(
        self, dataset: SyntheticDataset, relationship_graph: RelationshipGraph
    ) -> TemporalIntelligenceResult:
        events = self._build_events(dataset.tables, relationship_graph)
        dealer_index, device_index, account_index, customer_index = self._build_indexes(events)
        features = tuple(
            self._features_for_event(
                event,
                dealer_index=dealer_index,
                device_index=device_index,
                account_index=account_index,
                customer_index=customer_index,
            )
            for event in events
        )
        return TemporalIntelligenceResult(
            summary=self._summarize(features),
            features=features,
        )

    @staticmethod
    def _build_events(
        tables: dict[str, list[dict[str, Any]]], relationship_graph: RelationshipGraph
    ) -> tuple[_ApplicationEvent, ...]:
        applications = tables.get("applications")
        if applications is None:
            raise ValueError("temporal intelligence requires the applications table")

        devices_by_customer: dict[str, list[tuple[str, datetime]]] = defaultdict(list)
        accounts_by_customer: dict[str, list[tuple[str, datetime]]] = defaultdict(list)
        for edge in relationship_graph.direct_edges:
            if edge.relationship_type not in {"uses_device", "linked_account"}:
                continue
            first_seen_at = TemporalIntelligenceEngine._parse_timestamp(edge.first_seen_at)
            target = (
                devices_by_customer
                if edge.relationship_type == "uses_device"
                else accounts_by_customer
            )
            target[edge.customer_id].append((edge.entity_id, first_seen_at))

        events = []
        for row in applications:
            submitted_at = TemporalIntelligenceEngine._parse_timestamp(str(row["submitted_at"]))
            customer_id = str(row["customer_id"])
            events.append(
                _ApplicationEvent(
                    application_id=str(row["application_id"]),
                    customer_id=customer_id,
                    dealer_id=str(row["dealer_id"]),
                    submitted_at=submitted_at,
                    device_ids=tuple(
                        sorted(
                            entity_id
                            for entity_id, first_seen_at in devices_by_customer[customer_id]
                            if first_seen_at <= submitted_at
                        )
                    ),
                    account_ids=tuple(
                        sorted(
                            entity_id
                            for entity_id, first_seen_at in accounts_by_customer[customer_id]
                            if first_seen_at <= submitted_at
                        )
                    ),
                )
            )
        return tuple(sorted(events, key=lambda item: (item.submitted_at, item.application_id)))

    @staticmethod
    def _build_indexes(
        events: tuple[_ApplicationEvent, ...],
    ) -> tuple[_EventIndex, _EventIndex, _EventIndex, _EventIndex]:
        dealers: dict[str, list[_ApplicationEvent]] = defaultdict(list)
        devices: dict[str, list[_ApplicationEvent]] = defaultdict(list)
        accounts: dict[str, list[_ApplicationEvent]] = defaultdict(list)
        customers: dict[str, list[_ApplicationEvent]] = defaultdict(list)
        for event in events:
            dealers[event.dealer_id].append(event)
            customers[event.customer_id].append(event)
            for device_id in event.device_ids:
                devices[device_id].append(event)
            for account_id in event.account_ids:
                accounts[account_id].append(event)
        return (
            _EventIndex(dealers),
            _EventIndex(devices),
            _EventIndex(accounts),
            _EventIndex(customers),
        )

    def _features_for_event(
        self,
        event: _ApplicationEvent,
        *,
        dealer_index: _EventIndex,
        device_index: _EventIndex,
        account_index: _EventIndex,
        customer_index: _EventIndex,
    ) -> TemporalFeatureVector:
        dealer_start = event.submitted_at - timedelta(hours=self.config.dealer_burst_window_hours)
        device_start = event.submitted_at - timedelta(hours=self.config.device_burst_window_hours)
        account_start = event.submitted_at - timedelta(hours=self.config.account_window_hours)
        recent_start = event.submitted_at - timedelta(hours=self.config.network_recent_window_hours)
        baseline_start = event.submitted_at - timedelta(
            days=self.config.network_baseline_window_days
        )

        dealer_events = dealer_index.between(event.dealer_id, dealer_start, event.submitted_at)
        device_groups = [
            device_index.between(device_id, device_start, event.submitted_at)
            for device_id in event.device_ids
        ]
        account_groups_24h = [
            account_index.between(account_id, account_start, event.submitted_at)
            for account_id in event.account_ids
        ]
        account_groups_2h = [
            account_index.between(account_id, device_start, event.submitted_at)
            for account_id in event.account_ids
        ]
        customer_events = customer_index.between(
            event.customer_id,
            event.submitted_at - timedelta(days=self.config.customer_velocity_window_days),
            event.submitted_at,
        )

        velocity_events = self._unique_events(
            dealer_events,
            *device_groups,
            *account_groups_2h,
        )
        linked_events = self._linked_events(
            event,
            start=baseline_start,
            dealer_index=dealer_index,
            device_index=device_index,
            account_index=account_index,
        )
        recency_events = self._linked_events(
            event,
            start=event.submitted_at - timedelta(hours=self.config.recency_horizon_hours),
            dealer_index=dealer_index,
            device_index=device_index,
            account_index=account_index,
        )
        recent_applicants = {
            item.customer_id for item in linked_events if item.submitted_at >= recent_start
        }
        prior_applicants = {
            item.customer_id for item in linked_events if item.submitted_at < recent_start
        }
        latest_link = max((item.submitted_at for item in recency_events), default=None)
        if latest_link is None:
            hours_since_latest_link = None
            recency_score = 0.0
        else:
            hours_since_latest_link = round(
                (event.submitted_at - latest_link).total_seconds() / 3600, 4
            )
            recency_score = round(
                2 ** (-hours_since_latest_link / self.config.recency_half_life_hours), 6
            )

        burst_signal_types = []
        threshold = self.config.rapid_burst_min_unique_applicants
        if self._unique_customer_count(dealer_events) >= threshold:
            burst_signal_types.append("dealer_2h")
        if any(self._unique_customer_count(group) >= threshold for group in device_groups):
            burst_signal_types.append("device_2h")

        return TemporalFeatureVector(
            application_id=event.application_id,
            customer_id=event.customer_id,
            as_of=event.submitted_at.isoformat().replace("+00:00", "Z"),
            applications_same_device_2h=max((len(group) for group in device_groups), default=0),
            applications_same_dealer_2h=len(dealer_events),
            applications_same_account_24h=max(
                (len(group) for group in account_groups_24h), default=0
            ),
            customer_applications_30d=len(customer_events),
            application_velocity_2h=len(velocity_events),
            linked_applicants_24h=len(recent_applicants),
            network_prior_applicants_30d=len(prior_applicants),
            network_growth_rate_24h=round(
                len(recent_applicants) / max(1, len(prior_applicants)), 4
            ),
            hours_since_latest_link=hours_since_latest_link,
            recency_score=recency_score,
            rapid_burst_detected=bool(burst_signal_types),
            burst_signal_types=tuple(burst_signal_types),
        )

    def _linked_events(
        self,
        event: _ApplicationEvent,
        *,
        start: datetime,
        dealer_index: _EventIndex,
        device_index: _EventIndex,
        account_index: _EventIndex,
    ) -> tuple[_ApplicationEvent, ...]:
        groups = [dealer_index.between(event.dealer_id, start, event.submitted_at)]
        groups.extend(
            device_index.between(device_id, start, event.submitted_at)
            for device_id in event.device_ids
        )
        groups.extend(
            account_index.between(account_id, start, event.submitted_at)
            for account_id in event.account_ids
        )
        return tuple(
            item
            for item in self._unique_events(*groups)
            if item.application_id != event.application_id and item.customer_id != event.customer_id
        )

    @staticmethod
    def _unique_events(*groups: tuple[_ApplicationEvent, ...]) -> tuple[_ApplicationEvent, ...]:
        by_application = {event.application_id: event for group in groups for event in group}
        return tuple(
            sorted(
                by_application.values(),
                key=lambda item: (item.submitted_at, item.application_id),
            )
        )

    @staticmethod
    def _unique_customer_count(events: tuple[_ApplicationEvent, ...]) -> int:
        return len({event.customer_id for event in events})

    @staticmethod
    def _summarize(
        features: tuple[TemporalFeatureVector, ...],
    ) -> TemporalIntelligenceSummary:
        burst_count = sum(feature.rapid_burst_detected for feature in features)
        return TemporalIntelligenceSummary(
            application_count=len(features),
            rapid_burst_application_count=burst_count,
            rapid_burst_rate=round(burst_count / len(features), 6) if features else 0.0,
            peak_application_velocity_2h=max(
                (feature.application_velocity_2h for feature in features), default=0
            ),
            peak_dealer_applications_2h=max(
                (feature.applications_same_dealer_2h for feature in features), default=0
            ),
            peak_device_applications_2h=max(
                (feature.applications_same_device_2h for feature in features), default=0
            ),
            peak_account_applications_24h=max(
                (feature.applications_same_account_24h for feature in features), default=0
            ),
            average_network_growth_rate_24h=(
                round(fmean(feature.network_growth_rate_24h for feature in features), 4)
                if features
                else 0.0
            ),
            average_recency_score=(
                round(fmean(feature.recency_score for feature in features), 6) if features else 0.0
            ),
        )

    @staticmethod
    def _parse_timestamp(value: str) -> datetime:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError(f"timestamp must be timezone-aware: {value}")
        return parsed
