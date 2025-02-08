import streamlit as st
import pandas as pd
import datetime as dt

# Functions
def render_tasks(task_list, category):
    completed = 0
    total = len(task_list)
    
    with st.expander(category):
        for task in task_list:
            if task not in st.session_state:
                st.session_state[task] = False

            checked = st.checkbox(task, key=task)
            
            if checked:
                completed += 1

    progress_percentage = completed / total if total > 0 else 0
    color = "red" if progress_percentage <= 0.5 else "yellow" if progress_percentage <= 0.7 else "green"
    
    st.markdown(f"""
    <div style="width: 100%; background-color: #e0e0e0; border-radius: 5px;">
        <div style="width: {progress_percentage * 100}%; background-color: {color}; height: 20px; border-radius: 5px;"></div>
    </div>
    """, unsafe_allow_html=True)

# Streamlit UI
st.set_page_config(layout="wide")
st.title("📝 Goals Dashboard")
st.write(f"{dt.date.today()}")

categories = ["Daily", "Weekly", "Monthly", "Quarterly"]

daily_tasks = [
    ":weight_lifter: Exercise",
    ":man-cartwheeling: Stretch/Yoga (>20min)",
    ":no_mobile_phones: Social Media (<limit)",
    ":sandwich: Eat in",
    ":heavy_check_mark: Review Budget/Goals",
    ":tooth: (2x)Brush+(1x)Floss",
    ":droplet: Water (3L)",
    ":sleeping: 7 hours sleep",
    "Clean (~20 min)",
    ":open_book: Read (~20 min)",
    ":pill: Vitamins",
    ":speaking_head_in_silhouette: Duolingo"
]

weekly_tasks = [
    ":shirt: Laundry",
    ":broom: Cleaning",
    ":shopping_trolley: Grocery Shop",
    ":male-cook: Meal Prep",
    ":male-student: Personal Development",
    ":recycle: Recycling",
    ":wastebasket: Trash",
    ":razor: Shave/Trim",
    ":potted_plant: Water Plants",
    ":running: Weekend Exercise"
]

monthly_tasks = [
    ":bed: Wash Sheets",
    ":barber: Haircut",
    ":moneybag: Savings Deposit",
    ":money_with_wings: Loan Payment",
    ":soap: Wash mats"
]

quarterly_tasks = [
    ":airplane_departure: Vacation Savings",
    ":robot_face: Longterm Project"
]
with st.sidebar:
    st.write("This application is developed to help track and tick off goals throughout the year. \
                The goals will reset depending on the interval. \
                The data will be stored and collected over the years to see trends.")
    render_tasks(monthly_tasks, "Monthly")
    render_tasks(quarterly_tasks, "Quarterly")

col1, col2 = st.columns(2)

with col1:
    render_tasks(daily_tasks, "Daily")

with col2:
    render_tasks(weekly_tasks, "Weekly")
    

# task_input = st.text_input("Add a new task:")
# category_input = st.selectbox("Select category:", categories)
# if st.button("Add Task"):
#     st.experimental_rerun()

# if st.button("Reset Tasks Now"):
#     for task in daily_tasks + weekly_tasks + monthly_tasks:
#         st.session_state[task] = False
#     st.experimental_rerun()