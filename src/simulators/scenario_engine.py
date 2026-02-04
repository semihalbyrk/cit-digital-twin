"""Scenario engine for what-if analysis."""

from typing import Dict, List
from copy import deepcopy

from loguru import logger

from src.core.models import Task, BaselineMetrics, ScenarioResult
from src.simulators.baseline_simulator import BaselineSimulator
from src.simulators.sequence_optimizer import nearest_neighbor_tsp


class ScenarioEngine:
    """Run what-if scenarios and compare against baseline."""

    def __init__(self, baseline_simulator: BaselineSimulator):
        self.simulator = baseline_simulator

    def scenario_optimize_sequence(self, tasks: List[Task]) -> ScenarioResult:
        """Scenario: reorder tasks using nearest-neighbour TSP.

        Compares actual task order against optimised order.
        """
        baseline = self.simulator.calculate_baseline(tasks, baseline_type='actual')

        # Get Done tasks' service points in actual order
        done_tasks = [t for t in tasks if t.task_status == 'Done']
        sps = [t.service_point for t in done_tasks]

        # Optimise sequence
        optimised_sps = nearest_neighbor_tsp(
            sps, self.simulator.distance_matrix
        )

        # Build new tasks in optimised order
        sp_to_task = {}
        for t in done_tasks:
            sp_to_task.setdefault(t.service_point, []).append(t)

        optimised_tasks: List[Task] = []
        for sp in optimised_sps:
            if sp in sp_to_task and sp_to_task[sp]:
                optimised_tasks.append(sp_to_task[sp].pop(0))

        # Calculate scenario metrics using same baseline type
        # We override the internal sequence by passing tasks already ordered
        scenario = self.simulator.calculate_baseline(
            optimised_tasks, baseline_type='planned'
        )
        scenario.baseline_type = 'optimized_sequence'

        return self._build_result(
            baseline, scenario, 'Optimize Sequence',
            recommendation=self._sequence_recommendation(baseline, scenario),
        )

    def scenario_fix_visited(self, tasks: List[Task]) -> ScenarioResult:
        """Scenario: assume Visited tasks are completed successfully.

        Shows potential improvement if Visited tasks were collected.
        """
        baseline = self.simulator.calculate_baseline(tasks, baseline_type='actual')

        # Create modified tasks: Visited → Done
        modified_tasks = []
        for t in tasks:
            if t.task_status == 'Visited':
                t_copy = t.model_copy(update={'task_status': 'Done'})
                modified_tasks.append(t_copy)
            else:
                modified_tasks.append(t)

        scenario = self.simulator.calculate_baseline(
            modified_tasks, baseline_type='actual'
        )
        scenario.baseline_type = 'fix_visited'

        visited_count = sum(1 for t in tasks if t.task_status == 'Visited')

        return self._build_result(
            baseline, scenario, 'Fix Visited',
            delta_tasks=visited_count,
            recommendation=self._visited_recommendation(visited_count, tasks),
        )

    def scenario_adjust_parameters(
        self, tasks: List[Task], param_changes: Dict
    ) -> ScenarioResult:
        """Scenario: recalculate with different parameters.

        Args:
            tasks: Task list.
            param_changes: Dict of parameter overrides, e.g. {'truck_speed_kmh': 40}.
        """
        baseline = self.simulator.calculate_baseline(tasks, baseline_type='actual')

        # Create a temporary simulator with adjusted parameters
        adjusted_params = deepcopy(self.simulator.params)
        adjusted_params.update(param_changes)

        temp_sim = BaselineSimulator.__new__(BaselineSimulator)
        temp_sim.distance_matrix = self.simulator.distance_matrix
        temp_sim.params = adjusted_params
        temp_sim.service_points = self.simulator.service_points

        scenario = temp_sim.calculate_baseline(tasks, baseline_type='actual')
        scenario.baseline_type = 'adjusted_parameters'

        changed_params_str = ', '.join(f"{k}={v}" for k, v in param_changes.items())

        return self._build_result(
            baseline, scenario, f'Adjust Parameters ({changed_params_str})',
            recommendation=self._param_recommendation(baseline, scenario, param_changes),
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _build_result(
        self,
        baseline: BaselineMetrics,
        scenario: BaselineMetrics,
        name: str,
        delta_tasks: int = 0,
        recommendation: str = "",
    ) -> ScenarioResult:
        delta_distance = scenario.total_distance_km - baseline.total_distance_km
        delta_time = scenario.total_time_minutes - baseline.total_time_minutes
        delta_cost = scenario.total_cost - baseline.total_cost
        delta_co2 = scenario.co2_emissions_kg - baseline.co2_emissions_kg

        # Feasibility: simple heuristic (closer to 1.0 = more feasible)
        feasibility = 0.8  # default moderate
        if delta_cost < 0:
            feasibility = min(1.0, 0.8 + abs(delta_cost) / (baseline.total_cost + 1) * 0.2)

        return ScenarioResult(
            baseline_metrics=baseline,
            scenario_metrics=scenario,
            metric_name=name,
            delta_distance=round(delta_distance, 2),
            delta_time=round(delta_time, 2),
            delta_cost=round(delta_cost, 2),
            delta_co2=round(delta_co2, 2),
            delta_tasks=delta_tasks,
            feasibility_score=round(feasibility, 2),
            recommendation=recommendation,
        )

    @staticmethod
    def _sequence_recommendation(baseline: BaselineMetrics, scenario: BaselineMetrics) -> str:
        saving_pct = (1 - scenario.total_distance_km / baseline.total_distance_km) * 100 if baseline.total_distance_km > 0 else 0
        if saving_pct > 10:
            return f"Route optimisation could save {saving_pct:.1f}% distance. Strongly recommended."
        elif saving_pct > 3:
            return f"Route optimisation could save {saving_pct:.1f}% distance. Worth implementing."
        else:
            return f"Current route is already near-optimal ({saving_pct:.1f}% potential saving)."

    @staticmethod
    def _visited_recommendation(visited_count: int, tasks: List[Task]) -> str:
        total = len(tasks)
        pct = (visited_count / total * 100) if total > 0 else 0
        if pct > 15:
            return (
                f"{visited_count} visited tasks ({pct:.0f}%) failed collection. "
                "Investigate access issues or bin placement."
            )
        elif pct > 5:
            return (
                f"{visited_count} visited tasks ({pct:.0f}%). "
                "Monitor and address recurring failures."
            )
        else:
            return f"Only {visited_count} visited tasks ({pct:.0f}%). Acceptable failure rate."

    @staticmethod
    def _param_recommendation(
        baseline: BaselineMetrics, scenario: BaselineMetrics, changes: Dict
    ) -> str:
        cost_diff = scenario.total_cost - baseline.total_cost
        time_diff = scenario.total_time_minutes - baseline.total_time_minutes
        parts = []
        if abs(cost_diff) > 1:
            direction = "decrease" if cost_diff < 0 else "increase"
            parts.append(f"Cost {direction} by ${abs(cost_diff):.2f}")
        if abs(time_diff) > 1:
            direction = "decrease" if time_diff < 0 else "increase"
            parts.append(f"Time {direction} by {abs(time_diff):.0f} min")
        if parts:
            return "Parameter change would " + "; ".join(parts) + "."
        return "Parameter change has negligible impact."
