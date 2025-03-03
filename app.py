import streamlit as st
import pandas as pd
import datetime as dt
import re
from supabase import create_client

# Function for rendering goals
def render_tasks(task_list, category, reset_date, key_prefix, expanded=False):

    completed_tasks = {}

    
    with st.expander(category, expanded=expanded):
        st.write(f"Resets on {reset_date}")

        for task in task_list:
            task_key = f"{key_prefix}_{task}"
            if task not in st.session_state:
                st.session_state[task] = False

            checked = st.checkbox(task, key=task)
            completed_tasks[task] = checked

    completed = sum(completed_tasks.values())
    total = len(task_list)

    progress_percentage = completed / total if total > 0 else 0
    color = "red" if progress_percentage <= 0.25 else "orange" if progress_percentage <= 0.5 else "yellow" if progress_percentage <= 0.7 else "green"
    
    st.markdown(f"""
    <div style="width: 100%; background-color: #e0e0e0; border-radius: 5px;">
        <div style="width: {progress_percentage * 100}%; background-color: {color}; height: 20px; border-radius: 5px; padding-top: 0rem; padding-bottom: 0rem;"></div>
    </div>
    """, unsafe_allow_html=True)

    st.text("")

    return completed_tasks

# Function to get the day suffix (st, nd, rd, th)
def get_day_suffix(day):
    if 11 <= day <= 13:
        return "th"
    elif day % 10 == 1:
        return "st"
    elif day % 10 == 2:
        return "nd"
    elif day % 10 == 3:
        return "rd"
    else:
        return "th"

def clean_column_name(name):
    """
    Cleans the column name by:
    - Removing anything between `:` (like emojis)
    - Removing anything between `(` and `)` (extra descriptions)
    - Replacing spaces and `/` with `_`
    - Converting to uppercase
    """
    name = re.sub(r":.*?:", "", name)  # Remove anything between `:`
    name = re.sub(r"\(.*?\)", "", name)  # Remove anything between `()`
    name = name.lstrip()
    name = name.rstrip()
    name = re.sub(r"[ /]", "_", name)  # Replace spaces and `/` with `_`
    name = name.replace('+', '_')
    name = name.replace('7', 'SEVEN')

    return name.strip().upper()

# Function to convert goal_data into Pandas DataFrame
def format_goal_data(goal_data):
    """
    Convert goal_data into a structured pandas DataFrame and clean column names
    """
    records = []
    current_date = dt.datetime.today()
    days_from_monday = current_time.weekday()
    this_week_start = current_date - dt.timedelta(days=days_from_monday)
    this_month_start = dt.datetime(current_time.year, current_time.month + 1, 1)

    for category, tasks in goal_data.items():
        record = {
            "DAILY_DATE": current_date if category == "daily" else None,
            "WEEK_START": this_week_start.date() if category == "weekly" else None,
            "MONTH_START": this_month_start.date() if category in ["monthly", "quarterly"] else None
        }

        # Add task completion flags with cleaned column names
        for task in daily_tasks + weekly_tasks + monthly_tasks + quarterly_tasks:
            cleaned_task = clean_column_name(task)  # Clean column name
            record[cleaned_task] = 1 if task in tasks else 0  # 1 if completed, 0 otherwise

        records.append(record)

    # Convert to DataFrame and rename columns
    df = pd.DataFrame(records)
    df.columns = [clean_column_name(col) for col in df.columns]  # Ensure all column names are cleaned

    return df

# Function to format dates with correct suffix and cross-platform compatibility
def format_date(dt_obj):
    day_str = dt_obj.strftime("%d").lstrip("0")  # Removes leading zeros
    return dt_obj.strftime(f"%A, %B {day_str}") + get_day_suffix(int(day_str))

# Convert dates to string in 'YYYY-MM-DD' format
def convert_dates_to_string(record):
    for key, value in record.items():
        if isinstance(value, dt.date):
            record[key] = value.strftime('%Y-%m-%d')  # Convert date to string format
    return record

