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
                'task_id': row.get('Task ID', '').strip(),
                'route_name': row.get('Route Name', '').strip(),
                'vehicle_id': row.get('Vehicle ID', '').strip(),
                'date': row.get('Date', '').strip(),
                'arrive_time_raw': row.get('Arrive Time', '').strip(),
                'arrive_time': parse_arrive_time(row.get('Arrive Time', '')),
                'operation': row.get('Operation', '').strip(),
                'task_status': row.get('Task Status', '').strip(),
                'planned_adhoc': row.get('Planned/Adhoc', '').strip(),
                'zone': row.get('Zone', '').strip(),
                'service_point': row.get('Service Point', '').strip(),
                'asset_types': row.get('Asset Types', '').strip(),
                'completed_asset_types': row.get('Completed Asset Types', '').strip(),
                'asset_collects': row.get('Asset Collects', '').strip()
            })
    return tasks


def normalize_route_name(route_name):
    """Normalize route names for matching across data sources."""
    name = (route_name or '').strip()
    if name.endswith(' - V 2.0'):
        return name[:-8].strip()
    return name


DEFAULT_SIMULATION_PARAMETERS = {
    'speed': 35.0,
    'service_time': 1.5,
    'capacity': 20000.0,
    'start_time': '06:00',
    'end_time': '18:00',
    'break_duration': 60.0,
    'fuel_consumption': 0.35,  # L/km
    'emission_factor': 2.68,   # kgCO2e/L
    'fuel_price': 1.50,
    'labor_rate': 25.0,
    'disposal_cost': 15.0,
    'disposal_time': 15.0,
    'weight_1100L': 80.0,
    'weight_240L': 32.0,
}


def _to_float(value, default):
    try:
        num = float(value)
        if num != num:  # NaN guard
            return float(default)
        return num
    except (TypeError, ValueError):
        return float(default)


def _extract_route_status_counts(route):
    done = int(route.get('tasks_done', 0) or 0)
    visited = int(route.get('tasks_visited', 0) or 0)
    todo = int(route.get('tasks_todo', 0) or 0)
    return done, visited, todo


def build_routes_from_csv_and_base():
    """Build canonical route list using raw CSV task counts + base metrics."""
    base_routes = load_json('routes.json')
    base_route_map = {}
    for route in base_routes:
        key = (route.get('date', ''), normalize_route_name(route.get('route_name', '')))
        base_route_map.setdefault(key, []).append(route)

    canonical_routes = []
    for date_str in sorted(DATE_TO_CSV.keys()):
        date_tasks = load_task_csv(date_str)
        if not date_tasks:
            continue

        grouped = {}
        for task in date_tasks:
            raw_route_name = task.get('route_name', '')
            grouped.setdefault(raw_route_name, []).append(task)

        for raw_route_name, tasks in grouped.items():
            normalized_name = normalize_route_name(raw_route_name)
            base_candidates = base_route_map.get((date_str, normalized_name), [])
            if not base_candidates:
                print(f"Warning: No base route match for date={date_str}, route={raw_route_name}")
                continue

            base_route = base_candidates[0]
            done = sum(1 for t in tasks if t.get('task_status') == 'Done')
            visited = sum(1 for t in tasks if t.get('task_status') == 'Visited')
            todo = sum(1 for t in tasks if t.get('task_status') not in ('Done', 'Visited'))
            total_tasks = done + visited + todo
            completion_rate = (done / total_tasks) if total_tasks > 0 else 0

            vehicle_ids = sorted({(t.get('vehicle_id') or '').strip() for t in tasks if (t.get('vehicle_id') or '').strip()})
            vehicle_id = vehicle_ids[0] if vehicle_ids else base_route.get('vehicle_id', '')

            merged = dict(base_route)
            merged['route_name'] = normalized_name
            merged['tasks_done'] = done
            merged['tasks_visited'] = visited
            merged['tasks_todo'] = todo
            merged['total_tasks'] = total_tasks
            merged['completion_rate'] = completion_rate
            merged['vehicle_id'] = vehicle_id

            default_metrics = calculate_route_operational_metrics(merged, DEFAULT_SIMULATION_PARAMETERS)
            merged['total_distance_km'] = round(default_metrics['distance_km'], 2)
            merged['total_travel_time_minutes'] = round(default_metrics['travel_time_min'], 2)
            merged['total_service_time_minutes'] = round(default_metrics['service_time_min'], 2)
            merged['total_time_minutes'] = round(default_metrics['total_time_min'], 2)
            merged['fuel_cost'] = round(default_metrics['fuel_cost'], 2)
            merged['labor_cost'] = round(default_metrics['labor_cost'], 2)
            merged['total_cost'] = round(default_metrics['total_cost'], 2)
            merged['co2_emissions_kg'] = round(default_metrics['co2_kg'], 2)

            canonical_routes.append(merged)

    canonical_routes.sort(key=lambda r: (r.get('date', ''), r.get('route_id', '')))
    return canonical_routes


