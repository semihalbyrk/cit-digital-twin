"""CIT Digital Twin - Streamlit Dashboard."""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px

from src.core.loaders import (
    load_task_data,
    load_distance_matrix,
    load_service_points,
    load_parameters,
    dataframe_to_tasks,
)
from src.simulators.baseline_simulator import BaselineSimulator
from src.simulators.scenario_engine import ScenarioEngine
from src.analysis.frequency_analyzer import FrequencyAnalyzer
from src.analysis.performance_metrics import PerformanceMetrics
from src.utils.constants import PLOTLY_COLORS, COLOR_PALETTE
from src.utils.helpers import format_currency, format_time, format_percentage


# =====================================================================
# CSS / Styling
# =====================================================================

def apply_custom_css():
    st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    html, body, [class*="css"] {
        font-family: 'Inter', sans-serif;
    }

    /* KPI card styles */
    .kpi-card {
        background: rgb(248, 250, 252);
        border: 1px solid rgb(228, 231, 236);
        border-radius: 12px;
        padding: 20px;
        text-align: center;
    }
    .kpi-value {
        font-size: 28px;
        font-weight: 700;
        margin: 4px 0;
    }
    .kpi-label {
        font-size: 12px;
        font-weight: 500;
        color: rgb(71, 84, 103);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .kpi-delta {
        font-size: 11px;
        font-weight: 500;
    }

    /* Section header */
    .section-header {
        font-size: 15px;
        font-weight: 600;
        color: rgb(11, 43, 81);
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 2px solid rgb(228, 231, 236);
    }

    /* Result cards */
    .result-card {
        background: rgb(248, 250, 252);
        border: 1px solid rgb(228, 231, 236);
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 12px;
    }

    /* Impact box */
    .impact-box {
        background: rgb(241, 245, 249);
        border-radius: 10px;
        padding: 20px;
        margin: 16px 0;
    }

    /* Positive/negative indicators */
    .positive { color: rgb(54, 155, 49); }
    .negative { color: rgb(224, 60, 57); }
    .warning  { color: rgb(245, 158, 11); }
    .info     { color: rgb(59, 130, 246); }

    /* Badge styles */
    .badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
    }
    .badge-green  { background: rgb(220, 252, 218); color: rgb(54, 155, 49); }
    .badge-amber  { background: rgb(254, 243, 199); color: rgb(245, 158, 11); }
    .badge-red    { background: rgb(251, 230, 230); color: rgb(224, 60, 57); }
    .badge-blue   { background: rgb(219, 234, 254); color: rgb(59, 130, 246); }

    /* Hide Streamlit branding */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}

    /* Sidebar styling */
    [data-testid="stSidebar"] {
        background: rgb(248, 250, 252);
    }
    [data-testid="stSidebar"] h1 {
        color: rgb(11, 43, 81);
    }

    /* Tab styling */
    .stTabs [data-baseweb="tab-list"] {
        gap: 4px;
    }
    .stTabs [data-baseweb="tab"] {
        border-radius: 8px 8px 0 0;
        font-weight: 600;
        font-size: 14px;
    }
    </style>
    """, unsafe_allow_html=True)


# =====================================================================
# KPI Card helpers
# =====================================================================

def kpi_card(label: str, value: str, color: str = "rgb(16, 24, 40)", delta: str = ""):
    delta_html = f'<div class="kpi-delta">{delta}</div>' if delta else ''
    st.markdown(f"""
    <div class="kpi-card">
        <div class="kpi-label">{label}</div>
        <div class="kpi-value" style="color:{color}">{value}</div>
        {delta_html}
    </div>
    """, unsafe_allow_html=True)


def section_header(text: str):
    st.markdown(f'<div class="section-header">{text}</div>', unsafe_allow_html=True)


# =====================================================================
# Data loading (cached)
# =====================================================================

@st.cache_data
def cached_load_task_data():
    return load_task_data()


@st.cache_data
def cached_load_distance_matrix():
    return load_distance_matrix()


@st.cache_data
def cached_load_service_points():
    return load_service_points()


@st.cache_data
def cached_load_parameters():
    return load_parameters()


# =====================================================================
# TAB 1: Overview
# =====================================================================

def render_overview(task_data, dm, sp_df, params):
    section_header("Overview Dashboard")

    # Aggregate KPIs across all days
    all_tasks = []
    day_summaries = []
    for day in ['tuesday', 'wednesday', 'thursday', 'friday', 'saturday']:
        if day not in task_data:
            continue
        df = task_data[day]
        tasks = dataframe_to_tasks(df)
        all_tasks.extend(tasks)
        day_summaries.append({
            'day': day.capitalize(),
            'total': len(tasks),
            'Done': sum(1 for t in tasks if t.task_status == 'Done'),
            'Visited': sum(1 for t in tasks if t.task_status == 'Visited'),
            'To-Do': sum(1 for t in tasks if t.task_status == 'To-Do'),
        })

    total_tasks = len(all_tasks)
    done = sum(1 for t in all_tasks if t.task_status == 'Done')
    visited = sum(1 for t in all_tasks if t.task_status == 'Visited')
    todo = sum(1 for t in all_tasks if t.task_status == 'To-Do')
    completion_rate = done / total_tasks if total_tasks > 0 else 0

    # Calculate a single-day baseline for cost/distance (use all tasks aggregated)
    sim = BaselineSimulator(dm, params, sp_df)
    # Calculate per-day baselines
    total_distance = 0.0
    total_cost = 0.0
    total_co2 = 0.0

    baseline_type = st.radio(
        "Baseline Type", ['Actual', 'Planned', 'Actionable'],
        horizontal=True, key='overview_baseline_type'
    )
    btype = baseline_type.lower()

    for day in ['tuesday', 'wednesday', 'thursday', 'friday', 'saturday']:
        if day not in task_data:
            continue
        tasks = dataframe_to_tasks(task_data[day])
        m = sim.calculate_baseline(tasks, baseline_type=btype)
        total_distance += m.total_distance_km
        total_cost += m.total_cost
        total_co2 += m.co2_emissions_kg

    # --- KPI Row ---
    cols = st.columns(6)
    with cols[0]:
        kpi_card("Completion Rate", format_percentage(completion_rate), "rgb(54, 155, 49)")
    with cols[1]:
        kpi_card("Total Collections", str(done), "rgb(11, 43, 81)")
    with cols[2]:
        kpi_card("Visited (Failed)", str(visited), "rgb(245, 158, 11)")
    with cols[3]:
        kpi_card("To-Do", str(todo), "rgb(152, 162, 179)")
    with cols[4]:
        kpi_card("Total Distance", f"{total_distance:.1f} km", "rgb(59, 130, 246)")
    with cols[5]:
        kpi_card("Total Cost", format_currency(total_cost), "rgb(16, 24, 40)")

    st.markdown("")

    # --- Charts Row ---
    col1, col2 = st.columns(2)

    with col1:
        section_header("Daily Task Completion")
        day_df = pd.DataFrame(day_summaries)
        fig = go.Figure()
        fig.add_trace(go.Bar(
            name='Done', x=day_df['day'], y=day_df['Done'],
            marker_color=PLOTLY_COLORS['Done'],
        ))
        fig.add_trace(go.Bar(
            name='Visited', x=day_df['day'], y=day_df['Visited'],
            marker_color=PLOTLY_COLORS['Visited'],
        ))
        fig.add_trace(go.Bar(
            name='To-Do', x=day_df['day'], y=day_df['To-Do'],
            marker_color=PLOTLY_COLORS['To-Do'],
        ))
        fig.update_layout(
            barmode='stack',
            plot_bgcolor='white',
            paper_bgcolor='white',
            margin=dict(l=40, r=20, t=20, b=40),
            legend=dict(orientation='h', yanchor='bottom', y=1.02, xanchor='right', x=1),
            font=dict(family='Inter', size=12),
            yaxis_title='Tasks',
        )
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        section_header("Zone Performance")
        kpis = PerformanceMetrics.calculate_kpis(all_tasks)
        zone_data = kpis.get('zones_coverage', {})
        if zone_data:
            zone_df = pd.DataFrame([
                {'Zone': z, 'Completion Rate': r * 100}
                for z, r in zone_data.items()
            ]).sort_values('Completion Rate', ascending=True)

            colors = []
            for rate in zone_df['Completion Rate']:
                if rate >= 90:
                    colors.append(PLOTLY_COLORS['green'])
                elif rate >= 70:
                    colors.append(PLOTLY_COLORS['blue'])
                else:
                    colors.append(PLOTLY_COLORS['red'])

            fig = go.Figure(go.Bar(
                x=zone_df['Completion Rate'],
                y=zone_df['Zone'],
                orientation='h',
                marker_color=colors,
                text=[f"{r:.0f}%" for r in zone_df['Completion Rate']],
                textposition='auto',
            ))
            fig.update_layout(
                plot_bgcolor='white',
                paper_bgcolor='white',
                margin=dict(l=120, r=20, t=20, b=40),
                xaxis_title='Completion Rate (%)',
                xaxis=dict(range=[0, 105]),
                font=dict(family='Inter', size=12),
            )
            st.plotly_chart(fig, use_container_width=True)

    # --- Baseline Metrics Table ---
    section_header(f"Baseline Metrics ({baseline_type})")
    baseline_rows = []
    for day in ['tuesday', 'wednesday', 'thursday', 'friday', 'saturday']:
        if day not in task_data:
            continue
        tasks = dataframe_to_tasks(task_data[day])
        m = sim.calculate_baseline(tasks, baseline_type=btype)
        baseline_rows.append({
            'Day': day.capitalize(),
            'Distance (km)': f"{m.total_distance_km:.1f}",
            'Travel Time': format_time(m.total_travel_time_minutes),
            'Service Time': format_time(m.total_service_time_minutes),
            'Total Time': format_time(m.total_time_minutes),
            'Fuel Cost': format_currency(m.fuel_cost),
            'Labor Cost': format_currency(m.labor_cost),
            'Total Cost': format_currency(m.total_cost),
            'CO2 (kg)': f"{m.co2_emissions_kg:.1f}",
            'Completion': format_percentage(m.actual_completion_rate),
        })
    st.dataframe(pd.DataFrame(baseline_rows), use_container_width=True, hide_index=True)


# =====================================================================
# TAB 2: Frequency Analysis
# =====================================================================

def render_frequency(task_data):
    section_header("Frequency Analysis")

    analyzer = FrequencyAnalyzer(task_data)
    freq_df = analyzer.analyze_collection_frequency()

    if freq_df.empty:
        st.warning("No frequency data available.")
        return

    # KPI: Problematic SPs
    problems = freq_df[freq_df['fill_rate'] < 0.8]
    total_sps = len(freq_df)
    prob_count = len(problems)
    prob_pct = prob_count / total_sps * 100 if total_sps > 0 else 0

    st.markdown(f"""
    <div class="result-card">
        <span class="warning" style="font-size:20px; font-weight:700;">
            Problematic SPs: {prob_count} out of {total_sps} ({prob_pct:.0f}%)
        </span>
        <br><span style="color: rgb(71,84,103); font-size:13px;">
            These service points are over-visited or under-collected
        </span>
    </div>
    """, unsafe_allow_html=True)

    # Frequency recommendations table
    section_header("Top 10 Over-Visited Service Points")
    top10 = problems.head(10).copy()
    if not top10.empty:
        def color_fill_rate(val):
            if val < 0.5:
                return 'background-color: rgb(251,230,230); color: rgb(224,60,57)'
            elif val < 0.8:
                return 'background-color: rgb(254,243,199); color: rgb(245,158,11)'
            return 'background-color: rgb(220,252,218); color: rgb(54,155,49)'

        display_df = top10[['sp_id', 'zone', 'current_freq', 'ideal_freq', 'fill_rate',
                            'done_days', 'visited_days', 'todo_days', 'est_savings_usd']].copy()
        display_df.columns = ['SP ID', 'Zone', 'Current Freq', 'Recommended', 'Fill Rate',
                              'Done Days', 'Visited Days', 'To-Do Days', 'Est. Savings ($)']

        st.dataframe(
            display_df.style.applymap(color_fill_rate, subset=['Fill Rate']),
            use_container_width=True, hide_index=True,
        )

    # Export button
    csv = freq_df.to_csv(index=False)
    st.download_button(
        "Export Full Recommendations as CSV",
        csv, "frequency_recommendations.csv", "text/csv",
    )

    # Impact Summary
    section_header("Impact If All Recommendations Applied")
    impact = analyzer.calculate_impact_summary()
    if impact:
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            kpi_card(
                "Planned Tasks",
                f"{impact['current_tasks']} → {impact['recommended_tasks']}",
                "rgb(11, 43, 81)",
                f"<span class='positive'>-{impact['removed_tasks']} removed</span>"
            )
        with col2:
            kpi_card(
                "Est. Weekly Savings",
                format_currency(impact['est_weekly_savings']),
                "rgb(54, 155, 49)",
            )
        with col3:
            kpi_card(
                "Est. CO2 Reduction",
                f"{impact['est_co2_reduction_kg']:.1f} kg",
                "rgb(59, 130, 246)",
            )
        with col4:
            kpi_card(
                "Projected Completion",
                f"{format_percentage(impact['current_completion_rate'])} → {format_percentage(impact['projected_completion_rate'])}",
                "rgb(54, 155, 49)",
            )


# =====================================================================
# TAB 3: Scenarios
# =====================================================================

def render_scenarios(task_data, dm, sp_df, params):
    section_header("Scenario Builder")

    col_left, col_right = st.columns([1, 2])

    with col_left:
        st.markdown('<div class="result-card">', unsafe_allow_html=True)

        scenario_type = st.selectbox("Scenario Type", [
            "Optimize Sequence",
            "Fix Visited Tasks",
            "Adjust Parameters",
        ])

        day_options = [d.capitalize() for d in task_data.keys()]
        selected_day = st.selectbox("Select Day", day_options)
        day_key = selected_day.lower()

        param_changes = {}
        if scenario_type == "Adjust Parameters":
            st.markdown("**Parameter Overrides:**")
            new_speed = st.slider("Truck Speed (km/h)", 20, 50, 35)
            new_service = st.slider("Service Time (min)", 1.0, 5.0, 2.5, 0.5)
            param_changes = {
                'truck_speed_kmh': new_speed,
                'service_time_per_task_minutes': new_service,
            }

        run_btn = st.button("Run Scenario", type="primary")
        st.markdown('</div>', unsafe_allow_html=True)

    with col_right:
        if run_btn and day_key in task_data:
            tasks = dataframe_to_tasks(task_data[day_key])
            sim = BaselineSimulator(dm, params, sp_df)
            engine = ScenarioEngine(sim)

            if scenario_type == "Optimize Sequence":
                result = engine.scenario_optimize_sequence(tasks)
            elif scenario_type == "Fix Visited Tasks":
                result = engine.scenario_fix_visited(tasks)
            else:
                result = engine.scenario_adjust_parameters(tasks, param_changes)

            b = result.baseline_metrics
            s = result.scenario_metrics

            # Comparison table
            section_header("Results Comparison")

            def fmt_delta(val, unit="", reverse=False):
                """Format a delta value with color."""
                if abs(val) < 0.01:
                    return f'<span style="color:rgb(152,162,179)">0{unit}</span>'
                is_good = val < 0 if not reverse else val > 0
                color = "rgb(54,155,49)" if is_good else "rgb(224,60,57)"
                sign = "+" if val > 0 else ""
                return f'<span style="color:{color}">{sign}{val:.1f}{unit}</span>'

            def fmt_pct(old, new):
                if old == 0:
                    return "N/A"
                pct = (new - old) / abs(old) * 100
                return fmt_delta(pct, "%")

            metrics = [
                ("Distance", f"{b.total_distance_km:.1f} km", f"{s.total_distance_km:.1f} km",
                 fmt_delta(result.delta_distance, " km"), fmt_pct(b.total_distance_km, s.total_distance_km)),
                ("Time", format_time(b.total_time_minutes), format_time(s.total_time_minutes),
                 fmt_delta(result.delta_time, " min"), fmt_pct(b.total_time_minutes, s.total_time_minutes)),
                ("Cost", format_currency(b.total_cost), format_currency(s.total_cost),
                 fmt_delta(result.delta_cost, ""), fmt_pct(b.total_cost, s.total_cost)),
                ("Completion", format_percentage(b.actual_completion_rate), format_percentage(s.actual_completion_rate),
                 "", ""),
                ("CO2", f"{b.co2_emissions_kg:.1f} kg", f"{s.co2_emissions_kg:.1f} kg",
                 fmt_delta(result.delta_co2, " kg"), fmt_pct(b.co2_emissions_kg, s.co2_emissions_kg)),
            ]

            table_html = """
            <table style="width:100%; border-collapse:collapse; font-family:Inter; font-size:14px;">
            <tr style="background:rgb(11,43,81); color:white;">
                <th style="padding:10px; text-align:left; border-radius:8px 0 0 0;">Metric</th>
                <th style="padding:10px; text-align:right;">Baseline</th>
                <th style="padding:10px; text-align:right;">Scenario</th>
                <th style="padding:10px; text-align:right;">Change</th>
                <th style="padding:10px; text-align:right; border-radius:0 8px 0 0;">%</th>
            </tr>
            """
            for i, (name, base_val, scen_val, change, pct) in enumerate(metrics):
                bg = "rgb(248,250,252)" if i % 2 == 0 else "white"
                table_html += f"""
                <tr style="background:{bg};">
                    <td style="padding:10px; font-weight:600;">{name}</td>
                    <td style="padding:10px; text-align:right;">{base_val}</td>
                    <td style="padding:10px; text-align:right;">{scen_val}</td>
                    <td style="padding:10px; text-align:right;">{change}</td>
                    <td style="padding:10px; text-align:right;">{pct}</td>
                </tr>
                """
            table_html += "</table>"
            st.markdown(table_html, unsafe_allow_html=True)

            # Recommendation
            st.markdown("")
            rec_color = "rgb(54,155,49)" if result.delta_cost <= 0 else "rgb(224,60,57)"
            st.markdown(f"""
            <div class="result-card">
                <div style="font-weight:600; color:rgb(11,43,81); margin-bottom:8px;">
                    Recommendation
                </div>
                <div style="color:{rec_color}; font-size:14px;">
                    {result.recommendation}
                </div>
                <div style="color:rgb(152,162,179); font-size:12px; margin-top:8px;">
                    Feasibility Score: {result.feasibility_score:.0%}
                </div>
            </div>
            """, unsafe_allow_html=True)
        else:
            st.info("Configure a scenario on the left and click **Run Scenario** to see results.")


# =====================================================================
# TAB 4: Settings
# =====================================================================

def render_settings():
    section_header("Parameter Settings")

    params = cached_load_parameters()

    st.markdown("**Vehicle Parameters**")
    col1, col2 = st.columns(2)
    with col1:
        speed = st.number_input("Truck Speed (km/h)", value=params['vehicle']['truck_speed_kmh'], step=1)
        fuel_kml = st.number_input("Fuel Consumption (km/L)", value=params['vehicle']['fuel_consumption_kml'], step=0.5)
    with col2:
        capacity = st.number_input("Capacity (m³)", value=params['vehicle']['capacity_m3'], step=1)
        fuel_price = st.number_input("Fuel Price ($/L)", value=params['vehicle']['fuel_price_usd_per_liter'], step=0.1)

    st.markdown("**Operational Parameters**")
    col1, col2 = st.columns(2)
    with col1:
        shift = st.number_input("Shift Duration (hours)", value=params['operational']['shift_duration_hours'], step=0.5)
        service_time = st.number_input("Service Time/Task (min)", value=params['operational']['service_time_per_task_minutes'], step=0.5)
    with col2:
        depot_unload = st.number_input("Depot Unload Time (min)", value=params['operational']['depot_unload_time_minutes'], step=1)
        labor_rate = st.number_input("Labor Rate ($/h)", value=params['operational']['labor_rate_usd_per_hour'], step=1)

    st.markdown("**Bin Weights**")
    col1, col2, col3 = st.columns(3)
    with col1:
        w1100 = st.number_input("1100L (kg)", value=params['bins']['bin_1100l_weight_kg'], step=10)
    with col2:
        w240 = st.number_input("240L (kg)", value=params['bins']['bin_240l_weight_kg'], step=10)
    with col3:
        wc = st.number_input("Container (kg)", value=params['bins']['container_weight_kg'], step=10)

    st.markdown("**Emissions**")
    co2 = st.number_input("CO2 per Liter (kg)", value=params['emissions']['co2_per_liter_kg'], step=0.01)

    col1, col2, col3 = st.columns(3)
    with col1:
        if st.button("Save Parameters", type="primary"):
            import yaml
            new_params = {
                'vehicle': {
                    'truck_speed_kmh': speed,
                    'capacity_m3': capacity,
                    'fuel_consumption_kml': fuel_kml,
                    'fuel_price_usd_per_liter': fuel_price,
                },
                'operational': {
                    'shift_duration_hours': shift,
                    'service_time_per_task_minutes': service_time,
                    'depot_unload_time_minutes': depot_unload,
                    'labor_rate_usd_per_hour': labor_rate,
                },
                'bins': {
                    'bin_1100l_weight_kg': w1100,
                    'bin_240l_weight_kg': w240,
                    'container_weight_kg': wc,
                    'average_fill_percent': params['bins']['average_fill_percent'],
                },
                'emissions': {
                    'co2_per_liter_kg': co2,
                },
            }
            from src.utils.constants import DATA_PATHS
            with open(DATA_PATHS['parameters'], 'w') as f:
                yaml.dump(new_params, f, default_flow_style=False)
            st.success("Parameters saved!")
            st.cache_data.clear()

    with col2:
        if st.button("Load Defaults"):
            st.cache_data.clear()
            st.rerun()

    with col3:
        params_yaml = __import__('yaml').dump(params, default_flow_style=False)
        st.download_button("Export Config", params_yaml, "parameters.yaml", "text/yaml")


# =====================================================================
# Sidebar
# =====================================================================

def render_sidebar(params):
    with st.sidebar:
        st.markdown("""
        <div style="text-align:center; padding:16px 0;">
            <h1 style="color:rgb(11,43,81); font-size:20px; margin:0;">
                CIT Digital Twin
            </h1>
            <p style="color:rgb(71,84,103); font-size:12px; margin:4px 0 0 0;">
                Route Optimization Simulator
            </p>
        </div>
        """, unsafe_allow_html=True)

        st.markdown("---")

        with st.expander("Quick Parameters", expanded=False):
            speed = st.slider("Truck Speed (km/h)", 20, 50,
                              params['vehicle']['truck_speed_kmh'], key='sidebar_speed')
            shift = st.slider("Shift Duration (h)", 6.0, 10.0,
                              params['operational']['shift_duration_hours'], 0.5, key='sidebar_shift')
            service = st.slider("Service Time (min)", 1.0, 4.0,
                                params['operational']['service_time_per_task_minutes'], 0.5, key='sidebar_service')
            labor = st.number_input("Labor Rate ($/h)", value=params['operational']['labor_rate_usd_per_hour'],
                                    step=1, key='sidebar_labor')

            if st.button("Update Baseline", key='sidebar_update'):
                st.cache_data.clear()
                st.rerun()

        st.markdown("---")
        st.markdown("""
        <div style="font-size:11px; color:rgb(152,162,179); text-align:center;">
            MVP Phase 1 · Zone 2 B<br>
            5 days · 331 service points
        </div>
        """, unsafe_allow_html=True)


# =====================================================================
# Main
# =====================================================================

def main():
    st.set_page_config(
        page_title="CIT Digital Twin",
        page_icon="🚛",
        layout="wide",
        initial_sidebar_state="expanded",
    )

    apply_custom_css()

    # Load data
    task_data = cached_load_task_data()
    dm = cached_load_distance_matrix()
    sp_df = cached_load_service_points()
    params = cached_load_parameters()

    render_sidebar(params)

    # Tabs
    tab1, tab2, tab3, tab4 = st.tabs([
        "📊 Overview",
        "📈 Frequency Analysis",
        "🔬 Scenarios",
        "⚙️ Settings",
    ])

    with tab1:
        render_overview(task_data, dm, sp_df, params)

    with tab2:
        render_frequency(task_data)

    with tab3:
        render_scenarios(task_data, dm, sp_df, params)

    with tab4:
        render_settings()


if __name__ == "__main__":
    main()
