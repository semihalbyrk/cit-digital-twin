"""Tests for frequency analyzer."""

import pytest
import pandas as pd

from src.analysis.frequency_analyzer import FrequencyAnalyzer


class TestFrequencyAnalyzer:
    def test_analyze_returns_dataframe(self, sample_task_dataframes):
        analyzer = FrequencyAnalyzer(sample_task_dataframes)
        result = analyzer.analyze_collection_frequency()
        assert isinstance(result, pd.DataFrame)
        assert len(result) == 3  # 3 service points

    def test_expected_columns(self, sample_task_dataframes):
        analyzer = FrequencyAnalyzer(sample_task_dataframes)
        result = analyzer.analyze_collection_frequency()
        expected_cols = [
            'sp_id', 'zone', 'fill_rate', 'ideal_freq',
            'done_days', 'visited_days', 'todo_days', 'pattern',
        ]
        for col in expected_cols:
            assert col in result.columns, f"Missing column: {col}"

    def test_fill_rate_values(self, sample_task_dataframes):
        analyzer = FrequencyAnalyzer(sample_task_dataframes)
        result = analyzer.analyze_collection_frequency()

        # SP-001: Done 4 days + Visited 1 day = fill 5/5 = 1.0
        sp1 = result[result['sp_id'] == 'SP-001'].iloc[0]
        assert sp1['fill_rate'] == 1.0

        # SP-003: Done 1 day, To-Do 4 days = fill 1/5 = 0.2
        sp3 = result[result['sp_id'] == 'SP-003'].iloc[0]
        assert sp3['fill_rate'] == 0.2

    def test_recommendation_logic(self, sample_task_dataframes):
        analyzer = FrequencyAnalyzer(sample_task_dataframes)
        result = analyzer.analyze_collection_frequency()

        sp1 = result[result['sp_id'] == 'SP-001'].iloc[0]
        assert sp1['ideal_freq'] == 'Daily'  # fill_rate 1.0 > 0.8

        sp3 = result[result['sp_id'] == 'SP-003'].iloc[0]
        # fill_rate 0.2 → '1x/week' or '2x/week'
        assert sp3['ideal_freq'] in ('1x/week', '2x/week')

    def test_impact_summary(self, sample_task_dataframes):
        analyzer = FrequencyAnalyzer(sample_task_dataframes)
        summary = analyzer.calculate_impact_summary()

        assert 'current_tasks' in summary
        assert 'recommended_tasks' in summary
        assert 'est_weekly_savings' in summary
        assert summary['current_tasks'] > 0

    def test_problematic_sps(self, sample_task_dataframes):
        analyzer = FrequencyAnalyzer(sample_task_dataframes)
        problems = analyzer.get_problematic_sps(threshold=0.8)

        # SP-002 fill_rate ~0.8, SP-003 fill_rate ~0.2
        assert len(problems) >= 1

    def test_empty_data(self):
        analyzer = FrequencyAnalyzer({})
        result = analyzer.analyze_collection_frequency()
        assert result.empty
