# 🏠 PropertyPlus — Real Estate Management Web Application

PropertyPlus is a web-based real estate platform developed using **Flask (Python)** that allows users to buy, sell, and manage property listings efficiently.
The system provides authentication, dashboards for buyers and sellers, property management tools, and automated email notifications.

---

## 🚀 Features

### 👤 User Authentication

* User Signup & Login
* OTP Verification via Email
* Forgot Password & Reset
* Profile Setup & Management

### 🏘️ Property Management

* Add, Edit, Delete Property Listings
* Upload Images & Videos
* Property Search & Filters
* Property Details Viewer

### 📊 Dashboards

* Buyer Dashboard
* Seller Dashboard
* Leads Management
* Property Analytics Tools

### 📧 Email System

* OTP Verification Emails
* Welcome Emails
* Interest Notifications
* Price Drop Alerts
* Password Update Notifications

### 🛠️ Additional Tools

* Property Calculators
* Help & Support Section
* Responsive UI Design

---

## 🧑‍💻 Technologies Used

* **Backend:** Python, Flask
* **Frontend:** HTML, CSS, JavaScript
* **Database:** SQLite / SQL
* **Email Service:** Flask-Mail (SMTP)
* **Templating:** Jinja2
* **Version Control:** Git & GitHub

---

## 📂 Project Structure

```
PropertyPlus/
│── app/
│   ├── routes/
│   ├── models.py
│   ├── data/
│── static/
│   ├── css/
│   ├── js/
│   ├── uploads/
│── templates/
│── config.py
│── run.py
│── requirements.txt
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the Repository

```
git clone https://github.com/yourusername/your-repo-name.git
cd PropertyPlus
```

### 2️⃣ Install Dependencies

```
pip install -r requirements.txt
```

### 3️⃣ Environment Variables Setup

Create a `.env` file in the root folder and add:

```
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password
SECRET_KEY=your_secret_key
```

⚠️ Use Gmail **App Password**, not your actual Gmail password.

### 4️⃣ Run the Application

```
python run.py
```

Open browser:

```
http://127.0.0.1:5000
```

---

## 🔐 Security Notes

* Do not upload `.env` file to GitHub.
* Store credentials securely.
* Use environment variables for sensitive data.

---

## 👥 Contributors

* Your Name
* Collaborator Name(s)

---

## 📜 License

This project is developed for educational purposes (college project).

---

## 📸 Screenshots

(Add screenshots of your project here if needed)

---

## ✨ Future Enhancements

* Payment Integration
* Advanced Search Filters
* Mobile App Version
* Deployment on Cloud

---

## 📧 Contact

For any queries or suggestions, feel free to contact the project contributors.

---
