import streamlit as st
import pandas as pd
#from datetime import datetime, timedelta
from datetime import datetime, timedelta

# ================================
# Google Sheets code (commented out)
# ================================
# import gspread
# import json
# from google.oauth2.service_account import Credentials
#
# # Google Sheets setup
# scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
# creds_dict = dict(st.secrets["gcp_service_account"])
# creds = Credentials.from_service_account_info(creds_dict)
# client = gspread.authorize(creds)
# sheet = client.open("TaskChecklist").sheet1  # Change to your actual sheet name

# def get_tasks():
#     data = sheet.get_all_records()
#     return pd.DataFrame(data)
#
# def add_task(task, category):
#     sheet.append_row([task, category, 0, datetime.now().isoformat()])
#
# def complete_task(task_row):
#     sheet.update_cell(task_row + 2, 3, 1)
#
# def reset_tasks():
#     df = get_tasks()
#     now = datetime.now()
#     for i, row in df.iterrows():
#         task_time = datetime.fromisoformat(row['timestamp'])
#         if row['category'] == 'Daily' and now.date() > task_time.date():
#             sheet.update_cell(i + 2, 3, 0)
#             sheet.update_cell(i + 2, 4, now.isoformat())
#         elif row['category'] == 'Weekly' and now - task_time > timedelta(days=7):
#             sheet.update_cell(i + 2, 3, 0)
#             sheet.update_cell(i + 2, 4, now.isoformat())
#         elif row['category'] == 'Monthly' and now.month != task_time.month:
#             sheet.update_cell(i + 2, 3, 0)
#             sheet.update_cell(i + 2, 4, now.isoformat())
#         elif row['category'] == 'Quarterly' and (now.month - 1) // 3 != (task_time.month - 1) // 3:
#             sheet.update_cell(i + 2, 3, 0)
#             sheet.update_cell(i + 2, 4, now.isoformat())
#
# reset_tasks()

# ================================
# In-memory data storage using session_state
# ================================
if 'tasks' not in st.session_state:
    # Initialize an empty DataFrame with columns:
    # task, category, completed (0 or 1), and timestamp (ISO format)
    st.session_state.tasks = pd.DataFrame(columns=["task", "category", "completed", "timestamp"])

def get_tasks():
    return st.session_state.tasks

def add_task(task, category):
    new_task = pd.DataFrame({
        "task": [task],
        "category": [category],
        "completed": [0],
        "timestamp": [datetime.now().isoformat()]
    })
    st.session_state.tasks = pd.concat([st.session_state.tasks, new_task], ignore_index=True)

def complete_task(task_index):
    st.session_state.tasks.loc[task_index, "completed"] = 1

def reset_tasks():
    # For now, simply reset the completed status for tasks whose "time window" has passed
    now = datetime.now()
    df = st.session_state.tasks
    for i, row in df.iterrows():
        task_time = datetime.fromisoformat(row['timestamp'])
        if row['category'] == 'Daily' and now.date() > task_time.date():
            st.session_state.tasks.loc[i, "completed"] = 0
            st.session_state.tasks.loc[i, "timestamp"] = now.isoformat()
        elif row['category'] == 'Weekly' and now - task_time > timedelta(days=7):
            st.session_state.tasks.loc[i, "completed"] = 0
            st.session_state.tasks.loc[i, "timestamp"] = now.isoformat()
        elif row['category'] == 'Monthly' and now.month != task_time.month:
            st.session_state.tasks.loc[i, "completed"] = 0
            st.session_state.tasks.loc[i, "timestamp"] = now.isoformat()
        elif row['category'] == 'Quarterly' and (now.month - 1) // 3 != (task_time.month - 1) // 3:
            st.session_state.tasks.loc[i, "completed"] = 0
            st.session_state.tasks.loc[i, "timestamp"] = now.isoformat()

# ================================
# Dashboard Design
# ================================
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

    # Initialize session state for tasks if not already done
    for task in task_list:
        if task not in st.session_state:
            st.session_state[task] = False

    for task in task_list:
        # Get the checkbox state (checked or not)
        checked = st.checkbox(task, key=task, value=st.session_state[task])
        
        # Update session state based on checkbox value
        # st.session_state[task] = True

        if checked:
            st.markdown(f"<s>{task}</s>", unsafe_allow_html=True)  # Cross out completed tasks
            completed += 1

    st.progress(completed / total if total > 0 else 0)  # Display progress bar

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
    st.experimental_rerun()