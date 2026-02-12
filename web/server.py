"""CIT Digital Twin - Flask Backend Server"""

import json
import csv
import random
from datetime import datetime
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory

# Paths
BASE_DIR = Path(__file__).parent
PROJECT_DIR = BASE_DIR.parent
DATA_DIR = PROJECT_DIR / 'data'
PROCESSED_DIR = DATA_DIR / 'processed'
WEB_DIR = BASE_DIR

app = Flask(__name__, static_folder=str(WEB_DIR / 'assets'))


# ─── Data Loading ─────────────────────────────────────────────────────────────

def load_json(filename):
    """Load JSON data from web/assets/data directory."""
    filepath = WEB_DIR / 'assets' / 'data' / filename
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Warning: {filepath} not found")
        return []
    except json.JSONDecodeError as e:
        print(f"Warning: Error parsing {filepath}: {e}")
        return []


def load_baseline_csv():
    """Load baseline metrics from the existing CSV file."""
    csv_path = PROCESSED_DIR / 'baseline_metrics.csv'
    try:
        with open(csv_path, 'r') as f:
            reader = csv.DictReader(f)
            return list(reader)
    except FileNotFoundError:
        return []


# Cache loaded data
_data_cache = {}


def get_data(key, loader):
    """Cache data on first load."""
    if key not in _data_cache:
        _data_cache[key] = loader()
    return _data_cache[key]


def clear_cache():
    """Clear data cache for reload."""
    _data_cache.clear()


# Date-to-CSV filename mapping
DATE_TO_CSV = {
    '2026-01-06': '06.01',
    '2026-01-07': '07.01',
    '2026-01-08': '08.01',
    '2026-01-10': '10.01',
    '2026-01-11': '11.01'
}

RAW_DATA_DIR = DATA_DIR / 'raw'
TASK_DATA_DIR = RAW_DATA_DIR / 'task_data'
STATIC_DATA_DIR = RAW_DATA_DIR / 'static_data'
DISTANCE_MATRIX_DIR = RAW_DATA_DIR / 'distance_matrix'


def parse_arrive_time(time_str):
    """Parse arrive time like '3:43:47 pm' into a sortable datetime.time."""
    if not time_str or not time_str.strip():
        return None
    try:
        return datetime.strptime(time_str.strip(), '%I:%M:%S %p').time()
    except ValueError:
        try:
            return datetime.strptime(time_str.strip(), '%I:%M %p').time()
        except ValueError:
            return None


def load_task_csv(date_str):
    """Load CSV task data for a given date."""
    csv_suffix = DATE_TO_CSV.get(date_str)
    if not csv_suffix:
        return []

    csv_path = TASK_DATA_DIR / f'CIT_Tasks_Route - {csv_suffix}.csv'
    if not csv_path.exists():
        print(f"Warning: CSV not found: {csv_path}")
        return []

    tasks = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            tasks.append({
                'task_id': row.get('Task ID', ''),
                'route_name': row.get('Route Name', ''),
                'vehicle_id': row.get('Vehicle ID', ''),
                'date': row.get('Date', ''),
                'arrive_time_raw': row.get('Arrive Time', ''),
                'arrive_time': parse_arrive_time(row.get('Arrive Time', '')),
                'operation': row.get('Operation', ''),
                'task_status': row.get('Task Status', ''),
                'planned_adhoc': row.get('Planned/Adhoc', ''),
                'zone': row.get('Zone', ''),
                'service_point': row.get('Service Point', ''),
                'asset_types': row.get('Asset Types', ''),
                'completed_asset_types': row.get('Completed Asset Types', ''),
                'asset_collects': row.get('Asset Collects', '')
            })
    return tasks