def get_canonical_routes():
    """Get cached canonical route list backed by raw CSV data."""
    return get_data('routes_canonical', build_routes_from_csv_and_base)


def get_route_by_id(route_id):
    """Get canonical route by route_id."""
    routes = get_canonical_routes()
    return next((r for r in routes if r.get('route_id') == route_id), None)


def get_csv_tasks_for_route(route):
    """Get raw CSV tasks for a canonical route."""
    if not route:
        return []

    date_str = route.get('date', '')
    route_name = route.get('route_name', '')
    tasks = load_task_csv(date_str)
    normalized_route_name = normalize_route_name(route_name)
    return [t for t in tasks if normalize_route_name(t.get('route_name', '')) == normalized_route_name]


def _build_completed_sequence_for_route(route):
    """Build completed sequence for a route using raw CSV and sequence rules."""
    if not route:
        return []

    date_str = route.get('date', '')
    tasks_for_date = load_task_csv(date_str)
    if not tasks_for_date:
        return []

    route_tasks = get_csv_tasks_for_route(route)
    if not route_tasks:
        return []

    csv_route_name = route_tasks[0].get('route_name', '')
    completed_sequence, _ = build_route_sequence(tasks_for_date, csv_route_name)
    return completed_sequence


def _compute_sequence_distance_km(sequence):
    """Compute sequence distance and diagnostics using matrix legs + conservative fallback."""
    if not sequence or len(sequence) < 2:
        return {
            'distance_km': 0.0,
            'sequence_legs_total': 0,
            'sequence_legs_known': 0,
            'sequence_legs_missing': 0,
            'distance_estimated_legs': 0,
            'distance_estimation_method': 'avg_leg_fallback',
        }

    matrix = load_distance_matrix()
    known_leg_distances = []
    missing_legs = 0

    for current_item, next_item in zip(sequence, sequence[1:]):
        sp_from = current_item.get('sp_id', '')
        sp_to = next_item.get('sp_id', '')
        leg = matrix.get(sp_from, {}).get(sp_to, float('inf'))
        if not (isinstance(leg, (int, float)) and leg != float('inf')):
            leg = matrix.get(sp_to, {}).get(sp_from, float('inf'))
        if isinstance(leg, (int, float)) and leg != float('inf'):
            known_leg_distances.append(float(leg))
        else:
            missing_legs += 1

    known_legs = len(known_leg_distances)
    avg_known_leg_distance = (sum(known_leg_distances) / known_legs) if known_legs > 0 else 0.0
    # Route-average fallback can under-estimate heavily with many missing SP IDs.
    fallback_leg_distance = max(avg_known_leg_distance, 0.5)
    distance_km = sum(known_leg_distances) + (fallback_leg_distance * missing_legs)

    return {
        'distance_km': float(distance_km),
        'sequence_legs_total': len(sequence) - 1,
        'sequence_legs_known': known_legs,
        'sequence_legs_missing': missing_legs,
        'distance_estimated_legs': missing_legs,
        'distance_estimation_method': 'avg_leg_with_floor_fallback',
    }


