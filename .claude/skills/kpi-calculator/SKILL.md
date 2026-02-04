---
name: kpi-calculator
description: Calculate key performance indicators (cost, emissions, efficiency) from simulation results. Use when analyzing route performance or comparing scenarios.
---

# KPI Calculator Skill

## Key Metrics

### Cost Metrics
- **Fuel Cost** = (total_distance_km / 6.0) * $1.50
- **Labor Cost** = (total_time_hours) * $25
- **Total Cost** = Fuel Cost + Labor Cost
- **Cost per Stop** = Total Cost / number_of_stops
- **Cost per km** = Total Cost / total_distance_km

### Time Metrics
- **Total Travel Time** = sum of all segment times
- **Service Time** = number_of_stops * 2.5 minutes
- **Idle Time** = shift_duration - (travel_time + service_time)
- **Vehicle Utilization %** = (travel_time + service_time) / shift_duration * 100

### Efficiency Metrics
- **Stops per Hour** = number_of_stops / total_time_hours
- **Km per Stop** = total_distance_km / number_of_stops
- **Capacity Utilization %** = total_weight_kg / 20000 kg * 100

### Environmental Metrics
- **CO2 Emissions** = (total_distance_km / 6.0) * 2.31 kg
- **CO2 per Stop** = total_co2 / number_of_stops
- **CO2 per km** = total_co2 / total_distance_km

## Output Format
```json
{
  "route_id": "route_001",
  "date": "2025-02-04",
  "stops": 15,
  "total_distance_km": 45.3,
  "total_time_minutes": 420,
  "cost": {
    "fuel": 11.33,
    "labor": 175.00,
    "total": 186.33,
    "per_stop": 12.42,
    "per_km": 4.11
  },
  "efficiency": {
    "stops_per_hour": 2.14,
    "km_per_stop": 3.02,
    "utilization_percent": 87.5
  },
  "environmental": {
    "co2_kg": 10.43,
    "co2_per_stop": 0.695,
    "co2_per_km": 0.230
  }
}
```

## Comparison Analysis
When comparing multiple routes:
- Show cost differential: Route A vs Route B
- Highlight efficiency gains/losses
- Project weekly/monthly impact
- Identify optimization opportunities