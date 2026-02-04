"""Performance metrics / KPI calculations."""

from typing import Dict, List, Optional

from src.core.models import Task, BaselineMetrics
from src.utils.helpers import safe_divide


class PerformanceMetrics:
    """Calculate KPIs from a set of tasks."""

    @staticmethod
    def calculate_kpis(
        tasks: List[Task],
        baseline: Optional[BaselineMetrics] = None,
    ) -> Dict:
        """Calculate key performance indicators.

        Args:
            tasks: All tasks (may span multiple days).
            baseline: Optional pre-calculated baseline metrics.

        Returns:
            Dict of KPI values.
        """
        total = len(tasks)
        done = sum(1 for t in tasks if t.task_status == 'Done')
        visited = sum(1 for t in tasks if t.task_status == 'Visited')
        todo = sum(1 for t in tasks if t.task_status == 'To-Do')

        dates = set(t.date for t in tasks if t.date)
        num_days = len(dates) or 1

        vehicles = set(t.vehicle_id for t in tasks if t.vehicle_id)

        # Zone-level completion
        zone_tasks: Dict[str, List[Task]] = {}
        for t in tasks:
            zone_tasks.setdefault(t.zone, []).append(t)

        zone_completion = {}
        for zone, ztasks in zone_tasks.items():
            z_done = sum(1 for t in ztasks if t.task_status == 'Done')
            zone_completion[zone] = round(safe_divide(z_done, len(ztasks)), 4)

        # Route-level performance
        route_tasks: Dict[str, List[Task]] = {}
        for t in tasks:
            route_tasks.setdefault(t.route_name, []).append(t)

        route_completion = {
            rn: safe_divide(
                sum(1 for t in rtasks if t.task_status == 'Done'),
                len(rtasks),
            )
            for rn, rtasks in route_tasks.items()
        }

        top_performers = sorted(route_completion, key=route_completion.get, reverse=True)[:5]
        problem_areas = sorted(route_completion, key=route_completion.get)[:5]

        kpis = {
            'completion_rate': round(safe_divide(done, total), 4),
            'total_tasks': total,
            'done_count': done,
            'visited_count': visited,
            'todo_count': todo,
            'avg_tasks_per_day': round(total / num_days, 1),
            'vehicles_active': len(vehicles),
            'num_days': num_days,
            'zones_coverage': zone_completion,
            'top_performers': top_performers,
            'problem_areas': problem_areas,
        }

        if baseline:
            kpis['total_distance'] = baseline.total_distance_km
            kpis['total_cost'] = baseline.total_cost
            kpis['co2_total'] = baseline.co2_emissions_kg

        return kpis

    @staticmethod
    def compare_days(day1_metrics: Dict, day2_metrics: Dict) -> Dict:
        """Compare KPIs between two days.

        Returns dict with differences and trends for numeric fields.
        """
        result = {}
        numeric_keys = [
            'completion_rate', 'total_tasks', 'done_count',
            'visited_count', 'todo_count', 'total_distance',
            'total_cost', 'co2_total',
        ]
        for key in numeric_keys:
            v1 = day1_metrics.get(key)
            v2 = day2_metrics.get(key)
            if v1 is not None and v2 is not None:
                diff = v2 - v1
                pct = safe_divide(diff, abs(v1)) * 100 if v1 != 0 else 0
                trend = 'up' if diff > 0 else ('down' if diff < 0 else 'flat')
                result[key] = {
                    'day1': v1,
                    'day2': v2,
                    'diff': round(diff, 4),
                    'pct_change': round(pct, 2),
                    'trend': trend,
                }
        return result
