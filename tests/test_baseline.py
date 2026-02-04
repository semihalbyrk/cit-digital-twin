"""Tests for baseline simulator."""

import pytest

from src.simulators.baseline_simulator import BaselineSimulator
from src.core.models import BaselineMetrics


class TestBaselineSimulator:
    def test_empty_tasks(self, mock_distance_matrix, sample_parameters):
        sim = BaselineSimulator(mock_distance_matrix, sample_parameters)
        result = sim.calculate_baseline([], baseline_type='actual')
        assert isinstance(result, BaselineMetrics)
        assert result.total_distance_km == 0.0
        assert result.total_cost == 0.0

    def test_actual_baseline(self, sample_tasks, mock_distance_matrix, sample_parameters):
        sim = BaselineSimulator(mock_distance_matrix, sample_parameters)
        result = sim.calculate_baseline(sample_tasks, baseline_type='actual')

        # Only Done tasks should contribute to distance
        assert result.total_distance_km > 0
        assert result.total_time_minutes > 0
        assert result.total_cost > 0
        assert result.co2_emissions_kg > 0
        assert result.tasks_done == 2
        assert result.tasks_visited == 1
        assert result.tasks_todo == 1

    def test_planned_baseline(self, sample_tasks, mock_distance_matrix, sample_parameters):
        sim = BaselineSimulator(mock_distance_matrix, sample_parameters)
        result = sim.calculate_baseline(sample_tasks, baseline_type='planned')

        # All tasks included → more service time
        assert result.total_distance_km > 0
        assert result.tasks_planned == 4

    def test_actionable_baseline(self, sample_tasks, mock_distance_matrix, sample_parameters):
        sim = BaselineSimulator(mock_distance_matrix, sample_parameters)
        result = sim.calculate_baseline(sample_tasks, baseline_type='actionable')

        # Done + Visited = 3 tasks
        assert result.total_distance_km > 0

    def test_completion_rates(self, sample_tasks, mock_distance_matrix, sample_parameters):
        sim = BaselineSimulator(mock_distance_matrix, sample_parameters)
        result = sim.calculate_baseline(sample_tasks, baseline_type='actual')

        # 2 Done out of 4 total
        assert result.completion_rate_vs_plan == 0.5
        assert result.actual_completion_rate == 0.5

    def test_distance_includes_depot_trips(self, sample_tasks, mock_distance_matrix, sample_parameters):
        sim = BaselineSimulator(mock_distance_matrix, sample_parameters)
        result = sim.calculate_baseline(sample_tasks, baseline_type='actual')

        # Distance should include depot → first SP + last SP → disposal → depot
        # Depot to SP ~6.8-7.0, SP to disposal ~25.7-26.0, disposal to depot ~21.5
        assert result.total_distance_km > 50  # At minimum depot round trip

    def test_fuel_cost_formula(self, sample_tasks, mock_distance_matrix, sample_parameters):
        sim = BaselineSimulator(mock_distance_matrix, sample_parameters)
        result = sim.calculate_baseline(sample_tasks, baseline_type='actual')

        # Verify fuel cost = (distance / kml) * price
        expected_fuel = (result.total_distance_km / 6.0) * 1.50
        assert abs(result.fuel_cost - round(expected_fuel, 2)) < 0.02


class TestBaselineTypes:
    def test_planned_has_more_service_time(self, sample_tasks, mock_distance_matrix, sample_parameters):
        sim = BaselineSimulator(mock_distance_matrix, sample_parameters)
        actual = sim.calculate_baseline(sample_tasks, baseline_type='actual')
        planned = sim.calculate_baseline(sample_tasks, baseline_type='planned')

        # Planned includes all 4 tasks, actual only Done (2)
        assert planned.total_service_time_minutes > actual.total_service_time_minutes

    def test_actionable_between_actual_and_planned(self, sample_tasks, mock_distance_matrix, sample_parameters):
        sim = BaselineSimulator(mock_distance_matrix, sample_parameters)
        actual = sim.calculate_baseline(sample_tasks, baseline_type='actual')
        actionable = sim.calculate_baseline(sample_tasks, baseline_type='actionable')
        planned = sim.calculate_baseline(sample_tasks, baseline_type='planned')

        assert actual.total_service_time_minutes <= actionable.total_service_time_minutes
        assert actionable.total_service_time_minutes <= planned.total_service_time_minutes
