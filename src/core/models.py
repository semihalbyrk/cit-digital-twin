"""Pydantic data models for the CIT Digital Twin application."""

from typing import List, Optional
from pydantic import BaseModel, Field, computed_field


class ServicePoint(BaseModel):
    """A waste collection service point."""

    sp_id: str = Field(..., description="Service point ID, e.g. Z2-BDB-0755")
    zone: str = Field(default="", description="Zone name, e.g. Albada Zone-2")
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    bin_type: str = Field(default="", description="Bin type, e.g. 1100L, 240L")
    collection_frequency_planned: str = Field(
        default="Daily", description="Planned collection frequency"
    )


class Task(BaseModel):
    """A single waste collection task."""

    task_id: str
    route_name: str = ""
    vehicle_id: str = ""
    date: str = ""  # YYYY-MM-DD or raw date string
    arrive_time: Optional[str] = None  # Raw time string like '3:43:47 pm'
    arrive_time_minutes: Optional[float] = None  # Parsed minutes since midnight
    operation: str = ""
    task_status: str = ""  # Done, Visited, To-Do
    planned_adhoc: str = ""
    zone: str = ""
    service_point: str = ""
    asset_types: str = ""
    completed_asset_types: str = ""
    asset_collects: int = 0


class Route(BaseModel):
    """A collection route for a single day."""

    route_id: str = ""
    route_name: str = ""
    date: str = ""
    vehicle_id: str = ""
    tasks: List[Task] = Field(default_factory=list)

    @computed_field
    @property
    def total_tasks(self) -> int:
        return len(self.tasks)

    @computed_field
    @property
    def done_count(self) -> int:
        return sum(1 for t in self.tasks if t.task_status == "Done")

    @computed_field
    @property
    def visited_count(self) -> int:
        return sum(1 for t in self.tasks if t.task_status == "Visited")

    @computed_field
    @property
    def todo_count(self) -> int:
        return sum(1 for t in self.tasks if t.task_status == "To-Do")

    def completion_rate(self) -> float:
        """Fraction of tasks with status Done."""
        if self.total_tasks == 0:
            return 0.0
        return self.done_count / self.total_tasks


class BaselineMetrics(BaseModel):
    """Calculated baseline metrics for a route on a given day."""

    route_name: str = ""
    date: str = ""
    baseline_type: str = ""  # planned, actual, actionable

    # Distance & time
    total_distance_km: float = 0.0
    total_travel_time_minutes: float = 0.0
    total_service_time_minutes: float = 0.0
    total_time_minutes: float = 0.0

    # Costs
    fuel_cost: float = 0.0
    labor_cost: float = 0.0
    vehicle_cost: float = 0.0
    total_cost: float = 0.0

    # Emissions
    co2_emissions_kg: float = 0.0

    # Task counts
    tasks_planned: int = 0
    tasks_done: int = 0
    tasks_visited: int = 0
    tasks_todo: int = 0

    # Rates
    completion_rate_vs_plan: float = 0.0  # done / planned
    actual_completion_rate: float = 0.0  # done / (done + visited + todo)


class ScenarioResult(BaseModel):
    """Result of a what-if scenario comparison."""

    baseline_metrics: BaselineMetrics
    scenario_metrics: BaselineMetrics
    metric_name: str = ""  # e.g. 'Fix Visited', 'Optimize Sequence'

    # Deltas (negative = improvement)
    delta_distance: float = 0.0
    delta_time: float = 0.0
    delta_cost: float = 0.0
    delta_co2: float = 0.0
    delta_tasks: int = 0

    feasibility_score: float = 0.0  # 0.0 to 1.0
    recommendation: str = ""
