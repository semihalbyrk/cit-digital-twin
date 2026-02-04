"""Tests for data loaders."""

import os
import pytest
import pandas as pd

from src.core.loaders import (
    load_task_data,
    load_distance_matrix,
    load_service_points,
    load_parameters,
    dataframe_to_tasks,
    tasks_to_routes,
    _extract_day_key,
)
from src.utils.constants import DATA_PATHS, DEPOT_NAME, DISPOSAL_NAME


class TestExtractDayKey:
    def test_valid_filenames(self):
        assert _extract_day_key("CIT_Tasks_Route - 06.01.csv") == "tuesday"
        assert _extract_day_key("CIT_Tasks_Route - 07.01.csv") == "wednesday"
        assert _extract_day_key("CIT_Tasks_Route - 11.01.csv") == "saturday"

    def test_invalid_filename(self):
        assert _extract_day_key("random_file.csv") is None
        assert _extract_day_key("data_99.99.csv") is None


class TestLoadTaskData:
    def test_loads_all_days(self):
        data = load_task_data()
        assert len(data) == 5
        assert 'tuesday' in data
        assert 'saturday' in data

    def test_dataframe_has_expected_columns(self):
        data = load_task_data()
        df = data['tuesday']
        assert 'task_id' in df.columns
        assert 'service_point' in df.columns
        assert 'task_status' in df.columns
        assert 'arrive_time_minutes' in df.columns

    def test_row_count(self):
        data = load_task_data()
        # Each file should have ~326-327 rows
        for day, df in data.items():
            assert len(df) > 300, f"{day} has too few rows: {len(df)}"

    def test_task_statuses_valid(self):
        data = load_task_data()
        for day, df in data.items():
            statuses = df['task_status'].unique()
            for s in statuses:
                assert s in ('Done', 'Visited', 'To-Do'), f"Invalid status '{s}' in {day}"


class TestLoadDistanceMatrix:
    def test_loads_and_is_square(self):
        dm = load_distance_matrix()
        assert dm.shape[0] == dm.shape[1]

    def test_contains_depot_and_disposal(self):
        dm = load_distance_matrix()
        assert DEPOT_NAME in dm.index
        assert DISPOSAL_NAME in dm.index

    def test_diagonal_is_zero(self):
        dm = load_distance_matrix()
        for i in range(min(10, dm.shape[0])):
            assert abs(dm.iloc[i, i]) < 0.001

    def test_values_are_positive(self):
        dm = load_distance_matrix()
        assert (dm >= 0).all().all()


class TestLoadServicePoints:
    def test_loads_with_coordinates(self):
        sp = load_service_points()
        assert 'sp_id' in sp.columns
        assert 'latitude' in sp.columns
        assert 'longitude' in sp.columns
        assert len(sp) > 300

    def test_depot_present(self):
        sp = load_service_points()
        assert DEPOT_NAME in sp['sp_id'].values


class TestLoadParameters:
    def test_loads_yaml(self):
        params = load_parameters()
        assert 'vehicle' in params
        assert 'operational' in params
        assert params['vehicle']['truck_speed_kmh'] == 35


class TestDataframeToTasks:
    def test_conversion(self):
        data = load_task_data()
        df = data['tuesday']
        tasks = dataframe_to_tasks(df)
        assert len(tasks) == len(df)
        assert tasks[0].task_id != ''
        assert tasks[0].service_point != ''


class TestTasksToRoutes:
    def test_grouping(self):
        data = load_task_data()
        tasks = dataframe_to_tasks(data['tuesday'])
        routes = tasks_to_routes(tasks)
        assert len(routes) >= 1
        total = sum(r.total_tasks for r in routes)
        assert total == len(tasks)
