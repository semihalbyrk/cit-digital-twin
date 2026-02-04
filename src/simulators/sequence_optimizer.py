"""Nearest-neighbour TSP sequence optimizer."""

from typing import List, Set

import pandas as pd

from src.core.loaders import get_distance
from src.utils.constants import DEPOT_NAME, DISPOSAL_NAME


def nearest_neighbor_tsp(
    service_points: List[str],
    distance_matrix: pd.DataFrame,
    start: str = DEPOT_NAME,
) -> List[str]:
    """Order service points using nearest-neighbour heuristic.

    Args:
        service_points: List of SP IDs to visit.
        distance_matrix: Distance matrix DataFrame.
        start: Starting point (depot).

    Returns:
        Reordered list of SP IDs.
    """
    if not service_points:
        return []

    unvisited: Set[str] = set(service_points)
    current = start
    ordered: List[str] = []

    while unvisited:
        nearest = min(
            unvisited,
            key=lambda sp: get_distance(distance_matrix, current, sp),
        )
        ordered.append(nearest)
        unvisited.remove(nearest)
        current = nearest

    return ordered


def calculate_sequence_distance(
    sequence: List[str],
    distance_matrix: pd.DataFrame,
) -> float:
    """Calculate total distance for a given sequence (depot → SPs → disposal → depot)."""
    if not sequence:
        return 0.0

    total = get_distance(distance_matrix, DEPOT_NAME, sequence[0])

    for i in range(len(sequence) - 1):
        total += get_distance(distance_matrix, sequence[i], sequence[i + 1])

    total += get_distance(distance_matrix, sequence[-1], DISPOSAL_NAME)
    total += get_distance(distance_matrix, DISPOSAL_NAME, DEPOT_NAME)

    return total
