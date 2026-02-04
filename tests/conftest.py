"""Shared fixtures for the test suite."""

import pytest
import pandas as pd
import numpy as np

from src.core.models import Task


@pytest.fixture
def sample_tasks():
    """A small set of Task objects for testing."""
    return [
        Task(
            task_id="T001", route_name="Zone 2 B (Day) - V 2.0",
            vehicle_id="REL 1", date="2026-01-06",
            arrive_time="3:43:47 pm", arrive_time_minutes=15 * 60 + 43 + 47 / 60,
            task_status="Done", zone="Albada Zone-2",
            service_point="Z2-BDB-0756", asset_types="1100L, 240L",
            completed_asset_types="1100L", asset_collects=1,
        ),
        Task(
            task_id="T002", route_name="Zone 2 B (Day) - V 2.0",
            vehicle_id="REL 1", date="2026-01-06",
            arrive_time="3:41:11 pm", arrive_time_minutes=15 * 60 + 41 + 11 / 60,
            task_status="Done", zone="Albada Zone-2",
            service_point="Z2-BDB-0814", asset_types="1100L, 240L",
            completed_asset_types="1100L", asset_collects=1,
        ),
        Task(
            task_id="T003", route_name="Zone 2 B (Day) - V 2.0",
            vehicle_id="REL 1", date="2026-01-06",
            task_status="Visited", zone="Albada Zone-2",
            service_point="Z2-BDB-0755", asset_types="1100L, 240L",
            completed_asset_types="", asset_collects=0,
        ),
        Task(
            task_id="T004", route_name="Zone 2 B (Day) - V 2.0",
            vehicle_id="REL 1", date="2026-01-06",
            task_status="To-Do", zone="Albada Zone-2",
            service_point="Z2-BDB-0820", asset_types="1100L, 240L",
            completed_asset_types="", asset_collects=0,
        ),
    ]


@pytest.fixture
def mock_distance_matrix():
    """A small 6×6 distance matrix for testing."""
    labels = [
        "Al Bada Camp 10", "Disposal",
        "Z2-BDB-0756", "Z2-BDB-0814", "Z2-BDB-0755", "Z2-BDB-0820",
    ]
    # Symmetric distances (km)
    data = np.array([
        [0.0, 21.5, 6.8, 7.0, 6.9, 6.8],
        [21.5, 0.0, 25.8, 26.0, 25.7, 25.9],
        [6.8, 25.8, 0.0, 0.3, 0.1, 0.4],
        [7.0, 26.0, 0.3, 0.0, 0.2, 0.5],
        [6.9, 25.7, 0.1, 0.2, 0.0, 0.3],
        [6.8, 25.9, 0.4, 0.5, 0.3, 0.0],
    ])
    return pd.DataFrame(data, index=labels, columns=labels)


@pytest.fixture
def sample_parameters():
    """Default parameters dict."""
    return {
        'vehicle': {
            'truck_speed_kmh': 35,
            'capacity_m3': 20,
            'fuel_consumption_kml': 6.0,
            'fuel_price_usd_per_liter': 1.50,
        },
        'operational': {
            'shift_duration_hours': 8.0,
            'service_time_per_task_minutes': 2.5,
            'depot_unload_time_minutes': 15,
            'labor_rate_usd_per_hour': 25,
        },
        'bins': {
            'bin_1100l_weight_kg': 550,
            'bin_240l_weight_kg': 120,
            'container_weight_kg': 300,
            'average_fill_percent': 80,
        },
        'emissions': {
            'co2_per_liter_kg': 2.31,
        },
    }


@pytest.fixture
def sample_task_dataframes():
    """Mock task data dict (day → DataFrame) for frequency analyzer."""
    base = {
        'task_id': ['T1', 'T2', 'T3'],
        'route_name': ['R1', 'R1', 'R1'],
        'vehicle_id': ['V1', 'V1', 'V1'],
        'service_point': ['SP-001', 'SP-002', 'SP-003'],
        'zone': ['Zone-2', 'Zone-2', 'Zone-2'],
        'asset_types': ['1100L', '1100L', '240L'],
        'completed_asset_types': ['1100L', '1100L', ''],
        'asset_collects': [1, 1, 0],
    }

    days = {
        'tuesday': dict(base, task_status=['Done', 'Done', 'To-Do']),
        'wednesday': dict(base, task_status=['Done', 'Visited', 'To-Do']),
        'thursday': dict(base, task_status=['Done', 'Done', 'Done']),
        'friday': dict(base, task_status=['Visited', 'Done', 'To-Do']),
        'saturday': dict(base, task_status=['Done', 'Done', 'To-Do']),
    }
    return {day: pd.DataFrame(data) for day, data in days.items()}
