---
name: route-optimization
description: Optimize vehicle routing algorithms considering fuel costs, distance, time windows, and vehicle capacity constraints. Use when designing or improving routing algorithms.
---

# Route Optimization Skill

## Purpose
This skill guides Claude in creating efficient routing solutions for waste collection vehicles, considering:
- Vehicle specifications (35 km/h speed, 20m³ capacity)
- Operational constraints (8-hour shifts, 2.5 min service time per task)
- Cost optimization (fuel at $1.50/liter, $25/hour labor)
- Emissions tracking (2.31 kg CO2/liter)

## Context
Your fleet parameters:
- Truck speed: 35 km/h average
- Truck capacity: 20 m³
- Fuel consumption: 6.0 km/liter
- Service time per task: 2.5 minutes
- Shift duration: 8 hours (480 minutes)
- Depot unload time: 15 minutes

## When to Use This Skill
- Developing a routing engine module
- Optimizing pickup sequences
- Calculating travel time and costs
- Testing algorithms with sample routes
- Validating against vehicle/time constraints

## Key Algorithms to Consider

### 1. Distance Calculation
Use haversine formula for lat/long coordinates:
```python
from math import radians, cos, sin, asin, sqrt

def haversine(lon1, lat1, lon2, lat2):
    """Calculate great circle distance between two points"""
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    km = 6371 * c
    return km
```

### 2. Time Window Validation
- Check if service can complete within 8-hour shift
- Account for: Travel time + service time + unload time
- Formula: `total_time = sum(travel_times) + (num_stops * service_time) + unload_time`

### 3. Cost Calculation
fuel_cost = (total_distance_km / 6.0) * 1.50  # $1.50/liter at 6 km/liter
labor_cost = (total_time_hours) * 25  # $25/hour
total_cost = fuel_cost + labor_cost

### 4. Emissions Calculation
co2_emissions_kg = (total_distance_km / 6.0) * 2.31  # 2.31 kg CO2 per liter
## Validation Rules
- All stops must fit within vehicle capacity
- Total time must not exceed 480 minutes (8 hours)
- Distance should minimize unnecessary travel
- Each stop gets visited exactly once per route

## Expected Output Format
When designing routing code, produce:
1. Route object with: `stops`, `total_distance`, `total_time`, `total_cost`, `co2_emissions`
2. Unit tests validating capacity and time constraints
3. Performance metrics (cost per stop, emissions per km)

## Example Workflow
User: "Create a routing algorithm that minimizes fuel cost"
1. Parse input (list of coordinates, bin weights, time windows)
2. Apply nearest-neighbor or other heuristic
3. Validate against constraints (capacity, time)
4. Calculate metrics (distance, time, cost, emissions)
5. Return optimized route with full cost breakdown

## Related Skills
- `data-validation` - Ensure input data quality before routing
- `kpi-calculator` - Compute final performance metrics