# FB Tools API 🛠️
A lightweight API service to fetch Facebook User IDs and Profile Pictures via GET requests. Deployed on **Vercel**.
### 🚀 Live Base URL
https://fb-pp-api.vercel.app/
## 📌 Features & Usage
### 1. Get UID from Link
Convert any Facebook profile link into a numeric UID.
 * **Endpoint:** /api/fb-uid
 * **Method:** GET
 * **Query Param:** link=[profile_url]
 * **Example:** https://fb-pp-api.vercel.app/api/fb-uid?link=https://www.facebook.com/zuck
### 2. Get Profile Picture
Fetch a high-resolution (512x512) profile picture using UID.
 * **Endpoint:** /api/fb-pp
 * **Method:** GET
 * **Query Param:** uid=[user_id]
 * **Example:** https://fb-pp-api.vercel.app/api/fb-pp?uid=4
## 🛠️ Technical Details
 * **Runtime:** Node.js (ES Modules)
 * **Dependencies:** axios, qs, fetch
 * **Deployment:** Vercel (Serverless Functions)
## 👨‍💻 Author
**Adi.0X**