def _compute_collected_waste_metrics(route_tasks, weight_1100L, weight_240L, done_count):
    """Compute collected waste and collected container count from done tasks."""
    collected_waste_kg = 0.0
    collected_containers = 0.0

    done_route_tasks = [t for t in route_tasks if t.get('task_status') == 'Done']
    for task in done_route_tasks:
        completed_type = str(task.get('completed_asset_types', '')).strip().lower()
        asset_types = str(task.get('asset_types', '')).strip().lower()
        collects_raw = str(task.get('asset_collects', '')).strip()

        try:
            collects = float(collects_raw) if collects_raw else 0.0
        except (TypeError, ValueError):
            collects = 0.0

        if collects <= 0:
            collects = 1.0

        if '240' in completed_type:
            expected_weight = weight_240L
        elif '1100' in completed_type:
            expected_weight = weight_1100L
        elif '240' in asset_types and '1100' not in asset_types:
            expected_weight = weight_240L
        else:
            expected_weight = weight_1100L

        collected_containers += collects
        collected_waste_kg += expected_weight * collects

    if collected_waste_kg <= 0:
        collected_containers = float(done_count)
        collected_waste_kg = float(done_count) * float(weight_1100L)

    return collected_waste_kg, collected_containers


def calculate_route_operational_metrics(route, parameters=None):
    """Calculate route operational metrics from completed sequence and parameters."""
    params = dict(DEFAULT_SIMULATION_PARAMETERS)
    if parameters:
        params.update(parameters)

    speed = _to_float(params.get('speed'), DEFAULT_SIMULATION_PARAMETERS['speed'])
    service_time = _to_float(params.get('service_time'), DEFAULT_SIMULATION_PARAMETERS['service_time'])
    capacity = _to_float(params.get('capacity'), DEFAULT_SIMULATION_PARAMETERS['capacity'])
    break_duration = _to_float(params.get('break_duration'), DEFAULT_SIMULATION_PARAMETERS['break_duration'])
    fuel_consumption = _to_float(params.get('fuel_consumption'), DEFAULT_SIMULATION_PARAMETERS['fuel_consumption'])
    emission_factor = _to_float(params.get('emission_factor'), DEFAULT_SIMULATION_PARAMETERS['emission_factor'])
    fuel_price = _to_float(params.get('fuel_price'), DEFAULT_SIMULATION_PARAMETERS['fuel_price'])
    labor_rate = _to_float(params.get('labor_rate'), DEFAULT_SIMULATION_PARAMETERS['labor_rate'])
    disposal_cost = _to_float(params.get('disposal_cost'), DEFAULT_SIMULATION_PARAMETERS['disposal_cost'])
    disposal_time = _to_float(params.get('disposal_time'), DEFAULT_SIMULATION_PARAMETERS['disposal_time'])
    weight_1100L = _to_float(params.get('weight_1100L'), DEFAULT_SIMULATION_PARAMETERS['weight_1100L'])
    weight_240L = _to_float(params.get('weight_240L'), DEFAULT_SIMULATION_PARAMETERS['weight_240L'])

    done, visited, todo = _extract_route_status_counts(route)
    total_tasks = done + visited + todo
    completed_tasks = done + visited

    completed_sequence = _build_completed_sequence_for_route(route)
    distance_diag = _compute_sequence_distance_km(completed_sequence)
    distance_km = distance_diag['distance_km']
    if distance_km <= 0:
        distance_km = _to_float(route.get('total_distance_km'), 0.0)

    travel_time_min = (distance_km / max(speed, 1.0)) * 60.0
    service_time_min = completed_tasks * service_time
    total_time_min = travel_time_min + service_time_min + break_duration + disposal_time

    fuel_used_l = distance_km * max(fuel_consumption, 0.0001)
    fuel_cost_total = fuel_used_l * fuel_price
    labor_cost_total = (total_time_min / 60.0) * labor_rate
    total_cost = fuel_cost_total + labor_cost_total + disposal_cost
    co2_kg = fuel_used_l * emission_factor

    route_tasks = get_csv_tasks_for_route(route)
    collected_waste_kg, collected_containers = _compute_collected_waste_metrics(
        route_tasks, weight_1100L, weight_240L, done
    )

    utilization_percent = None
    if capacity > 0:
        utilization_percent = (collected_waste_kg / capacity) * 100.0

    return {
        'done': done,
        'visited': visited,
        'todo': todo,
        'total_tasks': total_tasks,
        'completed_tasks': completed_tasks,
        'distance_km': float(distance_km),
        'travel_time_min': float(travel_time_min),
        'service_time_min': float(service_time_min),
        'break_time_min': float(break_duration),
        'disposal_time_min': float(disposal_time),
        'total_time_min': float(total_time_min),
        'fuel_used_l': float(fuel_used_l),
        'fuel_cost': float(fuel_cost_total),
        'labor_cost': float(labor_cost_total),
        'disposal_cost': float(disposal_cost),
        'total_cost': float(total_cost),
        'co2_kg': float(co2_kg),
        'vehicle_capacity_kg': float(capacity),
        'collected_waste_kg': float(collected_waste_kg),
        'collected_containers': float(collected_containers),
        'utilization_percent': float(utilization_percent) if utilization_percent is not None else None,
        'rate': (done / max(total_tasks, 1)),
        **distance_diag,
    }


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
        sp_names = [h.strip() for h in headers[1:]]  # Skip 'Service Point' column

        for row in reader:
            sp_from = row[0].strip()
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
    normalized_target = normalize_route_name(route_name)
    route_tasks = [
        t for t in tasks
        if normalize_route_name(t.get('route_name', '')) == normalized_target
    ]

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
            'task_id': task.get('task_id', ''),
            'sp_id': task['service_point'],
            'type': 'done',
            'status': 'Done',
            'arrive_time': arrive_str,
            'asset_types': task['asset_types'],
            'completed_asset_types': task['completed_asset_types'],
            'asset_collects': task['asset_collects']
        })

    matrix = load_distance_matrix()

    def resolve_disposal_sp(matrix_data):
        if 'Disposal' in matrix_data:
            return 'Disposal'
        if 'Disposal Location' in matrix_data:
            return 'Disposal Location'
        for node in matrix_data.keys():
            if 'disposal' in str(node).strip().lower():
                return node
        return 'Disposal'

    def resolve_depot_sp(matrix_data):
        if 'Al Bada Camp 10' in matrix_data:
            return 'Al Bada Camp 10'
        for node in matrix_data.keys():
            if 'camp' in str(node).strip().lower():
                return node
        return 'Al Bada Camp 10'

    def safe_leg_distance(sp_from, sp_to, fallback):
        if not sp_from or not sp_to:
            return fallback
        dist = matrix.get(sp_from, {}).get(sp_to, float('inf'))
        if isinstance(dist, (int, float)) and dist != float('inf'):
            return float(dist)
        reverse = matrix.get(sp_to, {}).get(sp_from, float('inf'))
        if isinstance(reverse, (int, float)) and reverse != float('inf'):
            return float(reverse)
        return fallback

    disposal_sp = resolve_disposal_sp(matrix)
    depot_sp = resolve_depot_sp(matrix)

    known_distances = []
    for row in matrix.values():
        for d in row.values():
            if isinstance(d, (int, float)) and d != float('inf') and d > 0:
                known_distances.append(float(d))
    fallback_leg_distance = (sum(known_distances) / len(known_distances)) if known_distances else 1.0

    # Insert Visited tasks at the position that minimizes additional route distance.
    if visited_tasks:
        for visited in visited_tasks:
            visited_item = {
                'task_id': visited.get('task_id', ''),
                'sp_id': visited['service_point'],
                'type': 'visited',
                'status': 'Visited',
                'arrive_time': '',
                'asset_types': visited['asset_types'],
                'completed_asset_types': '',
                'asset_collects': '0'
            }

            if not sequence:
                sequence.append(visited_item)
                continue

            best_pos = 0
            best_added = float('inf')

            for pos in range(len(sequence) + 1):
                prev_sp = depot_sp if pos == 0 else sequence[pos - 1]['sp_id']
                next_sp = disposal_sp if pos == len(sequence) else sequence[pos]['sp_id']

                prev_to_next = safe_leg_distance(prev_sp, next_sp, fallback_leg_distance)
                prev_to_visited = safe_leg_distance(prev_sp, visited_item['sp_id'], fallback_leg_distance)
                visited_to_next = safe_leg_distance(visited_item['sp_id'], next_sp, fallback_leg_distance)
                added_distance = prev_to_visited + visited_to_next - prev_to_next

                if added_distance < best_added:
                    best_added = added_distance
                    best_pos = pos

            sequence.insert(best_pos, visited_item)

    # Manual sequence overrides for 06.01 Zone 2 B route based on validated map trace.
    def _apply_manual_overrides(seq, route_tasks_for_route, normalized_route):
        if not seq:
            return seq

        route_date = str((route_tasks_for_route[0].get('date') if route_tasks_for_route else '') or '').strip()
        if normalized_route != 'Zone 2 B (Day)' or route_date != '6/1/2026':
            return seq

        overrides = [
            ('360-24041597', '360-24041590', 'before'),
            ('360-24041758', '360-24041752', 'after'),
            ('360-24042402', '360-24041970', 'after'),
        ]

        for visited_id, anchor_id, relation in overrides:
            visited_idx = next((i for i, item in enumerate(seq) if item.get('task_id') == visited_id), None)
            anchor_idx = next((i for i, item in enumerate(seq) if item.get('task_id') == anchor_id), None)
            if visited_idx is None or anchor_idx is None:
                continue

            visited_item = seq.pop(visited_idx)
            anchor_idx = next((i for i, item in enumerate(seq) if item.get('task_id') == anchor_id), None)
            if anchor_idx is None:
                seq.insert(min(visited_idx, len(seq)), visited_item)
                continue

            insert_pos = anchor_idx if relation == 'before' else anchor_idx + 1
            seq.insert(min(max(insert_pos, 0), len(seq)), visited_item)

        return seq

    sequence = _apply_manual_overrides(sequence, route_tasks, normalized_target)

    # Build final sequence with depot and disposal
    completed_sequence = []

    # Start: Depot
    completed_sequence.append({
        'seq': 0,
        'task_id': '',
        'sp_id': depot_sp,
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
        'task_id': '',
        'sp_id': disposal_sp,
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
        'task_id': '',
        'sp_id': depot_sp,
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


@app.route('/components/<path:filename>')
def serve_components(filename):
    """Serve component assets."""
    return send_from_directory(str(WEB_DIR / 'components'), filename)


# ─── API Routes ──────────────────────────────────────────────────────────────

@app.route('/api/baseline/v0')
def get_baseline():
    """Get V0 baseline aggregate data."""
    routes = get_canonical_routes()

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
    routes = get_canonical_routes()
    return jsonify(routes)


@app.route('/api/routes/<path:route_id>')
def get_route_detail(route_id):
    """Get single route detail."""
    route = get_route_by_id(route_id)

    if not route:
        return jsonify({'error': f'Route {route_id} not found'}), 404

    return jsonify(route)


@app.route('/api/routes/<path:route_id>/tasks')
def get_route_tasks(route_id):
    """Get all tasks for a specific route with full details."""
    route = get_route_by_id(route_id)

    if not route:
        return jsonify({'error': f'Route {route_id} not found'}), 404

    csv_tasks = get_csv_tasks_for_route(route)
    tasks = []
    for idx, csv_task in enumerate(csv_tasks):
        status = csv_task.get('task_status') or 'To Do'
        status_key = status.strip().lower()
        if status_key not in ('done', 'visited'):
            status = 'To Do'

        completed_type = (csv_task.get('completed_asset_types') or '').strip()
        asset_types = (csv_task.get('asset_types') or '').strip()
        container_type = completed_type or asset_types or 'Unknown'
        task = {
            'sequence': idx + 1,
            'task_id': csv_task.get('task_id', ''),
            'sp_id': csv_task.get('service_point', ''),
            'status': status,
            'zone': csv_task.get('zone', route.get('zone')),
            'container_type': container_type,
            'weight_kg': None,
            'fill_rate': None,
            'coordinates': '',
            'arrive_time': csv_task.get('arrive_time_raw', ''),
            'planned_adhoc': csv_task.get('planned_adhoc', ''),
            'asset_collects': csv_task.get('asset_collects', '')
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
    route = get_route_by_id(route_id)

    if not route:
        return jsonify({'error': f'Route {route_id} not found'}), 404

    csv_tasks = get_csv_tasks_for_route(route)
    visited_tasks = []
    for idx, csv_task in enumerate(csv_tasks):
        if csv_task.get('task_status') == 'Visited':
            completed_type = (csv_task.get('completed_asset_types') or '').strip()
            asset_types = (csv_task.get('asset_types') or '').strip()
            container_type = completed_type or asset_types or 'Unknown'
            task = {
                'sequence': idx + 1,
                'task_id': csv_task.get('task_id', ''),
                'sp_id': csv_task.get('service_point', ''),
                'status': 'Visited',
                'zone': csv_task.get('zone', route.get('zone')),
                'container_type': container_type,
                'weight_kg': None,
                'fill_rate': None,
                'planned_adhoc': csv_task.get('planned_adhoc', ''),
                'asset_collects': csv_task.get('asset_collects', '')
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
    route = get_route_by_id(route_id)

    if not route:
        return jsonify({'error': f'Route {route_id} not found'}), 404

    date_str = route.get('date', '')
    route_name = route.get('route_name', '')

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

    matching_task = next((t for t in tasks if normalize_route_name(t.get('route_name', '')) == normalize_route_name(route_name)), None)
    csv_route_name = matching_task.get('route_name') if matching_task else route_name

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
    routes = get_canonical_routes()
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

    route = get_route_by_id(route_id)

    if not route:
        return jsonify({'error': f'Route {route_id} not found'}), 404

    operational = calculate_route_operational_metrics(route, parameters)

    result = {
        'route_id': route_id,
        'parameters': parameters,
        'done': operational['done'],
        'visited': operational['visited'],
        'todo': operational['todo'],
        'total_tasks': operational['total_tasks'],
        'distance': round(operational['distance_km'], 2),
        'travel_time': round(operational['travel_time_min'], 0),
        'service_time': round(operational['service_time_min'], 0),
        'break_time': round(operational['break_time_min'], 0),
        'disposal_time': round(operational['disposal_time_min'], 0),
        'total_time': round(operational['total_time_min'], 0),
        'fuel_used': round(operational['fuel_used_l'], 2),
        'fuel_cost': round(operational['fuel_cost'], 2),
        'labor_cost': round(operational['labor_cost'], 2),
        'disposal_cost': round(operational['disposal_cost'], 2),
        'total_cost': round(operational['total_cost'], 2),
        'co2': round(operational['co2_kg'], 2),
        'vehicle_capacity_kg': round(operational['vehicle_capacity_kg'], 2),
        'collected_waste_kg': round(operational['collected_waste_kg'], 2),
        'collected_containers': round(operational['collected_containers'], 2),
        'utilization_percent': round(operational['utilization_percent'], 2) if operational['utilization_percent'] is not None else None,
        'utilization': round(operational['utilization_percent'], 2) if operational['utilization_percent'] is not None else None,
        'rate': round(operational['rate'], 4),
        'sequence_legs_total': operational['sequence_legs_total'],
        'sequence_legs_missing': operational['sequence_legs_missing'],
        'distance_estimated_legs': operational['distance_estimated_legs'],
        'distance_estimation_method': operational['distance_estimation_method'],
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

    routes = get_canonical_routes()

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
