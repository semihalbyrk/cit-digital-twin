"""Baseline simulator: 3-tier distance/time/cost/CO2 calculations."""

from typing import Dict, List, Optional

import pandas as pd
from loguru import logger

from src.core.models import Task, BaselineMetrics
from src.core.loaders import get_distance
from src.utils.constants import DEPOT_NAME, DISPOSAL_NAME
from src.utils.helpers import safe_divide


class BaselineSimulator:
    """Compute baseline metrics for a set of tasks given a distance matrix and parameters."""

    def __init__(
        self,
        distance_matrix: pd.DataFrame,
        parameters: Dict,
        service_points: Optional[pd.DataFrame] = None,
    ):
        self.distance_matrix = distance_matrix
        self.params = self._flatten_params(parameters)
        self.service_points = service_points

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def calculate_baseline(
        self,
        tasks: List[Task],
        baseline_type: str = "actual",
    ) -> BaselineMetrics:
        """Calculate baseline metrics for a list of tasks.

        Args:
            tasks: List of Task objects for a single route/day.
            baseline_type: One of 'planned', 'actual', 'actionable'.

        Returns:
            BaselineMetrics with all calculations filled in.
        """
        if not tasks:
            return BaselineMetrics(baseline_type=baseline_type)

        # Determine which tasks to include based on baseline type
        included_tasks = self._filter_tasks(tasks, baseline_type)
        all_tasks_count = len(tasks)

        # Build ordered sequence of service points
        ordered_sps = self._build_sequence(included_tasks)

        # Calculate distance (depot → SP1 → SP2 → ... → SPn → disposal → depot)
        total_distance = self._calculate_route_distance(ordered_sps)

        # Derive time and cost metrics
        speed = self.params.get('truck_speed_kmh', 35)
        service_time_per_task = self.params.get('service_time_per_task_minutes', 2.5)
        depot_unload = self.params.get('depot_unload_time_minutes', 15)
        fuel_kml = self.params.get('fuel_consumption_kml', 6.0)
        fuel_price = self.params.get('fuel_price_usd_per_liter', 1.50)
        labor_rate = self.params.get('labor_rate_usd_per_hour', 25)
        co2_per_liter = self.params.get('co2_per_liter_kg', 2.31)

        travel_time = (total_distance / speed) * 60 if speed > 0 else 0
        service_time = len(included_tasks) * service_time_per_task
        total_time = travel_time + service_time + depot_unload

        fuel_volume = total_distance / fuel_kml if fuel_kml > 0 else 0
        fuel_cost = fuel_volume * fuel_price
        labor_hours = total_time / 60
        labor_cost = labor_hours * labor_rate
        vehicle_cost_per_km = self.params.get('vehicle_operating_cost_per_km', 0.15)
        vehicle_cost = total_distance * vehicle_cost_per_km
        total_cost = fuel_cost + labor_cost + vehicle_cost

        co2 = fuel_volume * co2_per_liter

        # Task counts
        done_count = sum(1 for t in tasks if t.task_status == 'Done')
        visited_count = sum(1 for t in tasks if t.task_status == 'Visited')
        todo_count = sum(1 for t in tasks if t.task_status == 'To-Do')

        route_name = tasks[0].route_name if tasks else ""
        date = tasks[0].date if tasks else ""

        return BaselineMetrics(
            route_name=route_name,
            date=date,
            baseline_type=baseline_type,
            total_distance_km=round(total_distance, 2),
            total_travel_time_minutes=round(travel_time, 2),
            total_service_time_minutes=round(service_time, 2),
            total_time_minutes=round(total_time, 2),
            fuel_cost=round(fuel_cost, 2),
            labor_cost=round(labor_cost, 2),
            vehicle_cost=round(vehicle_cost, 2),
            total_cost=round(total_cost, 2),
            co2_emissions_kg=round(co2, 2),
            tasks_planned=all_tasks_count,
            tasks_done=done_count,
            tasks_visited=visited_count,
            tasks_todo=todo_count,
            completion_rate_vs_plan=round(
                safe_divide(done_count, all_tasks_count), 4
            ),
            actual_completion_rate=round(
                safe_divide(done_count, done_count + visited_count + todo_count), 4
            ),
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _filter_tasks(self, tasks: List[Task], baseline_type: str) -> List[Task]:
        """Filter tasks based on baseline type."""
        if baseline_type == 'planned':
            # Assume all planned tasks are completed
            return tasks
        elif baseline_type == 'actual':
            # Only Done tasks contribute to the actual route
            return [t for t in tasks if t.task_status == 'Done']
        elif baseline_type == 'actionable':
            # Done + Visited (fixable tasks)
            return [t for t in tasks if t.task_status in ('Done', 'Visited')]
        else:
            logger.warning(f"Unknown baseline_type '{baseline_type}', using 'actual'")
            return [t for t in tasks if t.task_status == 'Done']

    def _build_sequence(self, tasks: List[Task]) -> List[str]:
        """Build ordered sequence of service point IDs.

        Done tasks are sorted by arrive_time_minutes.
        Visited tasks are inserted by nearest-neighbour to Done tasks.
        """
        done_tasks = [t for t in tasks if t.task_status == 'Done' and t.arrive_time_minutes is not None]
        done_tasks.sort(key=lambda t: t.arrive_time_minutes)  # type: ignore

        # Tasks without arrive time (Visited / planned-as-Done)
        other_tasks = [t for t in tasks if t not in done_tasks]

        # Start with Done sequence
        sequence = [t.service_point for t in done_tasks]

        # Insert others by nearest neighbour
        for t in other_tasks:
            sp = t.service_point
            if not sequence:
                sequence.append(sp)
                continue
            best_idx = self._find_nearest_insert(sequence, sp)
            sequence.insert(best_idx, sp)

        return sequence

    def _find_nearest_insert(self, sequence: List[str], sp: str) -> int:
        """Find the best position to insert sp into sequence by min added distance."""
        best_idx = len(sequence)  # default: append
        best_cost = float('inf')

        for i in range(len(sequence) + 1):
            prev_sp = sequence[i - 1] if i > 0 else DEPOT_NAME
            next_sp = sequence[i] if i < len(sequence) else DISPOSAL_NAME

            # Cost of inserting sp between prev and next
            old_dist = get_distance(self.distance_matrix, prev_sp, next_sp)
            new_dist = (
                get_distance(self.distance_matrix, prev_sp, sp)
                + get_distance(self.distance_matrix, sp, next_sp)
            )
            added = new_dist - old_dist

            if added < best_cost:
                best_cost = added
                best_idx = i

        return best_idx

    def _calculate_route_distance(self, ordered_sps: List[str]) -> float:
        """Calculate total route distance: depot → SPs → disposal → depot."""
        if not ordered_sps:
            return 0.0

        total = 0.0

        # Depot → first SP
        total += get_distance(self.distance_matrix, DEPOT_NAME, ordered_sps[0])

        # Between consecutive SPs
        for i in range(len(ordered_sps) - 1):
            total += get_distance(self.distance_matrix, ordered_sps[i], ordered_sps[i + 1])

        # Last SP → disposal
        total += get_distance(self.distance_matrix, ordered_sps[-1], DISPOSAL_NAME)

        # Disposal → depot
        total += get_distance(self.distance_matrix, DISPOSAL_NAME, DEPOT_NAME)

        return total

    @staticmethod
    def _flatten_params(params: Dict) -> Dict:
        """Flatten nested parameter dict."""
        flat = {}
        for section_val in params.values():
            if isinstance(section_val, dict):
                flat.update(section_val)
            else:
                flat[str(section_val)] = section_val
        return flat
