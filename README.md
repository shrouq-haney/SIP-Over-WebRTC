# 📘 Project Title: WebRTC Calling App (Microservices Architecture)

## 🧾 Description
A web-based peer-to-peer calling application that allows users to sign up, log in, see who is online, and initiate real-time video/audio calls using WebRTC. The system follows microservices principles, where the frontend and backend are standalone services that communicate only through REST APIs.

## 🔧 Tech Stack
- **Frontend**: HTML, CSS, JavaScript (WebRTC)
- **Backend**: Java (Servlets)
- **Database**: MySQL
- **Communication**: REST API (microservices)
- **Build Tool**: Apache Maven

## 🎯 Core Features
- User Authentication (Sign up, login, JWT session)
- User Discovery (List of online users)
- WebRTC Signaling (SDP & ICE exchange)
- Call Rejection Flow
- Call Logging (Optional)

## 🔗 API Endpoints & Request Examples

*(Note: Replace `localhost:8080` with your server's address and port and `/WebRTC_BackEnd` with your application's context path.)*

---

### Authentication API

#### **Register New User**
- `POST /WebRTC_BackEnd/api/auth/signup`
- **Body**:
  ```json
  {
    "username": "newuser",
    "password": "strongpassword123",
    "msisdn": "1234567890"
  }
  ```

#### **Login User**
- `POST /WebRTC_BackEnd/api/auth/login`
- **Body**:
  ```json
  {
    "username": "newuser",
    "password": "strongpassword123"
  }
  ```

#### **Get User Profile**
- `GET /WebRTC_BackEnd/api/auth/user/1`

---

### User Discovery API

#### **List Online Users**
- `GET /WebRTC_BackEnd/api/users/online`

#### **Update User Status**
- `POST /WebRTC_BackEnd/api/users/status`
- **Body**:
  ```json
  {
    "userId": 1,
    "online": true
  }
  ```

---

### Signaling API (SDP & ICE)

#### **Send SDP (Offer/Answer)**
- `POST /WebRTC_BackEnd/api/signaling/send-sdp`
- **Body**:
  ```json
  {
    "senderId": 1,
    "receiverId": 2,
    "type": "offer",
    "sdp": "{\"type\":\"offer\",\"sdp\":\"v=0\\r\\no=- 45969578...\"}"
  }
  ```

#### **Poll for Incoming SDP**
- `GET /WebRTC_BackEnd/api/signaling/get-sdp?receiverId=2`

#### **Send ICE Candidate**
- `POST /WebRTC_BackEnd/api/signaling/send-candidate`
- **Body**:
  ```json
  {
    "senderId": 1,
    "receiverId": 2,
    "candidate": "{\"candidate\":\"candidate:1234...\",\"sdpMid\":\"0\",\"sdpMLineIndex\":0}"
  }
  ```

#### **Poll for Incoming ICE Candidates**
- `GET /WebRTC_BackEnd/api/signaling/get-candidates?receiverId=2`

#### **Reject a Call**
- `POST /WebRTC_BackEnd/api/signaling/reject-call`
- **Body**:
  ```json
  {
    "from": "2",
    "to": "1"
  }
  ```

#### **Poll for Call Status**
- `GET /WebRTC_BackEnd/api/signaling/call-status?from=1&to=2`

---

## 🗄️ Database Schema (MySQL)
The database schema is defined in `src/main/resources/sql/database_setup.sql`. It includes tables for `users`, `sdp_exchange`, `ice_candidates`, and `call_logs`.

## 🚀 Setup and Installation

1.  **Database Setup**:
    - Ensure you have a MySQL server running.
    - Execute the `src/main/resources/sql/database_setup.sql` script to create the `webrtc_db` database, tables, and seed it with test data.
    - You can run this script using a MySQL client like MySQL Workbench or the command line:
      ```bash
      mysql -u your_username -p < src/main/resources/sql/database_setup.sql
      ```

2.  **Configure Database Connection**:
    - Open the `src/main/java/com/webrtc/backend/util/DatabaseUtil.java` file.
    - Update the `USER` and `PASSWORD` constants with your MySQL credentials.

3.  **Build the Project**:
    - Use Apache Maven to build the project. This will download dependencies and create a `.war` file.
      ```bash
      mvn clean install
      ```

4.  **Deploy**:
    - Deploy the generated `WebRTC_BackEnd.war` file (located in the `target/` directory) to a Servlet container like Apache Tomcat. 