import csv
import unittest
from pathlib import Path

from web.server import app


RAW_TASK_DIR = Path(__file__).resolve().parent.parent / 'data' / 'raw' / 'task_data'
DATE_TO_SUFFIX = {
    '2026-01-06': '06.01',
    '2026-01-07': '07.01',
    '2026-01-08': '08.01',
    '2026-01-10': '10.01',
    '2026-01-11': '11.01',
}


def load_expected_csv_counts():
    expected = {}
    for iso_date, suffix in DATE_TO_SUFFIX.items():
        csv_path = RAW_TASK_DIR / f'CIT_Tasks_Route - {suffix}.csv'
        with csv_path.open('r', encoding='utf-8') as f:
            rows = [r for r in csv.DictReader(f) if r.get('Route Name') == 'Zone 2 B (Day) - V 2.0']

        done = sum(1 for r in rows if r.get('Task Status') == 'Done')
        visited = sum(1 for r in rows if r.get('Task Status') == 'Visited')
        todo = sum(1 for r in rows if r.get('Task Status') not in ('Done', 'Visited'))
        vehicle_ids = sorted({(r.get('Vehicle ID') or '').strip() for r in rows if (r.get('Vehicle ID') or '').strip()})

        expected[iso_date] = {
            'total': len(rows),
            'done': done,
            'visited': visited,
            'todo': todo,
            'vehicle_id': vehicle_ids[0] if vehicle_ids else '',
        }
    return expected


class TestWebCsvParity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = app.test_client()
        cls.expected = load_expected_csv_counts()

    def test_routes_csv_parity(self):
        response = self.client.get('/api/routes')
        self.assertEqual(response.status_code, 200)
        routes = response.get_json()
        self.assertEqual(len(routes), len(self.expected))

        by_date = {r['date']: r for r in routes}
        for iso_date, exp in self.expected.items():
            self.assertIn(iso_date, by_date)
            route = by_date[iso_date]
            total = route['tasks_done'] + route['tasks_visited'] + route['tasks_todo']
            self.assertEqual(total, exp['total'])
            self.assertEqual(route['tasks_done'], exp['done'])
            self.assertEqual(route['tasks_visited'], exp['visited'])
            self.assertEqual(route['tasks_todo'], exp['todo'])
            self.assertEqual(route.get('vehicle_id'), exp['vehicle_id'])

        self.assertEqual(by_date['2026-01-06']['tasks_done'] + by_date['2026-01-06']['tasks_visited'] + by_date['2026-01-06']['tasks_todo'], 326)

    def test_route_endpoints_consistency(self):
        routes = self.client.get('/api/routes').get_json()
        for route in routes:
            route_id = route['route_id']
            expected_total = route['tasks_done'] + route['tasks_visited'] + route['tasks_todo']

            tasks_resp = self.client.get(f'/api/routes/{route_id}/tasks')
            self.assertEqual(tasks_resp.status_code, 200)
            tasks_payload = tasks_resp.get_json()
            self.assertEqual(tasks_payload['total_tasks'], expected_total)
            self.assertEqual(len(tasks_payload['tasks']), expected_total)

            visited_resp = self.client.get(f'/api/routes/{route_id}/visited-tasks')
            self.assertEqual(visited_resp.status_code, 200)
            visited_payload = visited_resp.get_json()
            self.assertEqual(visited_payload['total_visited'], route['tasks_visited'])
            self.assertEqual(len(visited_payload['visited_tasks']), route['tasks_visited'])

            seq_resp = self.client.get(f'/api/routes/{route_id}/task-sequence')
            self.assertEqual(seq_resp.status_code, 200)
            seq_payload = seq_resp.get_json()
            self.assertEqual(seq_payload['total_incomplete'], route['tasks_todo'])
            self.assertEqual(seq_payload['total_completed'], route['tasks_done'] + route['tasks_visited'] + 3)

    def test_simulation_uses_csv_totals(self):
        routes = self.client.get('/api/routes').get_json()
        for route in routes:
            response = self.client.post('/api/simulate', json={
                'route_id': route['route_id'],
                'parameters': {'weight_1100L': 80, 'weight_240L': 32}
            })
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            expected_total = route['tasks_done'] + route['tasks_visited'] + route['tasks_todo']
            self.assertEqual(payload['total_tasks'], expected_total)

    def test_fri_sat_metrics_not_identical_under_defaults(self):
        default_params = {
            'speed': 35,
            'service_time': 2.5,
            'capacity': 20000,
            'start_time': '09:00',
            'end_time': '17:00',
            'break_duration': 60,
            'fuel_consumption': 6.0,
            'fuel_price': 1.5,
            'labor_rate': 25,
            'disposal_cost': 15,
            'disposal_time': 15,
            'weight_1100L': 80,
            'weight_240L': 32,
        }

        fri = self.client.post('/api/simulate', json={'route_id': 'Z2-B-Day-Fri', 'parameters': default_params}).get_json()
        sat = self.client.post('/api/simulate', json={'route_id': 'Z2-B-Day-Sat', 'parameters': default_params}).get_json()

        self.assertNotEqual(fri['distance'], sat['distance'])
        self.assertNotEqual(fri['total_time'], sat['total_time'])
        self.assertNotEqual(fri['total_cost'], sat['total_cost'])
        self.assertNotEqual(fri['co2'], sat['co2'])

    def test_simulation_service_time_uses_done_plus_visited_only(self):
        params = {'service_time': 2.5}
        route = self.client.get('/api/routes/Z2-B-Day-Fri').get_json()
        payload = self.client.post('/api/simulate', json={'route_id': 'Z2-B-Day-Fri', 'parameters': params}).get_json()

        expected_service_time = (route['tasks_done'] + route['tasks_visited']) * 2.5
        self.assertEqual(payload['service_time'], round(expected_service_time, 0))
        self.assertNotEqual(payload['service_time'], round((route['tasks_done'] + route['tasks_visited'] + route['tasks_todo']) * 2.5, 0))

    def test_simulation_includes_distance_diagnostics(self):
        payload = self.client.post('/api/simulate', json={'route_id': 'Z2-B-Day-Sat', 'parameters': {}}).get_json()
        self.assertIn('sequence_legs_total', payload)
        self.assertIn('sequence_legs_missing', payload)
        self.assertIn('distance_estimated_legs', payload)
        self.assertEqual(payload.get('distance_estimation_method'), 'avg_leg_fallback')


if __name__ == '__main__':
    unittest.main()