def load_monthly_csv():
    """Load monthly region task data CSV for frequency analysis."""
    csv_path = TASK_DATA_DIR / 'CIT_Monthly_Region_Task_Data.csv'
    if not csv_path.exists():
        print(f"Warning: Monthly CSV not found: {csv_path}")
        return []

    tasks = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            date_str = row.get('Date', '').strip()
            try:
                dt = datetime.strptime(date_str, '%d/%m/%Y')
                iso_date = dt.strftime('%Y-%m-%d')
                day_name = dt.strftime('%A')
            except ValueError:
                iso_date = date_str
                day_name = ''
            tasks.append({
                'route_name': row.get('Route Name', ''),
                'date': iso_date,
                'day': day_name,
                'task_status': row.get('Task Status', ''),
                'planned_adhoc': row.get('Planned/Adhoc', ''),
                'zone': row.get('Zone', '').strip(),
                'service_point': row.get('Service Point', ''),
                'asset_types': row.get('Asset Types', ''),
                'completed_asset_types': row.get('Completed Asset Types', ''),
                'asset_collects': row.get('Asset Collects', '')
            })
    return tasks


def load_distance_matrix():
    """Load distance matrix from CSV and cache."""
    cache_key = 'distance_matrix'
    if cache_key in _data_cache:
        return _data_cache[cache_key]

    matrix_path = DISTANCE_MATRIX_DIR / 'Distance_Matrix.csv'
    if not matrix_path.exists():
        print(f"Warning: Distance matrix not found: {matrix_path}")
        return {}

    matrix = {}
    with open(matrix_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        headers = next(reader)
        sp_names = headers[1:]  # Skip 'Service Point' column

        for row in reader:
            sp_from = row[0]
            matrix[sp_from] = {}
            for i, sp_to in enumerate(sp_names):
                try:
                    matrix[sp_from][sp_to] = float(row[i + 1])
                except (ValueError, IndexError):
                    matrix[sp_from][sp_to] = float('inf')

    _data_cache[cache_key] = matrix
    return matrix


def build_route_sequence(tasks, route_name):
    """Build correct route sequence from CSV task data."""
    # Filter tasks for the specific route
    route_tasks = [t for t in tasks if t['route_name'] == route_name]

    # Separate by status
    done_tasks = [t for t in route_tasks if t['task_status'] == 'Done']
    visited_tasks = [t for t in route_tasks if t['task_status'] == 'Visited']
    todo_tasks = [t for t in route_tasks if t['task_status'] not in ('Done', 'Visited')]

    # Sort Done tasks by Arrive Time ASC
    done_tasks.sort(key=lambda t: t['arrive_time'] or datetime.max.time())

    # Build base sequence from Done tasks
    sequence = []
    for idx, task in enumerate(done_tasks):
        arrive_str = ''
        if task['arrive_time']:
            arrive_str = task['arrive_time'].strftime('%I:%M:%S %p').lstrip('0')
        sequence.append({
            'sp_id': task['service_point'],
            'type': 'done',
            'status': 'Done',
            'arrive_time': arrive_str,
            'asset_types': task['asset_types'],
            'completed_asset_types': task['completed_asset_types'],
            'asset_collects': task['asset_collects']
        })

    # Insert Visited tasks near closest Done task using distance matrix
    if visited_tasks and sequence:
        matrix = load_distance_matrix()

        for visited in visited_tasks:
            v_sp = visited['service_point']
            best_idx = 0
            best_dist = float('inf')

            # Find closest Done task in sequence
            for i, seq_item in enumerate(sequence):
                d_sp = seq_item['sp_id']
                dist = matrix.get(v_sp, {}).get(d_sp, float('inf'))
                if dist < best_dist:
                    best_dist = dist
                    best_idx = i

            # Decide insertion: check distance to neighbor before vs after
            insert_pos = best_idx + 1  # Default: insert after closest

            if best_idx > 0 and best_idx < len(sequence) - 1:
                before_sp = sequence[best_idx - 1]['sp_id'] if best_idx > 0 else None
                after_sp = sequence[best_idx + 1]['sp_id'] if best_idx + 1 < len(sequence) else None

                dist_before = matrix.get(v_sp, {}).get(before_sp, float('inf')) if before_sp else float('inf')
                dist_after = matrix.get(v_sp, {}).get(after_sp, float('inf')) if after_sp else float('inf')

                if dist_before < dist_after:
                    insert_pos = best_idx
                else:
                    insert_pos = best_idx + 1

            sequence.insert(insert_pos, {
                'sp_id': visited['service_point'],
                'type': 'visited',
                'status': 'Visited',
                'arrive_time': '',
                'asset_types': visited['asset_types'],
                'completed_asset_types': '',
                'asset_collects': '0'
            })

    # Build final sequence with depot and disposal
    completed_sequence = []

    # Start: Depot
    completed_sequence.append({
        'seq': 0,
        'sp_id': 'Al Bada Camp 10',
        'type': 'depot_start',
        'status': 'Start',
        'arrive_time': '',
        'asset_types': '',
        'completed_asset_types': '',
        'asset_collects': ''
    })

    # All Done + Visited tasks
    for idx, item in enumerate(sequence):
        completed_sequence.append({
            'seq': idx + 1,
            **item
        })

    # Disposal point
    completed_sequence.append({
        'seq': len(sequence) + 1,
        'sp_id': 'Disposal',
        'type': 'disposal',
        'status': 'Disposal',
        'arrive_time': '',
        'asset_types': '',
        'completed_asset_types': '',
        'asset_collects': ''
    })

    # End: Depot
    completed_sequence.append({
        'seq': len(sequence) + 2,
        'sp_id': 'Al Bada Camp 10',
        'type': 'depot_end',
        'status': 'End',
        'arrive_time': '',
        'asset_types': '',
        'completed_asset_types': '',
        'asset_collects': ''
    })

    # Build incomplete tasks list
    incomplete_tasks = []
    for task in todo_tasks:
        incomplete_tasks.append({
            'sp_id': task['service_point'],
            'status': 'To Do',
            'asset_types': task['asset_types'],
            'planned_adhoc': task['planned_adhoc']
        })

    return completed_sequence, incomplete_tasks


# ─── Static File Routes ──────────────────────────────────────────────────────

@app.route('/')
def index():
    """Serve main page."""
    return send_from_directory(str(WEB_DIR), 'index.html')


@app.route('/pages/<path:page>')
def get_page(page):
    """Serve page templates."""
    return send_from_directory(str(WEB_DIR / 'pages'), page)


@app.route('/assets/<path:filename>')
def serve_assets(filename):
    """Serve static assets."""
    return send_from_directory(str(WEB_DIR / 'assets'), filename)


# ─── API Routes ──────────────────────────────────────────────────────────────

@app.route('/api/baseline/v0')
def get_baseline():
    """Get V0 baseline aggregate data."""
    routes = get_data('routes', lambda: load_json('routes.json'))

    if not routes:
        return jsonify({'error': 'No route data available'}), 404

    total_done = sum(r.get('tasks_done', 0) for r in routes)
    total_visited = sum(r.get('tasks_visited', 0) for r in routes)
    total_todo = sum(r.get('tasks_todo', 0) for r in routes)
    total_tasks = total_done + total_visited + total_todo

    aggregated = {
        'routes': len(routes),
        'done': total_done,
        'visited': total_visited,
        'todo': total_todo,
        'total_tasks': total_tasks,
        'distance': sum(r.get('total_distance_km', 0) for r in routes),
        'time': sum(r.get('total_time_minutes', 0) for r in routes),
        'cost': sum(r.get('total_cost', 0) for r in routes),
        'co2': sum(r.get('co2_emissions_kg', 0) for r in routes),
        'rate': total_done / total_tasks if total_tasks > 0 else 0
    }

    return jsonify(aggregated)


@app.route('/api/routes')
def get_routes():
    """Get all routes with metrics."""
    routes = get_data('routes', lambda: load_json('routes.json'))
    return jsonify(routes)


@app.route('/api/routes/<path:route_id>')
def get_route_detail(route_id):
    """Get single route detail."""
    routes = get_data('routes', lambda: load_json('routes.json'))
    route = next((r for r in routes if r['route_id'] == route_id), None)

    if not route:
        return jsonify({'error': f'Route {route_id} not found'}), 404

    return jsonify(route)


@app.route('/api/routes/<path:route_id>/tasks')
def get_route_tasks(route_id):
    """Get all tasks for a specific route with full details."""
    routes = get_data('routes', lambda: load_json('routes.json'))
    route = next((r for r in routes if r['route_id'] == route_id), None)

    if not route:
        return jsonify({'error': f'Route {route_id} not found'}), 404

    # Return service points as tasks with additional details
    tasks = []
    for idx, sp in enumerate(route.get('service_points', [])):
        task = {
            'sequence': idx + 1,
            'sp_id': sp.get('sp_id'),
            'status': sp.get('status', 'Todo'),
            'zone': sp.get('zone', route.get('zone')),
            'container_type': sp.get('container_type', '1100L'),
            'weight_kg': sp.get('weight_kg', 0),
            'fill_rate': sp.get('fill_rate', 0.75),
            'coordinates': sp.get('coordinates', '')
        }
        tasks.append(task)

    return jsonify({
        'route_id': route_id,
        'route_name': route.get('route_name'),
        'date': route.get('date'),
        'total_tasks': len(tasks),
        'tasks': tasks
    })


@app.route('/api/routes/<path:route_id>/visited-tasks')
def get_visited_tasks(route_id):
    """Get only visited (failed) tasks for scenario planning."""
    routes = get_data('routes', lambda: load_json('routes.json'))
    route = next((r for r in routes if r['route_id'] == route_id), None)

    if not route:
        return jsonify({'error': f'Route {route_id} not found'}), 404

    # Filter for visited tasks only
    visited_tasks = []
    for idx, sp in enumerate(route.get('service_points', [])):
        if sp.get('status') == 'Visited':
            task = {
                'sequence': idx + 1,
                'sp_id': sp.get('sp_id'),
                'status': 'Visited',
                'zone': sp.get('zone', route.get('zone')),
                'container_type': sp.get('container_type', '1100L'),
                'weight_kg': sp.get('weight_kg', 0),
                'fill_rate': sp.get('fill_rate', 0.75)
            }
            visited_tasks.append(task)

    return jsonify({
        'route_id': route_id,
        'route_name': route.get('route_name'),
        'date': route.get('date'),
        'total_visited': len(visited_tasks),
        'visited_tasks': visited_tasks
    })


@app.route('/api/routes/<path:route_id>/task-sequence')
def get_route_task_sequence(route_id):
    """Get the correctly sequenced task list for a route, built from raw CSV data."""
    routes = get_data('routes', lambda: load_json('routes.json'))
    route = next((r for r in routes if r['route_id'] == route_id), None)

    if not route:
        return jsonify({'error': f'Route {route_id} not found'}), 404

    date_str = route.get('date', '')
    route_name = route.get('route_name', '')

    # Append " - V 2.0" if not present (CSV uses full name)
    csv_route_name = route_name
    if 'V 2.0' not in csv_route_name:
        csv_route_name = f'{route_name} - V 2.0'

    # Load raw CSV task data
    tasks = load_task_csv(date_str)
    if not tasks:
        return jsonify({
            'route_id': route_id,
            'date': date_str,
            'completed_sequence': [],
            'incomplete_tasks': [],
            'error': f'No CSV data found for date {date_str}'
        })

    # Build the route sequence
    completed_sequence, incomplete_tasks = build_route_sequence(tasks, csv_route_name)

    return jsonify({
        'route_id': route_id,
        'route_name': route_name,
        'date': date_str,
        'vehicle_id': route.get('vehicle_id', ''),
        'total_completed': len(completed_sequence),
        'total_incomplete': len(incomplete_tasks),
        'completed_sequence': completed_sequence,
        'incomplete_tasks': incomplete_tasks
    })


@app.route('/api/zone2b-routes')
def get_zone2b_routes():
    """Get all Zone 2 B (Day) routes for route selector."""
    routes = get_data('routes', lambda: load_json('routes.json'))
    zone2b_routes = [r for r in routes if r.get('route_name') == 'Zone 2 B (Day)']

    # Sort by date
    zone2b_routes.sort(key=lambda x: x.get('date', ''))

    return jsonify(zone2b_routes)


@app.route('/api/service-points')
def get_service_points():
    """Get all service points."""
    sps = get_data('service_points', lambda: load_json('service-points.json'))
    return jsonify(sps)


@app.route('/api/frequency-recommendations')
def get_frequency_recommendations():
    """Get frequency analysis recommendations."""
    freqs = get_data('frequencies', lambda: load_json('frequency-recommendations.json'))
    return jsonify(freqs)


@app.route('/api/monthly-tasks')
def get_monthly_tasks():
    """Get all monthly task data for frequency analysis."""
    tasks = get_data('monthly_tasks', load_monthly_csv)
    return jsonify({
        'total': len(tasks),
        'tasks': tasks
    })


@app.route('/api/simulate', methods=['POST'])
def run_simulation():
    """Run simulation with custom parameters for a specific route."""
    data = request.json
    route_id = data.get('route_id')
    parameters = data.get('parameters', {})

    routes = get_data('routes', lambda: load_json('routes.json'))
    route = next((r for r in routes if r['route_id'] == route_id), None)

    if not route:
        return jsonify({'error': f'Route {route_id} not found'}), 404

    # Extended parameters with defaults
    speed = parameters.get('speed', 35)  # km/h
    service_time = parameters.get('service_time', 2.5)  # minutes per task
    capacity = parameters.get('capacity', 20000)  # kg

    # Time & traffic parameters
    start_time = parameters.get('start_time', '09:00')
    end_time = parameters.get('end_time', '17:00')
    break_duration = parameters.get('break_duration', 60)  # minutes

    # Cost parameters
    fuel_consumption = parameters.get('fuel_consumption', 6.0)  # km per liter
    fuel_price = parameters.get('fuel_price', 1.50)  # $ per liter
    labor_rate = parameters.get('labor_rate', 25.0)  # $ per hour
    disposal_cost = parameters.get('disposal_cost', 15.0)  # $ per trip

    # Service time parameters
    disposal_time = parameters.get('disposal_time', 15)  # minutes

    # Container weights
    weight_1100L = parameters.get('weight_1100L', 550)  # kg
    weight_240L = parameters.get('weight_240L', 120)  # kg

    # Base values from route
    base_distance = route.get('total_distance_km', 50)
    base_tasks = route.get('tasks_done', 0) + route.get('tasks_visited', 0) + route.get('tasks_todo', 0)
    base_done = route.get('tasks_done', 0)

    # Calculate travel time based on speed
    travel_time = (base_distance / max(speed, 1)) * 60  # minutes

    # Calculate service time
    total_service_time = base_tasks * service_time  # minutes

    # Total time including break and disposal
    total_time = travel_time + total_service_time + break_duration + disposal_time

    # Capacity impact on distance (more capacity = fewer disposal trips = less distance)
    capacity_factor = min(1.0, 20000 / max(capacity, 1000))
    adjusted_distance = base_distance * (0.85 + 0.15 * capacity_factor)

    # Cost calculations
    fuel_used = adjusted_distance / max(fuel_consumption, 0.1)  # liters
    fuel_cost_total = fuel_used * fuel_price
    labor_cost_total = (total_time / 60) * labor_rate
    total_cost = fuel_cost_total + labor_cost_total + disposal_cost

    # CO2 emissions (2.31 kg CO2 per liter of diesel)
    co2_emissions = fuel_used * 2.31

    # Calculate utilization
    estimated_weight = base_done * weight_1100L * 0.5  # rough estimate
    utilization = min(1.0, estimated_weight / max(capacity, 1))

    result = {
        'route_id': route_id,
        'parameters': parameters,
        'done': base_done,
        'visited': route.get('tasks_visited', 0),
        'todo': route.get('tasks_todo', 0),
        'total_tasks': base_tasks,
        'distance': round(adjusted_distance, 2),
        'travel_time': round(travel_time, 0),
        'service_time': round(total_service_time, 0),
        'break_time': break_duration,
        'disposal_time': disposal_time,
        'total_time': round(total_time, 0),
        'fuel_used': round(fuel_used, 2),
        'fuel_cost': round(fuel_cost_total, 2),
        'labor_cost': round(labor_cost_total, 2),
        'disposal_cost': disposal_cost,
        'total_cost': round(total_cost, 2),
        'co2': round(co2_emissions, 2),
        'utilization': round(utilization, 4),
        'rate': round(base_done / max(base_tasks, 1), 4)
    }

    return jsonify(result)


@app.route('/api/scenarios', methods=['GET', 'POST'])
def handle_scenarios():
    """Get or create scenarios."""
    if request.method == 'GET':
        return jsonify([])

    data = request.json
    scenario_name = data.get('name', 'Unnamed')
    scenario_type = data.get('type', 'task-adjustment')
    config = data.get('config', {})

    routes = get_data('routes', lambda: load_json('routes.json'))

    # Calculate baseline totals
    total_done = sum(r.get('tasks_done', 0) for r in routes)
    total_visited = sum(r.get('tasks_visited', 0) for r in routes)
    total_todo = sum(r.get('tasks_todo', 0) for r in routes)
    total_distance = sum(r.get('total_distance_km', 0) for r in routes)
    total_time = sum(r.get('total_time_minutes', 0) for r in routes)
    total_cost = sum(r.get('total_cost', 0) for r in routes)
    total_co2 = sum(r.get('co2_emissions_kg', 0) for r in routes)
    total_tasks = total_done + total_visited + total_todo

    # Apply scenario adjustments
    if scenario_type == 'task-adjustment':
        selected_tasks = config.get('selected_tasks', [])
        num_removed = len(selected_tasks)

        # Remove visited/todo tasks = reduce those counts
        removed_visited = min(num_removed, total_visited)
        removed_todo = max(0, num_removed - removed_visited)

        new_visited = total_visited - removed_visited
        new_todo = total_todo - removed_todo
        new_total = total_done + new_visited + new_todo

        # Fewer tasks = less service time = less total time/distance/cost
        task_reduction_factor = new_total / max(total_tasks, 1)
        distance_factor = 0.85 + 0.15 * task_reduction_factor
        time_factor = 0.7 + 0.3 * task_reduction_factor

        result = {
            'routes': len(routes),
            'done': total_done,
            'visited': new_visited,
            'todo': new_todo,
            'distance': round(total_distance * distance_factor, 2),
            'time': round(total_time * time_factor, 0),
            'cost': round(total_cost * (distance_factor * 0.4 + time_factor * 0.6), 2),
            'co2': round(total_co2 * distance_factor, 2),
            'rate': round(total_done / max(new_total, 1), 4)
        }

    elif scenario_type == 'frequency-optimization':
        selected_sps = config.get('selected_sps', [])
        freqs = get_data('frequencies', lambda: load_json('frequency-recommendations.json'))
        selected_freq_data = [f for f in freqs if f['sp_id'] in selected_sps]

        # Frequency reduction savings
        num_optimized = len(selected_freq_data)
        # Assume each optimized SP saves some tasks per week
        tasks_saved = num_optimized * 3
        distance_saved = num_optimized * 0.8
        time_saved = num_optimized * 5

        new_total_tasks = max(total_tasks - tasks_saved, total_done)
        new_distance = max(total_distance - distance_saved, total_distance * 0.7)
        new_time = max(total_time - time_saved, total_time * 0.7)

        result = {
            'routes': len(routes),
            'done': total_done,
            'visited': max(0, total_visited - tasks_saved // 2),
            'todo': max(0, total_todo - tasks_saved // 2),
            'distance': round(new_distance, 2),
            'time': round(new_time, 0),
            'cost': round(total_cost * (new_distance / total_distance * 0.4 + new_time / total_time * 0.6), 2),
            'co2': round(total_co2 * (new_distance / total_distance), 2),
            'rate': round(total_done / max(new_total_tasks, 1), 4)
        }
    else:
        return jsonify({'error': f'Unknown scenario type: {scenario_type}'}), 400

    return jsonify(result)


@app.route('/api/comparison')
def get_comparison():
    """Get comparison between baseline and scenario."""
    baseline_id = request.args.get('baseline', 'v0')
    scenario_id = request.args.get('scenario')

    if not scenario_id:
        return jsonify({'error': 'scenario parameter required'}), 400

    # Return stored comparison data
    return jsonify({
        'baseline': baseline_id,
        'scenario': scenario_id,
        'message': 'Comparison data computed client-side'
    })


# ─── Error Handlers ──────────────────────────────────────────────────────────

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Not found'}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error'}), 500


# ─── Main ────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    print("\n  CIT Digital Twin - Route Optimization Dashboard")
    print("  ================================================")
    print("  Server starting on http://localhost:5000")
    print("  Press Ctrl+C to stop\n")
    app.run(debug=True, port=5000, host='0.0.0.0')
