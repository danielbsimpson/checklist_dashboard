import streamlit as st
import pandas as pd

# Streamlit UI
st.title("📝 Task Checklist Dashboard")
st.write("Track your tasks with automatic resets!")

categories = ["Daily", "Weekly", "Monthly", "Quarterly"]

daily_tasks = [
    "Exercise",
    "Stretch/Yoga (>20min)",
    "Social Media (<limit)",
    "Eat in",
    "Review Budget/Goals",
    "(2x)Brush+(1x)Floss",
    "Water (3L)",
    "7 hours sleep",
    "Clean (~20 min)",
    "Read (~20 min)",
    "Vitamins",
    "Duolingo"
]

weekly_tasks = [
    "Laundry",
    "Cleaning",
    "Grocery Shop",
    "Meal Prep",
    "Website work (~2h)",
    "Recycling",
    "Trash",
    "Shave/Trim",
    "Water Plants",
    "Weekend Exercise"
]

monthly_tasks = [
    "Wash Sheets",
    "Haircut",
    "Savings Deposit",
    "Loan Payment",
    "Wash mats"
]

def render_tasks(task_list, category):
    completed = 0
    total = len(task_list)
    
    with st.expander(category):
        for task in task_list:
            if task not in st.session_state:
                st.session_state[task] = False
            st.session_state[task] = st.checkbox(task, key=task, value=st.session_state[task])
            if st.session_state[task]:
                completed += 1
    
    progress_percentage = completed / total if total > 0 else 0
    color = "red" if progress_percentage <= 0.5 else "yellow" if progress_percentage <= 0.7 else "green"
    
    st.markdown(f"""
    <div style="width: 100%; background-color: #e0e0e0; border-radius: 5px;">
        <div style="width: {progress_percentage * 100}%; background-color: {color}; height: 20px; border-radius: 5px;"></div>
    </div>
    """, unsafe_allow_html=True)

st.subheader("Tasks")
col1, col2, col3 = st.columns(3)

with col1:
    st.subheader("Daily")
    render_tasks(daily_tasks, "Daily")

with col2:
    st.subheader("Weekly")
    render_tasks(weekly_tasks, "Weekly")

with col3:
    st.subheader("Monthly")
    render_tasks(monthly_tasks, "Monthly")

task_input = st.text_input("Add a new task:")
category_input = st.selectbox("Select category:", categories)
if st.button("Add Task"):
    st.experimental_rerun()

if st.button("Reset Tasks Now"):
    for task in daily_tasks + weekly_tasks + monthly_tasks:
        st.session_state[task] = False
    st.experimental_rerun()