# # Your Supabase URL and API Key
SUPABASE_URL = st.secrets["supabase"]["url"]
SUPABASE_KEY = st.secrets["supabase"]["api_key"]

# Create a Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Variables
current_time = dt.datetime.today()
tomorrow = current_time + dt.timedelta(days=1)

# Get beginning of next week (assuming Monday as the start of the week)
days_until_monday = (7 - current_time.weekday()) or 7  # Days until next Monday
next_week_start = current_time + dt.timedelta(days=days_until_monday or 7)
# Get beginning of next month
if current_time.month == 12:
    next_month_start = dt.datetime(current_time.year + 1, 1, 1)
else:
    next_month_start = dt.datetime(current_time.year, current_time.month + 1, 1)

# Apply formatting
formatted_today = format_date(current_time)
formatted_tomorrow = format_date(tomorrow)
formatted_next_week = format_date(next_week_start)
formatted_next_month = format_date(next_month_start)

# formatted_today = current_time.strftime("%A, %B %-d") + get_day_suffix(current_time.day)
# formatted_tomorrow = tomorrow.strftime("%A, %B %-d") + get_day_suffix(tomorrow.day)
# formatted_next_week = next_week_start.strftime("%A, %B %-d") + get_day_suffix(next_week_start.day)
# formatted_next_month = next_month_start.strftime("%A, %B %-d") + get_day_suffix(next_month_start.day)

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
    ":broom: Clean (~20 min)",
    ":open_book: Read (~20 min)",
    ":pill: Vitamins",
    ":speaking_head_in_silhouette: Duolingo"
]

weekly_tasks = [
    ":shirt: Laundry",
    ":plunger: Cleaning",
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

# Streamlit UI
st.set_page_config(page_title="Daniel's Goal Tracker App",
                    layout="wide", 
                    initial_sidebar_state="expanded")

st.markdown("""
    <style>
    div[data-testid="stToolbar"] {
        align-items: center;
        display: flex;
        justify-content: flex-start;
    }
    div[data-testid="stToolbar"]::before {
        content:""" + f""" "Goals Dashboard 📆 {formatted_today}";"""+
        """font-size: 20px;
        font-weight: bold;
        color: white;
        padding-left: 20px;
    }
    </style>
    """, unsafe_allow_html=True)


# Dictionary to store completed tasks before submission
goal_data = {}

with st.sidebar:
    st.write("This application is developed to help track and tick off goals throughout the year. \
              The goals will reset depending on the interval. \
              The data will be stored and collected over the years to see trends.")

    goal_data["monthly"] = render_tasks(monthly_tasks, "Monthly", formatted_next_month, "monthly")
    goal_data["quarterly"] = render_tasks(quarterly_tasks, "Quarterly", formatted_next_month, "quarterly")

col1, col2 = st.columns(2)

with col1:
    goal_data["daily"] = render_tasks(daily_tasks, "Daily", formatted_tomorrow, "daily", expanded=True)

with col2:
    goal_data["weekly"] = render_tasks(weekly_tasks, "Weekly", formatted_next_week, "weekly", expanded=True)

# Save Button
if st.button("Save Progress"):
    goal_df = format_goal_data(goal_data)

    # Convert the DataFrame to a dictionary format for Supabase
    goal_data_dict = [convert_dates_to_string(record) for record in goal_df.to_dict(orient="records")]

    # Used for debugging
    # st.write(goal_data_dict)
    
    # Insert the data into Supabase table "goals"
    response = supabase.table("goals").insert(goal_data_dict).execute()

    # Check the response for success or failure
    if response.data:  # Check if there is any data returned (indicating success)
        st.success("Data uploaded successfully!")
    else:
        st.error(f"Failed to upload data: {response.error_message if response.error_message else 'Unknown error'}")