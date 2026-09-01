"""Deterministic train/validation/test splits isolated by suspicious ecosystem."""

from __future__ import annotations

import random
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from .config import MLTrainingConfig
from .feature_builder import MLFeatureDataset


@dataclass(frozen=True, slots=True)
class DatasetSplit:
    train_indices: NDArray[np.int64]
    validation_indices: NDArray[np.int64]
    test_indices: NDArray[np.int64]

    def counts(self, labels: NDArray[np.int64]) -> dict[str, dict[str, int]]:
        return {
            name: {
                "rows": int(len(indices)),
                "normal": int((labels[indices] == 0).sum()),
                "suspicious": int((labels[indices] == 1).sum()),
            }
            for name, indices in (
                ("train", self.train_indices),
                ("validation", self.validation_indices),
                ("test", self.test_indices),
            )
        }


class EcosystemGroupedSplitter:
    """Split positive ecosystems and singleton normal groups independently."""

    def __init__(self, config: MLTrainingConfig | None = None) -> None:
        self.config = config or MLTrainingConfig()

    def split(self, dataset: MLFeatureDataset) -> DatasetSplit:
        positive_groups = sorted(
            {
                group
                for group, label in zip(dataset.groups, dataset.labels, strict=True)
                if label == 1
            }
        )
        normal_groups = sorted(
            {
                group
                for group, label in zip(dataset.groups, dataset.labels, strict=True)
                if label == 0
            }
        )
        if len(positive_groups) < 3 or len(normal_groups) < 3:
            raise ValueError("at least three positive and normal groups are required")

        positive_partitions = self._partition_groups(positive_groups, self.config.random_seed)
        normal_partitions = self._partition_groups(normal_groups, self.config.random_seed + 1)
        split_groups = {
            name: positive_partitions[name] | normal_partitions[name]
            for name in ("train", "validation", "test")
        }
        split = DatasetSplit(
            train_indices=self._indices_for_groups(dataset.groups, split_groups["train"]),
            validation_indices=self._indices_for_groups(dataset.groups, split_groups["validation"]),
            test_indices=self._indices_for_groups(dataset.groups, split_groups["test"]),
        )
        self._validate(dataset, split)
        return split

    def _partition_groups(self, groups: list[str], seed: int) -> dict[str, set[str]]:
        shuffled = list(groups)
        random.Random(seed).shuffle(shuffled)
        count = len(shuffled)
        train_count = max(1, int(count * self.config.train_ratio))
        validation_count = max(1, int(count * self.config.validation_ratio))
        if train_count + validation_count >= count:
            train_count = max(1, count - 2)
            validation_count = 1
        return {
            "train": set(shuffled[:train_count]),
            "validation": set(shuffled[train_count : train_count + validation_count]),
            "test": set(shuffled[train_count + validation_count :]),
        }

    @staticmethod
    def _indices_for_groups(
        row_groups: tuple[str, ...], selected_groups: set[str]
    ) -> NDArray[np.int64]:
        return np.asarray(
            [index for index, group in enumerate(row_groups) if group in selected_groups],
            dtype=np.int64,
        )

    @staticmethod
    def _validate(dataset: MLFeatureDataset, split: DatasetSplit) -> None:
        index_sets = [
            set(split.train_indices.tolist()),
            set(split.validation_indices.tolist()),
            set(split.test_indices.tolist()),
        ]
        if any(
            left & right
            for index, left in enumerate(index_sets)
            for right in index_sets[index + 1 :]
        ):
            raise ValueError("split row indices overlap")
        if set().union(*index_sets) != set(range(len(dataset.application_ids))):
            raise ValueError("split does not cover every feature row")

        group_sets = [
            {dataset.groups[index] for index in indices}
            for indices in (
                split.train_indices,
                split.validation_indices,
                split.test_indices,
            )
        ]
        if any(
            left & right
            for index, left in enumerate(group_sets)
            for right in group_sets[index + 1 :]
        ):
            raise ValueError("ecosystem groups overlap across splits")
        for indices in (split.train_indices, split.validation_indices, split.test_indices):
            labels = set(dataset.labels[indices].tolist())
            if labels != {0, 1}:
                raise ValueError("each split must contain normal and suspicious rows")
