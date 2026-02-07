"""Script to expand Zone 2 B routes with 331 service points."""

import json
import random
from pathlib import Path

# Paths
WEB_DIR = Path(__file__).parent.parent
DATA_DIR = WEB_DIR / 'assets' / 'data'
RAW_DATA_DIR = WEB_DIR.parent / 'data' / 'raw' / 'static_data'

# Load service points from CSV
def load_service_points():
    """Load all Zone 2 B service points from CSV."""
    sp_file = RAW_DATA_DIR / 'CIT_Tasks_Route - Service Points.csv'
    sps = []
    with open(sp_file, 'r') as f:
        lines = f.readlines()[1:]  # Skip header
        for line in lines:
            parts = line.strip().split(',', 1)
            if len(parts) >= 2:
                sp_id = parts[0].strip()
                coords = parts[1].strip().strip('"')
                # Only include Zone 2 B service points (Z2-BDB-* and Z2-BDC-*)
                if sp_id.startswith('Z2-BD'):
                    sps.append({
                        'sp_id': sp_id,
                        'coordinates': coords
                    })
    return sps

# Generate status distribution based on route's completion rate
def generate_statuses(count, done_count, visited_count, todo_count):
    """Generate status list matching target counts."""
    statuses = []
    statuses.extend(['Done'] * done_count)
    statuses.extend(['Visited'] * visited_count)
    statuses.extend(['Todo'] * todo_count)

    # Pad or trim to match count
    while len(statuses) < count:
        statuses.append('Done')
    statuses = statuses[:count]

    # Shuffle to distribute
    random.shuffle(statuses)
    return statuses

# Container types with weights
CONTAINER_TYPES = [
    ('1100L', 550),
    ('240L', 120),
    ('Container', 300)
]

def expand_route(route, all_sps):
    """Expand a Zone 2 B route to have 331 service points."""
    total_sps = len(all_sps)

    # Get task counts from route
    done_count = route.get('tasks_done', 0)
    visited_count = route.get('tasks_visited', 0)
    todo_count = route.get('tasks_todo', 0)
    total_tasks = done_count + visited_count + todo_count

    # Generate statuses matching the route's distribution
    statuses = generate_statuses(total_sps, done_count, visited_count, todo_count)

    # Build expanded service points list
    service_points = []
    for idx, sp in enumerate(all_sps):
        status = statuses[idx]

        # Assign container type (weighted: 60% 1100L, 30% 240L, 10% Container)
        rand = random.random()
        if rand < 0.6:
            container_type, weight = CONTAINER_TYPES[0]
        elif rand < 0.9:
            container_type, weight = CONTAINER_TYPES[1]
        else:
            container_type, weight = CONTAINER_TYPES[2]

        # Weight collected only if Done
        weight_kg = weight if status == 'Done' else 0

        # Fill rate
        fill_rate = round(random.uniform(0.4, 0.95), 2) if status != 'Todo' else 0

        sp_data = {
            'sp_id': sp['sp_id'],
            'status': status,
            'zone': 'Zone 2',
            'container_type': container_type,
            'weight_kg': weight_kg,
            'fill_rate': fill_rate,
            'coordinates': sp['coordinates']
        }
        service_points.append(sp_data)

    # Update route with expanded service points
    route['service_points'] = service_points
    route['total_tasks'] = total_sps

    # Recalculate task counts based on actual statuses
    route['tasks_done'] = sum(1 for sp in service_points if sp['status'] == 'Done')
    route['tasks_visited'] = sum(1 for sp in service_points if sp['status'] == 'Visited')
    route['tasks_todo'] = sum(1 for sp in service_points if sp['status'] == 'Todo')

    return route

def main():
    # Load all service points
    all_sps = load_service_points()
    print(f"Loaded {len(all_sps)} Zone 2 B service points")

    # Load existing routes
    routes_file = DATA_DIR / 'routes.json'
    with open(routes_file, 'r') as f:
        routes = json.load(f)

    print(f"Loaded {len(routes)} routes")

    # Find and expand Zone 2 B routes
    zone2b_count = 0
    for route in routes:
        if route.get('route_name') == 'Zone 2 B (Day)':
            print(f"Expanding route: {route['route_id']}")
            expand_route(route, all_sps)
            zone2b_count += 1

    print(f"Expanded {zone2b_count} Zone 2 B routes")

    # Save updated routes
    with open(routes_file, 'w') as f:
        json.dump(routes, f, indent=2)

    print(f"Saved updated routes to {routes_file}")

if __name__ == '__main__':
    main()
