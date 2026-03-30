from flask import Flask, render_template, request, jsonify
import os
from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy


# --------- APP SETUP  ---------

app = Flask(__name__)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
db_path = os.path.join(BASE_DIR, "database", "baby_steps.db")

app.config['SQLALCHEMY_DATABASE_URI'] = "sqlite:///" + db_path
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)


#  --------- MODELS  ---------

# User table
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100))
    unit = db.Column(db.String(10))
    start_date = db.Column(db.String(10))

#Journal Entry table
class Entry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    user = db.relationship('User', backref=db.backref('entries', lazy=True))

    date_created = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    week = db.Column(db.Integer)
    mood = db.Column(db.String(50))
    weight = db.Column(db.Float)
    symptoms = db.Column(db.String(200))
    notes = db.Column(db.String(500))
    

# -------- HELPER FUNCTIONS --------


def calculate_current_week(start_date_str):
    '''Calculate current pregnancy week from the stored start date.'''
    if not start_date_str:
        return 0
    
    start_date = datetime.strptime(start_date_str, "%d/%m/%Y").replace(tzinfo=timezone.utc)
    today = datetime.now(timezone.utc)
    difference_in_days = (today - start_date).days
    week = difference_in_days // 7 + 1
    return max(week, 0) 


def format_weight(value, unit):
    '''Format a weight value with its unit.'''
    return f"{value:.2f} {unit}"

def format_datetime(dt):
    '''Return formatted date and time for display.'''
    if not dt:
        return {"date": "", "time": ""}
    
    return {
        "date": dt.strftime("%d %b %Y"),
        "time": dt.strftime("%H:%M")
    }


# -------- ROUTES --------

# Route for main page
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/user", methods=["GET", "POST"])
def user():
    """GET: return user info, POST: set username and unit"""

    if request.method == "POST":
        #Get data from frontend
        data = request.json
        username = data.get("username")
        unit = data.get("unit")
        start_date = data.get("start_date")

        # Check if user already exist
        user = User.query.first()
        if user:
            # update existing user
            user.username = username
            user.unit = unit
            user.start_date = start_date
        else:
            # Create a new user
            user = User(username=username, unit=unit, start_date=start_date)
            db.session.add(user)

        db.session.commit()
        return jsonify({
            "status": "success", 
            "username": username, 
            "unit": unit, 
            "start_date": start_date
            })

    else: # GET request
        user = User.query.first()
        if user:
            return jsonify({
                "username": user.username,
                "unit": user.unit,
                "start_date": user.start_date
            })
        else:
            return jsonify({})


# Route to add a new entry via POST
@app.route("/add_entry", methods=["POST"])
def add_entry():
    """Add a new entry from JSON request"""
    data = request.json
    user =User.query.first()
    symptoms_str = ",".join(data.get("symptoms",[])) 
    
    weight_str = data.get("weight", "")
    weight = float(weight_str) if weight_str else None

    entry = Entry(
        user_id=user.id,
        week=data["week"],
        mood=data["mood"],
        weight=weight,
        notes=data["notes"],
        symptoms=symptoms_str
    )
    db.session.add(entry)
    db.session.commit()
    return jsonify({"status": "success", "id": entry.id})

# Route to get all entries as JSON
@app.route("/entries")
def get_entries():
    entries = Entry.query.order_by(Entry.date_created.desc()).all()
    result = []

    for e in entries:
        formatted = format_datetime(e.date_created)
        
        result.append({
            "id": e.id,
            "week": e.week,
            "mood": e.mood,
            "weight": e.weight,
            "notes": e.notes,
            "unit": e.user.unit,
            "symptoms": e.symptoms.split(",") if e.symptoms else [],
            "date" : formatted['date'],
            "time": formatted['time']
        })

    return jsonify(result)


# Route to update an entry via POST
@app.route("/update_entry/<int:entry_id>", methods=["POST"])
def update_entry(entry_id):
    entry = Entry.query.get(entry_id)
    if not entry:
        return jsonify({"status": "not found"}), 404
    
    data = request.json

    #update field if provided
    entry.week = data.get("week", entry.week)
    entry.mood = data.get("mood", entry.mood)
    entry.weight = float(data["weight"]) if data.get("weight") else None
    entry.notes = data.get("notes", entry.notes)
    entry.symptoms = ",".join(data.get("symptoms", entry.symptoms.split(",")))

    db.session.commit()
    return jsonify({"status":"success"})

# Route to delete an entry via DELETE
@app.route("/delete_entry/<int:entry_id>", methods=["DELETE"])
def delete_entry(entry_id):
    """Delete an entry by ID"""
    entry = Entry.query.get(entry_id)
    if entry:
        db.session.delete(entry)
        db.session.commit()
        return jsonify({"status": "deleted"})
    return jsonify({"status": "not found"}), 404

@app.route("/current_week")
def current_week():
    '''Return the current pregnancy week.'''
    user = User.query.first()
    if not user or not user.start_date:
        return jsonify({"week": 0})
    
    week = calculate_current_week(user.start_date)
    return jsonify({"week": week})


@app.route("/progress")
def get_progress():
    '''Return summary progress statistics.'''
    entries = Entry.query.all()

    if not entries:
        return jsonify({
            "total": 0,
            "latest_week": 0,
            "most_common_symptom": "None",
            "average_mood": "None"
        })
    
    total = len(entries)
    latest_week = max(entry.week for entry in entries)

    # Count symptoms
    symptom_counts = {}
    for entry in entries:
        if entry.symptoms:
            for symptom in entry.symptoms.split(","):
                symptom = symptom.strip()
                if symptom:
                    symptom_counts[symptom] = symptom_counts.get(symptom, 0) + 1

    most_common_symptom = max(symptom_counts, key=symptom_counts.get) if symptom_counts else "None"
    
    # Count moods

    mood_counts = {}
    for entry in entries:
        if entry.mood:
            mood_counts[entry.mood.strip()] = mood_counts.get(entry.mood.strip(), 0) +1

    average_mood = max(mood_counts, key=mood_counts.get) if mood_counts else "None"

    return jsonify({
        "total": total,
        "latest_week": latest_week,
        "most_common_symptom": most_common_symptom,
        "average_mood": average_mood
    })

# -------- RUN APP --------

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=False,)


